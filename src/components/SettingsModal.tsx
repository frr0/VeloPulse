import React, { useState, useEffect } from 'react';
import { X, Settings, Volume2, Save, Heart, Download, RefreshCw, CheckCircle2, Compass } from 'lucide-react';
import { UserSettings, HrZoneCustom } from '../types';
import { useApp } from '../context/AppContext';
import { getAthleteSportSettings, sportSettingsToHrZones } from '../services/intervals/api';
import { getDefaultHrZones } from '../utils/zones';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSaveSettings: (settings: UserSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const { credentials, athlete } = useApp();
  const [formData, setFormData] = useState<UserSettings>(() => {
    const initialZones =
      settings.hrZones && settings.hrZones.length > 0
        ? settings.hrZones
        : getDefaultHrZones(settings.maxHeartRate, settings.restingHeartRate);
    return { ...settings, hrZones: initialZones };
  });

  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ message: string; isError?: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initialZones =
        settings.hrZones && settings.hrZones.length > 0
          ? settings.hrZones
          : getDefaultHrZones(settings.maxHeartRate, settings.restingHeartRate);
      setFormData({ ...settings, hrZones: initialZones });
      setImportStatus(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleImportFromIntervals = async () => {
    setIsImporting(true);
    setImportStatus(null);
    try {
      if (!credentials || credentials.isDemo) {
        const freshZones = getDefaultHrZones(formData.maxHeartRate, formData.restingHeartRate);
        setFormData((prev) => ({ ...prev, hrZones: freshZones }));
        setImportStatus({ message: 'Loaded 5 physiological zones based on Max HR (Demo Mode).' });
        return;
      }

      const sport = await getAthleteSportSettings(credentials.apiKey, credentials.athleteId, 'Ride');
      if (sport && sport.hr_zones && sport.hr_zones.length > 0) {
        const importedZones = sportSettingsToHrZones(
          sport,
          sport.max_hr || formData.maxHeartRate,
          formData.restingHeartRate
        );
        setFormData((prev) => ({
          ...prev,
          hrZones: importedZones,
          maxHeartRate: sport.max_hr || prev.maxHeartRate,
        }));
        setImportStatus({
          message: `Successfully imported ${importedZones.length} HR zones from Intervals.icu!`,
        });
      } else {
        const fallbackZones = getDefaultHrZones(
          athlete?.maxHR || formData.maxHeartRate,
          athlete?.restingHR || formData.restingHeartRate
        );
        setFormData((prev) => ({ ...prev, hrZones: fallbackZones }));
        setImportStatus({ message: 'Calculated HR zones from athlete profile.' });
      }
    } catch (err: any) {
      setImportStatus({
        message: err.message || 'Could not fetch HR zones from Intervals.icu',
        isError: true,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleUpdateZone = (index: number, field: 'name' | 'minBpm' | 'maxBpm', val: string | number) => {
    const list = [...(formData.hrZones || [])];
    if (!list[index]) return;
    list[index] = {
      ...list[index],
      [field]: val,
    };
    setFormData({ ...formData, hrZones: list });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  const currentZones = formData.hrZones || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-[#1F2025] border border-[#383941] shadow-2xl p-5 sm:p-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#383941] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#A8C7FA]/15 text-[#A8C7FA] border border-[#A8C7FA]/30">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Rider & Training Settings</h2>
              <p className="text-xs text-[#9E9EA7]">
                FTP, custom HR zones, aerodynamics, and sensor telemetry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#9E9EA7] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto space-y-4 my-4 pr-1">
          {/* FTP */}
          <div className="p-4 rounded-2xl bg-[#26272D] border border-[#383941]">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#9E9EA7] mb-1">
              Functional Threshold Power (FTP)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="50"
                max="600"
                value={formData.ftp}
                onChange={(e) => setFormData({ ...formData, ftp: Math.max(50, parseInt(e.target.value) || 200) })}
                className="w-full bg-[#131316] border border-[#383941] rounded-2xl px-4 py-2.5 text-white font-mono text-lg font-bold focus:outline-none focus:border-[#A8C7FA]"
              />
              <span className="text-[#9E9EA7] font-bold text-sm">Watts</span>
            </div>
            <p className="text-[11px] text-[#9E9EA7] mt-1.5">
              Target wattages in .zwo workouts scale automatically based on your FTP.
            </p>
          </div>

          {/* Heart Rate Zones Section */}
          <div className="p-4 rounded-2xl bg-[#26272D] border border-[#383941]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Heart Rate Zones (BPM)
                </span>
              </div>
              <button
                type="button"
                onClick={handleImportFromIntervals}
                disabled={isImporting}
                className="px-3.5 py-1.5 rounded-full bg-[#A8C7FA]/15 hover:bg-[#A8C7FA]/25 border border-[#A8C7FA]/30 text-[#A8C7FA] font-bold text-xs flex items-center gap-1.5 transition-all self-start sm:self-auto disabled:opacity-50"
              >
                {isImporting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Import from Intervals.icu
              </button>
            </div>

            {importStatus && (
              <div
                className={`p-2.5 rounded-2xl text-xs mb-3 font-medium flex items-center gap-2 ${
                  importStatus.isError
                    ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                    : 'bg-[#6DD58C]/15 border border-[#6DD58C]/30 text-[#6DD58C]'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{importStatus.message}</span>
              </div>
            )}

            <div className="space-y-2">
              {currentZones.map((z, idx) => (
                <div
                  key={z.zone}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 bg-[#1F2025] p-2.5 rounded-2xl border border-[#383941]"
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: z.color || '#38bdf8' }}
                    />
                    <span className="text-xs font-black text-white w-8">Z{z.zone}</span>
                  </div>

                  <input
                    type="text"
                    value={z.name}
                    onChange={(e) => handleUpdateZone(idx, 'name', e.target.value)}
                    className="bg-[#131316] border border-[#383941] rounded-xl px-2.5 py-1 text-xs text-slate-200 flex-1 min-w-0 font-medium focus:outline-none focus:border-[#A8C7FA]"
                    placeholder="Zone name"
                  />

                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <div className="flex items-center gap-1 bg-[#131316] px-2 py-0.5 rounded-xl border border-[#383941]">
                      <span className="text-[10px] text-[#9E9EA7] uppercase font-bold">Min</span>
                      <input
                        type="number"
                        min="30"
                        max="240"
                        value={z.minBpm}
                        onChange={(e) => handleUpdateZone(idx, 'minBpm', parseInt(e.target.value) || 0)}
                        className="w-11 bg-transparent text-xs text-center text-white font-mono font-bold focus:outline-none"
                      />
                    </div>
                    <span className="text-[#9E9EA7] text-xs font-bold">-</span>
                    <div className="flex items-center gap-1 bg-[#131316] px-2 py-0.5 rounded-xl border border-[#383941]">
                      <span className="text-[10px] text-[#9E9EA7] uppercase font-bold">Max</span>
                      <input
                        type="number"
                        min="30"
                        max="240"
                        value={z.maxBpm}
                        onChange={(e) => handleUpdateZone(idx, 'maxBpm', parseInt(e.target.value) || 0)}
                        className="w-11 bg-transparent text-xs text-center text-white font-mono font-bold focus:outline-none"
                      />
                    </div>
                    <span className="text-[#9E9EA7] text-[10px] font-bold">bpm</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#9E9EA7] mt-2">
              Customize each heart rate zone boundary manually, or sync the exact thresholds configured in your Intervals.icu account.
            </p>
          </div>

          {/* Rider & Bike Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#26272D] border border-[#383941]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9E9EA7] mb-1">
                Rider Weight
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="30"
                  max="200"
                  value={formData.riderWeightKg}
                  onChange={(e) => setFormData({ ...formData, riderWeightKg: parseFloat(e.target.value) || 75 })}
                  className="w-full bg-[#131316] border border-[#383941] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-[#A8C7FA]"
                />
                <span className="text-[#9E9EA7] font-bold text-xs">kg</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#26272D] border border-[#383941]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9E9EA7] mb-1">
                Bike + Gear
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="3"
                  max="35"
                  value={formData.bikeWeightKg}
                  onChange={(e) => setFormData({ ...formData, bikeWeightKg: parseFloat(e.target.value) || 9 })}
                  className="w-full bg-[#131316] border border-[#383941] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-[#A8C7FA]"
                />
                <span className="text-[#9E9EA7] font-bold text-xs">kg</span>
              </div>
            </div>
          </div>

          {/* Max & Resting Heart Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#26272D] border border-[#383941]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9E9EA7] mb-1">
                Max Heart Rate
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="100"
                  max="230"
                  value={formData.maxHeartRate}
                  onChange={(e) => setFormData({ ...formData, maxHeartRate: parseInt(e.target.value) || 190 })}
                  className="w-full bg-[#131316] border border-[#383941] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-[#A8C7FA]"
                />
                <span className="text-[#9E9EA7] font-bold text-xs">BPM</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#26272D] border border-[#383941]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9E9EA7] mb-1">
                Resting Heart Rate
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={formData.restingHeartRate}
                  onChange={(e) => setFormData({ ...formData, restingHeartRate: parseInt(e.target.value) || 55 })}
                  className="w-full bg-[#131316] border border-[#383941] rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-[#A8C7FA]"
                />
                <span className="text-[#9E9EA7] font-bold text-xs">BPM</span>
              </div>
            </div>
          </div>

          {/* Speed Source Selection */}
          <div className="p-3.5 rounded-2xl bg-[#26272D] border border-[#383941]">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#9E9EA7] mb-2">
              Velocity / Speed Engine
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, speedSource: 'physics' })}
                className={`p-2.5 rounded-2xl border text-left transition-all ${
                  formData.speedSource === 'physics'
                    ? 'border-[#A8C7FA] bg-[#A8C7FA]/15 text-[#A8C7FA]'
                    : 'border-[#383941] bg-[#1F2025] text-[#9E9EA7] hover:border-[#44474F]'
                }`}
              >
                <div className="text-xs font-bold">Physics Model</div>
                <div className="text-[10px] opacity-75 mt-0.5">Calculated from Power & Aerodynamics</div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, speedSource: 'trainer' })}
                className={`p-2.5 rounded-2xl border text-left transition-all ${
                  formData.speedSource === 'trainer'
                    ? 'border-[#A8C7FA] bg-[#A8C7FA]/15 text-[#A8C7FA]'
                    : 'border-[#383941] bg-[#1F2025] text-[#9E9EA7] hover:border-[#44474F]'
                }`}
              >
                <div className="text-xs font-bold">Trainer Hardware</div>
                <div className="text-[10px] opacity-75 mt-0.5">Reported by Flywheel Sensor</div>
              </button>
            </div>
          </div>

          {/* CARTO Basemap Key */}
          <div className="p-3.5 rounded-2xl bg-[#26272D] border border-[#383941]">
            <div className="flex items-center gap-2 mb-1">
              <Compass className="w-4 h-4 text-[#A8C7FA]" />
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9E9EA7]">
                CARTO API Key
              </label>
            </div>
            <input
              type="text"
              placeholder="Inserisci la tua Carto API Key"
              value={formData.cartoApiKey || ''}
              onChange={(e) => setFormData({ ...formData, cartoApiKey: e.target.value.trim() })}
              className="w-full bg-[#131316] border border-[#383941] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#A8C7FA]"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Opzionale per le mappe CARTO Basemap. Puoi anche impostarla nel file <code className="text-[#A8C7FA]">.env</code> come <code className="text-[#A8C7FA]">VITE_CARTO_KEY</code>.
            </p>
          </div>

          {/* Sound toggle */}
          <div className="p-3.5 rounded-2xl bg-[#26272D] border border-[#383941] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-[#9E9EA7]" />
              <div>
                <span className="text-sm font-semibold text-white">Audio Countdown Cues</span>
                <p className="text-xs text-[#9E9EA7]">Beeps at 3, 2, 1s interval transitions</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={formData.soundAlerts}
              onChange={(e) => setFormData({ ...formData, soundAlerts: e.target.checked })}
              className="w-5 h-5 accent-[#A8C7FA] rounded cursor-pointer"
            />
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-full bg-[#A8C7FA] hover:bg-[#96B8EE] text-[#04315C] font-bold text-sm shadow-lg shadow-[#A8C7FA]/20 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
