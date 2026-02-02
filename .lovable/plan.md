

# 🌍 AFRO Storm — African Continental Multi-Hazard Early Warning System

*"No one left behind. No disaster unseen."*

---

## The Mission

Building Africa's first purpose-built weather disaster surveillance engine — a command center that gives communities the TIME to survive. Starting with tropical cyclones, expanding to floods, droughts, and landslides. This is the foundation of continental climate sovereignty.

---

## Phase 1: Command Center Foundation

### 1.1 Full-Screen Mapbox Map
- Dark operations-center theme covering all of Africa and surrounding oceans
- African-inspired accent colors (warm golds, deep reds, ocean blues)
- Smooth zoom from continental view to local impact zones
- Satellite/terrain toggle for situational awareness

### 1.2 Database Architecture (Supabase)
| Table | Purpose |
|-------|---------|
| `forecasts` | Forecast metadata (source, model, timestamp, lead time) |
| `cyclone_tracks` | Individual storm trajectories with track IDs |
| `hotspots` | Geospatial probability points (lat/lon, hurricane_prob, track_prob) |
| `disaster_types` | Configurable types (cyclone, flood, drought, landslide) |
| `regions` | African countries, ocean basins, regional hubs |
| `alerts` | Generated warnings with severity levels |

### 1.3 Initial Data Loading
- Parse your `cyclone_hotspots_jan31.json` data
- Load the 3 detected cyclone tracks (IO192026, SH982026, SH992026)
- Store with proper geospatial indexing for fast queries

---

## Phase 2: Cyclone Visualization (MVP)

### 2.1 Hotspot Layer
- Render probability points as pulsing circles on the map
- Color gradient: Green (low) → Yellow → Orange → Red (high hurricane probability)
- Size scaled by track probability
- Click for detailed probability breakdown

### 2.2 Track Visualization
- Animated polylines showing storm trajectories
- Time markers every 6 hours along the path
- Wind speed indicators at each point
- Intensity coloring (tropical storm → category 1-5)

### 2.3 Collapsible Sidebar (Left Edge)
- **Forecast Selector**: Date/time picker with available forecasts
- **Data Source Badge**: "Google DeepMind FNV3" with model info
- **Active Storms List**: Quick navigation to each tracked cyclone
- **Probability Legend**: Color scale explanation
- **Quick Stats**: Total hotspots, max probability, storms tracked

### 2.4 Storm Detail Panel (Slides from Right)
- Storm name/ID and current position
- Wind speed, pressure, storm radius (r8)
- 6-hour forecast positions
- Countries/regions in potential path
- Historical comparison (once data accumulates)

---

## Phase 3: Real-Time Operations Features

### 3.1 Continental Threat Bar (Top)
- Regional threat levels: Indian Ocean | East Africa | Southern Africa | West Africa
- Color-coded severity badges
- Click to zoom to that region
- Active event counters

### 3.2 Time Animation Controls
- Slider to step through forecast lead times (T+0h to T+240h)
- Play/pause animation
- Speed controls for briefings
- "Jump to peak intensity" button

### 3.3 Search & Filter
- Search by storm name, location, or region
- Filter by probability threshold
- Filter by forecast model/source
- Toggle historical vs. current forecasts

---

## Phase 4: Data Ingestion API

### 4.1 REST Endpoints (Edge Functions)
```
POST   /api/forecasts           — Ingest new forecast data
GET    /api/forecasts           — List available forecasts  
GET    /api/forecasts/:id       — Get forecast details
GET    /api/forecasts/:id/hotspots  — Get hotspots for forecast
GET    /api/tracks              — List active cyclone tracks
GET    /api/tracks/:id          — Get track trajectory
GET    /api/hotspots?region=...&min_prob=...  — Query by criteria
```

### 4.2 Data Format Support
- JSON format (like your uploaded hotspots file)
- CSV track format (like your FNV3 paired files)
- Ready for NetCDF processing (future phase)

### 4.3 API Security
- API key authentication for external systems
- Rate limiting for protection
- Audit logging for all ingestion

---

## Phase 5: Future Expansion (Architecture Ready)

### 5.1 Multi-Hazard Support
- Same map interface, toggle between disaster types
- Flood risk layers (when data sources connected)
- Drought indices (SPI, SPEI visualization)
- Landslide susceptibility zones

### 5.2 ECMWF Integration (Template Ready)
- Module structure for IFS forecasts
- ERA5 historical validation
- 51-member ensemble processing
- Placeholder for API credentials

### 5.3 AMHEWAS Compliance
- GeoJSON exports for myDEWETRA
- Regional hub data feeds
- Continental Watch integration points

---

## Technical Architecture

| Component | Technology |
|-----------|------------|
| Frontend | React + TypeScript + Tailwind CSS |
| Map | Mapbox GL JS (dark theme) |
| Backend | Supabase via Lovable Cloud |
| Database | PostgreSQL with PostGIS |
| API | Supabase Edge Functions |
| Charts | Recharts |
| State | TanStack Query |

---

## Immediate Deliverables

When implemented, you'll have:

1. ✅ Full-screen Mapbox command center with dark operations theme
2. ✅ Your Jan 31 cyclone hotspots visualized with probability colors
3. ✅ 3 cyclone tracks (IO192026, SH982026, SH992026) rendered
4. ✅ Interactive sidebar with storm list and legend
5. ✅ Detail panels for each storm
6. ✅ Database storing all forecast data
7. ✅ API endpoints for external system integration
8. ✅ Architecture ready for floods, droughts, landslides

---

*This is the beginning of African climate sovereignty. Every feature serves one purpose: giving communities the time to survive.*

