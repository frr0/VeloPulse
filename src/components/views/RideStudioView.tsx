import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MetricCard } from '../MetricCard';
import { WorkoutProfileChart } from '../WorkoutProfileChart';
import { WorkoutControls } from '../WorkoutControls';
import { BluetoothModal } from '../BluetoothModal';
import { WorkoutModal } from '../WorkoutModal';
import { SettingsModal } from '../SettingsModal';
import { SessionSummaryModal } from '../SessionSummaryModal';
import { FitDownloadCard } from '../FitDownloadCard';
import { createFitFileInfo } from '../../services/fit/fitGenerator';

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
  AlertCircle,
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
        // Send target watts to Bluetooth smart trainer!
        bm.setTargetPower(targetWatts);
      },
      () => {
        // Workout finished automatically
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

      // 3-second power smoothing
      powerHistoryRef.current.push(power);
      if (powerHistoryRef.current.length > 3) {
        powerHistoryRef.current.shift();
      }
      const power3s = Math.round(
        powerHistoryRef.current.reduce((a, b) => a + b, 0) / powerHistoryRef.current.length
      );

      // If active session, tick workout engine & step physics
      if (sessionStatus === 'running') {
        workoutEngineRef.current.tick();

        // 30s power smoothing for NP
        power30sHistoryRef.current.push(power);

        // Run physics simulation
        const physics = physicsEngineRef.current.step(power, cadence, 1.0);

        const currentSpeedKmh =
          settings.speedSource === 'trainer' && trainerSpeedRef.current !== undefined
            ? trainerSpeedRef.current
            : physics.currentVelocityKmh;
        const currentSpeedMps = currentSpeedKmh / 3.6;
        const currentSpeedMph = currentSpeedKmh * 0.621371;

        // Work and calories
        const dt = 1; // 1 second
        const joules = power * dt;

        sessionSecondsRef.current += 1;
        const currentElapsedSeconds = sessionSecondsRef.current;

        const curTarget = workoutEngineRef.current.calculateInstantaneousTargetWatts();
        const pZone = getPowerZoneNumber(power, settings.ftp);
        const hrZone = getHeartRateZoneInfo(heartRate, settings.maxHeartRate).zone;

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

        // Record sample for .FIT export
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
        // Idle or paused: update instantaneous live readings without accumulating workout time/distance
        const curTarget = workoutEngineRef.current.calculateInstantaneousTargetWatts();
        const pZone = getPowerZoneNumber(power, settings.ftp);
        const hrZone = getHeartRateZoneInfo(heartRate, settings.maxHeartRate).zone;

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

  const handleFinishSession = () => {
    setSessionStatus('idle');
    workoutEngineRef.current.finish();

    const samples = samplesRef.current;
    const startTime = sessionStartTimeRef.current || new Date();
    const endTime = new Date();
    const totalTimerTime = sessionSecondsRef.current;
    const totalElapsedTime = Math.max(
      totalTimerTime,
      Math.round((endTime.getTime() - startTime.getTime()) / 1000)
    );

    // Compute workout summary stats
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

    const avgPower = samples.length > 0 ? Math.round(sumPower / samples.length) : 0;
    const avgCadence = cadenceCount > 0 ? Math.round(sumCadence / cadenceCount) : 0;
    const avgHeartRate = hrCount > 0 ? Math.round(sumHr / hrCount) : 0;
    const avgSpeedKmh =
      totalTimerTime > 0 ? Number(((telemetry.distanceMeters / totalTimerTime) * 3.6).toFixed(1)) : 0;

    // Coggan Normalized Power calculation
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

    const summary: SessionSummary = {
      startTime,
      endTime,
      totalElapsedTimeSeconds: totalElapsedTime,
      totalTimerTimeSeconds: totalTimerTime,
      totalDistanceMeters: telemetry.distanceMeters,
      avgPowerWatts: avgPower,
      maxPowerWatts: maxPower,
      normalizedPowerWatts: normalizedPower,
      avgCadenceRpm: avgCadence,
      maxCadenceRpm: maxCadence,
      avgHeartRateBpm: avgHeartRate,
      maxHeartRateBpm: maxHr,
      avgSpeedKmh,
      maxSpeedKmh: Number(maxSpeedKmh.toFixed(1)),
      totalWorkKj: telemetry.workKj,
      totalCaloriesKcal: telemetry.calories,
      trainingStressScore,
      intensityFactor,
      samples,
    };

    setSessionSummary(summary);
    try {
      localStorage.setItem('velopulse_last_summary', JSON.stringify(summary));
    } catch {
      // ignore quota err
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
    let summaryToExport = sessionSummary;
    if (!summaryToExport) {
      const saved = localStorage.getItem('velopulse_last_summary');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          parsed.startTime = new Date(parsed.startTime);
          parsed.endTime = new Date(parsed.endTime);
          summaryToExport = parsed;
        } catch (e) {
          console.warn('Failed parsing saved summary', e);
        }
      }
    }

    if (!summaryToExport) {
      // Demo test activity summary so the user can immediately test FIT export
      const now = new Date();
      const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
      summaryToExport = {
        startTime: fifteenMinsAgo,
        endTime: now,
        totalElapsedTimeSeconds: 900,
        totalTimerTimeSeconds: 900,
        totalDistanceMeters: 7500,
        avgPowerWatts: Math.round(settings.ftp * 0.75),
        maxPowerWatts: Math.round(settings.ftp * 1.15),
        normalizedPowerWatts: Math.round(settings.ftp * 0.78),
        avgCadenceRpm: 88,
        maxCadenceRpm: 104,
        avgHeartRateBpm: 145,
        maxHeartRateBpm: 168,
        avgSpeedKmh: 30.0,
        maxSpeedKmh: 37.5,
        totalWorkKj: 170,
        totalCaloriesKcal: 178,
        trainingStressScore: 16,
        intensityFactor: 0.78,
        samples: [],
      };
    }

    setSessionSummary(summaryToExport);
    try {
      const fileInfo = createFitFileInfo(summaryToExport);
      setFitFileInfo(fileInfo);
    } catch (err) {
      console.error('Failed to generate FIT file:', err);
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

  // Visual Zone configuration for current power
  const currentPowerZone = useMemo(() => {
    return getPowerZoneInfo(telemetry.power, settings.ftp);
  }, [telemetry.power, settings.ftp]);

  // Target power gauge percentage
  const powerGaugePercent = useMemo(() => {
    const target = telemetry.targetPower || settings.ftp;
    return target > 0 ? Math.min(150, Math.max(0, (telemetry.power / target) * 100)) : 0;
  }, [telemetry.power, telemetry.targetPower, settings.ftp]);

  // Format MM:SS helper
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
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Studio Cockpit Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111622] p-4 rounded-2xl border border-[#232D42]">
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

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsWorkoutModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              currentWorkout
                ? 'bg-[#00E5A3]/15 border-[#00E5A3]/40 text-[#00E5A3]'
                : 'bg-[#1A2234] border-[#232D42] text-slate-300 hover:bg-[#25324C]'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5 text-[#00E5A3]" />
            <span className="max-w-[130px] sm:max-w-[180px] truncate">
              {currentWorkout ? currentWorkout.title : 'Select Workout (.zwo)'}
            </span>
          </button>

          <button
            onClick={() => setIsBluetoothModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A2234] hover:bg-[#25324C] border border-[#232D42] text-xs font-bold text-slate-200 transition-colors"
          >
            <Bluetooth className="w-3.5 h-3.5 text-[#00E5A3]" />
            <span className="hidden sm:inline">Sensors</span>
          </button>

          <button
            onClick={handleExportFit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-xs font-bold text-emerald-300 shadow-sm transition-all"
            title="Download or generate .FIT file for Strava & Garmin"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export .FIT</span>
          </button>

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            title="Studio Settings"
            className="p-2 rounded-xl bg-[#1A2234] hover:bg-[#25324C] border border-[#232D42] text-slate-300 hover:text-white transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Simulation mode indicator banner if active */}
      {devicesState.isSimulated && (
        <div className="p-3.5 rounded-2xl bg-purple-950/60 border border-purple-800/80 text-purple-200 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
            <span className="font-bold">Virtual Cyclist Simulator Active:</span>
            <span className="text-purple-300/80">
              Generating realistic smart trainer power, cadence, and HR without physical hardware.
            </span>
          </div>
          <button
            onClick={() => bluetoothManager.stopSimulation()}
            className="px-3 py-1 rounded-xl bg-purple-800 hover:bg-purple-700 text-white font-bold text-xs"
          >
            Exit Demo
          </button>
        </div>
      )}

      {/* FIT File Download Card */}
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

      {/* Current Interval Banner / Prompt (when workout is active) */}
      {currentWorkout && engineState.currentInterval && (
        <div className="rounded-2xl bg-[#111622] border border-[#232D42] p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-3.5 h-10 rounded-full"
              style={{ backgroundColor: currentPowerZone.color }}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {engineState.currentInterval.type} ({engineState.currentIntervalIndex + 1}/
                  {currentWorkout.intervals.length})
                </span>
                {engineState.currentInterval.repeatIndex && (
                  <span className="text-[10px] font-bold bg-[#1A2234] text-[#00E5A3] px-2 py-0.5 rounded-full">
                    Rep {engineState.currentInterval.repeatIndex}/{engineState.currentInterval.totalRepeats}
                  </span>
                )}
              </div>
              <div className="text-base md:text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                <span>Target: {engineState.instantaneousTargetPower} W</span>
                {engineState.instantaneousTargetCadence && (
                  <span className="text-xs font-semibold text-slate-400">
                    • {engineState.instantaneousTargetCadence} RPM
                  </span>
                )}
                {engineState.currentInterval.text && (
                  <span className="text-xs text-slate-400 italic font-normal">
                    • "{engineState.currentInterval.text}"
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Interval Countdown & Next Interval Preview */}
          <div className="flex items-center gap-6">
            {engineState.nextInterval && (
              <div className="hidden md:block text-right text-xs">
                <div className="text-slate-500 uppercase font-semibold">Next Up</div>
                <div className="text-slate-300 font-bold">
                  {Math.round(engineState.nextInterval.power * settings.ftp)} W (
                  {formatTime(engineState.nextInterval.durationSeconds)})
                </div>
              </div>
            )}

            <div className="text-right">
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                Interval Remaining
              </div>
              <div className="text-2xl md:text-3xl font-black font-mono text-[#00E5A3]">
                {formatTime(engineState.intervalRemainingSeconds)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. PRIMARY METRICS HUD (Cockpit Readouts) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Card 1: POWER */}
        <MetricCard
          variant="hud"
          label="Power"
          value={telemetry.power}
          unit="Watts"
          icon={<Zap className="w-4 h-4" />}
          accentColor={currentPowerZone.color}
          subValue={
            <span className="font-mono text-xs text-slate-400">
              3s: <strong className="text-white">{telemetry.power3s}W</strong> •{' '}
              <strong style={{ color: currentPowerZone.color }}>{currentPowerZone.name}</strong>
            </span>
          }
          gaugePercent={powerGaugePercent}
          gaugeColor={currentPowerZone.color}
          footer={
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Target Power</span>
              <span className="font-mono font-bold text-white text-sm">
                {telemetry.targetPower} W
                <span className="text-[11px] text-slate-500 ml-1 font-normal">
                  ({Math.round((telemetry.targetPower / settings.ftp) * 100)}% FTP)
                </span>
              </span>
            </div>
          }
          highlight={sessionStatus === 'running'}
        />

        {/* Card 2: CADENCE */}
        <MetricCard
          variant="hud"
          label="Cadence"
          value={telemetry.cadence}
          unit="RPM"
          icon={<Activity className="w-4 h-4" />}
          accentColor="#00E5A3"
          subValue={
            telemetry.targetCadence ? (
              <span className="text-xs text-slate-400">
                Target: <strong className="text-[#00E5A3]">{telemetry.targetCadence}</strong> RPM
              </span>
            ) : (
              <span className="text-xs text-slate-400">
                {telemetry.cadence >= 90
                  ? 'High Cadence'
                  : telemetry.cadence >= 80
                  ? 'Optimal'
                  : telemetry.cadence > 0
                  ? 'Mashing'
                  : 'Coasting'}
              </span>
            )
          }
          gaugePercent={Math.min(100, (telemetry.cadence / 120) * 100)}
          gaugeColor="#00E5A3"
          footer={
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Cadence Status</span>
              <span className="font-mono font-bold text-slate-300">
                {telemetry.cadence > 0 ? `${telemetry.cadence} rev/min` : 'Standstill'}
              </span>
            </div>
          }
        />

        {/* Card 3: HEART RATE */}
        <MetricCard
          variant="hud"
          label="Heart Rate"
          value={telemetry.heartRate || '--'}
          unit="BPM"
          icon={<Heart className="w-4 h-4 animate-pulse text-rose-500" />}
          accentColor="#f87171"
          subValue={
            telemetry.heartRate > 0 ? (
              <span className="text-xs text-slate-400">
                Zone <strong className="text-rose-400">{telemetry.hrZone}</strong> (
                {Math.round((telemetry.heartRate / settings.maxHeartRate) * 100)}% max)
              </span>
            ) : (
              <span className="text-xs text-slate-500">No HR sensor</span>
            )
          }
          gaugePercent={
            telemetry.heartRate > 0
              ? Math.min(100, Math.max(0, (telemetry.heartRate / settings.maxHeartRate) * 100))
              : 0
          }
          gaugeColor="#f87171"
          footer={
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">HR Intensity</span>
              <span className="font-mono font-bold text-slate-300">
                {telemetry.heartRate > 0
                  ? getHeartRateZoneInfo(telemetry.heartRate, settings.maxHeartRate).name
                  : 'Awaiting sensor'}
              </span>
            </div>
          }
        />

        {/* Card 4: SPEED / VELOCITY */}
        <MetricCard
          variant="hud"
          label="Speed / Velocity"
          value={displaySpeed.toFixed(1)}
          unit={speedUnit}
          icon={<Gauge className="w-4 h-4" />}
          accentColor="#4ade80"
          subValue={
            <span className="font-mono text-xs text-slate-400">
              {telemetry.speedMps.toFixed(1)} m/s • Grade: {settings.gradientPercent}%
            </span>
          }
          gaugePercent={Math.min(100, (telemetry.speedKmh / 60) * 100)}
          gaugeColor="#4ade80"
          footer={
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Physics Engine</span>
              <span className="font-mono font-bold text-emerald-400 text-[11px]">
                {settings.speedSource === 'physics'
                  ? 'Aero + Rolling + Grade'
                  : 'Trainer Flywheel'}
              </span>
            </div>
          }
        />
      </div>

      {/* 2. SECONDARY STATS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Elapsed Time */}
        <div className="p-3.5 rounded-2xl bg-[#111622] border border-[#232D42] text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3 text-[#00E5A3]" /> Elapsed
          </div>
          <div className="text-lg md:text-xl font-bold font-mono text-white mt-1">
            {formatTime(telemetry.elapsedSeconds)}
          </div>
        </div>

        {/* Total Distance */}
        <div className="p-3.5 rounded-2xl bg-[#111622] border border-[#232D42] text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
            <Compass className="w-3 h-3 text-cyan-400" /> Distance
          </div>
          <div className="text-lg md:text-xl font-bold font-mono text-cyan-400 mt-1">
            {displayDist} <span className="text-xs font-normal text-slate-400">{distUnit}</span>
          </div>
        </div>

        {/* Energy Work (kJ) */}
        <div className="p-3.5 rounded-2xl bg-[#111622] border border-[#232D42] text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" /> Work Done
          </div>
          <div className="text-lg md:text-xl font-bold font-mono text-amber-400 mt-1">
            {Math.round(telemetry.workKj)}{' '}
            <span className="text-xs font-normal text-slate-400">kJ</span>
          </div>
        </div>

        {/* Calories (kcal) */}
        <div className="p-3.5 rounded-2xl bg-[#111622] border border-[#232D42] text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
            <Flame className="w-3 h-3 text-orange-400" /> Calories
          </div>
          <div className="text-lg md:text-xl font-bold font-mono text-orange-400 mt-1">
            {telemetry.calories}{' '}
            <span className="text-xs font-normal text-slate-400">kcal</span>
          </div>
        </div>

        {/* Workout Remaining */}
        <div className="p-3.5 rounded-2xl bg-[#111622] border border-[#232D42] text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Remaining
          </div>
          <div className="text-lg md:text-xl font-bold font-mono text-slate-300 mt-1">
            {currentWorkout
              ? formatTime(engineState.workoutRemainingSeconds)
              : '--:--'}
          </div>
        </div>

        {/* User FTP */}
        <div className="p-3.5 rounded-2xl bg-[#111622] border border-[#232D42] text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Rider FTP
          </div>
          <div className="text-lg md:text-xl font-bold font-mono text-yellow-400 mt-1">
            {settings.ftp} <span className="text-xs font-normal text-slate-400">W</span>
          </div>
        </div>
      </div>

      {/* 3. WORKOUT PROFILE CHART */}
      <WorkoutProfileChart
        workout={currentWorkout}
        currentSecond={engineState.workoutElapsedSeconds}
        currentIntervalIndex={engineState.currentIntervalIndex}
        ftp={settings.ftp}
        onSelectInterval={(_idx) => {
          // Jump to interval
        }}
      />

      {/* 4. TACTILE WORKOUT CONTROLS */}
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
