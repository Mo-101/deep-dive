/**
 * Weather Animation Controller
 * Unified component for managing all weather animation layers
 * Provides controls for wind particles, cyclone wind fields, floods, and detection
 */

import { useState, useMemo } from 'react';
import { useMap } from '@/hooks/useMap';
import { WindParticleLayer } from './WindParticleLayer';
import { CycloneWindField } from './CycloneWindField';
import { FloodAnimationLayer } from './FloodAnimationLayer';
import { CycloneDetectionLayer, useCycloneDetection } from './CycloneDetectionLayer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Wind, 
  CloudLightning, 
  Waves, 
  Target,
  Play,
  Pause,
  Settings2
} from 'lucide-react';

// Sample wind data generator from FNV3 or ECMWF
function generateSampleWindData(center: { lat: number; lon: number }, radius: number = 5): Array<{
  lat: number;
  lon: number;
  u: number;
  v: number;
}> {
  const data = [];
  const resolution = 20;
  
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const lat = center.lat - radius/2 + (i / resolution) * radius;
      const lon = center.lon - radius/2 + (j / resolution) * radius;
      
      // Simulate cyclonic wind pattern
      const dx = lon - center.lon;
      const dy = lat - center.lat;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < radius / 2) {
        // Tangential winds (counter-clockwise)
        const angle = Math.atan2(dy, dx) + Math.PI / 2;
        const speed = 20 * (1 - dist / (radius / 2)); // Max 20 m/s at center
        
        data.push({
          lat,
          lon,
          u: Math.cos(angle) * speed,
          v: Math.sin(angle) * speed,
        });
      }
    }
  }
  
  return data;
}

interface CycloneData {
  id: string;
  center: { lat: number; lon: number };
  maxWindSpeed: number;
  radius: number;
  pressure: number;
  category: 'TD' | 'TS' | 'CAT1' | 'CAT2' | 'CAT3' | 'CAT4' | 'CAT5';
  movementDirection: number;
  movementSpeed: number;
}

interface FloodZone {
  id: string;
  center: { lat: number; lon: number };
  extent: Array<{ lat: number; lon: number }>;
  severity: 'minor' | 'moderate' | 'major';
  depth: number;
  velocity?: number;
  isExpanding?: boolean;
}

interface WeatherAnimationControllerProps {
  // FNV3 cyclone data
  fnv3Cyclones?: Array<{
    location: { lat: number; lon: number };
    track_probability: number;
    wind_34kt_probability: number;
    wind_50kt_probability: number;
    wind_64kt_probability: number;
    threat_level?: string;
  }>;
  
  // ECMWF or OpenWeatherMap wind data
  windData?: Array<{
    lat: number;
    lon: number;
    u: number;
    v: number;
  }>;
  
  // Flood data
  floodZones?: FloodZone[];
  
  // Class name for styling
  className?: string;
}

