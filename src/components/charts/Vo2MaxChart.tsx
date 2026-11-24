import { Award, Flame, Info, TrendingUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Wellness } from '../../types/intervals';
import { formatDateShort } from '../../utils/formatters';
import { isAndroid } from '../../utils/platform';

interface Vo2MaxChartProps {
  data: Wellness[];
  currentVo2Max?: number | null;
}

type RangeOption = '14' | '30' | '90' | '180';

export const Vo2MaxChart: React.FC<Vo2MaxChartProps> = ({
  data,
  currentVo2Max = null,
}) => {
  const [range, setRange] = useState<RangeOption>('30');

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const sorted = [...data]
      .filter((d) => typeof d.vo2max === 'number' && Number.isFinite(d.vo2max) && d.vo2max > 0)
      .sort((a, b) => new Date(a.id).getTime() - new Date(b.id).getTime());

    const limit = parseInt(range, 10);
    const sliced = sorted.slice(-limit);

    return sliced.map((d) => ({
      id: d.id,
      vo2max: d.vo2max as number,
    }));
  }, [data, range]);

  const latest =
    chartData.length > 0
      ? chartData[chartData.length - 1].vo2max
      : typeof currentVo2Max === 'number' && Number.isFinite(currentVo2Max) && currentVo2Max > 0
      ? currentVo2Max
      : null;
  const earliest = chartData.length > 0 ? chartData[0].vo2max : null;
  const change =
    chartData.length >= 2 && latest !== null && earliest !== null
      ? Math.round((latest - earliest) * 10) / 10
      : null;

  const getClassification = (score: number) => {
    if (score >= 56) return { tier: 'Superior', color: '#A855F7', desc: 'Top 5% of athletes' };
    if (score >= 50) return { tier: 'Excellent', color: '#00E5A3', desc: 'Top 15% aerobic capacity' };
    if (score >= 44) return { tier: 'Good', color: '#38BDF8', desc: 'Above average fitness' };
    return { tier: 'Fair', color: '#F59E0B', desc: 'Average aerobic baseline' };
  };

  const classification = latest !== null ? getClassification(latest) : null;
  const isAndroidApp = isAndroid();

  return (
    <div className={`bg-[#1F2025] rounded-2xl border border-[#383941] shadow-xl ${isAndroidApp ? 'p-3' : 'p-5'}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
              Aerobic Capacity
            </span>
            {classification ? (
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold"
                style={{
                  backgroundColor: `${classification.color}20`,
                  color: classification.color,
                  border: `1px solid ${classification.color}40`,
                }}
              >
                {classification.tier} ({classification.desc})
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10">
                No data
              </span>
            )}
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white mt-0.5">
            VO2 Max Progression & Aerobic Fitness Trend
          </h3>
        </div>

        {/* Range Selector (Desktop / Web only in header) */}
        {!isAndroidApp && (
          <div className="flex items-center bg-[#2F3037] p-1 rounded-xl border border-[#383941]">
            {(['14', '30', '90', '180'] as RangeOption[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  range === r
                    ? 'bg-[#3E4049] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r}D
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hero Stats Triplet (Desktop / Web only in header) */}
      {!isAndroidApp && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Current VO2 Max
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-white">
                  {latest !== null ? latest.toFixed(1) : '--'}
                </span>
                {latest !== null && (
                  <span className="text-xs text-slate-400 font-bold">ml/kg/min</span>
                )}
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: `${classification?.color ?? '#64748B'}15`,
                color: classification?.color ?? '#64748B',
              }}
            >
              <Award className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {range}D Progression
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  className="text-2xl font-black"
                  style={{
                    color:
                      change === null
                        ? '#94A3B8'
                        : change >= 0
                        ? '#00E5A3'
                        : '#EF4444',
                  }}
                >
                  {change === null
                    ? '--'
                    : change >= 0
                    ? `+${change.toFixed(1)}`
                    : change.toFixed(1)}
                </span>
                {change !== null && (
                  <span className="text-xs text-slate-400 font-bold">ml/kg/min</span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#00E5A3]/15 text-[#00E5A3] flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Aerobic Tier
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  className="text-2xl font-black"
                  style={{ color: classification?.color ?? '#94A3B8' }}
                >
                  {classification ? classification.tier : '--'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                {classification ? classification.desc : 'No VO2 Max recorded'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#A855F7]/15 text-[#A855F7] flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className={`w-full ${isAndroidApp ? 'h-[250px]' : 'h-[280px]'}`}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="vo2Purple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A855F7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#A855F7" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#383941" vertical={false} />

              {/* Superior Tier Reference Area (56+) */}
              <ReferenceArea
                y1={56}
                y2={65}
                fill="rgba(168, 85, 247, 0.06)"
                strokeOpacity={0}
              />

              <XAxis
                dataKey="id"
                tickFormatter={(v) => formatDateShort(v)}
                stroke="#64748B"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#383941' }}
              />
              <YAxis
                domain={['dataMin - 2', 'dataMax + 2']}
                stroke="#64748B"
                tick={{ fill: '#94A3B8', fontSize: 10 }}
                fontSize={10}
                width={32}
                tickLine={false}
                axisLine={{ stroke: '#383941' }}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload as { id: string; vo2max: number };
                    const tier = getClassification(d.vo2max);
                    return (
                      <div className="bg-[#2F3037] border border-[#383941] p-3 rounded-xl shadow-2xl text-xs">
                        <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1.5">
                          {d.id}
                        </div>
                        <div className="flex justify-between gap-4 text-[#A855F7]">
                          <span>VO2 Max:</span>
                          <strong className="text-white">{d.vo2max} ml/kg/min</strong>
                        </div>
                        <div className="mt-1 text-[10px]" style={{ color: tier.color }}>
                          Classification: {tier.tier} ({tier.desc})
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey="vo2max"
                stroke="#A855F7"
                strokeWidth={3}
                fill="url(#vo2Purple)"
                name="VO2 Max"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center gap-1.5 bg-[#26272D] rounded-xl border border-[#383941] px-6">
            <Award className="w-5 h-5 text-slate-500" />
            <span className="text-sm font-bold text-white">No VO2 Max data available</span>
            <span className="text-xs text-slate-400 max-w-md">
              No recorded VO2 Max values were found in your synced wellness history.
            </span>
          </div>
        )}
      </div>

      {/* Android Controls & Compact Stats Below Chart */}
      {isAndroidApp ? (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
          {/* Controls: Range Selector */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Range:
            </span>
            <div className="flex items-center bg-[#2F3037] p-0.5 rounded-xl border border-[#383941]">
              {(['14', '30', '90', '180'] as RangeOption[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    range === r
                      ? 'bg-[#3E4049] text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r}D
                </button>
              ))}
            </div>
          </div>

          {/* Compact Hero Stats Below Chart */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#26272D] p-2 rounded-xl border border-white/5 text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Current
              </span>
              <div className="flex items-baseline justify-center gap-1 mt-0.5">
                <span className="text-lg font-black text-white">
                  {latest !== null ? latest.toFixed(1) : '--'}
                </span>
                {latest !== null && <span className="text-[9px] text-slate-400">ml/kg</span>}
              </div>
              <span
                className="text-[9px] font-bold block truncate"
                style={{ color: classification?.color ?? '#94A3B8' }}
              >
                {classification ? classification.tier : '--'}
              </span>
            </div>

            <div className="bg-[#26272D] p-2 rounded-xl border border-white/5 text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Progression
              </span>
              <div className="flex items-baseline justify-center gap-1 mt-0.5">
                <span
                  className="text-lg font-black"
                  style={{
                    color:
                      change === null
                        ? '#94A3B8'
                        : change >= 0
                        ? '#00E5A3'
                        : '#EF4444',
                  }}
                >
                  {change === null
                    ? '--'
                    : change >= 0
                    ? `+${change.toFixed(1)}`
                    : change.toFixed(1)}
                </span>
                {change !== null && <span className="text-[9px] text-slate-400">ml/kg</span>}
              </div>
              <span className="text-[9px] text-slate-400">{range}d Delta</span>
            </div>

            <div className="bg-[#26272D] p-2 rounded-xl border border-white/5 text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Tier
              </span>
              <div className="flex items-baseline justify-center gap-1 mt-0.5">
                <span
                  className="text-sm font-black"
                  style={{ color: classification?.color ?? '#94A3B8' }}
                >
                  {classification ? classification.tier : '--'}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 truncate block">
                {classification ? classification.desc : 'No data'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-[#A855F7]" />
            <span>
              Superior zone (&gt;56): <strong className="text-white">Elite aerobic capacity</strong>
            </span>
          </div>
          <span className="text-slate-500 text-[11px]">
            Recorded VO2 Max values from your wellness log
          </span>
        </div>
      )}
    </div>
  );
};
