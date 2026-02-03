/**
 * Wind Speed Legend Component
 * Professional meteorological colorbar for wind visualization
 */

import { Wind } from 'lucide-react';

const WIND_COLORS = [
  { speed: 0, color: 'rgb(98, 113, 183)', label: '0' },
  { speed: 5, color: 'rgb(57, 181, 74)', label: '5' },
  { speed: 10, color: 'rgb(255, 255, 0)', label: '10' },
  { speed: 15, color: 'rgb(255, 170, 0)', label: '15' },
  { speed: 20, color: 'rgb(255, 85, 0)', label: '20' },
  { speed: 25, color: 'rgb(255, 0, 0)', label: '25' },
  { speed: 30, color: 'rgb(180, 0, 100)', label: '30' },
  { speed: 40, color: 'rgb(128, 0, 128)', label: '40+' },
];

export const WindSpeedLegend = () => {
  return (
    <div className="absolute bottom-24 left-4 z-10 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-3 min-w-[160px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Wind className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-medium text-white">Wind Speed (m/s)</span>
      </div>
      
      {/* Gradient Bar */}
      <div 
        className="h-3 rounded-sm mb-1"
        style={{
          background: `linear-gradient(to right, ${WIND_COLORS.map(c => c.color).join(', ')})`
        }}
      />
      
      {/* Scale Labels */}
      <div className="flex justify-between text-[9px] text-slate-400">
        {WIND_COLORS.filter((_, i) => i % 2 === 0 || i === WIND_COLORS.length - 1).map((item) => (
          <span key={item.speed}>{item.label}</span>
        ))}
      </div>
      
      {/* Descriptive Labels */}
      <div className="flex justify-between text-[8px] text-slate-500 mt-1">
        <span>Calm</span>
        <span>Storm</span>
        <span>Hurricane</span>
      </div>
    </div>
  );
};

export default WindSpeedLegend;
