import { Play, Pause, SkipForward, SkipBack, FastForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TimeControlsProps {
  currentLeadTime: number;
  maxLeadTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onLeadTimeChange: (value: number) => void;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onStepForward: () => void;
  onStepBack: () => void;
}

const TimeControls = ({
  currentLeadTime = 0,
  maxLeadTime = 240,
  isPlaying = false,
  playbackSpeed = 1,
  onLeadTimeChange,
  onPlayPause,
  onSpeedChange,
  onStepForward,
  onStepBack,
}: TimeControlsProps) => {
  const speeds = [0.5, 1, 2, 4];

  const formatLeadTime = (hours: number) => {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (days > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${hours}h`;
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
      <div className="glass-panel border border-border rounded-xl p-4 shadow-2xl min-w-[500px]">
        <div className="flex items-center gap-4">
          {/* Lead Time Display */}
          <div className="text-center min-w-[80px]">
            <div className="text-xs text-muted-foreground mb-1">Lead Time</div>
            <Badge variant="secondary" className="font-mono text-lg px-3">
              T+{formatLeadTime(currentLeadTime)}
            </Badge>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onStepBack}
              disabled={currentLeadTime <= 0}
              className="h-9 w-9"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={onPlayPause}
              className="h-10 w-10 rounded-full"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onStepForward}
              disabled={currentLeadTime >= maxLeadTime}
              className="h-9 w-9"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Timeline Slider */}
          <div className="flex-1 px-2">
            <Slider
              value={[currentLeadTime]}
              min={0}
              max={maxLeadTime}
              step={6}
              onValueChange={([value]) => onLeadTimeChange(value)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Now</span>
              <span>T+120h</span>
              <span>T+{maxLeadTime}h</span>
            </div>
          </div>

          {/* Speed Controls */}
          <div className="flex items-center gap-1">
            <FastForward className="h-4 w-4 text-muted-foreground" />
            {speeds.map((speed) => (
              <Button
                key={speed}
                variant={playbackSpeed === speed ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onSpeedChange(speed)}
                className={cn(
                  "h-7 px-2 text-xs font-mono",
                  playbackSpeed === speed && "bg-primary text-primary-foreground"
                )}
              >
                {speed}x
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeControls;
