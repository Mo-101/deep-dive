import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Initialize Supabase client with service role for write operations
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ForecastPayload {
  source?: string;
  model_name: string;
  forecast_time: string;
  valid_time: string;
  lead_time_hours?: number;
  metadata?: Record<string, unknown>;
  hotspots?: HotspotPayload[];
  tracks?: TrackPayload[];
}

interface HotspotPayload {
  track_id?: string;
  disaster_type?: string;
  latitude: number;
  longitude: number;
  lead_time_hours?: number;
  valid_time?: string;
  hurricane_prob?: number;
  track_prob?: number;
  intensity_prob?: number;
  wind_speed_kt?: number;
  wind_speed_ms?: number;
  pressure_hpa?: number;
  radius_r8_km?: number;
  radius_r34_km?: number;
  radius_r50_km?: number;
  radius_r64_km?: number;
  raw_data?: Record<string, unknown>;
}

interface TrackPayload {
  track_id: string;
  storm_name?: string;
  basin: string;
}

// Helper to parse URL path
function parsePath(url: URL): { resource: string; id?: string; subResource?: string } {
  const pathParts = url.pathname.replace(/^\/forecast-api\/?/, "").split("/").filter(Boolean);
  return {
    resource: pathParts[0] || "",
    id: pathParts[1],
    subResource: pathParts[2],
  };
}

