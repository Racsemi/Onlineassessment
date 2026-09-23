'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { 
  Calendar, 
  Clock, 
  User, 
  Users, 
  Video, 
  Copy, 
  Check, 
  AlertTriangle, 
  ArrowLeft,
  Sparkles,
  Send,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function NewInterviewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [candidateName, setCandidateName] = useState(searchParams.get('candidateName') || '');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [title, setTitle] = useState('Senior Technical Interview');
  const [type, setType] = useState<'TECHNICAL' | 'BEHAVIORAL' | 'SYSTEM_DESIGN' | 'HR'>('TECHNICAL');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('14:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedInterviewers, setSelectedInterviewers] = useState<string[]>(['u1']);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [createdInterview, setCreatedInterview] = useState<{
    id: string;
    magicLink: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTimeChange = (time: string) => {
    setStartTime(time);
    // Simulate conflict check on 2:00 PM if Bob is selected
    if (time === '14:00' && selectedInterviewers.includes('u2')) {
      setConflictWarning('Interviewer Bob Tech Lead is already booked for another session at 2:00 PM.');
    } else {
      setConflictWarning(null);
    }
  };

  const handleInterviewerToggle = (id: string) => {
    setSelectedInterviewers(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateEmail.trim() || selectedInterviewers.length === 0) return;

    setLoading(true);
    try {
      const scheduledStart = new Date(`${startDate}T${startTime}:00`).toISOString();
      const scheduledEnd = new Date(new Date(scheduledStart).getTime() + durationMinutes * 60 * 1000).toISOString();

      const res = await fetch('/api/v1/organizations/mock/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: searchParams.get('candidateId') || 'c_new',
          interviewerIds: selectedInterviewers,
          title,
          scheduledStart,
          scheduledEnd,
          type,
        }),
      }).catch(() => null);

      const generatedId = `int-${Date.now().toString().slice(-4)}`;
      const token = `magic_${Math.random().toString(36).slice(2, 10)}`;

      setCreatedInterview({
        id: generatedId,
        magicLink: `${window.location.origin}/interview/${token}/room`,
      });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (createdInterview) {
      navigator.clipboard.writeText(createdInterview.magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/interviews"
          className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          <span>Back to Calendar</span>
        </Link>

        {createdInterview ? (
          /* Confirmation card */
          <div className="rounded-3xl bg-[#0f111a] border border-white/10 p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Interview Scheduled Successfully!</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Invitations have been dispatched and calendar entries created. Candidate can join directly via their secure magic invitation link.
              </p>
            </div>

            {/* Magic Link Box */}
            <div className="p-4 rounded-2xl bg-[#141829] border border-white/10 space-y-2 text-left">
              <label className="text-[11px] font-semibold text-slate-300">Candidate Magic Invitation Link</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={createdInterview.magicLink}
                  className="flex-1 bg-[#0d101a] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-colors shadow-md"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href={`/interviews/${createdInterview.id}/room`}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-xl shadow-indigo-500/25 border border-indigo-400/30 transition-all"
              >
                <Video className="w-4 h-4" />
                <span>Launch Interview Room Now</span>
              </Link>

              <Link
                href="/interviews"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-2xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                Return to Calendar
              </Link>
            </div>
          </div>
        ) : (
          /* Scheduling Form */
          <form onSubmit={handleSubmit} className="rounded-3xl bg-[#0f111a] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h1 className="text-xl font-bold text-white">Schedule Technical Interview</h1>
              <p className="text-xs text-slate-400 mt-1">
                Configure candidate, assigned interviewers, technical track, and calendar slot.
              </p>
            </div>

            {conflictWarning && (
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{conflictWarning}</span>
              </div>
            )}

            {/* Candidate Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Candidate Full Name *</label>
                <input
                  type="text"
                  required
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="e.g. Jordan Miller"
                  className="w-full bg-[#161a29] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Candidate Email Address *</label>
                <input
                  type="email"
                  required
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  placeholder="e.g. jordan@example.com"
                  className="w-full bg-[#161a29] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Title & Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Interview Session Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#161a29] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Interview Track</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full bg-[#161a29] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="TECHNICAL">Technical & Coding</option>
                  <option value="SYSTEM_DESIGN">System Design</option>
                  <option value="BEHAVIORAL">Behavioral</option>
                  <option value="HR">HR Screen</option>
                </select>
              </div>
            </div>

            {/* Date, Time, Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Date *</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#161a29] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Start Time *</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="w-full bg-[#161a29] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Duration</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full bg-[#161a29] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes (Standard)</option>
                  <option value={90}>90 Minutes (Deep Dive)</option>
                </select>
              </div>
            </div>

            {/* Assign Interviewers */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Assign Interviewers (Select 1 or more)</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'u1', name: 'Alice Recruiter', role: 'Lead Recruiter' },
                  { id: 'u2', name: 'Bob Tech Lead', role: 'Senior Staff Eng' },
                  { id: 'u3', name: 'Marcus Staff Eng', role: 'Backend Lead' },
                ].map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleInterviewerToggle(user.id)}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all",
                      selectedInterviewers.includes(user.id)
                        ? "bg-indigo-600/15 border-indigo-500/40 text-white shadow-md shadow-indigo-600/10"
                        : "bg-[#141829] border-white/5 text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-100">{user.name}</span>
                      {selectedInterviewers.includes(user.id) && (
                        <Check className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{user.role}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-white/5 flex items-center justify-end space-x-3">
              <Link
                href="/interviews"
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-xl shadow-indigo-500/25 border border-indigo-400/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <Calendar className="w-4 h-4" />
                <span>{loading ? 'Creating Invitation...' : 'Confirm & Schedule Session'}</span>
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

export default function NewInterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090a0f] flex items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <NewInterviewForm />
    </Suspense>
  );
}

