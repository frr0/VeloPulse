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
    <div className="space-y-8 animate-fadeIn">
      {/* Header filter tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-white/10">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00E5A3] block mb-1">
            Schedule
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Training Plan &amp; Workouts</h3>
          <p className="text-xs text-slate-400 mt-1">Scheduled sessions from your Intervals.icu calendar</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterUpcoming(true)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
              filterUpcoming
                ? 'bg-[#00E5A3]/15 text-[#00E5A3]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilterUpcoming(false)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
              !filterUpcoming
                ? 'bg-[#00E5A3]/15 text-[#00E5A3]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({events.length})
          </button>
        </div>
      </div>

      {/* Events Hairline List */}
      <div className="divide-y divide-white/10">
        {displayedEvents.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarIcon className="w-9 h-9 text-slate-500 mx-auto mb-3" />
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
                className={`py-6 pl-4 border-l-2 transition-colors ${
                  isToday ? 'border-l-[#00E5A3]' : 'border-l-white/15 hover:border-l-[#00E5A3]/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                      style={{ backgroundColor: `${sport.color}18`, color: sport.color }}
                    >
                      {sport.label}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      {formatDateRelative(ev.start_date_local)}
                    </span>
                    {ev.moving_time ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {formatDuration(ev.moving_time)}
                      </span>
                    ) : null}
                  </div>

                  {ev.load ? (
                    <div className="flex items-center gap-1 text-xs font-black text-[#FC5200] shrink-0">
                      <Zap className="w-3.5 h-3.5" />
                      <span>~{ev.load} Load</span>
                    </div>
                  ) : null}
                </div>

                <h4 className="text-lg font-bold text-white mb-2">{ev.name}</h4>

                {ev.description && (
                  <p className="text-xs text-slate-400 leading-relaxed max-w-3xl mb-4 whitespace-pre-line">
                    {ev.description}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3 text-xs">
                  <div>
                    {ev.completed ? (
                      <span className="inline-flex items-center gap-1.5 text-[#00E5A3] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                      </span>
                    ) : isToday ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-400 font-bold">
                        <Zap className="w-3.5 h-3.5" />
                        Scheduled Today
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                        <Hourglass className="w-3.5 h-3.5" />
                        Upcoming Target
                      </span>
                    )}
                  </div>

                  {onRideWorkout && isBikeWorkout && (
                    <button
                      onClick={() => onRideWorkout(ev)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#00E5A3]/15 hover:bg-[#00E5A3]/25 text-xs font-bold text-[#00E5A3] transition-all"
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
