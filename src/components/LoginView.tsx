import { Activity, Eye, EyeOff, Key, ShieldCheck, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const LoginView: React.FC = () => {
  const { login, loginDemo, error, clearError } = useApp();
  const [apiKey, setApiKey] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#080A0F] text-white selection:bg-[#00E5A3]/20">
      <div className="w-full max-w-md bg-[#111622] border border-[#232D42] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow ambient background circle */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-[#00E5A3]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-[#FC5200]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Hero Brand Header */}
        <div className="flex flex-col items-center text-center mb-6 relative">
          <div className="w-16 h-16 rounded-2xl bg-[#00E5A3]/10 border border-[#00E5A3]/30 flex items-center justify-center text-[#00E5A3] mb-4 shadow-lg shadow-[#00E5A3]/5">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            INTERVALS PULSE
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xs leading-relaxed">
            Next-gen athletic performance & recovery dashboard for Intervals.icu
          </p>
        </div>

        {/* API Key Guide Card */}
        <div className="bg-[#151C2C] border border-[#232D42] rounded-2xl p-4 mb-6 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-bold text-[#00E5A3] mb-2 uppercase tracking-wider text-[11px]">
            <Key className="w-4 h-4" />
            Where to get your API Key:
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-400">
            <li>Log in to <span className="text-white font-semibold">intervals.icu</span></li>
            <li>Click <span className="text-white font-semibold">Settings</span> (gear icon)</li>
            <li>Scroll to <span className="text-white font-semibold">Developer Settings</span> at bottom</li>
            <li>Copy your personal <span className="text-white font-semibold">API Key</span></li>
          </ol>
        </div>

        {/* Error notification */}
        {(localError || error) && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs font-semibold mb-4">
            {localError || error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full bg-[#1A2234] border border-[#232D42] focus:border-[#00E5A3] focus:outline-none rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 transition-colors"
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
              className="w-full bg-[#1A2234] border border-[#232D42] focus:border-[#00E5A3] focus:outline-none rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 transition-colors"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Leave blank or '0' to load your personal athlete profile.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#00E5A3] hover:bg-[#00c98f] text-[#080A0F] font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl shadow-lg shadow-[#00E5A3]/20 transition-all disabled:opacity-50 mt-2"
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
            <div className="w-full border-t border-[#232D42]" />
          </div>
          <span className="relative bg-[#111622] px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Or test right now
          </span>
        </div>

        {/* Demo Mode Button */}
        <button
          type="button"
          onClick={loginDemo}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 bg-[#1A2234] hover:bg-[#222E46] border border-[#232D42] text-white font-bold text-xs py-3.5 px-4 rounded-xl transition-all"
        >
          <Sparkles className="w-4 h-4 text-[#FC5200]" />
          <span>Launch Simulated Demo Mode</span>
        </button>
      </div>
    </div>
  );
};
