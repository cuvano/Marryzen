import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Save, Info } from 'lucide-react';

// ----------------------------------------------------------------------------
// 8 algorithm dimensions — these MUST match the keys read by calculateScore()
// in src/lib/matchmaking.js. If you rename a key here, rename it there + run
// a migration to update the matching_config.weights JSON.
// ----------------------------------------------------------------------------
const WEIGHT_DIMENSIONS = [
  { key: 'age',          label: 'Age proximity',         hint: 'Closer ages score higher. 0 diff = full points, drops off after 5+ years.' },
  { key: 'distance',     label: 'Location',              hint: 'Same city > same country > nothing. Coords-based when available.' },
  { key: 'intent',       label: 'Marriage intent',       hint: 'Same relationship goal scores highest. Both "serious" still scores well.' },
  { key: 'faith',        label: 'Faith alignment',       hint: 'Same religion = full. Same family of faiths = partial. Shared lifestyle adds bonus.' },
  { key: 'values',       label: 'Core values',           hint: 'Overlap of selected core-values list (Family, Career, Faith, etc.).' },
  { key: 'cultures',     label: 'Cultural heritage',     hint: 'Shared cultures from the multi-select (up to 3 per profile).' },
  { key: 'lifestyle',    label: 'Lifestyle',             hint: 'Smoking, drinking, education, marital status, kids.' },
  { key: 'completeness', label: 'Profile completeness',  hint: 'Candidates with more filled-out profiles get a small bonus.' },
];

const THRESHOLD_FIELDS = [
  { key: 'max_days_last_active',           label: 'Max Days Last Active', hint: "Users inactive longer than this won't appear in Discovery." },
  { key: 'max_age_gap_years',              label: 'Max Age Gap (Years)',  hint: 'Maximum age difference between viewer and candidate.' },
  { key: 'min_about_me_chars',             label: 'Min. Bio Characters',  hint: 'Candidates with shorter bios are hidden.' },
  { key: 'min_photos_for_recommendations', label: 'Min. Photos',          hint: 'Candidates with fewer photos are hidden.' },
];

const MatchingSettings = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    const { data, error } = await supabase.from('matching_config').select('*').limit(1).maybeSingle();
    if (error && error.code !== 'PGRST116' && error.code !== 'NOT_FOUND') {
      console.error('Matching config error:', error);
      toast({ title: 'Could not load matching config', description: error.message, variant: 'destructive' });
    }
    if (data) {
      // Defensive: ensure all expected weight keys exist (in case DB is
      // missing one — defaults to 0 so slider still renders).
      const safeWeights = { ...Object.fromEntries(WEIGHT_DIMENSIONS.map(d => [d.key, 0])), ...(data.weights || {}) };
      const safeThresholds = { ...Object.fromEntries(THRESHOLD_FIELDS.map(f => [f.key, 0])), ...(data.thresholds || {}) };
      setConfig({ ...data, weights: safeWeights, thresholds: safeThresholds });
    }
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

  const totalWeight = config ? WEIGHT_DIMENSIONS.reduce((sum, d) => sum + (config.weights[d.key] || 0), 0) : 0;

  const saveSettings = async () => {
    if (totalWeight !== 100) {
      toast({ title: 'Validation Error', description: `Weights must sum to 100. Current: ${totalWeight}`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('matching_config').update({
      weights: config.weights,
      thresholds: config.thresholds,
      updated_at: new Date(),
    }).eq('id', config.id);
    setSaving(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Settings Saved', description: 'Matching algorithm updated. Affects Discovery on next page load.' });
    }
  };

  if (loading) return <div className="text-slate-400">Loading...</div>;
  if (!config) return <div className="text-slate-400">No matching config row found in DB. Run the matching_config seed migration.</div>;

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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Matching Algorithm Settings</h2>
          <p className="text-sm text-slate-400 mt-1">Tune how compatibility is scored. Changes apply on the next Discovery page load.</p>
        </div>
        <Button
          onClick={saveSettings}
          disabled={saving || totalWeight !== 100}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* ------------ Algorithm Weights ------------ */}
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Algorithm Weights</span>
              <span className={totalWeight === 100 ? 'text-green-400 text-base' : 'text-red-400 text-base'}>
                Sum: {totalWeight}%
              </span>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Determines how much each factor contributes to the compatibility score. Must sum to exactly 100.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {WEIGHT_DIMENSIONS.map((dim) => {
              const val = config.weights[dim.key] ?? 0;
              return (
                <div key={dim.key} className="space-y-2">
                  <div className="flex justify-between items-baseline text-sm">
                    <Label className="text-slate-200">{dim.label}</Label>
                    <span className="font-mono text-purple-300">{val}%</span>
                  </div>
                  <Slider
                    value={[val]}
                    max={100}
                    step={1}
                    onValueChange={(v) => handleWeightChange(dim.key, v)}
                    className="py-1"
                  />
                  <p className="text-xs text-slate-500 flex items-start gap-1.5">
                    <Info className="w-3 h-3 mt-0.5 shrink-0 text-slate-600" />
                    <span>{dim.hint}</span>
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ------------ Hard Thresholds ------------ */}
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardHeader>
            <CardTitle>Hard Thresholds</CardTitle>
            <CardDescription className="text-slate-400">
              Hide candidates that don't meet these minimums. Set any value to 0 to disable that gate.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            {THRESHOLD_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label className="text-slate-200">{field.label}</Label>
                <Input
                  type="number"
                  min="0"
                  value={config.thresholds[field.key] ?? 0}
                  onChange={(e) => handleThresholdChange(field.key, e.target.value)}
                  className="bg-slate-950 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-500 flex items-start gap-1.5">
                  <Info className="w-3 h-3 mt-0.5 shrink-0 text-slate-600" />
                  <span>{field.hint}</span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ------------ Wiring note ------------ */}
        <Card className="bg-slate-900/50 border-slate-800/50 text-slate-400">
          <CardContent className="p-4 text-xs">
            <p className="font-medium text-slate-300 mb-1">How these are applied</p>
            <p>
              Weights are read by <code className="bg-slate-800 px-1 py-0.5 rounded text-purple-300">calculateScore()</code> in{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-purple-300">src/lib/matchmaking.js</code>. Thresholds are enforced in{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-purple-300">DiscoveryPage.jsx</code> before scoring. Changes take effect the next time a user opens Discovery (no rebuild needed).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MatchingSettings;
