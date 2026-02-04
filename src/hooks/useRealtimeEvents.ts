import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export interface RealtimeHotspot {
  id: string;
  latitude: number;
  longitude: number;
  hurricane_prob: number | null;
  wind_speed_kt: number | null;
  lead_time_hours: number;
  disaster_type: string;
  track_id: string | null;
  created_at: string;
}

export interface RealtimeAlert {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  disaster_type: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  created_at: string;
}

export interface RealtimeTrack {
  id: string;
  track_id: string;
  storm_name: string | null;
  basin: string;
  created_at: string;
}

export function useRealtimeEvents() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [recentEvents, setRecentEvents] = useState<Array<{
    type: 'hotspot' | 'alert' | 'track';
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    data: RealtimeHotspot | RealtimeAlert | RealtimeTrack;
    timestamp: Date;
  }>>([]);

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['hotspots'] });
    queryClient.invalidateQueries({ queryKey: ['cyclone-tracks'] });
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
    queryClient.invalidateQueries({ queryKey: ['forecasts'] });
    setLastUpdate(new Date());
  }, [queryClient]);

  useEffect(() => {
    console.log('[Realtime] Setting up event subscriptions...');

    const channel = supabase
      .channel('natural-events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hotspots' },
        (payload) => {
          console.log('[Realtime] Hotspot change:', payload.eventType, payload.new);
          setRecentEvents(prev => [{
            type: 'hotspot',
            action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            data: (payload.new || payload.old) as RealtimeHotspot,
            timestamp: new Date()
          }, ...prev.slice(0, 49)]);
          invalidateQueries();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        (payload) => {
          console.log('[Realtime] Alert change:', payload.eventType, payload.new);
          setRecentEvents(prev => [{
            type: 'alert',
            action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            data: (payload.new || payload.old) as RealtimeAlert,
            timestamp: new Date()
          }, ...prev.slice(0, 49)]);
          invalidateQueries();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cyclone_tracks' },
        (payload) => {
          console.log('[Realtime] Track change:', payload.eventType, payload.new);
          setRecentEvents(prev => [{
            type: 'track',
            action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            data: (payload.new || payload.old) as RealtimeTrack,
            timestamp: new Date()
          }, ...prev.slice(0, 49)]);
          invalidateQueries();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      console.log('[Realtime] Cleaning up subscriptions');
      supabase.removeChannel(channel);
    };
  }, [invalidateQueries]);

  return {
    isConnected,
    lastUpdate,
    recentEvents
  };
}
