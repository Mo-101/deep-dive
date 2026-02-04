/**
 * Wind Particle Layer - Native Mapbox Integration
 * Uses Mapbox's built-in raster-particle layer for GPU-accelerated wind animation
 * Data source: GFS (Global Forecast System) wind data
 */

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

interface WindParticleLayerProps {
    map: mapboxgl.Map | null;
    visible?: boolean;
}

// Wind speed color scale (m/s -> color)
const WIND_PARTICLE_COLOR = [
    'interpolate',
    ['linear'],
    ['raster-particle-speed'],
    // Calm - light blue
    1.5, 'rgba(100, 180, 255, 200)',
    // Light - blue
    4, 'rgba(80, 160, 255, 220)',
    // Moderate - cyan
    8, 'rgba(0, 200, 180, 230)',
    // Fresh - green
    12, 'rgba(80, 200, 80, 240)',
    // Strong - yellow
    16, 'rgba(230, 200, 50, 250)',
    // Gale - orange
    20, 'rgba(255, 140, 50, 255)',
    // Storm - red
    25, 'rgba(255, 60, 60, 255)',
    // Violent storm - magenta
    30, 'rgba(200, 50, 150, 255)',
    // Hurricane - white
    40, 'rgba(255, 255, 255, 255)',
];

export function WindParticleLayer({ map, visible = true }: WindParticleLayerProps) {
    const layerAddedRef = useRef(false);

    useEffect(() => {
        if (!map) return;

        const addWindLayer = () => {
            // Check if already added
            if (map.getSource('gfs-wind-source')) {
                layerAddedRef.current = true;
                return;
            }

            try {
                // Add GFS wind data source (Mapbox's free wind tileset)
                map.addSource('gfs-wind-source', {
                    type: 'raster-array',
                    url: 'mapbox://rasterarrayexamples.gfs-winds',
                    tileSize: 1000,
                });

                // Add the raster-particle layer for wind animation
                map.addLayer({
                    id: 'wind-particle-layer',
                    type: 'raster-particle',
                    source: 'gfs-wind-source',
                    'source-layer': '10winds',
                    paint: {
                        'raster-particle-speed-factor': 0.4,
                        'raster-particle-fade-opacity-factor': 0.9,
                        'raster-particle-reset-rate-factor': 0.4,
                        'raster-particle-count': 5000,
                        'raster-particle-max-speed': 40,
                        'raster-particle-color': WIND_PARTICLE_COLOR as any,
                    },
                });

                layerAddedRef.current = true;
                console.log('[WindParticleLayer] Native Mapbox wind layer added');
            } catch (error) {
                console.error('[WindParticleLayer] Error adding wind layer:', error);
            }
        };

        // Wait for map to be loaded
        if (map.isStyleLoaded()) {
            addWindLayer();
        } else {
            map.once('load', addWindLayer);
        }

        return () => {
            // Cleanup on unmount
            if (layerAddedRef.current && map.getLayer('wind-particle-layer')) {
                try {
                    map.removeLayer('wind-particle-layer');
                    map.removeSource('gfs-wind-source');
                    layerAddedRef.current = false;
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        };
    }, [map]);

    // Toggle visibility
    useEffect(() => {
        if (!map || !layerAddedRef.current) return;

        try {
            if (map.getLayer('wind-particle-layer')) {
                map.setLayoutProperty(
                    'wind-particle-layer',
                    'visibility',
                    visible ? 'visible' : 'none'
                );
            }
        } catch (error) {
            console.warn('[WindParticleLayer] Error toggling visibility:', error);
        }
    }, [map, visible]);

    return null; // Layer is managed imperatively via Mapbox
}

export default WindParticleLayer;
