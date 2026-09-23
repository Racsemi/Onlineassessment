'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { 
  Video, 
  Users, 
  Calendar, 
  Award, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  Sparkles,
  TrendingUp,
  Shield,
  Code2,
  Terminal,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const metrics = [
    { label: 'Upcoming Interviews Today', value: '4', change: '+2 from yesterday', icon: Calendar, color: 'text-indigo-400 bg-indigo-500/10' },
    { label: 'Active Candidates in Pipeline', value: '28', change: '8 in technical stage', icon: Users, color: 'text-cyan-400 bg-cyan-500/10' },
    { label: 'Scorecards Submitted This Week', value: '19', change: '94% completion rate', icon: Award, color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Avg Candidate Technical Score', value: '4.2/5', change: 'Top 15% percentile', icon: TrendingUp, color: 'text-amber-400 bg-amber-500/10' },
  ];

  const upcomingInterviews = [
    {
      id: 'int-101',
      title: 'Senior Frontend Architecture - System & React 19',
      candidateName: 'Alex Rivera',
      candidateRole: 'Senior Frontend Engineer',
      time: '2:00 PM - 3:00 PM',
      isLive: true,
      interviewers: ['Alice Recruiter', 'Bob Tech Lead'],
      type: 'TECHNICAL',
    },
    {
      id: 'int-102',
      title: 'Distributed Systems & Database Sharding',
      candidateName: 'Devon Vance',
      candidateRole: 'Principal Backend Architect',
      time: '4:30 PM - 5:30 PM',
      isLive: false,
      interviewers: ['Marcus Staff Eng'],
      type: 'SYSTEM_DESIGN',
    },
    {
      id: 'int-103',
      title: 'Algorithms & Concurrency Engineering',
      candidateName: 'Sarah Chen',
      candidateRole: 'Full Stack Engineer',
      time: 'Tomorrow, 10:00 AM',
      isLive: false,
      interviewers: ['Alice Recruiter'],
      type: 'TECHNICAL',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Banner */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-950/60 via-[#0f1325] to-[#0d172e] border border-white/10 p-6 sm:p-8 shadow-2xl">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Full-Fledged Recruitment & Live Interview Platform</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Enterprise Technical Interviews with Live Video, Monaco Code Sandbox & Scoring
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              Conduct high-fidelity technical interviews with multi-party WebRTC audio/video, real-time collaborative coding, sandbox execution, confidential notes, and standardized scorecard rubrics.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/interviews/new"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-xl shadow-indigo-500/25 border border-indigo-300/30 transition-all active:scale-95"
              >
                <span>Schedule New Interview</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>

              <Link
                href="/candidates"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
              >
                <Users className="w-4 h-4 text-cyan-400" />
                <span>View Candidate Pipeline</span>
              </Link>
            </div>
          </div>

          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-600/10 to-transparent pointer-events-none" />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#0f111a] border border-white/5 shadow-sm hover:border-white/10 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">{m.label}</span>
                  <div className={cn("p-2 rounded-xl", m.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-white font-mono">{m.value}</div>
                <div className="text-[11px] text-slate-500 mt-1">{m.change}</div>
              </div>
            );
          })}
        </div>

        {/* Two Column Layout: Upcoming Live Sessions vs Pipeline Funnel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Scheduled Sessions */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Today's Scheduled Interview Sessions</h2>
              </div>
              <Link href="/interviews" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
                View All →
              </Link>
            </div>

            <div className="space-y-3">
              {upcomingInterviews.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                    session.isLive
                      ? "bg-gradient-to-r from-indigo-950/40 to-[#0e111d] border-indigo-500/40 shadow-lg shadow-indigo-500/10"
                      : "bg-[#0f111a] border-white/5"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold">
                        {session.type}
                      </span>
                      {session.isLive && (
                        <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-full flex items-center animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5" />
                          READY TO JOIN
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-white">{session.title}</h4>
                    <p className="text-xs text-slate-400">
                      Candidate: <span className="font-semibold text-slate-200">{session.candidateName}</span> ({session.candidateRole})
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Time: {session.time} • Interviewers: {session.interviewers.join(', ')}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center space-x-2">
                    <Link
                      href={`/interviews/${session.id}/room`}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md",
                        session.isLive
                          ? "bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-indigo-500/25"
                          : "bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white"
                      )}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>{session.isLive ? 'Enter Live Room' : 'Prepare Room'}</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Recruitment Stages Funnel & Quick Features */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h2 className="text-base font-bold text-white">Recruitment Pipeline Funnel</h2>
            </div>

            <div className="p-5 rounded-2xl bg-[#0f111a] border border-white/5 space-y-4">
              {[
                { stage: 'Applied & Sourced', count: 42, pct: '100%', color: 'bg-blue-500' },
                { stage: 'Screening Passed', count: 28, pct: '66%', color: 'bg-amber-500' },
                { stage: 'Technical Interview', count: 18, pct: '43%', color: 'bg-purple-500' },
                { stage: 'Scorecard Approved', count: 9, pct: '21%', color: 'bg-indigo-500' },
                { stage: 'Offer Extended', count: 4, pct: '9.5%', color: 'bg-emerald-500' },
              ].map((funnel, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">{funnel.stage}</span>
                    <span className="font-mono text-slate-400">{funnel.count} ({funnel.pct})</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", funnel.color)} style={{ width: funnel.pct }} />
                  </div>
                </div>
              ))}

              <div className="pt-3 border-t border-white/5">
                <Link
                  href="/candidates"
                  className="w-full inline-flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 transition-colors"
                >
                  <span>Open Interactive Kanban Pipeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
