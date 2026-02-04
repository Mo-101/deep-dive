/**
 * Wind Particle Visualization Hook
 * Fetches real-time wind data from OpenWeather API
 * Creates animated particle system for wind visualization
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API;

// Wind data grid points for Africa region
const GRID_POINTS = {
    latRange: { min: -35, max: 15 },
    lonRange: { min: -20, max: 55 },
    resolution: 5, // degrees between points
};

interface WindDataPoint {
    lat: number;
    lon: number;
    speed: number; // m/s
    direction: number; // degrees (meteorological)
    u: number; // x component
    v: number; // y component
}

interface WindParticle {
    x: number;
    y: number;
    age: number;
    maxAge: number;
    speed: number;
    u: number;
    v: number;
}

interface UseWindDataResult {
    windData: WindDataPoint[];
    particles: WindParticle[];
    isLoading: boolean;
    lastUpdated: Date | null;
    error: string | null;
    refresh: () => void;
}

// Convert meteorological wind direction to math coordinates
function meteorologicalToMath(direction: number): number {
    // Meteorological: 0° = North, 90° = East
    // Math: 0° = East, 90° = North
    return (270 - direction + 360) % 360;
}

// Fetch wind data for a single point
async function fetchWindAtPoint(lat: number, lon: number): Promise<WindDataPoint | null> {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
        );

        if (!response.ok) return null;

        const data = await response.json();
        const speed = data.wind?.speed || 0;
        const direction = data.wind?.deg || 0;

        // Convert to u,v components
        const mathDir = meteorologicalToMath(direction);
        const radians = (mathDir * Math.PI) / 180;
        const u = speed * Math.cos(radians);
        const v = speed * Math.sin(radians);

        return { lat, lon, speed, direction, u, v };
    } catch (error) {
        console.error(`Failed to fetch wind at ${lat},${lon}:`, error);
        return null;
    }
}

// Generate grid of sample points
function generateGridPoints(): { lat: number; lon: number }[] {
    const points: { lat: number; lon: number }[] = [];

    for (let lat = GRID_POINTS.latRange.min; lat <= GRID_POINTS.latRange.max; lat += GRID_POINTS.resolution) {
        for (let lon = GRID_POINTS.lonRange.min; lon <= GRID_POINTS.lonRange.max; lon += GRID_POINTS.resolution) {
            points.push({ lat, lon });
        }
    }

    return points;
}

// Interpolate wind at a point using nearby data
function interpolateWind(
    lat: number,
    lon: number,
    windData: WindDataPoint[]
): { u: number; v: number; speed: number } {
    if (windData.length === 0) return { u: 0, v: 0, speed: 0 };

    // Find nearest points and interpolate
    let totalWeight = 0;
    let uSum = 0;
    let vSum = 0;

    windData.forEach((point) => {
        const dist = Math.sqrt(
            Math.pow(lat - point.lat, 2) + Math.pow(lon - point.lon, 2)
        );

        if (dist < 0.01) {
            // Very close, use directly
            return { u: point.u, v: point.v, speed: point.speed };
        }

        const weight = 1 / (dist * dist);
        totalWeight += weight;
        uSum += point.u * weight;
        vSum += point.v * weight;
    });

    if (totalWeight === 0) return { u: 0, v: 0, speed: 0 };

    const u = uSum / totalWeight;
    const v = vSum / totalWeight;
    const speed = Math.sqrt(u * u + v * v);

    return { u, v, speed };
}

export function useWindData(): UseWindDataResult {
    const [windData, setWindData] = useState<WindDataPoint[]>([]);
    const [particles] = useState<WindParticle[]>([]); // Not updated during animation to prevent re-renders
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasData, setHasData] = useState(false);

    const animationRef = useRef<number | null>(null);
    const particlesRef = useRef<WindParticle[]>([]);

    // Fetch wind data from OpenWeather
    const fetchWindData = useCallback(async () => {
        if (!OPENWEATHER_API_KEY) {
            setError('OpenWeather API key not configured');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const gridPoints = generateGridPoints();

            // Fetch in batches to avoid rate limiting
            const batchSize = 10;
            const results: WindDataPoint[] = [];

            for (let i = 0; i < gridPoints.length; i += batchSize) {
                const batch = gridPoints.slice(i, i + batchSize);
                const promises = batch.map((p) => fetchWindAtPoint(p.lat, p.lon));
                const batchResults = await Promise.all(promises);

                batchResults.forEach((r) => {
                    if (r) results.push(r);
                });

                // Rate limiting delay
                if (i + batchSize < gridPoints.length) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
            }

            setWindData(results);
            setLastUpdated(new Date());
            setHasData(results.length > 0);
            console.log(`[WindData] Fetched ${results.length} wind data points`);

            // Initialize particles
            initializeParticles(results);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch wind data');
            console.error('[WindData] Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initialize particle system
    const initializeParticles = useCallback((data: WindDataPoint[]) => {
        const numParticles = 2000;
        const newParticles: WindParticle[] = [];

        for (let i = 0; i < numParticles; i++) {
            const lat = GRID_POINTS.latRange.min + Math.random() * (GRID_POINTS.latRange.max - GRID_POINTS.latRange.min);
            const lon = GRID_POINTS.lonRange.min + Math.random() * (GRID_POINTS.lonRange.max - GRID_POINTS.lonRange.min);
            const { u, v, speed } = interpolateWind(lat, lon, data);

            newParticles.push({
                x: lon,
                y: lat,
                age: Math.floor(Math.random() * 100),
                maxAge: 100 + Math.floor(Math.random() * 50),
                speed,
                u,
                v,
            });
        }

        particlesRef.current = newParticles;
        // Note: We don't setParticles here - animation is handled imperatively via ref
    }, []);

    // Animate particles
    const animateParticles = useCallback(() => {
        const data = windData;
        const currentParticles = particlesRef.current;

        const updatedParticles = currentParticles.map((particle) => {
            let { x, y, age, maxAge } = particle;

            // Get wind at current position
            const { u, v, speed } = interpolateWind(y, x, data);

            // Move particle based on wind
            const speedFactor = 0.01; // Scale factor for visible movement
            x += u * speedFactor;
            y += v * speedFactor;
            age += 1;

            // Reset particle if too old or out of bounds
            if (
                age > maxAge ||
                x < GRID_POINTS.lonRange.min ||
                x > GRID_POINTS.lonRange.max ||
                y < GRID_POINTS.latRange.min ||
                y > GRID_POINTS.latRange.max
            ) {
                // Respawn at random position
                x = GRID_POINTS.lonRange.min + Math.random() * (GRID_POINTS.lonRange.max - GRID_POINTS.lonRange.min);
                y = GRID_POINTS.latRange.min + Math.random() * (GRID_POINTS.latRange.max - GRID_POINTS.latRange.min);
                age = 0;
                maxAge = 100 + Math.floor(Math.random() * 50);
            }

            return { ...particle, x, y, age, maxAge, u, v, speed };
        });

        particlesRef.current = updatedParticles;
        // Note: Don't call setParticles here - it causes infinite re-renders!
        // Animation is handled imperatively via particlesRef

        animationRef.current = requestAnimationFrame(animateParticles);
    }, [windData]);

    // Start/stop animation
    useEffect(() => {
        if (hasData && particlesRef.current.length > 0) {
            animationRef.current = requestAnimationFrame(animateParticles);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [hasData, animateParticles]);

    // Initial fetch
    useEffect(() => {
        fetchWindData();

        // Refresh every 30 minutes
        const interval = setInterval(fetchWindData, 30 * 60 * 1000);

        return () => clearInterval(interval);
    }, [fetchWindData]);

    return {
        windData,
        particles,
        isLoading,
        lastUpdated,
        error,
        refresh: fetchWindData,
    };
}

export default useWindData;
