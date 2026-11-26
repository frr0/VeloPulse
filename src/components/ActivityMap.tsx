import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Compass, WifiOff, X, Maximize2 } from 'lucide-react';
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
    name: 'Map',
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

interface MapCardProps {
  activity: Activity;
  coordinates: [number, number][];
  useImperial?: boolean;
  hoveredCoordinate?: [number, number] | null;
  highlightedSegment?: [number, number][] | null;
  mapStyle: MapStyle;
  onChangeStyle: (style: MapStyle) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose?: () => void;
}

/**
 * Self-contained Leaflet map card. Rendering the inline map and the expanded
 * modal as separate instances ensures expanding never mutates or corrupts the
 * inline map's tile pane.
 */
const MapCard: React.FC<MapCardProps> = ({
  activity,
  coordinates,
  useImperial = false,
  hoveredCoordinate,
  highlightedSegment,
  mapStyle,
  onChangeStyle,
  isExpanded,
  onToggleExpand,
  onClose,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const hoverMarkerRef = useRef<L.Marker | null>(null);
  const highlightLayersRef = useRef<L.Layer[]>([]);
  const hadHighlightRef = useRef(false);
  const [hasTileError, setHasTileError] = useState(false);

  const handleRecenter = () => {
    if (!mapInstanceRef.current || !polylineLayerRef.current) return;
    mapInstanceRef.current.fitBounds(polylineLayerRef.current.getBounds(), {
      padding: [45, 45],
      animate: true,
    });
  };

  // Initialize Leaflet map and route overlay
  useEffect(() => {
    if (!mapContainerRef.current || coordinates.length < 2) return;

    setHasTileError(false);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
    });
    mapInstanceRef.current = map;

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

    L.polyline(coordinates, {
      color: '#000000',
      weight: 6,
      opacity: 0.7,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    const mainPolyline = L.polyline(coordinates, {
      color: '#00E5A3',
      weight: 4,
      opacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);
    polylineLayerRef.current = mainPolyline;

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
    L.marker(coordinates[0], { icon: startIcon }).addTo(map);

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
    L.marker(coordinates[coordinates.length - 1], { icon: finishIcon }).addTo(map);

    map.fitBounds(mainPolyline.getBounds(), {
      padding: [45, 45],
      animate: false,
    });

    const timer = setTimeout(() => {
      map.invalidateSize({ animate: false });
      map.fitBounds(mainPolyline.getBounds(), { padding: [45, 45], animate: false });
    }, 120);

    const handleResize = () => {
      map.invalidateSize({ animate: false });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Highlight selected segment between 2 chart points in contrasting color + endpoint markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous highlight layers
    highlightLayersRef.current.forEach((layer) => {
      try {
        map.removeLayer(layer);
      } catch {
        // ignore if already removed
      }
    });
    highlightLayersRef.current = [];

    if (!highlightedSegment || highlightedSegment.length < 2) {
      if (polylineLayerRef.current) {
        polylineLayerRef.current.setStyle({ opacity: 0.95 });
        if (hadHighlightRef.current) {
          map.fitBounds(polylineLayerRef.current.getBounds(), {
            padding: [45, 45],
            animate: true,
          });
        }
      }
      hadHighlightRef.current = false;
      return;
    }

    hadHighlightRef.current = true;
    if (polylineLayerRef.current) {
      polylineLayerRef.current.setStyle({ opacity: 0.3 });
    }

    const casing = L.polyline(highlightedSegment, {
      color: '#000000',
      weight: 8,
      opacity: 0.75,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    const segmentLine = L.polyline(highlightedSegment, {
      color: '#FC5200',
      weight: 5,
      opacity: 1,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    const makePinIcon = (label: string) =>
      L.divIcon({
        className: 'custom-map-selection-pin',
        html: `
          <div style="
            width: 20px;
            height: 20px;
            border-radius: 9999px;
            background-color: #FC5200;
            border: 2.5px solid #ffffff;
            box-shadow: 0 2px 10px rgba(0,0,0,0.75);
            color: #ffffff;
            font-size: 10px;
            font-weight: 900;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
          ">${label}</div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

    const startPin = L.marker(highlightedSegment[0], {
      icon: makePinIcon('A'),
      zIndexOffset: 1500,
    }).addTo(map);

    const endPin = L.marker(highlightedSegment[highlightedSegment.length - 1], {
      icon: makePinIcon('B'),
      zIndexOffset: 1500,
    }).addTo(map);

    highlightLayersRef.current = [casing, segmentLine, startPin, endPin];

    map.fitBounds(segmentLine.getBounds(), {
      padding: [48, 48],
      animate: true,
    });
  }, [highlightedSegment, coordinates]);

  return (
    <div
      className={`relative isolate bg-[#1F2025] border border-[#383941] overflow-hidden shadow-xl rounded-3xl ${
        isExpanded ? 'w-full max-w-6xl' : 'w-full'
      }`}
    >
      {/* Top Map Header Bar / Badge */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-[500] flex items-center gap-2 max-w-[45%] sm:max-w-none">
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#1F2025]/95 backdrop-blur-md border border-[#383941] shadow-xl text-xs font-semibold text-white truncate">
          <Navigation className="w-3.5 h-3.5 text-[#00E5A3] shrink-0" />
          <span className="hidden sm:inline">GPS Route</span>
          <span className="text-slate-300 font-mono text-[11px] sm:border-l sm:border-white/10 sm:pl-2 truncate">
            {formatDistance(activity.distance, useImperial)}
            {activity.total_elevation_gain ? ` • +${formatElevation(activity.total_elevation_gain, useImperial)}` : ''}
          </span>
        </div>
      </div>

      {/* Floating Controls: Layer Selector + Recenter + Expand/Close */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[500] flex items-center gap-1 sm:gap-1.5 justify-end">
        <div className="flex items-center bg-[#1F2025] border border-[#383941] rounded-xl p-1 shadow-xl text-xs">
          <button
            type="button"
            onClick={() => onChangeStyle('streets')}
            title="Street map"
            className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              mapStyle === 'streets'
                ? 'bg-[#00E5A3] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => onChangeStyle('satellite')}
            title="Satellite imagery"
            className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              mapStyle === 'satellite'
                ? 'bg-[#00E5A3] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => onChangeStyle('osm')}
            title="OpenStreetMap"
            className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              mapStyle === 'osm'
                ? 'bg-[#00E5A3] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            OSM
          </button>
        </div>

        <button
          type="button"
          onClick={handleRecenter}
          title="Recenter route"
          className="p-2 rounded-xl bg-[#1F2025] hover:bg-[#2F3037] border border-[#383941] text-slate-200 hover:text-white shadow-xl transition-colors cursor-pointer"
        >
          <Compass className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleExpand}
          title={isExpanded ? 'Close expanded map' : 'Expand map'}
          aria-label={isExpanded ? 'Close expanded map' : 'Expand map'}
          className="p-2 rounded-xl bg-[#1F2025] hover:bg-[#2F3037] border border-[#383941] text-[#00E5A3] hover:text-white shadow-xl transition-colors cursor-pointer"
        >
          {isExpanded ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {onClose && !isExpanded && (
          <button
            type="button"
            onClick={onClose}
            title="Hide map"
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
          <span>Map tiles unavailable: route remains visible</span>
        </div>
      )}

      {/* Map Leaflet Container */}
      <div
        ref={mapContainerRef}
        className={`w-full bg-[#1a1b20] [&_.leaflet-control-attribution]:bg-[#1F2025]/90 [&_.leaflet-control-attribution]:text-slate-400 [&_.leaflet-control-attribution]:backdrop-blur [&_.leaflet-control-attribution_a]:text-[#00E5A3] ${
          isExpanded ? 'h-[80vh] min-h-[420px]' : 'h-72 sm:h-80'
        }`}
      />
    </div>
  );
};

interface ActivityMapProps {
  activity: Activity;
  /** Real GPS track of the activity, at least two points. */
  coordinates: [number, number][];
  useImperial?: boolean;
  cartoApiKey?: string;
  /** Current point hovered on one of the telemetry charts [lat, lng]. */
  hoveredCoordinate?: [number, number] | null;
  /** Highlighted GPS sub-segment when zoomed on telemetry charts. */
  highlightedSegment?: [number, number][] | null;
  isPinned?: boolean;
  onClose?: () => void;
}

export const ActivityMap: React.FC<ActivityMapProps> = ({
  activity,
  coordinates,
  useImperial = false,
  hoveredCoordinate,
  highlightedSegment,
  onClose,
}) => {
  const [mapStyle, setMapStyle] = useState<MapStyle>('streets');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  if (coordinates.length < 2) return null;

  return (
    <>
      <div className="relative isolate z-0 w-full">
        <MapCard
          activity={activity}
          coordinates={coordinates}
          useImperial={useImperial}
          hoveredCoordinate={hoveredCoordinate}
          highlightedSegment={highlightedSegment}
          mapStyle={mapStyle}
          onChangeStyle={setMapStyle}
          isExpanded={false}
          onToggleExpand={() => setIsExpanded(true)}
          onClose={onClose}
        />
      </div>

      {isExpanded && (
        <div
          data-chart-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setIsExpanded(false)}
        >
          <div className="w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <MapCard
              activity={activity}
              coordinates={coordinates}
              useImperial={useImperial}
              hoveredCoordinate={hoveredCoordinate}
              highlightedSegment={highlightedSegment}
              mapStyle={mapStyle}
              onChangeStyle={setMapStyle}
              isExpanded={true}
              onToggleExpand={() => setIsExpanded(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};
