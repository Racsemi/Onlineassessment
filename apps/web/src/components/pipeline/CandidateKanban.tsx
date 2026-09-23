'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Briefcase, 
  Mail, 
  Sparkles,
  MoreVertical,
  Filter,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type PipelineStage = 
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_COMPLETED'
  | 'OFFERED'
  | 'HIRED'
  | 'REJECTED';

export interface CandidateCardData {
  id: string;
  name: string;
  email: string;
  role: string;
  appliedDate: string;
  stage: PipelineStage;
  assessmentScore?: number;
  scheduledInterview?: {
    id: string;
    scheduledStart: string;
    type: string;
  };
}

const STAGES: { key: PipelineStage; title: string; color: string; badge: string }[] = [
  { key: 'APPLIED', title: 'Applied', color: 'from-blue-500/20 to-blue-600/10', badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { key: 'SCREENING', title: 'Screening', color: 'from-amber-500/20 to-amber-600/10', badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { key: 'INTERVIEW_SCHEDULED', title: 'Interview Scheduled', color: 'from-purple-500/20 to-purple-600/10', badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { key: 'INTERVIEW_COMPLETED', title: 'Completed', color: 'from-indigo-500/20 to-indigo-600/10', badge: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  { key: 'OFFERED', title: 'Offered', color: 'from-emerald-500/20 to-emerald-600/10', badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { key: 'HIRED', title: 'Hired', color: 'from-cyan-500/20 to-cyan-600/10', badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
];

export function CandidateKanban({
  initialCandidates,
  onStageChange,
}: {
  initialCandidates: CandidateCardData[];
  onStageChange?: (candidateId: string, newStage: PipelineStage) => void;
}) {
  const [candidates, setCandidates] = useState<CandidateCardData[]>(initialCandidates);
  const [filterRole, setFilterRole] = useState<string>('ALL');

  const moveCandidate = (candidateId: string, newStage: PipelineStage) => {
    setCandidates(prev =>
      prev.map(c => (c.id === candidateId ? { ...c, stage: newStage } : c))
    );
    if (onStageChange) {
      onStageChange(candidateId, newStage);
    }
  };

  const filteredCandidates = filterRole === 'ALL'
    ? candidates
    : candidates.filter(c => c.role.toLowerCase().includes(filterRole.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Filter and stats row */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0f111a] p-4 rounded-2xl border border-white/5">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-sm text-slate-400">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span>Role:</span>
          </div>
          <select 
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="bg-[#161a29] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Roles</option>
            <option value="Senior Frontend">Senior Frontend Engineer</option>
            <option value="Backend">Backend Distributed Systems</option>
            <option value="Full Stack">Full Stack Engineer</option>
            <option value="DevOps">Site Reliability Engineer</option>
          </select>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          <span className="text-slate-400">Total Active in Funnel:</span>
          <span className="font-bold text-white bg-indigo-600/20 px-2.5 py-1 rounded-full border border-indigo-500/30">
            {filteredCandidates.length} Candidates
          </span>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {STAGES.map((col) => {
          const colCandidates = filteredCandidates.filter(c => c.stage === col.key);

          return (
            <div 
              key={col.key}
              className="flex flex-col rounded-2xl bg-[#0c0e17]/80 border border-white/5 p-3 min-w-[260px] max-h-[820px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/5">
                <div className="flex items-center space-x-2">
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-md border", col.badge)}>
                    {col.title}
                  </span>
                </div>
                <span className="text-xs font-mono font-medium text-slate-400">
                  {colCandidates.length}
                </span>
              </div>

              {/* Cards list */}
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {colCandidates.length === 0 ? (
                  <div className="h-28 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-[11px] text-slate-500">
                    No candidates
                  </div>
                ) : (
                  colCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="group relative rounded-xl bg-gradient-to-b from-[#141828] to-[#0e111d] p-3.5 border border-white/10 hover:border-indigo-500/40 shadow-sm hover:shadow-indigo-500/10 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                            {candidate.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 flex items-center mt-0.5">
                            <Briefcase className="w-3 h-3 mr-1 text-slate-500" />
                            {candidate.role}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center text-[10px] text-slate-400">
                        <Mail className="w-3 h-3 mr-1 text-slate-500" />
                        <span className="truncate max-w-[170px]">{candidate.email}</span>
                      </div>

                      {candidate.assessmentScore !== undefined && (
                        <div className="mt-2.5 flex items-center justify-between text-[11px] bg-black/30 px-2.5 py-1 rounded-lg border border-white/5">
                          <span className="text-slate-400">Assessment Score:</span>
                          <span className={cn(
                            "font-bold font-mono",
                            candidate.assessmentScore >= 85 ? "text-emerald-400" :
                            candidate.assessmentScore >= 70 ? "text-cyan-400" : "text-amber-400"
                          )}>
                            {candidate.assessmentScore}%
                          </span>
                        </div>
                      )}

                      {candidate.scheduledInterview && (
                        <div className="mt-2.5 p-2 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-[10px] text-indigo-300">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1 text-indigo-400" />
                              {candidate.scheduledInterview.type}
                            </span>
                          </div>
                          <p className="mt-1 text-slate-400">
                            {new Date(candidate.scheduledInterview.scheduledStart).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <Link 
                            href={`/interviews/${candidate.scheduledInterview.id}/room`}
                            className="mt-2 inline-flex items-center justify-center w-full py-1 rounded-md bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white font-medium transition-colors"
                          >
                            Open Room
                          </Link>
                        </div>
                      )}

                      {/* Stage Movement Controls */}
                      <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
                        {!candidate.scheduledInterview && (
                          <Link
                            href={`/interviews/new?candidateId=${candidate.id}&candidateName=${encodeURIComponent(candidate.name)}`}
                            className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 flex items-center"
                          >
                            <Calendar className="w-3 h-3 mr-1" />
                            Schedule
                          </Link>
                        )}

                        <select
                          value={candidate.stage}
                          onChange={(e) => moveCandidate(candidate.id, e.target.value as PipelineStage)}
                          className="ml-auto bg-[#1a1f33] border border-white/10 rounded-md px-2 py-0.5 text-[10px] text-slate-300 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="APPLIED">Applied</option>
                          <option value="SCREENING">Screening</option>
                          <option value="INTERVIEW_SCHEDULED">Scheduled</option>
                          <option value="INTERVIEW_COMPLETED">Completed</option>
                          <option value="OFFERED">Offered</option>
                          <option value="HIRED">Hired</option>
                          <option value="REJECTED">Archive</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
