/**
 * Automatic Detection Popup
 * Shows when new hazards are detected
 */

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wind, Waves, Mountain, X, AlertTriangle, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Detection {
  id: string;
  type: 'cyclone' | 'flood' | 'landslide' | 'waterlogged';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  location?: string;
}

interface DetectionPopupProps {
  detections: Detection[];
  onDismiss: (id: string) => void;
  onView: (detection: Detection) => void;
}

const TYPE_CONFIG = {
  cyclone: { icon: Wind, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  flood: { icon: Waves, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  landslide: { icon: Mountain, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  waterlogged: { icon: Waves, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
};

const SEVERITY_CONFIG = {
  critical: { badge: 'bg-red-600', label: 'CRITICAL' },
  high: { badge: 'bg-orange-500', label: 'HIGH' },
  medium: { badge: 'bg-yellow-500', label: 'MEDIUM' },
  low: { badge: 'bg-green-500', label: 'LOW' },
};

export function DetectionPopup({ detections, onDismiss, onView }: DetectionPopupProps) {
  const [visible, setVisible] = useState<Detection[]>([]);

  // Show new detections with animation
  useEffect(() => {
    if (detections.length > 0) {
      const latest = detections[detections.length - 1];
      setVisible(prev => {
        // Avoid duplicates
        if (prev.find(d => d.id === latest.id)) return prev;
        return [...prev.slice(-2), latest]; // Keep max 3 visible
      });

      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => {
        onDismiss(latest.id);
        setVisible(prev => prev.filter(d => d.id !== latest.id));
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [detections, onDismiss]);

  if (visible.length === 0) return null;

  return (
    <div className="absolute top-20 right-4 z-[1000] space-y-2">
      {visible.map((detection, index) => {
        const config = TYPE_CONFIG[detection.type];
        const Icon = config.icon;
        const severity = SEVERITY_CONFIG[detection.severity];

        return (
          <Card
            key={detection.id}
            className={cn(
              'w-80 p-3 backdrop-blur-xl border animate-in slide-in-from-right fade-in',
              config.bg,
              config.border,
              index === visible.length - 1 ? 'duration-300' : 'duration-500'
            )}
            style={{
              animationDelay: `${index * 100}ms`,
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', config.bg)}>
                  <Icon className={cn('w-4 h-4', config.color)} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{detection.title}</h4>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded text-white font-medium', severity.badge)}>
                    {severity.label}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
                onClick={() => {
                  onDismiss(detection.id);
                  setVisible(prev => prev.filter(d => d.id !== detection.id));
                }}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Message */}
            <p className="text-xs text-white/80 mb-2">{detection.message}</p>

            {/* Location & Time */}
            {detection.location && (
              <p className="text-[10px] text-white/50 mb-2">
                📍 {detection.location}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-7 text-xs bg-white/10 hover:bg-white/20 text-white"
                onClick={() => onView(detection)}
              >
                <Bell className="w-3 h-3 mr-1" />
                View on Map
              </Button>
            </div>

            {/* Progress bar for auto-dismiss */}
            <div className="mt-2 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', config.color.replace('text-', 'bg-'))}
                style={{
                  animation: 'progress 10s linear forwards',
                }}
              />
            </div>
          </Card>
        );
      })}

      <style>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

export default DetectionPopup;
