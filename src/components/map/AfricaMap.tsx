import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface AfricaMapProps {
  onMapLoad?: (map: mapboxgl.Map) => void;
  onHotspotClick?: (id: string) => void;
}

const AfricaMap = ({ onMapLoad, onHotspotClick }: AfricaMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.error('Mapbox token not found');
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [25, 0], // Center on Africa
      zoom: 3,
      minZoom: 2,
      maxZoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // Add empty sources for hotspots and tracks
      map.addSource('hotspots', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('tracks', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Add track lines layer
      map.addLayer({
        id: 'track-lines',
        type: 'line',
        source: 'tracks',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.8,
        },
      });

      // Add hotspots layer
      map.addLayer({
        id: 'hotspots-layer',
        type: 'circle',
        source: 'hotspots',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'hurricane_prob'],
            0, 6,
            1, 16,
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.5,
        },
      });

      // Add click handler for hotspots
      map.on('click', 'hotspots-layer', (e) => {
        if (e.features && e.features[0]) {
          const id = e.features[0].properties?.id;
          if (id && onHotspotClick) {
            onHotspotClick(id);
          }
        }
      });

      // Change cursor on hover
      map.on('mouseenter', 'hotspots-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'hotspots-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      mapRef.current = map;
      onMapLoad?.(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onMapLoad, onHotspotClick]);

  return (
    <div ref={mapContainer} className="w-full h-full absolute inset-0" />
  );
};

export default AfricaMap;
