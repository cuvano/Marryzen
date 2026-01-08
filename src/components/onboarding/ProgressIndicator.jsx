import React from 'react';
import { motion } from 'framer-motion';

const stepDetails = {
  1: { text: "Step 1: Basic Details" },
  2: { text: "Step 2: Profile Photos" },
  3: { text: "Step 3: Culture & Values" },
  4: { text: "Step 4: Story & Communication" },
  5: { text: "Step 5: Marriage Intent" },
};

const ProgressIndicator = ({ currentStep, totalSteps }) => {
  const detailText = stepDetails[currentStep]?.text || `Step ${currentStep} of ${totalSteps}`;

  return (
    <div className="mb-8 max-w-3xl mx-auto px-2">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[#1F1F1F] font-bold text-base tracking-tight">
          {detailText}
        </span>
        <span className="text-[#E6B450] font-bold text-sm">{Math.round((currentStep / totalSteps) * 100)}%</span>
      </div>
      <div className="w-full bg-[#E6DCD2] rounded-full h-2.5 overflow-hidden">
        <motion.div
          className="bg-[#E6B450] h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
};

export default ProgressIndicator;