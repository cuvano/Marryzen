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
// DARK THEME: matches the rest of the admin panel (UserManagement,
// SafetyPanel, etc.). Uses slate-900/950 backgrounds + slate-50/300/400
// text + purple/rose/amber accents.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Heart, AlertTriangle, RefreshCcw, Send, ChevronRight } from 'lucide-react';

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

function formatFlagsHuman(flags) {
  if (!flags || typeof flags !== 'object') return [];
  const out = [];
  if (flags.disposable_email) {
    out.push({ label: `Disposable email (${flags.disposable_email})`, severity: 'high' });
  }
  if (flags.short_bio) {
    const len = flags.short_bio?.length ?? '?';
    out.push({ label: `Short bio (${len} chars)`, severity: 'med' });
  }
  if (flags.minimal_photos !== undefined) {
    out.push({ label: `Only ${flags.minimal_photos} photo`, severity: 'low' });
  }
  if (flags.very_young) {
    out.push({ label: `Age ${flags.very_young}`, severity: 'low' });
  }
  if (flags.very_old) {
    out.push({ label: `Age ${flags.very_old}`, severity: 'low' });
  }
  return out;
}

function scoreBadgeClass(score) {
  if (score >= 50) return 'bg-rose-900/40 text-rose-300 border-rose-800';
  if (score >= 25) return 'bg-amber-900/40 text-amber-300 border-amber-800';
  if (score > 0)   return 'bg-yellow-900/40 text-yellow-300 border-yellow-800';
  return 'bg-emerald-900/40 text-emerald-300 border-emerald-800';
}

function flagSeverityClass(severity) {
  if (severity === 'high') return 'text-rose-400';
  if (severity === 'med')  return 'text-amber-400';
  return 'text-slate-500';
}

// ----------------------------------------------------------------------------
// Stats tile bar
// ----------------------------------------------------------------------------
function StatTile({ label, value, sub, accent = 'slate' }) {
  const accentClass = {
    slate:   'text-white',
    purple:  'text-purple-400',
    rose:    'text-rose-400',
    amber:   'text-amber-400',
    emerald: 'text-emerald-400',
  }[accent] || 'text-white';

  return (
    <Card className="bg-slate-900 border border-slate-800 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${accentClass}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </Card>
  );
}

