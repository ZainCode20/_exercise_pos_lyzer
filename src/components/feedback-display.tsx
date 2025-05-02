
'use client';

import React from 'react';
import type { AnalyzeExerciseFormOutput } from '@/ai/flows/analyze-exercise-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; // Import Framer Motion

interface FeedbackDisplayProps {
  feedback: AnalyzeExerciseFormOutput | null;
}

const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({ feedback }) => {
  if (!feedback) {
    return null; // Don't render anything if there's no feedback yet
  }

  const isCorrect = feedback.formCorrect;

  return (
    <AnimatePresence>
      <motion.div
        key={isCorrect ? 'correct' : 'incorrect'} // Change key to trigger animation on state change
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="w-full"
      >
        <Alert variant={isCorrect ? 'default' : 'destructive'} className={`border-2 ${isCorrect ? 'border-green-500' : 'border-red-500'} bg-opacity-10`}>
          {isCorrect ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          )}
          <AlertTitle className={`font-semibold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
            {isCorrect ? 'Form Looks Good!' : 'Form Needs Correction'}
          </AlertTitle>
          <AlertDescription className={isCorrect ? 'text-green-600' : 'text-red-600'}>
            {feedback.feedback}
          </AlertDescription>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
};

export default FeedbackDisplay;
