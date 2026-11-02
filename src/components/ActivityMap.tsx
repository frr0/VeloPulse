import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Maximize2, Minimize2, Navigation, Compass, WifiOff } from 'lucide-react';
import { Activity } from '../types/intervals';
import { formatDistance, formatElevation } from '../utils/formatters';

type MapStyle = 'dark' | 'osm';

interface TileStyle {
  url: string;
  subdomains: string;
  maxZoom: number;
  attribution: string;
}

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Free tile providers. The attribution below is required by their terms of use.
const TILE_STYLES: Record<MapStyle, TileStyle> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 19,
    attribution: OSM_ATTRIBUTION,
  },
};

// Transparent 1x1 PNG: a tile that fails to load leaves the container colour
// visible instead of a black hole or a broken image glyph.
const TRANSPARENT_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

interface ActivityMapProps {
  activity: Activity;
  /**
   * Real GPS track of the activity, at least two points. The parent must keep
   * the array identity stable (useMemo): a new array rebuilds the map.
   */
  coordinates: [number, number][];
  useImperial?: boolean;
}

export const ActivityMap: React.FC<ActivityMapProps> = ({ activity, coordinates, useImperial = false }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasTileError, setHasTileError] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || coordinates.length < 2) return;

    setHasTileError(false);

    // If map already exists, remove it before reinitializing
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
    });
    mapInstanceRef.current = map;

    const style = TILE_STYLES[mapStyle];
    const tileLayer = L.tileLayer(style.url, {
      maxZoom: style.maxZoom,
      subdomains: style.subdomains,
      attribution: style.attribution,
      errorTileUrl: TRANSPARENT_TILE,
    }).addTo(map);

    // The desktop build runs in Electron, where the network can be missing.
    tileLayer.on('tileerror', () => {
      setHasTileError(true);
    });

    // Outer glow track (darker background contrast)
    L.polyline(coordinates, {
      color: '#000000',
      weight: 6,
      opacity: 0.6,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    // Main neon route line
    const mainPolyline = L.polyline(coordinates, {
      color: '#00E5A3',
      weight: 4,
      opacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);
    polylineLayerRef.current = mainPolyline;

    // Start Marker (Green Pill)
    const startPoint = coordinates[0];
    const startIcon = L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div style="
          background-color: #6DD58C;
          color: #0c2010;
          font-weight: 900;
          font-size: 10px;
          letter-spacing: 0.5px;
          padding: 3px 7px;
          border-radius: 9999px;
          border: 2px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          gap: 3px;
        ">
          <span style="display:inline-block; width:6px; height:6px; border-radius:9999px; background:#0c2010;"></span>
          START
        </div>
      `,
      iconSize: [60, 24],
      iconAnchor: [30, 12],
    });
    L.marker(startPoint, { icon: startIcon }).addTo(map);

    // Finish Marker (Coral Pill)
    const endPoint = coordinates[coordinates.length - 1];
    const finishIcon = L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div style="
          background-color: #F28B82;
          color: #2b0806;
          font-weight: 900;
          font-size: 10px;
          letter-spacing: 0.5px;
          padding: 3px 7px;
          border-radius: 9999px;
          border: 2px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          gap: 3px;
        ">
          🏁 FINISH
        </div>
      `,
      iconSize: [64, 24],
      iconAnchor: [32, 12],
    });
    L.marker(endPoint, { icon: finishIcon }).addTo(map);

    // Zoom and pan to fit entire route
    map.fitBounds(mainPolyline.getBounds(), {
      padding: [45, 45],
    });

    // Invalidate size after layout completes
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      tileLayer.off('tileerror');
      polylineLayerRef.current = null;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [coordinates, mapStyle]);

  const handleRecenter = () => {
    if (mapInstanceRef.current && polylineLayerRef.current) {
      mapInstanceRef.current.fitBounds(polylineLayerRef.current.getBounds(), {
        padding: [45, 45],
      });
    }
  };

  const handleToggleStyle = () => {
    setMapStyle((prev) => (prev === 'dark' ? 'osm' : 'dark'));
  };

  // Defensive guard: the parent shows the empty state when there is no track.
  if (coordinates.length < 2) return null;

  return (
    <div
      className={`relative bg-[#1F2025] border border-[#383941] rounded-3xl overflow-hidden shadow-xl transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 rounded-2xl flex flex-col' : 'w-full'
      }`}
    >
      {/* Top Map Header Bar / Badge */}
      <div className="absolute top-4 left-4 z-[400] flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1F2025]/90 backdrop-blur-md border border-[#383941] shadow-lg text-xs font-semibold text-white">
          <Navigation className="w-3.5 h-3.5 text-[#00E5A3]" />
          <span>Traccia Percorso GPS</span>
          <span className="text-slate-400 font-mono text-[11px] border-l border-white/10 pl-2">
            {formatDistance(activity.distance, useImperial)}
            {activity.total_elevation_gain ? ` • +${formatElevation(activity.total_elevation_gain, useImperial)}` : ''}
          </span>
        </div>
      </div>

      {/* Floating Controls */}
      <div className="absolute top-4 right-4 z-[400] flex items-center gap-2">
        {/* Toggle Tile Style (Dark vs Standard) */}
        <button
          onClick={handleToggleStyle}
          title={mapStyle === 'dark' ? 'Passa a mappa standard' : 'Passa a mappa dark'}
          className="p-2 rounded-xl bg-[#1F2025]/90 hover:bg-[#2F3037] backdrop-blur-md border border-[#383941] text-slate-300 hover:text-white shadow-lg transition-colors"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Recenter Button */}
        <button
          onClick={handleRecenter}
          title="Centra percorso"
          className="p-2 rounded-xl bg-[#1F2025]/90 hover:bg-[#2F3037] backdrop-blur-md border border-[#383941] text-slate-300 hover:text-white shadow-lg transition-colors"
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={() => {
            setIsFullscreen((prev) => !prev);
            setTimeout(() => {
              mapInstanceRef.current?.invalidateSize();
            }, 100);
          }}
          title={isFullscreen ? 'Riduci mappa' : 'Espandi a schermo intero'}
          className="p-2 rounded-xl bg-[#1F2025]/90 hover:bg-[#2F3037] backdrop-blur-md border border-[#383941] text-slate-300 hover:text-white shadow-lg transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Offline / missing tiles notice: the route stays visible */}
      {hasTileError && (
        <div className="absolute bottom-4 left-4 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1F2025]/90 backdrop-blur-md border border-[#383941] shadow-lg text-[11px] font-semibold text-slate-300">
          <WifiOff className="w-3.5 h-3.5 text-[#F28B82]" />
          <span>Sfondo mappa non disponibile: il percorso resta visibile</span>
        </div>
      )}

      {/* Map Leaflet Container */}
      <div
        ref={mapContainerRef}
        className={`w-full bg-[#26272D] transition-all [&_.leaflet-control-attribution]:bg-[#1F2025]/90 [&_.leaflet-control-attribution]:text-slate-400 [&_.leaflet-control-attribution]:backdrop-blur [&_.leaflet-control-attribution_a]:text-[#00E5A3] ${
          isFullscreen ? 'flex-1 h-full' : 'h-72 sm:h-96 md:h-[420px]'
        }`}
      />
    </div>
  );
};
