/**
 * Hazard Bubble Markers
 * Google WeatherLab-inspired circular bubbles showing:
 * - Wind speed range rings
 * - Hazard type indicators
 * - Animated probability circles
 * - Click to expand details
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, Droplets, Mountain, CloudRain, X } from 'lucide-react';

interface HazardPoint {
    id: string;
    type: 'cyclone' | 'flood' | 'landslide' | 'rainfall';
    location: { lat: number; lon: number };
    data: {
        windSpeed?: number;      // m/s
        windDirection?: number;  // degrees
        rainfall?: number;       // mm
        slope?: number;          // degrees
        probability?: number;    // 0-1
        category?: string;
        label?: string;
    };
}

interface HazardBubbleMarkersProps {
    map: mapboxgl.Map | null;
    hazards: HazardPoint[];
    visible?: boolean;
}

// Wind speed category colors (Beaufort scale inspired)
const WIND_CATEGORIES = [
    { min: 0, max: 5, label: 'Light', color: '#94a3b8', ring: 'rgba(148, 163, 184, 0.3)' },
    { min: 5, max: 10, label: 'Moderate', color: '#22d3ee', ring: 'rgba(34, 211, 238, 0.3)' },
    { min: 10, max: 15, label: 'Fresh', color: '#22c55e', ring: 'rgba(34, 197, 94, 0.3)' },
    { min: 15, max: 20, label: 'Strong', color: '#facc15', ring: 'rgba(250, 204, 21, 0.3)' },
    { min: 20, max: 25, label: 'Gale', color: '#f97316', ring: 'rgba(249, 115, 22, 0.3)' },
    { min: 25, max: 33, label: 'Storm', color: '#ef4444', ring: 'rgba(239, 68, 68, 0.3)' },
    { min: 33, max: 100, label: 'Hurricane', color: '#a855f7', ring: 'rgba(168, 85, 247, 0.3)' },
];

const getWindCategory = (speed: number) => {
    return WIND_CATEGORIES.find(c => speed >= c.min && speed < c.max) || WIND_CATEGORIES[0];
};

const HAZARD_ICONS = {
    cyclone: Wind,
    flood: Droplets,
    landslide: Mountain,
    rainfall: CloudRain,
};

const HAZARD_COLORS = {
    cyclone: '#ef4444',
    flood: '#3b82f6',
    landslide: '#f59e0b',
    rainfall: '#22d3ee',
};

export function HazardBubbleMarkers({
    map,
    hazards,
    visible = true
}: HazardBubbleMarkersProps) {
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const [selectedHazard, setSelectedHazard] = useState<HazardPoint | null>(null);
    const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);

    // Create bubble marker element
    const createBubbleElement = useCallback((hazard: HazardPoint) => {
        const container = document.createElement('div');
        container.className = 'hazard-bubble-container';

        const windCategory = hazard.data.windSpeed
            ? getWindCategory(hazard.data.windSpeed)
            : null;

        const baseColor = HAZARD_COLORS[hazard.type];
        const size = 48 + (hazard.data.probability || 0.5) * 24; // Size based on probability

        container.innerHTML = `
      <div class="hazard-bubble" style="width: ${size}px; height: ${size}px;">
        <!-- Outer probability ring -->
        <div class="bubble-ring outer" style="
          border-color: ${baseColor}40;
          animation-duration: ${3 - (hazard.data.probability || 0.5) * 1.5}s;
        "></div>
        
        <!-- Wind speed rings (if applicable) -->
        ${windCategory ? `
          <div class="bubble-ring wind-ring" style="
            width: ${size * 0.75}px;
            height: ${size * 0.75}px;
            border-color: ${windCategory.color};
            background: ${windCategory.ring};
          "></div>
        ` : ''}
        
        <!-- Core circle -->
        <div class="bubble-core" style="background: ${baseColor};">
          <div class="bubble-icon">
            ${hazard.type === 'cyclone' ? '🌀' :
                hazard.type === 'flood' ? '🌊' :
                    hazard.type === 'landslide' ? '⛰️' : '🌧️'}
          </div>
        </div>
        
        <!-- Data label -->
        <div class="bubble-label" style="border-color: ${baseColor}33;">
          ${hazard.data.windSpeed ? `${Math.round(hazard.data.windSpeed)} m/s` : ''}
          ${hazard.data.rainfall ? `${hazard.data.rainfall}mm` : ''}
          ${hazard.data.slope ? `${hazard.data.slope}°` : ''}
        </div>
        
        <!-- Wind direction arrow -->
        ${hazard.data.windDirection ? `
          <div class="wind-arrow" style="transform: rotate(${hazard.data.windDirection}deg);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${windCategory?.color || baseColor}" stroke-width="2">
              <path d="M12 2v20M12 2l-7 7M12 2l7 7"/>
            </svg>
          </div>
        ` : ''}
      </div>
    `;

        // Click handler
        container.addEventListener('click', () => {
            setSelectedHazard(hazard);
            if (map) {
                const point = map.project([hazard.location.lon, hazard.location.lat]);
                setPopupPosition({ x: point.x, y: point.y });
            }
        });

        return container;
    }, [map]);

    // Update markers
    useEffect(() => {
        if (!map || !visible) {
            // Remove all markers
            markersRef.current.forEach(m => m.remove());
            markersRef.current = [];
            return;
        }

        // Clear existing markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        // Create new markers
        hazards.forEach(hazard => {
            const el = createBubbleElement(hazard);
            const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
                .setLngLat([hazard.location.lon, hazard.location.lat])
                .addTo(map);

            markersRef.current.push(marker);
        });

        return () => {
            markersRef.current.forEach(m => m.remove());
            markersRef.current = [];
        };
    }, [map, hazards, visible, createBubbleElement]);

    return (
        <>
            {/* Detail Popup */}
            <AnimatePresence>
                {selectedHazard && popupPosition && (
                    <motion.div
                        className="absolute z-[100] pointer-events-auto"
                        style={{
                            left: popupPosition.x,
                            top: popupPosition.y,
                            transform: 'translate(-50%, -120%)'
                        }}
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="bg-black/90 backdrop-blur-xl rounded-xl border border-white/20 p-4 min-w-[200px] shadow-2xl">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${HAZARD_COLORS[selectedHazard.type]}20` }}
                                    >
                                        {(() => {
                                            const Icon = HAZARD_ICONS[selectedHazard.type];
                                            return <Icon className="w-4 h-4" style={{ color: HAZARD_COLORS[selectedHazard.type] }} />;
                                        })()}
                                    </div>
                                    <span className="text-white font-semibold capitalize">
                                        {selectedHazard.type}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setSelectedHazard(null)}
                                    className="text-white/50 hover:text-white transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Location */}
                            <div className="text-xs text-white/50 mb-3">
                                📍 {Math.abs(selectedHazard.location.lat).toFixed(1)}°{selectedHazard.location.lat > 0 ? 'N' : 'S'},
                                {Math.abs(selectedHazard.location.lon).toFixed(1)}°{selectedHazard.location.lon > 0 ? 'E' : 'W'}
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-2 gap-2">
                                {selectedHazard.data.windSpeed && (
                                    <div className="bg-white/5 rounded-lg p-2">
                                        <div className="text-xs text-white/50">Wind Speed</div>
                                        <div className="text-lg font-bold text-cyan-400">
                                            {Math.round(selectedHazard.data.windSpeed)} m/s
                                        </div>
                                        <div className="text-xs" style={{ color: getWindCategory(selectedHazard.data.windSpeed).color }}>
                                            {getWindCategory(selectedHazard.data.windSpeed).label}
                                        </div>
                                    </div>
                                )}

                                {selectedHazard.data.windDirection !== undefined && (
                                    <div className="bg-white/5 rounded-lg p-2">
                                        <div className="text-xs text-white/50">Direction</div>
                                        <div className="text-lg font-bold text-white">
                                            {selectedHazard.data.windDirection}°
                                        </div>
                                        <div className="text-xs text-white/40">
                                            {selectedHazard.data.windDirection >= 315 || selectedHazard.data.windDirection < 45 ? 'N' :
                                                selectedHazard.data.windDirection >= 45 && selectedHazard.data.windDirection < 135 ? 'E' :
                                                    selectedHazard.data.windDirection >= 135 && selectedHazard.data.windDirection < 225 ? 'S' : 'W'}
                                        </div>
                                    </div>
                                )}

                                {selectedHazard.data.rainfall && (
                                    <div className="bg-white/5 rounded-lg p-2">
                                        <div className="text-xs text-white/50">Rainfall</div>
                                        <div className="text-lg font-bold text-blue-400">
                                            {selectedHazard.data.rainfall} mm
                                        </div>
                                    </div>
                                )}

                                {selectedHazard.data.slope && (
                                    <div className="bg-white/5 rounded-lg p-2">
                                        <div className="text-xs text-white/50">Slope</div>
                                        <div className="text-lg font-bold text-orange-400">
                                            {selectedHazard.data.slope}°
                                        </div>
                                    </div>
                                )}

                                {selectedHazard.data.probability && (
                                    <div className="bg-white/5 rounded-lg p-2 col-span-2">
                                        <div className="text-xs text-white/50">Probability</div>
                                        <div className="mt-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${selectedHazard.data.probability * 100}%`,
                                                    background: `linear-gradient(to right, #22c55e, #facc15, #ef4444)`
                                                }}
                                            />
                                        </div>
                                        <div className="text-right text-xs text-white/60 mt-1">
                                            {Math.round(selectedHazard.data.probability * 100)}%
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bubble Styles */}
            <style>{`
        .hazard-bubble-container {
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        
        .hazard-bubble-container:hover {
          transform: scale(1.1);
        }
        
        .hazard-bubble {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .bubble-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid;
          animation: pulse-ring 2s ease-out infinite;
        }
        
        .bubble-ring.outer {
          animation: pulse-ring 2s ease-out infinite;
        }
        
        .bubble-ring.wind-ring {
          animation: rotate-ring 4s linear infinite;
          border-style: dashed;
        }
        
        .bubble-core {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          z-index: 2;
        }
        
        .bubble-icon {
          font-size: 14px;
        }
        
        .bubble-label {
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(8px);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          color: white;
          white-space: nowrap;
          border: 1px solid;
        }
        
        .wind-arrow {
          position: absolute;
          top: -16px;
          left: 50%;
          transform-origin: bottom center;
        }
        
        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        
        @keyframes rotate-ring {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
        </>
    );
}

export default HazardBubbleMarkers;
