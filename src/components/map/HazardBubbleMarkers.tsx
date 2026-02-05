/**
 * Hazard Bubble Markers - Mapbox Native Layers
 * Renders hazards directly as Mapbox layers (no floating overlays)
 * Moves with the map, persistent positioning
 */

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

interface HazardPoint {
  id: string;
  type: 'cyclone' | 'flood' | 'landslide' | 'rainfall';
  location: { lat: number; lon: number };
  data: {
    windSpeed?: number;
    windDirection?: number;
    rainfall?: number;
    slope?: number;
    probability?: number;
    category?: string;
    label?: string;
  };
}

interface HazardBubbleMarkersProps {
  map: mapboxgl.Map | null;
  hazards: HazardPoint[];
  visible?: boolean;
}

const HAZARD_COLORS: Record<string, string> = {
  cyclone: '#ef4444',
  flood: '#3b82f6',
  landslide: '#f97316',
  rainfall: '#22d3ee',
};

const SOURCE_ID = 'hazard-bubbles-source';
const PULSE_LAYER_ID = 'hazard-pulse-layer';
const CORE_LAYER_ID = 'hazard-core-layer';
const LABEL_LAYER_ID = 'hazard-label-layer';

export function HazardBubbleMarkers({ map, hazards, visible = true }: HazardBubbleMarkersProps) {
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const animationRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const getGeoJSON = useCallback((): GeoJSON.FeatureCollection => ({
    type: 'FeatureCollection',
    features: hazards.map(h => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [h.location.lon, h.location.lat]
      },
      properties: {
        id: h.id,
        type: h.type,
        color: HAZARD_COLORS[h.type] || '#888888',
        probability: h.data.probability || 0.5,
        windSpeed: h.data.windSpeed || 0,
        rainfall: h.data.rainfall || 0,
        slope: h.data.slope || 0,
        category: h.data.category || '',
        displayLabel: h.data.windSpeed 
          ? `${Math.round(h.data.windSpeed)} m/s`
          : h.data.rainfall 
            ? `${h.data.rainfall}mm`
            : h.data.slope 
              ? `${h.data.slope}°`
              : ''
      }
    }))
  }), [hazards]);

  useEffect(() => {
    if (!map) return;

    const initLayers = () => {
      if (initializedRef.current) return;
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: getGeoJSON()
      });

      map.addLayer({
        id: PULSE_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'probability'], 0, 20, 0.5, 30, 1, 45],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.2,
          'circle-stroke-width': 2,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.5
        }
      });

      map.addLayer({
        id: CORE_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 12,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.8
        }
      });

      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'displayLabel'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-offset': [0, 2.5],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.5
        }
      });

      map.on('click', CORE_LAYER_ID, (e) => {
        if (!e.features?.[0]) return;
        const props = e.features[0].properties as Record<string, unknown>;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;

        popupRef.current?.remove();

        const emoji = props.type === 'cyclone' ? '🌀' : props.type === 'flood' ? '🌊' : props.type === 'landslide' ? '⛰️' : '🌧️';
        const html = `
          <div style="background:#0a0a0a;padding:12px;border-radius:8px;min-width:160px;font-family:system-ui;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="font-size:20px;">${emoji}</span>
              <span style="color:white;font-weight:600;text-transform:capitalize;">${props.type}</span>
            </div>
            <div style="color:rgba(255,255,255,0.6);font-size:11px;margin-bottom:8px;">
              📍 ${Math.abs(coords[1] as number).toFixed(1)}°${(coords[1] as number) > 0 ? 'N' : 'S'}, ${Math.abs(coords[0] as number).toFixed(1)}°${(coords[0] as number) > 0 ? 'E' : 'W'}
            </div>
            ${(props.windSpeed as number) > 0 ? `<div style="color:#22d3ee;font-size:13px;font-weight:600;">💨 ${Math.round(props.windSpeed as number)} m/s</div>` : ''}
            ${(props.rainfall as number) > 0 ? `<div style="color:#3b82f6;font-size:13px;font-weight:600;">🌧️ ${props.rainfall}mm</div>` : ''}
            ${(props.slope as number) > 0 ? `<div style="color:#f97316;font-size:13px;font-weight:600;">⛰️ ${props.slope}° slope</div>` : ''}
            ${(props.probability as number) > 0 ? `
              <div style="margin-top:8px;">
                <div style="color:rgba(255,255,255,0.5);font-size:10px;">Probability</div>
                <div style="background:rgba(255,255,255,0.1);height:6px;border-radius:3px;margin-top:4px;overflow:hidden;">
                  <div style="width:${(props.probability as number) * 100}%;height:100%;background:linear-gradient(to right,#22c55e,#facc15,#ef4444);border-radius:3px;"></div>
                </div>
                <div style="text-align:right;color:rgba(255,255,255,0.6);font-size:10px;margin-top:2px;">${Math.round((props.probability as number) * 100)}%</div>
              </div>
            ` : ''}
          </div>
        `;

        popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, className: 'hazard-popup', maxWidth: '250px' })
          .setLngLat(coords as [number, number])
          .setHTML(html)
          .addTo(map);
      });

      map.on('mouseenter', CORE_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', CORE_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });

      initializedRef.current = true;

      let pulseStep = 0;
      const animatePulse = () => {
        pulseStep = (pulseStep + 1) % 100;
        const opacity = 0.15 + Math.sin(pulseStep * Math.PI / 50) * 0.1;
        const strokeOpacity = 0.4 + Math.sin(pulseStep * Math.PI / 50) * 0.3;
        if (map.getLayer(PULSE_LAYER_ID)) {
          map.setPaintProperty(PULSE_LAYER_ID, 'circle-opacity', opacity);
          map.setPaintProperty(PULSE_LAYER_ID, 'circle-stroke-opacity', strokeOpacity);
        }
        animationRef.current = requestAnimationFrame(animatePulse);
      };
      animatePulse();
    };

    if (map.isStyleLoaded()) {
      initLayers();
    } else {
      map.once('load', initLayers);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      popupRef.current?.remove();
    };
  }, [map, getGeoJSON]);

  useEffect(() => {
    if (!map || !initializedRef.current) return;
    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
    if (source) source.setData(getGeoJSON());
  }, [map, hazards, getGeoJSON]);

  useEffect(() => {
    if (!map) return;
    const visibility = visible ? 'visible' : 'none';
    [PULSE_LAYER_ID, CORE_LAYER_ID, LABEL_LAYER_ID].forEach(layerId => {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
    });
  }, [map, visible]);

  return (
    <style>{`
      .hazard-popup .mapboxgl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
      .hazard-popup .mapboxgl-popup-tip { border-top-color: #0a0a0a !important; }
      .hazard-popup .mapboxgl-popup-close-button { color: white !important; font-size: 18px; padding: 4px 8px; }
    `}</style>
  );
}

export default HazardBubbleMarkers;