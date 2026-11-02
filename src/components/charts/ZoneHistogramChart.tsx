import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ZoneBucket, ZoneHistogram, formatElapsed } from '../../utils/activityAnalysis';
import { formatDuration } from '../../utils/formatters';

interface ZoneHistogramChartProps {
  title: string;
  histogram: ZoneHistogram;
  icon?: React.ReactNode;
  /** Short line under the chart, for example where the zones come from. */
  footnote?: string;
}

interface HistogramRow extends ZoneBucket {
  /** Short name on the axis, for example `Z3`. */
  short: string;
}

/**
 * Histogram of the time spent in each zone, with the duration and the share of
 * every zone. The numbers arrive already computed by the app on the recorded
 * series, so a session without a ready made split still gets its bars.
 */
export const ZoneHistogramChart: React.FC<ZoneHistogramChartProps> = ({
  title,
  histogram,
  icon,
  footnote,
}) => {
  const rows: HistogramRow[] = histogram.buckets.map((bucket) => ({
    ...bucket,
    short: `Z${bucket.zone}`,
  }));

  return (
    <div className="bg-[#1F2025] border border-[#383941] p-5 sm:p-6 rounded-3xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
            {title}
          </h3>
        </div>
        <span className="text-[10px] font-bold text-slate-400 shrink-0">
          Tempo registrato {formatDuration(Math.round(histogram.totalSeconds))}
        </span>
      </div>

      <div className="w-full h-[180px] sm:h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#383941" vertical={false} />
            <XAxis
              dataKey="short"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#383941' }}
            />
            <YAxis
              stroke="#64748B"
              fontSize={10}
              width={52}
              tickLine={false}
              axisLine={{ stroke: '#383941' }}
              tickFormatter={(value: number) => formatElapsed(value)}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0].payload as HistogramRow;
                return (
                  <div className="bg-[#2F3037] border border-[#383941] p-2.5 rounded-xl shadow-2xl text-xs">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      {row.label}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{row.range}</div>
                    <div className="mt-1 font-black text-white text-sm">
                      {formatDuration(Math.round(row.seconds))}{' '}
                      <span className="text-[11px] font-semibold text-slate-300">
                        ({row.percent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="seconds" radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {rows.map((row) => (
                <Cell key={row.zone} fill={row.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1.5 text-xs">
        {rows.map((row) => (
          <div
            key={row.zone}
            className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-slate-200 font-semibold truncate">{row.label}</span>
              <span className="text-[10px] text-slate-400 font-mono shrink-0 hidden sm:inline">
                ({row.range})
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-slate-400 font-mono">
                {formatDuration(Math.round(row.seconds))}
              </span>
              <span className="font-bold text-white w-12 text-right font-mono">
                {row.percent.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {footnote && <p className="text-[11px] text-slate-400">{footnote}</p>}
    </div>
  );
};
