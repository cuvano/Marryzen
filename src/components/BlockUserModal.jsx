import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/**
 * Modal that confirms blocking another member.
 * Blocking inserts a row into user_blocks (blocker_id, blocked_user_id) which is
 * filtered out across discovery, matches, chat. Cannot be reversed from the UI yet
 * (admin tooling will manage unblocks for now).
 *
 * Props: { isOpen, onClose, blockedUserName, blockedUserId, onBlocked }
 */
const BlockUserModal = ({ isOpen, onClose, blockedUserName, blockedUserId, onBlocked }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleBlock = async () => {
    if (!user?.id || !blockedUserId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('user_blocks')
        .insert({ blocker_id: user.id, blocked_user_id: blockedUserId });

      if (error && !/duplicate key|unique constraint/i.test(error.message || '')) {
        throw error;
      }

      toast({
        title: 'Blocked',
        description: `${blockedUserName || 'This member'} can no longer view your profile or contact you.`,
      });

      if (typeof onBlocked === 'function') {
        try { onBlocked(); } catch (_) {}
      }
      onClose();
    } catch (err) {
      console.error('Block error:', err);
      toast({
        title: 'Something went wrong',
        description: 'Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#1F1F1F]">Block {blockedUserName || 'this member'}?</h2>
                <p className="text-sm text-[#706B67] mt-1">
                  They won't be able to view your profile, like you, or send you messages.
                </p>
              </div>
            </div>

            <div className="bg-[#FFF7E6] border border-[#E6B450] rounded-xl p-3 mb-5 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#8a6c1e] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[#5e4e1f] leading-relaxed">
                If you're being harassed or feel unsafe, also <strong>report this member</strong> so our team can take action.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBlock}
                disabled={submitting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {submitting ? 'Blocking…' : 'Block'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BlockUserModal;
