/**
 * Animated Cyclone Layer
 * Pulsing cyclone icons, animated tracks, and intensity visualization
 */

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

interface CyclonePoint {
  id: string;
  lat: number;
  lon: number;
  intensity: number; // 0-5 (TD, TS, Cat1-5)
  windSpeed: number; // knots
  pressure: number; // mb
  name: string;
  timestamp: string;
}

interface CycloneTrack {
  id: string;
  points: CyclonePoint[];
  name: string;
}

interface AnimatedCycloneLayerProps {
  map: mapboxgl.Map | null;
  cyclones: CycloneTrack[];
  selectedCycloneId?: string;
  showTracks?: boolean;
  showForecast?: boolean;
}

// Cyclone category colors and styles
const CYCLONE_STYLES = {
  0: { color: '#60a5fa', name: 'Tropical Depression', radius: 15, pulseSpeed: 2000 },
  1: { color: '#34d399', name: 'Tropical Storm', radius: 20, pulseSpeed: 1800 },
  2: { color: '#fbbf24', name: 'Category 1', radius: 25, pulseSpeed: 1500 },
  3: { color: '#f97316', name: 'Category 2', radius: 30, pulseSpeed: 1200 },
  4: { color: '#ef4444', name: 'Category 3', radius: 35, pulseSpeed: 1000 },
  5: { color: '#dc2626', name: 'Category 4-5', radius: 40, pulseSpeed: 800 },
};

// Custom pulsing cyclone marker
class PulsingCycloneMarker {
  private marker: mapboxgl.Marker;
  private element: HTMLDivElement;
  private animationId: number | null = null;
  private pulseElement: HTMLDivElement;
  private coreElement: HTMLDivElement;

  constructor(
    cyclone: CyclonePoint,
    isSelected: boolean = false
  ) {
    // Create marker element
    this.element = document.createElement('div');
    this.element.className = 'relative flex items-center justify-center';
    this.element.style.width = '80px';
    this.element.style.height = '80px';

    const style = CYCLONE_STYLES[cyclone.intensity as keyof typeof CYCLONE_STYLES] || CYCLONE_STYLES[0];
    
    // Create pulsing ring
    this.pulseElement = document.createElement('div');
    this.pulseElement.className = 'absolute rounded-full animate-ping';
    this.pulseElement.style.width = `${style.radius * 2}px`;
    this.pulseElement.style.height = `${style.radius * 2}px`;
    this.pulseElement.style.backgroundColor = style.color;
    this.pulseElement.style.opacity = '0.4';
    this.pulseElement.style.animationDuration = `${style.pulseSpeed}ms`;
    
    // Create core
    this.coreElement = document.createElement('div');
    this.coreElement.className = 'absolute rounded-full flex items-center justify-center';
    this.coreElement.style.width = `${style.radius}px`;
    this.coreElement.style.height = `${style.radius}px`;
    this.coreElement.style.backgroundColor = style.color;
    this.coreElement.style.boxShadow = `0 0 20px ${style.color}, 0 0 40px ${style.color}40`;
    this.coreElement.style.border = `2px solid white`;
    
    // Add hurricane symbol for stronger storms
    if (cyclone.intensity >= 3) {
      const symbol = document.createElement('div');
      symbol.innerHTML = '🌀';
      symbol.style.fontSize = `${style.radius * 0.5}px`;
      symbol.style.filter = 'drop-shadow(0 0 2px rgba(0,0,0,0.5))';
      this.coreElement.appendChild(symbol);
    }

    // Selected indicator
    if (isSelected) {
      const ring = document.createElement('div');
      ring.className = 'absolute rounded-full border-2 border-white animate-spin';
      ring.style.width = `${style.radius * 3}px`;
      ring.style.height = `${style.radius * 3}px`;
      ring.style.borderStyle = 'dashed';
      ring.style.animationDuration = '3s';
      this.element.appendChild(ring);
    }

    // Label
    const label = document.createElement('div');
    label.className = 'absolute -bottom-6 whitespace-nowrap text-xs font-bold text-white drop-shadow-lg';
    label.textContent = cyclone.name || `Cyclone ${cyclone.id}`;
    label.style.textShadow = '0 0 4px rgba(0,0,0,0.8)';

    this.element.appendChild(this.pulseElement);
    this.element.appendChild(this.coreElement);
    this.element.appendChild(label);

    // Create marker
    this.marker = new mapboxgl.Marker({
      element: this.element,
      anchor: 'center'
    }).setLngLat([cyclone.lon, cyclone.lat]);

    // Start custom animation
    this.startPulseAnimation(style.pulseSpeed);
  }

