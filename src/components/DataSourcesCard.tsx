import {
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Link2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';

export const DataSourcesCard: React.FC = () => {
  const {
    isSupabaseMode,
    providerConnections,
    connectIntervals,
    disconnectProvider,
    connectStrava,
    syncStrava,
    importGarminFit,
    isRefreshing,
  } = useApp();

  const [apiKey, setApiKey] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showIntervalsForm, setShowIntervalsForm] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);
  const fitInputRef = useRef<HTMLInputElement | null>(null);

  if (!isSupabaseMode) return null;

  const intervalsConn = providerConnections.find((c) => c.provider === 'intervals');
  const stravaConn = providerConnections.find((c) => c.provider === 'strava');
  const garminConn = providerConnections.find((c) => c.provider === 'garmin');

  const handleSaveIntervals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setFeedback({ text: 'Please enter your Intervals.icu API Key.', isError: true });
      return;
    }
    setBusyProvider('intervals');
    setFeedback(null);
    try {
      await connectIntervals(apiKey.trim(), athleteId.trim() || '0');
      setApiKey('');
      setAthleteId('');
      setShowIntervalsForm(false);
      setFeedback({ text: 'Intervals.icu connected and synced to your Supabase database!' });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Intervals.icu connection error.', isError: true });
    } finally {
      setBusyProvider(null);
    }
  };

  const handleDisconnect = async (provider: 'intervals' | 'strava' | 'garmin') => {
    setBusyProvider(provider);
    setFeedback(null);
    try {
      await disconnectProvider(provider);
      setFeedback({ text: `Disconnected ${provider}.` });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Failed to disconnect provider.', isError: true });
    } finally {
      setBusyProvider(null);
    }
  };

  const handleStravaConnect = async () => {
    setBusyProvider('strava');
    setFeedback(null);
    try {
      await connectStrava();
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Failed to start Strava OAuth.', isError: true });
      setBusyProvider(null);
    }
  };

  const handleStravaSync = async () => {
    setBusyProvider('strava');
    setFeedback(null);
    try {
      const count = await syncStrava();
      setFeedback({ text: `Synced ${count} activities from Strava to your database.` });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Strava sync failed.', isError: true });
    } finally {
      setBusyProvider(null);
    }
  };

  const handleFitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusyProvider('garmin');
    setFeedback(null);
    try {
      const act = await importGarminFit(file);
      setFeedback({ text: `Activity "${act.name}" imported from .FIT and saved to Supabase!` });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Failed to import .FIT file.', isError: true });
    } finally {
      setBusyProvider(null);
      if (fitInputRef.current) fitInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-[#1F2025] border border-[#383941] rounded-3xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Database className="w-4 h-4 text-[#00E5A3]" />
            <span>Data Sources (Supabase DB)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Choose where to import activities, power curves, and wellness data into your personal database.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            feedback.isError
              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
              : 'bg-[#00E5A3]/10 border border-[#00E5A3]/30 text-[#00E5A3]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 1. Intervals.icu */}
      <div className="p-4 rounded-2xl bg-[#26272D] border border-[#383941] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Intervals.icu</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  intervalsConn
                    ? 'bg-[#00E5A3]/15 text-[#00E5A3]'
                    : 'bg-slate-500/15 text-slate-400'
                }`}
              >
                {intervalsConn ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Activities, power curves, calendar, HRV, sleep, and CTL/ATL/TSB.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {intervalsConn ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowIntervalsForm(!showIntervalsForm)}
                  className="px-3 py-1.5 rounded-xl bg-[#2F3037] border border-[#383941] text-xs font-bold text-slate-200 hover:bg-[#3E4049]"
                >
                  Update Key
                </button>
                <button
                  type="button"
                  disabled={busyProvider === 'intervals'}
                  onClick={() => handleDisconnect('intervals')}
                  className="p-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                  title="Disconnect Intervals.icu"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowIntervalsForm(!showIntervalsForm)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#00E5A3] text-[#131316] font-extrabold text-xs hover:bg-[#00c98f]"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Connect</span>
              </button>
            )}
          </div>
        </div>

        {showIntervalsForm && (
          <form onSubmit={handleSaveIntervals} className="pt-3 border-t border-white/5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2 relative flex items-center">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Intervals.icu API Key (Settings -> Developer)"
                  className="w-full bg-[#131316] border border-[#383941] focus:border-[#00E5A3] focus:outline-none rounded-xl px-3 py-2 text-xs text-white pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 text-slate-400 hover:text-white"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <input
                type="text"
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
                placeholder="Athlete ID (optional, default 0)"
                className="bg-[#131316] border border-[#383941] focus:border-[#00E5A3] focus:outline-none rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowIntervalsForm(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyProvider === 'intervals' || isRefreshing}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#00E5A3] text-[#131316] font-extrabold text-xs disabled:opacity-50"
              >
                {busyProvider === 'intervals' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                <span>Save &amp; Sync</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. Strava */}
      <div className="p-4 rounded-2xl bg-[#26272D] border border-[#383941]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Strava</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  stravaConn
                    ? 'bg-[#FC5200]/15 text-[#FC5200]'
                    : 'bg-slate-500/15 text-slate-400'
                }`}
              >
                {stravaConn ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              OAuth2 via Cloudflare Pages Functions. Imports activities, power, HR, and GPS routes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {stravaConn ? (
              <>
                <button
                  type="button"
                  disabled={busyProvider === 'strava'}
                  onClick={handleStravaSync}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FC5200]/15 border border-[#FC5200]/30 text-[#FC5200] font-bold text-xs hover:bg-[#FC5200]/25 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${busyProvider === 'strava' ? 'animate-spin' : ''}`}
                  />
                  <span>Sync Strava</span>
                </button>
                <button
                  type="button"
                  disabled={busyProvider === 'strava'}
                  onClick={() => handleDisconnect('strava')}
                  className="p-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                  title="Disconnect Strava"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busyProvider === 'strava'}
                onClick={handleStravaConnect}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FC5200] text-white font-extrabold text-xs hover:bg-[#e54b00] disabled:opacity-50"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Connect Strava</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Garmin Connect (.FIT import) */}
      <div className="p-4 rounded-2xl bg-[#26272D] border border-[#383941]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Garmin Connect (.FIT)</span>
              {garminConn && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#00B4D8]/15 text-[#00B4D8]">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload <code className="text-slate-200">.fit</code> files exported from Garmin Connect or
              your bike computer. For automatic Garmin + HRV/Sleep sync, connect Intervals.icu.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={fitInputRef}
              type="file"
              accept=".fit,.FIT"
              onChange={handleFitUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={busyProvider === 'garmin'}
              onClick={() => fitInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#00B4D8]/15 border border-[#00B4D8]/30 text-[#00B4D8] font-bold text-xs hover:bg-[#00B4D8]/25 disabled:opacity-50"
            >
              {busyProvider === 'garmin' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Import .FIT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
