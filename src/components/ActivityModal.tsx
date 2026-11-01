import { Bike, Footprints, Heart, MessageSquare, Repeat, Waves, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { Activity } from '../types/intervals';
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
}

export const ActivityModal: React.FC<ActivityModalProps> = ({
  activity,
  onClose,
  useImperial = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!activity) return null;

  const hrZones = activity.icu_hr_zones || [];
  const totalHrSecs = hrZones.reduce((a, b) => a + b, 0);

  const zoneColors = ['#94A3B8', '#38BDF8', '#10B981', '#F59E0B', '#EF4444'];
  const zoneLabels = [
    'Z1 Active Recovery',
    'Z2 Aerobic Endurance',
    'Z3 Tempo',
    'Z4 Threshold',
    'Z5 VO2 Max / Anaerobic',
  ];

  const typeLower = (activity.type || '').toLowerCase();
  const isRun = typeLower.includes('run');
  const isRide = typeLower.includes('ride') || typeLower.includes('cycl');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-[#111622] border border-[#232D42] rounded-3xl shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-5 bg-[#111622]/95 backdrop-blur border-b border-white/5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#00E5A3]/10 border border-[#00E5A3]/20 flex items-center justify-center text-[#00E5A3]">
              {isRide ? <Bike className="w-5 h-5" /> : isRun ? <Footprints className="w-5 h-5" /> : <Waves className="w-5 h-5" />}
            </span>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                {activity.type || 'Workout'} • {formatDateRelative(activity.start_date_local)}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">{activity.name}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1A2234] hover:bg-[#25324C] border border-[#232D42] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 space-y-6">
          {/* Hero 3 Grid */}
          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-[#1A2234] border border-[#232D42] text-center">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                Distance
              </span>
              <span className="text-xl sm:text-2xl font-black text-white">
                {formatDistance(activity.distance, useImperial)}
              </span>
            </div>

            <div className="border-x border-white/10">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                Duration
              </span>
              <span className="text-xl sm:text-2xl font-black text-white">
                {formatDuration(activity.moving_time || activity.elapsed_time)}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                Training Load
              </span>
              <span className="text-xl sm:text-2xl font-black text-[#FC5200]">
                {activity.icu_training_load ? Math.round(activity.icu_training_load) : '--'}
              </span>
            </div>
          </div>

          {/* Performance Metrics Grid */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              Power & Output Metrics
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {activity.average_watts ? (
                <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Avg Power</span>
                  <span className="text-lg font-black text-white">{formatWatts(activity.average_watts)}</span>
                  {activity.weighted_average_watts && (
                    <span className="text-[11px] text-[#FC5200] font-semibold block mt-0.5">
                      NP {Math.round(activity.weighted_average_watts)}W
                    </span>
                  )}
                </div>
              ) : null}

              {isRun && activity.average_speed ? (
                <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Pace</span>
                  <span className="text-lg font-black text-white">{formatPace(activity.average_speed, useImperial)}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {formatSpeed(activity.average_speed, useImperial)}
                  </span>
                </div>
              ) : activity.average_speed ? (
                <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Avg Speed</span>
                  <span className="text-lg font-black text-white">{formatSpeed(activity.average_speed, useImperial)}</span>
                  {activity.max_speed && (
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Max {formatSpeed(activity.max_speed, useImperial)}
                    </span>
                  )}
                </div>
              ) : null}

              {activity.average_heartrate ? (
                <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Heart Rate</span>
                  <span className="text-lg font-black text-white">{formatHeartRate(activity.average_heartrate)}</span>
                  {activity.max_heartrate && (
                    <span className="text-[11px] text-red-400 font-semibold block mt-0.5">
                      Max {formatHeartRate(activity.max_heartrate)}
                    </span>
                  )}
                </div>
              ) : null}

              {activity.total_elevation_gain ? (
                <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Elevation Gain</span>
                  <span className="text-lg font-black text-white">{formatElevation(activity.total_elevation_gain, useImperial)}</span>
                </div>
              ) : null}

              {activity.icu_intensity ? (
                <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Intensity Factor</span>
                  <span className="text-lg font-black text-amber-400">
                    {(activity.icu_intensity > 2 ? activity.icu_intensity / 100 : activity.icu_intensity).toFixed(2)}
                  </span>
                </div>
              ) : null}

              {activity.icu_joules ? (
                <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Energy</span>
                  <span className="text-lg font-black text-white">{Math.round(activity.icu_joules / 1000)} kJ</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Heart Rate Zones Distribution Bar */}
          {totalHrSecs > 0 && (
            <div className="bg-[#151C2C] p-5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-red-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Heart Rate Zones Distribution
                </h4>
              </div>

              {/* Stacked bar */}
              <div className="flex h-3 rounded-full overflow-hidden bg-white/5 mb-4">
                {hrZones.map((secs, idx) => {
                  const pct = (secs / totalHrSecs) * 100;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={idx}
                      style={{ width: `${pct}%`, backgroundColor: zoneColors[idx] }}
                      className="h-full"
                    />
                  );
                })}
              </div>

              {/* Rows */}
              <div className="space-y-2 text-xs">
                {hrZones.map((secs, idx) => {
                  const pct = (secs / totalHrSecs) * 100;
                  return (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: zoneColors[idx] }} />
                        <span className="text-slate-300 font-medium">{zoneLabels[idx]}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">{formatDuration(secs)}</span>
                        <span className="font-bold text-white w-8 text-right">{Math.round(pct)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interval Repeats Table */}
          {activity.intervals && activity.intervals.length > 0 && (
            <div className="bg-[#151C2C] p-5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Repeat className="w-4 h-4 text-[#00E5A3]" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Interval Repeats ({activity.intervals.length})
                </h4>
              </div>

              <div className="divide-y divide-white/5 text-xs">
                {activity.intervals.map((int, idx) => (
                  <div key={int.id || idx} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          int.type === 'RECOVERY'
                            ? 'bg-white/5 text-slate-400'
                            : 'bg-[#00E5A3]/10 text-[#00E5A3]'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-white block">
                          {int.type === 'RECOVERY' ? 'Recovery' : 'Work Interval'}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {formatDuration(int.moving_time || int.elapsed_time)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      {int.average_watts ? (
                        <span className="font-extrabold text-white block">
                          {Math.round(int.average_watts)} W
                        </span>
                      ) : null}
                      {int.average_heartrate ? (
                        <span className="text-slate-400 text-[11px] block">
                          {Math.round(int.average_heartrate)} bpm
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes and Perception */}
          {(activity.description || activity.rpe || activity.feel) && (
            <div className="bg-[#151C2C] p-5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-[#00B4D8]" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Athlete Notes & Exertion
                </h4>
              </div>

              {activity.description && (
                <p className="text-sm text-slate-300 leading-relaxed mb-3">
                  {activity.description}
                </p>
              )}

              <div className="flex items-center gap-4 pt-2 border-t border-white/5 text-xs">
                {activity.rpe && (
                  <div>
                    <span className="text-slate-400 uppercase font-bold text-[10px] block">RPE Exertion</span>
                    <span className="text-white font-black text-sm">{activity.rpe} / 10</span>
                  </div>
                )}
                {activity.feel && (
                  <div>
                    <span className="text-slate-400 uppercase font-bold text-[10px] block">Feeling</span>
                    <span className="text-[#00E5A3] font-bold text-sm">
                      {activity.feel === 5 ? 'Great ⚡' : activity.feel === 4 ? 'Good 👍' : 'Normal'}
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
