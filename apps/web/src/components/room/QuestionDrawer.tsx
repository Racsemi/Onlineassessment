'use client';

import React, { useState } from 'react';
import { BookOpen, Share2, Check, Sparkles, ChevronRight, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInterviewSocket } from '@/lib/socket';

export interface InterviewQuestionItem {
  id: string;
  title: string;
  category: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  description: string;
  starterCode?: string;
  testCases?: { input: string; output: string }[];
}

const DEFAULT_QUESTIONS: InterviewQuestionItem[] = [
  {
    id: 'q1',
    title: 'Two Sum & Complement Hashing',
    category: 'Algorithms',
    difficulty: 'EASY',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume each input has exactly one solution, and you may not use the same element twice.',
    testCases: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0, 1]' },
      { input: 'nums = [3,2,4], target = 6', output: '[1, 2]' },
    ],
  },
  {
    id: 'q2',
    title: 'LRU Cache Design & Eviction',
    category: 'Data Structures',
    difficulty: 'MEDIUM',
    description: 'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. Implement the LRUCache class with get(key) and put(key, value) operations running in O(1) average time complexity.',
    testCases: [
      { input: '["LRUCache", "put", "put", "get", "put", "get"]\n[[2], [1, 1], [2, 2], [1], [3, 3], [2]]', output: '[null, null, null, 1, null, -1]' },
    ],
  },
  {
    id: 'q3',
    title: 'Distributed Rate Limiter (Token Bucket)',
    category: 'System Design',
    difficulty: 'HARD',
    description: 'Design a distributed rate limiter that protects downstream APIs from traffic surges. Discuss concurrency control with Redis, sliding window counter vs token bucket, and handling clock drift across multi-region instances.',
  },
];

export function QuestionDrawer({
  interviewId,
  isInterviewer = true,
  onSelectQuestion,
}: {
  interviewId: string;
  isInterviewer?: boolean;
  onSelectQuestion?: (question: InterviewQuestionItem) => void;
}) {
  const [questions, setQuestions] = useState<InterviewQuestionItem[]>(DEFAULT_QUESTIONS);
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestionItem>(DEFAULT_QUESTIONS[0]);
  const [sharedId, setSharedId] = useState<string | null>(null);

  const handleShare = (q: InterviewQuestionItem) => {
    const socket = getInterviewSocket();
    socket.emit('share_question', {
      interviewId,
      question: q,
    });
    setSharedId(q.id);
    if (onSelectQuestion) onSelectQuestion(q);
    setTimeout(() => setSharedId(null), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0c14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 bg-[#0e111d] border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span>Technical Question Bank</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono bg-white/5 px-2 py-0.5 rounded">
          {questions.length} problems
        </span>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left Question List */}
        <div className="w-full md:w-5/12 border-r border-white/5 overflow-y-auto p-2 space-y-1.5">
          {questions.map(q => (
            <button
              key={q.id}
              onClick={() => setSelectedQuestion(q)}
              className={cn(
                "w-full text-left p-2.5 rounded-xl border transition-all duration-150 flex flex-col space-y-1",
                selectedQuestion.id === q.id
                  ? "bg-indigo-600/15 border-indigo-500/40 text-white"
                  : "bg-transparent border-transparent hover:bg-white/5 text-slate-300"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className={cn(
                  "text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase",
                  q.difficulty === 'EASY' ? "text-emerald-400 bg-emerald-500/10" :
                  q.difficulty === 'MEDIUM' ? "text-amber-400 bg-amber-500/10" : "text-red-400 bg-red-500/10"
                )}>
                  {q.difficulty}
                </span>
                <span className="text-[10px] text-slate-400">{q.category}</span>
              </div>
              <h5 className="text-xs font-semibold truncate w-full">{q.title}</h5>
            </button>
          ))}
        </div>

        {/* Right Problem Detail */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs text-slate-300">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-bold text-white mb-1">{selectedQuestion.title}</h4>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-slate-400">{selectedQuestion.category}</span>
                <span className="text-slate-600">•</span>
                <span className={cn(
                  "text-[10px] font-semibold",
                  selectedQuestion.difficulty === 'EASY' ? "text-emerald-400" :
                  selectedQuestion.difficulty === 'MEDIUM' ? "text-amber-400" : "text-red-400"
                )}>
                  {selectedQuestion.difficulty}
                </span>
              </div>
            </div>

            {isInterviewer && (
              <button
                type="button"
                onClick={() => handleShare(selectedQuestion)}
                className={cn(
                  "flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-md",
                  sharedId === selectedQuestion.id
                    ? "bg-emerald-600 text-white"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25"
                )}
              >
                {sharedId === selectedQuestion.id ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Shared!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share with Candidate</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-2">
            <p className="whitespace-pre-wrap text-slate-300">{selectedQuestion.description}</p>
          </div>

          {selectedQuestion.testCases && selectedQuestion.testCases.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <h6 className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Example Test Cases</h6>
              {selectedQuestion.testCases.map((tc, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-[#0f1220] border border-white/5 font-mono text-[11px] space-y-1">
                  <div>
                    <span className="text-slate-500">Input: </span>
                    <span className="text-cyan-300">{tc.input}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Output: </span>
                    <span className="text-emerald-400">{tc.output}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
