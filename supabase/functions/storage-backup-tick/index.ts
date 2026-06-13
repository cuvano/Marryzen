// supabase/functions/storage-backup-tick/index.ts
//
// Phase 46 — Nightly Supabase Storage → AWS S3 backup
//
// Board-recommended DIY alternative to PITR. Closes the gap that even PITR
// doesn't cover: Supabase DB backups don't include Storage objects.
//
// Flow per nightly tick:
//   1. For each bucket in BACKUP_BUCKETS env var (comma-separated):
//      a. SELECT storage.objects LEFT JOIN storage_backup_tracking
//         WHERE tracking row missing OR source updated_at > tracking.source_updated_at
//         ORDER BY objects.updated_at ASC
//         LIMIT BATCH_SIZE
//      b. For each candidate:
//         - Download from Supabase Storage
//         - Upload to AWS S3 via aws4fetch SigV4
//         - INSERT/UPDATE storage_backup_tracking
//
// Required env vars:
//   S3_BACKUP_BUCKET    — name of the S3 bucket to write into (e.g. "marryzen-backups-eu-west-1")
//   S3_BACKUP_REGION    — AWS region of the bucket (e.g. "eu-west-1")
//   S3_BACKUP_PREFIX    — prefix inside the bucket (e.g. "supabase-storage")
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY — IAM credentials with PutObject on this bucket
//   BACKUP_BUCKETS      — comma-separated list of Supabase Storage buckets to back up
//                         (default: "profile-photos,profile_photos,selfies")
//
// Optional:
//   CRON_SECRET         — header X-Cron-Secret (default: 'marryzen-cron-2026')
//   BATCH_SIZE          — max objects per tick (default: 200)
//
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRON_SECRET_ENV = Deno.env.get("CRON_SECRET");
if (!CRON_SECRET_ENV) {
  console.warn("storage-backup-tick: CRON_SECRET env var not set; using literal fallback.");
}
const CRON_SECRET     = CRON_SECRET_ENV ?? "marryzen-cron-2026";

const S3_BACKUP_BUCKET = Deno.env.get("S3_BACKUP_BUCKET") ?? "";
const S3_BACKUP_REGION = Deno.env.get("S3_BACKUP_REGION") ?? "eu-west-1";
const S3_BACKUP_PREFIX = (Deno.env.get("S3_BACKUP_PREFIX") ?? "supabase-storage").replace(/\/+$/, "");
const AWS_ACCESS_KEY_ID     = Deno.env.get("AWS_ACCESS_KEY_ID") ?? "";
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY") ?? "";
const BACKUP_BUCKETS = (Deno.env.get("BACKUP_BUCKETS") ?? "profile-photos,profile_photos,selfies")
  .split(",").map(s => s.trim()).filter(Boolean);
const BATCH_SIZE = Number(Deno.env.get("BATCH_SIZE") ?? "200");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------- AWS S3 via aws4fetch ----------

let _awsClient: { fetch: (input: string, init?: RequestInit) => Promise<Response> } | null = null;
async function getAwsClient() {
  if (_awsClient) return _awsClient;
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials not configured");
  }
  const { AwsClient } = await import("https://esm.sh/aws4fetch@1.0.18");
  _awsClient = new AwsClient({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    service: "s3",
    region: S3_BACKUP_REGION,
  });
  return _awsClient;
}

