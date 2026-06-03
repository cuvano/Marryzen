// src/pages/admin/AdminWelcomePage.jsx
//
// Admin queue page for the hybrid welcome system. Two tabs:
//   1. Welcome Queue — founding-500 members not yet welcomed. One-click
//      "Send Welcome" button per row sends the templated email + marks
//      welcomed_at via the send-welcome-email Edge Function.
//   2. Risk-Flagged Queue — any verified user with risk_score > 0 who
//      hasn't been actioned (warned/suspended/banned). Click a row to
//      open the user list (SafetyPanel uses report-driven flow, not
//      per-user routes, so we route to /admin/users where admin can
//      search by name and take action).
//
// ROUTING: add `<Route path="welcome" element={<AdminWelcomePage />} />`
// nested inside the existing `<Route path="/admin" element={<AdminLayout />}>`
// block in src/App.jsx. URL becomes /admin/welcome.
//
// DATA SOURCES (all created by 20260602030000_hybrid_welcome_system.sql):
//   - RPC get_welcome_stats()         — top-of-page tiles
//   - RPC get_welcome_queue()          — Welcome Queue tab
//   - RPC get_risk_flagged_queue()     — Risk-Flagged Queue tab
//   - Edge Function send-welcome-email — Send Welcome button action
//
// All RPCs and the edge function are admin-gated server-side; this page's
// frontend gating is decorative.

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function ageFromDob(dob) {
  if (!dob) return null;
  try {
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  } catch {
    return null;
  }
}

function hoursAgo(iso) {
  if (!iso) return null;
  try {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / (1000 * 60 * 60));
  } catch {
    return null;
  }
}

function formatFlagsHuman(flags) {
  // Convert {disposable_email: "mailinator.com", short_bio: {length: 12}, ...}
  // into a short human label list.
  if (!flags || typeof flags !== "object") return [];
  const out = [];
  if (flags.disposable_email) {
    out.push({ label: `Disposable email (${flags.disposable_email})`, severity: "high" });
  }
  if (flags.short_bio) {
    const len = flags.short_bio?.length ?? "?";
    out.push({ label: `Short bio (${len} chars)`, severity: "med" });
  }
  if (flags.minimal_photos !== undefined) {
    out.push({ label: `Only ${flags.minimal_photos} photo`, severity: "low" });
  }
  if (flags.very_young) {
    out.push({ label: `Age ${flags.very_young}`, severity: "low" });
  }
  if (flags.very_old) {
    out.push({ label: `Age ${flags.very_old}`, severity: "low" });
  }
  return out;
}

