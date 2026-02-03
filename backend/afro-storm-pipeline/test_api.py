import requests
import json

BASE_URL = "http://localhost:8000"

def test_health():
    print("\n[Testing /health]")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

def test_ifa_reading():
    print("\n[Testing /api/ifa-reading]")
    payload = {
        "situation_type": "convergence",
        "location": {"lat": -19.5, "lon": 47.5},
        "severity": "high",
        "question": "What is the best way to protect Antananarivo?"
    }
    try:
        response = requests.post(f"{BASE_URL}/api/ifa-reading", json=payload)
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

def test_analyze_convergence():
    print("\n[Testing /api/analyze-convergence]")
    payload = {
        "cyclone": {
            "id": "STORM_001",
            "location": {"lat": -19.5, "lon": 47.25},
            "track_probability": 0.8,
            "wind_speed": 45.0,
            "threat_level": "TROPICAL_STORM",
            "forecast_hour": 24
        },
        "outbreak": {
            "id": "OUT_001",
            "disease": "Cholera",
            "location": {"lat": -18.9, "lon": 47.5},
            "country": "Madagascar",
            "cases": 156,
            "deaths": 22,
            "severity": "high"
        },
        "distance_km": 71.4
    }
    try:
        response = requests.post(f"{BASE_URL}/api/analyze-convergence", json=payload)
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_health()
    test_ifa_reading()
    test_analyze_convergence()
