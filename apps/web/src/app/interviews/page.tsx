'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { InterviewCalendar, CalendarInterviewItem } from '@/components/calendar/InterviewCalendar';
import { Calendar, Plus, Sparkles, Filter } from 'lucide-react';
import Link from 'next/link';

const MOCK_INTERVIEWS: CalendarInterviewItem[] = [
  {
    id: 'int-101',
    title: 'Senior Frontend Architecture - System & React 19',
    type: 'TECHNICAL',
    status: 'IN_PROGRESS',
    scheduledStart: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    scheduledEnd: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
    candidate: {
      id: 'c1',
      name: 'Alex Rivera',
      email: 'alex.rivera@example.com',
    },
    interviewers: [
      { id: 'u1', name: 'Alice Recruiter', email: 'alice@racsemi.com', role: 'LEAD_INTERVIEWER' },
      { id: 'u2', name: 'Bob Tech Lead', email: 'bob@racsemi.com', role: 'INTERVIEWER' },
    ],
    candidateMagicLink: 'tok_alex_123',
    scorecardSubmitted: false,
  },
  {
    id: 'int-102',
    title: 'Distributed Systems & Database Sharding',
    type: 'SYSTEM_DESIGN',
    status: 'SCHEDULED',
    scheduledStart: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    scheduledEnd: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    candidate: {
      id: 'c2',
      name: 'Devon Vance',
      email: 'devon.vance@example.com',
    },
    interviewers: [
      { id: 'u3', name: 'Marcus Staff Eng', email: 'marcus@racsemi.com', role: 'LEAD_INTERVIEWER' },
    ],
    candidateMagicLink: 'tok_devon_456',
    scorecardSubmitted: false,
  },
  {
    id: 'int-103',
    title: 'Algorithms & Concurrency Engineering',
    type: 'TECHNICAL',
    status: 'SCHEDULED',
    scheduledStart: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    scheduledEnd: new Date(Date.now() + 25 * 3600 * 1000).toISOString(),
    candidate: {
      id: 'c3',
      name: 'Sarah Chen',
      email: 'sarah.chen@example.com',
    },
    interviewers: [
      { id: 'u1', name: 'Alice Recruiter', email: 'alice@racsemi.com', role: 'LEAD_INTERVIEWER' },
    ],
    candidateMagicLink: 'tok_sarah_789',
    scorecardSubmitted: false,
  },
  {
    id: 'int-104',
    title: 'Culture, Leadership & Engineering Strategy',
    type: 'BEHAVIORAL',
    status: 'COMPLETED',
    scheduledStart: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    scheduledEnd: new Date(Date.now() - 47 * 3600 * 1000).toISOString(),
    candidate: {
      id: 'c5',
      name: 'Priya Patel',
      email: 'priya.patel@example.com',
    },
    interviewers: [
      { id: 'u1', name: 'Alice Recruiter', email: 'alice@racsemi.com', role: 'LEAD_INTERVIEWER' },
    ],
    scorecardSubmitted: true,
  },
];

export default function InterviewsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Interview Hub & Calendar</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              View upcoming sessions, join active LiveKit interview rooms, copy candidate magic links, and review submitted scorecards.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/interviews/new"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-500/25 border border-indigo-400/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Interview</span>
            </Link>
          </div>
        </div>

        <InterviewCalendar interviews={MOCK_INTERVIEWS} />
      </main>
    </div>
  );
}
