import React, { useState, useEffect, useRef } from 'react';
import { ActivityDetailView } from './components/views/ActivityDetailView';
import { BluetoothModal } from './components/BluetoothModal';
import { LoginView } from './components/LoginView';
import { Navbar, NavTab } from './components/Navbar';
import { SettingsModal } from './components/SettingsModal';
import { ActivitiesView } from './components/views/ActivitiesView';
import { CalendarView } from './components/views/CalendarView';
import { DashboardView } from './components/views/DashboardView';
import { AnalyticsTab, FitnessView } from './components/views/FitnessView';
import { ProfileView } from './components/views/ProfileView';
import { RideStudioView } from './components/views/RideStudioView';
import { AppProvider, useApp } from './context/AppContext';
import { BluetoothManager } from './services/bluetooth/bluetoothManager';
import {
  Activity,
  BluetoothDevicesState,
  CalendarEvent,
  ParsedWorkout,
  UserSettings,
} from './types';
import { convertCalendarEventToWorkout } from './utils/workoutConverter';
import { getDefaultHrZones } from './utils/zones';
import { sportSettingsToHrZones } from './services/intervals/api';
import { isAndroid } from './utils/platform';

const DEFAULT_SETTINGS: UserSettings = {
  ftp: 250,
  riderWeightKg: 75,
  bikeWeightKg: 9,
  cda: 0.32,
  crr: 0.004,
  gradientPercent: 0,
  maxHeartRate: 190,
  restingHeartRate: 55,
  soundAlerts: true,
  speedSource: 'physics',
  wheelCircumferenceMm: 2105,
  hrZones: getDefaultHrZones(190, 55),
};

