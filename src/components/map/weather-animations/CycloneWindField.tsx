/**
 * Cyclone Wind Field Visualization
 * Shows rotating wind patterns around cyclone centers
 * Inspired by Google WeatherLab's cyclone visualizations
 */

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

interface CycloneData {
  id: string;
  center: { lat: number; lon: number };
  maxWindSpeed: number; // m/s
  radius: number; // km
  pressure: number; // hPa
  category: 'TD' | 'TS' | 'CAT1' | 'CAT2' | 'CAT3' | 'CAT4' | 'CAT5';
  movementDirection: number; // degrees
  movementSpeed: number; // km/h
}

interface CycloneWindFieldProps {
  map: mapboxgl.Map | null;
  cyclones: CycloneData[];
  showWindField?: boolean;
  showEyeWall?: boolean;
  isActive?: boolean;
}

// Generate synthetic wind field around cyclone center
function generateCycloneWindField(
  center: { lat: number; lon: number },
  maxWindSpeed: number,
  radius: number,
  resolution: number = 50
): Array<{ lat: number; lon: number; u: number; v: number; speed: number }> {
  const windField = [];
  const R = 6371; // Earth radius in km

  for (let i = 0; i < resolution; i++) {
    const angle = (i / resolution) * 2 * Math.PI;

    for (let r = 10; r <= radius; r += 20) {
      // Calculate position
      const lat = center.lat + (r / R) * (180 / Math.PI) * Math.cos(angle);
      const lon = center.lon + (r / R) * (180 / Math.PI) * Math.sin(angle) / Math.cos(center.lat * Math.PI / 180);

      // Cyclone wind profile: maximum at certain radius, decreasing toward center and edge
      const normalizedRadius = r / radius;
      const windProfile = Math.exp(-Math.pow((normalizedRadius - 0.3) / 0.4, 2));
      const speed = maxWindSpeed * windProfile;

      // Tangential wind (counter-clockwise in Southern Hemisphere, clockwise in North)
      // For Africa (mostly Northern Hemisphere cyclones)
      const isNorthernHemisphere = center.lat > 0;
      const direction = isNorthernHemisphere ? angle + Math.PI / 2 : angle - Math.PI / 2;

      // Add inward component (spiral toward center)
      const inwardFactor = 0.3;
      const u = speed * (Math.cos(direction) - inwardFactor * Math.cos(angle));
      const v = speed * (Math.sin(direction) - inwardFactor * Math.sin(angle));

      windField.push({ lat, lon, u, v, speed });
    }
  }

  return windField;
}

// Generate eye wall particles
function generateEyeWallParticles(
  center: { lat: number; lon: number },
  eyeWallRadius: number = 30,
  particleCount: number = 200
): Array<{ lat: number; lon: number; angle: number; speed: number }> {
  const particles = [];

  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * 2 * Math.PI;
    const variation = (Math.random() - 0.5) * 0.1; // Small random variation

    const R = 6371;
    const lat = center.lat + (eyeWallRadius / R) * (180 / Math.PI) * Math.cos(angle + variation);
    const lon = center.lon + (eyeWallRadius / R) * (180 / Math.PI) * Math.sin(angle + variation) / Math.cos(center.lat * Math.PI / 180);

    particles.push({
      lat,
      lon,
      angle: angle + variation,
      speed: 15 + Math.random() * 10, // High speed in eye wall
    });
  }

  return particles;
}

