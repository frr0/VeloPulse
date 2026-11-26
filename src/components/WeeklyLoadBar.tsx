import React, { useMemo } from 'react';
import { Activity } from '../types/intervals';

interface WeeklyLoadBarProps {
  activities: Activity[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const WeeklyLoadBar: React.FC<WeeklyLoadBarProps> = ({ activities }) => {
  const { weekData, totalLoad, maxDayLoad } = useMemo(() => {
    const today = new Date();
    const result = [];
    let sum = 0;
    let max = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = DAYS[d.getDay()];

      let dayLoad = 0;
      activities.forEach((act) => {
        if (act.start_date_local && act.start_date_local.startsWith(dateStr)) {
          dayLoad += act.icu_training_load || 0;
        }
      });

      max = Math.max(max, dayLoad);
      sum += dayLoad;

      result.push({
        dateStr,
        dayLabel,
        isToday: i === 0,
        load: Math.round(dayLoad),
      });
    }

    return { weekData: result, totalLoad: Math.round(sum), maxDayLoad: max };
  }, [activities]);

  const activeDays = weekData.filter((d) => d.load > 0).length;

  return (
    <div className="pt-6 border-t border-white/10">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <span className="text-[11px] font-bold tracking-[0.12em] text-[#00E5A3] uppercase block">
            7-Day Training Load
          </span>
          <div className="flex items-baseline gap-2.5 mt-1">
            <span className="text-3xl font-black font-mono text-white leading-none">{totalLoad}</span>
            <span className="text-xs text-[#989dab] font-mono">TSS &middot; {activeDays}/7 days</span>
          </div>
        </div>
      </div>

      {/* 7 Bars */}
      <div className="flex items-end justify-between gap-2 sm:gap-4 h-32 pt-4 px-2">
        {weekData.map((d, idx) => {
          const heightPct = maxDayLoad > 0 ? (d.load / maxDayLoad) * 100 : 0;
          const barColor = d.isToday
            ? '#00E5A3'
            : d.load > 120
            ? '#FC5200'
            : '#38BDF8';

          return (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
              <div className="w-full max-w-[28px] bg-white/5 rounded-t-lg h-24 flex items-end overflow-hidden p-0.5 relative">
                {d.load > 0 && (
                  <div
                    className="w-full rounded-t-md transition-all duration-500 ease-out"
                    style={{
                      height: `${Math.max(4, heightPct)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                )}
              </div>
              <span className={`text-[11px] font-bold mt-2 ${d.isToday ? 'text-[#00E5A3]' : 'text-slate-400'}`}>
                {d.dayLabel}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">
                {d.load > 0 ? d.load : '-'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
