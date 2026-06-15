import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';

/**
 * Two-step confirm modal for irreversible account deletion.
 * Calls the account-delete Edge Function which soft-deletes the profile,
 * clears PII, removes photos, and deletes the auth user.
 */
const DeleteAccountModal = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const ready = confirmation.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!ready) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://adufstvmmzpqdcmpinqd.supabase.co'}/functions/v1/account-delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || body.ok === false) {
        throw new Error(body?.errors?.[0]?.error || 'Delete failed');
      }
      toast({ title: 'Account deleted', description: 'Your data has been removed.' });
      await supabase.auth.signOut();
      navigate('/', { replace: true });
    } catch (err) {
      toast({ title: 'Could not delete', description: String(err.message || err), variant: 'destructive' });
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#1F1F1F]">Delete your account</h2>
                <p className="text-sm text-brand-muted mt-1">
                  This removes your profile and photos and signs you out. Your conversation history will remain visible to the other party. This cannot be undone.
                </p>
              </div>
            </div>
            <label className="block text-sm font-semibold text-[#1F1F1F] mb-1">
              Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 border border-[#E6DCD2] rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 mb-5"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={submitting} className="flex-1">Cancel</Button>
              <Button onClick={handleDelete} disabled={!ready || submitting} className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
                {submitting ? 'Deleting…' : 'Delete forever'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DeleteAccountModal;
