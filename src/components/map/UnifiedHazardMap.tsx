/**
 * Unified Hazard Map
 * ONE map showing all hazards with animations, popups, and weather monitoring
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useRealtimeHazards } from '@/hooks/useRealtimeHazards';
import { MinimalLayerIcons } from './MinimalLayerIcons';
import { HorizontalScaleLegend } from './HorizontalScaleLegend';
import { WeatherTicker } from './WeatherTicker';
import { AnimatedHazardLayers } from './AnimatedHazardLayers';
import { DetectionPopup } from './DetectionPopup';
import { NewsTicker } from './NewsTicker';
import { OpenWeatherLayer } from './OpenWeatherLayer';
import { WindParticleLayer } from './WindParticleLayer';
import { CycloneWindField } from './weather-animations/CycloneWindField';
import { FloodAnimationLayer } from './weather-animations/FloodAnimationLayer';
import { HazardBubbleMarkers } from './HazardBubbleMarkers';

// Historical events (Idai, Freddy)
const HISTORICAL_EVENTS = {
  idai: {
    name: 'Cyclone Idai (2019)',
    track: [
      [-66.2, -13.5], [-64.8, -14.2], [-62.5, -15.8],
      [-59.2, -17.5], [-36.5, -19.2], [-34.9, -19.8]
    ],
    color: '#6b7280',
    opacity: 0.3,
  },
  freddy: {
    name: 'Cyclone Freddy (2023)',
    track: [
      [65.0, -15.0], [55.0, -16.5], [45.0, -18.0],
      [38.0, -19.5], [35.0, -21.0]
    ],
    color: '#6b7280',
    opacity: 0.3,
  },
};

// Generate demo wind data around cyclones
function generateWindData(cyclones: any[]) {
  return cyclones.flatMap(cyclone => {
    const windData = [];
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * 2 * Math.PI;
      const distance = 0.5 + Math.random() * 2; // degrees
      const lat = cyclone.center.lat + distance * Math.cos(angle);
      const lon = cyclone.center.lon + distance * Math.sin(angle) / Math.cos(cyclone.center.lat * Math.PI / 180);

      // Tangential wind
      const windSpeed = cyclone.maxWind * (1 - distance / 3);
      const u = -windSpeed * Math.sin(angle) * 0.5;
      const v = windSpeed * Math.cos(angle) * 0.5;

      windData.push({ lat, lon, u, v });
    }
    return windData;
  });
}

export function UnifiedHazardMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const layersRef = useRef<Set<string>>(new Set());
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [detections, setDetections] = useState<any[]>([]);

  const {
    hazards,
    activeLayers,
    toggleLayer,
    isLoading,
    lastUpdated,
    refresh
  } = useRealtimeHazards();

  // Demo hazard bubbles for WeatherLab-style visualization
  const hazardBubbles = useMemo(() => {
    const bubbles = [
      // User's example: Landslide risk
      {
        id: 'landslide-beira',
        type: 'landslide' as const,
        location: { lat: -19.5, lon: 34.2 },
        data: {
          rainfall: 180,
          slope: 35,
          probability: 0.78,
          label: 'High Landslide Risk',
        },
      },
      // Cyclone example
      {
        id: 'cyclone-demo-1',
        type: 'cyclone' as const,
        location: { lat: -18.0, lon: 45.0 },
        data: {
          windSpeed: 45,
          windDirection: 315,
          probability: 0.92,
          category: 'CAT2',
        },
      },
      // Flood example
      {
        id: 'flood-demo-1',
        type: 'flood' as const,
        location: { lat: -15.5, lon: 35.5 },
        data: {
          rainfall: 120,
          probability: 0.65,
        },
      },
      // Rainfall example
      {
        id: 'rainfall-demo-1',
        type: 'rainfall' as const,
        location: { lat: -22.0, lon: 30.0 },
        data: {
          rainfall: 85,
          windSpeed: 12,
          windDirection: 180,
          probability: 0.45,
        },
      },
    ];

    // Add hazards from real data if available
    if (hazards?.cyclones) {
      hazards.cyclones.forEach(c => {
        bubbles.push({
          id: c.id,
          type: 'cyclone' as const,
          location: { lat: c.center.lat, lon: c.center.lon },
          data: {
            windSpeed: c.maxWind * 0.514, // Convert knots to m/s
            windDirection: 0, // Default direction
            probability: 0.85,
            category: c.category,
          },
        });
      });
    }

    if (hazards?.landslides) {
      hazards.landslides.forEach(l => {
        bubbles.push({
          id: l.id,
          type: 'landslide' as const,
          location: { lat: l.location.lat, lon: l.location.lon },
          data: {
            rainfall: l.rainfall_mm,
            slope: l.slope_angle,
            probability: l.risk_level === 'high' ? 0.8 : l.risk_level === 'medium' ? 0.5 : 0.3,
            label: `${l.risk_level} risk`,
          },
        });
      });
    }

    return bubbles;
  }, [hazards]);

  // Generate ticker items from hazards
  const tickerItems = hazards ? [
    ...(hazards.cyclones || []).map(c => ({
      id: c.id,
      type: 'cyclone' as const,
      message: `${c.name}: ${c.category}, ${c.maxWind}kt winds`,
      timestamp: new Date(c.updated),
      severity: c.category.startsWith('CAT') ? 'high' : 'medium',
    })),
    ...(hazards.floods || []).map(f => ({
      id: f.id,
      type: 'flood' as const,
      message: `Flooded area detected: ${f.area_km2.toFixed(1)} km²`,
      timestamp: new Date(f.detected_date),
      severity: f.area_km2 > 100 ? 'high' : 'medium',
    })),
    ...(hazards.landslides || []).map(l => ({
      id: l.id,
      type: 'landslide' as const,
      message: `${l.risk_level.toUpperCase()} landslide risk: ${l.rainfall_mm}mm rainfall`,
      timestamp: new Date(),
      severity: l.risk_level as any,
    })),
  ] : [];

  // Trigger detection popups when new hazards appear
  useEffect(() => {
    if (!hazards) return;

    const newDetections = [
      ...(hazards.cyclones || []).map(c => ({
        id: c.id,
        type: 'cyclone',
        title: `New Cyclone Detected`,
        message: `${c.name}: ${c.category} with ${c.maxWind}kt winds`,
        severity: c.category.startsWith('CAT') ? 'critical' : 'high',
        location: `${c.center.lat.toFixed(1)}°S, ${c.center.lon.toFixed(1)}°E`,
        timestamp: new Date(),
      })),
      ...(hazards.floods || []).map(f => ({
        id: f.id,
        type: 'flood',
        title: `Flooded Area Detected`,
        message: `${f.area_km2.toFixed(1)} km² from ${f.source}`,
        severity: f.area_km2 > 100 ? 'high' : 'medium',
        timestamp: new Date(f.detected_date),
      })),
      ...(hazards.landslides || []).filter(l => l.risk_level === 'high').map(l => ({
        id: l.id,
        type: 'landslide',
        title: `High Landslide Risk`,
        message: `${l.rainfall_mm}mm rainfall on ${l.slope_angle}° slope`,
        severity: 'high',
        location: `${l.location.lat.toFixed(1)}°S, ${l.location.lon.toFixed(1)}°E`,
        timestamp: new Date(),
      })),
    ];

    setDetections(newDetections);
  }, [hazards]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.error('[UnifiedHazardMap] Mapbox token not found!');
      return;
    }
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/akanimo1/cml72h8dv002z01qx4a518c8q',
      center: [35, -19],
      zoom: 4,
      minZoom: 3,
      maxZoom: 12,
      projection: 'mercator',
    });

    mapRef.current = map;
    setMapInstance(map);

    map.on('load', () => {
      console.log('[UnifiedHazardMap] Map loaded');
      initializeLayers(map);
    });

    return () => {
      map.remove();
      setMapInstance(null);
    };
  }, []);

  // Initialize layer sources (same as before)
  const initializeLayers = useCallback((map: mapboxgl.Map) => {
    map.addSource('cyclones', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('floods', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('landslides', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('waterlogged', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('historical', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    // Cyclone tracks
    map.addLayer({
      id: 'cyclone-tracks',
      type: 'line',
      source: 'cyclones',
      layout: { visibility: activeLayers.cyclones ? 'visible' : 'none' },
      paint: { 'line-color': '#ef4444', 'line-width': 3, 'line-opacity': 0.8 },
    });

    map.addLayer({
      id: 'cyclone-centers',
      type: 'circle',
      source: 'cyclones',
      layout: { visibility: activeLayers.cyclones ? 'visible' : 'none' },
      paint: {
        'circle-radius': 10,
        'circle-color': '#ef4444',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.9,
      },
    });

    // Floods
    map.addLayer({
      id: 'flood-areas',
      type: 'fill',
      source: 'floods',
      layout: { visibility: activeLayers.floods ? 'visible' : 'none' },
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.4,
        'fill-outline-color': '#3b82f6',
      },
    });

    // Landslides
    map.addLayer({
      id: 'landslide-points',
      type: 'circle',
      source: 'landslides',
      layout: { visibility: activeLayers.landslides ? 'visible' : 'none' },
      paint: {
        'circle-radius': ['match', ['get', 'risk_level'], 'high', 12, 'medium', 8, 'low', 6, 6],
        'circle-color': ['match', ['get', 'risk_level'], 'high', '#ef4444', 'medium', '#f97316', 'low', '#eab308', '#6b7280'],
        'circle-opacity': 0.7,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1,
      },
    });

    // Waterlogged
    map.addLayer({
      id: 'waterlogged-areas',
      type: 'fill',
      source: 'waterlogged',
      layout: { visibility: activeLayers.waterlogged ? 'visible' : 'none' },
      paint: {
        'fill-color': '#06b6d4',
        'fill-opacity': 0.3,
      },
    });

    // Historical
    map.addLayer({
      id: 'historical-tracks',
      type: 'line',
      source: 'historical',
      layout: { visibility: activeLayers.historical ? 'visible' : 'none' },
      paint: {
        'line-color': '#6b7280',
        'line-width': 2,
        'line-opacity': 0.3,
        'line-dasharray': [2, 2],
      },
    });

    layersRef.current = new Set(['cyclone-tracks', 'cyclone-centers', 'flood-areas', 'landslide-points', 'waterlogged-areas', 'historical-tracks']);

    // Add popups
    addPopups(map);
  }, [activeLayers]);

  // Add popups
  const addPopups = useCallback((map: mapboxgl.Map) => {
    map.on('click', 'flood-areas', (e) => {
      const f = e.features?.[0];
      if (!f) return;
      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<div style="padding:8px;font-family:sans-serif"><h4 style="color:#3b82f6;margin:0 0 8px;font-weight:bold">🌊 Flooded Area</h4><p style="margin:4px 0;font-size:12px"><strong>Area:</strong> ${f.properties?.area_km2 || 'Unknown'} km²</p><p style="margin:4px 0;font-size:12px"><strong>Source:</strong> ${f.properties?.source || 'Satellite'}</p></div>`)
        .addTo(map);
    });

    map.on('click', 'landslide-points', (e) => {
      const f = e.features?.[0];
      if (!f) return;
      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<div style="padding:8px;font-family:sans-serif"><h4 style="color:#f97316;margin:0 0 8px;font-weight:bold">⛰️ Landslide Risk</h4><p style="margin:4px 0;font-size:12px"><strong>Level:</strong> ${f.properties?.risk_level?.toUpperCase()}</p><p style="margin:4px 0;font-size:12px"><strong>Rainfall:</strong> ${f.properties?.rainfall_mm}mm</p><p style="margin:4px 0;font-size:12px"><strong>Slope:</strong> ${f.properties?.slope_angle}°</p></div>`)
        .addTo(map);
    });

    map.on('mouseenter', 'flood-areas', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'flood-areas', () => { map.getCanvas().style.cursor = ''; });
  }, []);

  // Update layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layerMapping: Record<string, string[]> = {
      cyclones: ['cyclone-tracks', 'cyclone-centers'],
      floods: ['flood-areas'],
      landslides: ['landslide-points'],
      waterlogged: ['waterlogged-areas'],
      historical: ['historical-tracks'],
    };

    Object.entries(layerMapping).forEach(([key, layerIds]) => {
      const isVisible = activeLayers[key as keyof typeof activeLayers];
      layerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
        }
      });
    });
  }, [activeLayers]);

  // Update data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hazards) return;

    // Update cyclones
    const cycloneSource = map.getSource('cyclones') as mapboxgl.GeoJSONSource;
    if (cycloneSource) {
      const features = hazards.cyclones.flatMap(c => [
        {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: c.track.map((t: any) => [t.lon, t.lat]) },
          properties: { name: c.name, category: c.category, maxWind: c.maxWind },
        },
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [c.center.lon, c.center.lat] },
          properties: { name: c.name, category: c.category, maxWind: c.maxWind },
        },
      ]);
      cycloneSource.setData({ type: 'FeatureCollection', features });
    }

    // Update floods
    const floodSource = map.getSource('floods') as mapboxgl.GeoJSONSource;
    if (floodSource) {
      floodSource.setData({
        type: 'FeatureCollection',
        features: hazards.floods.map(f => ({
          type: 'Feature',
          geometry: f.polygon,
          properties: { area_km2: f.area_km2, source: f.source },
        })),
      });
    }

    // Update landslides
    const landslideSource = map.getSource('landslides') as mapboxgl.GeoJSONSource;
    if (landslideSource) {
      landslideSource.setData({
        type: 'FeatureCollection',
        features: hazards.landslides.map(l => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [l.location.lon, l.location.lat] },
          properties: { risk_level: l.risk_level, slope_angle: l.slope_angle, rainfall_mm: l.rainfall_mm },
        })),
      });
    }

    // Update waterlogged
    const waterSource = map.getSource('waterlogged') as mapboxgl.GeoJSONSource;
    if (waterSource) {
      waterSource.setData({
        type: 'FeatureCollection',
        features: hazards.waterlogged.map(w => ({
          type: 'Feature',
          geometry: w.polygon,
          properties: { depth_cm: w.depth_cm, duration_hours: w.duration_hours },
        })),
      });
    }

    // Update historical
    const historicalSource = map.getSource('historical') as mapboxgl.GeoJSONSource;
    if (historicalSource) {
      historicalSource.setData({
        type: 'FeatureCollection',
        features: Object.entries(HISTORICAL_EVENTS).map(([key, event]) => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: event.track },
          properties: { name: event.name, event: key },
        })),
      });
    }
  }, [hazards]);

  return (
    <div className="relative w-full h-screen">
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Animated Hazard Layers (pulsing markers, flowing floods) */}
      <AnimatedHazardLayers
        map={mapInstance}
        cyclones={hazards?.cyclones || []}
        floods={hazards?.floods || []}
        activeLayers={{ cyclones: activeLayers.cyclones, floods: activeLayers.floods }}
      />

      {/* WeatherLab-style Hazard Bubble Markers */}
      <HazardBubbleMarkers
        map={mapInstance}
        hazards={hazardBubbles as any}
        visible={true}
      />

      {/* Global Wind Particle Layer (OpenWeather API) */}
      <WindParticleLayer
        map={mapInstance}
        visible={activeLayers.wind}
      />

      {/* Cyclone Wind Field Animation */}
      {activeLayers.cyclones && hazards?.cyclones && (
        <CycloneWindField
          map={mapInstance}
          cyclones={hazards.cyclones.map(c => ({
            id: c.id,
            center: c.center,
            maxWindSpeed: c.maxWind,
            radius: 300,
            pressure: 980,
            category: c.category as any,
            movementDirection: 0,
            movementSpeed: 10,
          }))}
          showWindField={true}
          showEyeWall={true}
          isActive={true}
        />
      )}

      {/* Flood Animation */}
      {activeLayers.floods && hazards?.floods && (
        <FloodAnimationLayer
          map={mapInstance}
          floodZones={hazards.floods.map(f => ({
            id: f.id,
            center: { lat: f.polygon.coordinates[0][0][1], lon: f.polygon.coordinates[0][0][0] },
            extent: f.polygon.coordinates[0].map((c: number[]) => ({ lat: c[1], lon: c[0] })),
            severity: f.area_km2 > 50 ? 'major' : f.area_km2 > 10 ? 'moderate' : 'minor',
            depth: 1.5,
            velocity: 0.5,
            isExpanding: false,
          }))}
          showFlowLines={true}
          showPulseEffect={true}
          isActive={true}
        />
      )}

      {/* Automatic Detection Popups */}
      <DetectionPopup
        detections={detections}
        onDismiss={(id) => setDetections(prev => prev.filter(d => d.id !== id))}
        onView={(detection) => {
          // Zoom to detection location
          if (mapInstance && detection.location) {
            const [lat, lon] = detection.location.match(/([-\d.]+)°S, ([-\d.]+)°E/)?.slice(1).map(parseFloat) || [0, 0];
            mapInstance.flyTo({ center: [Math.abs(lon), Math.abs(lat) * -1], zoom: 6, duration: 1500 });
          }
        }}
      />

      {/* Minimal Layer Icons - Right side */}
      <MinimalLayerIcons
        activeLayers={activeLayers}
        toggleLayer={toggleLayer}
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {/* OpenWeather Layer (always on when wind is active) */}
      {activeLayers.wind && (
        <OpenWeatherLayer
          map={mapInstance}
          isVisible={activeLayers.wind}
          apiKey={import.meta.env.VITE_OPENWEATHER_API || ''}
        />
      )}

      {/* Horizontal Scale Legend - Bottom left */}
      <HorizontalScaleLegend showWind={true} showTemp={true} />

      {/* Weather Ticker - Below time controls at bottom center */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 flex flex-col items-center gap-2">
        <WeatherTicker />
      </div>

      {/* News Ticker at Bottom - Full width */}
      <NewsTicker items={tickerItems} isLoading={isLoading} />

      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-white text-sm">Loading hazards...</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .cyclone-marker {
          position: relative;
          width: 40px;
          height: 40px;
        }
        
        .cyclone-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 30px;
          height: 30px;
          border-radius: 50%;
          animation: pulse 2s ease-out infinite;
        }
        
        .cyclone-pulse.td, .cyclone-pulse.ts {
          background: rgba(245, 158, 11, 0.4);
          border: 2px solid rgba(245, 158, 11, 0.8);
        }
        
        .cyclone-pulse.cat1, .cyclone-pulse.cat2 {
          background: rgba(249, 115, 22, 0.4);
          border: 2px solid rgba(249, 115, 22, 0.8);
        }
        
        .cyclone-pulse.cat3, .cyclone-pulse.cat4, .cyclone-pulse.cat5 {
          background: rgba(239, 68, 68, 0.4);
          border: 2px solid rgba(239, 68, 68, 0.8);
          animation: pulse 1s ease-out infinite;
        }
        
        .cyclone-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 12px;
          height: 12px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
        
        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default UnifiedHazardMap;
