/**
 * Sleek Weather Icon Card with OpenWeatherMap Icons
 * Uses official OWM weather condition icons
 */

import { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { cn } from '@/lib/utils';

interface WeatherIconCardProps {
  map: mapboxgl.Map | null;
  activeStyle?: string;
  onStyleChange?: (style: string) => void;
}

const STANDARD_STYLE = 'mapbox://styles/akanimo1/cml5r2sfb000w01sh8rkcajww';
const CLOUDS_STYLE = 'mapbox://styles/akanimo1/cml5z52f1000u01s9842u9fgn';

const API_KEY = import.meta.env.VITE_OPENWEATHER_API;

interface WeatherLayer {
  id: string;
  iconCode: string; // OpenWeatherMap icon code
  label: string;
  color: string;
}

const WEATHER_LAYERS: WeatherLayer[] = [
  { id: 'precipitation_new', iconCode: '09d', label: 'Rain', color: '#3b82f6' },
  { id: 'clouds_new', iconCode: '03d', label: 'Clouds', color: '#9ca3af' },
  { id: 'wind_new', iconCode: '50d', label: 'Wind', color: '#06b6d4' },
  { id: 'temp_new', iconCode: '01d', label: 'Temp', color: '#f97316' },
  { id: 'earth_thermal', iconCode: '11d', label: 'Analysis', color: '#ef4444' }, // Thunderstorm icon for Analysis/Heat
];

// Get OpenWeatherMap icon URL
const getOWMIconUrl = (iconCode: string, size: '1x' | '2x' | '4x' = '2x') =>
  `https://openweathermap.org/img/wn/${iconCode}@${size}.png`;

export const WeatherIconCard = ({ map, activeStyle, onStyleChange }: WeatherIconCardProps) => {
  const [activeLayer, setActiveLayer] = useState<string | null>(null);

  // Sync activeLayer with activeStyle for Clouds
  useEffect(() => {
    if (activeStyle === CLOUDS_STYLE) {
      setActiveLayer('clouds_new');
    } else if (activeStyle === STANDARD_STYLE && activeLayer === 'clouds_new') {
      setActiveLayer(null);
    }
  }, [activeStyle]);

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

    // Don't add OWM tiles for special layers (clouds_new, earth_thermal)
    if (activeLayer === 'clouds_new' || activeLayer === 'earth_thermal') return;

    try {
      const tileUrl = `https://tile.openweathermap.org/map/${activeLayer}/{z}/{x}/{y}.png?appid=${API_KEY}`;

      map.addSource('weather-source', {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        attribution: '© OpenWeatherMap'
      });

      const beforeId = map.getLayer('wind-layer') ? 'wind-layer' : undefined;

      map.addLayer({
        id: 'weather-tiles',
        type: 'raster',
        source: 'weather-source',
        paint: {
          'raster-opacity': activeLayer === 'temp_new' ? 0.5 : 0.7
        }
      }, beforeId);
    } catch (e) {
      console.error('Weather layer error:', e);
    }

    return () => {
      if (map.getSource('weather-source')) {
        map.removeSource('weather-source');
      }
    };
  }, [map, activeLayer]);

  // Handle Earth Thermal Layer Visibility
  useEffect(() => {
    if (!map) return;

    // Toggle Earth Heatmap visibility
    if (map.getLayer('earth-thermal-heat')) {
      const visibility = activeLayer === 'earth_thermal' ? 'visible' : 'none';
      map.setLayoutProperty('earth-thermal-heat', 'visibility', visibility);
    }
  }, [map, activeLayer]);

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
      {/* Sleek thin card with OWM icons */}
      <div className="flex items-center gap-1 p-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl">
        {WEATHER_LAYERS.map((layer) => {
          const isActive = activeLayer === layer.id;

          return (
            <button
              key={layer.id}
              onClick={() => {
                if (layer.id === 'clouds_new') {
                  // Toggle Clouds Style
                  const newStyle = activeStyle === CLOUDS_STYLE ? STANDARD_STYLE : CLOUDS_STYLE;
                  onStyleChange?.(newStyle);
                  // setActiveLayer is handled by effect
                } else {
                  // Toggle OWM Layer
                  if (activeStyle === CLOUDS_STYLE) {
                    onStyleChange?.(STANDARD_STYLE);
                  }
                  setActiveLayer(isActive ? null : layer.id);
                }
              }}
              title={layer.label}
              className={cn(
                "relative p-2 rounded-xl transition-all duration-200 flex items-center justify-center",
                isActive
                  ? "bg-white/10 shadow-lg"
                  : "hover:bg-white/5"
              )}
            >
              {/* OpenWeatherMap Icon */}
              <img
                src={getOWMIconUrl(layer.iconCode, '2x')}
                alt={layer.label}
                className={cn(
                  "w-10 h-10 object-contain transition-all",
                  isActive ? "drop-shadow-lg" : "opacity-60 grayscale hover:opacity-80"
                )}
                style={{
                  filter: isActive ? `drop-shadow(0 0 8px ${layer.color})` : undefined
                }}
              />

              {/* Active indicator dot */}
              {isActive && (
                <div
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: layer.color }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WeatherIconCard;
