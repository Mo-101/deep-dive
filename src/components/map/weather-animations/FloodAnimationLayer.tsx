/**
 * Flood Animation Layer
 * Shows animated flood extent and water flow patterns
 * Useful for visualizing storm surge and rainfall flooding
 */

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

interface FloodZone {
  id: string;
  center: { lat: number; lon: number };
  extent: Array<{ lat: number; lon: number }>; // Polygon coordinates
  severity: 'minor' | 'moderate' | 'major';
  depth: number; // meters
  velocity?: number; // m/s, for flowing water
  isExpanding?: boolean;
}

interface FloodAnimationLayerProps {
  map: mapboxgl.Map | null;
  floodZones: FloodZone[];
  showFlowLines?: boolean;
  showPulseEffect?: boolean;
  isActive?: boolean;
}

const SEVERITY_COLORS = {
  minor: {
    fill: 'rgba(100, 200, 255, 0.3)',
    stroke: 'rgba(100, 200, 255, 0.8)',
    glow: 'rgba(100, 200, 255, 0.4)',
  },
  moderate: {
    fill: 'rgba(255, 200, 50, 0.3)',
    stroke: 'rgba(255, 200, 50, 0.8)',
    glow: 'rgba(255, 200, 50, 0.4)',
  },
  major: {
    fill: 'rgba(255, 80, 50, 0.4)',
    stroke: 'rgba(255, 80, 50, 0.9)',
    glow: 'rgba(255, 80, 50, 0.5)',
  },
};

