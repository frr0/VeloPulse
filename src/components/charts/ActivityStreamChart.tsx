import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
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
  /** Name of the metric, for example `Power`. */
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
  /** Callback fired when the user clicks and drags to select a [startSec, endSec] range. */
  onSelectRange?: (range: [number, number]) => void;
  /** Callback fired when the user double-clicks the chart to reset zoom. */
  onResetRange?: () => void;
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
 * One metric of an activity over time, with the value and the time under the
 * pointer or finger. Gaps stay gaps (`connectNulls={false}`), and an expand
 * button opens a full-size modal view.
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
  onSelectRange,
  onResetRange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [dragBox, setDragBox] = useState<{ left: number; width: number } | null>(null);
  const dragRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });
  const dragPixelRef = useRef<{ startX: number; rectLeft: number; rectWidth: number } | null>(null);

  const ticks = useMemo(() => timeTicks(rows), [rows]);
  const formatValue = (value: number): string => value.toFixed(decimals);
  const hasAltitudeBackground =
    title !== 'Altitude' && rows.some((r) => r.alt !== null && r.alt !== undefined);

  const commitDragSelection = useCallback(() => {
    const { start, end } = dragRef.current;
    dragRef.current = { start: null, end: null };
    dragPixelRef.current = null;
    setDragStart(null);
    setDragEnd(null);
    setDragBox(null);
    if (start !== null && end !== null && onSelectRange) {
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      if (hi - lo >= 2) {
        onSelectRange([lo, hi]);
      }
    }
  }, [onSelectRange]);

  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || rows.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const plotLeft = 24;
    const plotRight = Math.max(plotLeft + 1, rect.width - 8);
    const x = Math.max(plotLeft, Math.min(plotRight, e.clientX - rect.left));
    dragPixelRef.current = { startX: x, rectLeft: rect.left, rectWidth: rect.width };
    setDragBox({ left: x, width: 0 });
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragPixelRef.current) return;
    const { startX, rectLeft, rectWidth } = dragPixelRef.current;
    const plotLeft = 24;
    const plotRight = Math.max(plotLeft + 1, rectWidth - 8);
    const currX = Math.max(plotLeft, Math.min(plotRight, e.clientX - rectLeft));
    const left = Math.min(startX, currX);
    const width = Math.abs(currX - startX);
    setDragBox({ left, width });
  };

  // Complete drag cleanly even if mouse is released outside the chart area
  useEffect(() => {
    if (dragStart === null && dragBox === null) return;
    const handleWindowMouseUp = () => commitDragSelection();
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [dragStart, dragBox, commitDragSelection]);

  const extractTimeFromState = (state: { activeLabel?: unknown; activePayload?: Array<{ payload?: StreamChartRow }> } | null | undefined): number | null => {
    if (!state) return null;
    if (state.activePayload && state.activePayload.length > 0) {
      const t = state.activePayload[0]?.payload?.t;
      if (typeof t === 'number' && Number.isFinite(t)) return t;
    }
    if (typeof state.activeLabel === 'number' && Number.isFinite(state.activeLabel)) {
      return state.activeLabel;
    }
    return null;
  };

  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const renderAreaChart = (expanded: boolean) => {
    const activeGradientId = expanded ? `${gradientId}-expanded` : gradientId;
    const selMin = dragStart !== null && dragEnd !== null ? Math.min(dragStart, dragEnd) : null;
    const selMax = dragStart !== null && dragEnd !== null ? Math.max(dragStart, dragEnd) : null;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rows}
          margin={{ top: 6, right: 8, left: -22, bottom: 0 }}
          onMouseDown={(state) => {
            const t = extractTimeFromState(state);
            if (t !== null) {
              dragRef.current = { start: t, end: t };
              setDragStart(t);
              setDragEnd(t);
            }
          }}
          onMouseMove={(state) => {
            if (dragRef.current.start !== null) {
              const t = extractTimeFromState(state);
              if (t !== null) {
                dragRef.current.end = t;
                setDragEnd(t);
              }
            }
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
          onMouseUp={() => {
            if (dragRef.current.start !== null) {
              commitDragSelection();
            }
          }}
          onMouseLeave={() => {
            if (onHoverPoint) {
              onHoverPoint(null);
            }
          }}
        >
          <defs>
            <linearGradient id={activeGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            {hasAltitudeBackground && (
              <linearGradient id={`${activeGradientId}-alt`} x1="0" y1="0" x2="0" y2="1">
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
            fontSize={expanded ? 11 : 10}
            tickLine={false}
            axisLine={{ stroke: '#383941' }}
            minTickGap={16}
          />
          <YAxis
            domain={['auto', 'auto']}
            stroke="#64748B"
            fontSize={expanded ? 11 : 10}
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
                fontSize: expanded ? 11 : 10,
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
                      <span className="text-slate-400">Elevation:</span>
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
              name="Altitude"
              stroke="#64748B"
              strokeWidth={1}
              strokeOpacity={0.35}
              fill={`url(#${activeGradientId}-alt)`}
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
            fill={`url(#${activeGradientId})`}
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

          {/* Live click-and-drag selection band & 2 endpoint markers */}
          {selMin !== null && selMax !== null && selMax > selMin && (
            <>
              <ReferenceArea
                x1={selMin}
                x2={selMax}
                fill="#FC5200"
                fillOpacity={0.22}
                strokeOpacity={0}
              />
              <ReferenceLine x={selMin} stroke="#FC5200" strokeWidth={2} />
              <ReferenceLine x={selMax} stroke="#FC5200" strokeWidth={2} />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <>
      <div className="py-5 border-b border-white/10 last:border-b-0">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200 truncate">
              {title}
            </h4>
            <span className="text-[10px] font-bold text-slate-400 shrink-0">({unit})</span>
            {hasAltitudeBackground && (
              <span className="hidden sm:inline-block text-[10px] font-semibold text-slate-400/80 px-2 py-0.5 rounded-full bg-white/[0.04]">
                Elevation Bg
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {highlight && (
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: highlight.color }}
                />
                {highlight.label}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              title="Expand chart"
              aria-label={`Expand ${title} chart`}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-[10px] font-bold text-slate-300 hover:text-white transition-colors"
            >
              <Maximize2 className="w-3 h-3 text-[#00E5A3]" />
              <span className="hidden sm:inline">Expand</span>
            </button>
          </div>
        </div>

        <div
          className="relative w-full h-[180px] sm:h-[200px] select-none cursor-crosshair"
          onMouseDown={handleContainerMouseDown}
          onMouseMove={handleContainerMouseMove}
          onDoubleClick={() => {
            dragRef.current = { start: null, end: null };
            dragPixelRef.current = null;
            setDragStart(null);
            setDragEnd(null);
            setDragBox(null);
            onResetRange?.();
          }}
        >
          {renderAreaChart(false)}
          {dragBox && dragBox.width > 2 && (
            <div
              className="pointer-events-none absolute top-[6px] bottom-[24px] bg-[#FC5200]/20 border-x-2 border-[#FC5200] rounded-[2px] z-10"
              style={{ left: `${dragBox.left}px`, width: `${dragBox.width}px` }}
            />
          )}
        </div>

        {footnote && <p className="mt-2 text-[11px] text-slate-500">{footnote}</p>}
      </div>

      {/* Expanded Full-Screen Modal */}
      {isExpanded && (
        <div
          data-chart-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="w-full max-w-6xl bg-[#0f121a]/95 border border-white/15 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {icon}
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white truncate">
                  {title}
                </h3>
                <span className="text-xs font-bold text-slate-400 shrink-0">({unit})</span>
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                aria-label="Close expanded chart"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>

            {highlight && (
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: highlight.color }}
                />
                <span>{highlight.label}</span>
              </div>
            )}

            <div
              className="relative w-full h-[65vh] min-h-[360px] select-none cursor-crosshair"
              onMouseDown={handleContainerMouseDown}
              onMouseMove={handleContainerMouseMove}
              onDoubleClick={() => {
                dragRef.current = { start: null, end: null };
                dragPixelRef.current = null;
                setDragStart(null);
                setDragEnd(null);
                setDragBox(null);
                onResetRange?.();
              }}
            >
              {renderAreaChart(true)}
              {dragBox && dragBox.width > 2 && (
                <div
                  className="pointer-events-none absolute top-[6px] bottom-[24px] bg-[#FC5200]/20 border-x-2 border-[#FC5200] rounded-[2px] z-10"
                  style={{ left: `${dragBox.left}px`, width: `${dragBox.width}px` }}
                />
              )}
            </div>

            {footnote && <p className="text-xs text-slate-400">{footnote}</p>}
          </div>
        </div>
      )}
    </>
  );
};