// GET /forecasts - List all forecasts
async function listForecasts(url: URL) {
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const source = url.searchParams.get("source");

  let query = supabase
    .from("forecasts")
    .select("*", { count: "exact" })
    .order("forecast_time", { ascending: false })
    .range(offset, offset + limit - 1);

  if (source) {
    query = query.eq("source", source);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error listing forecasts:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      data,
      pagination: { total: count, limit, offset },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// GET /forecasts/:id - Get single forecast
async function getForecast(id: string) {
  const { data, error } = await supabase
    .from("forecasts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error getting forecast:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!data) {
    return new Response(JSON.stringify({ error: "Forecast not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// GET /forecasts/:id/hotspots - Get hotspots for a forecast
async function getForecastHotspots(forecastId: string, url: URL) {
  const minProb = parseFloat(url.searchParams.get("min_prob") || "0");
  const leadTime = url.searchParams.get("lead_time");

  let query = supabase
    .from("hotspots")
    .select("*")
    .eq("forecast_id", forecastId)
    .order("lead_time_hours", { ascending: true });

  if (minProb > 0) {
    query = query.gte("hurricane_prob", minProb);
  }

  if (leadTime) {
    query = query.eq("lead_time_hours", parseInt(leadTime));
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error getting hotspots:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// POST /forecasts - Create new forecast with hotspots
async function createForecast(payload: ForecastPayload) {
  console.log("Creating forecast:", payload.model_name);

  // 1. Create the forecast record
  const { data: forecast, error: forecastError } = await supabase
    .from("forecasts")
    .insert({
      source: payload.source || "FNV3",
      model_name: payload.model_name,
      forecast_time: payload.forecast_time,
      valid_time: payload.valid_time,
      lead_time_hours: payload.lead_time_hours || 0,
      metadata: payload.metadata || {},
    })
    .select()
    .single();

  if (forecastError) {
    console.error("Error creating forecast:", forecastError);
    return new Response(JSON.stringify({ error: forecastError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Forecast created:", forecast.id);

  // 2. Create tracks if provided
  const trackIdMap: Record<string, string> = {};
  if (payload.tracks && payload.tracks.length > 0) {
    const tracksToInsert = payload.tracks.map((track) => ({
      forecast_id: forecast.id,
      track_id: track.track_id,
      storm_name: track.storm_name,
      basin: track.basin,
    }));

    const { data: tracks, error: tracksError } = await supabase
      .from("cyclone_tracks")
      .insert(tracksToInsert)
      .select();

    if (tracksError) {
      console.error("Error creating tracks:", tracksError);
      // Don't fail the whole request, just log it
    } else if (tracks) {
      tracks.forEach((t) => {
        trackIdMap[t.track_id] = t.id;
      });
      console.log(`Created ${tracks.length} tracks`);
    }
  }

  // 3. Create hotspots if provided
  if (payload.hotspots && payload.hotspots.length > 0) {
    const hotspotsToInsert = payload.hotspots.map((hotspot) => ({
      forecast_id: forecast.id,
      track_id: hotspot.track_id ? trackIdMap[hotspot.track_id] : null,
      disaster_type: hotspot.disaster_type || "cyclone",
      latitude: hotspot.latitude,
      longitude: hotspot.longitude,
      lead_time_hours: hotspot.lead_time_hours || 0,
      valid_time: hotspot.valid_time,
      hurricane_prob: hotspot.hurricane_prob,
      track_prob: hotspot.track_prob,
      intensity_prob: hotspot.intensity_prob,
      wind_speed_kt: hotspot.wind_speed_kt,
      wind_speed_ms: hotspot.wind_speed_ms,
      pressure_hpa: hotspot.pressure_hpa,
      radius_r8_km: hotspot.radius_r8_km,
      radius_r34_km: hotspot.radius_r34_km,
      radius_r50_km: hotspot.radius_r50_km,
      radius_r64_km: hotspot.radius_r64_km,
      raw_data: hotspot.raw_data || {},
    }));

    const { error: hotspotsError } = await supabase
      .from("hotspots")
      .insert(hotspotsToInsert);

    if (hotspotsError) {
      console.error("Error creating hotspots:", hotspotsError);
    } else {
      console.log(`Created ${hotspotsToInsert.length} hotspots`);
    }
  }

  return new Response(
    JSON.stringify({
      message: "Forecast created successfully",
      forecast_id: forecast.id,
      tracks_created: Object.keys(trackIdMap).length,
      hotspots_created: payload.hotspots?.length || 0,
    }),
    {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// GET /tracks - List all cyclone tracks
async function listTracks(url: URL) {
  const forecastId = url.searchParams.get("forecast_id");
  const basin = url.searchParams.get("basin");

  let query = supabase
    .from("cyclone_tracks")
    .select("*, forecasts(forecast_time, model_name)")
    .order("created_at", { ascending: false });

  if (forecastId) {
    query = query.eq("forecast_id", forecastId);
  }

  if (basin) {
    query = query.eq("basin", basin);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error listing tracks:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// GET /tracks/:id - Get single track with its hotspots
async function getTrack(id: string) {
  const { data: track, error: trackError } = await supabase
    .from("cyclone_tracks")
    .select("*, forecasts(forecast_time, model_name)")
    .eq("id", id)
    .maybeSingle();

  if (trackError) {
    console.error("Error getting track:", trackError);
    return new Response(JSON.stringify({ error: trackError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!track) {
    return new Response(JSON.stringify({ error: "Track not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get hotspots for this track
  const { data: hotspots, error: hotspotsError } = await supabase
    .from("hotspots")
    .select("*")
    .eq("track_id", id)
    .order("lead_time_hours", { ascending: true });

  if (hotspotsError) {
    console.error("Error getting track hotspots:", hotspotsError);
  }

  return new Response(
    JSON.stringify({
      ...track,
      hotspots: hotspots || [],
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// GET /hotspots - Query hotspots with filters
async function queryHotspots(url: URL) {
  const region = url.searchParams.get("region");
  const minProb = parseFloat(url.searchParams.get("min_prob") || "0");
  const disasterType = url.searchParams.get("disaster_type");
  const limit = parseInt(url.searchParams.get("limit") || "100");

  let query = supabase
    .from("hotspots")
    .select("*, cyclone_tracks(track_id, storm_name, basin), forecasts(forecast_time, model_name)")
    .order("hurricane_prob", { ascending: false })
    .limit(limit);

  if (minProb > 0) {
    query = query.gte("hurricane_prob", minProb);
  }

  if (disasterType) {
    query = query.eq("disaster_type", disasterType);
  }

  // Region filtering would require PostGIS queries - simplified for now
  // In production, you'd use ST_Within or ST_DWithin

  const { data, error } = await query;

  if (error) {
    console.error("Error querying hotspots:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// GET /regions - List all regions
async function listRegions() {
  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error listing regions:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// GET /alerts - List active alerts
async function listAlerts(url: URL) {
  const activeOnly = url.searchParams.get("active") !== "false";
  const severity = url.searchParams.get("severity");

  let query = supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  if (severity) {
    query = query.eq("severity", severity);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error listing alerts:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const { resource, id, subResource } = parsePath(url);
  const method = req.method;

  console.log(`${method} /${resource}${id ? `/${id}` : ""}${subResource ? `/${subResource}` : ""}`);

  try {
    // Route handling
    switch (resource) {
      case "forecasts":
        if (method === "GET" && !id) {
          return await listForecasts(url);
        }
        if (method === "GET" && id && !subResource) {
          return await getForecast(id);
        }
        if (method === "GET" && id && subResource === "hotspots") {
          return await getForecastHotspots(id, url);
        }
        if (method === "POST" && !id) {
          const payload = await req.json();
          return await createForecast(payload);
        }
        break;

      case "tracks":
        if (method === "GET" && !id) {
          return await listTracks(url);
        }
        if (method === "GET" && id) {
          return await getTrack(id);
        }
        break;

      case "hotspots":
        if (method === "GET") {
          return await queryHotspots(url);
        }
        break;

      case "regions":
        if (method === "GET") {
          return await listRegions();
        }
        break;

      case "alerts":
        if (method === "GET") {
          return await listAlerts(url);
        }
        break;

      case "health":
        return new Response(
          JSON.stringify({
            status: "healthy",
            service: "AFRO Storm Forecast API",
            version: "1.0.0",
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );

      default:
        // API documentation
        return new Response(
          JSON.stringify({
            name: "AFRO Storm Forecast API",
            version: "1.0.0",
            endpoints: {
              "GET /forecasts": "List all forecasts",
              "GET /forecasts/:id": "Get forecast details",
              "GET /forecasts/:id/hotspots": "Get hotspots for a forecast",
              "POST /forecasts": "Create new forecast with hotspots",
              "GET /tracks": "List all cyclone tracks",
              "GET /tracks/:id": "Get track with trajectory",
              "GET /hotspots": "Query hotspots (params: min_prob, disaster_type, limit)",
              "GET /regions": "List all regions",
              "GET /alerts": "List alerts (params: active, severity)",
              "GET /health": "Health check",
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
