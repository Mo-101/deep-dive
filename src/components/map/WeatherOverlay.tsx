/**
 * Simplified Weather Overlay
 * Shows weather tiles from OpenWeatherMap with minimal API calls
 */

import { useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { CloudRain, Sun, Wind, Thermometer, Layers, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherOverlayProps {
  map: mapboxgl.Map | null;
}

const API_KEY = import.meta.env.VITE_OPENWEATHER_API;

// Cache for weather data
const weatherCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const WeatherOverlay = ({ map }: WeatherOverlayProps) => {
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add/remove weather tile layer
  useEffect(() => {
    if (!map) return;

    // Remove existing layer if any
    if (map.getLayer('weather-tiles')) {
      map.removeLayer('weather-tiles');
    }
    if (map.getSource('weather-source')) {
      map.removeSource('weather-source');
    }

    if (!activeLayer) return;

    setLoading(true);
    setError(null);

    try {
      // Add OpenWeatherMap tile layer
      const tileUrl = `https://tile.openweathermap.org/map/${activeLayer}/{z}/{x}/{y}.png?appid=${API_KEY}`;
      
      map.addSource('weather-source', {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        attribution: '© OpenWeatherMap'
      });

      map.addLayer({
        id: 'weather-tiles',
        type: 'raster',
        source: 'weather-source',
        paint: {
          'raster-opacity': activeLayer === 'temp_new' ? 0.5 : 0.7
        }
      });

      setLoading(false);
    } catch (e) {
      console.error('Weather layer error:', e);
      setError('Failed to load weather layer');
      setLoading(false);
    }

    return () => {
      if (map.getLayer('weather-tiles')) {
        map.removeLayer('weather-tiles');
      }
      if (map.getSource('weather-source')) {
        map.removeSource('weather-source');
      }
    };
  }, [map, activeLayer]);

  const layers = [
    { id: 'precipitation_new', name: 'Precipitation', icon: CloudRain, color: 'blue' },
    { id: 'clouds_new', name: 'Clouds', icon: Layers, color: 'gray' },
    { id: 'wind_new', name: 'Wind', icon: Wind, color: 'cyan' },
    { id: 'temp_new', name: 'Temperature', icon: Thermometer, color: 'orange' },
  ];

  return (
    <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2">
      {/* Weather Layer Buttons */}
      {layers.map((layer) => {
        const Icon = layer.icon;
        const isActive = activeLayer === layer.id;
        
        return (
          <button
            key={layer.id}
            onClick={() => setActiveLayer(isActive ? null : layer.id)}
            disabled={loading}
            className={cn(
              "group relative flex items-center gap-2 px-4 py-3 rounded-xl border backdrop-blur-xl transition-all",
              isActive 
                ? `bg-${layer.color}-500/20 border-${layer.color}-500/50 text-${layer.color}-400 shadow-lg shadow-${layer.color}-500/20` 
                : "bg-black/70 border-white/10 text-white hover:bg-white/10"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-sm font-medium">{layer.name}</span>
            
            {isActive && (
              <X className="w-4 h-4 ml-2 opacity-60 hover:opacity-100" />
            )}
            
            {loading && isActive && (
              <div className="absolute right-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
          </button>
        );
      })}

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-xs">
          {error}
        </div>
      )}
    </div>
  );
};

export default WeatherOverlay;
