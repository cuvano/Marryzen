import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Crown, X, Lock, Check } from 'lucide-react';

const PremiumUpgradeModal = ({ isOpen, onClose, feature }) => {
  const navigate = useNavigate();

  const featureDetails = {
    'advanced_filters': {
      title: 'Advanced Filters',
      description: 'Unlock advanced filtering options including distance, income, verified profiles, and more.',
      features: ['Distance-based filtering', 'Income range filter', 'Verified profiles only', 'Recent activity filter', 'Minimum photos filter']
    },
    'unlimited_messages': {
      title: 'Unlimited Messaging',
      description: 'Send unlimited messages to your matches. Free users are limited to 10 messages per day.',
      features: ['Unlimited daily messages', 'No daily limits', 'Send as many messages as you want']
    },
    'see_who_liked': {
      title: 'See Who Liked You',
      description: 'Discover who has shown interest in your profile.',
      features: ['View all profile views', 'See who liked you', 'Get notifications']
    },
    'read_receipts': {
      title: 'Read Receipts',
      description: 'Know when your messages have been read.',
      features: ['See read receipts', 'Know when messages are read', 'Better communication']
    },
    'default': {
      title: 'Marryzen Premium',
      description: 'Unlock all premium features and get the most out of your marriage search.',
      features: ['Unlimited messaging', 'Advanced filters', 'See who liked you', 'Read receipts', 'Verified badge']
    }
  };

  const details = featureDetails[feature] || featureDetails['default'];

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
            className="bg-[#1F1F1F] backdrop-blur-lg rounded-2xl p-8 w-full max-w-sm text-center relative border border-[#E6B450]/30 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
                <X size={20} />
            </button>
            <div className="bg-gradient-to-br from-[#E6B450] to-[#D0A23D] w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#E6B450]/30">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">{details.title}</h2>
            <p className="text-white/70 mb-4 leading-relaxed">
              {details.description}
            </p>
            <div className="bg-white/10 rounded-lg p-4 mb-6 text-left">
              <p className="text-white/90 font-semibold text-sm mb-2">Unlock with Premium:</p>
              <ul className="space-y-2">
                {details.features.map((feat, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-white/80 text-sm">
                    <Check className="w-4 h-4 text-[#E6B450] flex-shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              onClick={handleUpgrade}
              className="w-full bg-gradient-to-r from-[#E6B450] to-[#D0A23D] text-white font-bold py-6 text-lg hover:opacity-90 transition-opacity"
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