'use client';

import React, { useState } from 'react';
import { 
  Award, 
  Star, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Send,
  ThumbsUp,
  ThumbsDown,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ScorecardCriteriaData {
  criterion: string;
  score: number; // 1 to 5
  feedback?: string;
}

export interface ScorecardSubmission {
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE';
  strengths: string;
  weaknesses: string;
  summaryNotes: string;
  criteria: ScorecardCriteriaData[];
}

const DEFAULT_CRITERIA = [
  { name: 'Problem Solving & Algorithmic Thinking', desc: 'Breakdown of problem, edge case handling, optimal time/space complexity.' },
  { name: 'Technical Depth & Core Knowledge', desc: 'Understanding of language runtime, data structures, and computer science fundamentals.' },
  { name: 'Code Quality, Cleanliness & Testing', desc: 'Modular architecture, readable variable names, defensive programming.' },
  { name: 'Communication & Collaborative Aptitude', desc: 'Ability to explain thought process, respond to feedback, and ask clarifying questions.' },
];

export function ScorecardModal({
  isOpen,
  onClose,
  onSubmit,
  candidateName,
  interviewTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (scorecard: ScorecardSubmission) => Promise<void>;
  candidateName: string;
  interviewTitle: string;
}) {
  const [recommendation, setRecommendation] = useState<'STRONG_HIRE' | 'HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE'>('HIRE');
  const [scores, setScores] = useState<Record<number, number>>({ 0: 4, 1: 4, 2: 4, 3: 4 });
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [summaryNotes, setSummaryNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleScoreChange = (index: number, score: number) => {
    setScores(prev => ({ ...prev, [index]: score }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const criteriaList: ScorecardCriteriaData[] = DEFAULT_CRITERIA.map((crit, idx) => ({
        criterion: crit.name,
        score: scores[idx] || 3,
      }));

      await onSubmit({
        recommendation,
        strengths,
        weaknesses,
        summaryNotes,
        criteria: criteriaList,
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0d101a] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Interview Evaluation Scorecard</h3>
              <p className="text-xs text-slate-400">
                Evaluating <span className="font-semibold text-slate-200">{candidateName}</span> for {interviewTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-400 animate-bounce" />
            <h4 className="text-lg font-bold text-white">Scorecard Submitted!</h4>
            <p className="text-xs text-slate-400">Your ratings have been recorded and synced to the recruitment pipeline.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Recommendation Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Final Hiring Recommendation</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: 'STRONG_HIRE', label: 'Strong Hire', color: 'from-emerald-600 to-teal-500' },
                  { value: 'HIRE', label: 'Hire', color: 'from-indigo-600 to-cyan-500' },
                  { value: 'NO_HIRE', label: 'No Hire', color: 'from-amber-600 to-orange-500' },
                  { value: 'STRONG_NO_HIRE', label: 'Strong No Hire', color: 'from-red-600 to-rose-600' },
                ].map(item => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setRecommendation(item.value as any)}
                    className={cn(
                      "py-2.5 px-3 rounded-xl text-xs font-bold transition-all border text-center",
                      recommendation === item.value
                        ? `bg-gradient-to-r ${item.color} text-white border-transparent shadow-lg scale-[1.02]`
                        : "bg-[#141829] text-slate-400 border-white/5 hover:border-white/10"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Criteria 1-5 Ratings */}
            <div className="space-y-4">
              <label className="text-xs font-semibold text-slate-300">Competency Rubric (1 = Poor, 5 = Exceptional)</label>
              <div className="space-y-3">
                {DEFAULT_CRITERIA.map((criterion, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-[#121524] border border-white/5 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <span className="text-xs font-semibold text-white">{criterion.name}</span>
                        <p className="text-[11px] text-slate-400">{criterion.desc}</p>
                      </div>

                      {/* 1-5 Star / Pill selector */}
                      <div className="flex items-center space-x-1.5 self-start sm:self-auto pt-1 sm:pt-0">
                        {[1, 2, 3, 4, 5].map(score => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => handleScoreChange(idx, score)}
                            className={cn(
                              "w-7 h-7 rounded-lg text-xs font-bold transition-all",
                              scores[idx] === score
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-110"
                                : "bg-[#181d33] text-slate-400 hover:text-slate-200"
                            )}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Qualitative Feedback */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-emerald-400 flex items-center">
                  <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                  Key Strengths
                </label>
                <textarea
                  rows={2}
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="e.g. Clean recursion, communicated clearly about tradeoffs..."
                  className="w-full bg-[#121524] border border-white/10 rounded-xl p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-amber-400 flex items-center">
                  <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                  Areas for Growth
                </label>
                <textarea
                  rows={2}
                  value={weaknesses}
                  onChange={(e) => setWeaknesses(e.target.value)}
                  placeholder="e.g. Could optimize space complexity, missed empty array check..."
                  className="w-full bg-[#121524] border border-white/10 rounded-xl p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            {/* General Summary */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Executive Summary & Final Thoughts</label>
              <textarea
                rows={2}
                value={summaryNotes}
                onChange={(e) => setSummaryNotes(e.target.value)}
                placeholder="Overall impression of the candidate for the hiring committee..."
                className="w-full bg-[#121524] border border-white/10 rounded-xl p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Submit CTA */}
            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-lg shadow-indigo-500/25 active:scale-95 transition-all disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Submitting...' : 'Submit Official Scorecard'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
