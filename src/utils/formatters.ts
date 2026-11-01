import { Wellness } from '../types/intervals';

export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs > 0 ? `${secs}s` : ''}`;
  return `${secs}s`;
}

export function formatDistance(meters?: number, useImperial = false): string {
  if (!meters || meters <= 0) return '0.0 km';
  if (useImperial) {
    const miles = meters / 1609.344;
    return `${miles.toFixed(1)} mi`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

export function formatSpeed(speedMps?: number, useImperial = false): string {
  if (!speedMps || speedMps <= 0) return '0.0 km/h';
  if (useImperial) {
    const mph = speedMps * 2.23694;
    return `${mph.toFixed(1)} mph`;
  }
  const kmh = speedMps * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}

export function formatPace(speedMps?: number, useImperial = false): string {
  if (!speedMps || speedMps <= 0) return '--:--';
  const factor = useImperial ? 1609.344 : 1000;
  const secPerUnit = factor / speedMps;
  const mins = Math.floor(secPerUnit / 60);
  const secs = Math.floor(secPerUnit % 60);
  const suffix = useImperial ? '/mi' : '/km';
  return `${mins}:${secs < 10 ? '0' : ''}${secs} ${suffix}`;
}

export function formatElevation(meters?: number, useImperial = false): string {
  if (!meters) return '0 m';
  if (useImperial) {
    const feet = Math.round(meters * 3.28084);
    return `${feet.toLocaleString()} ft`;
  }
  return `${Math.round(meters).toLocaleString()} m`;
}

export function formatWatts(watts?: number): string {
  if (!watts || watts <= 0) return '-- W';
  return `${Math.round(watts)} W`;
}

export function formatHeartRate(hr?: number): string {
  if (!hr || hr <= 0) return '-- bpm';
  return `${Math.round(hr)} bpm`;
}

export function formatDateRelative(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();

  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today, ${timeString}`;
  if (isYesterday) return `Yesterday, ${timeString}`;

  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export interface FormStatus {
  label: string;
  color: string;
  badgeBg: string;
  description: string;
}

export function getFormStatus(tsb: number): FormStatus {
  if (tsb > 15) {
    return {
      label: 'Very Fresh',
      color: '#00E5A3',
      badgeBg: 'rgba(0, 229, 163, 0.15)',
      description: 'Well rested. High freshness.',
    };
  }
  if (tsb >= 5) {
    return {
      label: 'Fresh & Race Ready',
      color: '#00E5A3',
      badgeBg: 'rgba(0, 229, 163, 0.15)',
      description: 'Supercompensation reached. Peak form for competition.',
    };
  }
  if (tsb >= -10) {
    return {
      label: 'Neutral',
      color: '#94A3B8',
      badgeBg: 'rgba(148, 163, 184, 0.15)',
      description: 'Maintenance zone. Stable fitness.',
    };
  }
  if (tsb >= -30) {
    return {
      label: 'Optimal Training',
      color: '#38BDF8',
      badgeBg: 'rgba(56, 189, 248, 0.15)',
      description: 'Productive training stimulus building durable fitness.',
    };
  }
  if (tsb >= -40) {
    return {
      label: 'High Fatigue',
      color: '#F59E0B',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
      description: 'Heavy training load. Prioritize recovery soon.',
    };
  }
  return {
    label: 'Overreaching Risk',
    color: '#EF4444',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    description: 'High injury and illness danger. Rest recommended.',
  };
}

export function computeRecoveryScore(wellness?: Wellness): number {
  if (!wellness) return 82;
  if (wellness.readiness && wellness.readiness > 0) {
    return Math.min(100, Math.max(0, Math.round(wellness.readiness)));
  }

  let score = 70;

  if (wellness.hrv && wellness.hrv > 0) {
    if (wellness.hrv > 75) score += 14;
    else if (wellness.hrv > 60) score += 8;
    else if (wellness.hrv < 40) score -= 16;
    else if (wellness.hrv < 50) score -= 8;
  }

  if (wellness.sleepScore && wellness.sleepScore > 0) {
    score = score * 0.4 + wellness.sleepScore * 0.6;
  } else if (wellness.sleepSecs && wellness.sleepSecs > 0) {
    const hours = wellness.sleepSecs / 3600;
    if (hours >= 7.5) score += 10;
    else if (hours < 6) score -= 14;
    else if (hours < 7) score -= 6;
  }

  if (wellness.restingHR && wellness.restingHR > 0) {
    if (wellness.restingHR < 50) score += 6;
    else if (wellness.restingHR > 65) score -= 8;
  }

  return Math.min(99, Math.max(15, Math.round(score)));
}

export function getSportDetails(type: string): { icon: string; color: string; label: string } {
  const t = (type || '').toLowerCase();
  if (t.includes('ride') || t.includes('cycl')) {
    return { icon: 'bike', color: '#FC5200', label: 'Cycling' };
  }
  if (t.includes('run')) {
    return { icon: 'footprints', color: '#00E5A3', label: 'Running' };
  }
  if (t.includes('swim')) {
    return { icon: 'waves', color: '#00B4D8', label: 'Swimming' };
  }
  if (t.includes('weight') || t.includes('gym') || t.includes('strength')) {
    return { icon: 'dumbbell', color: '#8B5CF6', label: 'Strength' };
  }
  return { icon: 'activity', color: '#FC5200', label: type || 'Workout' };
}
