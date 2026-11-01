import { Bike, Footprints, Heart, MessageSquare, Repeat, Waves, X, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Activity } from '../types/intervals';
import { UserSettings } from '../types';
import { useApp } from '../context/AppContext';
import { getActivityDetails } from '../services/intervals/api';
import {
  formatDateRelative,
  formatDistance,
  formatDuration,
  formatElevation,
  formatHeartRate,
  formatPace,
  formatSpeed,
  formatWatts,
} from '../utils/formatters';

interface ActivityModalProps {
  activity: Activity | null;
  onClose: () => void;
  useImperial?: boolean;
  settings?: UserSettings;
}

export const ActivityModal: React.FC<ActivityModalProps> = ({
  activity,
  onClose,
  useImperial = false,
  settings,
}) => {
  const { credentials } = useApp();
  const [detailedActivity, setDetailedActivity] = useState<Activity | null>(activity);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setDetailedActivity(activity);
    if (!activity) return;

    // If activity lacks icu_hr_zone_times and we have real credentials, fetch full details
    if (
      (!activity.icu_hr_zone_times || activity.icu_hr_zone_times.length === 0) &&
      credentials &&
      !credentials.isDemo &&
      activity.id
    ) {
      setIsLoadingDetails(true);
      getActivityDetails(credentials.apiKey, activity.id)
        .then((full) => {
          if (full) {
            setDetailedActivity((prev) => ({ ...prev, ...full }));
          }
        })
        .catch((err) => {
          console.warn('Could not load detailed activity data:', err);
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    }
  }, [activity, credentials]);

  if (!activity) return null;

  const currentAct = detailedActivity || activity;

  // Determine HR zone durations in seconds
  // Note: in Intervals.icu, icu_hr_zones is the array of BPM thresholds (e.g. [126, 148, 164, 178, 192])
  // while icu_hr_zone_times is the duration in seconds spent in each zone!
  const isBpmBounds = (arr: number[]) => {
    if (!arr || arr.length < 2) return false;
    const allInHrRange = arr.every((v) => v >= 70 && v <= 235);
    const isAscending = arr.every((v, i) => i === 0 || v > arr[i - 1]);
    return allInHrRange && isAscending;
  };

  let hrZoneTimes: number[] = [];
  if (Array.isArray(currentAct.icu_hr_zone_times) && currentAct.icu_hr_zone_times.length > 0) {
    hrZoneTimes = currentAct.icu_hr_zone_times;
  } else if (Array.isArray(currentAct.icu_hr_zones) && !isBpmBounds(currentAct.icu_hr_zones)) {
    hrZoneTimes = currentAct.icu_hr_zones;
  }

  const totalHrSecs = hrZoneTimes.reduce((a, b) => a + b, 0);

  const defaultZoneColors = ['#94A3B8', '#38BDF8', '#10B981', '#F59E0B', '#EF4444', '#FB923C', '#C084FC'];
  const defaultZoneLabels = [
    'Z1 Recovery',
    'Z2 Aerobic Base',
    'Z3 Tempo',
    'Z4 Threshold',
    'Z5 VO2 Max',
    'Z6 Anaerobic',
    'Z7 Neuromuscular',
  ];

  // Configured user HR zones from Settings
  const userHrZones = settings?.hrZones || [];

  // Determine power zone times if present
  const powerZoneTimes = Array.isArray(currentAct.icu_zone_times) ? currentAct.icu_zone_times : [];
  const totalPowerSecs = powerZoneTimes.reduce((a, b) => a + b, 0);

  const typeLower = (currentAct.type || '').toLowerCase();
  const isRun = typeLower.includes('run');
  const isRide = typeLower.includes('ride') || typeLower.includes('cycl');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-[#1F2025] border border-[#383941] rounded-3xl shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-5 bg-[#1F2025]/95 backdrop-blur border-b border-white/5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#00E5A3]/10 border border-[#00E5A3]/20 flex items-center justify-center text-[#00E5A3]">
              {isRide ? <Bike className="w-5 h-5" /> : isRun ? <Footprints className="w-5 h-5" /> : <Waves className="w-5 h-5" />}
            </span>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                {currentAct.type || 'Workout'} • {formatDateRelative(currentAct.start_date_local)}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">{currentAct.name}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#2F3037] hover:bg-[#3E4049] border border-[#383941] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 space-y-6">
          {/* Hero 3 Grid */}
          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-[#2F3037] border border-[#383941] text-center">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                Distance
              </span>
              <span className="text-xl sm:text-2xl font-black text-white">
                {formatDistance(currentAct.distance, useImperial)}
              </span>
            </div>

            <div className="border-x border-white/10">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                Duration
              </span>
              <span className="text-xl sm:text-2xl font-black text-white">
                {formatDuration(currentAct.moving_time || currentAct.elapsed_time)}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                Training Load
              </span>
              <span className="text-xl sm:text-2xl font-black text-[#FC5200]">
                {currentAct.icu_training_load ? Math.round(currentAct.icu_training_load) : '--'}
              </span>
            </div>
          </div>

          {/* Performance Metrics Grid */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              Power & Output Metrics
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {currentAct.average_watts ? (
                <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Avg Power</span>
                  <span className="text-lg font-black text-white">{formatWatts(currentAct.average_watts)}</span>
                  {currentAct.weighted_average_watts && (
                    <span className="text-[11px] text-[#FC5200] font-semibold block mt-0.5">
                      NP {Math.round(currentAct.weighted_average_watts)}W
                    </span>
                  )}
                </div>
              ) : null}

              {isRun && currentAct.average_speed ? (
                <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Pace</span>
                  <span className="text-lg font-black text-white">{formatPace(currentAct.average_speed, useImperial)}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {formatSpeed(currentAct.average_speed, useImperial)}
                  </span>
                </div>
              ) : currentAct.average_speed ? (
                <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Avg Speed</span>
                  <span className="text-lg font-black text-white">{formatSpeed(currentAct.average_speed, useImperial)}</span>
                  {currentAct.max_speed && (
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Max {formatSpeed(currentAct.max_speed, useImperial)}
                    </span>
                  )}
                </div>
              ) : null}

              {currentAct.average_heartrate ? (
                <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Heart Rate</span>
                  <span className="text-lg font-black text-white">{formatHeartRate(currentAct.average_heartrate)}</span>
                  {currentAct.max_heartrate && (
                    <span className="text-[11px] text-red-400 font-semibold block mt-0.5">
                      Max {formatHeartRate(currentAct.max_heartrate)}
                    </span>
                  )}
                </div>
              ) : null}

              {currentAct.total_elevation_gain ? (
                <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Elevation Gain</span>
                  <span className="text-lg font-black text-white">{formatElevation(currentAct.total_elevation_gain, useImperial)}</span>
                </div>
              ) : null}

              {currentAct.icu_intensity ? (
                <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Intensity Factor</span>
                  <span className="text-lg font-black text-amber-400">
                    {(currentAct.icu_intensity > 2 ? currentAct.icu_intensity / 100 : currentAct.icu_intensity).toFixed(2)}
                  </span>
                </div>
              ) : null}

              {currentAct.icu_joules ? (
                <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Energy</span>
                  <span className="text-lg font-black text-white">{Math.round(currentAct.icu_joules / 1000)} kJ</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Heart Rate Zones Distribution Bar */}
          {totalHrSecs > 0 ? (
            <div className="bg-[#26272D] p-5 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                    Heart Rate Zones Distribution
                  </h4>
                </div>
                {isLoadingDetails && (
                  <span className="text-[10px] text-slate-400 animate-pulse">Syncing zones...</span>
                )}
              </div>

              {/* Stacked bar */}
              <div className="flex h-3 rounded-full overflow-hidden bg-white/5 mb-4">
                {hrZoneTimes.map((secs, idx) => {
                  const pct = (secs / totalHrSecs) * 100;
                  if (pct <= 0) return null;
                  const color = userHrZones[idx]?.color || defaultZoneColors[idx % defaultZoneColors.length];
                  return (
                    <div
                      key={idx}
                      style={{ width: `${pct}%`, backgroundColor: color }}
                      className="h-full transition-all"
                    />
                  );
                })}
              </div>

              {/* Rows */}
              <div className="space-y-2 text-xs">
                {hrZoneTimes.map((secs, idx) => {
                  const pct = (secs / totalHrSecs) * 100;
                  const userZ = userHrZones[idx];
                  const label = userZ?.name || defaultZoneLabels[idx] || `Zone ${idx + 1}`;
                  const color = userZ?.color || defaultZoneColors[idx % defaultZoneColors.length];
                  const bpmRange = userZ
                    ? `${userZ.minBpm}-${userZ.maxBpm} bpm`
                    : currentAct.icu_hr_zones && currentAct.icu_hr_zones[idx]
                    ? `< ${currentAct.icu_hr_zones[idx]} bpm`
                    : '';

                  return (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-white/[0.03] last:border-0">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-slate-200 font-semibold">{label}</span>
                        {bpmRange && (
                          <span className="text-[10px] text-slate-500 font-mono">({bpmRange})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-mono">{formatDuration(secs)}</span>
                        <span className="font-bold text-white w-9 text-right font-mono">{Math.round(pct)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : currentAct.average_heartrate ? (
            <div className="bg-[#26272D] p-4 rounded-2xl border border-white/5 text-xs text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                <span>Recorded Average: <strong className="text-white">{currentAct.average_heartrate} bpm</strong></span>
              </div>
              <span className="text-[11px] text-slate-500">No stream time-in-zone distribution stored</span>
            </div>
          ) : null}

          {/* Power Zones Distribution (if available) */}
          {totalPowerSecs > 0 && (
            <div className="bg-[#26272D] p-5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-[#FC5200]" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Power Zones Distribution
                </h4>
              </div>

              {/* Stacked bar */}
              <div className="flex h-3 rounded-full overflow-hidden bg-white/5 mb-4">
                {powerZoneTimes.map((secs, idx) => {
                  const pct = (secs / totalPowerSecs) * 100;
                  if (pct <= 0) return null;
                  const colors = ['#94A3B8', '#38BDF8', '#4ADE80', '#FACC15', '#FB923C', '#F87171', '#C084FC'];
                  return (
                    <div
                      key={idx}
                      style={{ width: `${pct}%`, backgroundColor: colors[idx % colors.length] }}
                      className="h-full transition-all"
                    />
                  );
                })}
              </div>

              {/* Rows */}
              <div className="space-y-1.5 text-xs">
                {powerZoneTimes.map((secs, idx) => {
                  const pct = (secs / totalPowerSecs) * 100;
                  const powerNames = ['Z1 Active Recovery', 'Z2 Endurance', 'Z3 Tempo', 'Z4 Threshold', 'Z5 VO2 Max', 'Z6 Anaerobic', 'Z7 Neuromuscular'];
                  const colors = ['#94A3B8', '#38BDF8', '#4ADE80', '#FACC15', '#FB923C', '#F87171', '#C084FC'];
                  return (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-white/[0.03] last:border-0">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[idx % colors.length] }} />
                        <span className="text-slate-200 font-semibold">{powerNames[idx] || `Zone ${idx + 1}`}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-mono">{formatDuration(secs)}</span>
                        <span className="font-bold text-white w-9 text-right font-mono">{Math.round(pct)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interval Repeats Table */}
          {currentAct.intervals && currentAct.intervals.length > 0 && (
            <div className="bg-[#26272D] p-5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Repeat className="w-4 h-4 text-[#00E5A3]" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Interval Repeats ({currentAct.intervals.length})
                </h4>
              </div>

              <div className="divide-y divide-white/5 text-xs">
                {currentAct.intervals.map((int, idx) => (
                  <div key={int.id || idx} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          int.type === 'RECOVERY'
                            ? 'bg-white/5 text-slate-400'
                            : 'bg-[#00E5A3]/10 text-[#00E5A3]'
                        }`}
                      >
                        {int.type || `Interval ${idx + 1}`}
                      </span>
                      <span className="text-white font-medium">
                        {formatDuration(int.moving_time || int.elapsed_time || 0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      {int.average_watts && (
                        <div>
                          <span className="font-black text-white">{Math.round(int.average_watts)}W</span>
                          <span className="text-[10px] text-slate-500 block">Avg Power</span>
                        </div>
                      )}
                      {int.average_heartrate && (
                        <div>
                          <span className="font-black text-red-400">{Math.round(int.average_heartrate)} bpm</span>
                          <span className="text-[10px] text-slate-500 block">Avg HR</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Description & Feelings */}
          {(currentAct.description || currentAct.rpe || currentAct.feel) && (
            <div className="bg-[#26272D] p-5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-slate-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Athlete Notes & Exertion
                </h4>
              </div>

              {currentAct.description && (
                <p className="text-sm text-slate-300 leading-relaxed mb-3 whitespace-pre-wrap">
                  {currentAct.description}
                </p>
              )}

              <div className="flex items-center gap-4 pt-2 border-t border-white/5 text-xs">
                {currentAct.rpe && (
                  <div>
                    <span className="text-slate-400 uppercase font-bold text-[10px] block">RPE Exertion</span>
                    <span className="text-white font-black text-sm">{currentAct.rpe} / 10</span>
                  </div>
                )}
                {currentAct.feel && (
                  <div>
                    <span className="text-slate-400 uppercase font-bold text-[10px] block">Feeling</span>
                    <span className="text-[#00E5A3] font-bold text-sm">
                      {currentAct.feel === 5 ? 'Great ⚡' : currentAct.feel === 4 ? 'Good 👍' : 'Normal'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};