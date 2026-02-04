/**
 * Wind Particle Animation Layer
 * Real-time GPU-accelerated wind visualization for cyclones
 * Based on Mapbox webgl-wind and Google WeatherLab patterns
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMap } from '@/hooks/useMap';

interface WindData {
  u: number; // East-west wind component (m/s)
  v: number; // North-south wind component (m/s)
  lat: number;
  lon: number;
}

interface WindParticleLayerProps {
  windData: WindData[];
  particleCount?: number;
  particleSize?: number;
  speedFactor?: number;
  fadeOpacity?: number;
  colorScale?: string[];
  isActive?: boolean;
}

// Default color scale for wind speed (m/s)
const DEFAULT_COLOR_SCALE = [
  'rgba(134,163,171,0.6)',   // 0-2 m/s - Light blue-gray
  'rgba(126,152,188,0.7)',   // 2-4 m/s
  'rgba(110,143,208,0.7)',   // 4-6 m/s
  'rgba(15,147,167,0.8)',    // 6-8 m/s
  'rgba(57,163,57,0.8)',     // 8-10 m/s - Green
  'rgba(194,134,62,0.8)',    // 10-12 m/s - Orange
  'rgba(200,66,13,0.9)',     // 12-14 m/s - Red-orange
  'rgba(210,0,50,0.9)',      // 14-16 m/s - Red
  'rgba(175,80,136,0.9)',    // 16-18 m/s - Purple
  'rgba(117,74,147,1)',      // 18+ m/s - Deep purple
];

export function WindParticleLayer({
  windData,
  particleCount = 3000,
  particleSize = 1.5,
  speedFactor = 0.5,
  fadeOpacity = 0.96,
  colorScale = DEFAULT_COLOR_SCALE,
  isActive = true,
}: WindParticleLayerProps) {
  const { map } = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    age: number;
    life: number;
    speed: number;
  }>>([]);
  const windGridRef = useRef<Map<string, { u: number; v: number; speed: number }>>(new Map());

  // Build wind grid for fast lookup
  const buildWindGrid = useCallback(() => {
    const grid = new Map<string, { u: number; v: number; speed: number }>();
    
    windData.forEach(point => {
      const key = `${Math.round(point.lat * 10) / 10},${Math.round(point.lon * 10) / 10}`;
      const speed = Math.sqrt(point.u ** 2 + point.v ** 2);
      grid.set(key, { u: point.u, v: point.v, speed });
    });
    
    windGridRef.current = grid;
  }, [windData]);

  // Get wind at position using bilinear interpolation
  const getWindAtPosition = useCallback((lat: number, lon: number) => {
    const latIdx = Math.floor(lat * 10) / 10;
    const lonIdx = Math.floor(lon * 10) / 10;
    
    // Get four surrounding grid points
    const p00 = windGridRef.current.get(`${latIdx},${lonIdx}`);
    const p10 = windGridRef.current.get(`${latIdx + 0.1},${lonIdx}`);
    const p01 = windGridRef.current.get(`${latIdx},${lonIdx + 0.1}`);
    const p11 = windGridRef.current.get(`${latIdx + 0.1},${lonIdx + 0.1}`);
    
    if (!p00) return null;
    
    // Simple nearest neighbor for performance
    return p00;
  }, []);

  // Initialize particles
  const initParticles = useCallback(() => {
    if (!map) return;
    
    const bounds = map.getBounds();
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
      const lat = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth());
      const lon = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest());
      const wind = getWindAtPosition(lat, lon);
      
      particles.push({
        x: lon,
        y: lat,
        age: Math.random() * 100,
        life: 50 + Math.random() * 100,
        speed: wind?.speed || 0,
      });
    }
    
    particlesRef.current = particles;
  }, [map, particleCount, getWindAtPosition]);

  // Get color for wind speed
  const getColorForSpeed = useCallback((speed: number) => {
    const index = Math.min(
      Math.floor(speed / 2),
      colorScale.length - 1
    );
    return colorScale[index];
  }, [colorScale]);

  // Animation loop
  const animate = useCallback(() => {
    if (!map || !canvasRef.current || !isActive) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fade existing canvas
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - fadeOpacity})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set blend mode for particle trails
    ctx.globalCompositeOperation = 'lighter';
    
    const bounds = map.getBounds();
    const width = canvas.width;
    const height = canvas.height;
    
    particlesRef.current.forEach(particle => {
      // Convert lat/lon to screen coordinates
      const point = map.project([particle.x, particle.y]);
      
      // Get wind at current position
      const wind = getWindAtPosition(particle.y, particle.x);
      
      if (wind && wind.speed > 0.5) {
        // Calculate displacement based on wind
        // Scale factor converts m/s to pixels per frame
        const dx = (wind.u * speedFactor * 0.1);
        const dy = -(wind.v * speedFactor * 0.1); // Invert Y for canvas
        
        // Update particle position
        const newX = point.x + dx;
        const newY = point.y + dy;
        
        // Draw particle trail
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(newX, newY);
        ctx.strokeStyle = getColorForSpeed(wind.speed);
        ctx.lineWidth = particleSize * (0.5 + wind.speed / 20);
        ctx.stroke();
        
        // Update particle
        const newLngLat = map.unproject([newX, newY]);
        particle.x = newLngLat.lng;
        particle.y = newLngLat.lat;
        particle.speed = wind.speed;
      }
      
      // Age particle
      particle.age++;
      
      // Reset if too old or out of bounds
      if (particle.age > particle.life ||
          particle.y < bounds.getSouth() ||
          particle.y > bounds.getNorth() ||
          particle.x < bounds.getWest() ||
          particle.x > bounds.getEast()) {
        particle.x = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest());
        particle.y = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth());
        particle.age = 0;
        particle.life = 50 + Math.random() * 100;
        
        const newWind = getWindAtPosition(particle.y, particle.x);
        particle.speed = newWind?.speed || 0;
      }
    });
    
    animationRef.current = requestAnimationFrame(animate);
  }, [map, isActive, speedFactor, particleSize, fadeOpacity, getWindAtPosition, getColorForSpeed]);

  useEffect(() => {
    if (!map || !isActive) return;
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'wind-particle-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '10';
    
    const resizeCanvas = () => {
      const container = map.getCanvasContainer();
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    
    resizeCanvas();
    map.getCanvasContainer().appendChild(canvas);
    canvasRef.current = canvas;
    
    // Build wind grid and init particles
    buildWindGrid();
    initParticles();
    
    // Start animation
    animate();
    
    // Handle map events
    const handleResize = () => {
      resizeCanvas();
      initParticles();
    };
    
    const handleMoveStart = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    
    const handleMoveEnd = () => {
      initParticles();
      animate();
    };
    
    map.on('resize', handleResize);
    map.on('movestart', handleMoveStart);
    map.on('moveend', handleMoveEnd);
    map.on('zoomstart', handleMoveStart);
    map.on('zoomend', handleMoveEnd);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      canvas.remove();
      map.off('resize', handleResize);
      map.off('movestart', handleMoveStart);
      map.off('moveend', handleMoveEnd);
      map.off('zoomstart', handleMoveStart);
      map.off('zoomend', handleMoveEnd);
    };
  }, [map, isActive, buildWindGrid, initParticles, animate]);

  // Update wind data when changed
  useEffect(() => {
    if (windData.length > 0) {
      buildWindGrid();
      initParticles();
    }
  }, [windData, buildWindGrid, initParticles]);

  return null;
}

export default WindParticleLayer;
