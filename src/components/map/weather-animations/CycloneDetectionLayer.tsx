/**
 * Cyclone Detection Layer
 * Shows potential cyclone formation zones and detection probabilities
 * Inspired by Google WeatherLab's "expert mode" with probability circles
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMap } from '@/hooks/useMap';

interface PotentialCyclone {
  id: string;
  center: { lat: number; lon: number };
  formationProbability: number; // 0-100%
  timeToFormation: number; // hours
  ensembleMembers: number; // Number of models predicting formation
  confidence: 'low' | 'medium' | 'high';
  predictedTrack?: Array<{ lat: number; lon: number; time: number }>;
}

interface CycloneDetectionLayerProps {
  potentialCyclones: PotentialCyclone[];
  showEnsembleSpread?: boolean;
  showFormationZones?: boolean;
  isActive?: boolean;
}

// Generate ensemble spread circles (represents uncertainty)
function generateEnsembleSpread(
  center: { lat: number; lon: number },
  memberCount: number,
  spreadKm: number = 200
): Array<{ lat: number; lon: number; probability: number }> {
  const members = [];
  
  for (let i = 0; i < memberCount; i++) {
    const angle = (i / memberCount) * 2 * Math.PI;
    const distance = Math.random() * spreadKm;
    
    const R = 6371;
    const lat = center.lat + (distance / R) * (180 / Math.PI) * Math.cos(angle);
    const lon = center.lon + (distance / R) * (180 / Math.PI) * Math.sin(angle) / Math.cos(center.lat * Math.PI / 180);
    
    members.push({
      lat,
      lon,
      probability: Math.max(0, 100 - (distance / spreadKm) * 50),
    });
  }
  
  return members;
}

// Generate predicted track points
function generatePredictedTrack(
  center: { lat: number; lon: number },
  direction: number, // degrees
  speed: number, // km/h
  hours: number = 120
): Array<{ lat: number; lon: number; time: number }> {
  const track = [{ ...center, time: 0 }];
  let currentLat = center.lat;
  let currentLon = center.lon;
  
  const R = 6371;
  const rad = direction * Math.PI / 180;
  
  for (let h = 6; h <= hours; h += 6) {
    const distance = speed * h;
    
    // Add some curvature (coriolis effect simulation)
    const curve = Math.sin(h / hours * Math.PI) * 10; // degrees
    const curvedRad = (direction + curve) * Math.PI / 180;
    
    currentLat = center.lat + (distance / R) * (180 / Math.PI) * Math.cos(curvedRad);
    currentLon = center.lon + (distance / R) * (180 / Math.PI) * Math.sin(curvedRad) / Math.cos(center.lat * Math.PI / 180);
    
    track.push({ lat: currentLat, lon: currentLon, time: h });
  }
  
  return track;
}

export function CycloneDetectionLayer({
  potentialCyclones,
  showEnsembleSpread = true,
  showFormationZones = true,
  isActive = true,
}: CycloneDetectionLayerProps) {
  const { map } = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Get color based on formation probability
  const getProbabilityColor = useCallback((probability: number, alpha: number = 1) => {
    if (probability >= 70) return `rgba(255, 50, 50, ${alpha})`;
    if (probability >= 50) return `rgba(255, 150, 50, ${alpha})`;
    if (probability >= 30) return `rgba(255, 200, 50, ${alpha})`;
    return `rgba(100, 200, 255, ${alpha})`;
  }, []);

  // Get confidence label
  const getConfidenceLabel = (confidence: string) => {
    const labels: Record<string, string> = {
      low: 'Low Confidence',
      medium: 'Medium Confidence',
      high: 'High Confidence',
    };
    return labels[confidence] || confidence;
  };

  // Animation loop
  const animate = useCallback((time: number) => {
    if (!map || !canvasRef.current || !isActive) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with slight fade
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    potentialCyclones.forEach(cyclone => {
      const center = map.project([cyclone.center.lon, cyclone.center.lat]);
      const color = getProbabilityColor(cyclone.formationProbability);
      
      // Draw formation probability zone
      if (showFormationZones) {
        const radius = 20 + cyclone.formationProbability / 2;
        
        // Outer glow (pulsing)
        const pulseScale = 1 + Math.sin(time / 500) * 0.1;
        const gradient = ctx.createRadialGradient(
          center.x, center.y, 0,
          center.x, center.y, radius * pulseScale * 3
        );
        
        gradient.addColorStop(0, getProbabilityColor(cyclone.formationProbability, 0.3));
        gradient.addColorStop(0.5, getProbabilityColor(cyclone.formationProbability, 0.1));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius * pulseScale * 3, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = getProbabilityColor(cyclone.formationProbability, 0.4);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Probability text
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${cyclone.formationProbability}%`, center.x, center.y);
        
        // Time to formation
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(`T+${cyclone.timeToFormation}h`, center.x, center.y + 15);
      }
      
      // Draw ensemble spread
      if (showEnsembleSpread && cyclone.ensembleMembers > 0) {
        const spread = generateEnsembleSpread(
          cyclone.center,
          Math.min(cyclone.ensembleMembers, 20),
          150 + cyclone.timeToFormation * 2
        );
        
        spread.forEach(member => {
          const point = map.project([member.lon, member.lat]);
          
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = getProbabilityColor(member.probability, 0.6);
          ctx.fill();
        });
        
        // Draw connection lines to center
        ctx.globalCompositeOperation = 'destination-over';
        spread.forEach(member => {
          const point = map.project([member.lon, member.lat]);
          
          ctx.beginPath();
          ctx.moveTo(center.x, center.y);
          ctx.lineTo(point.x, point.y);
          ctx.strokeStyle = getProbabilityColor(member.probability, 0.1);
          ctx.lineWidth = 1;
          ctx.stroke();
        });
        ctx.globalCompositeOperation = 'source-over';
      }
      
      // Draw predicted track
      if (cyclone.predictedTrack && cyclone.predictedTrack.length > 1) {
        ctx.beginPath();
        
        cyclone.predictedTrack.forEach((point, i) => {
          const screenPoint = map.project([point.lon, point.lat]);
          
          if (i === 0) {
            ctx.moveTo(screenPoint.x, screenPoint.y);
          } else {
            ctx.lineTo(screenPoint.x, screenPoint.y);
          }
        });
        
        ctx.strokeStyle = getProbabilityColor(cyclone.formationProbability, 0.6);
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw time markers on track
        cyclone.predictedTrack.forEach((point, i) => {
          if (i % 4 === 0) { // Every 24 hours
            const screenPoint = map.project([point.lon, point.lat]);
            
            ctx.beginPath();
            ctx.arc(screenPoint.x, screenPoint.y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            
            // Time label
            ctx.font = '10px Inter, sans-serif';
            ctx.fillStyle = 'white';
            ctx.fillText(`${point.time}h`, screenPoint.x + 8, screenPoint.y);
          }
        });
      }
      
      // Draw info label
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      
      const label = `${getConfidenceLabel(cyclone.confidence)} | ${cyclone.ensembleMembers} models`;
      const labelY = center.y - 30;
      
      ctx.strokeText(label, center.x, labelY);
      ctx.fillText(label, center.x, labelY);
    });
    
    animationRef.current = requestAnimationFrame(animate);
  }, [map, isActive, potentialCyclones, showEnsembleSpread, showFormationZones, getProbabilityColor]);

  useEffect(() => {
    if (!map || !isActive) return;
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'cyclone-detection-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '20';
    
    const resizeCanvas = () => {
      const container = map.getCanvasContainer();
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    
    resizeCanvas();
    map.getCanvasContainer().appendChild(canvas);
    canvasRef.current = canvas;
    
    // Start animation
    animationRef.current = requestAnimationFrame(animate);
    
    // Handle map events
    const handleResize = () => resizeCanvas();
    map.on('resize', handleResize);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      canvas.remove();
      map.off('resize', handleResize);
    };
  }, [map, isActive, animate]);

  return null;
}

// Hook for generating sample potential cyclones from FNV3 data
export function useCycloneDetection(fnv3Data: Array<{
  location: { lat: number; lon: number };
  track_probability: number;
  wind_34kt_probability: number;
  wind_50kt_probability: number;
  wind_64kt_probability: number;
}>): PotentialCyclone[] {
  return fnv3Data.map((cyclone, index) => ({
    id: `potential-${index}`,
    center: cyclone.location,
    formationProbability: Math.round(cyclone.track_probability * 100),
    timeToFormation: cyclone.track_probability > 0.7 ? 0 : 
                     cyclone.track_probability > 0.5 ? 24 : 
                     cyclone.track_probability > 0.3 ? 48 : 72,
    ensembleMembers: Math.round(cyclone.track_probability * 50),
    confidence: cyclone.track_probability > 0.7 ? 'high' :
                cyclone.track_probability > 0.4 ? 'medium' : 'low',
    predictedTrack: generatePredictedTrack(
      cyclone.location,
      Math.random() * 360,
      10 + Math.random() * 15,
      120
    ),
  }));
}

export default CycloneDetectionLayer;
