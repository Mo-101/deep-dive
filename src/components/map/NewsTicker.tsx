/**
 * News Ticker - Bottom scrolling updates
 * Shows real-time hazard updates and weather alerts
 */

import { useEffect, useState, useRef } from 'react';
import { Wind, Waves, Mountain, Droplets, AlertTriangle, Info, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TickerItem {
  id: string;
  type: 'cyclone' | 'flood' | 'landslide' | 'waterlogged' | 'weather' | 'alert';
  message: string;
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface NewsTickerProps {
  items: TickerItem[];
  isLoading?: boolean;
}

const TYPE_ICONS = {
  cyclone: Wind,
  flood: Waves,
  landslide: Mountain,
  waterlogged: Droplets,
  weather: Info,
  alert: AlertTriangle,
};

const TYPE_COLORS = {
  cyclone: 'text-red-400 bg-red-500/20',
  flood: 'text-blue-400 bg-blue-500/20',
  landslide: 'text-orange-400 bg-orange-500/20',
  waterlogged: 'text-cyan-400 bg-cyan-500/20',
  weather: 'text-green-400 bg-green-500/20',
  alert: 'text-yellow-400 bg-yellow-500/20',
};

const SEVERITY_COLORS = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-green-400',
};

export function NewsTicker({ items, isLoading }: NewsTickerProps) {
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Duplicate items for seamless loop
  const duplicatedItems = [...items, ...items];

  if (items.length === 0 && !isLoading) return null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[1000] bg-black/90 border-t border-white/10 backdrop-blur-xl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black/90 to-transparent z-10 flex items-center px-4">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-red-500 animate-pulse" />
          <span className="text-xs font-bold text-white">LIVE UPDATES</span>
        </div>
      </div>

      {/* Ticker */}
      <div
        ref={containerRef}
        className="overflow-hidden h-10 flex items-center"
      >
        <div
          className={cn(
            'flex items-center gap-8 whitespace-nowrap',
            isPaused ? '' : 'animate-ticker'
          )}
          style={{
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        >
          {isLoading ? (
            <span className="text-sm text-white/60 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Loading hazard updates...
            </span>
          ) : (
            duplicatedItems.map((item, index) => {
              const Icon = TYPE_ICONS[item.type];
              const typeColor = TYPE_COLORS[item.type];
              const severityColor = item.severity ? SEVERITY_COLORS[item.severity] : '';

              return (
                <div
                  key={`${item.id}-${index}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className={cn('w-6 h-6 rounded flex items-center justify-center', typeColor)}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  
                  {item.severity && (
                    <span className={cn('text-xs font-bold uppercase', severityColor)}>
                      {item.severity}
                    </span>
                  )}
                  
                  <span className="text-white/80">{item.message}</span>
                  
                  <span className="text-white/40 text-xs">
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <span className="text-white/20 mx-4">|</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Gradient fade on right */}
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black/90 to-transparent z-10" />

      <style>{`
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        
        .animate-ticker {
          animation: ticker 30s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default NewsTicker;
