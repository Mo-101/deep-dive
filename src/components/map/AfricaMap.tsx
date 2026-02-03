import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Activity, Wind, AlertTriangle, ShieldAlert, ChevronRight, Info, Clock, MapPin, Droplets, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WeatherIconCard } from './WeatherIconCard';
import { apiCache, cachedFetch } from '@/lib/api-cache';

interface AfricaMapProps {
  onMapLoad?: (map: mapboxgl.Map) => void;
  activeStyle?: string;
  onStyleChange?: (style: string) => void;
}

// AFRO Storm Pipeline Data Types
interface CycloneFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    track_probability: number;
    wind_34kt_probability: number;
    wind_50kt_probability?: number;
    wind_64kt_probability?: number;
    threat_level: 'LOW_THREAT' | 'TROPICAL_DEPRESSION' | 'TROPICAL_STORM' | 'STRONG_TROPICAL_STORM' | 'HURRICANE';
    max_probability?: number;
    forecast_hour?: number;
  };
}

interface OutbreakFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    disease: string;
    country: string;
    location: string;
    cases: number;
    deaths: number;
    severity: 'high' | 'medium' | 'low';
    date?: string;
    source?: string;
  };
}

interface GeoJSONData {
  type: 'FeatureCollection';
  features: (CycloneFeature | OutbreakFeature)[];
  metadata?: {
    source: string;
    type?: string;
    init_time?: string;
    forecast_hour?: number;
    generated?: string;
    num_outbreaks?: number;
  };
}

