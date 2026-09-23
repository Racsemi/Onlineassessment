'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Copy, 
  Check, 
  AlertTriangle,
  Award,
  ExternalLink
} from 'lucide-react';
import { cn, formatDate, formatTime } from '@/lib/utils';

export interface CalendarInterviewItem {
  id: string;
  title: string;
  type: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scheduledStart: string;
  scheduledEnd: string;
  candidate: {
    id: string;
    name: string;
    email: string;
  };
  interviewers: {
    id: string;
    name: string;
    email: string;
    role?: string;
  }[];
  candidateMagicLink?: string;
  scorecardSubmitted?: boolean;
}

export function InterviewCalendar({
  interviews,
  onCancel,
  onReschedule,
}: {
  interviews: CalendarInterviewItem[];
  onCancel?: (id: string) => void;
  onReschedule?: (id: string, newStart: string, newEnd: string) => void;
}) {
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'TODAY' | 'UPCOMING' | 'COMPLETED'>('UPCOMING');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyMagicLink = (interview: CalendarInterviewItem) => {
    const link = `${window.location.origin}/interview/${interview.candidateMagicLink || interview.id}/room`;
    navigator.clipboard.writeText(link);
    setCopiedId(interview.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredInterviews = interviews.filter(item => {
    const startDate = new Date(item.scheduledStart);
    const now = new Date();
    const isToday = startDate.toDateString() === now.toDateString();

    if (selectedFilter === 'TODAY') return isToday;
    if (selectedFilter === 'UPCOMING') return item.status === 'SCHEDULED' || item.status === 'IN_PROGRESS';
    if (selectedFilter === 'COMPLETED') return item.status === 'COMPLETED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0f111a] p-4 rounded-2xl border border-white/5">
        <div className="flex items-center space-x-2">
          {(['UPCOMING', 'TODAY', 'COMPLETED', 'ALL'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedFilter(tab)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all",
                selectedFilter === tab
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              )}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/interviews/new"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-500/25 border border-indigo-400/30 transition-all"
          >
            + Schedule New Session
          </Link>
        </div>
      </div>

      {/* Grid of interview cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredInterviews.length === 0 ? (
          <div className="col-span-full py-16 text-center rounded-2xl bg-[#0c0e17]/80 border border-dashed border-white/10">
            <CalendarIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No interviews match this filter</h3>
            <p className="text-xs text-slate-500 mt-1">Schedule a new interview or pick another timeframe.</p>
          </div>
        ) : (
          filteredInterviews.map(interview => {
            const isLive = interview.status === 'IN_PROGRESS' || 
              (new Date(interview.scheduledStart).getTime() <= Date.now() + 15 * 60 * 1000 &&
               new Date(interview.scheduledEnd).getTime() >= Date.now() - 30 * 60 * 1000);

            return (
              <div
                key={interview.id}
                className={cn(
                  "relative rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between",
                  isLive
                    ? "bg-gradient-to-br from-[#121629] via-[#0f1220] to-[#0c0e18] border-indigo-500/40 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/20"
                    : "bg-[#0f111a] border-white/5 hover:border-white/10 hover:shadow-md"
                )}
              >
                <div>
                  {/* Status header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                      {interview.type}
                    </span>

                    {interview.status === 'COMPLETED' ? (
                      <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Completed
                      </span>
                    ) : isLive ? (
                      <span className="flex items-center text-[11px] font-bold text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/30 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5" />
                        LIVE READY
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
                        Scheduled
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-100 mb-1 leading-snug">
                    {interview.title}
                  </h3>

                  {/* Candidate info */}
                  <div className="flex items-center space-x-2 text-xs text-slate-300 mb-3">
                    <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="font-semibold">{interview.candidate.name}</span>
                    <span className="text-slate-500 font-mono text-[11px]">({interview.candidate.email})</span>
                  </div>

                  {/* Time and Duration */}
                  <div className="space-y-1.5 py-3 border-y border-white/5 text-xs text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center text-slate-300">
                        <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        {formatDate(interview.scheduledStart)}
                      </span>
                      <span className="flex items-center font-mono text-indigo-300 font-medium">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        {formatTime(interview.scheduledStart)} - {formatTime(interview.scheduledEnd)}
                      </span>
                    </div>

                    <div className="flex items-center text-[11px] text-slate-400 pt-1">
                      <span className="text-slate-500 mr-2">Interviewers:</span>
                      <span className="text-slate-300 truncate font-medium">
                        {interview.interviewers.map(i => i.name).join(', ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/interviews/${interview.id}/room`}
                      className={cn(
                        "flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-md",
                        isLive
                          ? "bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-indigo-500/25 border border-indigo-300/30"
                          : "bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30"
                      )}
                    >
                      <Video className="w-4 h-4" />
                      <span>{isLive ? 'Join Live Room' : 'Open Interview Room'}</span>
                    </Link>

                    <button
                      onClick={() => copyMagicLink(interview)}
                      title="Copy Candidate Magic Link"
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                    >
                      {copiedId === interview.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <Link
                      href={`/interviews/${interview.id}`}
                      className="text-slate-400 hover:text-indigo-300 font-medium flex items-center"
                    >
                      <span>View Scorecard & Notes</span>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Link>

                    {interview.scorecardSubmitted && (
                      <span className="flex items-center text-emerald-400 font-medium">
                        <Award className="w-3 h-3 mr-1" />
                        Scored
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
