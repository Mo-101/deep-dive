"""
WHO AFRO Disease Surveillance System
Integration with WHO African Regional Office health data
"""

import asyncio
import aiohttp
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import json
from loguru import logger

from config.settings import config

class WHOAFROFetcher:
    """Fetch disease outbreak data from WHO AFRO region"""
    
    def __init__(self):
        self.base_url = config.health.who_base_url
        self.api_key = config.health.who_api_key
        self.tracked_diseases = config.health.tracked_diseases
        
        # WHO AFRO member states (47 countries)
        self.afro_countries = [
            "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso",
            "Burundi", "Cabo Verde", "Cameroon", "Central African Republic",
            "Chad", "Comoros", "Congo", "Côte d'Ivoire", "Democratic Republic of the Congo",
            "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon",
            "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Lesotho",
            "Liberia", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius",
            "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "Sao Tome and Principe",
            "Senegal", "Seychelles", "Sierra Leone", "South Africa", "South Sudan",
            "Tanzania", "Togo", "Uganda", "Zambia", "Zimbabwe"
        ]
    
    async def fetch_recent_outbreaks(
        self,
        days_back: int = 30
    ) -> List[Dict]:
        """
        Fetch recent disease outbreaks from WHO
        
        Returns list of outbreaks with structure:
        {
            'disease': str,
            'country': str,
            'location': str,
            'coordinates': [lon, lat],
            'cases': int,
            'deaths': int,
            'date': str,
            'severity': str,  # high, medium, low
            'source': str
        }
        """
        outbreaks = []
        
        try:
            # Note: This is a template - actual WHO API structure may differ
            # You may need to use WHO's Disease Outbreak News (DON) or other endpoints
            
            logger.info(f"Fetching WHO AFRO outbreaks (last {days_back} days)")
            
            async with aiohttp.ClientSession() as session:
                for disease in self.tracked_diseases:
                    try:
                        # Construct API endpoint
                        url = f"{self.base_url}/outbreaks"
                        params = {
                            'disease': disease,
                            'region': 'AFRO',
                            'start_date': (datetime.now() - timedelta(days=days_back)).isoformat(),
                            'end_date': datetime.now().isoformat()
                        }
                        
                        headers = {
                            'Authorization': f'Bearer {self.api_key}' if self.api_key else '',
                            'Accept': 'application/json'
                        }
                        
                        async with session.get(url, params=params, headers=headers) as response:
                            if response.status == 200:
                                data = await response.json()
                                # Process outbreak data
                                for outbreak in data.get('outbreaks', []):
                                    processed = self.process_outbreak(outbreak)
                                    if processed:
                                        outbreaks.append(processed)
                            elif response.status == 404:
                                logger.debug(f"No data for {disease}")
                            else:
                                logger.warning(f"API error for {disease}: {response.status}")
                                
                    except Exception as e:
                        logger.error(f"Error fetching {disease}: {e}")
                        continue
            
            logger.success(f"✓ Fetched {len(outbreaks)} outbreaks from WHO AFRO")
            
        except Exception as e:
            logger.error(f"Error in WHO AFRO fetch: {e}")
        
        # If no API data, return sample data for testing
        if not outbreaks and not self.api_key:
            logger.warning("No API key - using sample outbreak data")
            outbreaks = self.get_sample_outbreaks()
        
        return outbreaks
    
    def process_outbreak(self, raw_data: Dict) -> Optional[Dict]:
        """Process raw WHO outbreak data into standardized format"""
        try:
            # Extract key fields (adjust based on actual API structure)
            outbreak = {
                'disease': raw_data.get('disease', 'Unknown'),
                'country': raw_data.get('country', 'Unknown'),
                'location': raw_data.get('location', raw_data.get('admin_level_1', 'Unknown')),
                'coordinates': self.get_coordinates(
                    raw_data.get('country'),
                    raw_data.get('location')
                ),
                'cases': raw_data.get('cases', 0),
                'deaths': raw_data.get('deaths', 0),
                'date': raw_data.get('report_date', datetime.now().isoformat()),
                'severity': self.calculate_severity(
                    raw_data.get('cases', 0),
                    raw_data.get('deaths', 0)
                ),
                'source': 'WHO AFRO',
                'who_id': raw_data.get('id', None)
            }
            
            return outbreak
            
        except Exception as e:
            logger.error(f"Error processing outbreak: {e}")
            return None
    
    def calculate_severity(self, cases: int, deaths: int) -> str:
        """Calculate outbreak severity based on cases and CFR"""
        if cases == 0:
            return 'low'
        
        cfr = deaths / cases  # Case Fatality Rate
        
        if cfr > 0.15 or cases > 100:
            return 'high'
        elif cfr > 0.05 or cases > 50:
            return 'medium'
        else:
            return 'low'
    
    def get_coordinates(
        self,
        country: Optional[str],
        location: Optional[str]
    ) -> Tuple[float, float]:
        """
        Get coordinates for outbreak location
        Uses geocoding or predefined coordinates for major cities
        """
        # Major African cities coordinates (simplified)
        city_coords = {
            # Nigeria
            'Lagos': (3.3792, 6.5244),
            'Abuja': (7.4951, 9.0765),
            'Ondo State': (5.195, 7.25),
            
            # DRC
            'Kinshasa': (15.322, -4.325),
            'Goma': (29.228, -1.679),
            
            # Kenya
            'Nairobi': (36.817, -1.286),
            'Mombasa': (39.668, -4.043),
            
            # Madagascar
            'Antananarivo': (47.5, -18.9),
            'Toamasina': (49.401, -18.144),
            
            # South Africa
            'Johannesburg': (28.047, -26.204),
            'Cape Town': (18.424, -33.925),
            
            # Ghana
            'Accra': (-0.187, 5.603),
            
            # Ethiopia
            'Addis Ababa': (38.746, 9.03),
            
            # Add more cities as needed
        }
        
        # Try location first
        if location and location in city_coords:
            lon, lat = city_coords[location]
            return [lon, lat]
        
        # Country centroids (simplified)
        country_coords = {
            'Nigeria': (8.0, 9.0),
            'Kenya': (37.0, 0.0),
            'DRC': (23.0, -3.0),
            'South Africa': (25.0, -29.0),
            'Madagascar': (47.0, -19.0),
            # Add more countries
        }
        
        if country and country in country_coords:
            lon, lat = country_coords[country]
            return [lon, lat]
        
        # Default to center of Africa
        return [20.0, 0.0]
    
    def get_sample_outbreaks(self) -> List[Dict]:
        """Return sample outbreak data for testing (based on real AFRO patterns)"""
        return [
            {
                'disease': 'Lassa Fever',
                'country': 'Nigeria',
                'location': 'Ondo State',
                'coordinates': [5.195, 7.25],
                'cases': 45,
                'deaths': 8,
                'date': (datetime.now() - timedelta(days=5)).isoformat(),
                'severity': 'high',
                'source': 'WHO AFRO (Sample)'
            },
            {
                'disease': 'Mpox',
                'country': 'DRC',
                'location': 'Kinshasa',
                'coordinates': [15.322, -4.325],
                'cases': 127,
                'deaths': 3,
                'date': (datetime.now() - timedelta(days=3)).isoformat(),
                'severity': 'medium',
                'source': 'WHO AFRO (Sample)'
            },
            {
                'disease': 'Cholera',
                'country': 'Kenya',
                'location': 'Nairobi',
                'coordinates': [36.817, -1.286],
                'cases': 89,
                'deaths': 12,
                'date': (datetime.now() - timedelta(days=2)).isoformat(),
                'severity': 'high',
                'source': 'WHO AFRO (Sample)'
            },
            {
                'disease': 'Cholera',
                'country': 'Madagascar',
                'location': 'Antananarivo',
                'coordinates': [47.5, -18.9],
                'cases': 156,
                'deaths': 22,
                'date': (datetime.now() - timedelta(days=1)).isoformat(),
                'severity': 'high',
                'source': 'WHO AFRO (Sample)'
            },
            {
                'disease': 'Yellow Fever',
                'country': 'Ghana',
                'location': 'Accra',
                'coordinates': [-0.187, 5.603],
                'cases': 23,
                'deaths': 2,
                'date': (datetime.now() - timedelta(days=7)).isoformat(),
                'severity': 'low',
                'source': 'WHO AFRO (Sample)'
            }
        ]
    
    async def save_outbreaks_geojson(
        self,
        outbreaks: List[Dict],
        output_file: Path
    ) -> bool:
        """Save outbreak data as GeoJSON for mapping"""
        try:
            features = []
            
            for outbreak in outbreaks:
                feature = {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': outbreak['coordinates']
                    },
                    'properties': {
                        'disease': outbreak['disease'],
                        'country': outbreak['country'],
                        'location': outbreak['location'],
                        'cases': outbreak['cases'],
                        'deaths': outbreak['deaths'],
                        'date': outbreak['date'],
                        'severity': outbreak['severity'],
                        'source': outbreak['source']
                    }
                }
                features.append(feature)
            
            geojson = {
                'type': 'FeatureCollection',
                'features': features,
                'metadata': {
                    'source': 'WHO AFRO Disease Surveillance',
                    'generated': datetime.now().isoformat(),
                    'num_outbreaks': len(outbreaks)
                }
            }
            
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, 'w') as f:
                json.dump(geojson, f, indent=2)
            
            logger.success(f"✓ Saved {len(outbreaks)} outbreaks to {output_file.name}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving outbreak GeoJSON: {e}")
            return False
    
    async def check_convergence(
        self,
        outbreaks: List[Dict],
        cyclone_data: List[Dict],
        distance_threshold_km: float = 500
    ) -> List[Dict]:
        """
        Check for climate-health convergence zones
        Where cyclones and disease outbreaks intersect
        """
        from geopy.distance import geodesic
        
        convergences = []
        
        try:
            for outbreak in outbreaks:
                outbreak_loc = tuple(reversed(outbreak['coordinates']))  # (lat, lon)
                
                for cyclone in cyclone_data:
                    cyclone_loc = (cyclone['location']['lat'], cyclone['location']['lon'])
                    
                    # Calculate distance
                    distance = geodesic(outbreak_loc, cyclone_loc).kilometers
                    
                    if distance < distance_threshold_km:
                        convergence = {
                            'outbreak': {
                                'disease': outbreak['disease'],
                                'location': outbreak['location'],
                                'severity': outbreak['severity'],
                                'cases': outbreak['cases']
                            },
                            'cyclone': {
                                'location': cyclone['location'],
                                'probability': cyclone['track_probability'],
                                'threat_level': cyclone['threat_level']
                            },
                            'distance_km': round(distance, 1),
                            'risk_score': self.calculate_convergence_risk(outbreak, cyclone, distance),
                            'alert_priority': 'HIGH' if distance < 200 else 'MEDIUM'
                        }
                        
                        convergences.append(convergence)
                        
                        logger.warning(
                            f"⚠️  CONVERGENCE: {outbreak['disease']} in {outbreak['location']} "
                            f"+ Cyclone ({cyclone['threat_level']}) - {distance:.0f}km apart"
                        )
            
            if convergences:
                logger.success(f"✓ Identified {len(convergences)} convergence zones")
            
        except Exception as e:
            logger.error(f"Error checking convergence: {e}")
        
        return convergences
    
    def calculate_convergence_risk(
        self,
        outbreak: Dict,
        cyclone: Dict,
        distance_km: float
    ) -> float:
        """
        Calculate risk score for climate-health convergence
        Score 0-1 based on multiple factors
        """
        risk = 0.0
        
        # Distance factor (closer = higher risk)
        distance_factor = max(0, 1 - (distance_km / 500))
        risk += distance_factor * 0.3
        
        # Outbreak severity
        severity_scores = {'low': 0.2, 'medium': 0.5, 'high': 0.8}
        risk += severity_scores.get(outbreak['severity'], 0.5) * 0.3
        
        # Cyclone probability
        risk += cyclone['track_probability'] * 0.2
        
        # Outbreak size factor
        cases_factor = min(1.0, outbreak['cases'] / 200)
        risk += cases_factor * 0.2
        
        return round(risk, 3)

# Example usage
async def main():
    """Test WHO AFRO fetcher"""
    logger.info("🦠 Testing WHO AFRO disease surveillance...")
    
    fetcher = WHOAFROFetcher()
    
    # Fetch outbreaks
    outbreaks = await fetcher.fetch_recent_outbreaks(days_back=30)
    
    if outbreaks:
        logger.success(f"✓ Found {len(outbreaks)} outbreaks")
        
        # Show summary
        for outbreak in outbreaks:
            logger.info(
                f"  - {outbreak['disease']} in {outbreak['location']}, {outbreak['country']}: "
                f"{outbreak['cases']} cases, {outbreak['deaths']} deaths [{outbreak['severity'].upper()}]"
            )
        
        # Save as GeoJSON
        output_file = Path("data/geojson/who_outbreaks.geojson")
        await fetcher.save_outbreaks_geojson(outbreaks, output_file)
    else:
        logger.error("✗ No outbreak data retrieved")

if __name__ == "__main__":
    asyncio.run(main())
