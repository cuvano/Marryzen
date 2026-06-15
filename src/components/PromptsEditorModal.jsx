import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  PROMPTS,
  PROMPT_CATEGORIES,
  PROMPT_ROUND_HEADERS,
  PROMPT_MIN_CHARS,
  PROMPT_MAX_CHARS,
  PROMPT_SOFT_TARGET,
  REQUIRED_PROMPT_COUNT,
  getPromptsForRound,
  validateAnswer,
} from '@/lib/profilePrompts';

/**
 * Three-round prompts editor.
 * Member picks one prompt per round and writes a 60-220 char answer.
 * Saves to profiles.prompts as jsonb: [{ prompt, answer }, ...]
 */
const PromptsEditorModal = ({ isOpen, onClose, currentPrompts = [], onSaved }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [round, setRound] = useState(1);
  const [picks, setPicks] = useState({ 1: null, 2: null, 3: null });
  const [answers, setAnswers] = useState({ 1: '', 2: '', 3: '' });
  const [saving, setSaving] = useState(false);

  // Hydrate existing prompts on open
  useEffect(() => {
    if (!isOpen || !Array.isArray(currentPrompts) || currentPrompts.length === 0) return;
    const seedPicks = { 1: null, 2: null, 3: null };
    const seedAnswers = { 1: '', 2: '', 3: '' };
    currentPrompts.slice(0, 3).forEach((p, i) => {
      const idx = i + 1;
      seedPicks[idx] = p.prompt;
      seedAnswers[idx] = p.answer || '';
    });
    setPicks(seedPicks);
    setAnswers(seedAnswers);
  }, [isOpen, currentPrompts]);

  const roundPrompts = getPromptsForRound(round);
  const currentPick = picks[round];
  const currentAnswer = answers[round];
  const validation = validateAnswer(currentAnswer);

  const allComplete = [1, 2, 3].every(r => picks[r] && validateAnswer(answers[r]).ok);

  const handleSave = async () => {
    if (!allComplete || !user?.id) return;
    setSaving(true);
    try {
      const payload = [1, 2, 3].map(r => ({ prompt: picks[r], answer: answers[r].trim() }));
      const { error } = await supabase
        .from('profiles')
        .update({ prompts: payload })
        .eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Saved', description: 'Your prompts are live on your profile.' });
      if (typeof onSaved === 'function') onSaved(payload);
      onClose();
    } catch (err) {
      toast({ title: 'Could not save', description: String(err.message || err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  return (
    <AnimatePresence>
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
          className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-[#1F1F1F] mb-1">Your prompts</h2>
          <p className="text-sm text-brand-muted mb-4">
            Pick three. Skip the small talk. The people you'll want to hear from will recognize themselves in your answers.
          </p>

          {/* Round tabs */}
          <div className="flex gap-2 mb-5 border-b border-[#E6DCD2]">
            {[1, 2, 3].map((r) => (
              <button
                key={r}
                onClick={() => setRound(r)}
                className={`pb-2 px-3 text-sm font-semibold transition-colors ${
                  round === r ? 'text-[#1F1F1F] border-b-2 border-[#E6B450]' : 'text-brand-muted hover:text-[#1F1F1F]'
                }`}
              >
                Round {r}{picks[r] && validateAnswer(answers[r]).ok ? ' ✓' : ''}
              </button>
            ))}
          </div>

          <h3 className="font-semibold text-[#1F1F1F] mb-3">
            {PROMPT_ROUND_HEADERS.find(h => h.round === round)?.title}
          </h3>

          {/* Prompt picker */}
          <div className="grid sm:grid-cols-2 gap-2 mb-5">
            {roundPrompts.map((p) => {
              const selected = currentPick === p.prompt;
              const taken = (picks[1] === p.prompt || picks[2] === p.prompt || picks[3] === p.prompt) && !selected;
              return (
                <button
                  key={p.prompt}
                  type="button"
                  disabled={taken}
                  onClick={() => setPicks({ ...picks, [round]: p.prompt })}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    selected ? 'border-[#E6B450] bg-[#FFFBEB] font-semibold text-[#1F1F1F]'
                            : taken ? 'border-[#E6DCD2] bg-gray-50 text-gray-400 cursor-not-allowed'
                                    : 'border-[#E6DCD2] hover:border-[#E6B450] hover:bg-[#FFFBEB] text-[#1F1F1F]'
                  }`}
                >
                  {p.prompt}
                  {PROMPT_CATEGORIES[p.category]?.brand && (
                    <span className="ml-2 text-xs text-[#E6B450] font-bold">Marryzen</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Answer textarea */}
          {currentPick && (
            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#1F1F1F] mb-1">Your answer</label>
              <textarea
                value={currentAnswer}
                onChange={(e) => setAnswers({ ...answers, [round]: e.target.value })}
                rows={4}
                maxLength={PROMPT_MAX_CHARS + 50}
                placeholder="Take your time. The best answers feel specific."
                className="w-full px-3 py-2 border border-[#E6DCD2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E6B450] text-sm"
              />
              <div className="mt-1 text-xs flex justify-between">
                <span className={validation.ok ? 'text-green-700' : 'text-brand-muted'}>
                  {validation.ok
                    ? '✓ Good length'
                    : validation.reason === 'too_short'
                      ? `${validation.remaining} more characters to go`
                      : `${validation.over} too many characters`}
                </span>
                <span className="text-brand-muted">{currentAnswer.length} / {PROMPT_MAX_CHARS}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-3 border-t border-[#E6DCD2]">
            <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">Close</Button>
            <Button
              onClick={handleSave}
              disabled={!allComplete || saving}
              className="flex-1 bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold disabled:opacity-50"
            >
              {saving ? 'Saving…' : (allComplete ? 'Save all 3' : `Complete all 3 rounds`)}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PromptsEditorModal;
