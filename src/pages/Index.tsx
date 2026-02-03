import { useState, useCallback, useEffect, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import AfricaMap from '@/components/map/AfricaMap';
import ThreatBar from '@/components/header/ThreatBar';
import CommandSidebar from '@/components/sidebar/CommandSidebar';
import StormDetailPanel from '@/components/panels/StormDetailPanel';
import TimeControls from '@/components/controls/TimeControls';
import { REGIONAL_HUBS, getProbabilityColor, type Hotspot } from '@/types/cyclone';
import { useCycloneTracks, useHotspots, useForecasts } from '@/hooks/useForecastData';

const Index = () => {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedStormId, setSelectedStormId] = useState<string | undefined>();
  const [activeStyle, setActiveStyle] = useState('mapbox://styles/akanimo1/cml5r2sfb000w01sh8rkcajww');
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [currentLeadTime, setCurrentLeadTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Fetch real data from API
  const { data: tracksData, isLoading: tracksLoading } = useCycloneTracks();
  const { data: hotspotsData, isLoading: hotspotsLoading } = useHotspots({ limit: 500 });
  const { data: forecastsData } = useForecasts({ limit: 1 });

  // Transform tracks data for sidebar
  const storms = useMemo(() => {
    if (!tracksData) return [];
    return tracksData.map(track => ({
      id: track.id,
      track_id: track.track_id,
      storm_name: track.storm_name,
      basin: track.basin,
    }));
  }, [tracksData]);

  // Get hotspots for selected storm
  const selectedStormHotspots = useMemo(() => {
    if (!hotspotsData || !selectedStormId) return [];
    return hotspotsData
      .filter(h => h.track_id === selectedStormId)
      .map(h => ({
        ...h,
        disaster_type: h.disaster_type as Hotspot['disaster_type'],
      }));
  }, [hotspotsData, selectedStormId]);

  // Calculate threat levels from hotspots
  const threats = useMemo(() => {
    if (!hotspotsData) return [];

    const regionThreats: Record<string, { maxProb: number; count: number }> = {};

    hotspotsData.forEach(hotspot => {
      const basin = hotspot.cyclone_tracks?.basin;
      if (basin) {
        if (!regionThreats[basin]) {
          regionThreats[basin] = { maxProb: 0, count: 0 };
        }
        regionThreats[basin].maxProb = Math.max(regionThreats[basin].maxProb, hotspot.hurricane_prob || 0);
        regionThreats[basin].count++;
      }
    });

    return Object.entries(regionThreats).map(([region, data]) => ({
      region,
      level: data.maxProb >= 0.8 ? 'severe' as const :
        data.maxProb >= 0.6 ? 'high' as const :
          data.maxProb >= 0.4 ? 'moderate' as const : 'low' as const,
      activeEvents: data.count,
    }));
  }, [hotspotsData]);

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

  // Map update logic removed for simplification

  // Handle map load
  const handleMapLoad = useCallback((mapInstance: mapboxgl.Map) => {
    setMap(mapInstance);
  }, []);

  // Handle storm selection
  const handleStormSelect = useCallback((stormId: string) => {
    setSelectedStormId(stormId);
    setIsDetailPanelOpen(true);

    // Find hotspot for this storm and zoom to it
    if (map && hotspotsData) {
      const hotspot = hotspotsData.find(h => h.track_id === stormId);
      if (hotspot) {
        map.flyTo({
          center: [hotspot.longitude, hotspot.latitude],
          zoom: 5,
          duration: 1500,
        });
      }
    }
  }, [map, hotspotsData]);

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
  const selectedStorm = useMemo(() => {
    if (!selectedStormId || !tracksData) return undefined;
    const track = tracksData.find(t => t.id === selectedStormId);
    if (!track) return undefined;

    return {
      track_id: track.track_id,
      storm_name: track.storm_name,
      basin: track.basin,
      hotspots: selectedStormHotspots,
    };
  }, [selectedStormId, tracksData, selectedStormHotspots]);

  const isLoading = tracksLoading || hotspotsLoading;

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {/* Threat Bar - Top Header */}
      <ThreatBar
        threats={threats}
        currentTime={currentTime}
        onRegionClick={handleRegionClick}
      />

      {/* Main Map */}
      <div className="relative h-[calc(100vh-4rem)]">
        <AfricaMap
          onMapLoad={handleMapLoad}
          activeStyle={activeStyle}
          onStyleChange={setActiveStyle}
        />

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30">
            <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Loading forecast data...</span>
            </div>
          </div>
        )}

        {/* Command Sidebar - Left */}
        <CommandSidebar
          storms={storms}
          selectedStormId={selectedStormId}
          onStormSelect={handleStormSelect}
          onRegionSelect={handleRegionClick}
        />

        {/* Storm Detail Panel - Right */}
        <StormDetailPanel
          isOpen={isDetailPanelOpen}
          onClose={() => setIsDetailPanelOpen(false)}
          storm={selectedStorm}
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
