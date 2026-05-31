import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

// Editorial step labels per session-11 board verdict (Maya):
// drop the "Step N:" prefix — the segment dots already convey position.
const stepDetails = {
  1: { text: "Basic Details" },
  2: { text: "Profile Photos" },
  3: { text: "Culture & Values" },
  4: { text: "Story & Communication" },
  5: { text: "Marriage Intent" },
};

const ProgressIndicator = ({ currentStep, totalSteps }) => {
  const detailText = stepDetails[currentStep]?.text || `Step ${currentStep} of ${totalSteps}`;
  const pct = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="mb-8 max-w-3xl mx-auto px-2">
      {/* Segment dots — give the user a sense of where they are in the
          full flow, not just a percentage. Pattern matches Hinge/Bumble.
          The display:contents wrapper makes the keyed div transparent to
          the parent flex layout, so dots and connector lines line up. */}
      <div className="flex items-center justify-between mb-3" aria-hidden="true">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isCurrent = stepNum === currentStep;
          const isComplete = stepNum < currentStep;
          return (
            <div key={stepNum} className="contents">
              <div
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isComplete
                    ? 'bg-[#E6B450] text-[#1F1F1F]'
                    : isCurrent
                      ? 'bg-[#E6B450] text-[#1F1F1F] ring-4 ring-[#E6B450]/25 scale-110'
                      : 'bg-[#E6DCD2] text-[#8A857D]'
                }`}
              >
                {isComplete ? <Check size={14} strokeWidth={3} /> : stepNum}
              </div>
              {stepNum < totalSteps && (
                <div
                  className={`flex-1 h-0.5 mx-1.5 rounded-full transition-colors ${
                    isComplete ? 'bg-[#E6B450]' : 'bg-[#E6DCD2]'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center mb-3">
        <span className="text-[#1F1F1F] font-bold text-base tracking-tight">
          {detailText}
        </span>
        <span className="text-[#E6B450] font-bold text-sm" aria-label={`Step ${currentStep} of ${totalSteps}`}>
          {pct}%
        </span>
      </div>

      <div
        className="w-full bg-[#E6DCD2] rounded-full h-2 overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <motion.div
          className="bg-[#E6B450] h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
};

export default ProgressIndicator;
