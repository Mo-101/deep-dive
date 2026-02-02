import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface AfricaMapProps {
  onMapLoad?: (map: mapboxgl.Map) => void;
  onHotspotClick?: (hotspotId: string) => void;
}

const AfricaMap = ({ onMapLoad, onHotspotClick }: AfricaMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.error('Mapbox token not found. Please add VITE_MAPBOX_TOKEN to your environment.');
      return;
    }

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [20, 0], // Center on Africa
      zoom: 3,
      minZoom: 2,
      maxZoom: 12,
      projection: 'mercator',
      attributionControl: false,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'bottom-right'
    );

    // Add scale
    map.current.addControl(
      new mapboxgl.ScaleControl({ maxWidth: 150 }),
      'bottom-left'
    );

    // Add attribution
    map.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-left'
    );

    map.current.on('load', () => {
      setMapLoaded(true);
      
      if (map.current) {
        // Add a subtle glow to the African continent
        map.current.setPaintProperty('water', 'fill-color', '#0a1628');
        
        // Initialize sources for cyclone data
        map.current.addSource('hotspots', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });

        map.current.addSource('tracks', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });

        // Add hotspot layer with circles
        map.current.addLayer({
          id: 'hotspots-glow',
          type: 'circle',
          source: 'hotspots',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'track_prob'], 0, 8, 1, 25],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.3,
            'circle-blur': 0.8,
          },
        });

        map.current.addLayer({
          id: 'hotspots-core',
          type: 'circle',
          source: 'hotspots',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'track_prob'], 0, 4, 1, 12],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.9,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.5,
          },
        });

        // Add track lines
        map.current.addLayer({
          id: 'tracks-line',
          type: 'line',
          source: 'tracks',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 3,
            'line-opacity': 0.8,
            'line-dasharray': [2, 2],
          },
        });

        // Click handler for hotspots
        map.current.on('click', 'hotspots-core', (e) => {
          if (e.features && e.features[0] && onHotspotClick) {
            const hotspotId = e.features[0].properties?.id;
            if (hotspotId) {
              onHotspotClick(hotspotId);
            }
          }
        });

        // Cursor change on hover
        map.current.on('mouseenter', 'hotspots-core', () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = 'pointer';
          }
        });

        map.current.on('mouseleave', 'hotspots-core', () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = '';
          }
        });

        onMapLoad?.(map.current);
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [onMapLoad, onHotspotClick]);

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">Initializing AFRO Storm...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AfricaMap;
