// @ts-nocheck
// Supabase Edge Function: Didit decision webhook.
// Didit calls this when a verification session status changes (e.g. Approved, Declined).
// We update the profile using vendor_data (user id) from the payload.
// Deploy with: supabase functions deploy didit-webhook --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function shortenFloats(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(shortenFloats);
  if (data !== null && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, shortenFloats(v)])
    );
  }
  if (typeof data === "number" && !Number.isInteger(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).sort().reduce((acc: Record<string, unknown>, key) => {
      acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
      return acc;
    }, {});
  }
  return obj;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return toHex(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ua = new TextEncoder().encode(a);
  const ub = new TextEncoder().encode(b);
  if (ua.length !== ub.length) return false;
  let out = 0;
  for (let i = 0; i < ua.length; i++) out |= ua[i] ^ ub[i];
  return out === 0;
}

async function verifySignatureV2(
  jsonBody: Record<string, unknown>,
  signatureHeader: string,
  timestampHeader: string,
  secretKey: string
): Promise<boolean> {
  const currentTime = Math.floor(Date.now() / 1000);
  const incomingTime = parseInt(timestampHeader, 10);
  if (Math.abs(currentTime - incomingTime) > 300) return false;
  const processed = shortenFloats(jsonBody);
  const canonical = JSON.stringify(sortKeys(processed));
  const expected = await hmacSha256Hex(secretKey, canonical);
  return timingSafeEqual(expected, signatureHeader);
}

function verifySignatureSimple(
  jsonBody: Record<string, unknown>,
  signatureHeader: string,
  timestampHeader: string,
  secretKey: string
): Promise<boolean> {
  const currentTime = Math.floor(Date.now() / 1000);
  const incomingTime = parseInt(timestampHeader, 10);
  if (Math.abs(currentTime - incomingTime) > 300) return Promise.resolve(false);
  const canonical = [
    jsonBody.timestamp ?? "",
    jsonBody.session_id ?? "",
    jsonBody.status ?? "",
    jsonBody.webhook_type ?? "",
  ].join(":");
  return hmacSha256Hex(secretKey, canonical).then((expected) =>
    timingSafeEqual(expected, signatureHeader)
  );
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json() as Record<string, unknown>;
    const timestamp = req.headers.get("x-timestamp") ?? req.headers.get("X-Timestamp") ?? "";
    const signatureV2 = req.headers.get("x-signature-v2") ?? req.headers.get("X-Signature-V2") ?? "";
    const signatureSimple = req.headers.get("x-signature-simple") ?? req.headers.get("X-Signature-Simple") ?? "";

    const secret = Deno.env.get("DIDIT_WEBHOOK_SECRET");
    if (secret && timestamp) {
      let ok = false;
      if (signatureV2) {
        ok = await verifySignatureV2(body, signatureV2, timestamp, secret);
      }
      if (!ok && signatureSimple) {
        ok = await verifySignatureSimple(body, signatureSimple, timestamp, secret);
      }
      if (!ok && (signatureV2 || signatureSimple)) {
        console.error("Didit webhook: signature verification failed");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const vendorData = body.vendor_data as string | undefined;
    const userId = typeof vendorData === "string" ? vendorData : undefined;
    const status = (body.status as string) ?? "";

    if (!userId) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isApproved = status === "Approved";
    const isDeclined = status === "Declined" || status === "Abandoned";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (isApproved) {
      update.identity_verification_status = "verified";
      update.is_verified = true;
    } else if (isDeclined) {
      update.identity_verification_status = "rejected";
      update.is_verified = false;
    }

    if (Object.keys(update).length > 1) {
      const { error } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", userId);
      if (error) console.error("Didit webhook: profile update failed", error);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Didit webhook error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
