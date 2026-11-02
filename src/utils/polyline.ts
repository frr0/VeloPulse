import { Activity } from '../types/intervals';

/**
 * Decodes a Google Encoded Polyline string into an array of [lat, lng] coordinates.
 */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  if (!encoded || typeof encoded !== 'string') return [];

  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: [number, number][] = [];
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coordinates.push([lat / factor, lng / factor]);
  }

  return coordinates;
}

/**
 * Keeps only the points that are usable as geographic coordinates.
 * A corrupted or partial stream can contain null entries or NaN values,
 * which would break the map bounds.
 */
function sanitizeCoordinates(points: [number, number][]): [number, number][] {
  return points.filter((point) => {
    if (!Array.isArray(point) || point.length < 2) return false;
    const [lat, lng] = point;
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  });
}

/**
 * Returns the real GPS track of an activity, as recorded on Intervals.icu.
 *
 * Lookup order: the `latlng` stream, then the encoded polylines. No route is
 * ever generated: an activity without a track returns an empty array, so the
 * caller can show an honest empty state instead of a map.
 *
 * `start_latlng` alone is not a track: it only tells that the activity was
 * recorded outdoors, and it is not enough to draw a line.
 */
export function getActivityRoute(activity: Activity | null | undefined): [number, number][] {
  if (!activity) return [];

  // 1. Explicit latlng stream array (most accurate).
  if (Array.isArray(activity.icu_latlng) && activity.icu_latlng.length > 1) {
    const stream = sanitizeCoordinates(activity.icu_latlng);
    if (stream.length > 1) return stream;
  }

  // 2. Encoded summary polyline.
  const encoded =
    activity.map?.summary_polyline ||
    activity.map?.polyline ||
    activity.summary_polyline ||
    activity.polyline;

  if (encoded) {
    const decoded = sanitizeCoordinates(decodePolyline(encoded));
    if (decoded.length > 1) return decoded;
  }

  return [];
}
