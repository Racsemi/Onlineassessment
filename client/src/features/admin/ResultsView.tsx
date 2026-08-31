import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Filter, ShieldAlert, X, Eye } from 'lucide-react';
import api from '../../lib/axios';

const ResultsView = () => {
  const { id } = useParams();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await api.get(`/assessments/${id}/results`);
        setResults(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [id]);

  const handleExportCsv = () => {
    if (results.length === 0) return;
    const headers = ['Candidate Name', 'Email', 'Score', 'Percentage', 'Status', 'Integrity Flags'];
    const rows = results.map(r => [
      `"${r.name}"`, 
      `"${r.email}"`, 
      r.score, 
      `${r.percentage}%`, 
      r.status, 
      r.integrityEventsCount
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "assessment_results.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-dark">Assessment Results</h1>
          <p className="text-gray-500 mt-1">Review candidate scores and proctoring logs</p>
        </div>
        <button 
          onClick={handleExportCsv}
          className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
        >
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search candidates..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>
        
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-sm">
              <th className="px-6 py-4 font-medium">Candidate</th>
              <th className="px-6 py-4 font-medium">Score</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Integrity Events</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-dark">{r.name}</div>
                  <div className="text-sm text-gray-500">{r.email}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-dark">{r.score} / {r.maxScore || 100}</div>
                  <div className="text-xs text-gray-500">{typeof r.percentage === 'number' ? r.percentage.toFixed(1) : r.percentage}%</div>
                  {r.codingSubmissions?.length > 0 && (
                    <div className="text-xs text-purple-600 mt-1 font-medium">🖥️ {r.codingSubmissions.length} coding submission(s)</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    r.status === 'SHORTLISTED' ? 'bg-success/10 text-success' :
                    r.status === 'UNDER_REVIEW' ? 'bg-warning/10 text-warning' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {r.integrityEventsCount > 0 ? (
                    <div className="flex items-center text-danger font-medium text-sm">
                      <ShieldAlert size={16} className="mr-1.5" />
                      {r.integrityEventsCount} flags
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">Clean</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setSelectedCandidate(r)}
                    className="text-sm font-medium text-primary hover:text-blue-700 transition-colors inline-flex items-center space-x-1"
                  >
                    <Eye size={16} />
                    <span>View Details</span>
                  </button>
                </td>
              </tr>
            ))}
            {results.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No candidates have completed this assessment yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Candidate Details Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-bold text-dark">{selectedCandidate.name}</h2>
                <p className="text-sm text-gray-500">{selectedCandidate.email}</p>
              </div>
              <button 
                onClick={() => setSelectedCandidate(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <h3 className="text-lg font-bold text-dark mb-4 border-b pb-2">Integrity Report</h3>
              {selectedCandidate.integrityEvents?.length > 0 ? (
                <div className="space-y-6">
                  {selectedCandidate.integrityEvents.map((event: any, idx: number) => (
                    <div key={idx} className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 text-danger mb-2">
                          <ShieldAlert size={20} />
                          <h4 className="font-bold uppercase tracking-wider text-sm">{event.eventType}</h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          <strong>Timestamp:</strong> {new Date(event.timestamp).toLocaleString()}
                        </p>
                        <p className="text-sm text-red-800">
                          {event.eventType === 'FULLSCREEN_EXIT' && "The candidate exited full-screen mode."}
                          {event.eventType === 'TAB_SWITCH' && "The candidate switched to a different browser tab or minimized the window."}
                          {event.eventType === 'WINDOW_BLUR' && "The assessment window lost focus."}
                          {event.eventType === 'COPY' && "The candidate attempted to copy text."}
                          {event.eventType === 'PASTE' && "The candidate attempted to paste text."}
                        </p>
                      </div>
                      
                      {/* Screenshot Thumbnail */}
                      <div className="w-full md:w-64 flex-shrink-0 bg-black rounded-lg border-2 border-red-200 overflow-hidden relative group">
                        {event.screenshot ? (
                          <>
                            <img src={event.screenshot} alt="Proctoring Snapshot" className="w-full h-auto object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                              Camera Snapshot
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-32 flex items-center justify-center text-gray-500 bg-gray-900 text-sm">
                            No Snapshot Available
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-success/5 border border-success/20 rounded-xl">
                  <ShieldAlert size={48} className="mx-auto text-success mb-3" />
                  <h3 className="text-lg font-bold text-success mb-1">Clean Record</h3>
                  <p className="text-gray-600">No integrity flags were recorded during this session.</p>
                </div>
              )}
              {/* Coding Submissions Section */}
              {selectedCandidate.codingSubmissions?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-bold text-dark mb-4 border-b pb-2">Coding Submissions</h3>
                  <div className="space-y-3">
                    {selectedCandidate.codingSubmissions.map((cs: any, idx: number) => (
                      <div key={idx} className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-dark">{cs.questionTitle || 'Coding Question'}</div>
                          <div className="text-sm text-gray-500 mt-1">Language: <span className="font-mono font-bold text-purple-700">{cs.language}</span></div>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                            cs.status === 'SUBMITTED' ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {cs.status}
                          </span>
                          <div className="text-sm text-gray-500 mt-1">
                            Score: {cs.score ?? 'Pending'} / {cs.maxScore}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsView;