function scoreBadgeColor(score) {
  if (score >= 50) return "bg-rose-100 text-rose-800 border-rose-300";
  if (score >= 25) return "bg-amber-100 text-amber-800 border-amber-300";
  if (score > 0)   return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

// ----------------------------------------------------------------------------
// Stats tile bar
// ----------------------------------------------------------------------------
function StatTile({ label, value, sub }) {
  return (
    <Card className="bg-cream/50">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">{label}</div>
        <div className="text-2xl font-semibold text-stone-900">{value}</div>
        {sub && <div className="text-xs text-stone-500 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StatsBar({ stats }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-cream/50">
            <CardContent className="p-4">
              <div className="h-3 bg-stone-200 rounded w-1/2 mb-2 animate-pulse" />
              <div className="h-7 bg-stone-200 rounded w-1/3 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <StatTile
        label="Founding members"
        value={`${stats.founding_count} / ${stats.founding_cap}`}
        sub={`${stats.founding_cap - stats.founding_count} spots left`}
      />
      <StatTile
        label="Awaiting welcome"
        value={stats.founding_unwelcomed}
        sub={stats.founding_unwelcomed === 0 ? "All caught up" : "Welcome these next"}
      />
      <StatTile
        label="Risk-flagged"
        value={stats.risk_flagged_total}
        sub={stats.risk_flagged_total === 0 ? "Clean queue" : "Review before they cause issues"}
      />
      <StatTile
        label="Median welcome lag"
        value={stats.median_signup_to_welcome_hours === 0 ? "—" : `${stats.median_signup_to_welcome_hours}h`}
        sub="From signup to welcome"
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Welcome Queue row
// ----------------------------------------------------------------------------
function WelcomeRow({ row, onSend, isSending }) {
  const [imgFailed, setImgFailed] = useState(false);
  const flags = formatFlagsHuman(row.risk_flags);
  const age = ageFromDob(row.date_of_birth);
  const hours = row.hours_since_signup;

  return (
    <tr className="border-b border-stone-100 hover:bg-cream/30">
      <td className="py-3 px-3">
        {row.primary_photo && !imgFailed ? (
          <img
            src={row.primary_photo}
            alt=""
            className="w-12 h-12 rounded-full object-cover border border-stone-200"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-sm font-medium">
            {row.full_name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
      </td>
      <td className="py-3 px-3">
        <div className="font-medium text-stone-900">{row.full_name || "Unnamed"}</div>
        <div className="text-xs text-stone-500">{row.email}</div>
        <div className="text-xs text-stone-400 mt-0.5">
          {[age && `${age}yr`, row.location_city, row.location_country].filter(Boolean).join(" · ")}
        </div>
      </td>
      <td className="py-3 px-3 max-w-md">
        <div className="text-sm text-stone-700 line-clamp-2 italic">
          {row.bio || <span className="text-stone-400 not-italic">No bio</span>}
        </div>
      </td>
      <td className="py-3 px-3">
        <Badge className={`border ${scoreBadgeColor(row.risk_score)}`}>
          {row.risk_score}
        </Badge>
        {flags.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {flags.map((f, i) => (
              <div key={i} className={`text-xs ${
                f.severity === "high" ? "text-rose-700" :
                f.severity === "med"  ? "text-amber-700" :
                "text-stone-500"
              }`}>
                · {f.label}
              </div>
            ))}
          </div>
        )}
      </td>
      <td className="py-3 px-3 text-sm text-stone-500 whitespace-nowrap">
        {hours != null ? `${hours}h ago` : "—"}
        <div className="text-xs text-stone-400">since signup</div>
      </td>
      <td className="py-3 px-3 text-right whitespace-nowrap">
        <Button
          size="sm"
          onClick={() => onSend(row.user_id)}
          disabled={isSending}
          className="bg-rose-600 hover:bg-rose-700 text-white"
        >
          {isSending ? "Sending..." : "Send welcome"}
        </Button>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// Risk-flagged row (read-only; click opens SafetyPanel for that user)
// ----------------------------------------------------------------------------
function RiskRow({ row, onOpen }) {
  const flags = formatFlagsHuman(row.risk_flags);
  return (
    <tr
      className="border-b border-stone-100 hover:bg-cream/30 cursor-pointer"
      onClick={() => onOpen()}
    >
      <td className="py-3 px-3">
        {row.primary_photo ? (
          <img src={row.primary_photo} alt="" className="w-10 h-10 rounded-full object-cover border border-stone-200" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-stone-200" />
        )}
      </td>
      <td className="py-3 px-3">
        <div className="font-medium text-stone-900">{row.full_name || "Unnamed"}</div>
        <div className="text-xs text-stone-500">{row.email}</div>
        {row.founding_member && (
          <Badge className="mt-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs">Founding</Badge>
        )}
      </td>
      <td className="py-3 px-3">
        <Badge className={`border ${scoreBadgeColor(row.risk_score)}`}>{row.risk_score}</Badge>
        <div className="mt-1.5 space-y-0.5">
          {flags.map((f, i) => (
            <div key={i} className="text-xs text-stone-600">· {f.label}</div>
          ))}
        </div>
      </td>
      <td className="py-3 px-3 text-sm text-stone-500 whitespace-nowrap">
        {row.welcomed_at ? "Welcomed" : "Not yet welcomed"}
      </td>
      <td className="py-3 px-3 text-right">
        <Button size="sm" variant="outline">Open in Users →</Button>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// Main page
// ----------------------------------------------------------------------------
export default function AdminWelcomePage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [welcomeQueue, setWelcomeQueue] = useState([]);
  const [riskQueue, setRiskQueue] = useState([]);
  const [loadingQueues, setLoadingQueues] = useState(true);
  const [sendingId, setSendingId] = useState(null);

  const loadAll = useCallback(async () => {
    setLoadingQueues(true);
    try {
      const [statsRes, welcomeRes, riskRes] = await Promise.all([
        supabase.rpc("get_welcome_stats"),
        supabase.rpc("get_welcome_queue"),
        supabase.rpc("get_risk_flagged_queue"),
      ]);

      if (statsRes.error) throw statsRes.error;
      if (welcomeRes.error) throw welcomeRes.error;
      if (riskRes.error) throw riskRes.error;

      // get_welcome_stats returns a single row as an array of one
      setStats(Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data);
      setWelcomeQueue(welcomeRes.data || []);
      setRiskQueue(riskRes.data || []);
    } catch (err) {
      console.error("AdminWelcomePage: load failed", err);
      toast({
        title: "Couldn't load admin queues",
        description: err?.message || "Unknown error — check console.",
        variant: "destructive",
      });
    } finally {
      setLoadingQueues(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSendWelcome = async (userId) => {
    setSendingId(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Send failed (${res.status})`);
      }

      toast({
        title: "Welcome sent",
        description: json?.warning
          ? `Email sent, but: ${json.warning}`
          : "User has been personally welcomed.",
      });

      // Optimistic: drop the row from the welcome queue + refresh stats
      setWelcomeQueue((q) => q.filter((r) => r.user_id !== userId));
      // Refresh stats in background; don't block UI
      supabase.rpc("get_welcome_stats").then(({ data }) => {
        if (data) setStats(Array.isArray(data) ? data[0] : data);
      });
    } catch (err) {
      console.error("AdminWelcomePage: send failed", err);
      toast({
        title: "Welcome failed",
        description: err?.message || "Unknown error — check console.",
        variant: "destructive",
      });
    } finally {
      setSendingId(null);
    }
  };

  const handleOpenUserList = () => {
    // Marryzen's existing admin flows are report-driven (no per-user routes).
    // Route to /admin/users where admin can search by name and access
    // user-level actions (warn/suspend/ban via the existing UserManagement
    // → SafetyPanel pattern).
    navigate("/admin/users");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Welcome &amp; Risk Review</h1>
          <p className="text-sm text-stone-500 mt-1">
            Personally welcome founding-500 members. Review risk-flagged accounts.
          </p>
        </div>
        <Button variant="outline" onClick={loadAll} disabled={loadingQueues}>
          {loadingQueues ? "Loading..." : "Refresh"}
        </Button>
      </div>

      <StatsBar stats={stats} />

      <Tabs defaultValue="welcome">
        <TabsList>
          <TabsTrigger value="welcome">
            Welcome Queue
            {welcomeQueue.length > 0 && (
              <Badge className="ml-2 bg-rose-100 text-rose-800 border border-rose-200">
                {welcomeQueue.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="risk">
            Risk-Flagged
            {riskQueue.length > 0 && (
              <Badge className="ml-2 bg-amber-100 text-amber-800 border border-amber-200">
                {riskQueue.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="welcome">
          <Card className="mt-4">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream/40 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="py-3 px-3 text-left w-16"></th>
                    <th className="py-3 px-3 text-left">Member</th>
                    <th className="py-3 px-3 text-left">Bio</th>
                    <th className="py-3 px-3 text-left">Risk</th>
                    <th className="py-3 px-3 text-left">Verified</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingQueues ? (
                    <tr><td colSpan={6} className="py-12 text-center text-stone-400">Loading…</td></tr>
                  ) : welcomeQueue.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-stone-400">
                      🎉 Welcome queue empty — every founding member has been welcomed.
                    </td></tr>
                  ) : (
                    welcomeQueue.map((row) => (
                      <WelcomeRow
                        key={row.user_id}
                        row={row}
                        onSend={handleSendWelcome}
                        isSending={sendingId === row.user_id}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card className="mt-4">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream/40 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="py-3 px-3 text-left w-16"></th>
                    <th className="py-3 px-3 text-left">Member</th>
                    <th className="py-3 px-3 text-left">Risk</th>
                    <th className="py-3 px-3 text-left">Welcome</th>
                    <th className="py-3 px-3 text-right">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingQueues ? (
                    <tr><td colSpan={5} className="py-12 text-center text-stone-400">Loading…</td></tr>
                  ) : riskQueue.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-stone-400">
                      No risk-flagged users right now.
                    </td></tr>
                  ) : (
                    riskQueue.map((row) => (
                      <RiskRow key={row.user_id} row={row} onOpen={handleOpenUserList} />
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
