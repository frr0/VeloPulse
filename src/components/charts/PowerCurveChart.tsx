import { Zap } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PowerCurvePoint } from '../../types/intervals';

interface PowerCurveChartProps {
  data: PowerCurvePoint[];
  ftp?: number;
  weight?: number;
}

type PowerMetric = 'watts' | 'wkg';
type ComparisonMode = 'recent' | 'season';

export const PowerCurveChart: React.FC<PowerCurveChartProps> = ({
  data,
  ftp = 295,
  weight = 68.5,
}) => {
  const [metric, setMetric] = useState<PowerMetric>('watts');
  const [mode, setMode] = useState<ComparisonMode>('recent');

  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      currentVal: metric === 'watts' ? d.watts : d.wkg,
      seasonVal:
        metric === 'watts'
          ? d.seasonWatts ?? d.watts
          : d.seasonWkg ?? d.wkg,
    }));
  }, [data, metric]);

  const p5s = data.find((d) => d.secs === 5);
  const p1m = data.find((d) => d.secs === 60);
  const p5m = data.find((d) => d.secs === 300);
  const p20m = data.find((d) => d.secs === 1200);
  const p1h = data.find((d) => d.secs === 3600);

  const getPointWatts = (p?: PowerCurvePoint) => {
    if (!p) return null;
    const val = mode === 'season' && p.seasonWatts ? p.seasonWatts : p.watts;
    return val > 0 ? val : null;
  };

  const getPointWkg = (p?: PowerCurvePoint) => {
    if (!p) return null;
    const val = mode === 'season' && p.seasonWkg ? p.seasonWkg : p.wkg;
    return val > 0 ? val : null;
  };

  const ftpWkg = weight > 0 ? (ftp / weight).toFixed(1) : '4.3';

  return (
    <div className="bg-[#1F2025] rounded-2xl p-5 border border-[#383941] shadow-xl">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">
              Power Duration Curve
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FC5200]/20 text-[#FC5200] border border-[#FC5200]/30">
              MMP & Best Efforts
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-0.5">
            Mean Maximal Power across Critical Durations
          </h3>
        </div>

        {/* Toggle Switches */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Watts vs W/kg */}
          <div className="flex items-center bg-[#2F3037] p-1 rounded-xl border border-[#383941]">
            <button
              onClick={() => setMetric('watts')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                metric === 'watts'
                  ? 'bg-[#FC5200] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Watts (W)
            </button>
            <button
              onClick={() => setMetric('wkg')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                metric === 'wkg'
                  ? 'bg-[#FC5200] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              W/kg
            </button>
          </div>

          {/* Recent vs Season */}
          <div className="flex items-center bg-[#2F3037] p-1 rounded-xl border border-[#383941]">
            <button
              onClick={() => setMode('recent')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                mode === 'recent'
                  ? 'bg-[#3E4049] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Recent 30D
            </button>
            <button
              onClick={() => setMode('season')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                mode === 'season'
                  ? 'bg-[#3E4049] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Season Best
            </button>
          </div>
        </div>
      </div>

      {/* Benchmark Summary Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5">
        <div className="bg-[#26272D] p-3 rounded-xl border border-white/5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            5s Sprint
          </span>
          <span className="text-lg font-black text-white mt-0.5 block">
            {getPointWatts(p5s) !== null ? (
              <>
                {getPointWatts(p5s)} <span className="text-xs font-semibold text-slate-400">W</span>
              </>
            ) : (
              '--'
            )}
          </span>
          <span className="text-[11px] font-semibold text-[#FC5200]">
            {getPointWkg(p5s) !== null ? `${getPointWkg(p5s)} W/kg` : '--'}
          </span>
        </div>

        <div className="bg-[#26272D] p-3 rounded-xl border border-white/5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            1m Anaerobic
          </span>
          <span className="text-lg font-black text-white mt-0.5 block">
            {getPointWatts(p1m) !== null ? (
              <>
                {getPointWatts(p1m)} <span className="text-xs font-semibold text-slate-400">W</span>
              </>
            ) : (
              '--'
            )}
          </span>
          <span className="text-[11px] font-semibold text-[#FC5200]">
            {getPointWkg(p1m) !== null ? `${getPointWkg(p1m)} W/kg` : '--'}
          </span>
        </div>

        <div className="bg-[#26272D] p-3 rounded-xl border border-white/5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            5m VO2 Max
          </span>
          <span className="text-lg font-black text-white mt-0.5 block">
            {getPointWatts(p5m) !== null ? (
              <>
                {getPointWatts(p5m)} <span className="text-xs font-semibold text-slate-400">W</span>
              </>
            ) : (
              '--'
            )}
          </span>
          <span className="text-[11px] font-semibold text-[#38BDF8]">
            {getPointWkg(p5m) !== null ? `${getPointWkg(p5m)} W/kg` : '--'}
          </span>
        </div>

        <div className="bg-[#26272D] p-3 rounded-xl border border-white/5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            20m Threshold
          </span>
          <span className="text-lg font-black text-white mt-0.5 block">
            {getPointWatts(p20m) !== null ? (
              <>
                {getPointWatts(p20m)} <span className="text-xs font-semibold text-slate-400">W</span>
              </>
            ) : (
              '--'
            )}
          </span>
          <span className="text-[11px] font-semibold text-[#00E5A3]">
            {getPointWkg(p20m) !== null ? `${getPointWkg(p20m)} W/kg` : '--'}
          </span>
        </div>

        <div className="bg-[#26272D] p-3 rounded-xl border border-white/5 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            60m Hour
          </span>
          <span className="text-lg font-black text-white mt-0.5 block">
            {getPointWatts(p1h) !== null ? (
              <>
                {getPointWatts(p1h)} <span className="text-xs font-semibold text-slate-400">W</span>
              </>
            ) : (
              '--'
            )}
          </span>
          <span className="text-[11px] font-semibold text-[#A855F7]">
            {getPointWkg(p1h) !== null ? `${getPointWkg(p1h)} W/kg` : '--'}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="powerOrange" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FC5200" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#FC5200" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="seasonCyan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#383941" vertical={false} />

            <XAxis
              dataKey="label"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#383941' }}
            />
            <YAxis
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#383941' }}
              unit={metric === 'watts' ? 'W' : ''}
            />

            {/* Reference FTP line */}
            <ReferenceLine
              y={metric === 'watts' ? ftp : parseFloat(ftpWkg)}
              stroke="#00E5A3"
              strokeDasharray="4 4"
              label={{
                value: `FTP ${ftp}W`,
                fill: '#00E5A3',
                fontSize: 10,
                position: 'right',
              }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload as PowerCurvePoint;
                  return (
                    <div className="bg-[#2F3037] border border-[#383941] p-3 rounded-xl shadow-2xl text-xs">
                      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-1.5 mb-1.5">
                        <strong className="text-white text-sm">{d.label} Effort</strong>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                          {d.category}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4 text-[#FC5200]">
                          <span>Recent Power:</span>
                          <strong className="text-white">
                            {d.watts} W ({d.wkg} W/kg)
                          </strong>
                        </div>
                        {d.seasonWatts && (
                          <div className="flex justify-between gap-4 text-[#38BDF8]">
                            <span>Season Best:</span>
                            <strong className="text-white">
                              {d.seasonWatts} W ({d.seasonWkg} W/kg)
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {mode === 'season' && (
              <Area
                type="monotone"
                dataKey="seasonVal"
                stroke="#38BDF8"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="url(#seasonCyan)"
                name="Season Best"
              />
            )}

            <Area
              type="monotone"
              dataKey="currentVal"
              stroke="#FC5200"
              strokeWidth={3}
              fill="url(#powerOrange)"
              name="Power"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Info */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#FC5200]" />
          <span>
            Functional Threshold Power: <strong className="text-white">{ftp} W</strong> ({ftpWkg} W/kg)
          </span>
        </div>
        <span className="text-slate-500 text-[11px]">Calculated from maximal sustained aerobic power</span>
      </div>
    </div>
  );
};
