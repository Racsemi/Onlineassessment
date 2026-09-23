'use client';

import React, { useState } from 'react';
import { Lock, Save, Clock, Check, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NoteItem {
  id: string;
  content: string;
  createdAt: string;
  authorName: string;
}

export function NotesDrawer({
  interviewId,
  initialNotes = [],
  onSaveNote,
}: {
  interviewId: string;
  initialNotes?: NoteItem[];
  onSaveNote?: (content: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState<NoteItem[]>(initialNotes);
  const [currentText, setCurrentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentText.trim() || saving) return;

    setSaving(true);
    try {
      if (onSaveNote) {
        await onSaveNote(currentText);
      }
      const newNote: NoteItem = {
        id: `note_${Date.now()}`,
        content: currentText.trim(),
        createdAt: new Date().toISOString(),
        authorName: 'You',
      };
      setNotes(prev => [newNote, ...prev]);
      setCurrentText('');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0c14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 bg-[#0e111d] border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-semibold text-amber-300">
          <Lock className="w-4 h-4 text-amber-400" />
          <span>Private Interviewer Notes</span>
        </div>
        <span className="text-[10px] text-amber-400/80 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
          Confidential
        </span>
      </div>

      <div className="p-3 text-[11px] text-slate-400 bg-amber-950/20 border-b border-amber-500/10">
        Notes taken here are strictly visible only to approved interviewers of your organization and will never be shown to the candidate.
      </div>

      {/* Editor & Save Form */}
      <form onSubmit={handleSave} className="p-3 border-b border-white/5 flex flex-col space-y-2">
        <textarea
          rows={3}
          value={currentText}
          onChange={(e) => setCurrentText(e.target.value)}
          placeholder="Jot down technical observations, code complexity notes, soft skills..."
          className="w-full bg-[#141829] border border-white/10 rounded-xl p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400/50 resize-none font-sans"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">
            {savedSuccess && <span className="text-emerald-400 flex items-center"><Check className="w-3 h-3 mr-1" /> Note Saved!</span>}
          </span>
          <button
            type="submit"
            disabled={!currentText.trim() || saving}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs shadow-md shadow-amber-500/20 transition-all disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Add Note'}</span>
          </button>
        </div>
      </form>

      {/* Timestamped Notes Log */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {notes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
            <FileText className="w-8 h-8 mb-2 text-slate-600" />
            <p className="text-xs">No notes captured yet.</p>
          </div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="p-3 rounded-xl bg-[#0f1220] border border-white/5 text-xs space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-semibold text-slate-300">{note.authorName}</span>
                <span className="flex items-center font-mono text-slate-500">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{note.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
