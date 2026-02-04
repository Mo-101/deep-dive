/**
 * Layer Control Panel
 * User toggle controls for all hazard layers
 */

import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Wind,
  Waves,
  Mountain,
  Droplets,
  History,
  RefreshCw,
  Layers,
  CloudSun
} from 'lucide-react';
import { HazardLayers } from '@/hooks/useRealtimeHazards';

interface LayerControlPanelProps {
  activeLayers: HazardLayers;
  toggleLayer: (layer: keyof HazardLayers) => void;
  lastUpdated: Date | null;
  isLoading: boolean;
  onRefresh: () => void;
}

const LAYER_CONFIG = [
  {
    key: 'cyclones' as const,
    label: 'Cyclones',
    description: 'Active tropical storms',
    icon: Wind,
    color: '#ef4444', // red-500
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
  },
  {
    key: 'wind' as const,
    label: 'Wind Flow',
    description: 'Real-time wind particles',
    icon: Wind,
    color: '#06b6d4', // cyan-500
    bgColor: 'bg-cyan-500/10',
    textColor: 'text-cyan-400',
  },
  {
    key: 'floods' as const,
    label: 'Floods',
    description: 'Satellite detected (SAR)',
    icon: Waves,
    color: '#3b82f6', // blue-500
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
  },
  {
    key: 'landslides' as const,
    label: 'Landslide Risk',
    description: 'Slope + rainfall analysis',
    icon: Mountain,
    color: '#f97316', // orange-500
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-400',
  },
  {
    key: 'waterlogged' as const,
    label: 'Waterlogged',
    description: 'Standing water areas',
    icon: Droplets,
    color: '#06b6d4', // cyan-500
    bgColor: 'bg-cyan-500/10',
    textColor: 'text-cyan-400',
  },
  {
    key: 'historical' as const,
    label: 'Historical Events',
    description: 'Idai, Freddy, past cyclones',
    icon: History,
    color: '#6b7280', // gray-500
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-400',
  },
];

export function LayerControlPanel({
  activeLayers,
  toggleLayer,
  lastUpdated,
  isLoading,
  onRefresh,
}: LayerControlPanelProps) {
  return (
    <Card className="absolute top-4 right-4 z-50 w-72 bg-black/80 backdrop-blur-xl border-white/10 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-white/60" />
          <h3 className="text-sm font-semibold text-white">Hazard Layers</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Layer Toggles */}
      <div className="space-y-3">
        {LAYER_CONFIG.map((layer) => {
          const Icon = layer.icon;
          const isActive = activeLayers[layer.key];

          return (
            <div
              key={layer.key}
              className={`flex items-center justify-between p-2 rounded-lg transition-colors ${isActive ? layer.bgColor : 'bg-white/5'
                }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? layer.bgColor : 'bg-white/5'
                    }`}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? layer.textColor : 'text-white/40'}`}
                  />
                </div>
                <div>
                  <Label
                    htmlFor={layer.key}
                    className={`text-sm font-medium cursor-pointer ${isActive ? 'text-white' : 'text-white/60'
                      }`}
                  >
                    {layer.label}
                  </Label>
                  <p className="text-[10px] text-white/40">
                    {layer.description}
                  </p>
                </div>
              </div>
              <Switch
                id={layer.key}
                checked={isActive}
                onCheckedChange={() => toggleLayer(layer.key)}
              />
            </div>
          );
        })}
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/40">Last updated</span>
            <span className="text-white/60">
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-[10px] text-white/30 mt-1">
            Auto-refreshes every 10 minutes
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
          onClick={() => {
            // Show all
            Object.keys(activeLayers).forEach((key) => {
              if (!activeLayers[key as keyof HazardLayers]) {
                toggleLayer(key as keyof HazardLayers);
              }
            });
          }}
        >
          Show All
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
          onClick={() => {
            // Hide all except cyclones
            Object.keys(activeLayers).forEach((key) => {
              if (key !== 'cyclones' && activeLayers[key as keyof HazardLayers]) {
                toggleLayer(key as keyof HazardLayers);
              }
            });
          }}
        >
          Cyclones Only
        </Button>
      </div>
    </Card>
  );
}

export default LayerControlPanel;
