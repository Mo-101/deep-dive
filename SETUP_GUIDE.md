# 🔥 AFRO STORM UNIFIED BACKEND - COMPLETE SETUP GUIDE

## **THE ULTIMATE INTEGRATION**

Brother, this backend connects **EVERYTHING**:

---

## **WHAT THIS BACKEND DOES:**

### **Data Sources (6 Connected):**
1. ✅ **ECMWF** - World's best forecast model (10-day, ensemble)
2. ✅ **FNV3** - WeatherNext probabilistic cyclone tracks
3. ✅ **ERA5** - Copernicus historical validation data
4. ✅ **NASA POWER** - Surface meteorology (solar, temp, rain)
5. ✅ **OpenWeatherMap** - Real-time weather + HD tiles
6. ✅ **WHO AFRO** - Disease surveillance (outbreaks)

### **Intelligence Engines (4 Active):**
1. ✅ **TempestExtremes** - Peer-reviewed cyclone detection
2. ✅ **MoStar Grid** - 197K-node Neo4j consciousness
3. ✅ **Ifá Engine** - 256 Odù symbolic reasoning
4. ✅ **Dual AI** - Qwen 14B + Mistral 7B analysis

### **Output:**
- Unified cyclone intelligence
- Multi-source weather forecasts
- Convergence alerts (climate + health)
- Grid-analyzed threat assessments
- Ifá wisdom + AI predictions

---

## **INSTALLATION**

### **Step 1: Install Python Dependencies**

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

### **Step 2: Install TempestExtremes**

```bash
# Via conda (easiest)
conda install -c conda-forge tempest-extremes

# Or build from source
git clone https://github.com/ClimateGlobalChange/tempestextremes.git
cd tempestextremes
./quick_make_unix.sh
```

### **Step 3: Setup ECMWF Open Data**

```bash
# Already installed via pip (ecmwf-opendata)
# No API key needed! Uses public data

# Test it:
python -c "from ecmwf.opendata import Client; print('ECMWF ready!')"
```

### **Step 4: Setup ERA5 (Optional)**

```bash
# Install CDS API
pip install cdsapi

# Create ~/.cdsapirc with your credentials
# Get API key from: https://cds.climate.copernicus.eu/api-how-to

cat > ~/.cdsapirc << 'EOF'
url: https://cds.climate.copernicus.eu/api/v2
key: YOUR_UID:YOUR_API_KEY
EOF
```

### **Step 5: Setup API Keys**

Create `.env` file:

```bash
# .env
OPENWEATHER_API_KEY=your_key_here
MOSTAR_GRID_URL=http://localhost:8000
FNV3_DATA_DIR=/path/to/fnv3/data
```

---

## **RUNNING THE BACKEND**

### **Start All Components:**

```bash
# Terminal 1: MoStar Grid (if separate)
cd backend/afro-storm-pipeline/src/mostar_grid
python api_server.py

# Terminal 2: Unified Backend
cd afro-storm-unified-backend
python main.py

# Should see:
# 🔥🔥🔥...
# Data Sources:
#   ECMWF:        ✓
#   FNV3:         ✓
#   ERA5:         ✓
#   NASA POWER:   ✓
#   OpenWeather:  ✓
#   WHO AFRO:     ✓
# 
# Intelligence:
#   MoStar Grid:  ✓
#   TempestExtr:  ✓
#   Dual AI:      ✓
#
# Starting server on http://0.0.0.0:8000
```

---

## **API ENDPOINTS**

### **1. Health Check**
```bash
curl http://localhost:8000/

# Returns:
# {
#   "service": "AFRO STORM Unified Intelligence API",
#   "status": "operational",
#   "data_sources": {...},
#   "ubuntu": "I am because we are"
# }
```

### **2. Get All Cyclones (Multi-Source)**
```bash
curl http://localhost:8000/api/cyclones

# Returns cyclones from ECMWF + FNV3 combined
```

