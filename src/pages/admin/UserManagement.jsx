import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Search, MoreHorizontal, ShieldAlert, Ban, CheckCircle, RefreshCcw, Eye, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const UserManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentAdminRole, setCurrentAdminRole] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    
    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }
    
    if (searchTerm) {
      query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    checkAdminRole();
    const debounce = setTimeout(fetchUsers, 500);
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
    // Check if trying to modify admin/super_admin and current user is not super_admin
    if (currentAdminRole !== 'super_admin') {
      const targetUser = users.find(u => u.id === id);
      const targetRole = updates.role || targetUser?.role?.toLowerCase();
      
      // Prevent regular admins from changing status/role of admins or super_admins
      if (targetRole === 'admin' || targetRole === 'super_admin') {
        if (updates.status || updates.role) {
          toast({ 
            title: "Permission Denied", 
            description: "Regular admins cannot modify the status or role of other admins or super admins.",
            variant: "destructive" 
          });
          return;
        }
      }
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated Successfully", description: "User record modified." });
      setUsers(users.map(u => u.id === id ? { ...u, ...updates } : u));
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
                          'text-yellow-400 border-yellow-900 bg-yellow-900/10'} capitalize`}>
                        {user.status?.replace('_', ' ')}
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
                                          value={selectedUser.status}
                                          onChange={(e) => updateUser(selectedUser.id, { status: e.target.value })}
                                          disabled={currentAdminRole !== 'super_admin' && (selectedUser.role?.toLowerCase() === 'admin' || selectedUser.role?.toLowerCase() === 'super_admin')}
                                        >
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
                                          disabled={currentAdminRole !== 'super_admin' && (selectedUser.role?.toLowerCase() === 'admin' || selectedUser.role?.toLowerCase() === 'super_admin')}
                                        >
                                          <option value="customer">Customer</option>
                                          <option value="admin">Admin</option>
                                          <option value="super_admin">Super Admin</option>
                                        </select>
                                        {currentAdminRole !== 'super_admin' && (selectedUser.role?.toLowerCase() === 'admin' || selectedUser.role?.toLowerCase() === 'super_admin') && (
                                          <p className="text-xs text-yellow-400 mt-1">Only super admins can change admin roles</p>
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
      </Card>
    </div>
  );
};

export default UserManagement;