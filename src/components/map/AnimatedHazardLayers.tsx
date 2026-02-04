/**
 * Animated Hazard Layers
 * Wind particles, pulsing cyclone markers, flowing flood animations
 */

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

interface AnimatedHazardLayersProps {
  map: mapboxgl.Map | null;
  cyclones: Array<{
    id: string;
    center: { lat: number; lon: number };
    category: string;
    maxWind: number;
  }>;
  floods: Array<{
    id: string;
    polygon: GeoJSON.Polygon;
  }>;
  activeLayers: {
    cyclones: boolean;
    floods: boolean;
  };
}

export function AnimatedHazardLayers({ map, cyclones, floods, activeLayers }: AnimatedHazardLayersProps) {
  const animationFrameRef = useRef<number>();
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // Animate cyclone markers with pulsing effect
  useEffect(() => {
    if (!map || !activeLayers.cyclones) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    cyclones.forEach(cyclone => {
      const el = document.createElement('div');
      el.className = 'cyclone-marker';
      el.innerHTML = `
        <div class="cyclone-pulse ${cyclone.category.toLowerCase()}"></div>
        <div class="cyclone-center"></div>
      `;

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([cyclone.center.lon, cyclone.center.lat])
        .addTo(map);

      markersRef.current.set(cyclone.id, marker);
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
    };
  }, [map, cyclones, activeLayers.cyclones]);

  // Animate flood layers with flowing water effect
  useEffect(() => {
    if (!map || !activeLayers.floods) return;

    let offset = 0;
    const animateFloods = () => {
      offset = (offset + 0.5) % 10;
      
      // Update flood layer paint properties for animation
      if (map.getLayer('flood-areas')) {
        map.setPaintProperty('flood-areas', 'fill-opacity', 0.3 + Math.sin(offset * 0.5) * 0.1);
      }

      animationFrameRef.current = requestAnimationFrame(animateFloods);
    };

    animateFloods();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [map, activeLayers.floods]);

  return null;
}

export default AnimatedHazardLayers;
