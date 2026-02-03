# 🌤️ OpenWeatherMap Integration

## Overview

Full 5-day weather forecast integration using OpenWeatherMap API with the provided API key.

---

## 🔑 API Configuration

```env
VITE_OPENWEATHER_API="32b25b6e6eb45b6df18d92b934c332a7"
```

**API Endpoint Used:**
```
https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={API_KEY}&units=metric&cnt=40
```

---

## 📊 Features

### 5-Day Forecast with 3-Hour Intervals
- **40 timestamps** covering 5 days
- **3-hour granularity** for detailed forecasting
- **Real-time updates** from OpenWeatherMap servers

### Weather Parameters
| Parameter | Description | Unit |
|-----------|-------------|------|
| Temperature | Current, feels_like, min, max | °C (metric) |
| Pressure | Sea level and ground level | hPa |
| Humidity | Relative humidity | % |
| Wind Speed | Wind velocity | m/s |
| Wind Direction | Meteorological degrees | ° |
| Visibility | Average visibility | meters |
| Cloud Cover | Cloudiness percentage | % |
| Precipitation Probability | Chance of rain/snow | 0-1 |
| Rain/Snow Volume | Last 3 hours | mm |

---

## 🎨 UI Components

### Main Weather Panel
```
┌─────────────────────────────────────────────┐
│  🌤️ Antananarivo        28°C               │
│  5-Day Forecast (3hr)    Partly Cloudy     │
├─────────────────────────────────────────────┤
│  💧 Rain  💨 Wind  📊 Pressure  👁️ Vis      │
│  40%      5m/s     1013hPa      10km       │
├─────────────────────────────────────────────┤
│  [======●==========]  -6h   -3h   Now      │
│     ⏮    ⏯/⏸    ⏭                        │
│  0.5x   1x   2x                            │
└─────────────────────────────────────────────┘
```

### Mini Forecast Strip
```
┌─────────────────────────────────────────────────────────────┐
│  M  T  W  T  F  S  S                                        │
│  06 12 18 00 06 12 18 00                                   │
│  🌤️ 🌧️ ⛅ 🌤️ 🌧️ 🌤️ ⛅ 🌤️                                   │
│  26° 24° 28° 27° 23° 29° 28° 30°                           │
│  20% 80% 10% 15% 60% 5% 10% 0%                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎮 Controls

### Playback Controls
| Button | Action |
|--------|--------|
| ⏮ | Previous 3-hour frame |
| ⏯/⏸ | Play/Pause animation |
| ⏭ | Next 3-hour frame |

### Speed Controls
| Speed | Description |
|-------|-------------|
| 0.5x | 2 seconds per frame |
| 1x | 1 second per frame |
| 2x | 0.5 seconds per frame |

---

## 🎨 Visual Features

### Temperature Color Coding
```css
< 0°C:   #3b82f6 (Blue)
< 10°C:  #06b6d4 (Cyan)
< 20°C:  #22c55e (Green)
< 30°C:  #eab308 (Yellow)
< 35°C:  #f97316 (Orange)
> 35°C:  #ef4444 (Red)
```

### Weather Icons
Uses OpenWeatherMap's official icon set:
- `https://openweathermap.org/img/wn/{icon}@2x.png`

Icon codes:
- `01d/n` - Clear sky
- `02d/n` - Few clouds
- `03d/n` - Scattered clouds
- `04d/n` - Broken clouds
- `09d/n` - Shower rain
- `10d/n` - Rain
- `11d/n` - Thunderstorm
- `13d/n` - Snow
- `50d/n` - Mist

---

## 🗂️ File Structure

```
src/components/weather/
├── OpenWeatherMapLayer.tsx    # Main weather layer component
└── index.ts                   # Exports
```

---

## 🔌 Integration

### Added to AfricaMap
```typescript
// New state
const [showOpenWeatherMap, setShowOpenWeatherMap] = useState(false);

// Toggle button (yellow)
<button onClick={() => setShowOpenWeatherMap(!showOpenWeatherMap)}>
  <GlobeIcon /> OWM
</button>

// Component usage
<OpenWeatherMapLayer
  map={mapRef.current}
  visible={showOpenWeatherMap}
  center={[25, 0]}  // Africa center
  opacity={0.8}
/>
```

---

## 📡 API Response Structure

```typescript
interface ForecastData {
  cod: string;
  message: number;
  cnt: number;
  list: WeatherData[];  // 40 items (5 days × 8 intervals)
  city: {
    id: number;
    name: string;
    coord: { lat: number; lon: number };
    country: string;
    population: number;
    timezone: number;
  };
}

interface WeatherData {
  dt: number;              // Unix timestamp
  main: {
    temp: number;          // Current temp
    feels_like: number;    // Feels like temp
    temp_min: number;      // Min temp
    temp_max: number;      // Max temp
    pressure: number;      // Pressure (hPa)
    humidity: number;      // Humidity (%)
  };
  weather: [{
    id: number;            // Weather condition ID
    main: string;          // Group (Rain, Snow, etc.)
    description: string;   // Description
    icon: string;          // Icon code
  }];
  clouds: { all: number }; // Cloudiness (%)
  wind: {
    speed: number;         // Wind speed (m/s)
    deg: number;           // Direction (degrees)
    gust?: number;         // Wind gust (m/s)
  };
  visibility: number;      // Visibility (meters)
  pop: number;             // Precipitation probability (0-1)
  rain?: { '3h': number }; // Rain volume (mm)
  snow?: { '3h': number }; // Snow volume (mm)
  sys: { pod: string };    // Part of day (n/d)
  dt_txt: string;          // Date/time text
}
```

---

## 🚀 Usage

### Toggle Layer
1. Click the **OWM** button (yellow) on bottom-left controls
2. Weather panel appears at bottom-center
3. Click play to animate through 5-day forecast
4. Click any time in mini strip to jump to that forecast

### Data Refresh
- Auto-fetches when:
  - Layer is toggled on
  - Map center changes (future enhancement)
- No auto-refresh during animation to preserve API limits

---

## 📊 API Limits (Free Tier)

| Limit | Value |
|-------|-------|
| Calls per minute | 60 |
| Calls per day | 1,000,000 |
| Forecast days | 5 |
| Historical data | Not available (requires paid plan) |

---

## 🔮 Future Enhancements

- [ ] Dynamic location based on map center
- [ ] Multiple city forecasts
- [ ] Weather alerts integration
- [ ] Historical weather comparison
- [ ] Air pollution data (separate API)
- [ ] UV index display
- [ ] Sunrise/sunset times

---

## 📚 References

- [OpenWeatherMap 5 Day Forecast API](https://openweathermap.org/forecast5)
- [Weather Condition Codes](https://openweathermap.org/weather-conditions)
- [API Documentation](https://openweathermap.org/api)

---

**5-day weather forecast powered by OpenWeatherMap** 🌍
