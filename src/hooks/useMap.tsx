/**
 * Map Context and Hook
 * Provides access to the Mapbox map instance throughout the component tree
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import mapboxgl from 'mapbox-gl';

interface MapContextType {
  map: mapboxgl.Map | null;
  setMap: (map: mapboxgl.Map | null) => void;
}

const MapContext = createContext<MapContextType | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMapState] = useState<mapboxgl.Map | null>(null);

  const setMap = useCallback((newMap: mapboxgl.Map | null) => {
    setMapState(newMap);
  }, []);

  return (
    <MapContext.Provider value={{ map, setMap }}>
      {children}
    </MapContext.Provider>
  );
}

export function useMap() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap must be used within a MapProvider');
  }
  return context;
}

export default useMap;
