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
  TelemetryData,
  TelemetrySample,
  UserSettings,
} from '../../types';

import { BluetoothManager, TelemetryEvent } from '../../services/bluetooth/bluetoothManager';
import { CyclingPhysicsEngine } from '../../services/physics/speedCalculator';
import { WorkoutEngine, WorkoutEngineState } from '../../services/workout/workoutEngine';
import { getPowerZoneInfo, getPowerZoneNumber, getHeartRateZoneInfo } from '../../utils/zones';
import { SAMPLE_WORKOUTS, parseZwoWorkout } from '../../services/workout/zwoParser';
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
} from 'lucide-react';

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

  // Session recording state
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
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
    <div className="flex-1 w-full max-w-full flex flex-col justify-between gap-2.5 sm:gap-3.5 animate-fadeIn select-none h-full">
      {/* 
        1. FIRST CARD: "Studio Cockpit Bar"
        - Hidden on APK (isNative=true)
        - Rendered on Webapp / Desktop (isNative=false) as a full-width header
      */}
      {!isNative && (
        <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-[#1F2025] p-4 rounded-2xl border border-[#383941]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00E5A3]/10 border border-[#00E5A3]/30 flex items-center justify-center text-[#00E5A3]">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Indoor Smart Trainer Studio</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#00E5A3]/15 text-[#00E5A3] border border-[#00E5A3]/30 uppercase">
                  ERG Live
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                FTMS Bluetooth Control • Physics Engine • Zwift .ZWO Runner • Garmin .FIT Export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsWorkoutModalOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                currentWorkout
                  ? 'bg-[#00E5A3]/15 border-[#00E5A3]/40 text-[#00E5A3]'
                  : 'bg-[#2F3037] border-[#383941] text-slate-300 hover:bg-[#3E4049]'
              }`}
            >
              <Dumbbell className="w-4 h-4 text-[#00E5A3]" />
              <span className="max-w-[160px] truncate">
                {currentWorkout ? currentWorkout.title : 'Workout (.zwo)'}
              </span>
            </button>

            <button
              onClick={() => setIsBluetoothModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2F3037] hover:bg-[#3E4049] border border-[#383941] text-xs font-bold text-slate-200 transition-colors"
            >
              <Bluetooth className="w-4 h-4 text-[#00E5A3]" />
              <span>Sensors</span>
            </button>

            <button
              onClick={handleExportFit}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-xs font-bold text-emerald-300 shadow-sm transition-all"
              title="Download or generate .FIT file for Strava & Garmin"
            >
              <Download className="w-4 h-4" />
              <span>Export .FIT</span>
            </button>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              title="Studio Settings"
              className="p-2 rounded-xl bg-[#2F3037] hover:bg-[#3E4049] border border-[#383941] text-slate-300 hover:text-white transition-colors"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
                Target: <strong className="text-white font-mono text-sm">{engineState.instantaneousTargetPower}W</strong>
                {engineState.instantaneousTargetCadence && (
                  <span className="text-slate-400 font-mono"> • {engineState.instantaneousTargetCadence}rpm</span>
                )}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs text-slate-400 font-bold uppercase mr-1.5 hidden sm:inline">Interval:</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-[#00E5A3] leading-none">
              {formatTime(engineState.intervalRemainingSeconds)}
            </span>
          </div>
        </div>
      )}

      {/* 
        2. PRIMARY METRICS: POWER, CADENCE, HEART RATE, SPEED
        - On mobile/APK: 2x2 grid filling the upper half of screen nicely
        - On webapp / desktop: 4 expansive columns across the whole monitor!
      */}
      <div className={`grid gap-2.5 sm:gap-3.5 ${
        isNative ? 'grid-cols-2 flex-[1.4]' : 'grid-cols-2 lg:grid-cols-4 flex-1 min-h-[170px] lg:min-h-[220px]'
      }`}>
        {/* Card 1: POWER */}
        <MetricCard
          variant="hud"
          isSmall={isNative}
          label="Power"
          value={telemetry.power}
          unit="Watts"
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
                {telemetry.cadence >= 90 ? 'High' : telemetry.cadence >= 80 ? 'Optimal' : telemetry.cadence > 0 ? 'Mashing' : 'Coasting'}
              </span>
            )
          }
          gaugePercent={Math.min(100, (telemetry.cadence / 120) * 100)}
          gaugeColor="#00E5A3"
          footer={
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-400">Cadence Status</span>
              <span className="font-mono font-bold text-slate-300">
                {telemetry.cadence > 0 ? `${telemetry.cadence} rev/min` : 'Coasting'}
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
                Zone <strong className="text-rose-400">{telemetry.hrZone}</strong> (
                {Math.round((telemetry.heartRate / settings.maxHeartRate) * 100)}%)
              </span>
            ) : (
              <span className="text-xs sm:text-sm text-slate-500">No HR sensor</span>
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
              <span className="text-slate-400">HR Intensity</span>
              <span className="font-mono font-bold text-slate-300 truncate max-w-[120px]">
                {telemetry.heartRate > 0
                  ? getHeartRateZoneInfo(telemetry.heartRate, settings.maxHeartRate, settings.hrZones).name
                  : 'Awaiting sensor'}
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
            <span className="font-mono text-xs sm:text-sm text-slate-400">
              {telemetry.speedMps.toFixed(1)} m/s • Grade {settings.gradientPercent}%
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
        Elapsed, Distance, Work (kJ), Calories, Remaining, FTP
      */}
      <div className="grid grid-cols-6 gap-2 sm:gap-3 w-full">
        <div className="p-2 sm:p-3 rounded-xl bg-[#1F2025] border border-[#383941] text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3 text-[#00E5A3] hidden sm:inline" /> Elapsed
          </div>
          <div className="text-xs sm:text-base font-bold font-mono text-white mt-0.5">
            {formatTime(telemetry.elapsedSeconds)}
          </div>
        </div>

        <div className="p-2 sm:p-3 rounded-xl bg-[#1F2025] border border-[#383941] text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
            <Compass className="w-3 h-3 text-cyan-400 hidden sm:inline" /> Distance
          </div>
          <div className="text-xs sm:text-base font-bold font-mono text-cyan-400 mt-0.5 truncate">
            {displayDist} <span className="text-[10px] font-normal">{distUnit}</span>
          </div>
        </div>

        <div className="p-2 sm:p-3 rounded-xl bg-[#1F2025] border border-[#383941] text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
            <Zap className="w-3 h-3 text-amber-400 hidden sm:inline" /> Work
          </div>
          <div className="text-xs sm:text-base font-bold font-mono text-amber-400 mt-0.5 truncate">
            {Math.round(telemetry.workKj)} <span className="text-[10px] font-normal">kJ</span>
          </div>
        </div>

        <div className="p-2 sm:p-3 rounded-xl bg-[#1F2025] border border-[#383941] text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
            <Flame className="w-3 h-3 text-orange-400 hidden sm:inline" /> Calories
          </div>
          <div className="text-xs sm:text-base font-bold font-mono text-orange-400 mt-0.5 truncate">
            {telemetry.calories} <span className="text-[10px] font-normal">kcal</span>
          </div>
        </div>

        <div className="p-2 sm:p-3 rounded-xl bg-[#1F2025] border border-[#383941] text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">
            Rem.
          </div>
          <div className="text-xs sm:text-base font-bold font-mono text-slate-300 mt-0.5">
            {currentWorkout ? formatTime(engineState.workoutRemainingSeconds) : '--:--'}
          </div>
        </div>

        <div className="p-2 sm:p-3 rounded-xl bg-[#1F2025] border border-[#383941] text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">
            Rider FTP
          </div>
          <div className="text-xs sm:text-base font-bold font-mono text-yellow-400 mt-0.5">
            {settings.ftp}W
          </div>
        </div>
      </div>

      {/* 
        4. TRAINING GRAPH (WORKOUT PROFILE CHART)
        - Mobile/APK: flex-1 expansion so no empty space down
        - Webapp/Desktop: expansive chart filling the wide screen
      */}
      <WorkoutProfileChart
        workout={currentWorkout}
        currentSecond={engineState.workoutElapsedSeconds}
        currentIntervalIndex={engineState.currentIntervalIndex}
        ftp={settings.ftp}
        onSelectInterval={(_idx) => {}}
        onOpenWorkoutModal={() => setIsWorkoutModalOpen(true)}
        isCompact={isNative}
      />

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
