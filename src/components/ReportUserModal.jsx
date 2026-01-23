import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { X, ShieldAlert, Send, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const ReportUserModal = ({ isOpen, onClose, reportedUserName, reportedUserId }) => {
  const { toast } = useToast();
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportReasons = [
    'Fake Profile',
    'Inappropriate Messages',
    'Harassment or Pressure',
    'Marriage Scammer Behavior',
    'Disrespecting Culture or Religion',
    'Sexual Content',
    'Other',
  ];

  const handleSubmitReport = async () => {
    if (!selectedReason) {
      toast({
        title: "Please select a reason",
        description: "You must choose a reason for your report.",
        variant: "destructive",
      });
      return;
    }

    if (selectedReason === 'Other' && !otherReason.trim()) {
      toast({
        title: "Please provide details",
        description: "Please specify the reason for your report.",
        variant: "destructive",
      });
      return;
    }

    if (!reportedUserId) {
      toast({
        title: "Error",
        description: "Unable to identify the user to report.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to submit a report.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const reasonText = selectedReason === 'Other' ? otherReason.trim() : selectedReason;

      const { error } = await supabase
        .from('user_reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: reportedUserId,
          reason_category: selectedReason,
          reason_details: reasonText,
          status: 'open'
        });

      if (error) {
        console.error('Error submitting report:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to submit report. Please try again.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      setIsSubmitted(true);
      toast({
        title: "Report Submitted",
        description: "Thank you for helping keep our community safe.",
      });
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };
  
  const handleClose = () => {
      setIsSubmitted(false);
      setSelectedReason('');
      setOtherReason('');
      onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="glass-effect-deep rounded-2xl p-6 w-full max-w-md relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={handleClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
              <X />
            </button>
            
            {!isSubmitted ? (
                <>
                    <div className="text-center mb-6">
                        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
                        <h2 className="text-2xl font-bold text-white">Report {reportedUserName}</h2>
                        <p className="text-white/70 mt-1">Help us keep the community safe and serious.</p>
                    </div>

                    <div className="space-y-2 mb-4">
                        {reportReasons.map((reason) => (
                        <div
                            key={reason}
                            className={`p-3 rounded-lg cursor-pointer transition-colors text-white text-sm font-medium ${
                            selectedReason === reason
                                ? 'bg-white text-purple-600 ring-2 ring-white'
                                : 'glass-effect hover:bg-white/20'
                            }`}
                            onClick={() => setSelectedReason(reason)}
                        >
                            {reason}
                        </div>
                        ))}
                    </div>

                    {selectedReason === 'Other' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mb-4"
                        >
                            <Textarea
                                value={otherReason}
                                onChange={(e) => setOtherReason(e.target.value)}
                                placeholder="Please provide more details..."
                                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                            />
                        </motion.div>
                    )}
                    
                    <p className="text-xs text-white/50 text-center mb-4">
                        Marryzen is a private, values-based platform created strictly for serious marriage and long-term commitment. Casual dating, hookups, and inappropriate behavior are not permitted.
                    </p>

                    <Button 
                      onClick={handleSubmitReport} 
                      disabled={isSubmitting}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3"
                    >
                        <Send className="w-4 h-4 mr-2" /> 
                        {isSubmitting ? 'Submitting...' : 'Submit Report'}
                    </Button>
                </>
            ) : (
                <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="text-center py-8">
                     <ShieldCheck className="w-16 h-16 text-green-400 mx-auto mb-4" />
                     <h2 className="text-2xl font-bold text-white">Report Received</h2>
                     <p className="text-white/70 mt-2 mb-6">Thank you. Your report has been received and will be reviewed by our safety team within 24 hours.</p>
                     <Button onClick={handleClose} className="w-full">Close</Button>
                </motion.div>
            )}

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReportUserModal;