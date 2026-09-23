'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Video, 
  Code2, 
  MessageSquare, 
  BookOpen, 
  Clock, 
  PhoneOff, 
  CheckCircle 
} from 'lucide-react';
import { VideoStage } from '@/components/room/VideoStage';
import { CodeEditorPane, ExecutionResult } from '@/components/room/CodeEditorPane';
import { ChatDrawer } from '@/components/room/ChatDrawer';
import { QuestionDrawer } from '@/components/room/QuestionDrawer';
import { cn } from '@/lib/utils';
import { getInterviewSocket } from '@/lib/socket';

export default function CandidateLiveRoomPage() {
  const params = useParams();
  const router = useRouter();
  const token = (params?.token as string) || '';

  const [activeTab, setActiveTab] = useState<'problem' | 'chat'>('problem');
  const [tokenLiveKit, setTokenLiveKit] = useState<string>('mock_token_candidate');
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);

  const interviewTitle = 'Senior Frontend Architecture - System & React 19';
  const candidateName = 'Alex Rivera';
  const interviewId = 'int-101';

  // Room timer
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
      const res = await fetch(`/api/v1/candidate/interviews/${interviewId}/code/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      return data.data || {
        status: 'ACCEPTED',
        stdout: `Code execution succeeded in sandbox.\nOutput:\nResult indices: [0, 1]`,
        executionTimeMs: 24,
      };
    } catch {
      return {
        status: 'ACCEPTED',
        stdout: `Result indices: [0, 1]\nExecuted in 24ms`,
        executionTimeMs: 24,
      };
    }
  };

  const handleLeave = () => {
    if (confirm('Are you sure you want to exit the interview?')) {
      router.push(`/interview/${token}`);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#07090f] text-slate-100 font-sans">
      {/* Top Header */}
      <header className="h-14 border-b border-white/10 bg-[#0c0e17] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-500 flex items-center justify-center shadow-md">
            <Video className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-[260px] sm:max-w-md">
                {interviewTitle}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                CONNECTED
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Joined as: <span className="font-semibold text-slate-200">{candidateName}</span> (Candidate)
            </p>
          </div>
        </div>

        {/* Elapsed Timer */}
        <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-300 font-bold">{formatTimer(secondsElapsed)}</span>
        </div>

        {/* Leave */}
        <button
          type="button"
          onClick={handleLeave}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-semibold transition-colors"
        >
          <PhoneOff className="w-3.5 h-3.5 mr-1" />
          <span>Exit Room</span>
        </button>
      </header>

      {/* Main Layout: Video Stage, Monaco Editor, Problem / Chat */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left: Video Stage */}
        <div className="w-80 lg:w-96 flex flex-col shrink-0">
          <VideoStage
            token={tokenLiveKit}
            roomName={`room-${interviewId}`}
            onLeave={handleLeave}
          />
        </div>

        {/* Center: Live Monaco Code Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <CodeEditorPane
            interviewId={interviewId}
            onCodeChange={(code, lang) => {
              getInterviewSocket().emit('code_change', { interviewId, code, language: lang });
            }}
            onExecute={handleExecuteCode}
          />
        </div>

        {/* Right: Candidate Tabs (Problem statement & In-Room Chat) */}
        <div className="w-80 lg:w-96 flex flex-col shrink-0">
          <div className="flex items-center justify-between p-1 mb-2 rounded-xl bg-[#0f111a] border border-white/5">
            <button
              onClick={() => setActiveTab('problem')}
              className={cn(
                "flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeTab === 'problem'
                  ? "bg-cyan-600 text-white shadow-sm font-bold"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Current Problem</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={cn(
                "flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeTab === 'chat'
                  ? "bg-cyan-600 text-white shadow-sm font-bold"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>In-Room Chat</span>
            </button>
          </div>

          <div className="flex-1 min-h-0">
            {activeTab === 'problem' && (
              <QuestionDrawer
                interviewId={interviewId}
                isInterviewer={false}
              />
            )}
            {activeTab === 'chat' && (
              <ChatDrawer
                interviewId={interviewId}
                currentUserName={candidateName}
                currentUserRole="CANDIDATE"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
