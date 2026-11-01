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
  isSmall?: boolean; // Ultra-compact mode for mobile / APK cockpit
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
  isSmall = false,
}) => {
  // Determine if this is a Ride Studio HUD card or a Dashboard metric card
  const isHud = variant === 'hud' || gaugePercent !== undefined || footer !== undefined;

  if (isHud) {
    const effectiveGaugeColor = gaugeColor || accentColor;

    if (isSmall) {
      // Compact cockpit HUD card (fits in 2x2 grid without scrolling on mobile/APK)
      return (
        <div
          onClick={onClick}
          className={`relative overflow-hidden rounded-xl bg-[#111622]/95 border p-2 sm:p-2.5 backdrop-blur-md transition-all duration-200 flex flex-col justify-between ${
            highlight
              ? 'border-[#00E5A3]/60 shadow-[0_0_15px_-3px_rgba(0,229,163,0.3)]'
              : 'border-[#232D42] hover:border-slate-700 shadow-md'
          } ${onClick ? 'cursor-pointer hover:border-white/20' : ''}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-1 leading-none">
            <div className="flex items-center gap-1.5">
              {icon && <span style={{ color: accentColor }} className="shrink-0">{icon}</span>}
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                {label}
              </span>
            </div>
            {subValue && (
              <div className="text-[10px] font-semibold text-slate-300 truncate">
                {subValue}
              </div>
            )}
          </div>

          {/* Main Number */}
          <div className="flex items-baseline justify-center gap-1 my-0.5">
            <span
              className="text-2xl sm:text-3xl font-black font-mono tracking-tight transition-colors duration-150"
              style={{ color: accentColor }}
            >
              {value}
            </span>
            {unit && (
              <span className="text-[10px] font-bold uppercase text-slate-400">
                {unit}
              </span>
            )}
          </div>

          {/* Mini Gauge Bar */}
          {gaugePercent !== undefined && (
            <div className="w-full bg-slate-800/80 rounded-full h-1 my-0.5 overflow-hidden">
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
          {footer && (
            <div className="pt-1 border-t border-[#232D42]/80 text-[10px] leading-tight text-slate-400">
              {footer}
            </div>
          )}
        </div>
      );
    }

    // Standard Desktop HUD card
    return (
      <div
        onClick={onClick}
        className={`relative overflow-hidden rounded-2xl bg-[#111622]/95 border p-4 sm:p-5 backdrop-blur-md transition-all duration-200 flex flex-col justify-between ${
          highlight
            ? 'border-[#00E5A3]/60 shadow-[0_0_25px_-5px_rgba(0,229,163,0.3)]'
            : 'border-[#232D42] hover:border-slate-700 shadow-lg'
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
            className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight font-mono transition-colors duration-150"
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
          <div className="w-full bg-slate-800/80 rounded-full h-1.5 sm:h-2 mb-2 overflow-hidden">
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
        {footer && <div className="mt-1 pt-2 border-t border-[#232D42]">{footer}</div>}
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
