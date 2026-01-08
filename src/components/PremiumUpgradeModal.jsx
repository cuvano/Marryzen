import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Crown, X } from 'lucide-react';

const PremiumUpgradeModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onClose();
    navigate('/premium');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="glass-effect-deep rounded-2xl p-8 w-full max-w-sm text-center relative border border-yellow-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
                <X size={20} />
            </button>
            <div className="premium-gradient w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/20">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Upgrade to Marryzen Premium</h2>
            <p className="text-white/70 mb-8 leading-relaxed">
              Upgrade to Marryzen Premium to unlock advanced marriage tools and serious verified matches.
            </p>
            <Button
              onClick={handleUpgrade}
              className="w-full premium-gradient text-white font-bold py-6 text-lg hover:opacity-90 transition-opacity"
              size="lg"
            >
              Unlock All Features
            </Button>
            <button onClick={onClose} className="text-white/40 mt-4 text-xs hover:text-white transition-colors">
                Maybe Later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PremiumUpgradeModal;