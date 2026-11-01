import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subValue?: string | React.ReactNode;
  icon?: React.ReactNode;
  accentColor?: string;
  gaugePercent?: number; // 0 to 100
  gaugeColor?: string;
  footer?: React.ReactNode;
  highlight?: boolean;
  onClick?: () => void;
  variant?: 'hud' | 'compact';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit = '',
  subValue,
  icon,
  accentColor = '#00E5A3',
  gaugePercent,
  gaugeColor,
  footer,
  highlight = false,
  onClick,
  variant,
}) => {
  // Determine if this is a Ride Studio HUD card or a Dashboard metric card
  const isHud = variant === 'hud' || gaugePercent !== undefined || footer !== undefined;

  if (isHud) {
    const effectiveGaugeColor = gaugeColor || accentColor;
    return (
      <div
        onClick={onClick}
        className={`relative overflow-hidden rounded-2xl bg-slate-900/90 border p-5 backdrop-blur-md transition-all duration-200 flex flex-col justify-between ${
          highlight
            ? 'border-[#00E5A3]/60 shadow-[0_0_25px_-5px_rgba(0,229,163,0.3)]'
            : 'border-slate-800 hover:border-slate-700 shadow-lg'
        } ${onClick ? 'cursor-pointer hover:border-white/20' : ''}`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon && <span style={{ color: accentColor }}>{icon}</span>}
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {label}
            </span>
          </div>
          {subValue && (
            <div className="text-xs font-semibold text-slate-300">
              {subValue}
            </div>
          )}
        </div>

        {/* Main Big Readout */}
        <div className="flex items-baseline justify-center gap-2 my-2 py-1">
          <span
            className="text-5xl md:text-6xl font-black tracking-tight font-mono transition-colors duration-150"
            style={{ color: accentColor }}
          >
            {value}
          </span>
          {unit && (
            <span className="text-sm md:text-base font-bold uppercase text-slate-400">
              {unit}
            </span>
          )}
        </div>

        {/* Optional Progress / Gauge Bar */}
        {gaugePercent !== undefined && (
          <div className="w-full bg-slate-800/80 rounded-full h-2 mb-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(0, gaugePercent))}%`,
                backgroundColor: effectiveGaugeColor,
              }}
            />
          </div>
        )}

        {/* Footer Info */}
        {footer && <div className="mt-1 pt-2 border-t border-slate-800/80">{footer}</div>}
      </div>
    );
  }

  // Compact card (Dashboard / Fitness analytics view)
  return (
    <div
      onClick={onClick}
      className={`bg-[#111622] rounded-2xl p-4 sm:p-5 border border-[#232D42] shadow-lg flex flex-col justify-between transition-all ${
        onClick ? 'cursor-pointer hover:border-[#00E5A3]/40 hover:bg-[#141C2B]' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <div
          className="p-2 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
        >
          {icon}
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {value}
          </span>
          {unit && <span className="text-xs font-bold text-slate-400">{unit}</span>}
        </div>

        {subValue && (
          <div className="text-[11px] font-semibold text-slate-400 mt-1 flex items-center gap-1">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
};
