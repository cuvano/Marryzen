import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Search, MoreHorizontal, ShieldAlert, Ban, CheckCircle, RefreshCcw, Eye, Image as ImageIcon, XCircle, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Display page size; fetch uses smaller batches to work around API caps
const PAGE_SIZE = 30;
const FETCH_BATCH = 25;

const UserManagement = () => {
  const { toast } = useToast();
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentAdminRole, setCurrentAdminRole] = useState(null);
  const [page, setPage] = useState(1);
  const [deletingUser, setDeletingUser] = useState(false);
  // Premium grant UI state (per-selectedUser; resets on close).
  const [premiumDurationKey, setPremiumDurationKey] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [applyingGrant, setApplyingGrant] = useState(false);

  const totalCount = allUsers.length;
  const users = allUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Session 14 finding #2 — admin list showed "Suspended" for users whose
  // suspension had already expired. The clear_expired_suspension() RPC only
  // fires on the suspended user's next login (it uses auth.uid()), so the DB
  // row stays stale until they log in. Compute the effective status here so
  // admins see the truth instantly. Also surface a tiny "(expired)" hint
  // so it's obvious why the user can still log in.
  const getEffectiveStatus = (u) => {
    if (u?.status === 'suspended' && u?.suspended_until) {
      const t = new Date(u.suspended_until).getTime();
      if (!Number.isNaN(t) && t < Date.now()) return null; // effectively cleared
    }
    return u?.status ?? null;
  };
  const isSuspensionExpired = (u) =>
    u?.status === 'suspended' && u?.suspended_until &&
    new Date(u.suspended_until).getTime() < Date.now();

  // Reset premium-grant form when switching between users (or closing the dialog).
  useEffect(() => {
    setPremiumDurationKey('');
    setCustomDate('');
    setGrantReason('');
  }, [selectedUser?.id]);


  const buildBaseQuery = (cursorId = null) => {
    let q = supabase.from('profiles').select('*');
    if (filterStatus !== 'all') {
      if (filterStatus === 'no_status') q = q.is('status', null);
      else q = q.eq('status', filterStatus);
    }
    if (searchTerm) {
      q = q.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }
    // NB: keep DB sort by id DESC only. The id-based cursor (lt('id', cursorId))
    // requires that the primary sort match the cursor; any secondary sort breaks
    // pagination and silently drops rows. Serial-offender ordering happens in JS
    // after all pages are accumulated (see fetchAllUsers).
    q = q.order('id', { ascending: false });
    if (cursorId != null) q = q.lt('id', cursorId);
    return q.limit(FETCH_BATCH);
  };

  /**
   * Fetch all users with id-based cursor so we get every profile regardless of
   * created_at nulls or API row cap. Deduplicate by id, then sort by created_at.
   */
  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const byId = new Map();
      let cursorId = null;
      let chunk;

      do {
        const { data, error } = await buildBaseQuery(cursorId);

        if (error) {
          console.error('Error fetching users:', error);
          toast({
            title: "Error",
            description: error.message || "Could not load users.",
            variant: "destructive"
          });
          setAllUsers([]);
          return;
        }

        chunk = data || [];
        chunk.forEach((row) => byId.set(row.id, row));
        if (chunk.length > 0) cursorId = chunk[chunk.length - 1].id;
      } while (chunk.length > 0);

      const accumulated = Array.from(byId.values()).sort((a, b) => {
        // Sprint C B5: serial offenders first. Then newest-account-first as tiebreaker.
        const rc = (b.unresolved_report_count ?? 0) - (a.unresolved_report_count ?? 0);
        if (rc !== 0) return rc;
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
      setAllUsers(accumulated);
    } catch (err) {
      console.error('Unexpected error fetching users:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading users.",
        variant: "destructive"
      });
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAdminRole();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      fetchAllUsers();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, filterStatus]);

  const checkAdminRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      setCurrentAdminRole(profile?.role?.toLowerCase());
    }
  };

  const updateUser = async (id, updates) => {
    // Only super admins can change user roles
    if (updates.role && currentAdminRole !== 'super_admin') {
      toast({ 
        title: "Permission Denied", 
        description: "Only super admins can change user roles.",
        variant: "destructive" 
      });
      return;
    }

    // Regular admins cannot change status of admins or super admins
    if (currentAdminRole !== 'super_admin' && updates.status) {
      const targetUser = allUsers.find(u => u.id === id);
      const targetRole = targetUser?.role?.toLowerCase();
      
      if (targetRole === 'admin' || targetRole === 'super_admin') {
        toast({ 
          title: "Permission Denied", 
          description: "Regular admins cannot modify the status of other admins or super admins.",
          variant: "destructive" 
        });
        return;
      }
    }

    // L3 hardening 2026-06-09: dispatch privileged-column updates through
    // their respective SECURITY DEFINER RPCs (migration 20260609010000).
    // Each RPC writes a profiles UPDATE + audit_logs row atomically and
    // bypasses the privileged-column trigger that blocks direct PATCHes.
    // Non-privileged updates (e.g., future free-text fields) keep the
    // direct .update() path.
    let error = null;
    // Reviewer-B1 2026-06-09: identity_verification_status is paired with
    // is_verified in several call sites in this file. If we routed through
    // log_admin_toggle_verified the identity status would be silently dropped.
    // Route both to log_admin_identity_verify, which writes BOTH columns
    // atomically — matching how VerificationQueue does it.
    if (Object.prototype.hasOwnProperty.call(updates, 'identity_verification_status')) {
      const ivs = updates.identity_verification_status;
      // 'verified' or 'rejected' map directly; 'pending'/null map to a soft "reset"
      // which we expose as a 'rejected' decision so the admin path remains audited.
      const decision = ivs === 'verified' ? 'approved' : 'rejected';
      const r = await supabase.rpc('log_admin_identity_verify', {
        target_user: id,
        decision,
        reviewer_notes: null,
      });
      error = r.error;
    } else if (Object.prototype.hasOwnProperty.call(updates, 'role')) {
      const r = await supabase.rpc('log_admin_role_change', {
        target_user: id,
        new_role: updates.role,
        reason: null,
      });
      error = r.error;
    } else if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
      const r = await supabase.rpc('log_admin_user_status_change', {
        target_user: id,
        new_status: updates.status,
        suspend_until: updates.suspended_until ?? null,
        reason: null,
      });
      error = r.error;
    } else if (Object.prototype.hasOwnProperty.call(updates, 'is_verified')) {
      const r = await supabase.rpc('log_admin_toggle_verified', {
        target_user: id,
        new_value: !!updates.is_verified,
        reason: null,
      });
      error = r.error;
    } else if (Object.prototype.hasOwnProperty.call(updates, 'notes_admin')) {
      const r = await supabase.rpc('log_admin_set_notes', {
        target_user: id,
        notes: updates.notes_admin,
      });
      error = r.error;
    } else {
      // Non-privileged field update — direct PATCH is fine (trigger won't block).
      const r = await supabase.from('profiles').update(updates).eq('id', id);
      error = r.error;
    }

    if (error) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated Successfully", description: "User record modified." });
      setAllUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
      if (selectedUser?.id === id) setSelectedUser({ ...selectedUser, ...updates });
    }
  };

  // Apply a time-bounded premium grant or revoke via RPC.
  // Migration 20260607020000_premium_grants_time_bounded.sql installs the
  // log_premium_grant and log_premium_revoke server-side functions, which
  // atomically update profiles + write an audit_logs entry, and which check
  // is_admin() internally so a non-admin caller gets a 42501 error.
  const applyPremiumGrant = async (userId) => {
    if (!premiumDurationKey) return;
    setApplyingGrant(true);
    try {
      let rpcName;
      let rpcArgs;
      if (premiumDurationKey === 'off') {
        rpcName = 'log_premium_revoke';
        rpcArgs = { target_user: userId, reason: grantReason || null };
      } else {
        rpcName = 'log_premium_grant';
        let durationStr;
        if (premiumDurationKey === 'forever') durationStr = null;
        else if (premiumDurationKey === '7d') durationStr = '7 days';
        else if (premiumDurationKey === '30d') durationStr = '30 days';
        else if (premiumDurationKey === '90d') durationStr = '90 days';
        else if (premiumDurationKey === '365d') durationStr = '365 days';
        else if (premiumDurationKey === 'custom') {
          if (!customDate) {
            toast({ title: 'Pick a date', description: 'Custom expiry requires a date.', variant: 'destructive' });
            setApplyingGrant(false);
            return;
          }
          const target = new Date(customDate + 'T23:59:59');
          const ms = target - new Date();
          const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
          if (days <= 0) {
            toast({ title: 'Invalid date', description: 'Custom expiry must be a future date.', variant: 'destructive' });
            setApplyingGrant(false);
            return;
          }
          durationStr = `${days} days`;
        } else { setApplyingGrant(false); return; }
        rpcArgs = { target_user: userId, source: 'admin', duration: durationStr, reason: grantReason || null };
      }
      const { data, error } = await supabase.rpc(rpcName, rpcArgs);
      if (error) {
        toast({ title: 'Premium update failed', description: error.message, variant: 'destructive' });
        return;
      }
      const newIsPremium = data?.is_premium ?? (rpcName === 'log_premium_grant');
      const newUntil = data?.premium_until ?? null;
      const desc = newIsPremium
        ? (newUntil ? `Premium until ${new Date(newUntil).toLocaleString()}` : 'Premium (forever)')
        : 'Premium revoked';
      toast({ title: 'Premium updated', description: desc });
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, is_premium: newIsPremium, premium_until: newUntil } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => ({ ...prev, is_premium: newIsPremium, premium_until: newUntil }));
      }
      setPremiumDurationKey(''); setCustomDate(''); setGrantReason('');
    } finally {
      setApplyingGrant(false);
    }
  };

  const deleteUser = async (user) => {
    if (currentAdminRole !== 'super_admin') {
      toast({ title: "Permission Denied", description: "Only super admins can delete users.", variant: "destructive" });
      return;
    }
    const r = (user.role || '').toLowerCase();
    if (r === 'admin' || r === 'super_admin') {
      toast({ title: "Not allowed", description: "Admin / super admin accounts cannot be deleted here.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Permanently delete ${user.full_name || user.email}? This removes their account, profile, and login and cannot be undone.`)) return;
    setDeletingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" });
        return;
      }
      const { data, error } = await supabase.functions.invoke('admin-delete-user', { body: { user_id: user.id } });
      if (error || data?.error) {
        toast({ title: "Delete failed", description: (error?.message || data?.error || "See console for details."), variant: "destructive" });
        return;
      }
      toast({ title: "User deleted", description: `${user.full_name || user.email} was permanently removed.` });
      setAllUsers(prev => prev.filter(u => u.id !== user.id));
      setSelectedUser(null);
    } catch (e) {
      console.error('deleteUser error:', e);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeletingUser(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-bold text-white">User Management</h2>
        <div className="flex gap-2 w-full md:w-auto">
          <select 
            className="h-10 rounded-md border border-slate-700 bg-slate-900 text-white px-3 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="no_status">No Status</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Search users..." 
              className="pl-10 bg-slate-900 border-slate-700 text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Attributes</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4 text-center">Reports</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center">Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center">No users found.</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{user.full_name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const eff = getEffectiveStatus(user);
                        const expired = isSuspensionExpired(user);
                        return (
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={`
                              ${eff === 'approved' ? 'text-green-400 border-green-900 bg-green-900/10' :
                                eff === 'banned' ? 'text-red-400 border-red-900 bg-red-900/10' :
                                eff === 'suspended' ? 'text-orange-400 border-orange-900 bg-orange-900/10' :
                                eff === 'pending_review' ? 'text-yellow-400 border-yellow-900 bg-yellow-900/10' :
                                'text-gray-400 border-gray-900 bg-gray-900/10'} capitalize`}>
                              {eff ? eff.replace('_', ' ') : 'No Status'}
                            </Badge>
                            {expired && (
                              <span className="text-[10px] text-slate-500 italic" title="Suspension auto-clears on the user's next login">
                                (expired - auto-clears on next login)
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 flex-wrap">
                        {/* Role badges first - so Sandra can spot the staff
                            accounts in a long user list at a glance. */}
                        {user.role?.toLowerCase() === 'super_admin' && (
                          <Badge className="bg-purple-600 text-white text-[10px]">SUPER ADMIN</Badge>
                        )}
                        {user.role?.toLowerCase() === 'admin' && (
                          <Badge className="bg-fuchsia-600 text-white text-[10px]">ADMIN</Badge>
                        )}
                        {user.is_premium && <Badge className="bg-yellow-600 text-white text-[10px]">PREMIUM</Badge>}
                        {user.is_verified && <Badge className="bg-blue-600 text-white text-[10px]">VERIFIED</Badge>}
                      </div>
                    </td>
                    <td className="px-6 py-4">{user.location_city}, {user.location_country}</td>
                    {/* Sprint C B5 — surfaces serial offenders inline in the user list.
                        Yellow=1-2 / orange=3-4 / red=5+. Click the badge to open the user
                        modal (handled by the existing eye button — no separate action). */}
                    <td className="px-6 py-4 text-center">
                      {user.unresolved_report_count > 0 ? (
                        <Badge className={`${
                          user.unresolved_report_count >= 5 ? 'bg-red-600' :
                          user.unresolved_report_count >= 3 ? 'bg-orange-600' :
                          'bg-yellow-600'
                        } text-white`}>
                          {user.unresolved_report_count}
                        </Badge>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedUser(user)}>
                              <Eye className="w-4 h-4 text-slate-400" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="text-2xl">{selectedUser?.full_name}</DialogTitle>
                            </DialogHeader>
                            {selectedUser && (
                              <div className="grid md:grid-cols-2 gap-8 py-4">
                                <div className="space-y-6">
                                   <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-lg">
                                      <div>
                                        <Label className="text-slate-500 text-xs">Status</Label>
                                        <select 
                                          className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                          value={selectedUser.status || ''}
                                          onChange={(e) => updateUser(selectedUser.id, { status: e.target.value || null })}
                                          disabled={currentAdminRole !== 'super_admin' && (selectedUser.role?.toLowerCase() === 'admin' || selectedUser.role?.toLowerCase() === 'super_admin')}
                                        >
                                          <option value="">No Status</option>
                                          <option value="pending_review">Pending Review</option>
                                          <option value="approved">Approved</option>
                                          <option value="suspended">Suspended</option>
                                          <option value="banned">Banned</option>
                                        </select>
                                        {currentAdminRole !== 'super_admin' && (selectedUser.role?.toLowerCase() === 'admin' || selectedUser.role?.toLowerCase() === 'super_admin') && (
                                          <p className="text-xs text-yellow-400 mt-1">Only super admins can change admin status</p>
                                        )}
                                      </div>
                                      <div>
                                        <Label className="text-slate-500 text-xs">Role</Label>
                                        <select 
                                          className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                          value={selectedUser.role || 'customer'}
                                          onChange={(e) => updateUser(selectedUser.id, { role: e.target.value })}
                                          disabled={currentAdminRole !== 'super_admin'}
                                        >
                                          <option value="customer">Customer</option>
                                          <option value="admin">Admin</option>
                                          <option value="super_admin">Super Admin</option>
                                        </select>
                                        {currentAdminRole !== 'super_admin' && (
                                          <p className="text-xs text-yellow-400 mt-1">Only super admins can change user roles</p>
                                        )}
                                      </div>
                                      <div className="flex items-center justify-between pt-4">
                                          <Label>Verified</Label>
                                          <Switch 
                                            checked={selectedUser.is_verified} 
                                            onCheckedChange={(c) => {
                                              if (c) {
                                                updateUser(selectedUser.id, { is_verified: true });
                                              } else {
                                                updateUser(selectedUser.id, {
                                                  is_verified: false,
                                                  ...(selectedUser.identity_verification_status === 'verified'
                                                    ? { identity_verification_status: null }
                                                    : {}),
                                                });
                                              }
                                            }} 
                                          />
                                      </div>
                                      {/* Time-bounded premium grants — see migration
                                          20260607020000_premium_grants_time_bounded.sql.
                                          The pg_cron 'premium-expiry-sweep' job flips
                                          is_premium=false when premium_until passes. */}
                                      <div className="pt-4 space-y-3 border-t border-slate-700">
                                          <div className="flex items-center justify-between">
                                              <Label>Premium Status</Label>
                                              {(() => {
                                                if (!selectedUser?.is_premium) return <Badge variant="outline" className="text-slate-400 border-slate-700">Not Premium</Badge>;
                                                if (!selectedUser.premium_until) return <Badge className="bg-yellow-600 text-white">Premium &middot; forever</Badge>;
                                                const expiry = new Date(selectedUser.premium_until);
                                                const ms = expiry - new Date();
                                                if (ms <= 0) return <Badge variant="destructive">Premium &middot; expiring shortly</Badge>;
                                                const days = Math.ceil(ms / 86400000);
                                                return <Badge className="bg-yellow-600 text-white">Premium &middot; {days}d left &middot; until {expiry.toLocaleDateString()}</Badge>;
                                              })()}
                                          </div>
                                          <div className="space-y-2">
                                              <Label className="text-xs text-slate-400">Grant or Revoke</Label>
                                              <select
                                                  value={premiumDurationKey}
                                                  onChange={(e) => setPremiumDurationKey(e.target.value)}
                                                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
                                              >
                                                  <option value="">&mdash; Select action &mdash;</option>
                                                  <option value="off">Revoke (turn Premium off)</option>
                                                  <option value="7d">Grant 7 days</option>
                                                  <option value="30d">Grant 30 days</option>
                                                  <option value="90d">Grant 90 days</option>
                                                  <option value="365d">Grant 1 year</option>
                                                  <option value="forever">Grant forever (no expiry)</option>
                                                  <option value="custom">Grant until custom date&hellip;</option>
                                              </select>
                                          </div>
                                          {premiumDurationKey === 'custom' && (
                                              <div className="space-y-2">
                                                  <Label className="text-xs text-slate-400">Expires at end of day on</Label>
                                                  <Input
                                                      type="date"
                                                      value={customDate}
                                                      onChange={(e) => setCustomDate(e.target.value)}
                                                      min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                                                      className="bg-slate-900 border-slate-700 text-sm"
                                                  />
                                              </div>
                                          )}
                                          {premiumDurationKey && (
                                              <>
                                                  <div className="space-y-2">
                                                      <Label className="text-xs text-slate-400">Reason (optional, logged to audit)</Label>
                                                      <Input
                                                          value={grantReason}
                                                          onChange={(e) => setGrantReason(e.target.value)}
                                                          placeholder="e.g. founding member comp, support escalation"
                                                          className="bg-slate-900 border-slate-700 text-sm"
                                                          maxLength={200}
                                                      />
                                                  </div>
                                                  <Button
                                                      onClick={() => applyPremiumGrant(selectedUser.id)}
                                                      disabled={applyingGrant || (premiumDurationKey === 'custom' && !customDate)}
                                                      className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                                                  >
                                                      {applyingGrant ? 'Applying…' : (premiumDurationKey === 'off' ? 'Revoke Premium' : 'Apply Premium Grant')}
                                                  </Button>
                                              </>
                                          )}
                                      </div>
                                   </div>
                                   
                                   {/* Identity Verification Section */}
                                   {selectedUser.selfie_url && (
                                     <div className="space-y-2 border border-slate-700 rounded-lg p-4 bg-slate-950">
                                       <h4 className="font-semibold text-yellow-400 flex items-center gap-2">
                                         <ShieldAlert className="w-4 h-4" />
                                         Identity Verification
                                       </h4>
                                       <div className="flex gap-4">
                                         <div className="flex-1">
                                           <Label className="text-slate-500 text-xs mb-2 block">Selfie Submission</Label>
                                           <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-700">
                                             <img loading="lazy" decoding="async" src={selectedUser.selfie_url} alt="Selfie" className="w-full h-full object-cover" />
                                           </div>
                                         </div>
                                         <div className="flex-1">
                                           <Label className="text-slate-500 text-xs mb-2 block">Profile Photos (for comparison)</Label>
                                           <div className="grid grid-cols-2 gap-2">
                                             {selectedUser.photos?.slice(0, 4).map((photo, idx) => (
                                               <div key={idx} className="relative w-full aspect-square rounded overflow-hidden border border-slate-700">
                                                 <img loading="lazy" decoding="async" src={photo} alt={`Profile ${idx + 1}`} className="w-full h-full object-cover" />
                                               </div>
                                             ))}
                                           </div>
                                         </div>
                                       </div>
                                       <div className="mt-3">
                                         <Label className="text-slate-500 text-xs mb-2 block">Verification Status</Label>
                                         <select 
                                           className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm"
                                           value={selectedUser.identity_verification_status || ''}
                                           onChange={(e) => {
                                             const raw = e.target.value;
                                             const newStatus = raw === '' ? null : raw;
                                             updateUser(selectedUser.id, {
                                               identity_verification_status: newStatus,
                                               is_verified: newStatus === 'verified',
                                             });
                                           }}
                                         >
                                           <option value="">Not Submitted</option>
                                           <option value="pending">Pending Review</option>
                                           <option value="verified">Verified</option>
                                           <option value="rejected">Rejected</option>
                                         </select>
                                       </div>
                                       <div className="flex gap-2 mt-3">
                                         <Button
                                           variant="outline"
                                           size="sm"
                                           onClick={() => {
                                             updateUser(selectedUser.id, { identity_verification_status: 'verified', is_verified: true });
                                             toast({ title: "Verified", description: "Identity verification approved." });
                                           }}
                                           className="flex-1 border-green-600 text-green-400 hover:bg-green-950"
                                         >
                                           <CheckCircle className="w-4 h-4 mr-2" /> Approve
                                         </Button>
                                         <Button
                                           variant="outline"
                                           size="sm"
                                           onClick={() => {
                                             updateUser(selectedUser.id, { identity_verification_status: 'rejected', is_verified: false });
                                             toast({ title: "Rejected", description: "Identity verification rejected." });
                                           }}
                                           className="flex-1 border-red-600 text-red-400 hover:bg-red-950"
                                         >
                                           <XCircle className="w-4 h-4 mr-2" /> Reject
                                         </Button>
                                       </div>
                                     </div>
                                   )}

                                   <div className="space-y-2">
                                     <h4 className="font-semibold text-purple-400">Profile Details</h4>
                                     <div className="text-sm grid grid-cols-2 gap-2">
                                        <p><span className="text-slate-300 font-medium">Culture:</span> <span className="text-slate-100">{selectedUser.cultures?.join(', ')}</span></p>
                                        <p><span className="text-slate-300 font-medium">Faith:</span> <span className="text-slate-100">{selectedUser.religious_affiliation} ({selectedUser.faith_lifestyle})</span></p>
                                        <p><span className="text-slate-300 font-medium">Languages:</span> <span className="text-slate-100">{selectedUser.languages?.join(', ')}</span></p>
                                        <p><span className="text-slate-300 font-medium">Intent:</span> <span className="text-slate-100">{selectedUser.relationship_goal}</span></p>
                                     </div>
                                     <div className="bg-slate-950 p-3 rounded text-sm mt-2 text-slate-300">
                                       <span className="text-slate-400 block text-xs mb-1 font-semibold uppercase tracking-wide">BIO</span>
                                       {selectedUser.bio || "No bio."}
                                     </div>
                                   </div>
                                   
                                   <div className="space-y-2">
                                     <Label className="text-slate-400">Admin Notes</Label>
                                     <textarea 
                                        className="w-full h-24 bg-slate-950 border border-slate-800 rounded p-2 text-sm"
                                        defaultValue={selectedUser.notes_admin}
                                        onBlur={(e) => updateUser(selectedUser.id, { notes_admin: e.target.value })}
                                        placeholder="Internal notes only..."
                                     />
                                   </div>
                                </div>
                                
                                <div className="space-y-6">
                                   <h4 className="font-semibold text-purple-400 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Photos</h4>
                                   <div className="grid grid-cols-2 gap-4">
                                      {selectedUser.photos && selectedUser.photos.map((photo, idx) => (
                                        <div key={idx} className="relative group aspect-square bg-black rounded overflow-hidden">
                                           <img loading="lazy" decoding="async" src={photo} alt="User" className="w-full h-full object-cover" />
                                           <Button 
                                            variant="destructive" 
                                            size="sm" 
                                            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => {
                                                const newPhotos = selectedUser.photos.filter((_, i) => i !== idx);
                                                updateUser(selectedUser.id, { photos: newPhotos });
                                            }}
                                           >
                                             Remove
                                           </Button>
                                        </div>
                                      ))}
                                      {(!selectedUser.photos || selectedUser.photos.length === 0) && <p className="text-slate-500 italic">No photos.</p>}
                                   </div>
                                </div>
                                {currentAdminRole === 'super_admin' &&
                                 (selectedUser.role || '').toLowerCase() !== 'admin' &&
                                 (selectedUser.role || '').toLowerCase() !== 'super_admin' && (
                                  <div className="md:col-span-2 mt-2 border-t border-red-900/50 pt-4">
                                    <h4 className="font-semibold text-red-400 flex items-center gap-2 mb-1"><Trash2 className="w-4 h-4"/> Danger Zone</h4>
                                    <p className="text-xs text-slate-500 mb-3">Permanently deletes this user's account, profile, and login. This cannot be undone and is recorded in the admin audit log.</p>
                                    <Button variant="destructive" disabled={deletingUser} onClick={() => deleteUser(selectedUser)}>
                                      <Trash2 className="w-4 h-4 mr-2" /> {deletingUser ? 'Deleting...' : 'Delete User Permanently'}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                       </Dialog>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalCount > 0 && (() => {
          const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
          const from = (page - 1) * PAGE_SIZE + 1;
          const to = Math.min(page * PAGE_SIZE, totalCount);
          const getPageNumbers = () => {
            if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
            if (page <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
            if (page >= totalPages - 3) {
              const start = Math.max(1, totalPages - 4);
              if (start <= 1) return Array.from({ length: totalPages }, (_, i) => i + 1);
              return [1, '...', ...Array.from({ length: totalPages - start + 1 }, (_, i) => start + i)];
            }
            return [1, '...', page - 1, page, page + 1, '...', totalPages];
          };
          const pages = getPageNumbers();
          return (
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-t border-slate-800 bg-slate-950/50">
              <p className="text-sm text-slate-400">
                Showing <span className="font-medium text-slate-300">{from}</span>&ndash;<span className="font-medium text-slate-300">{to}</span> of <span className="font-medium text-slate-300">{totalCount}</span> users
              </p>
              <nav className="flex items-center gap-1" aria-label="Pagination">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 min-w-[2rem] border-slate-500 bg-slate-800/80 text-slate-100 hover:bg-slate-600 hover:border-slate-400 hover:text-white disabled:opacity-40 disabled:bg-slate-800/50 disabled:border-slate-600"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {pages.map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-slate-500">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant="outline"
                      size="sm"
                      className={`h-9 min-w-[2.25rem] rounded-md ${
                        p === page
                          ? 'border-amber-500/60 bg-amber-500/20 text-amber-400 font-semibold'
                          : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                      }`}
                      disabled={loading}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 min-w-[2rem] border-slate-500 bg-slate-800/80 text-slate-100 hover:bg-slate-600 hover:border-slate-400 hover:text-white disabled:opacity-40 disabled:bg-slate-800/50 disabled:border-slate-600"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </nav>
            </div>
          );
        })()}
      </Card>
    </div>
  );
};

export default UserManagement;
