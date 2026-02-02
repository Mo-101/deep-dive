import { Wind, AlertTriangle, Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { REGIONAL_HUBS } from '@/types/cyclone';

interface ThreatLevel {
  region: string;
  level: 'low' | 'moderate' | 'high' | 'severe' | 'extreme';
  activeEvents: number;
}

interface ThreatBarProps {
  threats?: ThreatLevel[];
  currentTime?: Date;
  onRegionClick?: (regionCode: string) => void;
}

const ThreatBar = ({ 
  threats = [], 
  currentTime = new Date(),
  onRegionClick 
}: ThreatBarProps) => {
  const getLevelColor = (level: ThreatLevel['level']) => {
    switch (level) {
      case 'extreme': return 'bg-storm-danger text-white';
      case 'severe': return 'bg-cyclone-cat3 text-white';
      case 'high': return 'bg-storm-warning text-white';
      case 'moderate': return 'bg-storm-caution text-black';
      case 'low': return 'bg-storm-safe text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getLevelIcon = (level: ThreatLevel['level']) => {
    switch (level) {
      case 'extreme':
      case 'severe':
        return <AlertTriangle className="h-3 w-3" />;
      case 'high':
        return <Zap className="h-3 w-3" />;
      default:
        return <Activity className="h-3 w-3" />;
    }
  };

  // Get threat level for a region
  const getThreat = (regionCode: string) => 
    threats.find(t => t.region === regionCode);

  return (
    <header className="h-16 glass-panel border-b border-border flex items-center justify-between px-4 z-30 relative">
      {/* Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Wind className="h-8 w-8 text-primary" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-storm-danger rounded-full animate-pulse" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-primary">AFRO</span>
            <span className="text-foreground"> Storm</span>
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Continental Weather Surveillance
          </p>
        </div>
      </div>

      {/* Regional Threat Indicators */}
      <div className="flex items-center gap-2">
        {REGIONAL_HUBS.map((hub) => {
          const threat = getThreat(hub.code);
          return (
            <button
              key={hub.code}
              onClick={() => onRegionClick?.(hub.code)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
                "hover:scale-105 hover:shadow-lg",
                threat 
                  ? "border-transparent" 
                  : "border-border bg-card hover:border-primary/50"
              )}
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  threat ? "animate-pulse" : ""
                )}
                style={{ backgroundColor: hub.color }}
              />
              <span className="text-xs font-medium hidden lg:inline">
                {hub.name}
              </span>
              {threat && threat.activeEvents > 0 ? (
                <Badge 
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-5 flex items-center gap-1",
                    getLevelColor(threat.level)
                  )}
                >
                  {getLevelIcon(threat.level)}
                  {threat.activeEvents}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                  OK
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Time Display */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-muted-foreground">UTC Time</div>
          <div className="font-mono text-sm font-medium">
            {currentTime.toISOString().slice(0, 19).replace('T', ' ')}
          </div>
        </div>
        <div className="w-2 h-2 rounded-full bg-storm-safe animate-pulse" />
      </div>
    </header>
  );
};

export default ThreatBar;
