/**
 * OpenWeatherMap Layer Component
 * 5-day weather forecast with 3-hour intervals using OpenWeatherMap API
 * Includes precipitation, temperature, wind, and weather conditions
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  CloudRain, 
  Sun, 
  Cloud, 
  CloudSnow, 
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  Eye,
  Gauge,
  Clock,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherData {
  dt: number;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  clouds: { all: number };
  wind: { speed: number; deg: number; gust?: number };
  visibility: number;
  pop: number; // Probability of precipitation
  rain?: { '3h': number };
  snow?: { '3h': number };
  sys: { pod: string };
  dt_txt: string;
}

interface CityData {
  id: number;
  name: string;
  coord: { lat: number; lon: number };
  country: string;
  population: number;
  timezone: number;
}

interface ForecastData {
  cod: string;
  message: number;
  cnt: number;
  list: WeatherData[];
  city: CityData;
}

interface OpenWeatherMapLayerProps {
  map: mapboxgl.Map | null;
  visible: boolean;
  center?: [number, number]; // [lon, lat]
  opacity?: number;
}

const API_KEY = import.meta.env.VITE_OPENWEATHER_API;
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Get color based on temperature (Celsius)
const getTemperatureColor = (temp: number): string => {
  if (temp < 0) return '#3b82f6';
  if (temp < 10) return '#06b6d4';
  if (temp < 20) return '#22c55e';
  if (temp < 30) return '#eab308';
  if (temp < 35) return '#f97316';
  return '#ef4444';
};

export const OpenWeatherMapLayer = ({
  map,
  visible,
  center = [25, 0],
  opacity = 0.7
}: OpenWeatherMapLayerProps) => {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Fetch 5-day forecast
  const fetchForecast = useCallback(async (lon: number, lat: number) => {
    if (!API_KEY) {
      setError('OpenWeatherMap API key not found');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&cnt=40`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ForecastData = await response.json();
      setForecast(data);
      setCurrentFrame(0);
    } catch (err) {
      console.error('Forecast fetch error:', err);
      setError('Failed to fetch weather data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (visible && center) {
      fetchForecast(center[0], center[1]);
    }
  }, [visible, center, fetchForecast]);

  // Animation playback
  useEffect(() => {
    if (!isPlaying || !forecast || forecast.list.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % forecast.list.length);
    }, playbackSpeed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, forecast, playbackSpeed]);

  // Update weather markers on map
  useEffect(() => {
    if (!map || !forecast || !visible) return;

    // Clear old markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const currentData = forecast.list[currentFrame];
    if (!currentData) return;

    // Create weather marker element
    const el = document.createElement('div');
    el.className = 'flex flex-col items-center';
    el.innerHTML = `
      <div class="bg-black/70 backdrop-blur-xl rounded-xl px-4 py-3 border border-white/10 text-white min-w-[160px]">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-gray-400">${new Date(currentData.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <span class="text-xs text-gray-400">${new Date(currentData.dt * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="flex items-center gap-3">
          <img src="https://openweathermap.org/img/wn/${currentData.weather[0].icon}@2x.png" 
               alt="${currentData.weather[0].description}"
               class="w-12 h-12" />
          <div>
            <div class="text-2xl font-bold" style="color: ${getTemperatureColor(currentData.main.temp)}">${Math.round(currentData.main.temp)}°C</div>
            <div class="text-xs text-gray-400 capitalize">${currentData.weather[0].description}</div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10">
          <div class="text-center">
            <div class="text-[10px] text-gray-500">💧</div>
            <div class="text-xs font-medium">${Math.round(currentData.pop * 100)}%</div>
          </div>
          <div class="text-center">
            <div class="text-[10px] text-gray-500">💨</div>
            <div class="text-xs font-medium">${Math.round(currentData.wind.speed)}m/s</div>
          </div>
          <div class="text-center">
            <div class="text-[10px] text-gray-500">💧</div>
            <div class="text-xs font-medium">${currentData.main.humidity}%</div>
          </div>
        </div>
      </div>
    `;

    const marker = new mapboxgl.Marker(el, { anchor: 'bottom' })
      .setLngLat([forecast.city.coord.lon, forecast.city.coord.lat])
      .addTo(map);

    markersRef.current.push(marker);

    return () => {
      markersRef.current.forEach(m => m.remove());
    };
  }, [map, forecast, currentFrame, visible]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleFrameChange = useCallback((direction: 'prev' | 'next') => {
    setIsPlaying(false);
    setCurrentFrame(prev => {
      if (direction === 'prev') {
        return prev === 0 ? (forecast?.list.length || 1) - 1 : prev - 1;
      }
      return (prev + 1) % (forecast?.list.length || 1);
    });
  }, [forecast?.list.length]);

  if (!visible) return null;

  const currentData = forecast?.list[currentFrame];
  const progress = forecast ? ((currentFrame + 1) / forecast.list.length) * 100 : 0;

  return (
    <>
      {/* Weather Info Panel */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 min-w-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-white">Loading forecast...</span>
            </div>
          ) : error ? (
            <div className="text-red-400 text-center py-4">{error}</div>
          ) : forecast && currentData ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={`https://openweathermap.org/img/wn/${currentData.weather[0].icon}.png`}
                    alt={currentData.weather[0].description}
                    className="w-10 h-10"
                  />
                  <div>
                    <div className="text-white font-medium">{forecast.city.name}</div>
                    <div className="text-xs text-gray-400">5-Day Forecast (3hr)</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: getTemperatureColor(currentData.main.temp) }}>
                    {Math.round(currentData.main.temp)}°C
                  </div>
                  <div className="text-xs text-gray-400 capitalize">
                    {currentData.weather[0].description}
                  </div>
                </div>
              </div>

              {/* Weather Details Grid */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                  <div className="text-xs text-gray-400">Rain</div>
                  <div className="text-sm font-medium text-white">{Math.round(currentData.pop * 100)}%</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <Wind className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                  <div className="text-xs text-gray-400">Wind</div>
                  <div className="text-sm font-medium text-white">{Math.round(currentData.wind.speed)}m/s</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <Gauge className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                  <div className="text-xs text-gray-400">Pressure</div>
                  <div className="text-sm font-medium text-white">{currentData.main.pressure}hPa</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <Eye className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <div className="text-xs text-gray-400">Visibility</div>
                  <div className="text-sm font-medium text-white">{(currentData.visibility / 1000).toFixed(1)}km</div>
                </div>
              </div>

              {/* Timeline */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>{new Date(forecast.list[0].dt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span className="text-white">
                    {new Date(currentData.dt * 1000).toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>{new Date(forecast.list[forecast.list.length - 1].dt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => handleFrameChange('prev')}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <SkipBack className="w-5 h-5 text-gray-300" />
                </button>

                <button
                  onClick={handlePlayPause}
                  className="p-3 bg-blue-500 hover:bg-blue-400 rounded-xl transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => handleFrameChange('next')}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <SkipForward className="w-5 h-5 text-gray-300" />
                </button>
              </div>

              {/* Speed Controls */}
              <div className="flex items-center justify-center gap-2 mt-3">
                <Clock className="w-3 h-3 text-gray-500" />
                <div className="flex gap-1">
                  {[2000, 1000, 500].map(speed => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                        playbackSpeed === speed 
                          ? "bg-blue-500/20 text-blue-400" 
                          : "text-gray-500 hover:text-gray-300"
                      )}
                    >
                      {speed === 2000 ? '0.5x' : speed === 1000 ? '1x' : '2x'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-gray-400 text-center py-4">No forecast data available</div>
          )}
        </div>
      </div>

      {/* Mini Forecast Strip */}
      {forecast && (
        <div className="absolute bottom-48 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-3 flex gap-2 overflow-x-auto max-w-[600px]">
            {forecast.list.filter((_, i) => i % 2 === 0).slice(0, 10).map((item, idx) => (
              <button
                key={item.dt}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentFrame(idx * 2);
                }}
                className={cn(
                  "flex flex-col items-center p-2 rounded-lg min-w-[60px] transition-colors",
                  currentFrame === idx * 2 
                    ? "bg-blue-500/20 border border-blue-500/30" 
                    : "hover:bg-white/5"
                )}
              >
                <span className="text-[10px] text-gray-400">
                  {new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'narrow' })}
                </span>
                <span className="text-[10px] text-gray-500">
                  {new Date(item.dt * 1000).toLocaleTimeString('en-US', { hour: '2-digit' })}
                </span>
                <img 
                  src={`https://openweathermap.org/img/wn/${item.weather[0].icon}.png`}
                  alt={item.weather[0].description}
                  className="w-8 h-8"
                />
                <span className="text-xs font-medium text-white">{Math.round(item.main.temp)}°</span>
                {item.pop > 0 && (
                  <span className="text-[10px] text-blue-400">{Math.round(item.pop * 100)}%</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default OpenWeatherMapLayer;
