import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MetricCard } from '../MetricCard';
import { WorkoutProfileChart } from '../WorkoutProfileChart';
import { WorkoutControls } from '../WorkoutControls';
import { BluetoothModal } from '../BluetoothModal';
import { WorkoutModal } from '../WorkoutModal';
import { SettingsModal } from '../SettingsModal';
import { SessionSummaryModal } from '../SessionSummaryModal';
import { FitDownloadCard } from '../FitDownloadCard';
import { createFitFileInfo, downloadFitFile } from '../../services/fit/fitGenerator';
import { Capacitor } from '@capacitor/core';

import {
  BluetoothDevicesState,
  ParsedWorkout,
  SessionStatus,
  SessionSummary,
  SessionWbal,
  TelemetryData,
  TelemetrySample,
  UserSettings,
} from '../../types';

import { BluetoothManager, TelemetryEvent } from '../../services/bluetooth/bluetoothManager';
import { CyclingPhysicsEngine } from '../../services/physics/speedCalculator';
import { WorkoutEngine, WorkoutEngineState } from '../../services/workout/workoutEngine';
import { getPowerZoneInfo, getPowerZoneNumber, getHeartRateZoneInfo } from '../../utils/zones';
import { SAMPLE_WORKOUTS, parseZwoWorkout } from '../../services/workout/zwoParser';
import { useApp } from '../../context/AppContext';
import {
  CriticalPowerResult,
  CriticalPowerUnavailableReason,
  WBAL_LOW_FRACTION,
  advanceWbal,
  estimateCriticalPower,
} from '../../utils/criticalPower';
import {
  Zap,
  Activity,
  Heart,
  Gauge,
  Flame,
  Clock,
  Compass,
  Bluetooth,
  Dumbbell,
  Settings as SettingsIcon,
  Download,
  BatteryMedium,
} from 'lucide-react';

/**
 * Why there is no CP estimate, in one short line for the cockpit. The studio
 * writes in English, like the rest of this screen.
 */
const CP_UNAVAILABLE_TEXT: Record<CriticalPowerUnavailableReason, string> = {
  'no-curve': 'Intervals.icu returned no power curve for this athlete.',
  'durations-missing': 'your power curve needs two efforts between 2 and 20 minutes.',
  'durations-too-close': 'the durations of your power curve are too close together.',
  'model-not-applicable':
    'your power curve between 2 and 20 minutes does not fit the critical power model.',
};

/** Live W'bal of the session: the reserve now, and the lowest reached so far. */
interface LiveWbal {
  /** Reserve left, in joules. Negative when the athlete went past W'. */
  joules: number;
  /** Lowest reserve of the session, in joules. */
  lowestJoules: number;
}

interface RideStudioViewProps {
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  bluetoothManager: BluetoothManager;
  devicesState: BluetoothDevicesState;
  isBluetoothModalOpen: boolean;
  setIsBluetoothModalOpen: (open: boolean) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;
  activeWorkoutFromCalendar?: ParsedWorkout | null;
  onClearCalendarWorkout?: () => void;
  useImperial?: boolean;
}

