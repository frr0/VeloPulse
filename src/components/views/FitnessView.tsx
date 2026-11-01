import {
  Activity,
  Award,
  Flame,
  Heart,
  Info,
  Layers,
  Moon,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateShort, formatDuration, getFormStatus } from '../../utils/formatters';
import { FitnessChart } from '../FitnessChart';
import { MetricCard } from '../MetricCard';
import { HrvChart } from '../charts/HrvChart';
import { PowerCurveChart } from '../charts/PowerCurveChart';
import { RestingHrChart } from '../charts/RestingHrChart';
import { SleepChart } from '../charts/SleepChart';
import { Vo2MaxChart } from '../charts/Vo2MaxChart';

export type AnalyticsTab =
  | 'all'
  | 'fitness'
  | 'power'
  | 'hrv'
  | 'resting_hr'
  | 'sleep'
  | 'vo2max';

interface FitnessViewProps {
  initialTab?: AnalyticsTab;
}

export const FitnessView: React.FC<FitnessViewProps> = ({ initialTab = 'fitness' }) => {
  const { wellness, athlete, powerCurve } = useApp();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(initialTab);

  const sortedWellness = useMemo(() => {
    return [...wellness].sort(
      (a, b) => new Date(b.id).getTime() - new Date(a.id).getTime()
    );
  }, [wellness]);

  const latest = sortedWellness[0];
  const ctl = latest?.ctl ?? 78;
  const atl = latest?.atl ?? 82;
  const tsb = latest?.tsb ?? (ctl - atl);
  const formStatus = getFormStatus(tsb);
  const ftp = athlete?.ftp ?? 295;
  const weight = athlete?.weight ?? 68.5;
  const vo2max = latest?.vo2max ?? athlete?.vo2max ?? 56.4;

  const tabOptions = [
    { id: 'fitness' as const, label: 'Fitness & Form', icon: TrendingUp, color: '#38BDF8' },
    { id: 'power' as const, label: 'Power Curve', icon: Zap, color: '#FC5200' },
    { id: 'hrv' as const, label: 'HRV Recovery', icon: Heart, color: '#00E5A3' },
    { id: 'resting_hr' as const, label: 'Resting HR', icon: Activity, color: '#00B4D8' },
    { id: 'sleep' as const, label: 'Sleep & Debt', icon: Moon, color: '#818CF8' },
    { id: 'vo2max' as const, label: 'VO2 Max', icon: Award, color: '#A855F7' },
    { id: 'all' as const, label: 'All Graphs', icon: Layers, color: '#FFFFFF' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Category Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-[#232D42]">
        {tabOptions.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-[#1A2234] text-white border-white/20 shadow-md'
                  : 'bg-[#111622]/60 text-slate-400 border-transparent hover:text-white hover:bg-[#1A2234]/50'
              }`}
            >
              <Icon
                className="w-3.5 h-3.5"
                style={{ color: isActive ? tab.color : '#94A3B8' }}
              />
              <span>{tab.label}</span>
              {isActive && (
                <span
                  className="w-1.5 h-1.5 rounded-full ml-0.5"
                  style={{ backgroundColor: tab.color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* RENDER VIEW: ALL GRAPHS */}
      {activeTab === 'all' && (
        <div className="space-y-6">
          <FitnessChart data={wellness} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PowerCurveChart data={powerCurve} ftp={ftp} weight={weight} />
            <Vo2MaxChart data={wellness} currentVo2Max={vo2max} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HrvChart data={wellness} />
            <RestingHrChart data={wellness} defaultRHR={athlete?.restingHR ?? 46} />
          </div>

          <SleepChart data={wellness} />
        </div>
      )}

      {/* RENDER VIEW: FITNESS & FORM */}
      {activeTab === 'fitness' && (
        <div className="space-y-6">
          <FitnessChart data={wellness} />

          {/* Fitness Modeling Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard
              label="Fitness (CTL)"
              value={ctl.toFixed(1)}
              subValue="42-day rolling base"
              icon={<TrendingUp className="w-4 h-4" />}
              accentColor="#38BDF8"
            />

            <MetricCard
              label="Fatigue (ATL)"
              value={atl.toFixed(1)}
              subValue="7-day acute stress"
              icon={<Flame className="w-4 h-4" />}
              accentColor="#A855F7"
            />

            <MetricCard
              label="Form (TSB)"
              value={tsb > 0 ? `+${tsb.toFixed(1)}` : tsb.toFixed(1)}
              subValue={formStatus.label}
              icon={<Zap className="w-4 h-4" />}
              accentColor={formStatus.color}
            />

            <MetricCard
              label="eFTP"
              value={athlete?.ftp ? `${athlete.ftp} W` : '295 W'}
              subValue="Estimated Threshold"
              icon={<Activity className="w-4 h-4" />}
              accentColor="#FC5200"
            />
          </div>

          {/* Form Zones Guide Card */}
          <div className="bg-[#111622] border border-[#232D42] rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-[#00B4D8]" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Form Zones Reference (TSB = CTL − ATL)
              </h4>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Form measures the balance between chronic fitness and acute fatigue. It guides training volume and peaking for races:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#00E5A3]/20">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-[#00E5A3] text-black mb-1.5">
                  +5 to +25 TSB
                </span>
                <strong className="text-white block font-bold">Fresh & Race Ready</strong>
                <span className="text-slate-400 text-[11px] block mt-1">
                  Supercompensation peak. Ideal for target events and races.
                </span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#38BDF8]/20">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-[#38BDF8] text-black mb-1.5">
                  -10 to -30 TSB
                </span>
                <strong className="text-white block font-bold">Optimal Training</strong>
                <span className="text-slate-400 text-[11px] block mt-1">
                  Productive training stimulus building durable fitness base.
                </span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#F59E0B]/20">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-[#F59E0B] text-black mb-1.5">
                  -30 to -40 TSB
                </span>
                <strong className="text-white block font-bold">High Fatigue</strong>
                <span className="text-slate-400 text-[11px] block mt-1">
                  Heavy stress on capacity. Plan recovery days and nutrition.
                </span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#EF4444]/20">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-[#EF4444] text-white mb-1.5">
                  &lt; -40 TSB
                </span>
                <strong className="text-white block font-bold">Overreaching Risk</strong>
                <span className="text-slate-400 text-[11px] block mt-1">
                  Danger of illness or burnout. Rest days strongly advised.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER VIEW: POWER CURVE */}
      {activeTab === 'power' && (
        <div className="space-y-6">
          <PowerCurveChart data={powerCurve} ftp={ftp} weight={weight} />

          <div className="bg-[#111622] border border-[#232D42] rounded-2xl p-5 shadow-lg">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
              Power Profiling & Energy Systems Guide
            </h4>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Your Mean Maximal Power (MMP) curve reveals physiological strengths and opportunities across metabolic systems:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#FC5200]/20">
                <strong className="text-[#FC5200] block font-bold">5s - 15s Neuromuscular</strong>
                <span className="text-slate-300 text-[11px] block mt-1">
                  Phosphocreatine system for maximum sprinting, attacks, and town-sign sprints.
                </span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#38BDF8]/20">
                <strong className="text-[#38BDF8] block font-bold">30s - 2m Anaerobic Capacity</strong>
                <span className="text-slate-300 text-[11px] block mt-1">
                  Glycolytic capacity for punching up short steep bergs and closing race gaps.
                </span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#A855F7]/20">
                <strong className="text-[#A855F7] block font-bold">3m - 8m Maximal Aerobic (VO2)</strong>
                <span className="text-slate-300 text-[11px] block mt-1">
                  Cardiac stroke volume and oxygen uptake limit. Prime benchmark of pure aerobic engine.
                </span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#00E5A3]/20">
                <strong className="text-[#00E5A3] block font-bold">20m - 60m Functional Threshold</strong>
                <span className="text-slate-300 text-[11px] block mt-1">
                  Maximal lactate steady state (MLSS). The critical benchmark for TT and long climbs.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER VIEW: HRV */}
      {activeTab === 'hrv' && (
        <div className="space-y-6">
          <HrvChart data={wellness} />

          <div className="bg-[#111622] border border-[#232D42] rounded-2xl p-5 shadow-lg">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
              Interpreting Heart Rate Variability (rMSSD)
            </h4>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              HRV measures time micro-variations between heartbeats. Higher variability reflects healthy parasympathetic (rest & digest) dominance, while lower values reflect sympathetic (fight or flight) stress:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#00E5A3]/20">
                <strong className="text-[#00E5A3] block font-bold">Balanced Inside Baseline</strong>
                <span className="text-slate-300 text-[11px] block mt-1">
                  Nervous system is responsive and recovered. Full capacity for hard intervals or heavy volume.
                </span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#F59E0B]/20">
                <strong className="text-[#F59E0B] block font-bold">Suppressed Below Baseline</strong>
                <span className="text-slate-300 text-[11px] block mt-1">
                  Accumulated fatigue, poor sleep, travel, or immune defense. Scale back intensity to Zone 1/2.
                </span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#38BDF8]/20">
                <strong className="text-[#38BDF8] block font-bold">Atypically Elevated</strong>
                <span className="text-slate-300 text-[11px] block mt-1">
                  Hyper-recovery response often following extreme strain or taper. Pair with subjective feel.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER VIEW: RESTING HR */}
      {activeTab === 'resting_hr' && (
        <div className="space-y-6">
          <RestingHrChart data={wellness} defaultRHR={athlete?.restingHR ?? 46} />

          <div className="bg-[#111622] border border-[#232D42] rounded-2xl p-5 shadow-lg">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
              Resting Pulse as a Biomarker
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your resting heart rate reflects cardiac chamber volume and stroke efficiency. A steady or downward trend confirms positive cardiovascular adaptations from training volume, whereas an acute spike of +4 bpm or more is the earliest indicator of systemic fatigue or impending illness.
            </p>
          </div>
        </div>
      )}

      {/* RENDER VIEW: SLEEP */}
      {activeTab === 'sleep' && (
        <div className="space-y-6">
          <SleepChart data={wellness} />

          <div className="bg-[#111622] border border-[#232D42] rounded-2xl p-5 shadow-lg">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
              Sleep Debt & Athletic Restoration
            </h4>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              During deep slow-wave sleep, human growth hormone (HGH) releases to rebuild muscle fibers and clear neural metabolic waste:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
                <strong className="text-white block font-bold">7h 30m - 9h 00m</strong>
                <span className="text-slate-400 text-[11px] block mt-1">
                  Target duration for endurance athletes maintaining high training loads.
                </span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
                <strong className="text-white block font-bold">Consistent Bedtimes</strong>
                <span className="text-slate-400 text-[11px] block mt-1">
                  Regular circadian rhythm improves sleep efficiency by up to 18%.
                </span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
                <strong className="text-white block font-bold">Sleep Debt Elimination</strong>
                <span className="text-slate-400 text-[11px] block mt-1">
                  Keep weekly deficit under 60 minutes to maintain peak cognitive and physical reaction time.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER VIEW: VO2 MAX */}
      {activeTab === 'vo2max' && (
        <div className="space-y-6">
          <Vo2MaxChart data={wellness} currentVo2Max={vo2max} />

          <div className="bg-[#111622] border border-[#232D42] rounded-2xl p-5 shadow-lg">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
              Aerobic Capacity Classification (ml/kg/min)
            </h4>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              VO2 Max measures the maximum milliliters of oxygen your body can utilize per kilogram of body weight per minute:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#A855F7]/30">
                <span className="text-[#A855F7] font-black block">56+ ml/kg/min</span>
                <strong className="text-white block font-bold mt-1">Superior</strong>
                <span className="text-slate-400 text-[10px] block mt-0.5">Top 5% competitive tier</span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#00E5A3]/30">
                <span className="text-[#00E5A3] font-black block">50 - 55 ml/kg/min</span>
                <strong className="text-white block font-bold mt-1">Excellent</strong>
                <span className="text-slate-400 text-[10px] block mt-0.5">High amateur endurance</span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#38BDF8]/30">
                <span className="text-[#38BDF8] font-black block">44 - 49 ml/kg/min</span>
                <strong className="text-white block font-bold mt-1">Good</strong>
                <span className="text-slate-400 text-[10px] block mt-0.5">Above average athlete</span>
              </div>

              <div className="bg-[#151C2C] p-3.5 rounded-xl border border-[#F59E0B]/30">
                <span className="text-[#F59E0B] font-black block">&lt; 44 ml/kg/min</span>
                <strong className="text-white block font-bold mt-1">Fair</strong>
                <span className="text-slate-400 text-[10px] block mt-0.5">Baseline aerobic fitness</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wellness History Table */}
      <div className="bg-[#111622] border border-[#232D42] rounded-2xl p-5 shadow-lg">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">
          Daily Wellness & Biometrics Log History ({sortedWellness.length} records)
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-slate-400 uppercase text-[10px] font-bold border-b border-white/5">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Fitness (CTL)</th>
                <th className="py-2.5 px-3">Fatigue (ATL)</th>
                <th className="py-2.5 px-3">Form (TSB)</th>
                <th className="py-2.5 px-3">HRV</th>
                <th className="py-2.5 px-3">Sleep</th>
                <th className="py-2.5 px-3">Sleep Score</th>
                <th className="py-2.5 px-3">Rest HR</th>
                <th className="py-2.5 px-3">VO2 Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedWellness.slice(0, 15).map((w) => {
                const itemTsb = w.tsb ?? (w.ctl && w.atl ? w.ctl - w.atl : 0);
                const st = getFormStatus(itemTsb);
                return (
                  <tr key={w.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white">{formatDateShort(w.id)}</td>
                    <td className="py-2.5 px-3 text-[#38BDF8] font-bold">{w.ctl ?? '--'}</td>
                    <td className="py-2.5 px-3 text-[#A855F7] font-bold">{w.atl ?? '--'}</td>
                    <td className="py-2.5 px-3 font-bold" style={{ color: st.color }}>
                      {itemTsb > 0 ? `+${Math.round(itemTsb)}` : Math.round(itemTsb)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{w.hrv ? `${w.hrv} ms` : '--'}</td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {w.sleepSecs ? formatDuration(w.sleepSecs) : '--'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {w.sleepScore ? `${w.sleepScore}%` : '--'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {w.restingHR ? `${w.restingHR} bpm` : '--'}
                    </td>
                    <td className="py-2.5 px-3 text-[#A855F7] font-bold">
                      {w.vo2max ? `${w.vo2max}` : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
