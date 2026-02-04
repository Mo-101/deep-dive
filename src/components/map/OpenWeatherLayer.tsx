/**
 * OpenWeather Real-Time Weather Layer
 * Displays current weather conditions across Africa
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cloud, Sun, CloudRain, Wind, Thermometer, Droplets, Eye, Gauge } from 'lucide-react';

interface WeatherStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  temp: number; // Celsius
  humidity: number; // %
  windSpeed: number; // m/s
  windDeg: number; // degrees
  weather: string;
  description: string;
  icon: string;
  pressure: number; // hPa
  visibility: number; // meters
  rain_1h?: number; // mm
}

interface OpenWeatherLayerProps {
  map: mapboxgl.Map | null;
  isVisible: boolean;
  apiKey: string;
}

// Major African cities for weather monitoring
const MONITORING_STATIONS = [
  { name: 'Lagos', lat: 6.5244, lon: 3.3792, country: 'Nigeria' },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357, country: 'Egypt' },
  { name: 'Kinshasa', lat: -4.4419, lon: 15.2663, country: 'DRC' },
  { name: 'Johannesburg', lat: -26.2041, lon: 28.0473, country: 'South Africa' },
  { name: 'Nairobi', lat: -1.2921, lon: 36.8219, country: 'Kenya' },
  { name: 'Addis Ababa', lat: 9.1450, lon: 38.7311, country: 'Ethiopia' },
  { name: 'Accra', lat: 5.6037, lon: -0.1870, country: 'Ghana' },
  { name: 'Dar es Salaam', lat: -6.7924, lon: 39.2083, country: 'Tanzania' },
  { name: 'Casablanca', lat: 33.5731, lon: -7.5898, country: 'Morocco' },
  { name: 'Beira', lat: -19.8314, lon: 34.8370, country: 'Mozambique' },
  { name: 'Antananarivo', lat: -18.8792, lon: 47.5079, country: 'Madagascar' },
  { name: 'Dakar', lat: 14.7167, lon: -17.4677, country: 'Senegal' },
  { name: 'Kampala', lat: 0.3476, lon: 32.5825, country: 'Uganda' },
  { name: 'Harare', lat: -17.8252, lon: 31.0335, country: 'Zimbabwe' },
  { name: 'Luanda', lat: -8.8390, lon: 13.2894, country: 'Angola' },
  { name: 'Abidjan', lat: 5.3600, lon: -4.0083, country: 'Ivory Coast' },
  { name: 'Khartoum', lat: 15.5007, lon: 32.5599, country: 'Sudan' },
  { name: 'Douala', lat: 4.0511, lon: 9.7679, country: 'Cameroon' },
  { name: 'Lusaka', lat: -15.3875, lon: 28.3228, country: 'Zambia' },
  { name: 'Maputo', lat: -25.9692, lon: 32.5732, country: 'Mozambique' },
];

export function OpenWeatherLayer({ map, isVisible, apiKey }: OpenWeatherLayerProps) {
  const [stations, setStations] = useState<WeatherStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStation, setSelectedStation] = useState<WeatherStation | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // Fetch weather data
  const fetchWeatherData = async () => {
    if (!apiKey) {
      console.warn('OpenWeather API key not provided');
      return;
    }

    setLoading(true);
    const weatherData: WeatherStation[] = [];

    try {
      // Fetch weather for each station
      for (const station of MONITORING_STATIONS) {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${station.lat}&lon=${station.lon}&appid=${apiKey}&units=metric`
        );

        if (response.ok) {
          const data = await response.json();
          weatherData.push({
            id: `weather-${data.id}`,
            name: station.name,
            lat: station.lat,
            lon: station.lon,
            temp: Math.round(data.main.temp),
            humidity: data.main.humidity,
            windSpeed: data.wind.speed,
            windDeg: data.wind.deg || 0,
            weather: data.weather[0].main,
            description: data.weather[0].description,
            icon: data.weather[0].icon,
            pressure: data.main.pressure,
            visibility: data.visibility || 10000,
            rain_1h: data.rain?.['1h'],
          });
        }
      }

      setStations(weatherData);
    } catch (error) {
      console.error('Error fetching weather:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and interval
  useEffect(() => {
    if (isVisible && apiKey) {
      fetchWeatherData();
      const interval = setInterval(fetchWeatherData, 10 * 60 * 1000); // 10 minutes
      return () => clearInterval(interval);
    }
  }, [isVisible, apiKey]);

  // Update markers on map
  useEffect(() => {
    if (!map || !isVisible) {
      // Clear markers when hidden
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
      return;
    }

    // Clear existing
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    // Add weather markers
    stations.forEach(station => {
      const el = document.createElement('div');
      el.className = 'weather-marker';
      el.innerHTML = `
        <div class="weather-station">
          <img src="https://openweathermap.org/img/wn/${station.icon}.png" alt="${station.weather}" />
          <span class="temp">${station.temp}°C</span>
        </div>
      `;

      el.addEventListener('click', () => setSelectedStation(station));

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([station.lon, station.lat])
        .addTo(map);

      markersRef.current.set(station.id, marker);
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
    };
  }, [map, stations, isVisible]);

  if (!isVisible) return null;

  return (
    <>
      {/* Weather Control Panel */}
      <Card className="absolute top-4 left-4 z-50 bg-black/80 backdrop-blur-xl border-white/10 p-4 w-64">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sun className="w-4 h-4 text-yellow-400" />
            Weather Monitoring
          </h3>
          {loading && <span className="text-xs text-white/50">Loading...</span>}
        </div>

        <p className="text-xs text-white/50 mb-3">
          {MONITORING_STATIONS.length} stations across Africa
          <br />
          Updates every 10 minutes
        </p>

        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs border-white/10 text-white/70 hover:bg-white/10"
          onClick={fetchWeatherData}
          disabled={loading}
        >
          Refresh Weather
        </Button>

        {stations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-2 max-h-48 overflow-y-auto">
            {stations.slice(0, 5).map(station => (
              <div
                key={station.id}
                className="flex items-center justify-between text-xs cursor-pointer hover:bg-white/5 p-1 rounded"
                onClick={() => setSelectedStation(station)}
              >
                <span className="text-white/70">{station.name}</span>
                <span className="text-white font-medium">{station.temp}°C</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Weather Detail Popup */}
      {selectedStation && (
        <Card className="absolute bottom-16 left-4 z-50 bg-black/90 backdrop-blur-xl border-white/10 p-4 w-72">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-lg font-bold text-white">{selectedStation.name}</h4>
              <p className="text-xs text-white/50 capitalize">
                {selectedStation.description}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white/60 hover:text-white"
              onClick={() => setSelectedStation(null)}
            >
              ×
            </Button>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <img
              src={`https://openweathermap.org/img/wn/${selectedStation.icon}@2x.png`}
              alt={selectedStation.weather}
              className="w-16 h-16"
            />
            <div>
              <span className="text-3xl font-bold text-white">
                {selectedStation.temp}°C
              </span>
              <p className="text-sm text-white/60">{selectedStation.weather}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/5 p-2 rounded flex items-center gap-2">
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
              <div>
                <span className="text-white/50">Humidity</span>
                <p className="text-white font-medium">{selectedStation.humidity}%</p>
              </div>
            </div>
            <div className="bg-white/5 p-2 rounded flex items-center gap-2">
              <Wind className="w-3.5 h-3.5 text-cyan-400" />
              <div>
                <span className="text-white/50">Wind</span>
                <p className="text-white font-medium">{selectedStation.windSpeed} m/s</p>
              </div>
            </div>
            <div className="bg-white/5 p-2 rounded flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5 text-green-400" />
              <div>
                <span className="text-white/50">Pressure</span>
                <p className="text-white font-medium">{selectedStation.pressure} hPa</p>
              </div>
            </div>
            <div className="bg-white/5 p-2 rounded flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-yellow-400" />
              <div>
                <span className="text-white/50">Visibility</span>
                <p className="text-white font-medium">{(selectedStation.visibility / 1000).toFixed(1)} km</p>
              </div>
            </div>
          </div>

          {selectedStation.rain_1h && (
            <div className="mt-2 bg-blue-500/10 border border-blue-500/20 p-2 rounded">
              <div className="flex items-center gap-2 text-blue-400">
                <CloudRain className="w-4 h-4" />
                <span className="text-xs font-medium">
                  Rain (1h): {selectedStation.rain_1h} mm
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      <style>{`
        .weather-station {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          border-radius: 8px;
          padding: 4px 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .weather-station:hover {
          background: rgba(0, 0, 0, 0.9);
          border-color: rgba(255, 255, 255, 0.3);
          transform: scale(1.05);
        }
        
        .weather-station img {
          width: 32px;
          height: 32px;
        }
        
        .weather-station .temp {
          color: white;
          font-size: 11px;
          font-weight: 600;
        }
      `}</style>
    </>
  );
}

export default OpenWeatherLayer;