async function s3PutObject(key: string, body: Uint8Array, contentType: string): Promise<{ ok: boolean; etag?: string; error?: string }> {
  try {
    const aws = await getAwsClient();
    // S3 virtual-hosted-style URL
    const host = `${S3_BACKUP_BUCKET}.s3.${S3_BACKUP_REGION}.amazonaws.com`;
    const url = `https://${host}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
    const r = await aws.fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-amz-storage-class": "STANDARD_IA",
      },
      body,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, error: `S3 PUT ${r.status} ${t.slice(0, 200)}` };
    }
    const etag = (r.headers.get("etag") ?? "").replace(/"/g, "");
    return { ok: true, etag };
  } catch (e) {
    return { ok: false, error: `S3 PUT threw: ${String(e).slice(0, 200)}` };
  }
}

// ---------- Main handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  const provided = req.headers.get("x-cron-secret") || req.headers.get("X-Cron-Secret");
  if (CRON_SECRET && provided !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!S3_BACKUP_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return new Response(JSON.stringify({ error: "missing_s3_env", needed: ["S3_BACKUP_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"] }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "supabase env missing" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const summary: Record<string, { scanned: number; backed_up: number; skipped: number; errors: number }> = {};
  const errors: string[] = [];

  for (const bucket of BACKUP_BUCKETS) {
    summary[bucket] = { scanned: 0, backed_up: 0, skipped: 0, errors: 0 };

    // Fetch list of source objects. storage.objects has bucket_id, name, updated_at, metadata
    // Use SQL to LEFT JOIN tracking and find candidates.
    const { data: candidates, error: qErr } = await sb.rpc("get_storage_backup_candidates", {
      p_bucket: bucket,
      p_limit: BATCH_SIZE,
    });

    if (qErr) {
      // Fallback: query storage.objects directly via REST, then filter in JS
      const { data: allObjects, error: listErr } = await sb
        .schema("storage")
        .from("objects")
        .select("name, updated_at, metadata, etag")
        .eq("bucket_id", bucket)
        .order("updated_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (listErr) {
        summary[bucket].errors++;
        errors.push(`${bucket}: list failed - ${listErr.message}`);
        continue;
      }

      // Fetch tracking rows for these names
      const names = (allObjects ?? []).map(o => o.name);
      const { data: tracked } = await sb
        .from("storage_backup_tracking")
        .select("path, source_updated_at")
        .eq("bucket", bucket)
        .in("path", names);

      const trackedMap = new Map<string, string>();
      for (const t of (tracked ?? [])) trackedMap.set(t.path as string, t.source_updated_at as string);

      const toBackup = (allObjects ?? []).filter(o => {
        const tt = trackedMap.get(o.name as string);
        if (!tt) return true;
        return new Date(o.updated_at as string).getTime() > new Date(tt).getTime();
      });

      summary[bucket].scanned = (allObjects ?? []).length;
      await processBatch(sb, bucket, toBackup, summary[bucket], errors);
    } else {
      summary[bucket].scanned = (candidates ?? []).length;
      await processBatch(sb, bucket, candidates ?? [], summary[bucket], errors);
    }
  }

  return new Response(JSON.stringify({ ok: true, summary, errors: errors.slice(0, 20) }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});

async function processBatch(
  sb: ReturnType<typeof createClient>,
  bucket: string,
  candidates: Array<{ name: string; updated_at: string; metadata?: Record<string, unknown>; etag?: string }>,
  stat: { scanned: number; backed_up: number; skipped: number; errors: number },
  errors: string[],
) {
  for (const obj of candidates) {
    const path = obj.name;
    try {
      // Download from Supabase Storage
      const { data: file, error: dlErr } = await sb.storage.from(bucket).download(path);
      if (dlErr || !file) {
        stat.errors++;
        errors.push(`${bucket}/${path}: download - ${dlErr?.message ?? "no_data"}`);
        continue;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const contentType = file.type || "application/octet-stream";

      // Build S3 key
      const s3Key = `${S3_BACKUP_PREFIX}/${bucket}/${path}`;

      // Upload to S3
      const up = await s3PutObject(s3Key, bytes, contentType);
      if (!up.ok) {
        stat.errors++;
        errors.push(`${bucket}/${path}: s3 - ${up.error}`);
        continue;
      }

      // Record in tracking table (upsert)
      await sb.from("storage_backup_tracking").upsert({
        bucket,
        path,
        source_etag: obj.etag ?? null,
        source_updated_at: obj.updated_at,
        s3_key: s3Key,
        s3_bucket: S3_BACKUP_BUCKET,
        backed_up_at: new Date().toISOString(),
        bytes: bytes.byteLength,
      }, { onConflict: "bucket,path" });

      stat.backed_up++;
    } catch (e) {
      stat.errors++;
      errors.push(`${bucket}/${path}: threw - ${String(e).slice(0, 200)}`);
    }
  }
}
