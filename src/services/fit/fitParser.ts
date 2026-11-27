import { Decoder, Stream } from '@garmin/fitsdk';
import { Activity } from '../../types/intervals';
import { toWallClockString } from '../../utils/activityTime';

const SEMICIRCLES_TO_DEGREES = 180 / Math.pow(2, 31);

function toDegrees(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  // FIT SDK sometimes returns semicircles (very large integers) or degrees
  if (Math.abs(value) > 180) {
    return value * SEMICIRCLES_TO_DEGREES;
  }
  return value;
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

/** Seconds between the Unix epoch and the FIT epoch (1989-12-31T00:00:00Z). */
const FIT_EPOCH_OFFSET_S = 631065600;

function fitTimeMs(value: unknown): number | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return (value + FIT_EPOCH_OFFSET_S) * 1000;
  return null;
}

/**
 * The device's UTC offset in minutes, from the activity message
 * (`localTimestamp` is the bike computer's local clock, `timestamp` is UTC).
 * Returns undefined when the file does not carry it.
 */
function deviceOffsetMinutes(activity: Record<string, any> | undefined): number | undefined {
  const utc = fitTimeMs(activity?.timestamp);
  const local = fitTimeMs(activity?.localTimestamp);
  if (utc === null || local === null) return undefined;
  const minutes = Math.round((local - utc) / 60_000 / 15) * 15;
  return Math.abs(minutes) <= 14 * 60 ? minutes : undefined;
}

function mapSportToType(sport: unknown, subSport: unknown): string {
  const s = String(sport || '').toLowerCase();
  const sub = String(subSport || '').toLowerCase();
  if (s.includes('cycling') || s.includes('biking')) {
    if (sub.includes('indoor') || sub.includes('virtual')) return 'VirtualRide';
    return 'Ride';
  }
  if (s.includes('running')) return 'Run';
  if (s.includes('swimming')) return 'Swim';
  if (s.includes('walking')) return 'Walk';
  return 'Ride';
}

/**
 * Parses a Garmin / cycling computer `.fit` file in the browser using
 * `@garmin/fitsdk` and converts it into VeloPulse's normalized `Activity`.
 */
export async function parseFitFileToActivity(file: File): Promise<Activity> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const stream = Stream.fromByteArray(bytes);

  if (!Decoder.isFIT(stream)) {
    throw new Error('Il file selezionato non è un file .FIT valido.');
  }

  const decoder = new Decoder(stream);
  const { messages, errors } = decoder.read({
    applyScaleAndOffset: true,
    expandSubFields: true,
    expandComponents: true,
    convertTypesToStrings: true,
    convertDateTimesToDates: true,
    mergeHeartRates: true,
  });

  if (errors && errors.length > 0 && !messages?.sessionMesgs?.length) {
    throw new Error(`Impossibile decodificare il file .FIT: ${errors[0]}`);
  }

  const session = (messages?.sessionMesgs?.[0] ?? {}) as Record<string, any>;
  const records = (messages?.recordMesgs ?? []) as Array<Record<string, any>>;

  const startUtcIso = toIsoDate(session.startTime ?? records[0]?.timestamp);
  // Stored as wall-clock local time like every other source (see utils/activityTime).
  // Falls back to this device's time zone when the file has no local timestamp.
  const activityMesg = (messages?.activityMesgs?.[0] ?? undefined) as Record<string, any> | undefined;
  const startIso = toWallClockString(new Date(startUtcIso), deviceOffsetMinutes(activityMesg));
  const externalId = `fit_${file.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date(startUtcIso).getTime()}`;

  // Downsample GPS track if very long (keep up to ~500 points for smooth map rendering)
  const latlng: [number, number][] = [];
  const step = Math.max(1, Math.floor(records.length / 500));
  for (let i = 0; i < records.length; i += step) {
    const lat = toDegrees(records[i].positionLat);
    const lng = toDegrees(records[i].positionLong);
    if (lat !== null && lng !== null && (lat !== 0 || lng !== 0)) {
      latlng.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
    }
  }

  const baseName = file.name.replace(/\.fit$/i, '').replace(/[_-]+/g, ' ').trim();
  const activityType = mapSportToType(session.sport, session.subSport);
  const isIndoor =
    activityType === 'VirtualRide' ||
    String(session.subSport || '').toLowerCase().includes('indoor') ||
    latlng.length === 0;

  return {
    id: externalId,
    name: baseName || `Garmin ${activityType}`,
    type: activityType,
    start_date_local: startIso,
    distance: typeof session.totalDistance === 'number' ? session.totalDistance : undefined,
    moving_time:
      typeof session.totalTimerTime === 'number'
        ? Math.round(session.totalTimerTime)
        : typeof session.totalElapsedTime === 'number'
        ? Math.round(session.totalElapsedTime)
        : undefined,
    elapsed_time:
      typeof session.totalElapsedTime === 'number'
        ? Math.round(session.totalElapsedTime)
        : undefined,
    total_elevation_gain:
      typeof session.totalAscent === 'number' ? Math.round(session.totalAscent) : undefined,
    average_speed:
      typeof session.enhancedAvgSpeed === 'number'
        ? session.enhancedAvgSpeed
        : typeof session.avgSpeed === 'number'
        ? session.avgSpeed
        : undefined,
    max_speed:
      typeof session.enhancedMaxSpeed === 'number'
        ? session.enhancedMaxSpeed
        : typeof session.maxSpeed === 'number'
        ? session.maxSpeed
        : undefined,
    average_heartrate:
      typeof session.avgHeartRate === 'number' ? Math.round(session.avgHeartRate) : undefined,
    max_heartrate:
      typeof session.maxHeartRate === 'number' ? Math.round(session.maxHeartRate) : undefined,
    average_watts:
      typeof session.avgPower === 'number' ? Math.round(session.avgPower) : undefined,
    weighted_average_watts:
      typeof session.normalizedPower === 'number'
        ? Math.round(session.normalizedPower)
        : undefined,
    icu_training_load:
      typeof session.trainingStressScore === 'number'
        ? Math.round(session.trainingStressScore)
        : undefined,
    icu_intensity:
      typeof session.intensityFactor === 'number'
        ? Math.round(session.intensityFactor * 100)
        : undefined,
    icu_joules:
      typeof session.totalWork === 'number' ? Math.round(session.totalWork) : undefined,
    icu_average_cadence:
      typeof session.avgCadence === 'number' ? Math.round(session.avgCadence) : undefined,
    start_latlng: latlng.length > 0 ? latlng[0] : undefined,
    end_latlng: latlng.length > 0 ? latlng[latlng.length - 1] : undefined,
    icu_latlng: latlng.length > 0 ? latlng : undefined,
    indoor: isIndoor,
    trainer: isIndoor,
    description: 'Imported from Garmin .FIT file',
  };
}
