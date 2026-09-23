'use client';

import React, { useState, useEffect } from 'react';
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  useTracks, 
  ParticipantTile,
  TrackRefContext,
  useLocalParticipant,
  useRemoteParticipants,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  ScreenShare, 
  PhoneOff, 
  Users, 
  Maximize2,
  Volume2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VideoStageProps {
  token: string;
  serverUrl?: string;
  roomName: string;
  onLeave?: () => void;
}

// Inner Stage Component rendered inside LiveKitRoom context
function LiveKitStageInner({ onLeave }: { onLeave?: () => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenShareTrack = tracks.find(t => t.source === Track.Source.ScreenShare);
  const cameraTracks = tracks.filter(t => t.source === Track.Source.Camera);

  const toggleMic = async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    }
  };

  const toggleCamera = async () => {
    if (localParticipant) {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    }
  };

  const toggleScreenShare = async () => {
    if (localParticipant) {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#07080e] relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      <RoomAudioRenderer />

      {/* Main Video Viewport */}
      <div className="flex-1 p-3 flex flex-col items-center justify-center min-h-0">
        {screenShareTrack ? (
          // Screen share active view
          <div className="w-full h-full flex flex-col gap-3">
            <div className="flex-1 relative rounded-2xl bg-black overflow-hidden border border-indigo-500/30">
              <TrackRefContext.Provider value={screenShareTrack}>
                <ParticipantTile />
              </TrackRefContext.Provider>
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-indigo-600/80 backdrop-blur-md text-white text-[11px] font-semibold flex items-center">
                <ScreenShare className="w-3.5 h-3.5 mr-1.5" />
                {screenShareTrack.participant.name || 'Participant'}'s Screen
              </div>
            </div>

            {/* Docked camera feeds below */}
            <div className="h-28 flex items-center justify-center space-x-3 overflow-x-auto py-1">
              {cameraTracks.map((trackRef) => (
                <div
                  key={`${trackRef.participant.identity}-${trackRef.source}`}
                  className="h-full aspect-video rounded-xl bg-[#0f121d] border border-white/10 overflow-hidden relative"
                >
                  <TrackRefContext.Provider value={trackRef}>
                    <ParticipantTile />
                  </TrackRefContext.Provider>
                  <div className="absolute bottom-1 left-1.5 text-[10px] text-white/90 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
                    {trackRef.participant.name || trackRef.participant.identity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Grid layout when no screen share
          <div className={cn(
            "w-full h-full grid gap-3",
            cameraTracks.length <= 1 ? "grid-cols-1" :
            cameraTracks.length === 2 ? "grid-cols-1 md:grid-cols-2" :
            "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          )}>
            {cameraTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-500">
                <Users className="w-12 h-12 mb-2 text-slate-600" />
                <span className="text-sm">Connecting to room...</span>
              </div>
            ) : (
              cameraTracks.map((trackRef) => {
                const isSpeaking = trackRef.participant.isSpeaking;

                return (
                  <div
                    key={`${trackRef.participant.identity}-${trackRef.source}`}
                    className={cn(
                      "relative rounded-2xl bg-[#0f121d] border overflow-hidden transition-all duration-300 flex items-center justify-center",
                      isSpeaking
                        ? "border-emerald-400 ring-2 ring-emerald-400/30 shadow-lg shadow-emerald-500/20"
                        : "border-white/10"
                    )}
                  >
                    <TrackRefContext.Provider value={trackRef}>
                      <ParticipantTile />
                    </TrackRefContext.Provider>

                    {/* Participant Name Badge */}
                    <div className="absolute bottom-3 left-3 flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium">
                      <span>{trackRef.participant.name || trackRef.participant.identity}</span>
                      {trackRef.participant.identity === localParticipant?.identity && (
                        <span className="text-[10px] text-indigo-400 font-bold">(You)</span>
                      )}
                    </div>

                    {/* Mute Indicator */}
                    {!trackRef.participant.isMicrophoneEnabled && (
                      <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-red-500/80 text-white backdrop-blur-md shadow-md">
                        <MicOff className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Floating Control Bar */}
      <div className="p-3 bg-[#0d101a] border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono">
            {remoteParticipants.length + 1} Participant{remoteParticipants.length > 0 ? 's' : ''}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={toggleMic}
            className={cn(
              "p-2.5 rounded-xl border transition-all duration-150 shadow-md",
              isMicrophoneEnabled
                ? "bg-slate-800 hover:bg-slate-700 text-white border-white/10"
                : "bg-red-500 hover:bg-red-600 text-white border-red-400"
            )}
            title={isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
          >
            {isMicrophoneEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={toggleCamera}
            className={cn(
              "p-2.5 rounded-xl border transition-all duration-150 shadow-md",
              isCameraEnabled
                ? "bg-slate-800 hover:bg-slate-700 text-white border-white/10"
                : "bg-red-500 hover:bg-red-600 text-white border-red-400"
            )}
            title={isCameraEnabled ? "Turn off Camera" : "Turn on Camera"}
          >
            {isCameraEnabled ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={toggleScreenShare}
            className={cn(
              "p-2.5 rounded-xl border transition-all duration-150 shadow-md",
              isScreenShareEnabled
                ? "bg-cyan-500 text-black border-cyan-300 font-bold"
                : "bg-slate-800 hover:bg-slate-700 text-white border-white/10"
            )}
            title={isScreenShareEnabled ? "Stop Sharing Screen" : "Share Screen"}
          >
            <ScreenShare className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-white/10 mx-1" />

          {/* Leave Button */}
          <button
            type="button"
            onClick={onLeave}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors shadow-md shadow-red-600/30"
            title="Leave Interview Room"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Leave</span>
          </button>
        </div>

        <div className="w-20" />
      </div>
    </div>
  );
}

// Fallback Mock Stage if livekit server token is in local demo mode
function MockVideoStage({ onLeave }: { onLeave?: () => void }) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  return (
    <div className="flex flex-col h-full bg-[#07080e] relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      <div className="flex-1 p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Mock Interviewer Feed */}
        <div className="relative rounded-2xl bg-gradient-to-br from-[#121626] to-[#0a0d16] border border-white/10 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-2xl text-white shadow-xl shadow-indigo-500/20 mb-3 ring-4 ring-indigo-500/30">
            AR
          </div>
          <h4 className="text-sm font-semibold text-white">Alice Recruiter (Lead Interviewer)</h4>
          <span className="text-[11px] text-emerald-400 flex items-center mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
            Audio connected
          </span>
          <div className="absolute bottom-3 left-3 text-xs text-slate-400 bg-black/50 px-2 py-0.5 rounded">
            Interviewer
          </div>
        </div>

        {/* Mock Candidate Feed */}
        <div className="relative rounded-2xl bg-gradient-to-br from-[#121626] to-[#0a0d16] border border-white/10 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-600 to-teal-500 flex items-center justify-center font-bold text-2xl text-white shadow-xl shadow-cyan-500/20 mb-3 ring-4 ring-cyan-500/30">
            CD
          </div>
          <h4 className="text-sm font-semibold text-white">Candidate</h4>
          <span className="text-[11px] text-emerald-400 flex items-center mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
            Live Video Active
          </span>
          <div className="absolute bottom-3 left-3 text-xs text-slate-400 bg-black/50 px-2 py-0.5 rounded">
            Candidate
          </div>
        </div>
      </div>

      <div className="p-3 bg-[#0d101a] border-t border-white/10 flex items-center justify-between">
        <div className="text-xs text-slate-400 font-mono">2 Participants</div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setMicOn(!micOn)}
            className={cn("p-2.5 rounded-xl border", micOn ? "bg-slate-800 text-white" : "bg-red-500 text-white")}
          >
            {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setCamOn(!camOn)}
            className={cn("p-2.5 rounded-xl border", camOn ? "bg-slate-800 text-white" : "bg-red-500 text-white")}
          >
            {camOn ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>
          <button onClick={onLeave} className="px-3 py-2 rounded-xl bg-red-600 text-white font-semibold text-xs">
            Leave
          </button>
        </div>
        <div className="w-20" />
      </div>
    </div>
  );
}

export function VideoStage({
  token,
  serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://livekit.racsemi.com',
  roomName,
  onLeave,
}: VideoStageProps) {
  // If no token or simulated token, render responsive interactive fallback
  if (!token || token.startsWith('mock_') || serverUrl.includes('mock')) {
    return <MockVideoStage onLeave={onLeave} />;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      data-lk-theme="default"
      className="h-full w-full"
    >
      <LiveKitStageInner onLeave={onLeave} />
    </LiveKitRoom>
  );
}
