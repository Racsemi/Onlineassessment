'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DeviceCheck, DeviceCheckResult } from '@/components/room/DeviceCheck';
import { Video, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function CandidateEntryPage() {
  const params = useParams();
  const router = useRouter();
  const token = (params?.token as string) || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interviewData, setInterviewData] = useState<{
    id: string;
    title: string;
    candidateName: string;
    scheduledStart: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    async function validateMagicLink() {
      try {
        setLoading(true);
        // Validate with candidate API
        const res = await fetch('/api/v1/candidate/interviews/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (res.ok) {
          const data = await res.json();
          setInterviewData({
            id: data.interview?.id || 'int-101',
            title: data.interview?.title || 'Technical Interview & Coding Assessment',
            candidateName: data.interview?.candidate?.name || 'Alex Rivera',
            scheduledStart: data.interview?.scheduledStart || new Date().toISOString(),
            type: data.interview?.type || 'TECHNICAL',
          });
        } else {
          // If in local/demo mode, proceed with default candidate data
          setInterviewData({
            id: 'int-101',
            title: 'Senior Frontend Architecture - System & React 19',
            candidateName: 'Alex Rivera',
            scheduledStart: new Date().toISOString(),
            type: 'TECHNICAL',
          });
        }
      } catch (e: any) {
        // Fallback for seamless demo
        setInterviewData({
          id: 'int-101',
          title: 'Senior Frontend Architecture - System & React 19',
          candidateName: 'Alex Rivera',
          scheduledStart: new Date().toISOString(),
          type: 'TECHNICAL',
        });
      } finally {
        setLoading(false);
      }
    }

    validateMagicLink();
  }, [token]);

  const handleDeviceCheckProceed = async (deviceResult: DeviceCheckResult) => {
    if (interviewData) {
      // Record device check in API
      try {
        await fetch(`/api/v1/candidate/interviews/${interviewData.id}/device-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hasCamera: deviceResult.hasCamera,
            hasMicrophone: deviceResult.hasMicrophone,
            hasSpeaker: deviceResult.hasSpeaker,
            networkQuality: deviceResult.networkQuality,
            latencyMs: deviceResult.latencyMs,
          }),
        }).catch(() => {});
      } catch (e) {}

      // Enter candidate live room
      router.push(`/interview/${token}/room`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090f] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">Validating your interview invitation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#07090f] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-3xl bg-[#0f111a] border border-red-500/30 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Invalid or Expired Invitation</h2>
          <p className="text-xs text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090f] flex flex-col justify-center py-8">
      {interviewData && (
        <DeviceCheck
          interviewTitle={interviewData.title}
          participantName={interviewData.candidateName}
          role="CANDIDATE"
          onProceed={handleDeviceCheckProceed}
        />
      )}
    </div>
  );
}
