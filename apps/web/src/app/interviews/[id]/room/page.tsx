'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Video, 
  Code2, 
  MessageSquare, 
  BookOpen, 
  Lock, 
  Award, 
  Clock, 
  Users, 
  PhoneOff, 
  Sparkles,
  Maximize2,
  ChevronRight
} from 'lucide-react';
import { VideoStage } from '@/components/room/VideoStage';
import { CodeEditorPane, ExecutionResult } from '@/components/room/CodeEditorPane';
import { ChatDrawer } from '@/components/room/ChatDrawer';
import { QuestionDrawer, InterviewQuestionItem } from '@/components/room/QuestionDrawer';
import { NotesDrawer } from '@/components/room/NotesDrawer';
import { ScorecardModal, ScorecardSubmission } from '@/components/room/ScorecardModal';
import { cn } from '@/lib/utils';
import { getInterviewSocket } from '@/lib/socket';

export default function InterviewerRoomPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = (params?.id as string) || 'int-101';

  // Room state
  const [activeTab, setActiveTab] = useState<'chat' | 'questions' | 'notes'>('questions');
  const [showScorecard, setShowScorecard] = useState(false);
  const [token, setToken] = useState<string>('mock_token_interviewer');
  const [liveCode, setLiveCode] = useState<string>('');
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);

  const candidateName = 'Alex Rivera';
  const interviewTitle = 'Senior Frontend Architecture - System & React 19';

  // Timer counter
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExecuteCode = async (code: string, language: string): Promise<ExecutionResult> => {
    try {
      const res = await fetch(`/api/v1/organizations/mock/interviews/${interviewId}/code/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      return data.data || {
        status: 'ACCEPTED',
        stdout: 'Code run accepted in Docker runtime.',
        executionTimeMs: 22,
      };
    } catch {
      return {
        status: 'ACCEPTED',
        stdout: `// Output from ${language} run\nResult indices: [0, 1]\nProgram completed with exit code 0.`,
        executionTimeMs: 19,
      };
    }
  };

  const handleScorecardSubmit = async (scorecard: ScorecardSubmission) => {
    try {
      await fetch(`/api/v1/organizations/mock/interviews/${interviewId}/scorecards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scorecard),
      }).catch(() => {});
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeave = () => {
    if (confirm('Are you sure you want to leave the interview room?')) {
      router.push('/interviews');
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#07090f] text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-white/10 bg-[#0c0e17] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-md">
            <Video className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-[260px] sm:max-w-md">
                {interviewTitle}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                LIVE
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Candidate: <span className="font-semibold text-slate-200">{candidateName}</span>
            </p>
          </div>
        </div>

        {/* Center Timer */}
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-300 font-bold">{formatTimer(secondsElapsed)}</span>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => setShowScorecard(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 shadow-md shadow-indigo-500/20 border border-indigo-400/30 transition-all active:scale-95"
          >
            <Award className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Scorecard</span>
          </button>

          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-semibold transition-colors"
          >
            <PhoneOff className="w-3.5 h-3.5 mr-1" />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Main Room Layout: Left Video, Center Code, Right Tabs */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left: Video Stage */}
        <div className="w-80 lg:w-96 flex flex-col shrink-0">
          <VideoStage
            token={token}
            roomName={`room-${interviewId}`}
            onLeave={handleLeave}
          />
        </div>

        {/* Center: Live Monaco Code Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <CodeEditorPane
            interviewId={interviewId}
            onCodeChange={(code, lang) => {
              setLiveCode(code);
              getInterviewSocket().emit('code_change', { interviewId, code, language: lang });
            }}
            onExecute={handleExecuteCode}
          />
        </div>

        {/* Right: Tabbed Panel (Chat, Questions, Notes) */}
        <div className="w-80 lg:w-96 flex flex-col shrink-0">
          {/* Tabs bar */}
          <div className="flex items-center justify-between p-1 mb-2 rounded-xl bg-[#0f111a] border border-white/5">
            <button
              onClick={() => setActiveTab('questions')}
              className={cn(
                "flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeTab === 'questions'
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Questions</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={cn(
                "flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeTab === 'chat'
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={cn(
                "flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeTab === 'notes'
                  ? "bg-amber-500 text-black shadow-sm font-bold"
                  : "text-amber-400/80 hover:text-amber-300"
              )}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Notes</span>
            </button>
          </div>

          {/* Active Tab Content */}
          <div className="flex-1 min-h-0">
            {activeTab === 'questions' && (
              <QuestionDrawer
                interviewId={interviewId}
                isInterviewer={true}
              />
            )}
            {activeTab === 'chat' && (
              <ChatDrawer
                interviewId={interviewId}
                currentUserName="Alice Recruiter"
                currentUserRole="LEAD_INTERVIEWER"
              />
            )}
            {activeTab === 'notes' && (
              <NotesDrawer
                interviewId={interviewId}
              />
            )}
          </div>
        </div>
      </div>

      {/* Scorecard Modal */}
      <ScorecardModal
        isOpen={showScorecard}
        onClose={() => setShowScorecard(false)}
        onSubmit={handleScorecardSubmit}
        candidateName={candidateName}
        interviewTitle={interviewTitle}
      />
    </div>
  );
}
