'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { 
  Calendar, 
  Clock, 
  User, 
  Award, 
  Video, 
  ArrowLeft, 
  Copy, 
  Check, 
  Star, 
  Lock, 
  FileText,
  ThumbsUp,
  ThumbsDown,
  Terminal
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate, formatTime } from '@/lib/utils';

export default function InterviewDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || 'int-101';
  const [copied, setCopied] = useState(false);

  const interview = {
    id,
    title: 'Senior Frontend Architecture - System & React 19',
    type: 'TECHNICAL',
    status: 'IN_PROGRESS',
    scheduledStart: '2026-09-23T14:00:00Z',
    scheduledEnd: '2026-09-23T15:00:00Z',
    candidate: {
      id: 'c1',
      name: 'Alex Rivera',
      email: 'alex.rivera@example.com',
      role: 'Senior Frontend Engineer',
    },
    interviewers: [
      { id: 'u1', name: 'Alice Recruiter', role: 'Lead Recruiter' },
      { id: 'u2', name: 'Bob Tech Lead', role: 'Senior Staff Eng' },
    ],
    scorecard: {
      recommendation: 'HIRE',
      submittedAt: '2026-09-23T14:55:00Z',
      submittedBy: 'Bob Tech Lead',
      overallScore: 4.25,
      strengths: 'Outstanding grasp of React 19 server components and compiler optimizations. Wrote clean TypeScript with proper generic constraints.',
      weaknesses: 'Initial two-pointer solution had an edge case on duplicate values, though candidate self-corrected when prompted.',
      summary: 'Solid Senior-level engineering capability. Clear communicator, receptive to feedback. Recommend moving to final leadership screen.',
      criteria: [
        { name: 'Problem Solving & Algorithmic Thinking', score: 4 },
        { name: 'Technical Depth & Core Knowledge', score: 5 },
        { name: 'Code Quality, Cleanliness & Testing', score: 4 },
        { name: 'Communication & Collaborative Aptitude', score: 4 },
      ],
    },
    notes: [
      {
        id: 'n1',
        author: 'Alice Recruiter',
        time: '2:15 PM',
        content: 'Explained past team project migrating from Next.js 14 to 15. Handled complex caching invalidation.',
      },
      {
        id: 'n2',
        author: 'Bob Tech Lead',
        time: '2:35 PM',
        content: 'Candidate quickly identified O(n) space/time tradeoff using Map instead of brute-force quadratic search.',
      },
    ],
    codeSnippet: `function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement)!, i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
  };

  const copyMagicLink = () => {
    const link = `${window.location.origin}/interview/tok_alex_123/room`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link
          href="/interviews"
          className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          <span>Back to Interviews</span>
        </Link>

        {/* Top Header Card */}
        <div className="p-6 rounded-3xl bg-[#0f111a] border border-white/10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold">
                {interview.type}
              </span>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                Active Session
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{interview.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center text-slate-300">
                <User className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                {interview.candidate.name} ({interview.candidate.role})
              </span>
              <span className="flex items-center text-slate-300">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
                {formatDate(interview.scheduledStart)}
              </span>
              <span className="flex items-center text-slate-300">
                <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
                {formatTime(interview.scheduledStart)} - {formatTime(interview.scheduledEnd)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={copyMagicLink}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center space-x-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied!' : 'Copy Candidate Magic Link'}</span>
            </button>

            <Link
              href={`/interviews/${interview.id}/room`}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-lg shadow-indigo-500/25 border border-indigo-400/30 transition-all active:scale-95"
            >
              <Video className="w-4 h-4" />
              <span>Enter Live Room</span>
            </Link>
          </div>
        </div>

        {/* Two-Column Grid: Scorecard Rubric vs Confidential Notes & Code */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Scorecard Breakdown */}
          <div className="lg:col-span-7 space-y-6">
            <div className="p-6 rounded-3xl bg-[#0f111a] border border-white/10 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Official Evaluation Scorecard</h3>
                    <p className="text-xs text-slate-400">Submitted by {interview.scorecard.submittedBy}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Aggregate Score</span>
                    <span className="text-lg font-bold font-mono text-emerald-400">
                      {interview.scorecard.overallScore} / 5.0
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {interview.scorecard.recommendation.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Rubric scores */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evaluation Rubric Breakdown</h4>
                {interview.scorecard.criteria.map((c, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-[#121524] border border-white/5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-200">{c.name}</span>
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={cn(
                            "w-4 h-4",
                            star <= c.score ? "text-amber-400 fill-amber-400" : "text-slate-700"
                          )}
                        />
                      ))}
                      <span className="text-xs font-mono font-bold text-slate-300 ml-2">{c.score}/5</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-[#121524] border border-white/5 space-y-1.5">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center">
                    <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                    Key Strengths
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">{interview.scorecard.strengths}</p>
                </div>

                <div className="p-4 rounded-2xl bg-[#121524] border border-white/5 space-y-1.5">
                  <span className="text-xs font-semibold text-amber-400 flex items-center">
                    <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                    Growth Areas
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">{interview.scorecard.weaknesses}</p>
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-2xl bg-[#121524] border border-white/5 space-y-1.5">
                <span className="text-xs font-semibold text-slate-300">Executive Summary</span>
                <p className="text-xs text-slate-300 leading-relaxed">{interview.scorecard.summary}</p>
              </div>
            </div>
          </div>

          {/* Right: Confidential Notes & Code Archive */}
          <div className="lg:col-span-5 space-y-6">
            {/* Private Notes */}
            <div className="p-6 rounded-3xl bg-[#0f111a] border border-white/10 shadow-2xl space-y-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-amber-300">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Confidential Interviewer Notes</span>
              </div>

              <div className="space-y-3">
                {interview.notes.map(note => (
                  <div key={note.id} className="p-3 rounded-2xl bg-[#121524] border border-white/5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-200">{note.author}</span>
                      <span className="font-mono text-slate-500">{note.time}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{note.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Code Written in Interview */}
            <div className="p-6 rounded-3xl bg-[#0f111a] border border-white/10 shadow-2xl space-y-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-300">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Code Written in Live Sandbox</span>
              </div>

              <div className="rounded-2xl bg-[#07090e] border border-white/5 p-3.5 font-mono text-xs text-slate-300 overflow-x-auto">
                <pre>{interview.codeSnippet}</pre>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
