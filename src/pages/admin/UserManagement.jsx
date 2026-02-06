import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Search, MoreHorizontal, ShieldAlert, Ban, CheckCircle, RefreshCcw, Eye, Image as ImageIcon, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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

  const totalCount = allUsers.length;
  const users = allUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const buildBaseQuery = (cursorId = null) => {
    let q = supabase.from('profiles').select('*');
    if (filterStatus !== 'all') {
      if (filterStatus === 'no_status') q = q.is('status', null);
      else q = q.eq('status', filterStatus);
    }
    if (searchTerm) {
      q = q.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }
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

    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated Successfully", description: "User record modified." });
      setAllUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
      if (selectedUser?.id === id) setSelectedUser({ ...selectedUser, ...updates });
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
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center">Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center">No users found.</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{user.full_name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={`
                        ${user.status === 'approved' ? 'text-green-400 border-green-900 bg-green-900/10' : 
                          user.status === 'banned' ? 'text-red-400 border-red-900 bg-red-900/10' :
                          user.status === 'suspended' ? 'text-orange-400 border-orange-900 bg-orange-900/10' :
                          user.status === 'pending_review' ? 'text-yellow-400 border-yellow-900 bg-yellow-900/10' :
                          'text-gray-400 border-gray-900 bg-gray-900/10'} capitalize`}>
                        {user.status ? user.status.replace('_', ' ') : 'No Status'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {user.is_premium && <Badge className="bg-yellow-600 text-white text-[10px]">PREMIUM</Badge>}
                        {user.is_verified && <Badge className="bg-blue-600 text-white text-[10px]">VERIFIED</Badge>}
                      </div>
                    </td>
                    <td className="px-6 py-4">{user.location_city}, {user.location_country}</td>
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
                                            onCheckedChange={(c) => updateUser(selectedUser.id, { is_verified: c })} 
                                          />
                                      </div>
                                      <div className="flex items-center justify-between pt-4">
                                          <Label>Premium</Label>
                                          <Switch 
                                            checked={selectedUser.is_premium} 
                                            onCheckedChange={(c) => updateUser(selectedUser.id, { is_premium: c })} 
                                          />
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
                                             <img src={selectedUser.selfie_url} alt="Selfie" className="w-full h-full object-cover" />
                                           </div>
                                         </div>
                                         <div className="flex-1">
                                           <Label className="text-slate-500 text-xs mb-2 block">Profile Photos (for comparison)</Label>
                                           <div className="grid grid-cols-2 gap-2">
                                             {selectedUser.photos?.slice(0, 4).map((photo, idx) => (
                                               <div key={idx} className="relative w-full aspect-square rounded overflow-hidden border border-slate-700">
                                                 <img src={photo} alt={`Profile ${idx + 1}`} className="w-full h-full object-cover" />
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
                                             const newStatus = e.target.value || null;
                                             updateUser(selectedUser.id, { identity_verification_status: newStatus });
                                             if (newStatus === 'verified') {
                                               updateUser(selectedUser.id, { is_verified: true });
                                             }
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
                                             updateUser(selectedUser.id, { identity_verification_status: 'rejected' });
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
                                        <p><span className="text-slate-500">Culture:</span> {selectedUser.cultures?.join(', ')}</p>
                                        <p><span className="text-slate-500">Faith:</span> {selectedUser.religious_affiliation} ({selectedUser.faith_lifestyle})</p>
                                        <p><span className="text-slate-500">Languages:</span> {selectedUser.languages?.join(', ')}</p>
                                        <p><span className="text-slate-500">Intent:</span> {selectedUser.relationship_goal}</p>
                                     </div>
                                     <div className="bg-slate-950 p-3 rounded text-sm mt-2 text-slate-300">
                                       <span className="text-slate-500 block text-xs mb-1">BIO</span>
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
                                           <img src={photo} alt="User" className="w-full h-full object-cover" />
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