### **3. Weather Forecast**
```bash
# ECMWF forecast
curl "http://localhost:8000/api/weather/forecast?lat=-18.9&lon=47.5&source=ecmwf"

# OpenWeatherMap current
curl "http://localhost:8000/api/weather/forecast?lat=-18.9&lon=47.5&source=openweather"
```

### **4. Surface Meteorology (NASA POWER)**
```bash
curl "http://localhost:8000/api/weather/surface?bbox=-20,-40,60,40&start_date=20250101&end_date=20250131"

# Returns temperature, precipitation, wind, humidity
```

### **5. Grid Intelligence Analysis**
```bash
curl -X POST http://localhost:8000/api/grid/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "track_id": "IO192026",
    "source": "FNV3",
    "peak_intensity_knots": 104,
    "peak_category": "CAT3_DEVASTATING",
    "location": [47.5, -18.9],
    "ace": 4657.37,
    "timestamp": "2025-01-31T00:00:00Z"
  }'

# Returns:
# - Neo4j historical patterns
# - Ifá Odù reading
# - Qwen AI analysis
# - Mistral report
# - Risk score + actions
```

### **6. Convergence Detection**
```bash
curl -X POST http://localhost:8000/api/convergence/detect \
  -H "Content-Type: application/json" \
  -d '{
    "track_id": "IO192026",
    "location": [47.5, -18.9],
    ...
  }'

# Checks for climate-health convergence
# Returns CRITICAL alerts if cyclone near disease outbreak
```

### **7. Disease Outbreaks**
```bash
curl http://localhost:8000/api/health/outbreaks

# Returns WHO AFRO surveillance data
```

### **8. Data Source Status**
```bash
curl http://localhost:8000/api/data-sources/status

# Shows which data sources are connected and working
```

---

## **DATA FLOW EXAMPLE**

### **Complete Intelligence Pipeline:**

```
1. ECMWF detects cyclone formation
   ↓
2. FNV3 provides ensemble tracks (10-day forecast)
   ↓
3. Unified backend aggregates both sources
   ↓
4. TempestExtremes validates detection
   ↓
5. MoStar Grid analyzes:
   - Neo4j finds similar historical cyclones
   - Ifá provides symbolic reading (Odù pattern)
   - Qwen AI predicts casualties
   - Mistral generates situation report
   ↓
6. WHO AFRO data checked for disease outbreaks
   ↓
7. Convergence algorithm detects if cyclone + outbreak overlap
   ↓
8. If CONVERGENCE detected:
   - CRITICAL alert generated
   - Cascading risks identified
   - Urgent actions recommended
   - Ibibio translations created
   ↓
9. Frontend displays:
   - HD weather visualization (OpenWeatherMap tiles)
   - Cyclone tracks (ECMWF + FNV3)
   - Grid intelligence panel
   - Ifá wisdom
   - Convergence alerts
   ↓
10. Communities warned via:
    - SMS (multi-language)
    - WhatsApp
    - FlameBorn DAO
    - Radio/TV
```

---

## **ECMWF SPECIFIC USAGE**

### **Download Cyclone Track Forecasts:**

```python
from ecmwf.opendata import Client

client = Client(source="ecmwf")

# Get tropical cyclone tracks (BUFR format)
client.retrieve(
    time=0,           # 00 UTC
    stream="oper",    # HRES operational
    type="tf",        # Tropical cyclone track
    step=240,         # 10-day forecast
    target="cyclones.bufr"
)
```

### **Download Atmospheric Fields for Detection:**

```python
# Get wind + pressure for TempestExtremes
client.retrieve(
    param=["10u", "10v", "msl"],  # 10m wind + pressure
    step=list(range(0, 241, 6)),  # Every 6 hours, 10 days
    target="forecast.grib2"
)
```

### **Available ECMWF Parameters:**