export function WeatherAnimationController({
  fnv3Cyclones = [],
  windData,
  floodZones = [],
  className = '',
}: WeatherAnimationControllerProps) {
  const { map } = useMap();
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeLayers, setActiveLayers] = useState({
    windParticles: false,
    cycloneWindField: true,
    floodAnimation: false,
    cycloneDetection: true,
  });
  const [showControls, setShowControls] = useState(true);

  // Generate cyclone data from FNV3
  const cycloneData: CycloneData[] = useMemo(() => {
    console.log('[WeatherAnimationController] Received', fnv3Cyclones.length, 'cyclones from FNV3');
    return fnv3Cyclones.map((c, i) => ({
      id: `cyclone-${i}`,
      center: c.location,
      maxWindSpeed: c.wind_64kt_probability > 0.5 ? 65 : 
                    c.wind_50kt_probability > 0.5 ? 50 :
                    c.wind_34kt_probability > 0.5 ? 35 : 25,
      radius: 300, // km
      pressure: c.track_probability > 0.7 ? 980 : 1000,
      category: c.wind_64kt_probability > 0.5 ? 'CAT3' :
                c.wind_50kt_probability > 0.5 ? 'CAT2' :
                c.wind_34kt_probability > 0.5 ? 'TS' : 'TD',
      movementDirection: Math.random() * 360,
      movementSpeed: 10 + Math.random() * 10,
    }));
  }, [fnv3Cyclones]);

  // Generate wind data if not provided
  const generatedWindData = useMemo(() => {
    if (windData) return windData;
    
    // Generate wind data around cyclones
    return cycloneData.flatMap(cyclone => 
      generateSampleWindData(cyclone.center, 8)
    );
  }, [windData, cycloneData]);

  // Generate potential cyclones from FNV3 data
  const potentialCyclones = useCycloneDetection(fnv3Cyclones);

  // Generate sample flood zones if none provided
  const generatedFloodZones: FloodZone[] = useMemo(() => {
    if (floodZones.length > 0) return floodZones;
    
    return fnv3Cyclones
      .filter(c => c.track_probability > 0.5)
      .map((c, i) => ({
        id: `flood-${i}`,
        center: c.location,
        extent: generateFloodExtent(c.location, 50),
        severity: c.wind_50kt_probability > 0.5 ? 'major' : 
                  c.wind_34kt_probability > 0.5 ? 'moderate' : 'minor',
        depth: c.wind_50kt_probability > 0.5 ? 3.5 : 
               c.wind_34kt_probability > 0.5 ? 1.5 : 0.5,
        velocity: c.wind_34kt_probability * 10,
        isExpanding: c.track_probability > 0.7,
      }));
  }, [floodZones, fnv3Cyclones]);

  return (
    <>
      {/* Animation Layers */}
      {activeLayers.windParticles && (
        <WindParticleLayer
          windData={generatedWindData}
          particleCount={2000}
          speedFactor={0.4}
          isActive={isPlaying}
        />
      )}
      
      {activeLayers.cycloneWindField && cycloneData.length > 0 && (
        <CycloneWindField
          map={map}
          cyclones={cycloneData}
          showWindField={true}
          showEyeWall={true}
          isActive={isPlaying}
        />
      )}
      
      {activeLayers.floodAnimation && generatedFloodZones.length > 0 && (
        <FloodAnimationLayer
          map={map}
          floodZones={generatedFloodZones}
          showFlowLines={true}
          showPulseEffect={true}
          isActive={isPlaying}
        />
      )}
      
      {activeLayers.cycloneDetection && potentialCyclones.length > 0 && (
        <CycloneDetectionLayer
          potentialCyclones={potentialCyclones}
          showEnsembleSpread={true}
          showFormationZones={true}
          isActive={isPlaying}
        />
      )}

      {/* Control Panel */}
      {showControls && (
        <Card className={`absolute top-4 right-4 p-4 bg-black/80 backdrop-blur-md border-white/10 w-72 ${className}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Weather Animations
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white/60 hover:text-white"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
          </div>

          <div className="space-y-3">
            {/* Wind Particles */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-cyan-400" />
                <Label className="text-sm text-white/80 cursor-pointer">
                  Wind Particles
                </Label>
              </div>
              <Switch
                checked={activeLayers.windParticles}
                onCheckedChange={(checked) => 
                  setActiveLayers(prev => ({ ...prev, windParticles: checked }))
                }
              />
            </div>

            {/* Cyclone Wind Field */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CloudLightning className="w-4 h-4 text-orange-400" />
                <Label className="text-sm text-white/80 cursor-pointer">
                  Cyclone Wind Field
                </Label>
              </div>
              <Switch
                checked={activeLayers.cycloneWindField}
                onCheckedChange={(checked) => 
                  setActiveLayers(prev => ({ ...prev, cycloneWindField: checked }))
                }
              />
            </div>

            {/* Flood Animation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Waves className="w-4 h-4 text-blue-400" />
                <Label className="text-sm text-white/80 cursor-pointer">
                  Flood Animation
                </Label>
              </div>
              <Switch
                checked={activeLayers.floodAnimation}
                onCheckedChange={(checked) => 
                  setActiveLayers(prev => ({ ...prev, floodAnimation: checked }))
                }
              />
            </div>

            {/* Cyclone Detection */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-red-400" />
                <Label className="text-sm text-white/80 cursor-pointer">
                  Cyclone Detection
                </Label>
              </div>
              <Switch
                checked={activeLayers.cycloneDetection}
                onCheckedChange={(checked) => 
                  setActiveLayers(prev => ({ ...prev, cycloneDetection: checked }))
                }
              />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-white/50">Active Cyclones</div>
              <div className="text-white font-mono">{cycloneData.length}</div>
              <div className="text-white/50">Flood Zones</div>
              <div className="text-white font-mono">{generatedFloodZones.length}</div>
              <div className="text-white/50">Wind Particles</div>
              <div className="text-white font-mono">
                {activeLayers.windParticles ? '2,000' : '0'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Toggle Controls Button */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border-white/10 text-white hover:bg-black/80"
        onClick={() => setShowControls(!showControls)}
        style={{ right: showControls ? '320px' : '16px' }}
      >
        <Settings2 className="w-4 h-4" />
      </Button>
    </>
  );
}

// Helper function to generate flood extent polygon
function generateFloodExtent(
  center: { lat: number; lon: number },
  radiusKm: number
): Array<{ lat: number; lon: number }> {
  const extent = [];
  const points = 16;
  const R = 6371;
  
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    // Add irregularity to make it look like a real flood
    const irregularity = 0.7 + Math.random() * 0.6;
    const r = radiusKm * irregularity;
    
    const lat = center.lat + (r / R) * (180 / Math.PI) * Math.cos(angle);
    const lon = center.lon + (r / R) * (180 / Math.PI) * Math.sin(angle) / Math.cos(center.lat * Math.PI / 180);
    
    extent.push({ lat, lon });
  }
  
  return extent;
}

export default WeatherAnimationController;
