/**
 * Precipitation Radar Layer
 * Real-time precipitation tiles using Open-Meteo or similar tile-based sources
 * Supports animated playback of precipitation over time
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { Play, Pause, SkipBack, SkipForward, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrecipitationRadarLayerProps {
  map: mapboxgl.Map | null;
  visible: boolean;
  opacity?: number;
}

interface RadarFrame {
  timestamp: string;
  url: string;
}

// Open-Meteo WMS precipitation layer configuration
const OPEN_METEO_WMS = {
  baseUrl: 'https://openmeteomedia.blob.core.windows.net/images/open-meteo.com',
  // Alternative: Use tile-based approach
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', // Placeholder
};

// Simulated precipitation data for demonstration
// In production, this would fetch from Open-Meteo, NOAA NEXRAD, or similar
const generateSimulatedRadarFrames = (): RadarFrame[] => {
  const frames: RadarFrame[] = [];
  const now = new Date();
  
  for (let i = -12; i <= 0; i++) {
    const time = new Date(now.getTime() + i * 30 * 60 * 1000); // 30 min intervals
    frames.push({
      timestamp: time.toISOString(),
      url: `data:image/svg+xml,${encodeURIComponent(generateRadarSVG(i))}`
    });
  }
  
  return frames;
};

// Generate SVG radar image (simulated)
const generateRadarSVG = (frameIndex: number): string => {
  const intensity = Math.max(0, 1 - Math.abs(frameIndex + 6) / 6);
  
  return `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="radar" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(255,69,0,${intensity * 0.8})" />
        <stop offset="30%" stop-color="rgba(255,215,0,${intensity * 0.6})" />
        <stop offset="60%" stop-color="rgba(100,149,237,${intensity * 0.4})" />
        <stop offset="100%" stop-color="rgba(0,0,0,0)" />
      </radialGradient>
    </defs>
    <rect width="256" height="256" fill="transparent"/>
    <circle cx="128" cy="128" r="100" fill="url(#radar)" />
    ${frameIndex % 2 === 0 ? '<circle cx="80" cy="100" r="30" fill="rgba(255,0,0,0.3)" />' : ''}
    ${frameIndex % 3 === 0 ? '<circle cx="180" cy="150" r="40" fill="rgba(255,140,0,0.4)" />' : ''}
  </svg>`;
};

export const PrecipitationRadarLayer = ({
  map,
  visible,
  opacity = 0.6
}: PrecipitationRadarLayerProps) => {
  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(500); // ms per frame
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasLayerRef = useRef<mapboxgl.CanvasSource | null>(null);

  // Initialize radar data
  useEffect(() => {
    if (!visible) return;
    
    // In production: Fetch from Open-Meteo or NOAA NEXRAD API
    // const fetchRadarData = async () => {
    //   const response = await fetch('https://api.open-meteo.com/v1/radar?...');
    //   const data = await response.json();
    //   setFrames(data.frames);
    // };
    
    // Simulated data for demo
    setFrames(generateSimulatedRadarFrames());
  }, [visible]);

  // Setup canvas layer on map
  useEffect(() => {
    if (!map || !visible) return;

    // Add image source for radar overlay (using 'image' type instead of 'canvas')
    if (!map.getSource('radar-image')) {
      // Create a canvas and get its data URL
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw initial transparent frame
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, 512, 512);
      }
      
      map.addSource('radar-image', {
        type: 'image',
        url: canvas.toDataURL(),
        coordinates: [
          [-20, 40], // NW
          [60, 40],  // NE
          [60, -40], // SE
          [-20, -40] // SW
        ]
      });

      map.addLayer({
        id: 'radar-layer',
        type: 'raster',
        source: 'radar-image',
        paint: {
          'raster-opacity': opacity,
          'raster-fade-duration': 0
        }
      });

      canvasLayerRef.current = map.getSource('radar-image') as any;
    }

    return () => {
      if (map.getLayer('radar-layer')) map.removeLayer('radar-layer');
      if (map.getSource('radar-image')) map.removeSource('radar-image');
    };
  }, [map, visible, opacity]);

  // Animation playback
  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, playbackSpeed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, frames.length, playbackSpeed]);

  // Update canvas when frame changes
  useEffect(() => {
    if (!canvasLayerRef.current || frames.length === 0) return;
    
    // In production: Draw actual radar image to canvas
    // const canvas = canvasLayerRef.current.getCanvas();
    // const ctx = canvas.getContext('2d');
    // const img = new Image();
    // img.src = frames[currentFrame].url;
    // img.onload = () => ctx.drawImage(img, 0, 0);
  }, [currentFrame, frames]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleFrameChange = useCallback((direction: 'prev' | 'next') => {
    setIsPlaying(false);
    setCurrentFrame(prev => {
      if (direction === 'prev') {
        return prev === 0 ? frames.length - 1 : prev - 1;
      }
      return (prev + 1) % frames.length;
    });
  }, [frames.length]);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, []);

  if (!visible) return null;

  const currentTime = frames[currentFrame]?.timestamp 
    ? new Date(frames[currentFrame].timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    : '--:--';

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm font-medium text-white">Precipitation Radar</span>
          </div>
          <span className="text-sm font-mono text-blue-400">{currentTime}</span>
        </div>

        {/* Timeline */}
        <div className="w-80 mb-4">
          <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="absolute h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${((currentFrame + 1) / frames.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-slate-500">
            <span>-6h</span>
            <span>-3h</span>
            <span>Now</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => handleFrameChange('prev')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <SkipBack className="w-5 h-5 text-slate-300" />
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
            <SkipForward className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <Settings2 className="w-3 h-3 text-slate-500" />
          <div className="flex gap-1">
            {[1000, 500, 250].map(speed => (
              <button
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                  playbackSpeed === speed 
                    ? "bg-blue-500/20 text-blue-400" 
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {speed === 1000 ? '1x' : speed === 500 ? '2x' : '4x'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Heavy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <span>Moderate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Light</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrecipitationRadarLayer;
