import React, { useMemo } from 'react';
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
import { formatElapsed } from '../../utils/activityAnalysis';

/** One drawn sample. `low` carries the value only where the chart must mark it. */
export interface StreamChartRow {
  /** Elapsed seconds. */
  t: number;
  /** Recorded value, or null where the device recorded nothing. */
  v: number | null;
  /** Same value, repeated only on the stretch to mark. */
  low?: number | null;
  /** Background altitude in meters, if available. */
  alt?: number | null;
  /** Latitude and Longitude [lat, lng] at this moment in time. */
  latlng?: [number, number] | null;
}

export interface StreamChartHighlight {
  color: string;
  label: string;
}

export interface StreamChartReference {
  y: number;
  label: string;
  color: string;
}

interface ActivityStreamChartProps {
  /** Name of the grandeur, for example `Potenza`. */
  title: string;
  /** Unit shown next to the value, for example `W`. */
  unit: string;
  /** Colour of the line, from the palette of the app. */
  color: string;
  /** Unique id of the gradient: two charts on the same page must not share it. */
  gradientId: string;
  rows: StreamChartRow[];
  icon?: React.ReactNode;
  /** Decimals of the value in the tooltip. 0 by default. */
  decimals?: number;
  /** Style of the marked stretch, when the rows carry `low`. */
  highlight?: StreamChartHighlight;
  /** Dashed horizontal line, for example the quarter of a full reserve. */
  reference?: StreamChartReference;
  /** Short line under the chart. */
  footnote?: string;
  /** Callback fired when the pointer hovers over a point with coordinates. */
  onHoverPoint?: (coord: [number, number] | null) => void;
}

/** Ticks of the time axis: about six round marks over the whole activity. */
function timeTicks(rows: StreamChartRow[]): number[] {
  if (rows.length < 2) return [];
  const start = rows[0].t;
  const end = rows[rows.length - 1].t;
  const span = end - start;
  if (span <= 0) return [];

  const steps = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800];
  const step = steps.find((candidate) => span / candidate <= 6) ?? steps[steps.length - 1];

  const ticks: number[] = [];
  for (let tick = Math.ceil(start / step) * step; tick <= end; tick += step) {
    ticks.push(tick);
  }
  return ticks;
}

/**
 * One grandeur of an activity over time, with the value and the time under the
 * pointer or the finger.
 *
 * The component only draws what it receives: a gap in the series stays a gap,
 * because `connectNulls` is off and no value is interpolated across it.
 */
export const ActivityStreamChart: React.FC<ActivityStreamChartProps> = ({
  title,
  unit,
  color,
  gradientId,
  rows,
  icon,
  decimals = 0,
  highlight,
  reference,
  footnote,
  onHoverPoint,
}) => {
  const ticks = useMemo(() => timeTicks(rows), [rows]);
  const formatValue = (value: number): string => value.toFixed(decimals);
  const hasAltitudeBackground =
    title !== 'Altitudine' && rows.some((r) => r.alt !== null && r.alt !== undefined);

  return (
    <div className="bg-[#1F2025] border border-[#383941] rounded-3xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300 truncate">
            {title}
          </h4>
          <span className="text-[10px] font-bold text-slate-400 shrink-0">({unit})</span>
          {hasAltitudeBackground && (
            <span className="hidden sm:inline-block text-[10px] font-semibold text-slate-400/80 bg-slate-800/60 px-1.5 py-0.5 rounded border border-white/5">
              Sfondo: Quota
            </span>
          )}
        </div>
        {highlight && (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 shrink-0">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: highlight.color }}
            />
            {highlight.label}
          </span>
        )}
      </div>

      <div className="w-full h-[180px] sm:h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={rows}
            margin={{ top: 6, right: 8, left: -22, bottom: 0 }}
            onMouseMove={(state) => {
              if (onHoverPoint && state && state.activePayload && state.activePayload.length > 0) {
                const row = state.activePayload[0].payload as StreamChartRow;
                if (row.latlng && row.latlng[0] && row.latlng[1]) {
                  onHoverPoint(row.latlng);
                  return;
                }
              }
              if (onHoverPoint && (!state || !state.isTooltipActive)) {
                onHoverPoint(null);
              }
            }}
            onMouseLeave={() => {
              if (onHoverPoint) {
                onHoverPoint(null);
              }
            }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
              {hasAltitudeBackground && (
                <linearGradient id={`${gradientId}-alt`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748B" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#64748B" stopOpacity={0.03} />
                </linearGradient>
              )}
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#383941" vertical={false} />

            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={ticks.length > 0 ? ticks : undefined}
              tickFormatter={formatElapsed}
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#383941' }}
              minTickGap={16}
            />
            <YAxis
              domain={['auto', 'auto']}
              stroke="#64748B"
              fontSize={10}
              width={46}
              tickLine={false}
              axisLine={{ stroke: '#383941' }}
              tickFormatter={formatValue}
            />

            {/* Altitude background axis (hidden scale) */}
            {hasAltitudeBackground && (
              <YAxis
                yAxisId="alt"
                hide
                domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin * 0.9)), 'auto']}
              />
            )}

            {reference && (
              <ReferenceLine
                y={reference.y}
                stroke={reference.color}
                strokeDasharray="4 4"
                label={{
                  value: reference.label,
                  fill: reference.color,
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            )}

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0].payload as StreamChartRow;
                if (row.v === null || row.v === undefined) return null;
                return (
                  <div className="bg-[#2F3037] border border-[#383941] p-2.5 rounded-xl shadow-2xl text-xs space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {formatElapsed(row.t)}
                    </div>
                    <div className="font-black text-white text-sm" style={{ color }}>
                      {formatValue(row.v)}{' '}
                      <span className="text-[11px] font-semibold text-slate-300">{unit}</span>
                    </div>
                    {hasAltitudeBackground && row.alt !== null && row.alt !== undefined && (
                      <div className="text-[10px] font-semibold text-slate-300 flex items-center justify-between gap-3 border-t border-white/10 pt-1 mt-1">
                        <span className="text-slate-400">Quota:</span>
                        <span className="font-mono font-bold text-slate-200">{Math.round(row.alt)} m</span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* Subtle background altitude silhouette */}
            {hasAltitudeBackground && (
              <Area
                yAxisId="alt"
                type="monotone"
                dataKey="alt"
                name="Altitudine"
                stroke="#64748B"
                strokeWidth={1}
                strokeOpacity={0.35}
                fill={`url(#${gradientId}-alt)`}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls={true}
              />
            )}

            <Area
              type="monotone"
              dataKey="v"
              name={title}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 3, fill: color, stroke: '#1F2025', strokeWidth: 1 }}
              isAnimationActive={false}
              connectNulls={false}
            />

            {highlight && (
              <Area
                type="monotone"
                dataKey="low"
                name={highlight.label}
                stroke={highlight.color}
                strokeWidth={2.5}
                fill="none"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {footnote && <p className="mt-2 text-[11px] text-slate-400">{footnote}</p>}
    </div>
  );
};
