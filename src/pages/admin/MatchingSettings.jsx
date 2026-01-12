import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Save, RefreshCcw } from 'lucide-react';

const MatchingSettings = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkAdminRole();
    fetchConfig();
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

  const fetchConfig = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('matching_config').select('*').limit(1).single();
    if (data) setConfig(data);
    setLoading(false);
  };

  const handleWeightChange = (key, value) => {
    setConfig(prev => ({
        ...prev,
        weights: { ...prev.weights, [key]: value[0] }
    }));
  };
  
  const handleThresholdChange = (key, value) => {
    setConfig(prev => ({
        ...prev,
        thresholds: { ...prev.thresholds, [key]: parseInt(value) || 0 }
    }));
  };

  const saveSettings = async () => {
    const totalWeight = Object.values(config.weights).reduce((a, b) => a + b, 0);
    if (totalWeight !== 100) {
        toast({ title: "Validation Error", description: `Weights must sum to 100. Current: ${totalWeight}`, variant: "destructive" });
        return;
    }

    const { error } = await supabase.from('matching_config').update({
        weights: config.weights,
        thresholds: config.thresholds,
        updated_at: new Date()
    }).eq('id', config.id);

    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Settings Saved", description: "Matching algorithm updated." });
  };

  if (loading) return <div>Loading...</div>;
  if (!config) return <div>Error loading config</div>;

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Access Restricted</h3>
            <p className="text-slate-400">Only Super Admins can modify Matching Settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalWeight = Object.values(config.weights).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">Matching Algorithm Settings</h2>
        <Button onClick={saveSettings} className="bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4 mr-2"/> Save Changes
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
            <CardHeader>
                <CardTitle className="flex justify-between">
                    <span>Algorithm Weights</span>
                    <span className={totalWeight === 100 ? "text-green-400" : "text-red-400"}>
                        Sum: {totalWeight}%
                    </span>
                </CardTitle>
                <CardDescription>Determines the importance of each factor in the compatibility score.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {Object.entries(config.weights).map(([key, val]) => (
                    <div key={key} className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
                            <span className="font-mono">{val}%</span>
                        </div>
                        <Slider 
                            value={[val]} 
                            max={100} step={1} 
                            onValueChange={(v) => handleWeightChange(key, v)}
                            className="py-1"
                        />
                    </div>
                ))}
            </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-200">
            <CardHeader><CardTitle>Hard Thresholds</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label>Max Days Last Active</Label>
                    <Input 
                        type="number" 
                        value={config.thresholds.max_days_last_active} 
                        onChange={e => handleThresholdChange('max_days_last_active', e.target.value)}
                        className="bg-slate-950 border-slate-700"
                    />
                    <p className="text-xs text-slate-500">Users inactive longer than this won't appear in discovery.</p>
                </div>
                <div className="space-y-2">
                    <Label>Max Age Gap (Years)</Label>
                    <Input 
                        type="number" 
                        value={config.thresholds.max_age_gap_years} 
                        onChange={e => handleThresholdChange('max_age_gap_years', e.target.value)}
                        className="bg-slate-950 border-slate-700"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Min. Bio Characters</Label>
                    <Input 
                        type="number" 
                        value={config.thresholds.min_about_me_chars} 
                        onChange={e => handleThresholdChange('min_about_me_chars', e.target.value)}
                        className="bg-slate-950 border-slate-700"
                    />
                </div>
                 <div className="space-y-2">
                    <Label>Min. Photos</Label>
                    <Input 
                        type="number" 
                        value={config.thresholds.min_photos_for_recommendations} 
                        onChange={e => handleThresholdChange('min_photos_for_recommendations', e.target.value)}
                        className="bg-slate-950 border-slate-700"
                    />
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MatchingSettings;