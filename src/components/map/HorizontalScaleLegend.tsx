/**
 * Horizontal Scale Legend
 * Compact wind and temperature scales
 * Positioned at bottom-left, minimal footprint
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, Thermometer, ChevronRight, ChevronLeft } from 'lucide-react';

interface HorizontalScaleLegendProps {
    showWind?: boolean;
    showTemp?: boolean;
}

// Wind speed scale (m/s)
const WIND_SCALE = [
    { speed: 0, label: 'Calm', color: '#94a3b8' },
    { speed: 5, label: 'Light', color: '#5eead4' },
    { speed: 10, label: 'Moderate', color: '#22c55e' },
    { speed: 15, label: 'Fresh', color: '#facc15' },
    { speed: 20, label: 'Strong', color: '#fb923c' },
    { speed: 25, label: 'Gale', color: '#ef4444' },
    { speed: 30, label: 'Storm', color: '#dc2626' },
    { speed: 40, label: 'Hurricane', color: '#a855f7' },
];

// Temperature scale (°C)
const TEMP_SCALE = [
    { temp: -10, color: '#1e3a8a' },
    { temp: 0, color: '#3b82f6' },
    { temp: 10, color: '#22d3ee' },
    { temp: 20, color: '#22c55e' },
    { temp: 30, color: '#facc15' },
    { temp: 40, color: '#f97316' },
    { temp: 50, color: '#dc2626' },
];

export function HorizontalScaleLegend({
    showWind = true,
    showTemp = true
}: HorizontalScaleLegendProps) {
    const [activeScale, setActiveScale] = useState<'wind' | 'temp'>('wind');
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <motion.div
            className="absolute bottom-20 left-4 z-40"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
        >
            <div className="flex items-center gap-2">
                {/* Toggle button */}
                <motion.button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-8 h-8 bg-black/60 backdrop-blur-xl rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    {isExpanded ? (
                        <ChevronLeft className="w-4 h-4 text-white/70" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-white/70" />
                    )}
                </motion.button>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            className="flex items-center gap-3 bg-black/60 backdrop-blur-xl rounded-xl px-3 py-2 border border-white/10"
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Scale type selector */}
                            <div className="flex gap-1">
                                {showWind && (
                                    <button
                                        onClick={() => setActiveScale('wind')}
                                        className={`p-1.5 rounded-lg transition-all duration-200 ${activeScale === 'wind'
                                                ? 'bg-cyan-500/20 text-cyan-400'
                                                : 'text-white/40 hover:text-white/60'
                                            }`}
                                    >
                                        <Wind className="w-4 h-4" />
                                    </button>
                                )}
                                {showTemp && (
                                    <button
                                        onClick={() => setActiveScale('temp')}
                                        className={`p-1.5 rounded-lg transition-all duration-200 ${activeScale === 'temp'
                                                ? 'bg-orange-500/20 text-orange-400'
                                                : 'text-white/40 hover:text-white/60'
                                            }`}
                                    >
                                        <Thermometer className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="w-px h-6 bg-white/10" />

                            {/* Scale gradient */}
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center">
                                    {activeScale === 'wind' ? (
                                        <>
                                            {/* Wind gradient bar */}
                                            <div
                                                className="h-2 w-40 rounded-full"
                                                style={{
                                                    background: `linear-gradient(to right, ${WIND_SCALE.map(s => s.color).join(', ')})`
                                                }}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            {/* Temp gradient bar */}
                                            <div
                                                className="h-2 w-40 rounded-full"
                                                style={{
                                                    background: `linear-gradient(to right, ${TEMP_SCALE.map(s => s.color).join(', ')})`
                                                }}
                                            />
                                        </>
                                    )}
                                </div>

                                {/* Scale labels */}
                                <div className="flex justify-between text-[10px] text-white/50 w-40">
                                    {activeScale === 'wind' ? (
                                        <>
                                            <span>0</span>
                                            <span>10</span>
                                            <span>20</span>
                                            <span>30</span>
                                            <span>40 m/s</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>-10</span>
                                            <span>10</span>
                                            <span>20</span>
                                            <span>30</span>
                                            <span>50°C</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Current value indicator (optional - can be connected to data) */}
                            <div className="flex flex-col items-end ml-2">
                                <span className="text-xs font-semibold text-white">
                                    {activeScale === 'wind' ? 'Wind' : 'Temp'}
                                </span>
                                <span className="text-[10px] text-white/50">
                                    Real-time
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

export default HorizontalScaleLegend;
