/**
 * Animated Weather Layer Component
 * Real-time precipitation, temperature, and wind visualization
 * Uses Open-Meteo API (free, no API key required)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { Loader2, CloudRain, Thermometer, Wind, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherData {
  time: string[];
  temperature2m: number[];
  precipitation: number[];
  rain: number[];
  showers: number[];
  snowfall: number[];
  cloudCover: number[];
  windSpeed10m: number[];
  windDirection10m: number[];
}

interface AnimatedWeatherLayerProps {
  map: mapboxgl.Map | null;
  visible: boolean;
  animationSpeed?: number; // frames per second
  showPrecipitation?: boolean;
  showTemperature?: boolean;
  showWind?: boolean;
}

// Open-Meteo API client
const fetchWeatherData = async (
  lat: number,
  lon: number,
  hours: number = 48
): Promise<WeatherData | null> => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,rain,showers,snowfall,cloud_cover,wind_speed_10m,wind_direction_10m&forecast_days=2`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather fetch failed');
    
    const data = await response.json();
    
    return {
      time: data.hourly.time.slice(0, hours),
      temperature2m: data.hourly.temperature_2m.slice(0, hours),
      precipitation: data.hourly.precipitation.slice(0, hours),
      rain: data.hourly.rain.slice(0, hours),
      showers: data.hourly.showers.slice(0, hours),
      snowfall: data.hourly.snowfall.slice(0, hours),
      cloudCover: data.hourly.cloud_cover.slice(0, hours),
      windSpeed10m: data.hourly.wind_speed_10m.slice(0, hours),
      windDirection10m: data.hourly.wind_direction_10m.slice(0, hours),
    };
  } catch (e) {
    console.error('Weather data fetch error:', e);
    return null;
  }
};

// Generate precipitation color based on intensity
const getPrecipitationColor = (mm: number): string => {
  if (mm === 0) return 'rgba(0, 0, 0, 0)';
  if (mm < 0.5) return 'rgba(173, 216, 230, 0.3)'; // Light blue
  if (mm < 2) return 'rgba(100, 149, 237, 0.5)'; // Cornflower blue
  if (mm < 5) return 'rgba(65, 105, 225, 0.6)'; // Royal blue
  if (mm < 10) return 'rgba(255, 215, 0, 0.7)'; // Gold (heavy)
  return 'rgba(255, 69, 0, 0.8)'; // Red-orange (extreme)
};

// Generate temperature color
const getTemperatureColor = (temp: number): string => {
  if (temp < -10) return 'rgba(128, 0, 128, 0.6)'; // Purple (extreme cold)
  if (temp < 0) return 'rgba(0, 0, 255, 0.5)'; // Blue (cold)
  if (temp < 10) return 'rgba(0, 191, 255, 0.4)'; // Deep sky blue (cool)
  if (temp < 20) return 'rgba(0, 255, 127, 0.4)'; // Spring green (mild)
  if (temp < 30) return 'rgba(255, 215, 0, 0.5)'; // Gold (warm)
  if (temp < 35) return 'rgba(255, 140, 0, 0.6)'; // Dark orange (hot)
  return 'rgba(255, 0, 0, 0.7)'; // Red (extreme heat)
};

export const AnimatedWeatherLayer = ({
  map,
  visible,
  animationSpeed = 2,
  showPrecipitation = true,
  showTemperature = true,
  showWind = false
}: AnimatedWeatherLayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const weatherDataRef = useRef<WeatherData | null>(null);
  const currentFrameRef = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Initialize weather canvas overlay
  useEffect(() => {
    if (!map || !visible) return;

    // Create canvas overlay
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 pointer-events-none';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasRef.current = canvas;

    // Add to map container
    const mapCanvas = map.getCanvas();
    mapCanvas.parentElement?.appendChild(canvas);

    // Load initial data for Africa center
    loadWeatherData(0, 25); // Center of Africa

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      canvas.remove();
    };
  }, [map, visible]);

  const loadWeatherData = async (lat: number, lon: number) => {
    setIsLoading(true);
    const data = await fetchWeatherData(lat, lon);
    weatherDataRef.current = data;
    setIsLoading(false);
    
    if (data) {
      startAnimation();
    }
  };

  const drawWeatherFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const map = canvas?.parentElement?.querySelector('.mapboxgl-canvas') as HTMLCanvasElement;
    const weatherData = weatherDataRef.current;
    
    if (!canvas || !map || !weatherData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas size to map
    canvas.width = map.width;
    canvas.height = map.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const frame = currentFrameRef.current % weatherData.time.length;
    const precip = weatherData.precipitation[frame];
    const temp = weatherData.temperature2m[frame];
    const windSpeed = weatherData.windSpeed10m[frame];
    const windDir = weatherData.windDirection10m[frame];

    // Update current time display
    setCurrentTime(weatherData.time[frame]);

    // Draw precipitation overlay
    if (showPrecipitation && precip > 0) {
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
      );
      gradient.addColorStop(0, getPrecipitationColor(precip));
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw precipitation particles
      drawPrecipitationParticles(ctx, canvas.width, canvas.height, precip);
    }

    // Draw temperature overlay
    if (showTemperature) {
      ctx.fillStyle = getTemperatureColor(temp);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Draw wind indicators
    if (showWind && windSpeed > 5) {
      drawWindArrows(ctx, canvas.width, canvas.height, windSpeed, windDir);
    }
  }, [showPrecipitation, showTemperature, showWind]);

  const drawPrecipitationParticles = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number
  ) => {
    const particleCount = Math.floor(intensity * 50); // More particles for heavier rain
    
    ctx.strokeStyle = 'rgba(173, 216, 230, 0.6)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const length = 5 + Math.random() * 10;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y + length); // Slanted rain
      ctx.stroke();
    }
  };

  const drawWindArrows = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    speed: number,
    direction: number
  ) => {
    const arrowCount = 20;
    const rad = (direction * Math.PI) / 180;
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.8, speed / 30)})`;
    ctx.lineWidth = 2;
    
    for (let i = 0; i < arrowCount; i++) {
      const x = (width / arrowCount) * i + width / (arrowCount * 2);
      const y = height / 2 + Math.sin(i * 0.5 + Date.now() / 1000) * 50;
      
      const arrowLength = 20 + speed;
      const endX = x + Math.cos(rad) * arrowLength;
      const endY = y + Math.sin(rad) * arrowLength;
      
      // Draw arrow line
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      
      // Draw arrow head
      const headLength = 8;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(rad - Math.PI / 6),
        endY - headLength * Math.sin(rad - Math.PI / 6)
      );
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(rad + Math.PI / 6),
        endY - headLength * Math.sin(rad + Math.PI / 6)
      );
      ctx.stroke();
    }
  };

  const startAnimation = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    let lastTime = 0;
    const frameInterval = 1000 / animationSpeed; // ms between frames

    const animate = (currentTime: number) => {
      if (currentTime - lastTime >= frameInterval) {
        drawWeatherFrame();
        currentFrameRef.current++;
        lastTime = currentTime;
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  if (!visible) return null;

  return (
    <div className="absolute bottom-6 left-6 z-10">
      {/* Weather Animation Controls */}
      <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          ) : (
            <CloudRain className="w-5 h-5 text-blue-400" />
          )}
          <span className="text-sm font-medium text-white">Live Weather</span>
          <span className="text-xs text-slate-400">
            {currentTime && new Date(currentTime).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>

        {/* Layer Toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => {}}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              showPrecipitation 
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" 
                : "bg-white/5 text-slate-400 border border-white/10"
            )}
          >
            <Droplets className="w-3.5 h-3.5" />
            Rain
          </button>
          
          <button
            onClick={() => {}}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              showTemperature 
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" 
                : "bg-white/5 text-slate-400 border border-white/10"
            )}
          >
            <Thermometer className="w-3.5 h-3.5" />
            Temp
          </button>
          
          <button
            onClick={() => {}}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              showWind 
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                : "bg-white/5 text-slate-400 border border-white/10"
            )}
          >
            <Wind className="w-3.5 h-3.5" />
            Wind
          </button>
        </div>

        <div className="mt-3 text-[10px] text-slate-500">
          Source: Open-Meteo API
        </div>
      </div>
    </div>
  );
};

export default AnimatedWeatherLayer;
