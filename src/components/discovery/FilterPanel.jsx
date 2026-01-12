import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Lock, Crown } from 'lucide-react';

const FilterPanel = ({ filters, setFilters, isPremium, onApply, onClose, resultsCount, onClear, onSave, onPremiumFeatureClick }) => {
  const handleChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearAll = () => {
    const defaultFilters = {
      ageRange: [18, 65],
      distance: 50,
      city: '',
      faith: '',
      smoking: '',
      drinking: '',
      maritalStatus: '',
      hasChildren: '',
      recentActive: false,
      verifiedOnly: false,
      minPhotos: 0,
      income: ''
    };
    setFilters(defaultFilters);
    if (onClear) {
      onClear(defaultFilters);
    }
    // Also trigger apply to refresh results immediately
    if (onApply) {
      onApply();
    }
  };

  const PremiumLock = ({ children, label, feature }) => {
    if (isPremium) return children;
    return (
      <div className="relative group">
        <div className="opacity-40 pointer-events-none filter blur-[1px] select-none">
          {children}
        </div>
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={() => onPremiumFeatureClick && onPremiumFeatureClick(feature || 'advanced_filters')}
        >
            <div className="bg-[#1F1F1F] text-[#E6B450] text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-[#E6B450]/30 font-bold z-10 hover:bg-[#2a2a2a] transition-colors">
                <Lock size={10} /> Premium: {label}
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-[#E6DCD2]">
      <div className="p-5 border-b border-[#E6DCD2] flex justify-between items-center bg-[#FAF7F2]">
        <h2 className="font-bold text-lg text-[#1F1F1F]">Filters</h2>
        <Button variant="ghost" size="sm" onClick={onClose} className="md:hidden">Close</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <Accordion type="multiple" defaultValue={["basic", "lifestyle"]} className="space-y-4">
          
          {/* Basic Section */}
          <AccordionItem value="basic" className="border-b-0">
            <AccordionTrigger className="hover:no-underline font-bold text-[#1F1F1F]">Basic Preferences</AccordionTrigger>
            <AccordionContent className="space-y-6 pt-2">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Age Range</Label>
                  <span className="text-xs font-medium text-[#706B67]">{filters.ageRange[0]} - {filters.ageRange[1]}</span>
                </div>
                <Slider 
                  value={filters.ageRange} 
                  min={18} max={70} step={1} 
                  minStepsBetweenThumbs={1}
                  onValueChange={(v) => handleChange('ageRange', v)} 
                />
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <input 
                  className="w-full border border-[#E6DCD2] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#C85A72]"
                  value={filters.city}
                  onChange={e => handleChange('city', e.target.value)}
                  placeholder="City (e.g. London)"
                />
              </div>

              <PremiumLock label="Distance" feature="advanced_filters">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                        <Label>Distance (km)</Label>
                        <span className="text-xs font-medium text-[#706B67]">{filters.distance} km</span>
                    </div>
                    <Slider 
                        value={[filters.distance]} 
                        min={5} max={500} step={5} 
                        onValueChange={(v) => handleChange('distance', v[0])} 
                    />
                  </div>
              </PremiumLock>
            </AccordionContent>
          </AccordionItem>

          {/* Values Section - Free Filters */}
          <AccordionItem value="values" className="border-b-0">
             <AccordionTrigger className="hover:no-underline font-bold text-[#1F1F1F]">Values & Beliefs</AccordionTrigger>
             <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-2">
                    <Label>Faith / Religion</Label>
                    <select 
                        className="w-full border border-[#E6DCD2] rounded-md px-3 py-2 text-sm bg-white"
                        value={filters.faith}
                        onChange={(e) => handleChange('faith', e.target.value)}
                    >
                        <option value="">Any</option>
                        <option value="Muslim">Muslim</option>
                        <option value="Christian">Christian</option>
                        <option value="Jewish">Jewish</option>
                        <option value="Hindu">Hindu</option>
                        <option value="Sikh">Sikh</option>
                        <option value="Buddhist">Buddhist</option>
                        <option value="Spiritual">Spiritual</option>
                        <option value="Atheist">Atheist</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
             </AccordionContent>
          </AccordionItem>

          {/* Lifestyle Section */}
          <AccordionItem value="lifestyle" className="border-b-0">
            <AccordionTrigger className="hover:no-underline font-bold text-[#1F1F1F]">Lifestyle</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label>Smoking</Label>
                        <select className="w-full border border-[#E6DCD2] rounded-md px-2 py-2 text-sm bg-white" value={filters.smoking} onChange={(e) => handleChange('smoking', e.target.value)}>
                            <option value="">Any</option>
                            <option value="No">No</option>
                            <option value="Socially">Socially</option>
                            <option value="Regularly">Regularly</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <Label>Drinking</Label>
                        <select className="w-full border border-[#E6DCD2] rounded-md px-2 py-2 text-sm bg-white" value={filters.drinking} onChange={(e) => handleChange('drinking', e.target.value)}>
                            <option value="">Any</option>
                            <option value="No">No</option>
                            <option value="Socially">Socially</option>
                            <option value="Regularly">Regularly</option>
                        </select>
                     </div>
                </div>

                <div className="space-y-2">
                    <Label>Marital History</Label>
                    <select className="w-full border border-[#E6DCD2] rounded-md px-3 py-2 text-sm bg-white" value={filters.maritalStatus} onChange={(e) => handleChange('maritalStatus', e.target.value)}>
                        <option value="">Any</option>
                        <option value="Never Married">Never Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Annulled">Annulled</option>
                    </select>
                </div>
                
                 <div className="space-y-2">
                    <Label>Children</Label>
                    <select className="w-full border border-[#E6DCD2] rounded-md px-3 py-2 text-sm bg-white" value={filters.hasChildren} onChange={(e) => handleChange('hasChildren', e.target.value)}>
                        <option value="">Any</option>
                        <option value="false">No Children</option>
                        <option value="true">Has Children</option>
                    </select>
                </div>
            </AccordionContent>
          </AccordionItem>

          {/* Premium Filters Section */}
          <AccordionItem value="premium" className="border-b-0">
             <AccordionTrigger className="hover:no-underline font-bold text-[#1F1F1F] flex items-center gap-2">
                Premium Filters <Crown className="w-3 h-3 text-[#E6B450]" />
             </AccordionTrigger>
             <AccordionContent className="space-y-4 pt-2">
                <PremiumLock label="Activity" feature="advanced_filters">
                    <div className="flex items-center justify-between space-x-2">
                        <Label>Recently Active (24h)</Label>
                        <Switch checked={filters.recentActive} onCheckedChange={(v) => handleChange('recentActive', v)} />
                    </div>
                </PremiumLock>
                
                <PremiumLock label="Verification" feature="advanced_filters">
                    <div className="flex items-center justify-between space-x-2">
                        <Label>Verified Profiles Only</Label>
                        <Switch checked={filters.verifiedOnly} onCheckedChange={(v) => handleChange('verifiedOnly', v)} />
                    </div>
                </PremiumLock>

                <PremiumLock label="Photos" feature="advanced_filters">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label>Min Photo Count</Label>
                            <span className="text-xs text-[#706B67]">{filters.minPhotos}</span>
                        </div>
                        <Slider value={[filters.minPhotos]} min={0} max={10} step={1} onValueChange={(v) => handleChange('minPhotos', v[0])} />
                    </div>
                </PremiumLock>

                 <PremiumLock label="Income" feature="advanced_filters">
                     <div className="space-y-2">
                        <Label>Income Level</Label>
                        <select className="w-full border border-[#E6DCD2] rounded-md px-3 py-2 text-sm bg-white" value={filters.income} onChange={(e) => handleChange('income', e.target.value)}>
                            <option value="">Any</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Very High">Very High</option>
                        </select>
                     </div>
                 </PremiumLock>
             </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>

      <div className="p-5 border-t border-[#E6DCD2] bg-[#FAF7F2] space-y-3">
         <div className="flex justify-between items-center text-sm">
             <span className="text-[#706B67] font-medium">{resultsCount} {resultsCount === 1 ? 'profile' : 'profiles'} match</span>
             <Button 
               variant="link" 
               className="text-[#C85A72] h-auto p-0 hover:text-[#9F4758] font-medium" 
               onClick={handleClearAll}
             >
               Clear All
             </Button>
         </div>
         <div className="flex gap-2">
           {onSave && (
             <Button 
               variant="outline" 
               onClick={onSave} 
               className="flex-1 border-[#E6B450] text-[#E6B450] hover:bg-[#FFFBEB]"
             >
               Save Search
             </Button>
           )}
           <Button onClick={onApply} className={`${onSave ? 'flex-1' : 'w-full'} bg-[#1F1F1F] text-white hover:bg-[#333333]`}>
             Apply Filters
           </Button>
         </div>
      </div>
    </div>
  );
};

export default FilterPanel;