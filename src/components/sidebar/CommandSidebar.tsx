import { useState } from 'react';
import { ChevronLeft, ChevronRight, Wind, Droplets, Sun, Mountain, Radio, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CYCLONE_CATEGORIES, REGIONAL_HUBS } from '@/types/cyclone';

interface Storm {
  id: string;
  track_id: string;
  name?: string;
  basin: string;
  max_wind?: number;
  category?: string;
}

interface CommandSidebarProps {
  storms?: Storm[];
  selectedStormId?: string;
  onStormSelect?: (stormId: string) => void;
  onRegionSelect?: (regionCode: string) => void;
}

const CommandSidebar = ({ 
  storms = [], 
  selectedStormId,
  onStormSelect,
  onRegionSelect 
}: CommandSidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const disasterIcons = {
    cyclone: Wind,
    flood: Droplets,
    drought: Sun,
    landslide: Mountain,
  };

  return (
    <div 
      className={cn(
        "absolute top-16 left-0 z-20 h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out",
        isCollapsed ? "w-12" : "w-80"
      )}
    >
      <div className="h-full glass-panel border-r border-border flex flex-col">
        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-4 top-4 z-30 h-8 w-8 rounded-full bg-card border border-border shadow-lg"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>

        {isCollapsed ? (
          /* Collapsed State */
          <div className="flex flex-col items-center py-4 gap-4">
            <Wind className="h-5 w-5 text-primary" />
            <Separator className="w-6" />
            {storms.slice(0, 3).map((storm) => (
              <Button
                key={storm.id}
                variant="ghost"
                size="icon"
                onClick={() => onStormSelect?.(storm.id)}
                className={cn(
                  "h-8 w-8",
                  selectedStormId === storm.id && "bg-primary/20 text-primary"
                )}
              >
                <Radio className="h-4 w-4" />
              </Button>
            ))}
          </div>
        ) : (
          /* Expanded State */
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Radio className="h-4 w-4 text-primary animate-pulse" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Live Surveillance
                  </span>
                </div>
                <h2 className="text-lg font-bold text-foreground">Command Center</h2>
              </div>

              <Separator />

              {/* Data Source */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Data Source
                </h3>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="w-2 h-2 rounded-full bg-storm-safe animate-pulse" />
                  <div>
                    <p className="text-sm font-medium">Google DeepMind FNV3</p>
                    <p className="text-xs text-muted-foreground">Tropical Cyclone Model</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Active Storms */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Active Storms
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {storms.length}
                  </Badge>
                </div>
                
                {storms.length > 0 ? (
                  <div className="space-y-2">
                    {storms.map((storm) => (
                      <button
                        key={storm.id}
                        onClick={() => onStormSelect?.(storm.id)}
                        className={cn(
                          "w-full p-3 rounded-lg border text-left transition-all",
                          "hover:bg-muted/50 hover:border-primary/50",
                          selectedStormId === storm.id 
                            ? "bg-primary/10 border-primary" 
                            : "bg-card border-border"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wind className="h-4 w-4 text-storm-warning" />
                            <span className="font-medium text-sm">{storm.track_id}</span>
                          </div>
                          <Badge 
                            variant="outline" 
                            className="text-[10px] px-1.5"
                          >
                            {storm.basin}
                          </Badge>
                        </div>
                        {storm.name && (
                          <p className="text-xs text-muted-foreground mt-1 ml-6">
                            {storm.name}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-dashed border-border text-center">
                    <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No active storms</p>
                    <p className="text-xs text-muted-foreground">Load forecast data to begin</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Regional Hubs */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Regional Hubs
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {REGIONAL_HUBS.map((hub) => (
                    <button
                      key={hub.code}
                      onClick={() => onRegionSelect?.(hub.code)}
                      className="p-2 rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-primary/50 transition-all text-left"
                    >
                      <div 
                        className="w-3 h-3 rounded-full mb-1"
                        style={{ backgroundColor: hub.color }}
                      />
                      <p className="text-xs font-medium truncate">{hub.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Intensity Legend */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Cyclone Intensity
                </h3>
                <div className="space-y-1.5">
                  {CYCLONE_CATEGORIES.map((cat) => (
                    <div key={cat.category} className="flex items-center gap-2 text-xs">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-muted-foreground flex-1">{cat.label}</span>
                      <span className="text-muted-foreground font-mono">
                        {cat.minWind}-{cat.maxWind === 999 ? '+' : cat.maxWind} kt
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Probability Legend */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Hurricane Probability
                </h3>
                <div className="h-4 rounded-full overflow-hidden flex">
                  <div className="flex-1 bg-storm-info" />
                  <div className="flex-1 bg-storm-safe" />
                  <div className="flex-1 bg-storm-caution" />
                  <div className="flex-1 bg-storm-warning" />
                  <div className="flex-1 bg-storm-danger" />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                  <span>0%</span>
                  <span>20%</span>
                  <span>40%</span>
                  <span>60%</span>
                  <span>80%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default CommandSidebar;
