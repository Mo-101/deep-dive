/**
 * Weather Ticker
 * Compact scrolling weather info below time controls
 * Shows city temperatures in a sleek horizontal strip
 */

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Cloud, Sun, CloudRain, Thermometer, MapPin } from 'lucide-react';

interface WeatherData {
    city: string;
    temp: number;
    condition: 'sunny' | 'cloudy' | 'rainy' | 'partly-cloudy';
    icon: typeof Cloud;
}

// Demo weather data - would be replaced with real API data
const WEATHER_STATIONS: WeatherData[] = [
    { city: 'Lagos', temp: 28, condition: 'cloudy', icon: Cloud },
    { city: 'Cairo', temp: 18, condition: 'sunny', icon: Sun },
    { city: 'Kinshasa', temp: 27, condition: 'rainy', icon: CloudRain },
    { city: 'Johannesburg', temp: 18, condition: 'partly-cloudy', icon: Cloud },
    { city: 'Nairobi', temp: 20, condition: 'partly-cloudy', icon: Cloud },
    { city: 'Addis Ababa', temp: 15, condition: 'sunny', icon: Sun },
    { city: 'Accra', temp: 29, condition: 'rainy', icon: CloudRain },
    { city: 'Dakar', temp: 26, condition: 'sunny', icon: Sun },
];

interface WeatherTickerProps {
    className?: string;
}

export function WeatherTicker({ className = '' }: WeatherTickerProps) {
    const [scrollPosition, setScrollPosition] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll animation
    useEffect(() => {
        const interval = setInterval(() => {
            setScrollPosition((prev) => {
                const maxScroll = WEATHER_STATIONS.length * 120 - 300;
                return prev >= maxScroll ? 0 : prev + 0.5;
            });
        }, 30);

        return () => clearInterval(interval);
    }, []);

    const getConditionColor = (condition: string) => {
        switch (condition) {
            case 'sunny': return 'text-yellow-400';
            case 'cloudy': return 'text-gray-400';
            case 'rainy': return 'text-blue-400';
            case 'partly-cloudy': return 'text-blue-300';
            default: return 'text-white/60';
        }
    };

    return (
        <motion.div
            className={`bg-black/50 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden ${className}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
        >
            <div className="flex items-center gap-2 px-3 py-2">
                {/* Icon */}
                <Thermometer className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />

                {/* Scrolling content */}
                <div
                    ref={containerRef}
                    className="overflow-hidden w-64"
                >
                    <motion.div
                        className="flex gap-4 whitespace-nowrap"
                        animate={{ x: -scrollPosition }}
                        transition={{ type: "tween", ease: "linear", duration: 0 }}
                    >
                        {[...WEATHER_STATIONS, ...WEATHER_STATIONS].map((station, index) => {
                            const Icon = station.icon;
                            return (
                                <div key={`${station.city}-${index}`} className="flex items-center gap-1.5">
                                    <span className="text-xs text-white/70">{station.city}</span>
                                    <Icon className={`w-3 h-3 ${getConditionColor(station.condition)}`} />
                                    <span className="text-xs font-semibold text-white">
                                        {station.temp}°
                                    </span>
                                </div>
                            );
                        })}
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
}

export default WeatherTicker;
