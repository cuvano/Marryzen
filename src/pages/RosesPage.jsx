import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Gift, Crown, Sparkles } from 'lucide-react';

const RosesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedBundle, setSelectedBundle] = useState(null);

  const roseBundles = [
    {
      id: 1,
      roses: 1,
      price: 2.99,
      popular: false,
      description: 'Perfect for showing interest'
    },
    {
      id: 2,
      roses: 5,
      price: 12.99,
      popular: false,
      description: 'Great value bundle',
      savings: '13%'
    },
    {
      id: 3,
      roses: 12,
      price: 24.99,
      popular: true,
      description: 'Most popular choice',
      savings: '31%'
    },
    {
      id: 4,
      roses: 25,
      price: 44.99,
      popular: false,
      description: 'For the romantic',
      savings: '40%'
    },
    {
      id: 5,
      roses: 60,
      price: 89.99,
      popular: false,
      description: 'Ultimate rose collection',
      savings: '50%'
    }
  ];

  const handlePurchase = (bundle) => {
    setSelectedBundle(bundle);
    toast({
      title: "💳 Payment Processing",
      description: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀"
    });
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="border-white/20 text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          
          <h1 className="text-2xl font-bold text-white">Buy Roses</h1>
          
          <div className="w-10"></div>
        </div>

        {/* Current Roses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-2xl p-6 mb-8 text-center"
        >
          <div className="rose-gradient w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">3 Roses</h2>
          <p className="text-white/70">You currently have 3 roses to send</p>
        </motion.div>

        {/* What are Roses? */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-effect rounded-2xl p-6 mb-8"
        >
          <h3 className="text-xl font-bold text-white mb-4">What are Roses? 🌹</h3>
          <div className="space-y-3 text-white/80">
            <p>• Send roses to show strong interest before matching</p>
            <p>• Stand out from other profiles</p>
            <p>• Get priority visibility in their discovery feed</p>
            <p>• Perfect for making a memorable first impression</p>
          </div>
        </motion.div>

        {/* Rose Bundles */}
        <div className="space-y-4 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Choose Your Bundle</h3>
          
          {roseBundles.map((bundle, index) => (
            <motion.div
              key={bundle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className={`relative glass-effect rounded-2xl p-6 cursor-pointer transition-all ${
                bundle.popular ? 'ring-2 ring-yellow-400' : ''
              }`}
              onClick={() => handlePurchase(bundle)}
            >
              {bundle.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="premium-gradient px-4 py-1 rounded-full flex items-center">
                    <Crown className="w-4 h-4 text-white mr-1" />
                    <span className="text-white text-sm font-semibold">Most Popular</span>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="rose-gradient w-12 h-12 rounded-full flex items-center justify-center">
                    <Gift className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">
                      {bundle.roses} Rose{bundle.roses > 1 ? 's' : ''}
                    </h4>
                    <p className="text-white/70 text-sm">{bundle.description}</p>
                    {bundle.savings && (
                      <div className="flex items-center mt-1">
                        <Sparkles className="w-3 h-3 text-green-400 mr-1" />
                        <span className="text-green-400 text-xs font-semibold">
                          Save {bundle.savings}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">${bundle.price}</div>
                  {bundle.roses > 1 && (
                    <div className="text-white/60 text-sm">
                      ${(bundle.price / bundle.roses).toFixed(2)} each
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glass-effect rounded-2xl p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Why Send Roses?</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <Gift className="w-6 h-6 text-pink-400" />
              </div>
              <p className="text-white/80 text-sm">Stand Out</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-white/80 text-sm">Get Noticed</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default RosesPage;