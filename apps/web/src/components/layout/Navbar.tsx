'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Video, 
  Users, 
  Calendar, 
  BookOpen, 
  PlusCircle, 
  Briefcase,
  Layers,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Overview', icon: Layers },
    { href: '/candidates', label: 'Candidates & Pipeline', icon: Users },
    { href: '/interviews', label: 'Interviews & Calendar', icon: Calendar },
    { href: '/question-bank', label: 'Question Bank', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#090a0f]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all duration-300">
                <div className="w-full h-full bg-[#0d101a] rounded-[11px] flex items-center justify-center">
                  <Video className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform duration-200" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold tracking-tight text-white text-base">Racsemi</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    INTERVIEW
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono tracking-wider">ENTERPRISE SUITE</p>
              </div>
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive 
                        ? "bg-indigo-600/10 text-indigo-300 border border-indigo-500/20 shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", isActive ? "text-indigo-400" : "text-slate-400")} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center space-x-4">
            <Link
              href="/interviews/new"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 border border-indigo-400/30 active:scale-[0.98] transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Schedule Interview</span>
            </Link>

            <div className="h-6 w-px bg-white/10 hidden sm:block" />

            {/* User pill */}
            <div className="flex items-center space-x-3 pl-1">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-xs text-white ring-2 ring-indigo-500/20 shadow-inner">
                  AR
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#090a0f]" />
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold text-slate-200 leading-tight">Alice Recruiter</p>
                <p className="text-[11px] text-slate-400 leading-tight">Lead Tech Hiring</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
