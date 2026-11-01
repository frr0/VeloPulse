import React from 'react';

interface RecoveryRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  restingHR?: number;
  hrv?: number;
}

export const RecoveryRing: React.FC<RecoveryRingProps> = ({
  score,
  size = 200,
  strokeWidth = 14,
  restingHR,
  hrv,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  let colorStart = '#00E5A3';
  let colorEnd = '#00B4D8';
  let statusText = 'PRIME / RECOVERED';
  let badgeBg = 'rgba(0, 229, 163, 0.15)';

  if (clampedScore < 34) {
    colorStart = '#EF4444';
    colorEnd = '#F97316';
    statusText = 'RECOVERY NEEDED';
    badgeBg = 'rgba(239, 68, 68, 0.15)';
  } else if (clampedScore < 67) {
    colorStart = '#F59E0B';
    colorEnd = '#FBBF24';
    statusText = 'ADEQUATE';
    badgeBg = 'rgba(245, 158, 11, 0.15)';
  }

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        <defs>
          <linearGradient id="webRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorStart} />
            <stop offset="100%" stopColor={colorEnd} />
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#webRingGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Center Metrics */}
      <div className="z-10 flex flex-col items-center justify-center text-center px-2">
        <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">Recovery</span>
        <span className="text-4xl sm:text-5xl font-black tracking-tight" style={{ color: colorStart }}>
          {clampedScore}%
        </span>
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider mt-1"
          style={{ backgroundColor: badgeBg, color: colorStart }}
        >
          {statusText}
        </span>

        {(restingHR !== undefined || hrv !== undefined) && (
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            {restingHR !== undefined && (
              <span>HR <strong className="text-white font-bold">{restingHR}</strong></span>
            )}
            {restingHR !== undefined && hrv !== undefined && <span>•</span>}
            {hrv !== undefined && (
              <span>HRV <strong className="text-white font-bold">{hrv}ms</strong></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
