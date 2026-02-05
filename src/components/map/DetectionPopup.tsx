/**
 * Detection Markers - Mapbox Native Layers
 * Renders detections directly as map layers, not floating overlays
 */

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

interface Detection {
  id: string;
  type: 'cyclone' | 'flood' | 'landslide' | 'waterlogged';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  location?: string;
  coordinates?: { lat: number; lon: number };
}

interface DetectionPopupProps {
  map: mapboxgl.Map | null;
  detections: Detection[];
  onDismiss: (id: string) => void;
  onView: (detection: Detection) => void;
}

const TYPE_CONFIG: Record<string, { emoji: string; color: string }> = {
  cyclone: { emoji: '🌀', color: '#ef4444' },
  flood: { emoji: '🌊', color: '#3b82f6' },
  landslide: { emoji: '⛰️', color: '#f97316' },
  waterlogged: { emoji: '💧', color: '#22d3ee' },
};

const SEVERITY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: '#dc2626', label: 'CRITICAL' },
  high: { color: '#f97316', label: 'HIGH' },
  medium: { color: '#eab308', label: 'MEDIUM' },
  low: { color: '#22c55e', label: 'LOW' },
};

const SOURCE_ID = 'detection-markers-source';
const PULSE_LAYER_ID = 'detection-pulse-layer';
const CORE_LAYER_ID = 'detection-core-layer';
const LABEL_LAYER_ID = 'detection-label-layer';

export function DetectionPopup({ map, detections, onDismiss, onView }: DetectionPopupProps) {
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const initializedRef = useRef(false);
  const animationRef = useRef<number | null>(null);

  const parseLocation = useCallback((location?: string): { lat: number; lon: number } | null => {
    if (!location) return null;
    const match = location.match(/([-\d.]+)°[SN],?\s*([-\d.]+)°[EW]/);
    if (!match) return null;
    const lat = parseFloat(match[1]) * (location.includes('S') ? -1 : 1);
    const lon = parseFloat(match[2]) * (location.includes('W') ? -1 : 1);
    return { lat, lon };
  }, []);

  const getGeoJSON = useCallback((): GeoJSON.FeatureCollection => ({
    type: 'FeatureCollection',
    features: detections
      .map(d => {
        const coords = d.coordinates || parseLocation(d.location);
        if (!coords) return null;
        const typeConfig = TYPE_CONFIG[d.type] || { emoji: '⚠️', color: '#888888' };
        const sevConfig = SEVERITY_CONFIG[d.severity] || { color: '#888888', label: 'UNKNOWN' };
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [coords.lon, coords.lat] },
          properties: {
            id: d.id,
            type: d.type,
            title: d.title,
            message: d.message,
            severity: d.severity,
            color: typeConfig.color,
            severityColor: sevConfig.color,
            emoji: typeConfig.emoji,
            severityLabel: sevConfig.label
          }
        };
      })
      .filter(Boolean) as GeoJSON.Feature[]
  }), [detections, parseLocation]);

  useEffect(() => {
    if (!map) return;

    const initLayers = () => {
      if (initializedRef.current) return;
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, { type: 'geojson', data: getGeoJSON() });

      map.addLayer({
        id: PULSE_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 25,
          'circle-color': 'transparent',
          'circle-stroke-width': 3,
          'circle-stroke-color': ['get', 'severityColor'],
          'circle-stroke-opacity': 0.6
        }
      });

      map.addLayer({
        id: CORE_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 10,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 3,
          'circle-stroke-color': ['get', 'severityColor'],
          'circle-stroke-opacity': 1
        }
      });

      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['concat', ['get', 'emoji'], ' ', ['get', 'severityLabel']],
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': 10,
          'text-offset': [0, 2.2],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': ['get', 'severityColor'],
          'text-halo-color': 'rgba(0,0,0,0.9)',
          'text-halo-width': 1.5
        }
      });

      map.on('click', CORE_LAYER_ID, (e) => {
        if (!e.features?.[0]) return;
        const props = e.features[0].properties as Record<string, unknown>;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;

        popupRef.current?.remove();

        const html = `
          <div style="background:#0f0f0f;padding:12px;border-radius:8px;border:1px solid ${props.severityColor}40;min-width:180px;font-family:system-ui;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="font-size:20px;">${props.emoji}</span>
              <div>
                <div style="color:white;font-weight:600;font-size:13px;">${props.title}</div>
                <span style="background:${props.severityColor};color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:600;">${props.severityLabel}</span>
              </div>
            </div>
            <div style="color:rgba(255,255,255,0.7);font-size:11px;line-height:1.4;">${props.message}</div>
          </div>
        `;

        popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, className: 'detection-popup', maxWidth: '280px' })
          .setLngLat(coords as [number, number])
          .setHTML(html)
          .addTo(map);
      });

      map.on('mouseenter', CORE_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', CORE_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });

      initializedRef.current = true;

      let step = 0;
      const animate = () => {
        step = (step + 1) % 60;
        const scale = 1 + Math.sin(step * Math.PI / 30) * 0.4;
        const opacity = 0.8 - Math.sin(step * Math.PI / 30) * 0.4;
        if (map.getLayer(PULSE_LAYER_ID)) {
          map.setPaintProperty(PULSE_LAYER_ID, 'circle-radius', 20 + scale * 10);
          map.setPaintProperty(PULSE_LAYER_ID, 'circle-stroke-opacity', opacity);
        }
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
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
  }, [map, detections, getGeoJSON]);

  return (
    <style>{`
      .detection-popup .mapboxgl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
      .detection-popup .mapboxgl-popup-tip { border-top-color: #0f0f0f !important; }
      .detection-popup .mapboxgl-popup-close-button { color: white !important; font-size: 18px; right: 4px; top: 4px; }
    `}</style>
  );
}

export default DetectionPopup;