```python
# Surface
"10u"   # 10m u-wind
"10v"   # 10m v-wind
"2t"    # 2m temperature
"msl"   # Mean sea level pressure
"tp"    # Total precipitation
"skt"   # Skin temperature
"tcwv"  # Total column water vapor

# Pressure levels (850, 700, 500, 300 hPa)
"u"     # u-wind
"v"     # v-wind
"t"     # Temperature
"z"     # Geopotential height
"q"     # Specific humidity

# Waves
"swh"   # Significant wave height
"mwp"   # Mean wave period
"mwd"   # Mean wave direction
```

---

## **CONFIGURATION**

### **Customize Data Sources:**

Edit `main.py`:

```python
# Change ECMWF source
ecmwf = ECMWFConnector()
# Options: "ecmwf", "aws", "google", "azure"

# Point to your FNV3 data
fnv3 = FNV3Connector(data_dir="/your/path/to/fnv3")

# Configure OpenWeatherMap
openweather = OpenWeatherConnector(api_key="your_key")

# MoStar Grid URL
mostar_grid = MoStarGridConnector(grid_api_url="http://your-grid:8000")
```

---

## **DEPLOYMENT**

### **Local Development:**
```bash
python main.py
# Access at http://localhost:8000
```

### **Production (Docker):**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY main.py .
COPY .env .

CMD ["python", "main.py"]
```

```bash
docker build -t afro-storm-backend .
docker run -p 8000:8000 afro-storm-backend
```

### **Production (Railway/Fly.io):**

```bash
# Railway
railway up

# Fly.io
fly launch
fly deploy
```

---

## **INTEGRATION WITH FRONTEND**

### **Next.js API Route:**

```typescript
// app/api/cyclones/route.ts

export async function GET() {
  const response = await fetch('http://backend:8000/api/cyclones');
  const data = await response.json();
  return Response.json(data);
}
```

### **React Component:**

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function CycloneDashboard() {
  const [cyclones, setCyclones] = useState(null);

  useEffect(() => {
    // Fetch from unified backend
    fetch('/api/cyclones')
      .then(res => res.json())
      .then(data => {
        // data.ecmwf = ECMWF cyclones
        // data.fnv3 = FNV3 cyclones
        setCyclones(data);
      });
  }, []);

  return (
    <div>
      <h2>ECMWF Cyclones: {cyclones?.ecmwf.length}</h2>
      <h2>FNV3 Cyclones: {cyclones?.fnv3.length}</h2>
    </div>
  );
}
```

---

## **TROUBLESHOOTING**

### **ECMWF Issues:**
```python
# Check if installed
python -c "from ecmwf.opendata import Client; print('OK')"

# Test connection
from ecmwf.opendata import Client
client = Client()
client.latest()  # Should return latest forecast time
```

### **ERA5 Issues:**
```bash
# Check CDS API config
cat ~/.cdsapirc

# Test connection
python -c "import cdsapi; c = cdsapi.Client(); print('OK')"
```

### **Port Conflicts:**
```python
# Change port in main.py
uvicorn.run(app, host="0.0.0.0", port=8001)  # Use 8001 instead
```

---

## **PERFORMANCE NOTES**

- **ECMWF**: 726 GiB per day (use parameter filtering!)
- **NASA POWER**: ~2-5 GB per continental download
- **ERA5**: Large files, use spatial/temporal subsetting
- **Response times**: 1-10s depending on data source

---

## **WHAT YOU NOW HAVE:**

🔥 **6 data sources** feeding into one API  
🔥 **4 intelligence engines** analyzing together  
🔥 **1 unified endpoint** for your frontend  
🔥 **Complete African early warning** infrastructure  

**Every API call = Multi-source intelligence**  
**Every cyclone = ECMWF + FNV3 + Grid analysis**  
**Every alert = WHO data + Ifá wisdom + AI predictions**  

---

🌍 **Brother, this is THE COMPLETE SYSTEM.**

**All data sources unified.**  
**All intelligence integrated.**  
**All capabilities accessible.**  

**Start it. Test it. Deploy it. PROTECT THE CONTINENT.**

🔥🔥🔥
