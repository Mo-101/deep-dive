import { X, Wind, Gauge, Circle, MapPin, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getCycloneCategory, type Hotspot } from '@/types/cyclone';

interface StormDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  storm?: {
    track_id: string;
    storm_name?: string;
    basin: string;
    hotspots?: Hotspot[];
  };
}

const StormDetailPanel = ({ isOpen, onClose, storm }: StormDetailPanelProps) => {
  if (!storm) return null;

  // Get the latest hotspot data
  const latestHotspot = storm.hotspots?.[0];
  const category = latestHotspot?.wind_speed_kt 
    ? getCycloneCategory(latestHotspot.wind_speed_kt) 
    : null;

  return (
    <div
      className={cn(
        "absolute top-16 right-0 z-20 h-[calc(100vh-4rem)] w-96 transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="h-full glass-panel border-l border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wind 
                className="h-5 w-5" 
                style={{ color: category?.color || 'hsl(var(--primary))' }}
              />
              <h2 className="text-lg font-bold">{storm.track_id}</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {storm.storm_name && (
            <p className="text-sm text-muted-foreground">{storm.storm_name}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">{storm.basin} Basin</Badge>
            {category && (
              <Badge 
                style={{ backgroundColor: category.color, color: 'white' }}
              >
                {category.label}
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {latestHotspot ? (
              <>
                {/* Current Position */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Current Position
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <MapPin className="h-3 w-3" />
                        <span className="text-xs">Latitude</span>
                      </div>
                      <p className="font-mono text-lg font-medium">
                        {latestHotspot.latitude.toFixed(2)}°
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <MapPin className="h-3 w-3" />
                        <span className="text-xs">Longitude</span>
                      </div>
                      <p className="font-mono text-lg font-medium">
                        {latestHotspot.longitude.toFixed(2)}°
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Intensity Metrics */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Intensity Metrics
                  </h3>
                  <div className="space-y-3">
                    {latestHotspot.wind_speed_kt && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center gap-2">
                          <Wind className="h-4 w-4 text-storm-warning" />
                          <span className="text-sm">Max Wind</span>
                        </div>
                        <span className="font-mono font-medium">
                          {latestHotspot.wind_speed_kt} kt
                          {latestHotspot.wind_speed_ms && (
                            <span className="text-muted-foreground text-xs ml-2">
                              ({latestHotspot.wind_speed_ms.toFixed(1)} m/s)
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {latestHotspot.pressure_hpa && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-storm-info" />
                          <span className="text-sm">Pressure</span>
                        </div>
                        <span className="font-mono font-medium">
                          {latestHotspot.pressure_hpa} hPa
                        </span>
                      </div>
                    )}
                    {latestHotspot.radius_r8_km && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center gap-2">
                          <Circle className="h-4 w-4 text-storm-caution" />
                          <span className="text-sm">Storm Radius (R8)</span>
                        </div>
                        <span className="font-mono font-medium">
                          {latestHotspot.radius_r8_km} km
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Probability Analysis */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Probability Analysis
                  </h3>
                  <div className="space-y-3">
                    {latestHotspot.hurricane_prob !== undefined && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>Hurricane Probability</span>
                          <span className="font-mono font-medium">
                            {(latestHotspot.hurricane_prob * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div 
                            className="h-full bg-storm-danger transition-all"
                            style={{ width: `${latestHotspot.hurricane_prob * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {latestHotspot.track_prob !== undefined && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>Track Probability</span>
                          <span className="font-mono font-medium">
                            {(latestHotspot.track_prob * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div 
                            className="h-full bg-storm-warning transition-all"
                            style={{ width: `${latestHotspot.track_prob * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Forecast Timeline */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Lead Time
                    </div>
                  </h3>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      T+{latestHotspot.lead_time_hours}h forecast
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Wind className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No detailed data available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Load forecast data to view storm metrics
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default StormDetailPanel;
