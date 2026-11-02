import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2, Navigation, Compass, WifiOff } from 'lucide-react';
import { Activity } from '../types/intervals';
import { formatDistance, formatElevation } from '../utils/formatters';

export type MapStyle = 'streets' | 'satellite' | 'osm' | 'dark';

interface TileStyle {
  name: string;
  url: string;
  subdomains?: string;
  maxZoom: number;
  attribution: string;
}

const TILE_STYLES: Record<MapStyle, TileStyle> = {
  streets: {
    name: 'Mappa',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  dark: {
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
  },
};

interface ActivityMapProps {
  activity: Activity;
  /**
   * Real GPS track of the activity, at least two points.
   */
  coordinates: [number, number][];
  useImperial?: boolean;
  cartoApiKey?: string;
  /** Current point hovered on one of the telemetry charts [lat, lng]. */
  hoveredCoordinate?: [number, number] | null;
}

export const ActivityMap: React.FC<ActivityMapProps> = ({
  activity,
  coordinates,
  useImperial = false,
  hoveredCoordinate,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const hoverMarkerRef = useRef<L.Marker | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>('streets');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasTileError, setHasTileError] = useState(false);

  // Initialize Leaflet map and route overlay
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

    // Initial base tile layer (streets by default)
    const style = TILE_STYLES[mapStyle] || TILE_STYLES.streets;
    const tileLayer = L.tileLayer(style.url, {
      maxZoom: style.maxZoom,
      subdomains: style.subdomains || 'abc',
      attribution: style.attribution,
    });
    tileLayer.on('tileerror', () => {
      setHasTileError(true);
    });
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    // High-contrast casing / border for the route line
    L.polyline(coordinates, {
      color: '#000000',
      weight: 6,
      opacity: 0.7,
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
          background-color: #00E5A3;
          color: #04241a;
          font-weight: 900;
          font-size: 10px;
          letter-spacing: 0.5px;
          padding: 3px 8px;
          border-radius: 9999px;
          border: 2px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <span style="display:inline-block; width:6px; height:6px; border-radius:9999px; background:#04241a;"></span>
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
          background-color: #FC5200;
          color: #ffffff;
          font-weight: 900;
          font-size: 10px;
          letter-spacing: 0.5px;
          padding: 3px 8px;
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
    }, 200);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      polylineLayerRef.current = null;
      tileLayerRef.current = null;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [coordinates]);

  // Dynamically swap tile layers without destroying the map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const style = TILE_STYLES[mapStyle] || TILE_STYLES.streets;
    const newTileLayer = L.tileLayer(style.url, {
      maxZoom: style.maxZoom,
      subdomains: style.subdomains || 'abc',
      attribution: style.attribution,
    });

    newTileLayer.on('tileerror', () => {
      setHasTileError(true);
    });

    newTileLayer.addTo(map);
    newTileLayer.bringToBack();
    tileLayerRef.current = newTileLayer;
    setHasTileError(false);
  }, [mapStyle]);

  // Synchronize hover dot on map when scrubbing across charts
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!hoveredCoordinate || !isFinite(hoveredCoordinate[0]) || !isFinite(hoveredCoordinate[1])) {
      if (hoverMarkerRef.current) {
        map.removeLayer(hoverMarkerRef.current);
        hoverMarkerRef.current = null;
      }
      return;
    }

    const hoverIcon = L.divIcon({
      className: 'custom-map-hover-marker',
      html: `
        <div style="position: relative; width: 22px; height: 22px; display: flex; items: center; justify-content: center;">
          <span style="position: absolute; inset: -3px; border-radius: 9999px; background-color: #00E5A3; opacity: 0.8; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <span style="position: relative; width: 14px; height: 14px; margin: auto; border-radius: 9999px; background-color: #00E5A3; border: 2.5px solid #ffffff; box-shadow: 0 0 12px rgba(0, 229, 163, 1);"></span>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    if (hoverMarkerRef.current) {
      hoverMarkerRef.current.setLatLng(hoveredCoordinate);
      hoverMarkerRef.current.setIcon(hoverIcon);
    } else {
      const marker = L.marker(hoveredCoordinate, {
        icon: hoverIcon,
        zIndexOffset: 2000,
      }).addTo(map);
      hoverMarkerRef.current = marker;
    }
  }, [hoveredCoordinate]);

  const handleRecenter = () => {
    if (mapInstanceRef.current && polylineLayerRef.current) {
      mapInstanceRef.current.fitBounds(polylineLayerRef.current.getBounds(), {
        padding: [45, 45],
      });
    }
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

      {/* Floating Controls: Layer Selector + Recenter + Fullscreen */}
      <div className="absolute top-4 right-4 z-[400] flex items-center gap-2 flex-wrap justify-end">
        {/* Map Layer Mode Selector */}
        <div className="flex items-center bg-[#1F2025]/90 backdrop-blur-md border border-[#383941] rounded-xl p-1 shadow-lg text-xs">
          <button
            onClick={() => setMapStyle('streets')}
            title="Mappa stradale reale con toponimi e rilievi"
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              mapStyle === 'streets'
                ? 'bg-[#00E5A3] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Mappa
          </button>
          <button
            onClick={() => setMapStyle('satellite')}
            title="Vista aerea satellitare ad alta definizione"
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              mapStyle === 'satellite'
                ? 'bg-[#00E5A3] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapStyle('osm')}
            title="OpenStreetMap Standard"
            className={`hidden sm:inline-block px-2.5 py-1 rounded-lg font-bold transition-all ${
              mapStyle === 'osm'
                ? 'bg-[#00E5A3] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            OSM
          </button>
          <button
            onClick={() => setMapStyle('dark')}
            title="Tema scuro ad alto contrasto"
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              mapStyle === 'dark'
                ? 'bg-[#00E5A3] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Dark
          </button>
        </div>

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

      {/* Offline / missing tiles notice */}
      {hasTileError && (
        <div className="absolute bottom-4 left-4 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1F2025]/90 backdrop-blur-md border border-[#383941] shadow-lg text-[11px] font-semibold text-slate-300">
          <WifiOff className="w-3.5 h-3.5 text-[#F28B82]" />
          <span>Sfondo mappa non disponibile: il percorso resta visibile</span>
        </div>
      )}

      {/* Map Leaflet Container */}
      <div
        ref={mapContainerRef}
        className={`w-full bg-[#1a1b20] transition-all [&_.leaflet-control-attribution]:bg-[#1F2025]/90 [&_.leaflet-control-attribution]:text-slate-400 [&_.leaflet-control-attribution]:backdrop-blur [&_.leaflet-control-attribution_a]:text-[#00E5A3] ${
          isFullscreen ? 'flex-1 h-full' : 'h-80 sm:h-[400px] md:h-[460px]'
        }`}
      />
    </div>
  );
};