export function FloodAnimationLayer({
  map,
  floodZones,
  showFlowLines = true,
  showPulseEffect = true,
  isActive = true,
}: FloodAnimationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  // Generate flow lines within flood zone
  const generateFlowLines = useCallback((zone: FloodZone, count: number = 50) => {
    const lines = [];
    const bounds = getBounds(zone.extent);

    for (let i = 0; i < count; i++) {
      const startLat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);
      const startLon = bounds.minLon + Math.random() * (bounds.maxLon - bounds.minLon);

      // Flow direction (generally downhill - simplified)
      const angle = Math.random() * 2 * Math.PI;
      const length = 20 + Math.random() * 30; // Line length

      lines.push({
        start: { lat: startLat, lon: startLon },
        angle,
        length,
        speed: (zone.velocity || 0.5) * (0.5 + Math.random()),
        offset: Math.random() * 100, // Animation offset
      });
    }

    return lines;
  }, []);

  // Get bounds of extent
  const getBounds = (extent: Array<{ lat: number; lon: number }>) => {
    const lats = extent.map(p => p.lat);
    const lons = extent.map(p => p.lon);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    };
  };

  // Draw flood polygon with wave effect
  const drawFloodPolygon = useCallback((
    ctx: CanvasRenderingContext2D,
    zone: FloodZone,
    time: number,
    colors: typeof SEVERITY_COLORS[keyof typeof SEVERITY_COLORS]
  ) => {
    if (!map) return;

    ctx.beginPath();

    zone.extent.forEach((point, i) => {
      const screenPoint = map.project([point.lon, point.lat]);

      if (i === 0) {
        ctx.moveTo(screenPoint.x, screenPoint.y);
      } else {
        ctx.lineTo(screenPoint.x, screenPoint.y);
      }
    });

    ctx.closePath();

    // Fill with gradient
    const gradient = ctx.createRadialGradient(
      map.project([zone.center.lon, zone.center.lat]).x,
      map.project([zone.center.lon, zone.center.lat]).y,
      0,
      map.project([zone.center.lon, zone.center.lat]).x,
      map.project([zone.center.lon, zone.center.lat]).y,
      100
    );

    gradient.addColorStop(0, colors.fill);
    gradient.addColorStop(1, colors.fill.replace(/[\d.]+\)$/, '0.1)'));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke with animated dash
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 2;

    if (showPulseEffect) {
      const dashOffset = (time / 20) % 20;
      ctx.setLineDash([10, 5]);
      ctx.lineDashOffset = -dashOffset;
    }

    ctx.stroke();
    ctx.setLineDash([]);

    // Draw depth indicator
    const center = map.project([zone.center.lon, zone.center.lat]);
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(`${zone.depth.toFixed(1)}m`, center.x, center.y);
  }, [map, showPulseEffect]);

  // Draw flowing water lines
  const drawFlowLines = useCallback((
    ctx: CanvasRenderingContext2D,
    zone: FloodZone,
    time: number,
    colors: typeof SEVERITY_COLORS[keyof typeof SEVERITY_COLORS]
  ) => {
    if (!map) return;

    const flowLines = generateFlowLines(zone, 30);

    flowLines.forEach(line => {
      const start = map.project([line.start.lon, line.start.lat]);

      // Calculate end point based on flow direction
      const R = 6371;
      const endLat = line.start.lat + (line.length / R) * (180 / Math.PI) * Math.cos(line.angle);
      const endLon = line.start.lon + (line.length / R) * (180 / Math.PI) * Math.sin(line.angle) / Math.cos(line.start.lat * Math.PI / 180);
      const end = map.project([endLon, endLat]);

      // Animate particles along the line
      const progress = ((time / 1000 * line.speed) + line.offset) % 100 / 100;
      const particleX = start.x + (end.x - start.x) * progress;
      const particleY = start.y + (end.y - start.y) * progress;

      // Draw flow line
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = colors.stroke.replace(/[\d.]+\)$/, '0.2)');
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw moving particle
      ctx.beginPath();
      ctx.arc(particleX, particleY, 2, 0, 2 * Math.PI);
      ctx.fillStyle = colors.stroke;
      ctx.fill();

      // Draw particle trail
      const trailLength = 10;
      for (let i = 1; i <= trailLength; i++) {
        const trailProgress = Math.max(0, progress - i * 0.05);
        const trailX = start.x + (end.x - start.x) * trailProgress;
        const trailY = start.y + (end.y - start.y) * trailProgress;

        ctx.beginPath();
        ctx.arc(trailX, trailY, 2 * (1 - i / trailLength), 0, 2 * Math.PI);
        ctx.fillStyle = colors.stroke.replace(/[\d.]+\)$/, `${0.5 * (1 - i / trailLength)})`);
        ctx.fill();
      }
    });
  }, [map, generateFlowLines]);

  // Draw expanding ripple effect for active flooding
  const drawRippleEffect = useCallback((
    ctx: CanvasRenderingContext2D,
    zone: FloodZone,
    time: number,
    colors: typeof SEVERITY_COLORS[keyof typeof SEVERITY_COLORS]
  ) => {
    if (!map || !zone.isExpanding) return;

    const center = map.project([zone.center.lon, zone.center.lat]);

    // Multiple expanding rings
    for (let i = 0; i < 3; i++) {
      const ringTime = (time / 1000 + i * 0.5) % 2;
      const radius = ringTime * 50;
      const alpha = 1 - ringTime / 2;

      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = colors.glow.replace(/[\d.]+\)$/, `${alpha * 0.5})`);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }, [map]);

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    if (!map || !canvasRef.current || !isActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    timeRef.current = timestamp;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each flood zone
    floodZones.forEach(zone => {
      const colors = SEVERITY_COLORS[zone.severity];

      // Draw main flood polygon
      drawFloodPolygon(ctx, zone, timestamp, colors);

      // Draw flow lines
      if (showFlowLines) {
        drawFlowLines(ctx, zone, timestamp, colors);
      }

      // Draw ripple effect for expanding floods
      if (showPulseEffect) {
        drawRippleEffect(ctx, zone, timestamp, colors);
      }
    });

    animationRef.current = requestAnimationFrame(animate);
  }, [map, isActive, floodZones, showFlowLines, showPulseEffect, drawFloodPolygon, drawFlowLines, drawRippleEffect]);

  useEffect(() => {
    if (!map || !isActive) return;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'flood-animation-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '12';

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

export default FloodAnimationLayer;
