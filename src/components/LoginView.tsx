import {
  Activity,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const LoginView: React.FC = () => {
  const {
    isSupabaseMode,
    login,
    loginDemo,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    error,
    clearError,
  } = useApp();

  // Supabase Auth state (preselect tab from ?mode=signup or ?mode=signin)
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>(() => {
    if (typeof window !== 'undefined') {
      const mode = new URLSearchParams(window.location.search).get('mode');
      if (mode === 'signup') return 'signup';
    }
    return 'signin';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Legacy Intervals.icu state (when Supabase env vars are not set)
  const [apiKey, setApiKey] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSupabaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    clearError();

    if (!email.trim() || !password) {
      setLocalError('Please enter your email and password.');
      return;
    }
    if (authTab === 'signup' && password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (authTab === 'signin') {
        await signInWithEmail(email, password);
      } else {
        const res = await signUpWithEmail(email, password, fullName);
        if (res.needsEmailConfirmation) {
          setSuccessMessage(
            'Account creato! Controlla la tua email per confermare la registrazione prima di accedere.'
          );
          setAuthTab('signin');
        }
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Autenticazione fallita. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLocalError(null);
    clearError();
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setLocalError(err?.message || 'Impossibile accedere con Google.');
      setLoading(false);
    }
  };

  const handleLegacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setLocalError('Please enter your Intervals.icu API Key.');
      return;
    }
    setLocalError(null);
    clearError();
    setLoading(true);

    try {
      await login(apiKey.trim(), athleteId.trim() || '0');
    } catch (err: any) {
      setLocalError(err.message || 'Connection failed. Please check your API key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#131316] text-white selection:bg-[#00E5A3]/20">
      <div className="w-full max-w-md bg-[#1F2025] border border-[#383941] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow ambient background circle */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-[#00E5A3]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-[#FC5200]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Hero Brand Header */}
        <div className="flex flex-col items-center text-center mb-6 relative">
          <div className="w-16 h-16 rounded-2xl bg-[#00E5A3]/10 border border-[#00E5A3]/30 flex items-center justify-center text-[#00E5A3] mb-4 shadow-lg shadow-[#00E5A3]/5">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            VELOPULSE
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xs leading-relaxed">
            {isSupabaseMode
              ? 'Sign in to sync Intervals.icu, Strava, and Garmin .FIT files'
              : 'Next-gen athletic performance & recovery dashboard'}
          </p>
        </div>

        {/* Success notification */}
        {successMessage && (
          <div className="bg-[#00E5A3]/10 border border-[#00E5A3]/30 text-[#00E5A3] p-3.5 rounded-xl text-xs font-semibold mb-4 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error notification */}
        {(localError || error) && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs font-semibold mb-4">
            {localError || error}
          </div>
        )}

        {isSupabaseMode ? (
          <>
            {/* Sign In / Sign Up Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#26272D] border border-[#383941] rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('signin');
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                className={`py-2 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all ${
                  authTab === 'signin'
                    ? 'bg-[#00E5A3] text-[#131316]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('signup');
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                className={`py-2 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all ${
                  authTab === 'signup'
                    ? 'bg-[#00E5A3] text-[#131316]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSupabaseSubmit} className="space-y-4">
              {authTab === 'signup' && (
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alex Rider"
                      className="w-full bg-[#2F3037] border border-[#383941] focus:border-[#00E5A3] focus:outline-none rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-slate-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Email
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (localError) setLocalError(null);
                    }}
                    placeholder="you@example.com"
                    className="w-full bg-[#2F3037] border border-[#383941] focus:border-[#00E5A3] focus:outline-none rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-slate-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={authTab === 'signin' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (localError) setLocalError(null);
                    }}
                    placeholder={authTab === 'signup' ? 'Minimum 6 characters' : '••••••••'}
                    className="w-full bg-[#2F3037] border border-[#383941] focus:border-[#00E5A3] focus:outline-none rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#00E5A3] hover:bg-[#00c98f] text-[#131316] font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl shadow-lg shadow-[#00E5A3]/20 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span className="inline-block animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    {authTab === 'signin' ? 'Sign In to VeloPulse' : 'Create Account'}
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#383941]" />
              </div>
              <span className="relative bg-[#1F2025] px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Or
              </span>
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 bg-[#2F3037] hover:bg-[#383941] border border-[#383941] text-white font-bold text-xs py-3 px-4 rounded-xl transition-all disabled:opacity-50"
            >
              <span>Continua con Google</span>
            </button>
          </>
        ) : (
          <>
            {/* API Key Guide Card (Legacy local mode without Supabase env vars) */}
            <div className="bg-[#26272D] border border-[#383941] rounded-2xl p-4 mb-6 text-xs text-slate-300">
              <div className="flex items-center gap-2 font-bold text-[#00E5A3] mb-2 uppercase tracking-wider text-[11px]">
                <Key className="w-4 h-4" />
                Where to get your API Key:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>
                  Log in to <span className="text-white font-semibold">intervals.icu</span>
                </li>
                <li>
                  Click <span className="text-white font-semibold">Settings</span> (gear icon)
                </li>
                <li>
                  Scroll to <span className="text-white font-semibold">Developer Settings</span> at
                  bottom
                </li>
                <li>
                  Copy your personal <span className="text-white font-semibold">API Key</span>
                </li>
              </ol>
            </div>

            <form onSubmit={handleLegacySubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Intervals.icu API Key
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (localError) setLocalError(null);
                    }}
                    placeholder="Paste API key here..."
                    className="w-full bg-[#2F3037] border border-[#383941] focus:border-[#00E5A3] focus:outline-none rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 text-slate-400 hover:text-white"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Athlete ID
                  </label>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Optional (Default: 0)
                  </span>
                </div>
                <input
                  type="text"
                  value={athleteId}
                  onChange={(e) => setAthleteId(e.target.value)}
                  placeholder="0 (your own athlete account)"
                  className="w-full bg-[#2F3037] border border-[#383941] focus:border-[#00E5A3] focus:outline-none rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 transition-colors"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Leave blank or '0' to load your personal athlete profile.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#00E5A3] hover:bg-[#00c98f] text-[#131316] font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl shadow-lg shadow-[#00E5A3]/20 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span className="inline-block animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Connect Intervals.icu
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#383941]" />
              </div>
              <span className="relative bg-[#1F2025] px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Or test right now
              </span>
            </div>

            {/* Demo Mode Button */}
            <button
              type="button"
              onClick={loginDemo}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 bg-[#2F3037] hover:bg-[#222E46] border border-[#383941] text-white font-bold text-xs py-3.5 px-4 rounded-xl transition-all"
            >
              <Sparkles className="w-4 h-4 text-[#FC5200]" />
              <span>Launch Simulated Demo Mode</span>
            </button>
          </>
        )}

        {/* Legal links */}
        <div className="flex items-center justify-center gap-4 mt-6 text-[10px] text-slate-500">
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener"
            className="hover:text-slate-300 underline underline-offset-2"
          >
            Informativa sulla privacy
          </a>
          <span className="text-slate-600">&middot;</span>
          <a
            href="/termini.html"
            target="_blank"
            rel="noopener"
            className="hover:text-slate-300 underline underline-offset-2"
          >
            Termini di servizio
          </a>
        </div>
      </div>
    </div>
  );
};
