import { useState, useCallback, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import AfricaMap from '@/components/map/AfricaMap';
import ThreatBar from '@/components/header/ThreatBar';
import CommandSidebar from '@/components/sidebar/CommandSidebar';
import StormDetailPanel from '@/components/panels/StormDetailPanel';
import TimeControls from '@/components/controls/TimeControls';
import { REGIONAL_HUBS, getProbabilityColor, type Hotspot } from '@/types/cyclone';

// Demo data - these will be replaced with real data from Supabase
const DEMO_STORMS = [
  { id: '1', track_id: 'IO192026', storm_name: 'Cyclone Alpha', basin: 'IO' },
  { id: '2', track_id: 'SH982026', basin: 'SH' },
  { id: '3', track_id: 'SH992026', basin: 'SH' },
];

const DEMO_HOTSPOTS: Hotspot[] = [
  {
    id: '1',
    forecast_id: 'f1',
    track_id: '1',
    disaster_type: 'cyclone',
    latitude: -15.5,
    longitude: 55.2,
    lead_time_hours: 0,
    hurricane_prob: 0.85,
    track_prob: 0.92,
    wind_speed_kt: 95,
    wind_speed_ms: 48.9,
    pressure_hpa: 965,
    radius_r8_km: 280,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    forecast_id: 'f1',
    track_id: '1',
    disaster_type: 'cyclone',
    latitude: -17.2,
    longitude: 52.8,
    lead_time_hours: 24,
    hurricane_prob: 0.78,
    track_prob: 0.88,
    wind_speed_kt: 105,
    wind_speed_ms: 54.0,
    pressure_hpa: 955,
    radius_r8_km: 320,
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    forecast_id: 'f1',
    track_id: '1',
    disaster_type: 'cyclone',
    latitude: -19.8,
    longitude: 48.5,
    lead_time_hours: 48,
    hurricane_prob: 0.65,
    track_prob: 0.82,
    wind_speed_kt: 85,
    wind_speed_ms: 43.7,
    pressure_hpa: 975,
    radius_r8_km: 250,
    created_at: new Date().toISOString(),
  },
  {
    id: '4',
    forecast_id: 'f1',
    track_id: '2',
    disaster_type: 'cyclone',
    latitude: -22.5,
    longitude: 42.0,
    lead_time_hours: 0,
    hurricane_prob: 0.45,
    track_prob: 0.72,
    wind_speed_kt: 55,
    wind_speed_ms: 28.3,
    pressure_hpa: 995,
    radius_r8_km: 180,
    created_at: new Date().toISOString(),
  },
  {
    id: '5',
    forecast_id: 'f1',
    track_id: '3',
    disaster_type: 'cyclone',
    latitude: -28.0,
    longitude: 35.5,
    lead_time_hours: 0,
    hurricane_prob: 0.25,
    track_prob: 0.55,
    wind_speed_kt: 35,
    wind_speed_ms: 18.0,
    pressure_hpa: 1005,
    radius_r8_km: 120,
    created_at: new Date().toISOString(),
  },
];

const DEMO_THREATS = [
  { region: 'IO', level: 'severe' as const, activeEvents: 1 },
  { region: 'SADC', level: 'moderate' as const, activeEvents: 2 },
];

const Index = () => {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedStormId, setSelectedStormId] = useState<string | undefined>();
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [currentLeadTime, setCurrentLeadTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Animation playback
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentLeadTime((prev) => {
        if (prev >= 240) {
          setIsPlaying(false);
          return 240;
        }
        return prev + 6;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Handle map load
  const handleMapLoad = useCallback((mapInstance: mapboxgl.Map) => {
    setMap(mapInstance);

    // Add demo hotspots to the map
    const hotspotsGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: DEMO_HOTSPOTS.filter(h => h.lead_time_hours === 0).map((hotspot) => ({
        type: 'Feature',
        properties: {
          id: hotspot.id,
          track_id: hotspot.track_id,
          hurricane_prob: hotspot.hurricane_prob,
          track_prob: hotspot.track_prob,
          color: getProbabilityColor(hotspot.hurricane_prob || 0),
        },
        geometry: {
          type: 'Point',
          coordinates: [hotspot.longitude, hotspot.latitude],
        },
      })),
    };

    // Add track lines
    const tracksGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            track_id: 'IO192026',
            color: getProbabilityColor(0.85),
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [55.2, -15.5],
              [52.8, -17.2],
              [48.5, -19.8],
            ],
          },
        },
      ],
    };

    const hotspotsSource = mapInstance.getSource('hotspots') as mapboxgl.GeoJSONSource;
    const tracksSource = mapInstance.getSource('tracks') as mapboxgl.GeoJSONSource;
    
    if (hotspotsSource) {
      hotspotsSource.setData(hotspotsGeoJSON);
    }
    if (tracksSource) {
      tracksSource.setData(tracksGeoJSON);
    }
  }, []);

  // Handle storm selection
  const handleStormSelect = useCallback((stormId: string) => {
    setSelectedStormId(stormId);
    setIsDetailPanelOpen(true);

    // Zoom to storm location
    const storm = DEMO_STORMS.find(s => s.id === stormId);
    const hotspot = DEMO_HOTSPOTS.find(h => h.track_id === stormId);
    
    if (map && hotspot) {
      map.flyTo({
        center: [hotspot.longitude, hotspot.latitude],
        zoom: 5,
        duration: 1500,
      });
    }
  }, [map]);

  // Handle region click
  const handleRegionClick = useCallback((regionCode: string) => {
    const hub = REGIONAL_HUBS.find(h => h.code === regionCode);
    if (map && hub) {
      map.flyTo({
        center: [hub.center[1], hub.center[0]],
        zoom: 4,
        duration: 1500,
      });
    }
  }, [map]);

  // Get selected storm details
  const selectedStorm = selectedStormId 
    ? {
        ...DEMO_STORMS.find(s => s.id === selectedStormId),
        hotspots: DEMO_HOTSPOTS.filter(h => h.track_id === selectedStormId),
      }
    : undefined;

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {/* Threat Bar - Top Header */}
      <ThreatBar
        threats={DEMO_THREATS}
        currentTime={currentTime}
        onRegionClick={handleRegionClick}
      />

      {/* Main Map */}
      <div className="relative h-[calc(100vh-4rem)]">
        <AfricaMap
          onMapLoad={handleMapLoad}
          onHotspotClick={(id) => {
            const hotspot = DEMO_HOTSPOTS.find(h => h.id === id);
            if (hotspot?.track_id) {
              handleStormSelect(hotspot.track_id);
            }
          }}
        />

        {/* Command Sidebar - Left */}
        <CommandSidebar
          storms={DEMO_STORMS}
          selectedStormId={selectedStormId}
          onStormSelect={handleStormSelect}
          onRegionSelect={handleRegionClick}
        />

        {/* Storm Detail Panel - Right */}
        <StormDetailPanel
          isOpen={isDetailPanelOpen}
          onClose={() => setIsDetailPanelOpen(false)}
          storm={selectedStorm as any}
        />

        {/* Time Controls - Bottom Center */}
        <TimeControls
          currentLeadTime={currentLeadTime}
          maxLeadTime={240}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          onLeadTimeChange={setCurrentLeadTime}
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onSpeedChange={setPlaybackSpeed}
          onStepForward={() => setCurrentLeadTime(prev => Math.min(prev + 6, 240))}
          onStepBack={() => setCurrentLeadTime(prev => Math.max(prev - 6, 0))}
        />
      </div>
    </div>
  );
};

export default Index;
