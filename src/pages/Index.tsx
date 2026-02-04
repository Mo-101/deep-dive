import { useState, useCallback, useEffect, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import AfricaMap from '@/components/map/AfricaMap';
import { HotspotMarkers } from '@/components/map/HotspotMarkers';
import ThreatBar from '@/components/header/ThreatBar';
import CommandSidebar from '@/components/sidebar/CommandSidebar';
import StormDetailPanel from '@/components/panels/StormDetailPanel';
import TimeControls from '@/components/controls/TimeControls';
import { REGIONAL_HUBS, type Hotspot } from '@/types/cyclone';
import { useCycloneTracks, useHotspots, useForecasts } from '@/hooks/useForecastData';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import { Wifi, WifiOff, Database, Activity } from 'lucide-react';

const Index = () => {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedStormId, setSelectedStormId] = useState<string | undefined>();
  const [activeStyle, setActiveStyle] = useState('mapbox://styles/akanimo1/cml72h8dv002z01qx4a518c8q');
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [currentLeadTime, setCurrentLeadTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Fetch real data from API
  const { data: tracksData, isLoading: tracksLoading } = useCycloneTracks();
  const { data: hotspotsData, isLoading: hotspotsLoading } = useHotspots({ limit: 500 });
  const { data: forecastsData } = useForecasts({ limit: 1 });

  // Realtime subscriptions
  const { isConnected, lastUpdate, recentEvents } = useRealtimeEvents();

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

        {/* DB Hotspot Markers */}
        <HotspotMarkers
          map={map}
          hotspots={hotspotsData || []}
          onHotspotClick={(id) => {
            const hotspot = hotspotsData?.find(h => h.id === id);
            if (hotspot?.track_id) {
              setSelectedStormId(hotspot.track_id);
              setIsDetailPanelOpen(true);
            }
          }}
        />

        {/* Realtime Status Badge */}
        <div className="absolute top-4 left-4 z-30 flex flex-col gap-2">
          <div className="bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-2 border border-white/10">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-white/50" />
            )}
            <span className="text-xs font-medium text-white">
              {isConnected ? 'Live' : 'Connecting...'}
            </span>
            {lastUpdate && (
              <span className="text-xs text-white/60">
                • {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          
          {/* DB Stats */}
          <div className="bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-3 border border-white/10">
            <Database className="w-4 h-4 text-blue-400" />
            <div className="flex gap-3 text-xs">
              <span className="text-white/70">
                <span className="font-bold text-white">{storms.length}</span> tracks
              </span>
              <span className="text-white/70">
                <span className="font-bold text-white">{hotspotsData?.length || 0}</span> hotspots
              </span>
            </div>
          </div>

          {/* Recent Events */}
          {recentEvents.length > 0 && (
            <div className="bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg max-w-xs border border-white/10">
              <div className="text-xs font-medium mb-1 text-white flex items-center gap-1">
                <Activity className="w-3 h-3 text-green-500" />
                Live Events
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {recentEvents.slice(0, 3).map((event, i) => (
                  <div key={i} className="text-xs text-white/70 flex items-center gap-1">
                    <span className={
                      event.action === 'INSERT' ? 'text-green-500' :
                      event.action === 'UPDATE' ? 'text-yellow-500' : 'text-red-500'
                    }>●</span>
                    <span>{event.type}</span>
                    <span className="text-white/40">
                      {event.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30">
            <div className="bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 border border-white/10">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-white/80">Loading forecast data...</span>
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
