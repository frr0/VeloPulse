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
  isSmall?: boolean; // Mobile / APK mode
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
      // Mobile / APK Cockpit HUD card: fills its quadrant on the phone screen
      return (
        <div
          onClick={onClick}
          className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-[#1F2025]/95 border p-2.5 sm:p-3.5 backdrop-blur-md transition-all duration-200 flex flex-col justify-between h-full ${
            highlight
              ? 'border-[#00E5A3]/60 shadow-[0_0_20px_-3px_rgba(0,229,163,0.35)]'
              : 'border-[#383941] hover:border-slate-700 shadow-md'
          } ${onClick ? 'cursor-pointer hover:border-white/20' : ''}`}
        >
          {/* Top Header */}
          <div className="flex items-center justify-between gap-1 leading-none mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {icon && <span style={{ color: accentColor }} className="shrink-0">{icon}</span>}
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300 truncate">
                {label}
              </span>
            </div>
            {subValue && (
              <div className="text-[11px] sm:text-xs font-semibold text-slate-300 truncate text-right">
                {subValue}
              </div>
            )}
          </div>

          {/* Main Number Readout */}
          <div className="flex items-baseline justify-center gap-1.5 my-auto py-1">
            <span
              className="text-4xl sm:text-5xl md:text-6xl font-black font-mono tracking-tight transition-colors duration-150 leading-none"
              style={{ color: accentColor }}
            >
              {value}
            </span>
            {unit && (
              <span className="text-sm sm:text-base font-bold uppercase text-slate-400">
                {unit}
              </span>
            )}
          </div>

          {/* Bottom section: Gauge & Footer */}
          <div className="space-y-1 mt-auto">
            {gaugePercent !== undefined && (
              <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, gaugePercent))}%`,
                    backgroundColor: effectiveGaugeColor,
                  }}
                />
              </div>
            )}

            {footer && (
              <div className="pt-1 border-t border-[#383941]/80 text-[11px] sm:text-xs leading-tight text-slate-400">
                {footer}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Full-Screen Desktop HUD card: spacious and prominent across the screen
    return (
      <div
        onClick={onClick}
        className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-[#1F2025]/95 border p-2.5 sm:p-3 backdrop-blur-md transition-all duration-200 flex flex-col justify-between h-full ${
          highlight
            ? 'border-[#00E5A3]/60 shadow-[0_0_25px_-5px_rgba(0,229,163,0.3)]'
            : 'border-[#383941] hover:border-slate-700 shadow-lg'
        } ${onClick ? 'cursor-pointer hover:border-white/20' : ''}`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-1.5 mb-1 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            {icon && <span style={{ color: accentColor }} className="scale-105 shrink-0">{icon}</span>}
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
              {label}
            </span>
          </div>
          {subValue && (
            <div className="text-[11px] sm:text-xs font-semibold text-slate-300 truncate text-right min-w-0 shrink">
              {subValue}
            </div>
          )}
        </div>

        {/* Main Big Readout */}
        <div className="flex items-baseline justify-center gap-1.5 my-auto py-1">
          <span
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight font-mono transition-colors duration-150 leading-none"
            style={{ color: accentColor }}
          >
            {value}
          </span>
          {unit && (
            <span className="text-sm sm:text-base lg:text-lg font-bold uppercase text-slate-400">
              {unit}
            </span>
          )}
        </div>

        {/* Progress / Gauge Bar */}
        <div className="space-y-1 mt-auto">
          {gaugePercent !== undefined && (
            <div className="w-full bg-slate-800/80 rounded-full h-1.5 sm:h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(0, gaugePercent))}%`,
                  backgroundColor: effectiveGaugeColor,
                }}
              />
            </div>
          )}

          {footer && (
            <div className="pt-1 border-t border-[#383941] text-[11px] sm:text-xs font-medium leading-tight text-slate-400">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Compact card (Dashboard / Fitness analytics view)
  return (
    <div
      onClick={onClick}
      className={`bg-[#1F2025] rounded-2xl p-4 sm:p-5 border border-[#383941] shadow-lg flex flex-col justify-between transition-all ${
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
