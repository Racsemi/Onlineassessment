'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Filter, 
  Code2, 
  Sparkles, 
  Check, 
  FileText,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuestionBankEntry {
  id: string;
  title: string;
  category: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  description: string;
  sampleInput?: string;
  sampleOutput?: string;
  starterCode?: string;
}

const INITIAL_QUESTIONS: QuestionBankEntry[] = [
  {
    id: 'qb-1',
    title: 'Two Sum & Complement Hashing',
    category: 'Algorithms',
    difficulty: 'EASY',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.',
    sampleInput: 'nums = [2,7,11,15], target = 9',
    sampleOutput: '[0, 1]',
    starterCode: 'function twoSum(nums, target) {\n  // Implement O(n) solution using Map\n}',
  },
  {
    id: 'qb-2',
    title: 'LRU Cache Eviction Policy',
    category: 'Data Structures',
    difficulty: 'MEDIUM',
    description: 'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.\n\nImplement the LRUCache class with get(key) and put(key, value) running in O(1) average time complexity using a doubly-linked list and hash map.',
    sampleInput: '["LRUCache","put","put","get","put","get"]\n[[2],[1,1],[2,2],[1],[3,3],[2]]',
    sampleOutput: '[null,null,null,1,null,-1]',
    starterCode: 'class LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n  }\n  get(key) {}\n  put(key, value) {}\n}',
  },
  {
    id: 'qb-3',
    title: 'Distributed Rate Limiter (Token Bucket Algorithm)',
    category: 'System Design',
    difficulty: 'HARD',
    description: 'Design a high-throughput distributed rate limiter protecting microservices from denial-of-service surges.\n\nAddress sliding window logs vs token bucket, concurrency in multi-instance Redis clusters with Lua scripts, and client retry headers (429 Too Many Requests).',
  },
  {
    id: 'qb-4',
    title: 'Debounce & Throttle Implementation',
    category: 'Frontend Engineering',
    difficulty: 'MEDIUM',
    description: 'Implement robust debounce(fn, delay) and throttle(fn, interval) utilities in TypeScript supporting immediate invocation (leading edge) and cancellation handles.',
    starterCode: 'function debounce(fn, delay, immediate = false) {\n  // Implementation here\n}',
  },
  {
    id: 'qb-5',
    title: 'Resolving Architectural Deadlock & Technical Debt',
    category: 'Behavioral & Leadership',
    difficulty: 'MEDIUM',
    description: 'Tell me about a time when your engineering team disagreed fundamentally on a database migration or architecture approach. How did you resolve the conflict and establish alignment without sacrificing timeline?',
  },
];

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<QuestionBankEntry[]>(INITIAL_QUESTIONS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState('ALL');
  const [activeQuestion, setActiveQuestion] = useState<QuestionBankEntry>(INITIAL_QUESTIONS[0]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Algorithms');
  const [newDifficulty, setNewDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [newDescription, setNewDescription] = useState('');

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || q.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'ALL' || q.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    const created: QuestionBankEntry = {
      id: `qb-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      difficulty: newDifficulty,
      description: newDescription.trim(),
    };

    setQuestions(prev => [created, ...prev]);
    setActiveQuestion(created);
    setShowAddModal(false);
    setNewTitle('');
    setNewDescription('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Technical Question Bank</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Curate and deploy coding problems, system design challenges, and behavioral rubrics to live interview rooms.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-500/25 border border-indigo-400/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Question</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-4 rounded-2xl bg-[#0f111a] border border-white/5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search problems by keyword or description..."
              className="w-full bg-[#161a29] border border-white/10 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#161a29] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Categories</option>
              <option value="Algorithms">Algorithms</option>
              <option value="Data Structures">Data Structures</option>
              <option value="System Design">System Design</option>
              <option value="Frontend Engineering">Frontend Engineering</option>
              <option value="Behavioral & Leadership">Behavioral</option>
            </select>

            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="bg-[#161a29] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
        </div>

        {/* Master Detail View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
          {/* Question List */}
          <div className="lg:col-span-5 space-y-2.5">
            {filteredQuestions.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#0f111a] border border-dashed border-white/10 text-slate-500 text-xs">
                No matching questions found.
              </div>
            ) : (
              filteredQuestions.map(q => (
                <div
                  key={q.id}
                  onClick={() => setActiveQuestion(q)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col space-y-2",
                    activeQuestion.id === q.id
                      ? "bg-gradient-to-r from-indigo-950/40 to-[#121626] border-indigo-500/40 shadow-md shadow-indigo-500/10"
                      : "bg-[#0f111a] border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase",
                      q.difficulty === 'EASY' ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" :
                      q.difficulty === 'MEDIUM' ? "text-amber-400 bg-amber-500/10 border border-amber-500/20" :
                      "text-red-400 bg-red-500/10 border border-red-500/20"
                    )}>
                      {q.difficulty}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">{q.category}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white">{q.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{q.description}</p>
                </div>
              ))
            )}
          </div>

          {/* Detailed Question View */}
          <div className="lg:col-span-7 rounded-3xl bg-[#0f111a] border border-white/10 p-6 space-y-6">
            <div className="border-b border-white/5 pb-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className={cn(
                  "text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase",
                  activeQuestion.difficulty === 'EASY' ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" :
                  activeQuestion.difficulty === 'MEDIUM' ? "text-amber-400 bg-amber-500/10 border border-amber-500/20" :
                  "text-red-400 bg-red-500/10 border border-red-500/20"
                )}>
                  {activeQuestion.difficulty}
                </span>
                <span className="text-xs text-slate-400">{activeQuestion.category}</span>
              </div>
              <h2 className="text-xl font-bold text-white">{activeQuestion.title}</h2>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Problem Description</h4>
              <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                {activeQuestion.description}
              </p>
            </div>

            {activeQuestion.sampleInput && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sample Input / Output</h4>
                <div className="p-3 rounded-2xl bg-[#0a0d16] border border-white/5 font-mono text-xs space-y-1.5">
                  <div>
                    <span className="text-slate-500">Input: </span>
                    <span className="text-cyan-300">{activeQuestion.sampleInput}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Output: </span>
                    <span className="text-emerald-400">{activeQuestion.sampleOutput}</span>
                  </div>
                </div>
              </div>
            )}

            {activeQuestion.starterCode && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Starter Boilerplate</h4>
                <div className="p-3 rounded-2xl bg-[#0a0d16] border border-white/5 font-mono text-xs text-slate-300 overflow-x-auto">
                  <pre>{activeQuestion.starterCode}</pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Question Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-xl bg-[#0d101a] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-base font-bold text-white">Create Question Bank Problem</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateQuestion} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Problem Title *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Invert Binary Tree & Recursive Traversal"
                    className="w-full bg-[#161a29] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full bg-[#161a29] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Algorithms">Algorithms</option>
                      <option value="Data Structures">Data Structures</option>
                      <option value="System Design">System Design</option>
                      <option value="Frontend Engineering">Frontend Engineering</option>
                      <option value="Behavioral & Leadership">Behavioral & Leadership</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Difficulty</label>
                    <select
                      value={newDifficulty}
                      onChange={(e) => setNewDifficulty(e.target.value as any)}
                      className="w-full bg-[#161a29] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Problem Statement & Requirements *</label>
                  <textarea
                    rows={4}
                    required
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Explain the problem, constraints, edge cases, and runtime expectations..."
                    className="w-full bg-[#161a29] border border-white/10 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/25"
                  >
                    Save Problem
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
