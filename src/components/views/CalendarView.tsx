import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Hourglass,
  Zap,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CalendarEvent } from '../../types/intervals';
import { formatDateRelative, formatDuration, getSportDetails } from '../../utils/formatters';

interface CalendarViewProps {
  onRideWorkout?: (event: CalendarEvent) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onRideWorkout }) => {
  const { events } = useApp();
  const [filterUpcoming, setFilterUpcoming] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(a.start_date_local).getTime() - new Date(b.start_date_local).getTime()
    );
  }, [events]);

  const displayedEvents = useMemo(() => {
    if (filterUpcoming) {
      return sortedEvents.filter((ev) => {
        const evDate = (ev.start_date_local || '').split('T')[0];
        return evDate >= todayStr;
      });
    }
    return sortedEvents;
  }, [sortedEvents, filterUpcoming, todayStr]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header filter tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-white">Training Plan & Workouts</h3>
          <p className="text-xs text-slate-400">Scheduled sessions from your Intervals.icu calendar</p>
        </div>

        <div className="flex items-center bg-[#1F2025] p-1 rounded-xl border border-[#383941]">
          <button
            onClick={() => setFilterUpcoming(true)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              filterUpcoming ? 'bg-[#2F3037] text-[#00E5A3]' : 'text-slate-400'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilterUpcoming(false)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              !filterUpcoming ? 'bg-[#2F3037] text-[#00E5A3]' : 'text-slate-400'
            }`}
          >
            All ({events.length})
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {displayedEvents.length === 0 ? (
          <div className="bg-[#1F2025] rounded-2xl p-12 border border-[#383941] text-center">
            <CalendarIcon className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No workouts scheduled</h3>
            <p className="text-xs text-slate-400 mt-1">Connect or plan sessions in your Intervals.icu calendar.</p>
          </div>
        ) : (
          displayedEvents.map((ev: CalendarEvent) => {
            const sport = getSportDetails(ev.type || 'Workout');
            const isToday = (ev.start_date_local || '').startsWith(todayStr);
            const isBikeWorkout =
              !ev.type ||
              ev.type.toLowerCase().includes('ride') ||
              ev.type.toLowerCase().includes('cycle') ||
              ev.type.toLowerCase().includes('virtual') ||
              ev.category === 'WORKOUT';

            return (
              <div
                key={ev.id}
                className={`bg-[#1F2025] border rounded-2xl p-5 shadow-lg transition-all ${
                  isToday ? 'border-[#00E5A3]/40 bg-[#141C2B]' : 'border-[#383941]'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider"
                      style={{ backgroundColor: `${sport.color}20`, color: sport.color }}
                    >
                      {sport.label}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      {formatDateRelative(ev.start_date_local)}
                    </span>
                  </div>

                  {ev.load ? (
                    <div className="flex items-center gap-1 text-xs font-black text-[#FC5200]">
                      <Zap className="w-3.5 h-3.5" />
                      <span>~{ev.load} Load</span>
                    </div>
                  ) : null}
                </div>

                <h4 className="text-base font-bold text-white mb-1.5">{ev.name}</h4>

                {ev.moving_time ? (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Duration: {formatDuration(ev.moving_time)}</span>
                  </div>
                ) : null}

                {ev.description && (
                  <div className="bg-[#2F3037] p-3 rounded-xl border border-white/5 text-xs text-slate-300 leading-relaxed mb-3">
                    {ev.description}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
                  <div>
                    {ev.completed ? (
                      <span className="inline-flex items-center gap-1 text-[#00E5A3] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                      </span>
                    ) : isToday ? (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                        <Zap className="w-3.5 h-3.5" />
                        Scheduled Today
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                        <Hourglass className="w-3.5 h-3.5" />
                        Upcoming Target
                      </span>
                    )}
                  </div>

                  {onRideWorkout && isBikeWorkout && (
                    <button
                      onClick={() => onRideWorkout(ev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00E5A3]/15 hover:bg-[#00E5A3]/25 border border-[#00E5A3]/30 text-xs font-bold text-[#00E5A3] transition-all"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>Ride in Studio</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
