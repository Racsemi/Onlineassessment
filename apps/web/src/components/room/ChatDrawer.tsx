'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInterviewSocket } from '@/lib/socket';

export interface ChatMessage {
  id: string;
  senderName: string;
  role: 'CANDIDATE' | 'INTERVIEWER' | 'LEAD_INTERVIEWER' | 'OBSERVER';
  message: string;
  timestamp: string;
}

export function ChatDrawer({
  interviewId,
  currentUserName,
  currentUserRole,
}: {
  interviewId: string;
  currentUserName: string;
  currentUserRole: 'CANDIDATE' | 'INTERVIEWER' | 'LEAD_INTERVIEWER' | 'OBSERVER';
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const socket = getInterviewSocket();
    if (!socket.connected) {
      socket.connect();
    }

    // Join room
    socket.emit('join_room', {
      interviewId,
      role: currentUserRole,
      participantName: currentUserName,
    });

    // Listen for new messages
    const handleNewMessage = (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [interviewId, currentUserName, currentUserRole]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const socket = getInterviewSocket();
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderName: currentUserName,
      role: currentUserRole,
      message: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    socket.emit('send_message', {
      interviewId,
      message: newMsg.message,
      senderName: currentUserName,
      role: currentUserRole,
    });

    setMessages(prev => [...prev, newMsg]);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0c14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 bg-[#0e111d] border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span>In-Room Chat</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono bg-white/5 px-2 py-0.5 rounded">
          {messages.length} messages
        </span>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
            <MessageSquare className="w-8 h-8 mb-2 text-slate-600" />
            <p className="text-xs">No messages yet.</p>
            <p className="text-[11px] text-slate-600 mt-0.5">Send a message to everyone in the room.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderName === currentUserName;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm",
                  isMe
                    ? "ml-auto bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-none"
                    : "mr-auto bg-[#141829] text-slate-200 border border-white/5 rounded-bl-none"
                )}
              >
                <div className="flex items-center space-x-1.5 mb-1 text-[10px]">
                  <span className={cn("font-bold", isMe ? "text-indigo-200" : "text-cyan-400")}>
                    {msg.senderName}
                  </span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded font-mono text-[9px] uppercase",
                    msg.role === 'CANDIDATE' ? "bg-cyan-950/60 text-cyan-300" : "bg-purple-950/60 text-purple-300"
                  )}>
                    {msg.role === 'CANDIDATE' ? 'Candidate' : 'Interviewer'}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{msg.message}</p>
                <span className={cn("text-[9px] mt-1 self-end", isMe ? "text-indigo-200/70" : "text-slate-500")}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-2.5 bg-[#0e111d] border-t border-white/5 flex items-center space-x-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message to room..."
          className="flex-1 bg-[#161a29] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors"
          title="Send"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
