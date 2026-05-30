// @ts-nocheck
// Supabase Edge Function: admin-delete-user
//
// SUPER-ADMIN ONLY hard delete of a user. FK-safe (profiles -> auth.users is
// RESTRICT, so the profile row is removed BEFORE the auth login). Guards:
//   - caller must be super_admin (verified JWT + role lookup via service role)
//   - cannot delete admin / super_admin accounts
//   - cannot delete yourself
// Writes an immutable audit-log row (admin_audit_log).
//
// NOTE: storage media (profile photos) cleanup is a follow-up; this removes the
// profile row + auth login. Orphaned storage objects can be purged separately.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALLOWED_ORIGINS = new Set(["https://www.marryzen.com", "https://marryzen.com"]);
function buildCors(origin) {
  const ok = !!origin && (ALLOWED_ORIGINS.has(origin) || /^https:\/\/marryzen-[a-z0-9-]+\.vercel\.app$/i.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin : "https://www.marryzen.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Vary": "Origin",
  };
}

async function verifiedCallerId(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await anon.auth.getUser(token);
    if (error) return null;
    return data?.user?.id ?? null;
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const CORS = buildCors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Server misconfigured" }, { status: 500, headers: CORS });
  }

  const callerId = await verifiedCallerId(req.headers.get("authorization"));
  if (!callerId) return Response.json({ error: "unauthenticated" }, { status: 401, headers: CORS });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS }); }
  const targetId = String(body.user_id || "").trim();
  if (!targetId) return Response.json({ error: "user_id is required" }, { status: 400, headers: CORS });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // Caller must be super_admin.
  const { data: caller, error: callerErr } = await admin.from("profiles").select("id, role").eq("id", callerId).maybeSingle();
  if (callerErr) return Response.json({ error: "Server error" }, { status: 500, headers: CORS });
  if ((caller?.role || "").toLowerCase() !== "super_admin") {
    return Response.json({ error: "forbidden: super_admin only" }, { status: 403, headers: CORS });
  }

  // Cannot delete self.
  if (targetId === callerId) {
    return Response.json({ error: "You cannot delete your own account here." }, { status: 400, headers: CORS });
  }

  // Look up target; guard against deleting admins / super_admins.
  const { data: target, error: targetErr } = await admin.from("profiles").select("id, role, email, full_name").eq("id", targetId).maybeSingle();
  if (targetErr) return Response.json({ error: "Server error" }, { status: 500, headers: CORS });
  if (!target) return Response.json({ error: "User not found" }, { status: 404, headers: CORS });
  const targetRole = (target.role || "").toLowerCase();
  if (targetRole === "admin" || targetRole === "super_admin") {
    return Response.json({ error: "Admin / super_admin accounts cannot be deleted here." }, { status: 403, headers: CORS });
  }

  // Record in the immutable audit log BEFORE deleting, and ABORT if it can't be
  // written. A privileged destructive action must never succeed unrecorded.
  const { error: auditErr } = await admin.from("admin_audit_log").insert({
    actor_id: callerId,
    actor_role: caller?.role || "super_admin",
    action: "delete_user",
    target_id: targetId,
    target_email: target.email || null,
    details: { full_name: target.full_name || null, target_role: targetRole },
  });
  if (auditErr) {
    console.error("admin-delete-user: audit log insert failed; aborting delete:", auditErr.message);
    return Response.json({ error: "Could not record the action in the audit log; deletion aborted." }, { status: 500, headers: CORS });
  }

  // FK-safe delete: profile row first (profiles.id -> auth.users is RESTRICT), then the auth login.
  const { error: profDelErr } = await admin.from("profiles").delete().eq("id", targetId);
  if (profDelErr) {
    console.error("admin-delete-user: profile delete failed:", profDelErr.message);
    return Response.json({ error: "Failed to delete profile: " + profDelErr.message }, { status: 500, headers: CORS });
  }
  const { error: authDelErr } = await admin.auth.admin.deleteUser(targetId);
  if (authDelErr) {
    console.error("admin-delete-user: auth delete failed:", authDelErr.message);
    // Profile already gone + action already audited; surface partial failure.
    return Response.json({ error: "Profile deleted, but auth login removal failed: " + authDelErr.message + " (action is recorded in the audit log).", partial: true }, { status: 500, headers: CORS });
  }

  return Response.json({ ok: true, deleted: targetId }, { status: 200, headers: CORS });
});