function MainApp() {
  const { credentials, athlete, isLoading, useImperial } = useApp();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [returnTab, setReturnTab] = useState<NavTab>('activities');
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('fitness');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const handleSelectActivity = (activity: Activity) => {
    setReturnTab(currentTab);
    setSelectedActivity(activity);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackFromActivity = () => {
    setSelectedActivity(null);
    setCurrentTab(returnTab);
  };

  const handleSelectTab = (tab: NavTab) => {
    setSelectedActivity(null);
    setCurrentTab(tab);
  };

  // User Settings state
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('velopulse_settings') || localStorage.getItem('velotrain_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  // Keep settings FTP/weight synced if athlete profile updates from Intervals.icu
  useEffect(() => {
    if (athlete) {
      setSettings((prev) => {
        let changed = false;
        const updated = { ...prev };
        if (athlete.ftp && athlete.ftp !== prev.ftp) {
          updated.ftp = athlete.ftp;
          changed = true;
        }
        if (athlete.weight && Math.abs(athlete.weight - prev.riderWeightKg) > 0.5) {
          updated.riderWeightKg = athlete.weight;
          changed = true;
        }
        if (athlete.maxHR && athlete.maxHR !== prev.maxHeartRate) {
          updated.maxHeartRate = athlete.maxHR;
          changed = true;
        }
        if (athlete.restingHR && athlete.restingHR !== prev.restingHeartRate) {
          updated.restingHeartRate = athlete.restingHR;
          changed = true;
        }
        if (!prev.hrZones || prev.hrZones.length === 0 || athlete.sportSettings) {
          const matchSport = athlete.sportSettings?.find((s) => s.types?.includes('Ride') || s.id === 'Ride') || athlete.sportSettings?.[0];
          if (matchSport?.hr_zones && matchSport.hr_zones.length > 0) {
            updated.hrZones = sportSettingsToHrZones(matchSport, updated.maxHeartRate, updated.restingHeartRate);
            changed = true;
          } else if (!prev.hrZones || prev.hrZones.length === 0) {
            updated.hrZones = getDefaultHrZones(updated.maxHeartRate, updated.restingHeartRate);
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem('velopulse_settings', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }
  }, [athlete]);

  // Persist settings changes
  const handleUpdateSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    localStorage.setItem('velopulse_settings', JSON.stringify(newSettings));
  };

  // Bluetooth Manager shared across app
  const bluetoothManagerRef = useRef<BluetoothManager>(new BluetoothManager());
  const [devicesState, setDevicesState] = useState<BluetoothDevicesState>(
    bluetoothManagerRef.current.getState()
  );

  useEffect(() => {
    const bm = bluetoothManagerRef.current;
    bm.setOnStateChange((state) => {
      setDevicesState(state);
    });
  }, []);

  // Modals state
  const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Active workout loaded from Calendar
  const [activeWorkoutFromCalendar, setActiveWorkoutFromCalendar] = useState<ParsedWorkout | null>(null);

  const handleNavigateToFitness = (subTab?: AnalyticsTab) => {
    if (subTab) setAnalyticsTab(subTab);
    setCurrentTab('fitness');
  };

  const handleRideCalendarWorkout = (event: CalendarEvent) => {
    const converted = convertCalendarEventToWorkout(event, settings.ftp);
    setActiveWorkoutFromCalendar(converted);
    setCurrentTab('ride');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#131316] gap-3">
        <div className="w-9 h-9 border-3 border-[#00E5A3] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-slate-400">Loading VeloPulse...</span>
      </div>
    );
  }

  if (!credentials) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-[#131316] text-white flex flex-col font-sans selection:bg-[#00E5A3]/20 selection:text-[#00E5A3]">
      <Navbar
        currentTab={selectedActivity ? returnTab : currentTab}
        onSelectTab={handleSelectTab}
        devicesState={devicesState}
        onOpenBluetooth={() => setIsBluetoothModalOpen(true)}
      />

      <main
        className={`flex-1 w-full mx-auto flex flex-col max-w-7xl px-4 sm:px-6 lg:px-8 ${
          currentTab === 'ride' && !selectedActivity
            ? isAndroid()
              ? 'pt-4 pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))] sm:py-8'
              : 'min-h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-4rem)] lg:max-h-[calc(100dvh-4rem)] py-4 sm:py-6 lg:overflow-hidden justify-between'
            : isAndroid()
            ? 'pt-4 pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))] sm:py-8'
            : 'py-6 sm:py-8'
        }`}
      >
        {selectedActivity ? (
          <ActivityDetailView
            activity={selectedActivity}
            onBack={handleBackFromActivity}
            returnTabName={returnTab === 'dashboard' ? 'Dashboard' : 'Attività'}
            useImperial={useImperial}
            settings={settings}
          />
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                onSelectActivity={handleSelectActivity}
                onNavigateTab={handleSelectTab}
                onNavigateAnalytics={handleNavigateToFitness}
                onOpenBluetooth={() => setIsBluetoothModalOpen(true)}
              />
            )}

            {currentTab === 'ride' && (
              <RideStudioView
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                bluetoothManager={bluetoothManagerRef.current}
                devicesState={devicesState}
                isBluetoothModalOpen={isBluetoothModalOpen}
                setIsBluetoothModalOpen={setIsBluetoothModalOpen}
                isSettingsModalOpen={isSettingsModalOpen}
                setIsSettingsModalOpen={setIsSettingsModalOpen}
                activeWorkoutFromCalendar={activeWorkoutFromCalendar}
                onClearCalendarWorkout={() => setActiveWorkoutFromCalendar(null)}
                useImperial={useImperial}
              />
            )}

            {currentTab === 'fitness' && (
              <FitnessView key={analyticsTab} initialTab={analyticsTab} />
            )}

            {currentTab === 'activities' && (
              <ActivitiesView onSelectActivity={handleSelectActivity} />
            )}

            {currentTab === 'plan' && (
              <CalendarView onRideWorkout={handleRideCalendarWorkout} />
            )}

            {currentTab === 'profile' && (
              <ProfileView
                settings={settings}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onOpenBluetooth={() => setIsBluetoothModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Global Bluetooth Sensors Modal */}
      <BluetoothModal
        isOpen={isBluetoothModalOpen}
        onClose={() => setIsBluetoothModalOpen(false)}
        devicesState={devicesState}
        onConnectTrainer={() => bluetoothManagerRef.current.connectTrainer()}
        onDisconnectTrainer={() => bluetoothManagerRef.current.disconnectTrainer()}
        onConnectCadence={() => bluetoothManagerRef.current.connectCadence()}
        onDisconnectCadence={() => bluetoothManagerRef.current.disconnectCadence()}
        onConnectHeartRate={() => bluetoothManagerRef.current.connectHeartRate()}
        onDisconnectHeartRate={() => bluetoothManagerRef.current.disconnectHeartRate()}
        onToggleSimulation={() => bluetoothManagerRef.current.toggleSimulation()}
      />

      {/* Global Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleUpdateSettings}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