function StatsBar({ stats }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-slate-900 border border-slate-800 p-4">
            <div className="h-3 bg-slate-800 rounded w-1/2 mb-2 animate-pulse" />
            <div className="h-7 bg-slate-800 rounded w-1/3 animate-pulse" />
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
        accent="purple"
      />
      <StatTile
        label="Awaiting welcome"
        value={stats.founding_unwelcomed}
        sub={stats.founding_unwelcomed === 0 ? 'All caught up' : 'Welcome these next'}
        accent={stats.founding_unwelcomed === 0 ? 'emerald' : 'rose'}
      />
      <StatTile
        label="Risk-flagged"
        value={stats.risk_flagged_total}
        sub={stats.risk_flagged_total === 0 ? 'Clean queue' : 'Review before they cause issues'}
        accent={stats.risk_flagged_total === 0 ? 'emerald' : 'amber'}
      />
      <StatTile
        label="Median welcome lag"
        value={stats.median_signup_to_welcome_hours === 0 ? '—' : `${stats.median_signup_to_welcome_hours}h`}
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
    <tr className="border-b border-slate-800 hover:bg-slate-800/50">
      <td className="py-3 px-4">
        {row.primary_photo && !imgFailed ? (
          <img
            src={row.primary_photo}
            alt=""
            className="w-12 h-12 rounded-full object-cover border border-slate-700"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-sm font-medium">
            {row.full_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="font-medium text-white">{row.full_name || 'Unnamed'}</div>
        <div className="text-xs text-slate-400">{row.email}</div>
        <div className="text-xs text-slate-500 mt-0.5">
          {[age && `${age}yr`, row.location_city, row.location_country].filter(Boolean).join(' · ')}
        </div>
      </td>
      <td className="py-3 px-4 max-w-md">
        <div className="text-sm text-slate-300 line-clamp-2 italic">
          {row.bio || <span className="text-slate-500 not-italic">No bio</span>}
        </div>
      </td>
      <td className="py-3 px-4">
        <Badge variant="outline" className={`border ${scoreBadgeClass(row.risk_score)}`}>
          {row.risk_score}
        </Badge>
        {flags.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {flags.map((f, i) => (
              <div key={i} className={`text-xs ${flagSeverityClass(f.severity)}`}>
                · {f.label}
              </div>
            ))}
          </div>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-slate-400 whitespace-nowrap">
        {hours != null ? `${hours}h ago` : '—'}
        <div className="text-xs text-slate-500">since signup</div>
      </td>
      <td className="py-3 px-4 text-right whitespace-nowrap">
        <Button
          size="sm"
          onClick={() => onSend(row.user_id)}
          disabled={isSending}
          className="bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5 mr-1.5" />
          {isSending ? 'Sending...' : 'Send welcome'}
        </Button>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// Risk-flagged row
// ----------------------------------------------------------------------------
function RiskRow({ row, onOpen }) {
  const flags = formatFlagsHuman(row.risk_flags);
  return (
    <tr
      className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer"
      onClick={onOpen}
    >
      <td className="py-3 px-4">
        {row.primary_photo ? (
          <img src={row.primary_photo} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-700" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700" />
        )}
      </td>
      <td className="py-3 px-4">
        <div className="font-medium text-white">{row.full_name || 'Unnamed'}</div>
        <div className="text-xs text-slate-400">{row.email}</div>
        {row.founding_member && (
          <Badge variant="outline" className="mt-1 bg-purple-900/40 text-purple-300 border-purple-800 text-xs">Founding</Badge>
        )}
      </td>
      <td className="py-3 px-4">
        <Badge variant="outline" className={`border ${scoreBadgeClass(row.risk_score)}`}>{row.risk_score}</Badge>
        <div className="mt-1.5 space-y-0.5">
          {flags.map((f, i) => (
            <div key={i} className={`text-xs ${flagSeverityClass(f.severity)}`}>· {f.label}</div>
          ))}
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-slate-400 whitespace-nowrap">
        {row.welcomed_at ? (
          <span className="text-emerald-400">Welcomed</span>
        ) : (
          <span className="text-slate-500">Not yet welcomed</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white">
          Open Users <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// Main page
// ----------------------------------------------------------------------------
const AdminWelcomePage = () => {
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
        supabase.rpc('get_welcome_stats'),
        supabase.rpc('get_welcome_queue'),
        supabase.rpc('get_risk_flagged_queue'),
      ]);

      if (statsRes.error) throw statsRes.error;
      if (welcomeRes.error) throw welcomeRes.error;
      if (riskRes.error) throw riskRes.error;

      setStats(Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data);
      setWelcomeQueue(welcomeRes.data || []);
      setRiskQueue(riskRes.data || []);
    } catch (err) {
      console.error('AdminWelcomePage: load failed', err);
      toast({
        title: "Couldn't load admin queues",
        description: err?.message || 'Unknown error — check console.',
        variant: 'destructive',
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
      if (!token) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Send failed (${res.status})`);
      }

      toast({
        title: 'Welcome sent',
        description: json?.warning
          ? `Email sent, but: ${json.warning}`
          : 'User has been personally welcomed.',
      });

      // Optimistic: drop the row from the welcome queue + refresh stats
      setWelcomeQueue((q) => q.filter((r) => r.user_id !== userId));
      supabase.rpc('get_welcome_stats').then(({ data }) => {
        if (data) setStats(Array.isArray(data) ? data[0] : data);
      });
    } catch (err) {
      console.error('AdminWelcomePage: send failed', err);
      toast({
        title: 'Welcome failed',
        description: err?.message || 'Unknown error — check console.',
        variant: 'destructive',
      });
    } finally {
      setSendingId(null);
    }
  };

  const handleOpenUserList = () => {
    navigate('/admin/users');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            <Heart className="w-7 h-7 text-rose-400" />
            Welcome &amp; Risk Review
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Personally welcome founding-500 members. Review risk-flagged accounts.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadAll}
          disabled={loadingQueues}
          className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <RefreshCcw className={`w-4 h-4 mr-2 ${loadingQueues ? 'animate-spin' : ''}`} />
          {loadingQueues ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Tabs */}
      <Tabs defaultValue="welcome" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger
            value="welcome"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-400"
          >
            Welcome Queue
            {welcomeQueue.length > 0 && (
              <Badge className="ml-2 bg-rose-500/90 text-white border-0">
                {welcomeQueue.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="risk"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-400"
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            Risk-Flagged
            {riskQueue.length > 0 && (
              <Badge className="ml-2 bg-amber-500/90 text-slate-900 border-0">
                {riskQueue.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Welcome Queue tab */}
        <TabsContent value="welcome">
          <Card className="bg-slate-900 border border-slate-800 overflow-hidden mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 text-left w-20"></th>
                    <th className="py-3 px-4 text-left">Member</th>
                    <th className="py-3 px-4 text-left">Bio</th>
                    <th className="py-3 px-4 text-left">Risk</th>
                    <th className="py-3 px-4 text-left">Joined</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingQueues ? (
                    <tr><td colSpan={6} className="py-12 text-center text-slate-500">Loading…</td></tr>
                  ) : welcomeQueue.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-slate-400">
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
            </div>
          </Card>
        </TabsContent>

        {/* Risk-flagged tab */}
        <TabsContent value="risk">
          <Card className="bg-slate-900 border border-slate-800 overflow-hidden mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 text-left w-20"></th>
                    <th className="py-3 px-4 text-left">Member</th>
                    <th className="py-3 px-4 text-left">Risk</th>
                    <th className="py-3 px-4 text-left">Welcome status</th>
                    <th className="py-3 px-4 text-right">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingQueues ? (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-500">Loading…</td></tr>
                  ) : riskQueue.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-400">
                      No risk-flagged users right now.
                    </td></tr>
                  ) : (
                    riskQueue.map((row) => (
                      <RiskRow key={row.user_id} row={row} onOpen={handleOpenUserList} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminWelcomePage;
