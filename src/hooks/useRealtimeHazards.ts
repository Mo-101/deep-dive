/**
 * Real-time Hazard Data Hook
 * Fetches all hazards every 10 minutes and manages layer state
 */

import { useState, useEffect, useCallback } from 'react';

export interface HazardData {
  cyclones: Array<{
    id: string;
    name: string;
    center: { lat: number; lon: number };
    track: Array<{ lat: number; lon: number; time: string }>;
    maxWind: number;
    category: string;
    updated: string;
  }>;
  floods: Array<{
    id: string;
    polygon: GeoJSON.Polygon;
    area_km2: number;
    detected_date: string;
    source: string;
  }>;
  landslides: Array<{
    id: string;
    location: { lat: number; lon: number };
    risk_level: 'low' | 'medium' | 'high';
    slope_angle: number;
    rainfall_mm: number;
  }>;
  waterlogged: Array<{
    id: string;
    polygon: GeoJSON.Polygon;
    depth_cm: number;
    duration_hours: number;
  }>;
  lastUpdated: string;
}

export interface HazardLayers {
  cyclones: boolean;
  floods: boolean;
  landslides: boolean;
  waterlogged: boolean;
  historical: boolean;
  wind: boolean;
}

const DEFAULT_LAYERS: HazardLayers = {
  cyclones: true,
  floods: true,
  landslides: true,
  waterlogged: true,
  historical: false,
  wind: true,
};

export function useRealtimeHazards() {
  const [hazards, setHazards] = useState<HazardData | null>(null);
  const [activeLayers, setActiveLayers] = useState<HazardLayers>(DEFAULT_LAYERS);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHazards = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to fetch from backend API
      const response = await fetch('/api/v1/hazards/realtime');

      if (response.ok) {
        const data = await response.json();
        setHazards(data);
        setLastUpdated(new Date());
      } else {
        // Fallback: Use demo data if API not available
        console.warn('API not available, using demo data');
        setHazards(generateDemoHazards());
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error fetching hazards:', err);
      setError('Failed to fetch hazard data');
      // Use demo data on error
      setHazards(generateDemoHazards());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and interval
  useEffect(() => {
    fetchHazards();

    // Refresh every 10 minutes
    const interval = setInterval(fetchHazards, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchHazards]);

  // Toggle layer visibility
  const toggleLayer = useCallback((layer: keyof HazardLayers) => {
    setActiveLayers(prev => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  }, []);

  // Set all layers
  const setAllLayers = useCallback((layers: Partial<HazardLayers>) => {
    setActiveLayers(prev => ({
      ...prev,
      ...layers,
    }));
  }, []);

  return {
    hazards,
    activeLayers,
    toggleLayer,
    setAllLayers,
    isLoading,
    lastUpdated,
    error,
    refresh: fetchHazards,
  };
}

// Demo hazard data for testing
function generateDemoHazards(): HazardData {
  const now = new Date().toISOString();

  return {
    cyclones: [
      {
        id: 'cyclone-001',
        name: 'Tropical Storm 01',
        center: { lat: -15.2, lon: 42.5 },
        track: [
          { lat: -14.5, lon: 43.2, time: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
          { lat: -15.2, lon: 42.5, time: now },
          { lat: -16.0, lon: 41.8, time: new Date(Date.now() + 24 * 3600 * 1000).toISOString() },
        ],
        maxWind: 45,
        category: 'TS',
        updated: now,
      },
    ],
    floods: [
      {
        id: 'flood-001',
        polygon: {
          type: 'Polygon',
          coordinates: [[
            [39.2, -19.8],
            [39.4, -19.8],
            [39.4, -20.0],
            [39.2, -20.0],
            [39.2, -19.8],
          ]],
        },
        area_km2: 45.3,
        detected_date: now,
        source: 'Sentinel-1 SAR',
      },
    ],
    landslides: [
      {
        id: 'landslide-001',
        location: { lat: -19.5, lon: 34.2 },
        risk_level: 'high',
        slope_angle: 35,
        rainfall_mm: 180,
      },
    ],
    waterlogged: [
      {
        id: 'water-001',
        polygon: {
          type: 'Polygon',
          coordinates: [[
            [34.8, -19.9],
            [35.0, -19.9],
            [35.0, -20.1],
            [34.8, -20.1],
            [34.8, -19.9],
          ]],
        },
        depth_cm: 25,
        duration_hours: 48,
      },
    ],
    lastUpdated: now,
  };
}

export default useRealtimeHazards;
