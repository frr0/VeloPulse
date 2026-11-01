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
    let max = 60;

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

  const targetWeeklyLoad = 550;
  const progressRatio = totalLoad / targetWeeklyLoad;

  return (
    <div className="bg-[#111622] rounded-2xl p-5 border border-[#232D42] shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[11px] font-extrabold tracking-wider text-slate-400 uppercase">
            7-Day Training Load
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-3xl font-black text-white">{totalLoad}</span>
            <span className="text-xs text-slate-400 font-semibold">/ ~{targetWeeklyLoad} Target</span>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#00E5A3]/10 text-[#00E5A3] border border-[#00E5A3]/20">
          {progressRatio >= 0.85 && progressRatio <= 1.15
            ? 'OPTIMAL LOAD'
            : progressRatio > 1.15
            ? 'HIGH STRAIN'
            : 'RECOVERY / BUILDING'}
        </span>
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
                <div
                  className="w-full rounded-t-md transition-all duration-500 ease-out"
                  style={{
                    height: `${Math.max(d.load > 0 ? 15 : 6, heightPct)}%`,
                    backgroundColor: d.load > 0 ? barColor : 'rgba(255, 255, 255, 0.1)',
                  }}
                />
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
