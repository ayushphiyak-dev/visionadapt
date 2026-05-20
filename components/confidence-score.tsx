'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ConfidenceScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizes = {
  sm: { circle: 60, stroke: 4, text: 'text-sm' },
  md: { circle: 80, stroke: 5, text: 'text-base' },
  lg: { circle: 100, stroke: 6, text: 'text-lg' },
};

export function ConfidenceScore({ 
  score, 
  size = 'md', 
  showLabel = true,
  className 
}: ConfidenceScoreProps) {
  const { circle, stroke, text } = sizes[size];
  const radius = (circle - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  
  const getColor = (score: number): string => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 75) return 'text-indigo-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-rose-600';
  };
  
  const getStrokeColor = (score: number): string => {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#4f46e5';
    if (score >= 60) return '#f59e0b';
    return '#e11d48';
  };
  
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: circle, height: circle }}>
        <svg
          className="transform -rotate-90"
          width={circle}
          height={circle}
        >
          <circle
            cx={circle / 2}
            cy={circle / 2}
            r={radius}
            stroke="#e2e8f0"
            strokeWidth={stroke}
            fill="none"
          />
          <motion.circle
            cx={circle / 2}
            cy={circle / 2}
            r={radius}
            stroke={getStrokeColor(score)}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            strokeDasharray={circumference}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold', text, getColor(score))}>
            {score}%
          </span>
        </div>
      </div>
      {showLabel && (
        <p className="text-xs text-slate-600 font-medium">AI Confidence</p>
      )}
    </div>
  );
}
