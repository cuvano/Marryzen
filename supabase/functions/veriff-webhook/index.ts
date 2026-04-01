// @ts-nocheck
// Supabase Edge Function: Veriff decision webhook.
// Veriff calls this when a verification session reaches a decision (approved/declined).
// We update the profile using vendorData (user id) from the payload.
// Deploy with: supabase functions deploy veriff-webhook --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const status = body?.status ?? body?.verification?.status ?? body?.decision;
    const vendorData = body?.vendorData ?? body?.verification?.vendorData;
    const userId = typeof vendorData === "string" ? vendorData : vendorData?.userId ?? body?.endUserId ?? body?.verification?.endUserId;

    if (!userId) {
      console.error("Veriff webhook: no user id in payload", body);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const isApproved = status === "approved" || status === "Approved" || body?.decision === "approved";
    const isDeclined =
      status === "declined" ||
      status === "Declined" ||
      status === "rejected" ||
      body?.decision === "declined";

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
      if (error) {
        console.error("Veriff webhook: profile update failed", error);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Veriff webhook error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
