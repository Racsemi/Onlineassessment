'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { CandidateKanban, CandidateCardData } from '@/components/pipeline/CandidateKanban';
import { Users, Plus, Download, Sparkles } from 'lucide-react';
import Link from 'next/link';

const MOCK_CANDIDATES: CandidateCardData[] = [
  {
    id: 'c1',
    name: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    role: 'Senior Frontend Engineer',
    appliedDate: '2026-09-18',
    stage: 'INTERVIEW_SCHEDULED',
    assessmentScore: 92,
    scheduledInterview: {
      id: 'int-101',
      scheduledStart: '2026-09-23T14:00:00Z',
      type: 'TECHNICAL',
    },
  },
  {
    id: 'c2',
    name: 'Devon Vance',
    email: 'devon.vance@example.com',
    role: 'Backend Distributed Systems',
    appliedDate: '2026-09-19',
    stage: 'INTERVIEW_SCHEDULED',
    assessmentScore: 88,
    scheduledInterview: {
      id: 'int-102',
      scheduledStart: '2026-09-23T16:30:00Z',
      type: 'SYSTEM_DESIGN',
    },
  },
  {
    id: 'c3',
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    role: 'Full Stack Engineer',
    appliedDate: '2026-09-20',
    stage: 'SCREENING',
    assessmentScore: 85,
  },
  {
    id: 'c4',
    name: 'Liam Gallagher',
    email: 'liam.g@example.com',
    role: 'Site Reliability Engineer',
    appliedDate: '2026-09-21',
    stage: 'APPLIED',
  },
  {
    id: 'c5',
    name: 'Priya Patel',
    email: 'priya.patel@example.com',
    role: 'Senior Frontend Engineer',
    appliedDate: '2026-09-15',
    stage: 'INTERVIEW_COMPLETED',
    assessmentScore: 96,
  },
  {
    id: 'c6',
    name: 'Elena Rostova',
    email: 'elena.r@example.com',
    role: 'Backend Distributed Systems',
    appliedDate: '2026-09-14',
    stage: 'OFFERED',
    assessmentScore: 94,
  },
];

export default function CandidatesPage() {
  const handleStageChange = async (candidateId: string, newStage: string) => {
    try {
      await fetch(`/api/v1/organizations/mock/interviews/candidates/${candidateId}/pipeline-stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStage: newStage }),
      }).catch(() => {});
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Candidate Recruitment Pipeline</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Manage candidates across recruitment stages from sourcing and technical interview scheduling to final hiring.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/interviews/new"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-500/25 border border-indigo-400/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Candidate</span>
            </Link>
          </div>
        </div>

        <CandidateKanban
          initialCandidates={MOCK_CANDIDATES}
          onStageChange={handleStageChange}
        />
      </main>
    </div>
  );
}
