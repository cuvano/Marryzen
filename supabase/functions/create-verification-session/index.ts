// @ts-nocheck
// Supabase Edge Function: create a Didit verification session and return the URL.
// User is identified by JWT; we pass their profile id as vendor_data so the webhook can update the right profile.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIDIT_API_BASE = "https://verification.didit.me";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("DIDIT_API_KEY");
    const workflowId = Deno.env.get("DIDIT_WORKFLOW_ID");
    const baseUrl = Deno.env.get("DIDIT_API_BASE") || DIDIT_API_BASE;
    if (!apiKey || !workflowId) {
      console.error("DIDIT_API_KEY or DIDIT_WORKFLOW_ID not set");
      return new Response(
        JSON.stringify({ error: "Didit not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://www.marryzen.com";
    const baseOrigin = origin.replace(/\/$/, "").split("/").slice(0, 3).join("/");
    const callbackUrl = `${baseOrigin}/profile?verification=done`;

    const body = {
      workflow_id: workflowId,
      vendor_data: user.id,
      callback: callbackUrl,
      callback_method: "both",
    };

    const res = await fetch(`${baseUrl}/v3/session/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Didit create session error:", res.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to create verification session", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const url = data?.url ?? data?.verification_url;
    if (!url) {
      return new Response(
        JSON.stringify({ error: "No session URL in response", data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sessionId = data?.session_id ?? data?.id;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.from("profiles").update({
        identity_verification_status: "pending",
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);
    }

    return new Response(
      JSON.stringify({ url, sessionId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
