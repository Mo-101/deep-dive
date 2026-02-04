/**
 * Multi-Hazard Legend
 * Shows what each color/symbol means on the map
 */

import { Card } from '@/components/ui/card';
import { Wind, Waves, Mountain, Droplets, History, AlertTriangle } from 'lucide-react';

interface HazardLegendProps {
  className?: string;
}

const LEGEND_ITEMS = [
  {
    icon: Wind,
    label: 'Cyclone Track',
    description: 'Active storm path',
    color: '#ef4444',
    bgColor: 'bg-red-500/20',
    iconColor: 'text-red-400',
  },
  {
    icon: Waves,
    label: 'Flooded Area',
    description: 'Satellite detected (SAR)',
    color: '#3b82f6',
    bgColor: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: Mountain,
    label: 'High Landslide Risk',
    description: 'Slope >30° + heavy rain',
    color: '#f97316',
    bgColor: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
  },
  {
    icon: Droplets,
    label: 'Waterlogged',
    description: 'Standing water >24h',
    color: '#06b6d4',
    bgColor: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
  {
    icon: History,
    label: 'Historical Event',
    description: 'Past cyclone tracks',
    color: '#6b7280',
    bgColor: 'bg-gray-500/20',
    iconColor: 'text-gray-400',
  },
];

const RISK_INDICATORS = [
  { color: '#ef4444', label: 'Critical', range: '>48h warning' },
  { color: '#f97316', label: 'High', range: '24-48h warning' },
  { color: '#eab308', label: 'Medium', range: '12-24h warning' },
  { color: '#22c55e', label: 'Low', range: '<12h warning' },
];

export function HazardLegend({ className = '' }: HazardLegendProps) {
  return (
    <Card className={`absolute bottom-4 left-4 z-50 bg-black/80 backdrop-blur-xl border-white/10 p-4 w-64 ${className}`}>
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400" />
        Hazard Types
      </h3>

      {/* Legend Items */}
      <div className="space-y-2 mb-4">
        {LEGEND_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-start gap-3">
              <div className={`w-6 h-6 rounded ${item.bgColor} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-white">{item.label}</p>
                <p className="text-[10px] text-white/50">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk Indicators */}
      <div className="pt-3 border-t border-white/10">
        <h4 className="text-[10px] font-medium text-white/60 uppercase mb-2">
          Warning Time
        </h4>
        <div className="space-y-1.5">
          {RISK_INDICATORS.map((indicator) => (
            <div key={indicator.label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: indicator.color }}
              />
              <span className="text-[10px] text-white/70">{indicator.label}</span>
              <span className="text-[10px] text-white/40 ml-auto">
                {indicator.range}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Opacity Note */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <p className="text-[10px] text-white/40">
          All layers are transparent to show overlapping hazards
        </p>
      </div>
    </Card>
  );
}

export default HazardLegend;
