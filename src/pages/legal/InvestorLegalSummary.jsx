import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building, FileText, Shield, Briefcase, Lock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const InvestorLegalSummary = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Strict Admin Check
  useEffect(() => {
    const role = localStorage.getItem('adminRole');
    if (role !== 'SUPER_ADMIN') {
        toast({ title: "Access Denied", description: "This document is classified for Super Admins only.", variant: "destructive" });
        navigate('/admin/dashboard');
    }
  }, [navigate, toast]);

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 bg-slate-950">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
            <div>
                <Button variant="ghost" onClick={() => navigate(-1)} className="text-white/70 hover:text-white hover:bg-white/10 mb-4 pl-0">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Admin
                </Button>
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <Briefcase className="w-8 h-8 text-yellow-500" /> 
                    Investor Legal Summary (Internal)
                </h1>
                <p className="text-slate-400">Confidential • For Board & Investor Review Only</p>
            </div>
            <div className="bg-red-900/30 border border-red-900 text-red-400 px-4 py-2 rounded flex items-center gap-2 text-sm font-bold">
                <Lock className="w-4 h-4" /> RESTRICTED ACCESS
            </div>
        </div>

        {/* Content Grid */}
        <div className="grid md:grid-cols-2 gap-6">
            
            {/* Company Structure */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Building className="w-5 h-5 text-blue-400" /> 1. Corporate Structure
                </h2>
                <ul className="space-y-3 text-slate-300 text-sm">
                    <li className="flex justify-between border-b border-slate-800 pb-2">
                        <span>Entity Type:</span>
                        <span className="font-medium text-white">C-Corporation (Delaware)</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-800 pb-2">
                        <span>Operating Jurisdiction:</span>
                        <span className="font-medium text-white">Florida, USA</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-800 pb-2">
                        <span>Trade Name:</span>
                        <span className="font-medium text-white">Marryzen</span>
                    </li>
                     <li className="flex justify-between">
                        <span>Fiscal Year:</span>
                        <span className="font-medium text-white">Jan 1 - Dec 31</span>
                    </li>
                </ul>
            </div>

             {/* Business Model Legal */}
             <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-400" /> 2. Business Model Legality
                </h2>
                <p className="text-slate-300 text-sm mb-4">
                    The platform operates on a Freemium Subscription model ("Software as a Service").
                </p>
                 <ul className="list-disc pl-5 space-y-2 text-sm text-slate-300">
                    <li><strong>Revenue Recognition:</strong> Recognized ratably over the subscription term (ASC 606 compliant).</li>
                    <li><strong>Data Monetization:</strong> STRICTLY PROHIBITED. User data is not sold. Revenue is derived solely from user subscriptions.</li>
                    <li><strong>Platform Liability:</strong> Section 230 (CDA) protections applied for UGC; rigorous moderation reduces negligence liability risks.</li>
                </ul>
            </div>

            {/* Risk Mitigation */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-400" /> 3. Risk Mitigation Strategy
                </h2>
                 <ul className="space-y-3 text-slate-300 text-sm">
                    <li className="bg-slate-950 p-3 rounded border border-slate-800">
                        <strong className="block text-white mb-1">Safety & ID Verification</strong>
                        Mitigates risk of fraud/catfishing lawsuits. Third-party ID providers indemnify verification accuracy to limits.
                    </li>
                    <li className="bg-slate-950 p-3 rounded border border-slate-800">
                        <strong className="block text-white mb-1">Arbitration Clause</strong>
                        Terms of Service include a mandatory arbitration clause and class-action waiver to limit litigation exposure.
                    </li>
                     <li className="bg-slate-950 p-3 rounded border border-slate-800">
                        <strong className="block text-white mb-1">GDPR/CCPA Compliance</strong>
                        Full data deletion and export workflows implemented to avoid regulatory fines.
                    </li>
                </ul>
            </div>

            {/* IP & Brand */}
             <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-purple-400" /> 4. IP & Brand Assets
                </h2>
                 <ul className="list-disc pl-5 space-y-2 text-sm text-slate-300">
                    <li><strong>Trademarks:</strong> "Marryzen" (Pending Registration, USPTO).</li>
                    <li><strong>Domains:</strong> marryzen.com (Secured).</li>
                    <li><strong>Proprietary Tech:</strong> "Cultural Compatibility Scoring Algorithm" (Trade Secret).</li>
                    <li><strong>Copyright:</strong> All UI/UX designs and codebase fully owned by the Company.</li>
                </ul>
            </div>

        </div>
      </div>
    </div>
  );
};

export default InvestorLegalSummary;