  private startPulseAnimation(speed: number) {
    let scale = 1;
    let growing = true;
    
    const animate = () => {
      if (growing) {
        scale += 0.02;
        if (scale >= 1.5) growing = false;
      } else {
        scale -= 0.02;
        if (scale <= 1) growing = true;
      }
      
      if (this.pulseElement) {
        this.pulseElement.style.transform = `scale(${scale})`;
        this.pulseElement.style.opacity = String(0.6 - (scale - 1) * 0.8);
      }
      
      this.animationId = requestAnimationFrame(animate);
    };
    
    this.animationId = requestAnimationFrame(animate);
  }

  addTo(map: mapboxgl.Map) {
    this.marker.addTo(map);
    return this;
  }

  remove() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.marker.remove();
  }

  setLngLat(lngLat: [number, number]) {
    this.marker.setLngLat(lngLat);
    return this;
  }
}

export const AnimatedCycloneLayer = ({
  map,
  cyclones,
  selectedCycloneId,
  showTracks = true,
  showForecast = true
}: AnimatedCycloneLayerProps) => {
  const markersRef = useRef<Map<string, PulsingCycloneMarker>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  const currentPosRef = useRef<Map<string, number>>(new Map());

  // Initialize cyclone layers
  useEffect(() => {
    if (!map) return;

    // Add track sources
    if (!map.getSource('cyclone-tracks')) {
      map.addSource('cyclone-tracks', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'cyclone-tracks-layer',
        type: 'line',
        source: 'cyclone-tracks',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
          'line-opacity': 0.8,
          'line-dasharray': [2, 1]
        }
      });
    }

    if (!map.getSource('cyclone-forecast')) {
      map.addSource('cyclone-forecast', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'cyclone-forecast-layer',
        type: 'line',
        source: 'cyclone-forecast',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.4,
          'line-dasharray': [5, 5]
        }
      });
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
    };
  }, [map]);

  // Update cyclone markers and tracks
  useEffect(() => {
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((marker, id) => {
      if (!cyclones.find(c => c.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    cyclones.forEach(track => {
      const currentPoint = track.points[track.points.length - 1];
      const isSelected = track.id === selectedCycloneId;
      
      // Create or update marker
      if (!markersRef.current.has(track.id)) {
        const marker = new PulsingCycloneMarker(currentPoint, isSelected);
        marker.addTo(map);
        markersRef.current.set(track.id, marker);
        currentPosRef.current.set(track.id, 0);
      } else {
        markersRef.current.get(track.id)?.setLngLat([currentPoint.lon, currentPoint.lat]);
      }
    });

    // Update tracks
    if (showTracks) {
      updateTracks();
    }

    // Start animation along tracks
    if (cyclones.length > 0) {
      startTrackAnimation();
    }
  }, [map, cyclones, selectedCycloneId, showTracks]);

  const updateTracks = useCallback(() => {
    if (!map) return;

    const trackFeatures = cyclones.map(track => ({
      type: 'Feature' as const,
      properties: {
        color: CYCLONE_STYLES[track.points[0]?.intensity as keyof typeof CYCLONE_STYLES]?.color || '#60a5fa'
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: track.points.map(p => [p.lon, p.lat])
      }
    }));

    const trackSource = map.getSource('cyclone-tracks') as mapboxgl.GeoJSONSource;
    if (trackSource) {
      trackSource.setData({
        type: 'FeatureCollection',
        features: trackFeatures
      });
    }
  }, [cyclones, map]);

  const startTrackAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const animate = () => {
      cyclones.forEach(track => {
        const marker = markersRef.current.get(track.id);
        if (!marker || track.points.length < 2) return;

        let pos = currentPosRef.current.get(track.id) || 0;
        pos += 0.005; // Animation speed along track

        if (pos >= track.points.length - 1) {
          pos = 0; // Loop
        }

        currentPosRef.current.set(track.id, pos);

        // Interpolate position
        const index = Math.floor(pos);
        const fraction = pos - index;
        
        if (index < track.points.length - 1) {
          const p1 = track.points[index];
          const p2 = track.points[index + 1];
          
          const lat = p1.lat + (p2.lat - p1.lat) * fraction;
          const lon = p1.lon + (p2.lon - p1.lon) * fraction;
          
          marker.setLngLat([lon, lat]);
        }
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [cyclones]);

  return null; // This is a logic component, no visual output
};

export default AnimatedCycloneLayer;