export const RideStudioView: React.FC<RideStudioViewProps> = ({
  settings,
  onUpdateSettings,
  bluetoothManager,
  devicesState,
  isBluetoothModalOpen,
  setIsBluetoothModalOpen,
  isSettingsModalOpen,
  setIsSettingsModalOpen,
  activeWorkoutFromCalendar,
  onClearCalendarWorkout,
  useImperial = false,
}) => {
  const isNative = Capacitor.isNativePlatform();
  const { powerCurve } = useApp();

  // CP and W' estimated on the power curve the app already downloaded. Without
  // the estimate the studio shows no reserve: it never derives CP from the FTP.
  const criticalPower = useMemo<CriticalPowerResult>(() => {
    const curve = powerCurve.recent ?? powerCurve.season;
    return estimateCriticalPower(curve?.samples ?? null, curve?.label ?? '');
  }, [powerCurve]);

  // Services instances (refs so they persist across renders)
  const physicsEngineRef = useRef<CyclingPhysicsEngine>(new CyclingPhysicsEngine(settings));
  const workoutEngineRef = useRef<WorkoutEngine>(new WorkoutEngine(settings.ftp, settings.soundAlerts));

  // Modals state
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Workout & Engine state
  const [currentWorkout, setCurrentWorkout] = useState<ParsedWorkout | null>(null);
  const [engineState, setEngineState] = useState<WorkoutEngineState>(
    workoutEngineRef.current.getState()
  );

  // Raw telemetry live cache
  const rawPowerRef = useRef(0);
  const rawCadenceRef = useRef(0);
  const rawHeartRateRef = useRef(0);
  const trainerSpeedRef = useRef<number | undefined>(undefined);
  const powerHistoryRef = useRef<number[]>([]); // for 3s rolling average
  const power30sHistoryRef = useRef<number[]>([]); // for Normalized Power

  // Live telemetry for display
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    power: 0,
    power3s: 0,
    targetPower: Math.round(settings.ftp * 0.65),
    cadence: 0,
    heartRate: 0,
    speedKmh: 0,
    speedMps: 0,
    speedMph: 0,
    distanceMeters: 0,
    elapsedSeconds: 0,
    powerZone: 1,
    hrZone: 1,
    calories: 0,
    workKj: 0,
  });

  // Live W'bal: the reserve moves only in the 1-second loop, so the ref carries
  // it between ticks and the state only feeds the card.
  const [liveWbal, setLiveWbal] = useState<LiveWbal | null>(null);
  const liveWbalRef = useRef<LiveWbal | null>(null);
  const criticalPowerRef = useRef<CriticalPowerResult>(criticalPower);

  // Session recording state
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const sessionStatusRef = useRef<SessionStatus>('idle');
  const sessionStartTimeRef = useRef<Date | null>(null);
  const sessionSecondsRef = useRef<number>(0);
  const samplesRef = useRef<TelemetrySample[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [fitFileInfo, setFitFileInfo] = useState<{
    filename: string;
    blobUrl: string;
    sizeBytes: number;
    base64Data: string;
  } | null>(null);

  // Setup services callbacks on mount
  useEffect(() => {
    const bm = bluetoothManager;
    const we = workoutEngineRef.current;

    bm.setOnTelemetry((event: TelemetryEvent) => {
      if (event.power !== undefined) rawPowerRef.current = event.power;
      if (event.cadence !== undefined) rawCadenceRef.current = event.cadence;
      if (event.heartRate !== undefined) rawHeartRateRef.current = event.heartRate;
      if (event.trainerSpeedKmh !== undefined) trainerSpeedRef.current = event.trainerSpeedKmh;
    });

    we.setCallbacks(
      (newEngineState) => {
        setEngineState(newEngineState);
      },
      (targetWatts) => {
        bm.setTargetPower(targetWatts);
      },
      () => {
        handleFinishSession();
      }
    );

    // Load initial sample workout if none is present
    try {
      const defaultSample = parseZwoWorkout(SAMPLE_WORKOUTS[0].xml, settings.ftp);
      setCurrentWorkout(defaultSample);
      we.loadWorkout(defaultSample);
    } catch (e) {
      console.warn('Initial workout load:', e);
    }
  }, []);

  // Watch for active workout passed in from Calendar or external trigger
  useEffect(() => {
    if (activeWorkoutFromCalendar) {
      setCurrentWorkout(activeWorkoutFromCalendar);
      workoutEngineRef.current.loadWorkout(activeWorkoutFromCalendar);
    }
  }, [activeWorkoutFromCalendar]);

  // The 1-second loop and the session handlers read the status from the ref, so
  // a new estimate does not restart the loop.
  useEffect(() => {
    sessionStatusRef.current = sessionStatus;
  }, [sessionStatus]);

  // A new estimate of CP and W' arrives when the power curve is downloaded again.
  useEffect(() => {
    criticalPowerRef.current = criticalPower;

    if (criticalPower.status !== 'ok') {
      liveWbalRef.current = null;
      setLiveWbal(null);
      return;
    }

    const fullJoules = criticalPower.estimate.wPrimeJoules;
    const current = liveWbalRef.current;
    const next: LiveWbal =
      current === null || sessionStatusRef.current === 'idle'
        ? { joules: fullJoules, lowestJoules: fullJoules }
        : // During a session the reserve keeps its value, but never stays above
          // a full reserve that just got smaller.
          {
            joules: Math.min(current.joules, fullJoules),
            lowestJoules: Math.min(current.lowestJoules, fullJoules),
          };

    liveWbalRef.current = next;
    setLiveWbal(next);
  }, [criticalPower]);

  // Update physics engine and workout engine when settings change
  useEffect(() => {
    physicsEngineRef.current.updateSettings(settings);
    workoutEngineRef.current.setFtp(settings.ftp);
    workoutEngineRef.current.setSoundEnabled(settings.soundAlerts);
  }, [settings]);

  // Main 1-second simulation & telemetry loop
  useEffect(() => {
    const timer = setInterval(() => {
      const power = rawPowerRef.current;
      const cadence = rawCadenceRef.current;
      const heartRate = rawHeartRateRef.current;

      powerHistoryRef.current.push(power);
      if (powerHistoryRef.current.length > 3) {
        powerHistoryRef.current.shift();
      }
      const power3s = Math.round(
        powerHistoryRef.current.reduce((a, b) => a + b, 0) / powerHistoryRef.current.length
      );

      if (sessionStatus === 'running') {
        workoutEngineRef.current.tick();
        power30sHistoryRef.current.push(power);

        const physics = physicsEngineRef.current.step(power, cadence, 1.0);

        const currentSpeedKmh =
          settings.speedSource === 'trainer' && trainerSpeedRef.current !== undefined
            ? trainerSpeedRef.current
            : physics.currentVelocityKmh;
        const currentSpeedMps = currentSpeedKmh / 3.6;
        const currentSpeedMph = currentSpeedKmh * 0.621371;

        const dt = 1;
        const joules = power * dt;

        // W'bal of this second. The reserve moves only while the session runs:
        // on pause this branch does not run and the reserve stands still.
        const cp = criticalPowerRef.current;
        const prevWbal = liveWbalRef.current;
        if (cp.status === 'ok' && prevWbal !== null) {
          const wbalJoules = advanceWbal(
            prevWbal.joules,
            power,
            dt,
            cp.estimate.cpWatts,
            cp.estimate.wPrimeJoules
          );
          const nextWbal: LiveWbal = {
            joules: wbalJoules,
            lowestJoules: Math.min(prevWbal.lowestJoules, wbalJoules),
          };
          liveWbalRef.current = nextWbal;
          setLiveWbal(nextWbal);
        }

        sessionSecondsRef.current += 1;
        const currentElapsedSeconds = sessionSecondsRef.current;

        const curTarget = workoutEngineRef.current.calculateInstantaneousTargetWatts();
        const pZone = getPowerZoneNumber(power, settings.ftp);
        const hrZone = getHeartRateZoneInfo(heartRate, settings.maxHeartRate, settings.hrZones).zone;

        setTelemetry((prev) => {
          const workKj = (prev.workKj || 0) + joules / 1000;
          const calories = (prev.calories || 0) + (power > 0 ? joules / (4184 * 0.24) : 0);

          return {
            power,
            power3s,
            targetPower: curTarget,
            cadence,
            targetCadence: engineState.instantaneousTargetCadence,
            heartRate,
            speedKmh: Number(currentSpeedKmh.toFixed(1)),
            speedMps: Number(currentSpeedMps.toFixed(2)),
            speedMph: Number(currentSpeedMph.toFixed(1)),
            trainerReportedSpeed: trainerSpeedRef.current,
            distanceMeters: physics.totalDistanceMeters,
            elapsedSeconds: currentElapsedSeconds,
            powerZone: pZone,
            hrZone,
            calories: Math.round(calories),
            workKj: Number(workKj.toFixed(1)),
          };
        });

        samplesRef.current.push({
          timestamp: new Date(),
          elapsedSeconds: currentElapsedSeconds,
          power,
          cadence,
          heartRate,
          speedMps: currentSpeedMps,
          distanceMeters: physics.totalDistanceMeters,
          targetPower: curTarget,
        });
      } else {
        const curTarget = workoutEngineRef.current.calculateInstantaneousTargetWatts();
        const pZone = getPowerZoneNumber(power, settings.ftp);
        const hrZone = getHeartRateZoneInfo(heartRate, settings.maxHeartRate, settings.hrZones).zone;

        setTelemetry((prev) => ({
          ...prev,
          power,
          power3s,
          targetPower: curTarget,
          cadence,
          heartRate,
          powerZone: pZone,
          hrZone,
        }));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionStatus, settings, engineState.instantaneousTargetCadence]);

  // --- WORKOUT CONTROLS ---
  const handleStartSession = () => {
    sessionStartTimeRef.current = new Date();
    sessionSecondsRef.current = 0;
    samplesRef.current = [];
    power30sHistoryRef.current = [];
    physicsEngineRef.current.reset(0);
    setFitFileInfo(null);

    // A new session starts with a full reserve, or with no reserve at all when
    // there is no estimate of CP and W'.
    const cp = criticalPowerRef.current;
    const freshWbal: LiveWbal | null =
      cp.status === 'ok'
        ? { joules: cp.estimate.wPrimeJoules, lowestJoules: cp.estimate.wPrimeJoules }
        : null;
    liveWbalRef.current = freshWbal;
    setLiveWbal(freshWbal);

    setTelemetry((prev) => ({
      ...prev,
      distanceMeters: 0,
      elapsedSeconds: 0,
      calories: 0,
      workKj: 0,
    }));

    setSessionStatus('running');
    workoutEngineRef.current.start();
  };

  const handlePauseSession = () => {
    setSessionStatus('paused');
    workoutEngineRef.current.pause();
  };

  const handleResumeSession = () => {
    setSessionStatus('running');
    workoutEngineRef.current.resume();
  };

  const createCurrentSessionSummary = (samples: TelemetrySample[], startTime: Date, endTime: Date): SessionSummary => {
    const totalTimerTime = Math.max(sessionSecondsRef.current, samples.length);
    const totalElapsedTime = Math.max(
      totalTimerTime,
      Math.round((endTime.getTime() - startTime.getTime()) / 1000)
    );

    let sumPower = 0;
    let maxPower = 0;
    let sumCadence = 0;
    let maxCadence = 0;
    let cadenceCount = 0;
    let sumHr = 0;
    let maxHr = 0;
    let hrCount = 0;
    let maxSpeedKmh = 0;

    samples.forEach((s) => {
      sumPower += s.power;
      if (s.power > maxPower) maxPower = s.power;

      if (s.cadence > 0) {
        sumCadence += s.cadence;
        cadenceCount++;
        if (s.cadence > maxCadence) maxCadence = s.cadence;
      }

      if (s.heartRate > 0) {
        sumHr += s.heartRate;
        hrCount++;
        if (s.heartRate > maxHr) maxHr = s.heartRate;
      }

      const spdKmh = s.speedMps * 3.6;
      if (spdKmh > maxSpeedKmh) maxSpeedKmh = spdKmh;
    });

    const avgPower = samples.length > 0 ? Math.round(sumPower / samples.length) : Math.round(telemetry.power);
    const avgCadence = cadenceCount > 0 ? Math.round(sumCadence / cadenceCount) : Math.round(telemetry.cadence);
    const avgHeartRate = hrCount > 0 ? Math.round(sumHr / hrCount) : Math.round(telemetry.heartRate);
    const avgSpeedKmh =
      totalTimerTime > 0 ? Number(((telemetry.distanceMeters / totalTimerTime) * 3.6).toFixed(1)) : telemetry.speedKmh;

    let normalizedPower = avgPower;
    if (power30sHistoryRef.current.length >= 30) {
      const rolling30s: number[] = [];
      const history = power30sHistoryRef.current;
      for (let i = 29; i < history.length; i++) {
        const slice = history.slice(i - 29, i + 1);
        const avg = slice.reduce((a, b) => a + b, 0) / 30;
        rolling30s.push(Math.pow(avg, 4));
      }
      if (rolling30s.length > 0) {
        const meanP4 = rolling30s.reduce((a, b) => a + b, 0) / rolling30s.length;
        normalizedPower = Math.round(Math.pow(meanP4, 0.25));
      }
    }

    // The lowest reserve of the session, read from the refs so the value is the
    // live one even when the workout engine closes the session by itself.
    const cp = criticalPowerRef.current;
    const wbal = liveWbalRef.current;
    const sessionWbal: SessionWbal | null =
      cp.status === 'ok' && wbal !== null
        ? {
            cpWatts: cp.estimate.cpWatts,
            wPrimeJoules: cp.estimate.wPrimeJoules,
            lowestJoules: Math.round(wbal.lowestJoules),
          }
        : null;

    const intensityFactor =
      settings.ftp > 0 ? Number((normalizedPower / settings.ftp).toFixed(2)) : 0;
    const trainingStressScore =
      settings.ftp > 0 && totalTimerTime > 0
        ? Math.round((totalTimerTime * normalizedPower * intensityFactor) / (settings.ftp * 36))
        : 0;

    return {
      startTime,
      endTime,
      totalElapsedTimeSeconds: Math.max(1, totalElapsedTime),
      totalTimerTimeSeconds: Math.max(1, totalTimerTime),
      totalDistanceMeters: telemetry.distanceMeters,
      avgPowerWatts: avgPower,
      maxPowerWatts: Math.max(maxPower, telemetry.power),
      normalizedPowerWatts: normalizedPower,
      avgCadenceRpm: avgCadence,
      maxCadenceRpm: Math.max(maxCadence, telemetry.cadence),
      avgHeartRateBpm: avgHeartRate,
      maxHeartRateBpm: Math.max(maxHr, telemetry.heartRate),
      avgSpeedKmh,
      maxSpeedKmh: Number(Math.max(maxSpeedKmh, telemetry.speedKmh).toFixed(1)),
      totalWorkKj: telemetry.workKj,
      totalCaloriesKcal: telemetry.calories,
      trainingStressScore,
      intensityFactor,
      wbal: sessionWbal,
      samples,
    };
  };

  const handleFinishSession = () => {
    setSessionStatus('idle');
    workoutEngineRef.current.finish();

    const samples = [...samplesRef.current];
    const startTime = sessionStartTimeRef.current || (samples.length > 0 ? new Date(samples[0].timestamp) : new Date());
    const endTime = new Date();

    const summary = createCurrentSessionSummary(samples, startTime, endTime);

    setSessionSummary(summary);
    try {
      localStorage.setItem('velopulse_last_summary', JSON.stringify(summary));
    } catch {
      // ignore
    }
    try {
      const fileInfo = createFitFileInfo(summary);
      setFitFileInfo(fileInfo);
    } catch (err) {
      console.error('Failed to generate FIT file info:', err);
    }
    setIsSummaryModalOpen(true);
  };

  const handleExportFit = () => {
    const samples = [...samplesRef.current];
    const startTime = sessionStartTimeRef.current || (samples.length > 0 ? new Date(samples[0].timestamp) : null);
    const endTime = new Date();

    let summaryToExport: SessionSummary;

    // Accurately package all training data collected from the start (even if only seconds/minutes long):
    if (samples.length > 0 || sessionSecondsRef.current > 0 || sessionStatus === 'running' || sessionStatus === 'paused') {
      const effectiveStartTime = startTime || new Date(endTime.getTime() - Math.max(1, sessionSecondsRef.current) * 1000);
      summaryToExport = createCurrentSessionSummary(samples, effectiveStartTime, endTime);
    } else if (sessionSummary) {
      summaryToExport = sessionSummary;
    } else {
      const saved = localStorage.getItem('velopulse_last_summary');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          parsed.startTime = new Date(parsed.startTime);
          parsed.endTime = new Date(parsed.endTime);
          summaryToExport = parsed;
        } catch (e) {
          console.warn('Failed parsing saved summary', e);
          summaryToExport = createCurrentSessionSummary([], new Date(), new Date());
        }
      } else {
        summaryToExport = createCurrentSessionSummary([], new Date(), new Date());
      }
    }

    setSessionSummary(summaryToExport);
    try {
      const fileInfo = createFitFileInfo(summaryToExport);
      setFitFileInfo(fileInfo);
      // Trigger instant direct download of the .fit file
      downloadFitFile(summaryToExport, fileInfo.filename);
    } catch (err) {
      console.error('Failed to generate/download FIT file:', err);
    }
  };

  const handleSelectWorkout = (workout: ParsedWorkout | null) => {
    setCurrentWorkout(workout);
    if (workout) {
      workoutEngineRef.current.loadWorkout(workout);
    } else {
      workoutEngineRef.current.clearWorkout();
    }
    if (onClearCalendarWorkout) {
      onClearCalendarWorkout();
    }
  };

  const handleAdjustManualWatts = (delta: number) => {
    const curTarget = telemetry.targetPower;
    const newTarget = Math.max(50, Math.min(800, curTarget + delta));
    bluetoothManager.setTargetPower(newTarget);
    setTelemetry((prev) => ({ ...prev, targetPower: newTarget }));
  };

  const handleAdjustErgBias = (deltaPercent: number) => {
    workoutEngineRef.current.adjustErgBias(deltaPercent);
  };

  const handleSkipInterval = (forward: boolean) => {
    workoutEngineRef.current.skipInterval(forward);
  };

  const currentPowerZone = useMemo(() => {
    return getPowerZoneInfo(telemetry.power, settings.ftp);
  }, [telemetry.power, settings.ftp]);

  // Everything the W'bal card shows. Null means there is nothing to show: with
  // no estimate the card gives way to a single line that says why.
  const wbalDisplay = useMemo(() => {
    if (criticalPower.status !== 'ok' || liveWbal === null) return null;
    const fullJoules = criticalPower.estimate.wPrimeJoules;
    return {
      kilojoules: liveWbal.joules / 1000,
      percent: (liveWbal.joules / fullJoules) * 100,
      fullKilojoules: fullJoules / 1000,
      lowestKilojoules: liveWbal.lowestJoules / 1000,
      lowestPercent: (liveWbal.lowestJoules / fullJoules) * 100,
      isLow: liveWbal.joules < fullJoules * WBAL_LOW_FRACTION,
      cpWatts: criticalPower.estimate.cpWatts,
    };
  }, [criticalPower, liveWbal]);

  const powerGaugePercent = useMemo(() => {
    const target = telemetry.targetPower || settings.ftp;
    return target > 0 ? Math.min(150, Math.max(0, (telemetry.power / target) * 100)) : 0;
  }, [telemetry.power, telemetry.targetPower, settings.ftp]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const displaySpeed = useImperial ? telemetry.speedMph : telemetry.speedKmh;
  const speedUnit = useImperial ? 'MPH' : 'KM/H';
  const displayDist = useImperial
    ? (telemetry.distanceMeters * 0.000621371).toFixed(2)
    : (telemetry.distanceMeters / 1000).toFixed(2);
  const distUnit = useImperial ? 'mi' : 'km';

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col justify-start gap-2.5 sm:gap-3 animate-fadeIn select-none overflow-hidden h-full">
      {/* Simulation banner if active */}
      {devicesState.isSimulated && (
        <div className="py-1.5 px-3 rounded-xl bg-purple-950/70 border border-purple-800/80 text-purple-200 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping shrink-0" />
            <span className="font-bold shrink-0">Virtual Simulator:</span>
            <span className="text-purple-300/80 truncate">Generating realistic trainer power, cadence, and HR</span>
          </div>
          <button
            onClick={() => bluetoothManager.stopSimulation()}
            className="px-2.5 py-0.5 rounded-lg bg-purple-800 text-white font-bold text-xs shrink-0"
          >
            Exit
          </button>
        </div>
      )}

      {/* FIT Download notification (dismissible) */}
      {fitFileInfo && sessionSummary && (
        <FitDownloadCard
          summary={sessionSummary}
          fitBlobUrl={fitFileInfo.blobUrl}
          fitFilename={fitFileInfo.filename}
          fitSizeBytes={fitFileInfo.sizeBytes}
          base64Data={fitFileInfo.base64Data}
          onOpenSummaryModal={() => setIsSummaryModalOpen(true)}
          onDismiss={() => setFitFileInfo(null)}
        />
      )}

      {/* Current Interval Strip (when workout is active) */}
      {currentWorkout && engineState.currentInterval && (
        <div className="rounded-xl sm:rounded-2xl bg-[#1F2025]/95 border border-[#383941] px-3.5 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 truncate">
            <div
              className="w-3 h-7 rounded-full shrink-0"
              style={{ backgroundColor: currentPowerZone.color }}
            />
            <div className="truncate">
              <span className="font-black text-slate-100">
                {engineState.currentInterval.type} ({engineState.currentIntervalIndex + 1}/{currentWorkout.intervals.length})
              </span>
              <span className="text-slate-400 ml-2 text-xs">
                Target: <strong className="text-white font-mono text-sm sm:text-base">{engineState.instantaneousTargetPower}W</strong>
                {engineState.instantaneousTargetCadence && (
                  <span className="text-slate-400 font-mono text-xs sm:text-sm"> • {engineState.instantaneousTargetCadence}rpm</span>
                )}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs text-slate-400 font-bold uppercase mr-1.5 hidden sm:inline">Interval:</span>
            <span className="text-xl sm:text-3xl font-black font-mono text-[#00E5A3] leading-none">
              {formatTime(engineState.intervalRemainingSeconds)}
            </span>
          </div>
        </div>
      )}

      {/* 
        2. PRIMARY METRICS: POWER, CADENCE, HEART RATE, SPEED
        Landscape rectangular cards where base > height, retaining strict aspect ratio
      */}
      <div className={`grid gap-2 sm:gap-2.5 w-full shrink-0 ${
        isNative ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'
      }`}>
        {/* Card 1: POWER */}
        <MetricCard
          variant="hud"
          isSmall={isNative}
          label="Power"
          value={telemetry.power}
          unit="W"
          icon={<Zap className="w-4 h-4" />}
          accentColor={currentPowerZone.color}
          subValue={
            <span className="font-mono text-xs sm:text-sm text-slate-400">
              3s: <strong className="text-white">{telemetry.power3s}W</strong> • <strong style={{ color: currentPowerZone.color }}>{currentPowerZone.name}</strong>
            </span>
          }
          gaugePercent={powerGaugePercent}
          gaugeColor={currentPowerZone.color}
          footer={
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-400">Target</span>
              <span className="font-mono font-bold text-white">
                {telemetry.targetPower} W{' '}
                <span className="text-slate-500 font-normal">
                  ({Math.round((telemetry.targetPower / settings.ftp) * 100)}%)
                </span>
              </span>
            </div>
          }
          highlight={sessionStatus === 'running'}
        />

        {/* Card 2: CADENCE */}
        <MetricCard
          variant="hud"
          isSmall={isNative}
          label="Cadence"
          value={telemetry.cadence}
          unit="RPM"
          icon={<Activity className="w-4 h-4" />}
          accentColor="#00E5A3"
          subValue={
            telemetry.targetCadence ? (
              <span className="text-xs sm:text-sm text-slate-400 font-mono">
                Target: <strong className="text-[#00E5A3]">{telemetry.targetCadence}</strong>
              </span>
            ) : (
              <span className="text-xs sm:text-sm text-slate-400">
                {telemetry.cadence >= 90 ? 'High' : telemetry.cadence >= 80 ? 'Optimal' : telemetry.cadence > 0 ? 'Low' : 'Coasting'}
              </span>
            )
          }
          gaugePercent={Math.min(100, (telemetry.cadence / 120) * 100)}
          gaugeColor="#00E5A3"
          footer={
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-400">Status</span>
              <span className="font-mono font-bold text-slate-300">
                {telemetry.cadence > 0 ? `${telemetry.cadence} rpm` : 'Coasting'}
              </span>
            </div>
          }
        />

        {/* Card 3: HEART RATE */}
        <MetricCard
          variant="hud"
          isSmall={isNative}
          label="Heart Rate"
          value={telemetry.heartRate || '--'}
          unit="BPM"
          icon={<Heart className="w-4 h-4 text-rose-500 animate-pulse" />}
          accentColor="#f87171"
          subValue={
            telemetry.heartRate > 0 ? (
              <span className="text-xs sm:text-sm text-slate-400">
                Z<strong className="text-rose-400">{telemetry.hrZone}</strong> ({Math.round((telemetry.heartRate / settings.maxHeartRate) * 100)}%)
              </span>
            ) : (
              <span className="text-xs sm:text-sm text-slate-500">No sensor</span>
            )
          }
          gaugePercent={
            telemetry.heartRate > 0
              ? Math.min(100, Math.max(0, (telemetry.heartRate / settings.maxHeartRate) * 100))
              : 0
          }
          gaugeColor="#f87171"
          footer={
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-400">Zone</span>
              <span className="font-mono font-bold text-slate-300 truncate">
                {telemetry.heartRate > 0
                  ? getHeartRateZoneInfo(telemetry.heartRate, settings.maxHeartRate, settings.hrZones).name
                  : 'Awaiting HR'}
              </span>
            </div>
          }
        />

        {/* Card 4: SPEED / VELOCITY */}
        <MetricCard
          variant="hud"
          isSmall={isNative}
          label="Speed"
          value={displaySpeed.toFixed(1)}
          unit={speedUnit}
          icon={<Gauge className="w-4 h-4" />}
          accentColor="#4ade80"
          subValue={
            <span className="font-mono text-xs sm:text-sm text-slate-400 truncate">
              {telemetry.speedMps.toFixed(1)} m/s • {settings.gradientPercent}%
            </span>
          }
          gaugePercent={Math.min(100, (telemetry.speedKmh / 60) * 100)}
          gaugeColor="#4ade80"
          footer={
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-400">Distance</span>
              <span className="font-mono font-bold text-emerald-400">
                {displayDist} {distUnit}
              </span>
            </div>
          }
        />
      </div>


      {/*
        3. SECONDARY STATS ROW (6 columns across the screen)
        Elapsed, Distance, Work (kJ), Calories, Remaining, W'bal
      */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2 w-full shrink-0">
        <div className="p-1.5 sm:p-2 rounded-xl bg-[#1F2025] border border-[#383941] text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3 text-[#00E5A3] hidden sm:inline" /> Elapsed
          </div>
          <div className="text-sm sm:text-base lg:text-lg font-black font-mono text-white mt-0.5">
            {formatTime(telemetry.elapsedSeconds)}
          </div>
        </div>

        <div className="p-1.5 sm:p-2 rounded-xl bg-[#1F2025] border border-[#383941] text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
            <Compass className="w-3 h-3 text-cyan-400 hidden sm:inline" /> Distance
          </div>
          <div className="text-sm sm:text-base lg:text-lg font-black font-mono text-cyan-400 mt-0.5 truncate">
            {displayDist} <span className="text-[10px] sm:text-xs font-normal">{distUnit}</span>
          </div>
        </div>

        <div className="p-1.5 sm:p-2 rounded-xl bg-[#1F2025] border border-[#383941] text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
            <Zap className="w-3 h-3 text-amber-400 hidden sm:inline" /> Work
          </div>
          <div className="text-sm sm:text-base lg:text-lg font-black font-mono text-amber-400 mt-0.5 truncate">
            {Math.round(telemetry.workKj)} <span className="text-[10px] sm:text-xs font-normal">kJ</span>
          </div>
        </div>

        <div className="p-1.5 sm:p-2 rounded-xl bg-[#1F2025] border border-[#383941] text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
            <Flame className="w-3 h-3 text-orange-400 hidden sm:inline" /> Calories
          </div>
          <div className="text-sm sm:text-base lg:text-lg font-black font-mono text-orange-400 mt-0.5 truncate">
            {telemetry.calories} <span className="text-[10px] sm:text-xs font-normal">kcal</span>
          </div>
        </div>

        <div className="p-1.5 sm:p-2 rounded-xl bg-[#1F2025] border border-[#383941] text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">
            Rem.
          </div>
          <div className="text-sm sm:text-base lg:text-lg font-black font-mono text-slate-300 mt-0.5">
            {currentWorkout ? formatTime(engineState.workoutRemainingSeconds) : '--:--'}
          </div>
        </div>

        {/* W'bal reserve replacing FTP card */}
        <div className="p-1.5 sm:p-2 rounded-xl bg-[#1F2025] border border-[#383941] text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
            <BatteryMedium className={`w-3 h-3 ${wbalDisplay?.isLow ? 'text-amber-400' : 'text-sky-400'} hidden sm:inline`} /> W′bal
          </div>
          <div className={`text-sm sm:text-base lg:text-lg font-black font-mono mt-0.5 truncate ${wbalDisplay?.isLow ? 'text-amber-400' : 'text-sky-400'}`}>
            {wbalDisplay ? `${wbalDisplay.kilojoules.toFixed(1)} kJ` : '--'}
            {wbalDisplay && (
              <span className="text-[10px] sm:text-xs font-normal text-slate-400 ml-1">
                ({Math.round(wbalDisplay.percent)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 
        4. TRAINING GRAPH (WORKOUT PROFILE CHART)
      */}
      <div className="w-full shrink-0 flex flex-col justify-center">
        <WorkoutProfileChart
          workout={currentWorkout}
          currentSecond={engineState.workoutElapsedSeconds}
          currentIntervalIndex={engineState.currentIntervalIndex}
          ftp={settings.ftp}
          onSelectInterval={(_idx) => {}}
          onOpenWorkoutModal={() => setIsWorkoutModalOpen(true)}
          isCompact={isNative}
        />
      </div>

      {/* 
        5. WORKOUT TACTILE CONTROLS
      */}
      <WorkoutControls
        status={sessionStatus}
        ergBiasPercent={engineState.ergBiasPercent}
        hasWorkout={!!currentWorkout}
        targetPower={telemetry.targetPower}
        onStart={handleStartSession}
        onPause={handlePauseSession}
        onResume={handleResumeSession}
        onStop={handleFinishSession}
        onSkipInterval={handleSkipInterval}
        onAdjustErgBias={handleAdjustErgBias}
        onAdjustManualWatts={handleAdjustManualWatts}
        onExportFit={handleExportFit}
        workoutTitle={currentWorkout?.title}
        onOpenWorkout={() => setIsWorkoutModalOpen(true)}
        onOpenBluetooth={() => setIsBluetoothModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        isCompact={isNative}
      />

      {/* WORKOUT SELECTION MODAL */}
      <WorkoutModal
        isOpen={isWorkoutModalOpen}
        onClose={() => setIsWorkoutModalOpen(false)}
        currentWorkout={currentWorkout}
        ftp={settings.ftp}
        onSelectWorkout={handleSelectWorkout}
      />

      {/* SESSION SUMMARY MODAL */}
      <SessionSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        summary={sessionSummary}
        workoutTitle={currentWorkout?.title}
      />
    </div>
  );
};
