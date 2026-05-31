import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { ShieldAlert, CheckCircle, Ban, XCircle, MessageSquare, Mail, Clock, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// Pre-scripted warning templates — admin can pick one from a dropdown to
// prefill the Warning Message field, then optionally edit before sending.
// The 'custom' template is empty so admins can write from scratch.
const WARNING_TEMPLATES = [
  { id: 'custom', label: 'Custom (write your own)', text: '' },
  {
    id: 'fake_profile',
    label: 'Fake / misleading profile',
    text:
      "We've reviewed your profile and have concerns that some of the information you've provided (photos, name, age, or biographical details) does not appear to be genuine. Marryzen is a community built on authenticity and trust toward marriage. Please update your profile so it accurately represents you. Continued misrepresentation will lead to suspension or permanent removal of your account.",
  },
  {
    id: 'off_platform',
    label: 'Asking to move off-platform too early',
    text:
      "We've received a report that you are asking other members to move conversations off Marryzen (to WhatsApp, Instagram, Telegram, etc.) very early in the conversation. For everyone's safety, please keep early conversations on Marryzen so we can help protect you and the community from scams. Moving off-platform is only appropriate after mutual trust has been established.",
  },
  {
    id: 'money',
    label: 'Asking for money / financial scam',
    text:
      "We've received a report that you have asked another member for money, gifts, cryptocurrency, or financial assistance. This is strictly prohibited on Marryzen and is one of the most common warning signs of a romance scam. Any further attempts to solicit money from members will result in immediate and permanent removal of your account.",
  },
  {
    id: 'inappropriate',
    label: 'Inappropriate / sexual content',
    text:
      "We've received a report regarding inappropriate or sexually explicit messages sent through your account. Marryzen is a platform for serious marriage-minded conversations and explicit content is not permitted. Please review our Community Guidelines. Continued violations will result in suspension or permanent removal of your account.",
  },
  {
    id: 'harassment',
    label: 'Harassment / disrespectful conduct',
    text:
      "We've received a report that your conversations with other members have included harassment, insults, or disrespectful language. Every member of Marryzen deserves to be treated with kindness and respect, regardless of whether the conversation leads anywhere. Please reflect on how you engage with others. Further reports of this nature will result in account suspension or removal.",
  },
  {
    id: 'culture',
    label: 'Disrespect of cultural / religious values',
    text:
      "We've received a report that your messages have been disrespectful toward the cultural or religious values that Marryzen members hold dear. Marryzen serves a community that values faith, family, and respectful courtship. Please engage with other members in a way that honors this. Continued violations will result in removal.",
  },
  {
    id: 'spam',
    label: 'Spam / promotional messages',
    text:
      "We've received a report that your account is being used to send unsolicited promotional or spam messages to other members. Marryzen is not a marketplace or advertising platform. Please cease all promotional messaging immediately. Further violations will result in permanent removal of your account.",
  },
];

// Auto-pick the template that best matches the report's reason_category.
// Reporters file reports with categories like 'fake_profile',
// 'inappropriate_messages', 'asking_for_money', etc. Falls back to
// 'custom' (empty) if no match.
const templateForCategory = (cat) => {
  if (!cat) return 'custom';
  const c = String(cat).toLowerCase();
  if (c.includes('fake')) return 'fake_profile';
  if (c.includes('money') || c.includes('scam') || c.includes('financial')) return 'money';
  if (c.includes('off') || c.includes('platform') || c.includes('whatsapp')) return 'off_platform';
  if (c.includes('inappropriate') || c.includes('sexual')) return 'inappropriate';
  // Check culture/religion BEFORE harassment so 'religious_disrespect' or
  // 'cultural_disrespect' routes to culture (not harassment).
  if (c.includes('cultur') || c.includes('religi')) return 'culture';
  if (c.includes('harass') || c.includes('abuse') || c.includes('disrespect')) return 'harassment';
  if (c.includes('spam') || c.includes('promo')) return 'spam';
  return 'custom';
};

// Helper: compute age from date_of_birth
const ageFromDob = (dob) => {
  if (!dob) return null;
  const d = new Date(dob);
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a;
};

// Profile preview card (used twice per report — reporter + reported)
const ProfilePreview = ({ profile, label, accent }) => (
  <div className="bg-slate-800/60 p-3 rounded border border-slate-700">
    <div className="font-semibold text-slate-400 text-xs uppercase tracking-wider mb-2">{label}</div>
    <div className="flex gap-3 items-start">
      {profile?.photos?.[0] ? (
        <img
          src={profile.photos[0]}
          alt={profile.full_name}
          className="w-14 h-14 rounded-full object-cover flex-shrink-0 border border-slate-700"
        />
      ) : (
        <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-700">
          <User className="w-6 h-6 text-slate-600" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className={`text-white font-medium truncate ${accent || ''}`}>
          {profile?.full_name ?? 'Unknown'}
          {profile?.status === 'banned' && (
            <Badge variant="destructive" className="ml-2 text-[10px]">BANNED</Badge>
          )}
          {profile?.status === 'suspended' && (
            <Badge variant="outline" className="ml-2 text-[10px] text-yellow-400 border-yellow-700">SUSPENDED</Badge>
          )}
        </div>
        <div className="text-slate-400 text-xs mt-0.5">
          {ageFromDob(profile?.date_of_birth) && <span>{ageFromDob(profile.date_of_birth)} • </span>}
          {profile?.location_city || ''}{profile?.location_city && profile?.location_country ? ', ' : ''}{profile?.location_country || ''}
        </div>
        {profile?.email && <div className="text-slate-400 text-xs mt-0.5 truncate">{profile.email}</div>}
        {profile?.id && <div className="text-slate-500 text-[11px] mt-0.5 font-mono truncate">{profile.id}</div>}
      </div>
    </div>
  </div>
);

// Conversation viewer modal — fetches messages between reporter and reported
const ConversationViewer = ({ reporter, reported, open, onOpenChange }) => {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !reporter?.id || !reported?.id) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Conversations use canonical ordering (smaller UUID = user1_id)
        const u1 = reporter.id < reported.id ? reporter.id : reported.id;
        const u2 = reporter.id < reported.id ? reported.id : reporter.id;
        const { data: convo, error: convoErr } = await supabase
          .from('conversations')
          .select('id')
          .eq('user1_id', u1)
          .eq('user2_id', u2)
          .maybeSingle();
        if (convoErr) throw convoErr;
        if (!convo) {
          setMessages([]);
          return;
        }
        const { data: msgs, error: msgErr } = await supabase
          .from('messages')
          .select('id, sender_id, content, created_at')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: true });
        if (msgErr) throw msgErr;
        setMessages(msgs || []);
      } catch (e) {
        console.error('ConversationViewer load failed:', e);
        setError(e.message || 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, reporter?.id, reported?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Conversation: <span className="text-red-300">{reporter?.full_name}</span> ↔ <span className="text-red-300">{reported?.full_name}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="text-xs text-slate-500 mb-2">
          Admin read-only view. Disclosed per Marryzen Terms (Section: Safety Review).
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2">
          {loading && <div className="text-slate-500 text-center py-8">Loading…</div>}
          {error && (
            <div className="text-red-400 text-sm bg-red-950 border border-red-900 p-3 rounded">
              {error}
            </div>
          )}
          {!loading && !error && messages.length === 0 && (
            <div className="text-slate-500 text-center py-8">No messages exchanged in this conversation.</div>
          )}
          {!loading && !error && messages.map((msg) => {
            const fromReporter = msg.sender_id === reporter?.id;
            return (
              <div key={msg.id} className={`flex ${fromReporter ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${
                    fromReporter
                      ? 'bg-slate-800 border border-slate-700'
                      : 'bg-red-950/40 border border-red-900/50'
                  }`}
                >
                  <div className="text-[10px] text-slate-500 mb-1">
                    {fromReporter ? reporter?.full_name : reported?.full_name}
                    {' • '}
                    {new Date(msg.created_at).toLocaleString()}
                  </div>
                  <div className="text-sm text-white whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SafetyPanel = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [selectedReport, setSelectedReport] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [actionInFlight, setActionInFlight] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [conversationContext, setConversationContext] = useState(null); // { reporter, reported }
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  // For suspend/ban: short user-facing reason that goes into the auto-email.
  // Separate from `resolutionNotes` (admin-only). Optional — defaults to a
  // generic "Violation of Community Guidelines" line in the Edge Function
  // if left blank.
  const [userFacingReason, setUserFacingReason] = useState('');
  // Suppress the auto-email entirely (use for CSAM / threats / doxxing where
  // tipping off the offender is harmful — see T&S guidance).
  const [suppressNotification, setSuppressNotification] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (!profile || !['admin', 'super_admin'].includes(profile.role?.toLowerCase())) {
        toast({
          title: 'Access Denied',
          description: `Admin role required. Current role: ${profile?.role || 'none'}`,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      let query = supabase
        .from('user_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching reports:', error);
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setReports([]);
        return;
      }

      if (!data || data.length === 0) {
        setReports([]);
        return;
      }

      // Fetch profile details (expanded: photos, dob, location) for both sides
      const reporterIds = [...new Set(data.map((r) => r.reporter_id).filter(Boolean))];
      const reportedIds = [...new Set(data.map((r) => r.reported_user_id).filter(Boolean))];
      const allIds = [...new Set([...reporterIds, ...reportedIds])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, status, suspended_until, photos, date_of_birth, location_city, location_country')
        .in('id', allIds);
      const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      const reportsWithProfiles = data.map((report) => ({
        ...report,
        reporter: byId[report.reporter_id],
        reported: byId[report.reported_user_id],
      }));
      setReports(reportsWithProfiles);
    } catch (err) {
      console.error('Exception fetching reports:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const openActionDialog = (report) => {
    setSelectedReport(report);
    setResolutionNotes('');
    setUserFacingReason('');
    setSuppressNotification(false);
    // Auto-pick the template that best matches the report's category, and
    // prefill the warning message with that template's text. Admin can
    // change the dropdown selection (or edit the text directly) before
    // clicking Send Warning.
    const initialId = templateForCategory(report.reason_category);
    setSelectedTemplate(initialId);
    const initialTpl = WARNING_TEMPLATES.find((t) => t.id === initialId);
    setWarningMessage(initialTpl ? initialTpl.text : '');
  };

  const openConversation = (report) => {
    setConversationContext({ reporter: report.reporter, reported: report.reported });
    setConversationOpen(true);
  };

  // Unified action handler. action ∈ 'dismiss' | 'warn' | 'suspend' | 'ban'
  // suspendDays only used when action === 'suspend'
  const takeAction = async (action, suspendDays = null) => {
    if (!selectedReport) return;
    if (actionInFlight) return;

    if (action === 'warn' && !warningMessage.trim()) {
      toast({ title: 'Warning message required', description: 'Please write the message the user will receive.', variant: 'destructive' });
      return;
    }
    if (action === 'ban') {
      if (!resolutionNotes.trim()) {
        toast({ title: 'Admin notes required for ban', description: 'Document why this user is being permanently banned. This is for audit trail.', variant: 'destructive' });
        return;
      }
      if (!window.confirm(`Permanently ban ${selectedReport.reported?.full_name}? This cannot be undone via this UI.`)) {
        return;
      }
    }

    setActionInFlight(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: 'Not signed in',
          description: 'Your admin session has expired. Refresh and sign in again.',
          variant: 'destructive',
        });
        setActionInFlight(false);
        return;
      }

      // 1. For 'warn', send email FIRST. If it fails, don't write the report update.
      if (action === 'warn') {
        const { error } = await supabase.functions.invoke('send-user-warning', {
          body: {
            user_id: selectedReport.reported?.id,
            message: warningMessage.trim(),
          },
        });
        if (error) {
          console.error('send-user-warning failed:', error);
          toast({ title: 'Failed to send warning', description: error.message || 'See console for details', variant: 'destructive' });
          setActionInFlight(false);
          return;
        }
      }

      // 2. Build report update
      const reportUpdate = {
        admin_resolved_by: session?.user?.id,
        admin_resolution_notes: resolutionNotes.trim() || null,
      };
      // 3. Build profile update if needed
      let profileUpdate = null;

      if (action === 'dismiss') {
        reportUpdate.status = 'dismissed';
        reportUpdate.action_taken = 'dismissed';
      } else if (action === 'warn') {
        reportUpdate.status = 'resolved';
        reportUpdate.action_taken = 'warning_sent';
      } else if (action === 'suspend') {
        const untilIso = new Date(Date.now() + suspendDays * 24 * 60 * 60 * 1000).toISOString();
        reportUpdate.status = 'resolved';
        reportUpdate.action_taken = `suspended_${suspendDays}d`;
        reportUpdate.suspended_until = untilIso;
        profileUpdate = { status: 'suspended', suspended_until: untilIso };
      } else if (action === 'ban') {
        reportUpdate.status = 'resolved';
        reportUpdate.action_taken = 'banned';
        profileUpdate = { status: 'banned', suspended_until: null };
      }

      // 4. Apply report update
      const { error: reportErr } = await supabase
        .from('user_reports')
        .update(reportUpdate)
        .eq('id', selectedReport.id);
      if (reportErr) {
        toast({ title: 'Failed to update report', description: reportErr.message, variant: 'destructive' });
        setActionInFlight(false);
        return;
      }

      // 5. Apply profile update if any
      if (profileUpdate && selectedReport.reported?.id) {
        const { error: profErr } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', selectedReport.reported.id);
        if (profErr) {
          // Report already updated; profile failed. Surface but don't roll back.
          toast({
            title: 'Profile update failed',
            description: `Report saved, but profile.status not updated: ${profErr.message}`,
            variant: 'destructive',
          });
        }
      }

      // 6. Notify the user (DSA Art. 17 "statement of reasons").
      // Runs AFTER profile.status is updated so a partial failure can't
      // result in a "you are banned" email to a user who isn't banned.
      // Skipped when suppressNotification is checked (CSAM/threats/doxxing
      // — see T&S guidance). Email failure does NOT roll back the
      // moderation action; surface a toast so admin can resend manually.
      if ((action === 'suspend' || action === 'ban') &&
          !suppressNotification &&
          selectedReport.reported?.id) {
        const invokeBody = action === 'suspend'
          ? {
              user_id: selectedReport.reported.id,
              action_type: 'suspension',
              suspend_days: suspendDays,
              user_facing_reason: userFacingReason.trim() || null,
            }
          : {
              user_id: selectedReport.reported.id,
              action_type: 'ban',
              user_facing_reason: userFacingReason.trim() || null,
            };
        const { error: notifyErr } = await supabase.functions.invoke('send-user-warning', {
          body: invokeBody,
        });
        if (notifyErr) {
          console.error(`send-user-warning (${action}) failed:`, notifyErr);
          toast({
            title: `${action === 'suspend' ? 'Suspension' : 'Ban'} applied — email failed`,
            description: 'Moderation action took effect but the notification email did not send. Resend manually from admin@marryzen.com.',
            variant: 'destructive',
          });
        }
      }

      // 7. Done
      const actionLabel = {
        dismiss: 'Dismissed',
        warn: 'Warning sent',
        suspend: `Suspended ${suspendDays}d`,
        ban: 'Banned',
      }[action];
      toast({ title: actionLabel, description: `Action recorded on report.` });
      setSelectedReport(null);
      setResolutionNotes('');
      setWarningMessage('');
      setSelectedTemplate('custom');
      setUserFacingReason('');
      setSuppressNotification(false);
      fetchReports();
    } catch (e) {
      console.error('takeAction error:', e);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setActionInFlight(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">Reports & Safety Queue</h2>
        <select
          className="h-10 rounded-md border border-slate-700 bg-slate-900 text-white px-3 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="open">Open Reports</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All History</option>
        </select>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-slate-500 py-10 text-center">Loading reports…</div>
        ) : reports.length === 0 ? (
          <div className="text-slate-500 py-10 text-center border border-dashed border-slate-800 rounded">
            <p className="mb-2">
              No reports with filter: <strong>{filter}</strong>
            </p>
          </div>
        ) : (
          reports.map((report) => (
            <Card key={report.id} className="bg-slate-900 border-slate-800 text-slate-200">
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive" className="uppercase tracking-wider">
                      {report.reason_category?.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs text-slate-500">{new Date(report.created_at).toLocaleString()}</span>
                  </div>
                  <CardTitle className="text-lg">
                    <span className="text-red-400">{report.reporter?.full_name}</span> reported{' '}
                    <span className="text-red-400">{report.reported?.full_name}</span>
                  </CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className={`${
                    report.status === 'open'
                      ? 'text-green-400 border-green-800'
                      : report.status === 'dismissed'
                        ? 'text-slate-500'
                        : 'text-yellow-400 border-yellow-800'
                  }`}
                >
                  {report.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 mb-4 sm:grid-cols-2 text-sm">
                  <ProfilePreview profile={report.reporter} label="Reported by (reporter)" />
                  <ProfilePreview profile={report.reported} label="Reported user" />
                </div>

                <div className="bg-slate-950 p-4 rounded border border-slate-800 mb-4 italic text-slate-300">
                  "{report.reason_details || report.reason_category}"
                </div>

                {report.status !== 'open' && (report.action_taken || report.admin_resolution_notes) && (
                  <div className="mb-3 bg-slate-800/40 p-3 rounded border border-slate-700 text-xs">
                    {report.action_taken && (
                      <div className="text-slate-400">
                        Action taken: <span className="text-white font-semibold">{report.action_taken}</span>
                        {report.suspended_until && (
                          <span className="ml-2">
                            <Clock className="inline w-3 h-3 mr-1" />
                            until {new Date(report.suspended_until).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                    {report.admin_resolution_notes && (
                      <div className="text-slate-400 mt-1 italic">"{report.admin_resolution_notes}"</div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openConversation(report)}
                    className="border-slate-500 text-slate-100 bg-slate-800/40 hover:bg-slate-700 hover:border-slate-400"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" /> View Conversation
                  </Button>

                  <Dialog
                    open={selectedReport?.id === report.id}
                    onOpenChange={(o) => {
                      if (!o) {
                        setSelectedReport(null);
                        setResolutionNotes('');
                        setWarningMessage('');
                        setSelectedTemplate('custom');
                        setUserFacingReason('');
                        setSuppressNotification(false);
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={() => openActionDialog(report)}>
                        Take Action
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Take Action — {selectedReport?.reported?.full_name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
                        <div>
                          <Label className="text-xs uppercase tracking-wider text-slate-400">
                            Admin Notes (internal — never shown to users)
                          </Label>
                          <textarea
                            className="w-full h-20 bg-slate-950 border border-slate-700 rounded p-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-slate-600"
                            placeholder="Why are you taking this action? Visible only to admins."
                            value={resolutionNotes}
                            onChange={(e) => setResolutionNotes(e.target.value)}
                          />
                        </div>

                        <div>
                          <Label className="text-xs uppercase tracking-wider text-slate-400">
                            Warning Message (only sent if you click Send Warning)
                          </Label>
                          <select
                            className="w-full mt-1 h-10 rounded-md border border-slate-700 bg-slate-950 text-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-slate-600"
                            value={selectedTemplate}
                            onChange={(e) => {
                              const id = e.target.value;
                              setSelectedTemplate(id);
                              const tpl = WARNING_TEMPLATES.find((t) => t.id === id);
                              setWarningMessage(tpl ? tpl.text : '');
                            }}
                          >
                            {WARNING_TEMPLATES.map((t) => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                          </select>
                          <textarea
                            className="w-full h-32 bg-slate-950 border border-slate-700 rounded p-2 text-sm mt-2 focus:outline-none focus:ring-1 focus:ring-slate-600"
                            placeholder="Pick a template above to prefill, or type your own. The user will see this verbatim in their warning email."
                            value={warningMessage}
                            onChange={(e) => setWarningMessage(e.target.value)}
                          />
                          <div className="text-[10px] text-slate-500 mt-1">
                            Picking a template overwrites the text above. You can still edit before sending.
                          </div>
                        </div>

                        <div className="border-t border-slate-800 pt-3 space-y-3">
                          <div>
                            <Label className="text-xs uppercase tracking-wider text-slate-400">
                              Reason for user email (suspend / ban only)
                            </Label>
                            <input
                              type="text"
                              maxLength={500}
                              className="w-full h-10 bg-slate-950 border border-slate-700 rounded p-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-slate-600"
                              placeholder="One-line summary the user will see. E.g. 'You sent unsolicited messages asking for money.' Leave blank for a generic line."
                              value={userFacingReason}
                              onChange={(e) => setUserFacingReason(e.target.value)}
                            />
                            <div className="text-[10px] text-slate-500 mt-1">
                              Used in the suspension / ban email. Distinct from admin notes above. Optional — defaults to "Violation of our Community Guidelines."
                            </div>
                          </div>

                          <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={suppressNotification}
                              onChange={(e) => setSuppressNotification(e.target.checked)}
                              className="mt-0.5"
                            />
                            <span>
                              <span className="font-semibold text-red-400">Suppress notification email</span> — use for CSAM, threats, or doxxing where tipping off the offender is harmful (before law-enforcement referral). Otherwise leave unchecked.
                            </span>
                          </label>
                        </div>

                        <div className="border-t border-slate-800 pt-3 space-y-2">
                          <Button
                            variant="secondary"
                            className="w-full"
                            disabled={actionInFlight}
                            onClick={() => takeAction('dismiss')}
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Dismiss as Invalid (no action)
                          </Button>

                          <Button
                            className="w-full bg-amber-600 hover:bg-amber-700"
                            disabled={actionInFlight || !warningMessage.trim()}
                            onClick={() => takeAction('warn')}
                          >
                            <Mail className="w-4 h-4 mr-2" /> Send Warning Email
                          </Button>

                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              variant="destructive"
                              className="bg-orange-700 hover:bg-orange-800"
                              disabled={actionInFlight}
                              onClick={() => takeAction('suspend', 1)}
                            >
                              Suspend 1d
                            </Button>
                            <Button
                              variant="destructive"
                              className="bg-orange-700 hover:bg-orange-800"
                              disabled={actionInFlight}
                              onClick={() => takeAction('suspend', 7)}
                            >
                              Suspend 7d
                            </Button>
                            <Button
                              variant="destructive"
                              className="bg-orange-700 hover:bg-orange-800"
                              disabled={actionInFlight}
                              onClick={() => takeAction('suspend', 30)}
                            >
                              Suspend 30d
                            </Button>
                          </div>

                          <Button
                            variant="destructive"
                            className="w-full bg-red-800 hover:bg-red-900"
                            disabled={actionInFlight}
                            onClick={() => takeAction('ban')}
                          >
                            <Ban className="w-4 h-4 mr-2" /> Permanent Ban
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ConversationViewer
        reporter={conversationContext?.reporter}
        reported={conversationContext?.reported}
        open={conversationOpen}
        onOpenChange={(o) => {
          setConversationOpen(o);
          if (!o) setConversationContext(null);
        }}
      />
    </div>
  );
};

export default SafetyPanel;
