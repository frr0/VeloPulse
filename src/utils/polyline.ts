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
 * Generates smooth scenic route coordinates for demo / mock activities
 * or activities without GPS data.
 */
export function getScenicDemoRoute(activityId: string, activityType: string): [number, number][] | null {
  const typeLower = (activityType || '').toLowerCase();
  if (typeLower.includes('virtual') || typeLower.includes('indoor') || typeLower.includes('turbo')) {
    return null;
  }

  // Generate scenic GPS track based on seed (e.g. Italian cycling routes)
  // Route 1: Stelvio / Passo dello Stelvio Loop (Bormio, Lombardy)
  // Route 2: Strade Bianche / Tuscany gravel loop (Siena, Chianti)
  // Route 3: Dolomiti Sellaronda (Corvara, Val Gardena)
  const seed = (activityId || 'default').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const routeType = seed % 3;

  let centerLat = 46.528;
  let centerLng = 10.453;
  let radiusLat = 0.045;
  let radiusLng = 0.075;

  if (routeType === 1) {
    // Siena / Chianti
    centerLat = 43.318;
    centerLng = 11.330;
    radiusLat = 0.055;
    radiusLng = 0.085;
  } else if (routeType === 2) {
    // Dolomites / Sellaronda
    centerLat = 46.554;
    centerLng = 11.856;
    radiusLat = 0.060;
    radiusLng = 0.090;
  }

  const pointsCount = 65;
  const coords: [number, number][] = [];

  for (let i = 0; i <= pointsCount; i++) {
    const angle = (i / pointsCount) * Math.PI * 2;
    // Add realistic road curves and loops
    const wobble1 = Math.sin(angle * 3) * 0.28;
    const wobble2 = Math.cos(angle * 5) * 0.12;
    const wobble3 = Math.sin(angle * 7) * 0.06;

    const rLat = radiusLat * (1 + wobble1 + wobble2);
    const rLng = radiusLng * (1 - wobble1 + wobble3);

    const lat = centerLat + Math.cos(angle) * rLat;
    const lng = centerLng + Math.sin(angle) * rLng;
    coords.push([lat, lng]);
  }

  return coords;
}
