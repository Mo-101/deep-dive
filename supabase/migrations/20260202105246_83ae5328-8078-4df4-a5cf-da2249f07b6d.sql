-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Disaster types enum
CREATE TYPE disaster_type AS ENUM ('cyclone', 'flood', 'drought', 'landslide');

-- Severity levels enum
CREATE TYPE severity_level AS ENUM ('low', 'moderate', 'high', 'severe', 'extreme');

-- Forecasts table - stores metadata about forecast runs
CREATE TABLE public.forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'FNV3', -- e.g., 'FNV3', 'ECMWF', 'GFS'
  model_name TEXT NOT NULL, -- e.g., 'Google DeepMind FNV3'
  forecast_time TIMESTAMP WITH TIME ZONE NOT NULL, -- When the forecast was made
  valid_time TIMESTAMP WITH TIME ZONE NOT NULL, -- When the forecast is valid for
  lead_time_hours INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on forecasts
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;

-- Anyone can read forecasts (public data)
CREATE POLICY "Forecasts are publicly readable" 
  ON public.forecasts FOR SELECT USING (true);

-- Disaster types configuration table
CREATE TABLE public.disaster_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type disaster_type NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  icon TEXT,
  color TEXT NOT NULL, -- Hex color for map visualization
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disaster_types ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Disaster types are publicly readable" 
  ON public.disaster_types FOR SELECT USING (true);

-- Insert default disaster types
INSERT INTO public.disaster_types (type, display_name, icon, color) VALUES
  ('cyclone', 'Tropical Cyclone', 'wind', '#E63946'),
  ('flood', 'Flood', 'droplets', '#457B9D'),
  ('drought', 'Drought', 'sun', '#F4A261'),
  ('landslide', 'Landslide', 'mountain', '#8B4513');

-- Regions table - African countries, ocean basins, regional hubs
CREATE TABLE public.regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE, -- ISO code or custom identifier
  region_type TEXT NOT NULL, -- 'country', 'ocean_basin', 'regional_hub'
  parent_region_id UUID REFERENCES public.regions(id),
  geometry GEOMETRY(Geometry, 4326), -- GeoJSON polygon
  center_lat DOUBLE PRECISION,
  center_lon DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Regions are publicly readable" 
  ON public.regions FOR SELECT USING (true);

-- Insert African ocean basins and regional hubs
INSERT INTO public.regions (name, code, region_type, center_lat, center_lon) VALUES
  ('Indian Ocean', 'IO', 'ocean_basin', -10.0, 70.0),
  ('Southern Hemisphere', 'SH', 'ocean_basin', -25.0, 40.0),
  ('East Africa', 'ICPAC', 'regional_hub', 1.0, 38.0),
  ('Southern Africa', 'SADC', 'regional_hub', -25.0, 25.0),
  ('West Africa', 'ECOWAS', 'regional_hub', 10.0, 0.0),
  ('North Africa', 'NAFR', 'regional_hub', 28.0, 15.0);

-- Cyclone tracks table - individual storm trajectories
CREATE TABLE public.cyclone_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  forecast_id UUID NOT NULL REFERENCES public.forecasts(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL, -- e.g., 'IO192026', 'SH982026'
  storm_name TEXT, -- Named storm (if applicable)
  basin TEXT NOT NULL, -- 'IO', 'SH', etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cyclone_tracks ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Cyclone tracks are publicly readable" 
  ON public.cyclone_tracks FOR SELECT USING (true);

-- Create index for faster lookups
CREATE INDEX idx_cyclone_tracks_forecast ON public.cyclone_tracks(forecast_id);
CREATE INDEX idx_cyclone_tracks_track_id ON public.cyclone_tracks(track_id);

-- Hotspots table - geospatial probability points
CREATE TABLE public.hotspots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  forecast_id UUID NOT NULL REFERENCES public.forecasts(id) ON DELETE CASCADE,
  track_id UUID REFERENCES public.cyclone_tracks(id) ON DELETE SET NULL,
  disaster_type disaster_type NOT NULL DEFAULT 'cyclone',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
  lead_time_hours INTEGER NOT NULL DEFAULT 0,
  valid_time TIMESTAMP WITH TIME ZONE,
  -- Probability fields (0-1 scale)
  hurricane_prob DOUBLE PRECISION,
  track_prob DOUBLE PRECISION,
  intensity_prob DOUBLE PRECISION,
  -- Meteorological data
  wind_speed_kt DOUBLE PRECISION, -- knots
  wind_speed_ms DOUBLE PRECISION, -- m/s
  pressure_hpa DOUBLE PRECISION,
  radius_r8_km DOUBLE PRECISION, -- Storm radius at 8 m/s wind
  radius_r34_km DOUBLE PRECISION, -- 34 kt wind radius
  radius_r50_km DOUBLE PRECISION, -- 50 kt wind radius
  radius_r64_km DOUBLE PRECISION, -- 64 kt wind radius
  -- Metadata
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hotspots ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Hotspots are publicly readable" 
  ON public.hotspots FOR SELECT USING (true);

-- Geospatial index for fast location queries
CREATE INDEX idx_hotspots_location ON public.hotspots USING GIST(location);
CREATE INDEX idx_hotspots_forecast ON public.hotspots(forecast_id);
CREATE INDEX idx_hotspots_track ON public.hotspots(track_id);
CREATE INDEX idx_hotspots_disaster_type ON public.hotspots(disaster_type);

-- Alerts table - generated warnings
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  forecast_id UUID REFERENCES public.forecasts(id) ON DELETE SET NULL,
  disaster_type disaster_type NOT NULL,
  severity severity_level NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  affected_regions TEXT[], -- Region codes
  affected_countries TEXT[], -- ISO country codes
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location GEOMETRY(Point, 4326),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Alerts are publicly readable" 
  ON public.alerts FOR SELECT USING (true);

-- Index for active alerts
CREATE INDEX idx_alerts_active ON public.alerts(is_active) WHERE is_active = true;
CREATE INDEX idx_alerts_disaster_type ON public.alerts(disaster_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for alerts
CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();