export function CycloneWindField({
  map,
  cyclones,
  showWindField = true,
  showEyeWall = true,
  isActive = true,
}: CycloneWindFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const windFieldsRef = useRef<Map<string, ReturnType<typeof generateCycloneWindField>>>(new Map());
  const eyeWallsRef = useRef<Map<string, ReturnType<typeof generateEyeWallParticles>>>(new Map());

  // Generate wind fields for all cyclones
  const updateWindFields = useCallback(() => {
    windFieldsRef.current.clear();
    eyeWallsRef.current.clear();

    cyclones.forEach(cyclone => {
      const windField = generateCycloneWindField(
        cyclone.center,
        cyclone.maxWindSpeed,
        cyclone.radius
      );
      windFieldsRef.current.set(cyclone.id, windField);

      const eyeWall = generateEyeWallParticles(cyclone.center, 30, 300);
      eyeWallsRef.current.set(cyclone.id, eyeWall);
    });
  }, [cyclones]);

  // Get color based on wind speed and category
  const getWindColor = useCallback((speed: number, category: string) => {
    const colors: Record<string, string> = {
      'TD': 'rgba(100, 200, 255, ',
      'TS': 'rgba(100, 255, 100, ',
      'CAT1': 'rgba(255, 255, 100, ',
      'CAT2': 'rgba(255, 200, 50, ',
      'CAT3': 'rgba(255, 150, 50, ',
      'CAT4': 'rgba(255, 100, 50, ',
      'CAT5': 'rgba(255, 50, 100, ',
    };

    const baseColor = colors[category] || colors['TS'];
    const alpha = Math.min(0.3 + speed / 50, 0.9);
    return baseColor + alpha + ')';
  }, []);

  // Animation loop
  const animate = useCallback((time: number) => {
    if (!map || !canvasRef.current || !isActive) {
      console.log('[CycloneWindField] Animation stopped - map:', !!map, 'canvas:', !!canvasRef.current, 'isActive:', isActive);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear with fade effect
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    cyclones.forEach(cyclone => {
      const center = map.project([cyclone.center.lon, cyclone.center.lat]);

      // Draw eye wall
      if (showEyeWall) {
        const eyeWall = eyeWallsRef.current.get(cyclone.id);
        if (eyeWall) {
          ctx.beginPath();

          eyeWall.forEach((particle, i) => {
            // Rotate particle around center
            const rotationSpeed = cyclone.maxWindSpeed / 30; // Rotation based on wind speed
            const currentAngle = particle.angle + (time / 1000) * rotationSpeed;

            const R = 6371;
            const radius = 30; // Eye wall radius in km
            const lat = cyclone.center.lat + (radius / R) * (180 / Math.PI) * Math.cos(currentAngle);
            const lon = cyclone.center.lon + (radius / R) * (180 / Math.PI) * Math.sin(currentAngle) / Math.cos(cyclone.center.lat * Math.PI / 180);

            const point = map.project([lon, lat]);

            if (i === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          });

          ctx.closePath();
          ctx.strokeStyle = getWindColor(cyclone.maxWindSpeed, cyclone.category);
          ctx.lineWidth = 3;
          ctx.stroke();

          // Draw eye (calm center)
          ctx.beginPath();
          ctx.arc(center.x, center.y, 8, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Draw wind field particles
      if (showWindField) {
        const windField = windFieldsRef.current.get(cyclone.id);
        if (windField) {
          windField.forEach((wind, i) => {
            // Animate particles along wind direction
            const offset = (time / 1000 + i * 0.1) % 1;
            const moveLat = wind.lat + wind.v * offset * 0.01;
            const moveLon = wind.lon + wind.u * offset * 0.01;

            const point = map.project([moveLon, moveLat]);

            // Draw particle
            const size = 1 + wind.speed / 20;
            ctx.beginPath();
            ctx.arc(point.x, point.y, size, 0, 2 * Math.PI);
            ctx.fillStyle = getWindColor(wind.speed, cyclone.category);
            ctx.fill();

            // Draw velocity vector
            const vectorScale = 5;
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(
              point.x + wind.u * vectorScale,
              point.y - wind.v * vectorScale
            );
            ctx.strokeStyle = getWindColor(wind.speed, cyclone.category);
            ctx.lineWidth = 0.5;
            ctx.stroke();
          });
        }
      }

      // Draw category label
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      ctx.strokeText(cyclone.category, center.x + 15, center.y - 15);
      ctx.fillText(cyclone.category, center.x + 15, center.y - 15);
      ctx.globalCompositeOperation = 'lighter';
    });

    animationRef.current = requestAnimationFrame((t) => animate(t));
  }, [map, isActive, cyclones, showWindField, showEyeWall, getWindColor]);

  useEffect(() => {
    if (!map || !isActive) {
      console.log('[CycloneWindField] Not starting - map:', !!map, 'isActive:', isActive);
      return;
    }

    console.log('[CycloneWindField] Starting with', cyclones.length, 'cyclones');

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'cyclone-wind-field-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '15';

    const resizeCanvas = () => {
      const container = map.getCanvasContainer();
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      console.log('[CycloneWindField] Canvas resized:', canvas.width, 'x', canvas.height);
    };

    resizeCanvas();
    map.getCanvasContainer().appendChild(canvas);
    canvasRef.current = canvas;
    console.log('[CycloneWindField] Canvas added to map');

    // Generate initial wind fields
    updateWindFields();

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
  }, [map, isActive, animate, updateWindFields]);

  // Update when cyclones change
  useEffect(() => {
    updateWindFields();
  }, [cyclones, updateWindFields]);

  return null;
}

export default CycloneWindField;
