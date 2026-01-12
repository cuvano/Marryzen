import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Save } from 'lucide-react';

const PlatformSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkAdminRole();
    const fetchSettings = async () => {
      const { data } = await supabase.from('platform_settings').select('*').limit(1).single();
      if (data) setSettings(data);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const checkAdminRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      setIsSuperAdmin(profile?.role?.toLowerCase() === 'super_admin');
    }
  };

  const handleSave = async () => {
    const { error } = await supabase.from('platform_settings').update({
        ...settings,
        updated_at: new Date()
    }).eq('id', settings.id);

    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Settings Saved", description: "Platform configuration updated." });
  };

  if (loading || !settings) return <div>Loading...</div>;

  if (!isSuperAdmin) {
    return (
      <div className="max-w-2xl space-y-6">
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Access Restricted</h3>
            <p className="text-slate-400">Only Super Admins can modify Platform Settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">Platform Settings</h2>
        <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4 mr-2"/> Save Changes
        </Button>
      </div>

      <Card className="bg-slate-900 border-slate-800 text-slate-200">
        <CardHeader><CardTitle>General Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Max Photos (Free User)</Label>
                    <Input 
                        type="number" 
                        value={settings.max_free_photos} 
                        onChange={e => setSettings({...settings, max_free_photos: parseInt(e.target.value)})}
                        className="bg-slate-950 border-slate-700"
                    />
                </div>
                 <div className="space-y-2">
                    <Label>Max Photos (Premium)</Label>
                    <Input 
                        type="number" 
                        value={settings.max_premium_photos} 
                        onChange={e => setSettings({...settings, max_premium_photos: parseInt(e.target.value)})}
                        className="bg-slate-950 border-slate-700"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Minimum User Age</Label>
                <Input 
                    type="number" 
                    value={settings.min_age} 
                    onChange={e => setSettings({...settings, min_age: parseInt(e.target.value)})}
                    className="bg-slate-950 border-slate-700"
                />
            </div>

             <div className="space-y-2">
                <Label>Support Email Address</Label>
                <Input 
                    type="email" 
                    value={settings.support_email} 
                    onChange={e => setSettings({...settings, support_email: e.target.value})}
                    className="bg-slate-950 border-slate-700"
                />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="space-y-0.5">
                    <Label className="text-base">Legal Links on Landing Page</Label>
                    <p className="text-xs text-slate-500">Show Terms/Privacy in footer of public pages.</p>
                </div>
                <Switch 
                    checked={settings.legal_links_visible_on_landing}
                    onCheckedChange={c => setSettings({...settings, legal_links_visible_on_landing: c})}
                />
            </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlatformSettings;