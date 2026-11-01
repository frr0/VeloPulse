import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Maximize2, Minimize2, Navigation, Compass, AlertCircle } from 'lucide-react';
import { Activity } from '../types/intervals';
import { decodePolyline, getScenicDemoRoute } from '../utils/polyline';
import { formatDistance, formatElevation } from '../utils/formatters';

interface ActivityMapProps {
  activity: Activity;
  useImperial?: boolean;
}

export const ActivityMap: React.FC<ActivityMapProps> = ({ activity, useImperial = false }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [mapStyle, setMapStyle] = useState<'dark' | 'osm'>('dark');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasValidRoute, setHasValidRoute] = useState<boolean>(true);

  // Extract coordinates from activity
  const getCoordinates = (): [number, number][] => {
    // 1. Explicit latlng stream array
    if (Array.isArray(activity.icu_latlng) && activity.icu_latlng.length > 1) {
      return activity.icu_latlng;
    }

    // 2. Encoded summary polyline
    const polyStr =
      activity.map?.summary_polyline ||
      activity.map?.polyline ||
      activity.summary_polyline ||
      activity.polyline;

    if (polyStr) {
      const decoded = decodePolyline(polyStr);
      if (decoded.length > 1) return decoded;
    }

    // 3. Fallback scenic route for demo / mock outdoor rides
    const demo = getScenicDemoRoute(activity.id, activity.type);
    if (demo && demo.length > 1) {
      return demo;
    }

    return [];
  };

  const coordinates = getCoordinates();
  const isIndoor =
    activity.indoor ||
    activity.trainer ||
    (activity.type && (activity.type.toLowerCase().includes('virtual') || activity.type.toLowerCase().includes('indoor')));

  useEffect(() => {
    if (!mapContainerRef.current || coordinates.length === 0) {
      setHasValidRoute(false);
      return;
    }
    setHasValidRoute(true);

    // If map already exists, remove it before reinitializing
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    // Tile URL based on style
    const darkTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    const osmTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tileLayer = L.tileLayer(mapStyle === 'dark' ? darkTileUrl : osmTileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
    tileLayerRef.current = tileLayer;

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
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activity.id, mapStyle]);

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

  if (!hasValidRoute || coordinates.length === 0) {
    return (
      <div className="bg-[#1F2025] border border-[#383941] rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#26272D] border border-white/5 flex items-center justify-center text-slate-400 mb-3">
          <AlertCircle className="w-7 h-7 text-amber-400" />
        </div>
        <h4 className="text-base font-bold text-white mb-1">
          {isIndoor ? 'Sessione Indoor / Rulli' : 'Nessuna traccia GPS registrata'}
        </h4>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md">
          {isIndoor
            ? 'Questa attività è stata registrata al chiuso su smart trainer o rullo. I dati di potenza, cadenza e frequenza cardiaca sono disponibili nei grafici e nelle sezioni sottostanti.'
            : 'Il file dell’attività non include coordinate geografiche GPS (o si tratta di un allenamento indoor).'}
        </p>
      </div>
    );
  }

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

      {/* Map Leaflet Container */}
      <div
        ref={mapContainerRef}
        className={`w-full transition-all ${isFullscreen ? 'flex-1 h-full' : 'h-72 sm:h-96 md:h-[420px]'}`}
      />

      {/* Subtle attribution note */}
      <div className="absolute bottom-2 right-3 z-[400] pointer-events-none">
        <span className="text-[10px] text-slate-400/80 bg-black/50 px-2 py-0.5 rounded backdrop-blur">
          © OpenStreetMap contributors • CARTO
        </span>
      </div>
    </div>
  );
};
