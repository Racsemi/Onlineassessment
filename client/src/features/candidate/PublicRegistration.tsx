import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, ShieldCheck, AlertCircle, Zap } from 'lucide-react';
import api from '../../lib/axios';

const PublicRegistration = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        const res = await api.get(`/assessments/public/${id}`);
        setAssessment(res.data);
      } catch {
        setError('Assessment not found or is no longer available.');
      } finally {
        setLoading(false);
      }
    };
    fetchAssessment();
  }, [id]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !agreedToTerms) return;
    setRegistering(true);
    setError('');
    try {
      const payload = {
        assessmentId: id, name, email,
        phone: customData.phone, college: customData.college,
        branch: customData.branch,
        cgpa: customData.cgpa ? parseFloat(customData.cgpa) : null,
        customFields: customData
      };
      const res = await api.post('/candidates/register', payload);
      navigate(`/test/${res.data.token}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)' }}>
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          <span className="text-slate-400 text-sm">Loading assessment…</span>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
          <AlertCircle size={48} className="mx-auto text-danger mb-4" />
          <h2 className="text-2xl font-bold text-dark mb-2">Unavailable</h2>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)' }}>

      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
      </div>

      <div className="w-full max-w-xl relative z-10 animate-fade-in-up">

        {/* Card */}
        <div className="card-glass shadow-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>

          {/* Hero Header */}
          <div className="px-8 pt-8 pb-6 border-b border-white/10" style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(139,92,246,0.15))' }}>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <Zap size={18} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-indigo-300 uppercase tracking-wider">Online Assessment</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{assessment.title}</h1>
            {assessment.description && (
              <p className="text-slate-300 text-sm leading-relaxed">{assessment.description}</p>
            )}
          </div>

          {/* Form body */}
          <div className="px-8 py-7 bg-white">
            <h2 className="text-lg font-bold text-dark mb-1">Candidate Registration</h2>
            <p className="text-sm text-slate-500 mb-6">Please fill in your details accurately to proceed.</p>

            {error && (
              <div className="mb-5 flex items-center space-x-3 bg-red-50 text-red-700 border border-red-200 p-3.5 rounded-xl text-sm">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="form-label">Full Name <span className="text-danger">*</span></label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)}
                    className="form-input" placeholder="John Doe" />
                </div>
                <div>
                  <label className="form-label">Email Address <span className="text-danger">*</span></label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="form-input" placeholder="john@example.com" />
                </div>

                {assessment.settings?.registrationForm && Array.isArray(assessment.settings.registrationForm) &&
                  assessment.settings.registrationForm.map((field: any) => (
                    <div key={field.id}>
                      <label className="form-label">{field.label} {field.required && <span className="text-danger">*</span>}</label>
                      {field.type === 'select' ? (
                        <select required={field.required} value={customData[field.name] || ''}
                          onChange={e => setCustomData({ ...customData, [field.name]: e.target.value })}
                          className="form-input">
                          <option value="">Select…</option>
                          {field.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : field.type === 'radio' ? (
                        <div className="flex flex-wrap gap-3 mt-1">
                          {field.options?.map((opt: string) => (
                            <label key={opt} className={`flex items-center space-x-2 px-4 py-2 border rounded-lg cursor-pointer text-sm transition-all ${customData[field.name] === opt ? 'border-primary bg-indigo-50 text-primary font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                              <input type="radio" name={field.name} value={opt} required={field.required}
                                checked={customData[field.name] === opt}
                                onChange={e => setCustomData({ ...customData, [field.name]: e.target.value })}
                                className="sr-only" />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input type={field.type === 'number' ? 'number' : 'text'} required={field.required}
                          value={customData[field.name] || ''}
                          onChange={e => setCustomData({ ...customData, [field.name]: e.target.value })}
                          className="form-input" />
                      )}
                    </div>
                  ))
                }
              </div>

              {/* Terms */}
              <div className="indigo-gradient-bg border border-indigo-100 rounded-xl p-4">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${agreedToTerms ? 'bg-primary border-primary' : 'border-slate-300 bg-white'}`}
                    onClick={() => setAgreedToTerms(v => !v)}>
                    {agreedToTerms && <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <input type="checkbox" required checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="sr-only" />
                  <span className="text-sm text-slate-700">
                    I agree to the <span className="text-primary font-semibold">Terms and Conditions</span> and acknowledge that my information will be processed in accordance with the Privacy Policy. I will not share my screen or use unauthorized materials.
                  </span>
                </label>
              </div>

              <button type="submit" disabled={registering || !agreedToTerms}
                className="btn-primary w-full flex items-center justify-center space-x-2 py-3 disabled:opacity-60 disabled:cursor-not-allowed">
                {registering
                  ? <><Loader2 size={18} className="animate-spin" /><span>Registering…</span></>
                  : <><span>Begin Assessment</span><ArrowRight size={18} /></>
                }
              </button>
            </form>

            <div className="mt-5 flex items-center justify-center space-x-2 text-xs text-slate-400">
              <ShieldCheck size={14} />
              <span>Your data is encrypted and secure</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicRegistration;
