import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Compass, WifiOff, X } from 'lucide-react';
import { Activity } from '../types/intervals';
import { formatDistance, formatElevation } from '../utils/formatters';

export type MapStyle = 'streets' | 'satellite' | 'osm';

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
  /** Whether the map is in fixed/sticky position while scrolling charts */
  isPinned?: boolean;
  /** Close / dismiss the map to scroll charts alone */
  onClose?: () => void;
}

export const ActivityMap: React.FC<ActivityMapProps> = ({
  activity,
  coordinates,
  useImperial = false,
  hoveredCoordinate,
  isPinned = false,
  onClose,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const hoverMarkerRef = useRef<L.Marker | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>('streets');
  const [hasTileError, setHasTileError] = useState(false);

  const handleRecenter = () => {
    if (!mapInstanceRef.current || !polylineLayerRef.current) return;
    mapInstanceRef.current.fitBounds(polylineLayerRef.current.getBounds(), {
      padding: [45, 45],
      animate: true,
    });
  };

  // Invalidate Leaflet canvas size when pinned/sticky mode toggles
  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [isPinned]);

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

    // Start Marker: simple clean green dot
    const startPoint = coordinates[0];
    const startIcon = L.divIcon({
      className: 'custom-map-marker-start',
      html: `
        <div style="
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background-color: #00E5A3;
          border: 2.5px solid #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
        "></div>
      `,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker(startPoint, { icon: startIcon }).addTo(map);

    // Finish Marker: simple clean red dot
    const endPoint = coordinates[coordinates.length - 1];
    const finishIcon = L.divIcon({
      className: 'custom-map-marker-finish',
      html: `
        <div style="
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background-color: #EF4444;
          border: 2.5px solid #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
        "></div>
      `,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
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

  // Defensive guard: the parent shows the empty state when there is no track.
  if (coordinates.length < 2) return null;

  return (
    <div
      ref={wrapperRef}
      className="relative bg-[#1F2025] border border-[#383941] overflow-hidden shadow-xl transition-all w-full rounded-3xl"
    >
      {/* Top Map Header Bar / Badge */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-[500] flex items-center gap-2 max-w-[45%] sm:max-w-none">
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#1F2025]/95 backdrop-blur-md border border-[#383941] shadow-xl text-xs font-semibold text-white truncate">
          <Navigation className="w-3.5 h-3.5 text-[#00E5A3] shrink-0" />
          <span className="hidden sm:inline">Traccia Percorso GPS</span>
          <span className="text-slate-300 font-mono text-[11px] sm:border-l sm:border-white/10 sm:pl-2 truncate">
            {formatDistance(activity.distance, useImperial)}
            {activity.total_elevation_gain ? ` • +${formatElevation(activity.total_elevation_gain, useImperial)}` : ''}
          </span>
        </div>
      </div>

      {/* Floating Controls: Layer Selector + Recenter + Close */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[500] flex items-center gap-1 sm:gap-1.5 justify-end">
        {/* Map Layer Mode Selector (Mappa, Satellite, OSM) */}
        <div className="flex items-center bg-[#1F2025] border border-[#383941] rounded-xl p-1 shadow-xl text-xs">
          <button
            type="button"
            onClick={() => setMapStyle('streets')}
            title="Mappa stradale reale con toponimi e rilievi"
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              mapStyle === 'streets'
                ? 'bg-[#00E5A3] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            Mappa
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('satellite')}
            title="Vista aerea satellitare ad alta definizione"
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              mapStyle === 'satellite'
                ? 'bg-[#00E5A3] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('osm')}
            title="OpenStreetMap Standard"
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              mapStyle === 'osm'
                ? 'bg-[#00E5A3] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            OSM
          </button>
        </div>

        {/* Recenter Button */}
        <button
          type="button"
          onClick={handleRecenter}
          title="Centra percorso"
          className="p-2 rounded-xl bg-[#1F2025] hover:bg-[#2F3037] border border-[#383941] text-slate-200 hover:text-white shadow-xl transition-colors cursor-pointer"
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Close Button to dismiss/hide map and scroll graphs alone */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Chiudi mappa (scorri solo i grafici)"
            className="p-2 rounded-xl bg-[#1F2025] hover:bg-rose-500/25 hover:text-rose-400 border border-[#383941] text-slate-200 shadow-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
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
          isPinned
            ? 'h-56 sm:h-64 md:h-72 max-h-[36vh]'
            : 'h-80 sm:h-[400px] md:h-[460px]'
        }`}
      />
    </div>
  );
};
