import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

interface HotspotData {
  id: string;
  latitude: number;
  longitude: number;
  hurricane_prob?: number | null;
  wind_speed_kt?: number | null;
  disaster_type?: string;
  track_id?: string | null;
  cyclone_tracks?: {
    track_id: string;
    storm_name?: string | null;
    basin: string;
  } | null;
  forecasts?: {
    forecast_time: string;
    model_name: string;
  } | null;
}

interface HotspotMarkersProps {
  map: mapboxgl.Map | null;
  hotspots: HotspotData[];
  onHotspotClick?: (hotspotId: string) => void;
}

export function HotspotMarkers({ map, hotspots, onHotspotClick }: HotspotMarkersProps) {
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const sourceAdded = useRef(false);

  useEffect(() => {
    if (!map || !hotspots.length) return;

    // Clean up existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Convert hotspots to GeoJSON
    const geojsonData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: hotspots.map(h => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [h.longitude, h.latitude]
        },
        properties: {
          id: h.id,
          hurricane_prob: h.hurricane_prob || 0,
          wind_speed_kt: h.wind_speed_kt || 0,
          disaster_type: h.disaster_type,
          storm_name: h.cyclone_tracks?.storm_name || 'Unknown',
          basin: h.cyclone_tracks?.basin || 'Unknown',
          track_id: h.cyclone_tracks?.track_id || ''
        }
      }))
    };

    // Add or update source
    const sourceId = 'db-hotspots-source';
    const layerId = 'db-hotspots-layer';
    const pulseLayerId = 'db-hotspots-pulse';

    try {
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojsonData);
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data: geojsonData
        });
        sourceAdded.current = true;
      }

      // Add pulse layer for high-probability hotspots
      if (!map.getLayer(pulseLayerId)) {
        map.addLayer({
          id: pulseLayerId,
          type: 'circle',
          source: sourceId,
          filter: ['>=', ['get', 'hurricane_prob'], 0.7],
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['get', 'hurricane_prob'],
              0.7, 30,
              1.0, 50
            ],
            'circle-color': 'rgba(239, 68, 68, 0.2)',
            'circle-stroke-width': 0,
            'circle-opacity': [
              'interpolate', ['linear'], ['get', 'hurricane_prob'],
              0.7, 0.3,
              1.0, 0.5
            ]
          }
        });
      }

      // Add main hotspot layer
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['get', 'hurricane_prob'],
              0, 6,
              0.5, 12,
              1.0, 20
            ],
            'circle-color': [
              'interpolate', ['linear'], ['get', 'hurricane_prob'],
              0, '#3b82f6',      // Blue - low
              0.3, '#22c55e',    // Green
              0.5, '#eab308',    // Yellow
              0.7, '#f97316',    // Orange
              0.9, '#ef4444'     // Red - high
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9
          }
        });

        // Click handler
        map.on('click', layerId, (e) => {
          if (e.features?.[0]) {
            const props = e.features[0].properties;
            if (props?.id && onHotspotClick) {
              onHotspotClick(props.id);
            }

            // Show popup
            const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
            const prob = ((props?.hurricane_prob || 0) * 100).toFixed(0);
            const wind = props?.wind_speed_kt || 'N/A';
            
            new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
              .setLngLat(coords)
              .setHTML(`
                <div style="padding: 8px; font-family: system-ui;">
                  <h3 style="margin: 0 0 8px 0; font-weight: bold; font-size: 14px;">
                    ${props?.storm_name || 'Developing System'}
                  </h3>
                  <div style="font-size: 12px; color: #666;">
                    <div><strong>Basin:</strong> ${props?.basin}</div>
                    <div><strong>Hurricane Probability:</strong> ${prob}%</div>
                    <div><strong>Wind Speed:</strong> ${wind} kt</div>
                    <div><strong>Type:</strong> ${props?.disaster_type}</div>
                  </div>
                </div>
              `)
              .addTo(map);
          }
        });

        // Cursor change
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    } catch (err) {
      console.warn('Error adding hotspot layer:', err);
    }

    return () => {
      // Cleanup handled by map disposal or next update
    };
  }, [map, hotspots, onHotspotClick]);

  return null;
}
