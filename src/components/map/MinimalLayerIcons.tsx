/**
 * Minimal Layer Icons Panel
 * Smart compact icons with animated states
 * Expands on hover/click with smooth transitions
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wind,
    CloudRain,
    Waves,
    Mountain,
    Droplets,
    History,
    RefreshCw,
    ChevronDown
} from 'lucide-react';
import type { HazardLayers } from '@/hooks/useRealtimeHazards';

interface MinimalLayerIconsProps {
    activeLayers: HazardLayers;
    toggleLayer: (layer: keyof HazardLayers) => void;
    onRefresh: () => void;
    isLoading: boolean;
}

const LAYER_ICONS = [
    { key: 'cyclones', icon: Wind, label: 'Cyclones', color: '#ef4444', activeColor: '#f87171' },
    { key: 'wind', icon: CloudRain, label: 'Wind Flow', color: '#06b6d4', activeColor: '#22d3ee' },
    { key: 'floods', icon: Waves, label: 'Floods', color: '#3b82f6', activeColor: '#60a5fa' },
    { key: 'landslides', icon: Mountain, label: 'Landslides', color: '#f59e0b', activeColor: '#fbbf24' },
    { key: 'waterlogged', icon: Droplets, label: 'Waterlogged', color: '#8b5cf6', activeColor: '#a78bfa' },
    { key: 'historical', icon: History, label: 'Historical', color: '#6b7280', activeColor: '#9ca3af' },
] as const;

export function MinimalLayerIcons({
    activeLayers,
    toggleLayer,
    onRefresh,
    isLoading
}: MinimalLayerIconsProps) {
    const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);

    const handleToggle = useCallback((key: keyof HazardLayers) => {
        toggleLayer(key);
    }, [toggleLayer]);

    return (
        <div className="absolute top-4 right-4 z-50">
            {/* Collapsed: Just icons */}
            <motion.div
                className="flex flex-col gap-1 bg-black/60 backdrop-blur-xl rounded-2xl p-2 border border-white/10"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
            >
                {LAYER_ICONS.map((layer) => {
                    const Icon = layer.icon;
                    const isActive = activeLayers[layer.key as keyof HazardLayers];
                    const isHovered = hoveredLayer === layer.key;

                    return (
                        <motion.button
                            key={layer.key}
                            onClick={() => handleToggle(layer.key as keyof HazardLayers)}
                            onMouseEnter={() => setHoveredLayer(layer.key)}
                            onMouseLeave={() => setHoveredLayer(null)}
                            className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
                            style={{
                                backgroundColor: isActive ? `${layer.color}20` : 'transparent',
                                borderWidth: 1,
                                borderColor: isActive ? layer.color : 'transparent',
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Icon
                                className="w-5 h-5 transition-colors duration-200"
                                style={{ color: isActive ? layer.activeColor : '#6b7280' }}
                            />

                            {/* Animated active indicator */}
                            {isActive && (
                                <motion.div
                                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                                    style={{ backgroundColor: layer.activeColor }}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            )}

                            {/* Tooltip on hover */}
                            <AnimatePresence>
                                {isHovered && (
                                    <motion.div
                                        className="absolute right-full mr-2 px-2 py-1 bg-black/90 rounded-lg whitespace-nowrap"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <span className="text-xs text-white font-medium">{layer.label}</span>
                                        <span className="text-xs text-white/50 ml-1">
                                            {isActive ? 'ON' : 'OFF'}
                                        </span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.button>
                    );
                })}

                {/* Divider */}
                <div className="w-6 h-px bg-white/10 mx-auto my-1" />

                {/* Refresh button */}
                <motion.button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-white/10 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <RefreshCw
                        className={`w-4 h-4 text-white/60 ${isLoading ? 'animate-spin' : ''}`}
                    />
                </motion.button>
            </motion.div>
        </div>
    );
}

export default MinimalLayerIcons;
