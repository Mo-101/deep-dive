import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Forecast, CycloneTrack, Hotspot } from '@/types/cyclone';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/forecast-api`;

async function fetchFromAPI<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

// Fetch all forecasts
export function useForecasts(params?: { source?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['forecasts', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.source) queryParams.source = params.source;
      if (params?.limit) queryParams.limit = params.limit.toString();
      if (params?.offset) queryParams.offset = params.offset.toString();

      const result = await fetchFromAPI<{ data: Forecast[]; pagination: { total: number; limit: number; offset: number } }>('/forecasts', queryParams);
      return result;
    },
    staleTime: 30000, // 30 seconds
  });
}

// Fetch single forecast
export function useForecast(id: string | undefined) {
  return useQuery({
    queryKey: ['forecast', id],
    queryFn: () => fetchFromAPI<Forecast>(`/forecasts/${id}`),
    enabled: !!id,
  });
}

// Fetch hotspots for a forecast
export function useForecastHotspots(forecastId: string | undefined, params?: { min_prob?: number; lead_time?: number }) {
  return useQuery({
    queryKey: ['forecast-hotspots', forecastId, params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.min_prob) queryParams.min_prob = params.min_prob.toString();
      if (params?.lead_time !== undefined) queryParams.lead_time = params.lead_time.toString();

      return fetchFromAPI<Hotspot[]>(`/forecasts/${forecastId}/hotspots`, queryParams);
    },
    enabled: !!forecastId,
    staleTime: 30000,
  });
}

// Fetch all cyclone tracks
export function useCycloneTracks(params?: { forecast_id?: string; basin?: string }) {
  return useQuery({
    queryKey: ['cyclone-tracks', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.forecast_id) queryParams.forecast_id = params.forecast_id;
      if (params?.basin) queryParams.basin = params.basin;

      return fetchFromAPI<(CycloneTrack & { forecasts?: { forecast_time: string; model_name: string } })[]>('/tracks', queryParams);
    },
    staleTime: 30000,
  });
}

// Fetch single track with hotspots
export function useCycloneTrack(id: string | undefined) {
  return useQuery({
    queryKey: ['cyclone-track', id],
    queryFn: () => fetchFromAPI<CycloneTrack & { hotspots: Hotspot[] }>(`/tracks/${id}`),
    enabled: !!id,
  });
}

// Query hotspots with filters
export function useHotspots(params?: { min_prob?: number; disaster_type?: string; limit?: number }) {
  return useQuery({
    queryKey: ['hotspots', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.min_prob) queryParams.min_prob = params.min_prob.toString();
      if (params?.disaster_type) queryParams.disaster_type = params.disaster_type;
      if (params?.limit) queryParams.limit = params.limit.toString();

      return fetchFromAPI<(Hotspot & { 
        cyclone_tracks?: { track_id: string; storm_name?: string; basin: string };
        forecasts?: { forecast_time: string; model_name: string };
      })[]>('/hotspots', queryParams);
    },
    staleTime: 30000,
  });
}

// Fetch regions
export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: () => fetchFromAPI<{ id: string; name: string; code: string; region_type: string; center_lat: number; center_lon: number }[]>('/regions'),
    staleTime: 300000, // 5 minutes - regions don't change often
  });
}

// Fetch active alerts
export function useAlerts(params?: { active?: boolean; severity?: string }) {
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params?.active !== undefined) queryParams.active = params.active.toString();
      if (params?.severity) queryParams.severity = params.severity;

      return fetchFromAPI<{
        id: string;
        disaster_type: string;
        severity: string;
        title: string;
        description?: string;
        is_active: boolean;
        created_at: string;
      }[]>('/alerts', queryParams);
    },
    staleTime: 30000,
  });
}

// Ingest new forecast data
export async function ingestForecast(payload: {
  model_name: string;
  source?: string;
  forecast_time: string;
  valid_time: string;
  lead_time_hours?: number;
  metadata?: Record<string, unknown>;
  tracks?: { track_id: string; storm_name?: string; basin: string }[];
  hotspots?: {
    track_id?: string;
    latitude: number;
    longitude: number;
    lead_time_hours?: number;
    hurricane_prob?: number;
    track_prob?: number;
    wind_speed_kt?: number;
    pressure_hpa?: number;
    radius_r8_km?: number;
  }[];
}) {
  const response = await fetch(`${API_BASE}/forecasts`, {
    method: 'POST',
    headers: {
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to ingest forecast');
  }

  return response.json();
}
