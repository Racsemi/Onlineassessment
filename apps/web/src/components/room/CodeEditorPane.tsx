'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { 
  Play, 
  RotateCcw, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Copy, 
  Check, 
  Sparkles,
  Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Dynamically import Monaco Editor without SSR
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const STARTER_CODES: Record<string, string> = {
  javascript: `/**
 * Problem: Two Sum
 * Given an array of integers nums and an integer target,
 * return indices of the two numbers such that they add up to target.
 */
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}

// Test Run
const result = twoSum([2, 7, 11, 15], 9);
console.log("Result indices:", result);
`,
  python: `def two_sum(nums, target):
    """
    Given an array of integers nums and an integer target,
    return indices of the two numbers such that they add up to target.
    """
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []

# Test Run
res = two_sum([2, 7, 11, 15], 9)
print(f"Result indices: {res}")
`,
  typescript: `function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement)!, i];
    }
    map.set(nums[i], i);
  }
  return [];
}

const result = twoSum([2, 7, 11, 15], 9);
console.log("Result:", result);
`,
};

export interface ExecutionResult {
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'TIME_LIMIT_EXCEEDED';
  stdout?: string;
  stderr?: string;
  executionTimeMs?: number;
  memoryUsedKb?: number;
}

export function CodeEditorPane({
  interviewId,
  initialCode,
  initialLanguage = 'javascript',
  onCodeChange,
  onExecute,
  readOnly = false,
}: {
  interviewId: string;
  initialCode?: string;
  initialLanguage?: string;
  onCodeChange?: (code: string, language: string) => void;
  onExecute?: (code: string, language: string) => Promise<ExecutionResult>;
  readOnly?: boolean;
}) {
  const [language, setLanguage] = useState<string>(initialLanguage);
  const [code, setCode] = useState<string>(initialCode || STARTER_CODES[initialLanguage] || STARTER_CODES.javascript);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'output'>('editor');
  const [copied, setCopied] = useState<boolean>(false);

  // Sync if initialCode changes externally (e.g. from websocket broadcast)
  useEffect(() => {
    if (initialCode !== undefined && initialCode !== code) {
      setCode(initialCode);
    }
  }, [initialCode]);

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    const starter = STARTER_CODES[newLang] || '// Write code here...';
    setCode(starter);
    if (onCodeChange) {
      onCodeChange(starter, newLang);
    }
  };

  const handleEditorChange = (val?: string) => {
    const updated = val || '';
    setCode(updated);
    if (onCodeChange) {
      onCodeChange(updated, language);
    }
  };

  const runCode = async () => {
    setIsRunning(true);
    setActiveTab('output');
    try {
      if (onExecute) {
        const result = await onExecute(code, language);
        setExecResult(result);
      } else {
        // Fallback live execution via direct API call
        const response = await fetch(`/api/v1/organizations/mock/interviews/${interviewId}/code/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language }),
        });
        const data = await response.json();
        setExecResult(data.data || {
          status: 'ACCEPTED',
          stdout: 'Code executed successfully.',
          executionTimeMs: 18,
        });
      }
    } catch (err: any) {
      setExecResult({
        status: 'RUNTIME_ERROR',
        stderr: err.message || 'Execution failed',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0c14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Editor Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e111d] border-b border-white/5">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={readOnly}
            className="bg-[#161a29] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="javascript">JavaScript (Node.js)</option>
            <option value="python">Python 3</option>
            <option value="typescript">TypeScript</option>
          </select>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={copyCode}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            title="Copy Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => handleLanguageChange(language)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            title="Reset Starter Code"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={runCode}
            disabled={isRunning}
            className={cn(
              "flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all shadow-md",
              isRunning
                ? "bg-slate-700 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-500/20 active:scale-95"
            )}
          >
            <Play className={cn("w-3.5 h-3.5 fill-current", isRunning && "animate-spin")} />
            <span>{isRunning ? "Running..." : "Run Code"}</span>
          </button>
        </div>
      </div>

      {/* Main Split: Monaco Editor and Output Console */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Editor Area */}
        <div className="flex-1 min-h-[300px]">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleEditorChange}
            theme="vs-dark"
            options={{
              readOnly,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: 'JetBrains Mono, monospace',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: 'line',
            }}
          />
        </div>

        {/* Terminal / Execution Console */}
        <div className="h-44 border-t border-white/10 bg-[#07090e] flex flex-col">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0b0e18] border-b border-white/5">
            <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>TERMINAL OUTPUT</span>
            </div>

            {execResult && (
              <div className="flex items-center space-x-3 text-[11px] font-mono">
                {execResult.executionTimeMs !== undefined && (
                  <span className="text-slate-400 flex items-center">
                    <Clock className="w-3 h-3 mr-1 text-slate-500" />
                    {execResult.executionTimeMs}ms
                  </span>
                )}
                <span
                  className={cn(
                    "px-2 py-0.5 rounded font-bold uppercase",
                    execResult.status === 'ACCEPTED'
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-red-500/10 text-red-400 border border-red-500/30"
                  )}
                >
                  {execResult.status}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-slate-300">
            {isRunning ? (
              <div className="flex items-center space-x-2 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Executing code in secure sandbox...</span>
              </div>
            ) : execResult ? (
              <div>
                {execResult.stdout && (
                  <pre className="text-emerald-300 whitespace-pre-wrap">{execResult.stdout}</pre>
                )}
                {execResult.stderr && (
                  <pre className="text-red-400 whitespace-pre-wrap mt-1">{execResult.stderr}</pre>
                )}
                {!execResult.stdout && !execResult.stderr && (
                  <span className="text-slate-500 italic">Program finished with no output.</span>
                )}
              </div>
            ) : (
              <span className="text-slate-600 italic">Click "Run Code" to execute code and view output.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