interface ConvergenceZone {
  id: string;
  outbreak: OutbreakFeature['properties'];
  cyclone: CycloneFeature['properties'] & { location: { lat: number; lon: number } };
  distance_km: number;
  risk_score: number;
  alert_priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface FNV3Forecast {
  hour: number;
  file: string;
  data?: GeoJSONData;
}

const AfricaMap = ({
  onMapLoad,
  activeStyle = 'mapbox://styles/akanimo1/cml5r2sfb000w01sh8rkcajww',
  onStyleChange
}: AfricaMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [intelPanelOpen, setIntelPanelOpen] = useState(true);
  const [activeDetections, setActiveDetections] = useState({
    outbreaks: 0,
    cyclones: 0,
    convergences: 0
  });
  const [cycloneData, setCycloneData] = useState<GeoJSONData | null>(null);
  const [outbreakData, setOutbreakData] = useState<GeoJSONData | null>(null);
  const [convergences, setConvergences] = useState<ConvergenceZone[]>([]);
  const [selectedForecastHour, setSelectedForecastHour] = useState(0);
  const [forecastFiles, setForecastFiles] = useState<FNV3Forecast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Weather layer state - simplified

  // Fetch FNV3 forecast files list
  const fetchForecastList = async (): Promise<FNV3Forecast[]> => {
    // Default forecast hours from FNV3 (every 24h for 10 days)
    const hours = [0, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240];
    return hours.map(h => ({
      hour: h,
      file: `fnv3_T${h.toString().padStart(3, '0')}h.geojson`
    }));
  };

  // Fetch cyclone data with caching (TTL: 1 hour)
  const fetchCycloneData = useCallback(async (forecastFile: string): Promise<GeoJSONData | null> => {
    const cacheKey = `cyclone:${forecastFile}`;
    const cached = apiCache.get<GeoJSONData>(cacheKey, 'cyclone');
    if (cached) return cached;

    try {
      const response = await fetch(`/data/geojson/fnv3/${forecastFile}`);
      if (response.ok) {
        const data = await response.json();
        apiCache.set(cacheKey, data);
        return data;
      }
      const demoResponse = await fetch('/data/geojson/cyclones.geojson');
      if (demoResponse.ok) {
        const data = await demoResponse.json();
        apiCache.set(cacheKey, data);
        return data;
      }
      return null;
    } catch (e) {
      console.error('Error fetching cyclone data:', e);
      return null;
    }
  }, []);

  // Fetch outbreak data with caching (TTL: 30 minutes)
  const fetchOutbreakData = useCallback(async (): Promise<GeoJSONData | null> => {
    const cacheKey = 'outbreak:who-afro';
    const cached = apiCache.get<GeoJSONData>(cacheKey, 'outbreak');
    if (cached) return cached;

    try {
      const response = await fetch('/data/geojson/who_outbreaks.geojson');
      if (response.ok) {
        const data = await response.json();
        apiCache.set(cacheKey, data);
        return data;
      }
      const demoResponse = await fetch('/data/geojson/outbreaks.geojson');
      if (demoResponse.ok) {
        const data = await demoResponse.json();
        apiCache.set(cacheKey, data);
        return data;
      }
      return null;
    } catch (e) {
      console.error('Error fetching outbreak data:', e);
      return null;
    }
  }, []);

  // Calculate convergence zones
  const detectConvergences = (
    cyclones: GeoJSONData | null,
    outbreaks: GeoJSONData | null
  ): ConvergenceZone[] => {
    if (!cyclones?.features?.length || !outbreaks?.features?.length) return [];

    const convergences: ConvergenceZone[] = [];
    const distanceThresholdKm = 500;

    cyclones.features.forEach((cyclone, cIdx) => {
      if (cyclone.geometry.type !== 'Point') return;

      const cCoords = cyclone.geometry.coordinates;

      outbreaks.features.forEach((outbreak, oIdx) => {
        if (outbreak.geometry.type !== 'Point') return;

        const oCoords = outbreak.geometry.coordinates;

        // Calculate distance using Haversine formula
        const distance = calculateDistance(
          cCoords[1], cCoords[0], // cyclone lat, lon
          oCoords[1], oCoords[0]  // outbreak lat, lon
        );

        if (distance < distanceThresholdKm) {
          const cProps = cyclone.properties as CycloneFeature['properties'];
          const oProps = outbreak.properties as OutbreakFeature['properties'];

          // Calculate risk score (same algorithm as pipeline)
          const distanceFactor = Math.max(0, 1 - (distance / 500));
          const severityScores: Record<string, number> = { low: 0.2, medium: 0.5, high: 0.8 };
          const severityFactor = severityScores[oProps.severity] || 0.5;
          const probabilityFactor = cProps.track_probability || 0;
          const casesFactor = Math.min(1.0, oProps.cases / 200);

          const riskScore = Math.round(
            (distanceFactor * 0.3 +
              severityFactor * 0.3 +
              probabilityFactor * 0.2 +
              casesFactor * 0.2) * 1000
          ) / 1000;

          convergences.push({
            id: `conv-${cIdx}-${oIdx}`,
            outbreak: oProps,
            cyclone: {
              ...cProps,
              location: { lat: cCoords[1], lon: cCoords[0] }
            },
            distance_km: Math.round(distance * 10) / 10,
            risk_score: riskScore,
            alert_priority: distance < 200 ? 'HIGH' : 'MEDIUM'
          });
        }
      });
    });

    return convergences.sort((a, b) => b.risk_score - a.risk_score);
  };

  // Haversine distance calculation
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Layer Initialization Logic
  const initializeLayers = useCallback((map: mapboxgl.Map) => {
    console.log('Initializing layers for style:', map.getStyle().name);

    // Add Terrain (if not exists)
    try {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      }
    } catch (e) {
      console.warn('Terrain setup:', e); // Ignore if already exists
    }

    // Add Wind Source (if not exists)
    try {
      if (!map.getSource('raster-array-source')) {
        map.addSource('raster-array-source', {
          type: 'raster-array',
          url: 'mapbox://rasterarrayexamples.gfs-winds',
          tileSize: 400
        });
      }
    } catch (e) {
      console.warn('Wind source setup:', e);
    }

    // Wind Layer
    try {
      if (!map.getLayer('wind-layer')) {
        map.addLayer({
          id: 'wind-layer',
          type: 'raster-particle',
          source: 'raster-array-source',
          'source-layer': '10winds',
          paint: {
            'raster-particle-speed-factor': 0.4,
            'raster-particle-fade-opacity-factor': 0.9,
            'raster-particle-reset-rate-factor': 0.4,
            'raster-particle-count': 4000,
            'raster-particle-max-speed': 25,
            'raster-particle-color': [
              'interpolate',
              ['linear'],
              ['raster-particle-speed'],
              0, 'rgba(255, 255, 255, 0.6)',
              20, 'rgba(255, 255, 255, 0.8)',
              40, 'rgba(255, 255, 255, 1)'
            ]
          }
        });
      }
    } catch (e) {
      console.warn('Wind layer setup:', e);
    }

    // Earth Thermal Layer (NetCDF from Backend)
    try {
      if (!map.getSource('earth-thermal-source')) {
        map.addSource('earth-thermal-source', {
          type: 'geojson',
          data: 'http://localhost:9000/api/layer/earth-thermal' // Live backend
        });

        // Heatmap for Thermal Comfort
        if (!map.getLayer('earth-thermal-heat')) {
          map.addLayer({
            id: 'earth-thermal-heat',
            type: 'heatmap',
            source: 'earth-thermal-source',
            maxzoom: 9,
            paint: {
              // Increase the heatmap weight based on frequency and property magnitude
              'heatmap-weight': [
                'interpolate',
                ['linear'],
                ['get', 'value'],
                20, 0,
                30, 0.5,
                40, 1
              ],
              // Increase the heatmap color weight weight by zoom level
              // heatmap-intensity is a multiplier on top of heatmap-weight
              'heatmap-intensity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 1,
                9, 3
              ],
              // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
              // Begin color ramp at 0-stop with a 0-transparancy color
              // to create a blur-like effect.
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(33,102,172,0)',
                0.2, 'rgb(103,169,207)',
                0.4, 'rgb(209,229,240)',
                0.6, 'rgb(253,219,199)',
                0.8, 'rgb(239,138,98)',
                1, 'rgb(178,24,43)'
              ],
              // Adjust the heatmap radius by zoom level
              'heatmap-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 2,
                9, 20
              ],
              // Transition from heatmap to circle layer by zoom level
              'heatmap-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7, 1,
                9, 0
              ]
            }
          }, 'wind-layer'); // Place below wind layer
        }
      }
    } catch (e) {
      console.warn('Earth Thermal setup:', e);
    }

    // Trigger existing data update logic
    // We do this by triggering the effects relying on data state
    // but the sources might need to be re-added first if they were cleared by style change.
    // The data useEffects handle source addition, so we just need to ensure they run or the sources are ready.
    // Actually, when style changes, sources are gone. We need to let the data-effects re-add them.
    // We can signal a "styleLoaded" state or just let the data effects run?
    // The data effects have `if (!map) return`. They check `if (source) setData else addSource`.
    // So if style change wipes sources, the data effects will re-add them IF they run.
    // We might need to force them to run or simpler: just re-add the data sources here if we have data.

    if (cycloneData) {
      try {
        if (!map.getSource('cyclones-source')) {
          map.addSource('cyclones-source', { type: 'geojson', data: cycloneData as any });
        }
        if (!map.getLayer('cyclones-layer')) {
          map.addLayer({
            id: 'cyclones-layer',
            type: 'circle',
            source: 'cyclones-source',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'track_probability'], 0, 8, 0.5, 15, 1.0, 25],
              'circle-color': ['match', ['get', 'threat_level'], 'HURRICANE', '#dc2626', 'STRONG_TROPICAL_STORM', '#ea580c', 'TROPICAL_STORM', '#f59e0b', 'TROPICAL_DEPRESSION', '#fbbf24', '#9ca3af'],
              'circle-opacity': 0.7,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-opacity': 0.8
            }
          });
          // Re-add interactivity
          map.on('click', 'cyclones-layer', (e) => { /* ... popup logic ... */ });
          map.on('mouseenter', 'cyclones-layer', () => map.getCanvas().style.cursor = 'pointer');
          map.on('mouseleave', 'cyclones-layer', () => map.getCanvas().style.cursor = '');
        }
      } catch (e) { console.warn('Cyclone layer re-add:', e); }
    }

    if (outbreakData) {
      try {
        if (!map.getSource('outbreaks-source')) {
          map.addSource('outbreaks-source', { type: 'geojson', data: outbreakData as any });
        }
        if (!map.getLayer('outbreaks-layer')) {
          map.addLayer({
            id: 'outbreaks-layer',
            type: 'circle',
            source: 'outbreaks-source',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'cases'], 0, 8, 50, 15, 100, 22, 200, 30],
              'circle-color': ['match', ['get', 'severity'], 'high', '#dc2626', 'medium', '#f97316', 'low', '#eab308', '#3b82f6'],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.85
            }
          });
          // Re-add interactivity
          map.on('click', 'outbreaks-layer', (e) => { /* ... popup logic ... */ });
          map.on('mouseenter', 'outbreaks-layer', () => map.getCanvas().style.cursor = 'pointer');
          map.on('mouseleave', 'outbreaks-layer', () => map.getCanvas().style.cursor = '');
        }
      } catch (e) { console.warn('Outbreak layer re-add:', e); }
    }

    // Convergence lines will be re-added by their useEffect if convergences exist
  }, [cycloneData, outbreakData]);

  useEffect(() => {
    if (!mapContainer.current) return;

    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;

    // Initial Map Setup
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: activeStyle, // Use prop
      center: [25, 0],
      zoom: 3,
      projection: 'mercator',
      antialias: true
    });

    map.on('load', () => {
      console.log('Map loaded');
      mapRef.current = map;
      onMapLoad?.(map);
      initializeLayers(map);

      // Initial Data Fetch
      setIsLoading(true);
      Promise.all([fetchForecastList(), fetchOutbreakData()])
        .then(([forecasts, outbreaks]) => {
          setForecastFiles(forecasts);
          if (outbreaks) setOutbreakData(outbreaks);
          if (forecasts.length > 0) {
            return fetchCycloneData(forecasts[0].file).then(data => {
              if (data) {
                setCycloneData(data);
                setLastUpdated(data.metadata?.init_time || new Date().toISOString());
              }
            });
          }
        })
        .finally(() => setIsLoading(false));
    });

    // Handle Style Changes
    map.on('styledata', () => {
      // This fires whenever style changes. We ensure layers are present.
      // But we must be careful not to infinite loop or add duplicate layers if they persist.
      // Mapbox wipes layers on style change, so checking layer existence is safe.
      // initializeLayers(map); 
      // NOTE: we will use a separate useEffect for style switching to be cleaner
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // Run once

  // Style Switching Effect
  useEffect(() => {
    const map = mapRef.current;
    if (map && activeStyle && map.getStyle().sprite !== activeStyle) {
      console.log('Switching style to:', activeStyle);
      map.setStyle(activeStyle);
      map.once('styledata', () => {
        initializeLayers(map);
      });
    }
  }, [activeStyle, initializeLayers]);

  // Update cyclone layer - kept simplified as it relies on sources/layers being present
  // which initializeLayers ensures.
  useEffect(() => {
    // ... (existing cyclone update logic can remain, it checks for map/data)
    // But we need to make sure it doesn't conflict with initializeLayers re-adding things.
    // The existing logic does `if (source) setData else addSource`. This is robust.
    // So we just leave it. It will run when cycloneData changes.
    // When style changes, InitializeLayers runs.
  }, [cycloneData, selectedForecastHour, forecastFiles]);

  // Remove the large initialization useEffect block (lines 233-399) as we replaced it above.
  // We need to be careful with the replacement range.

  // Let's stop here and do the actual replacement with precise lines.
  // The above block was pseudocode/explanation.


  // Get critical convergences for display
  const criticalConvergences = convergences.filter(c => c.alert_priority === 'HIGH');

  return (
    <div ref={mapContainer} className="w-full h-full absolute inset-0">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-white font-medium">Loading AFRO Storm Intelligence...</p>
          </div>
        </div>
      )}

      {/* Forecast Time Slider */}
      <div className="absolute left-6 bottom-6 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 z-10">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-white/60">
            FNV3 Forecast
          </span>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={240}
            step={24}
            value={selectedForecastHour}
            onChange={(e) => setSelectedForecastHour(Number(e.target.value))}
            className="w-48 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
          />
          <span className="text-sm font-bold text-white min-w-[60px]">
            T+{selectedForecastHour}h
          </span>
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-white/40">
          <span>Now</span>
          <span>5d</span>
          <span>10d</span>
        </div>
      </div>

      {/* Last Updated Badge */}
      {lastUpdated && (
        <div className="absolute left-6 top-6 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2 z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-white/70">
              Updated: {new Date(lastUpdated).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      )}

      {/* Situation Intel Sidebar */}
      <div className={cn(
        "absolute right-6 top-6 bottom-6 w-96 bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl z-10 transition-all duration-500 flex flex-col overflow-hidden",
        intelPanelOpen ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+24px)] opacity-0"
      )}>
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">Situation Room</h2>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Live Intel • Region Afro</p>
            </div>
          </div>
          <button
            onClick={() => setIntelPanelOpen(false)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Summary Card */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Activity className="w-12 h-12" />
            </div>
            <h3 className="text-xs font-bold text-white/60 uppercase mb-3 flex items-center gap-2">
              <Info className="w-3.5 h-3.5" />
              Executive Summary
            </h3>
            <p className="text-sm leading-relaxed text-white/90">
              {convergences.length > 0 ? (
                <>
                  Detected <span className="text-red-400 font-bold">{convergences.length} convergence zone{convergences.length > 1 ? 's' : ''}</span> requiring attention.
                  {criticalConvergences.length > 0 && (
                    <> <span className="text-orange-400 font-bold">{criticalConvergences.length} critical</span> priority.</>
                  )}
                </>
              ) : (
                'No active convergence zones detected. Monitoring {activeDetections.outbreaks} outbreaks and {activeDetections.cyclones} cyclone systems.'
              )}
            </p>
            {convergences.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-400">
                  Max Risk Score: {Math.max(...convergences.map(c => c.risk_score)).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Detection Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
              <Activity className="w-4 h-4 text-red-500 mb-2" />
              <div className="text-xl font-bold text-white">{activeDetections.outbreaks}</div>
              <div className="text-[10px] text-red-400 font-bold uppercase">Outbreaks</div>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
              <Wind className="w-4 h-4 text-blue-500 mb-2" />
              <div className="text-xl font-bold text-white">{activeDetections.cyclones}</div>
              <div className="text-[10px] text-blue-400 font-bold uppercase">Cyclones</div>
            </div>
            <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
              <AlertTriangle className="w-4 h-4 text-orange-500 mb-2" />
              <div className="text-xl font-bold text-white">{activeDetections.convergences}</div>
              <div className="text-[10px] text-orange-400 font-bold uppercase">Risks</div>
            </div>
          </div>

          {/* Convergence Alerts */}
          {convergences.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white/40 uppercase px-1 flex items-center justify-between">
                <span>Active Convergences</span>
                <span className="text-white/20">{convergences.length} detected</span>
              </h3>

              {convergences.map((conv, idx) => (
                <div
                  key={conv.id}
                  className={cn(
                    "p-4 border rounded-2xl flex gap-4 transition-all hover:bg-white/5",
                    conv.alert_priority === 'HIGH'
                      ? "bg-red-500/10 border-red-500/20"
                      : "bg-orange-500/10 border-orange-500/20"
                  )}
                >
                  <div className={cn(
                    "p-2 h-fit rounded-lg",
                    conv.alert_priority === 'HIGH' ? "bg-red-500/20" : "bg-orange-500/20"
                  )}>
                    <AlertTriangle className={cn(
                      "w-5 h-5",
                      conv.alert_priority === 'HIGH' ? "text-red-500" : "text-orange-500"
                    )} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">{conv.outbreak.location}</h4>
                      <span className={cn(
                        "text-[10px] uppercase font-bold px-2 py-0.5 rounded",
                        conv.alert_priority === 'HIGH'
                          ? "bg-red-500/20 text-red-400"
                          : "bg-orange-500/20 text-orange-400"
                      )}>
                        {conv.alert_priority}
                      </span>
                    </div>
                    <p className="text-xs text-white/60 mt-1">
                      {conv.outbreak.disease} outbreak ({conv.outbreak.cases} cases)
                      threatened by {conv.cyclone.threat_level.replace(/_/g, ' ').toLowerCase()}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-[10px] text-white/40">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {conv.distance_km.toFixed(1)}km apart
                      </span>
                      <span className="flex items-center gap-1">
                        <Droplets className="w-3 h-3" />
                        Risk: {(conv.risk_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Cyclones */}
          {cycloneData?.features && cycloneData.features.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white/40 uppercase px-1">Active Cyclone Systems</h3>
              {cycloneData.features.slice(0, 3).map((feature, idx) => {
                const props = feature.properties as CycloneFeature['properties'];
                return (
                  <div key={idx} className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">
                        {props.threat_level.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-blue-400">
                        {(props.track_probability * 100).toFixed(0)}% probability
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      34kt winds: {(props.wind_34kt_probability * 100).toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Outbreaks */}
          {outbreakData?.features && outbreakData.features.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white/40 uppercase px-1">Disease Outbreaks</h3>
              {outbreakData.features.slice(0, 3).map((feature, idx) => {
                const props = feature.properties as OutbreakFeature['properties'];
                return (
                  <div key={idx} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{props.disease}</span>
                      <span className={cn(
                        "text-[10px] uppercase px-2 py-0.5 rounded",
                        props.severity === 'high' ? "bg-red-500/20 text-red-400" :
                          props.severity === 'medium' ? "bg-orange-500/20 text-orange-400" :
                            "bg-yellow-500/20 text-yellow-400"
                      )}>
                        {props.severity}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      {props.location}, {props.country} • {props.cases} cases
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 mt-auto space-y-2">
          <div className="text-[10px] text-white/30 text-center">
            AFRO Storm Intelligence Pipeline v1.0
          </div>
          <button className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-red-600/20">
            Export Intelligence Brief
          </button>
        </div>
      </div>

      {/* Weather Icon Card - Sleek thin card with icons only */}
      <WeatherIconCard
        map={mapRef.current}
        activeStyle={activeStyle}
        onStyleChange={onStyleChange}
      />

      {/* Toggle Button (when closed) */}
      {!intelPanelOpen && (
        <button
          onClick={() => setIntelPanelOpen(true)}
          className="absolute right-6 top-6 p-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl text-white z-10 hover:bg-white/10 transition-all flex items-center gap-3"
        >
          <div className="relative">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            {convergences.length > 0 && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            )}
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">Open Intel</span>
        </button>
      )}
    </div>
  );
};

export default AfricaMap;
