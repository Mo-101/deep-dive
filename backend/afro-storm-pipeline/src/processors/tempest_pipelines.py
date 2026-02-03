
import xarray as xr
import numpy as np
import subprocess
import os
import json
import pandas as pd
from pathlib import Path
from typing import Optional, List, Dict, Any
from loguru import logger

class TempestPipeline:
    """
    AFRO Storm Integration for TempestExtremes
    Complete pipeline: FNV3 -> TempestExtremes -> GeoJSON
    Based on the 'Gold Standard' methodology
    """
    
    def __init__(self, tempest_bin_dir: str = "bin"):
        self.tempest_bin = Path(tempest_bin_dir)
        self.detect_nodes = self.tempest_bin / "DetectNodes"
        self.stitch_nodes = self.tempest_bin / "StitchNodes"
        
        # Verify binaries exist (warn if not)
        if not self.detect_nodes.exists():
            logger.warning(f"TempestExtremes binary not found: {self.detect_nodes}. Please install/build it.")

    def prepare_fnv3_for_tempestextremes(self, fnv3_file: str, output_file: str) -> str:
        """
        Convert FNV3 NetCDF to format TempestExtremes can process
        """
        logger.info(f"🔥 Processing: {fnv3_file}")
        logger.info("  1. Preparing data...")
        
        try:
            # Load FNV3 data
            ds = xr.open_dataset(fnv3_file)
            
            # Map FNV3 variables to TempestExtremes expectations
            # TempestExtremes needs: PSL (sea level pressure), U850, V850
            
            output_ds = xr.Dataset({
                'PSL': ds['slp'] if 'slp' in ds else ds['msl'],  # Sea level pressure
                'U850': ds['u850'] if 'u850' in ds else ds['u'], # U-wind
                'V850': ds['v850'] if 'v850' in ds else ds['v'], # V-wind
                'lat': ds['lat'],
                'lon': ds['lon'],
                'time': ds['time']
            })
            
            # Ensure proper units (Pa vs hPa)
            if output_ds['PSL'].max() < 2000:  # If in hPa
                logger.info("    Converting Pressure hPa -> Pa")
                output_ds['PSL'] = output_ds['PSL'] * 100
            
            # Save
            output_ds.to_netcdf(output_file)
            logger.success(f"✓ Prepared: {output_file}")
            
            return output_file
            
        except Exception as e:
            logger.error(f"Error preparing FNV3 data: {e}")
            raise

    def run_detection(self, input_nc: str, output_txt: str):
        """Run DetectNodes (Find Cyclone Centers)"""
        logger.info("  2. Detecting cyclones...")
        
        cmd = [
            str(self.detect_nodes),
            "--in_data", input_nc,
            "--out", output_txt,
            "--searchbymin", "PSL",
            "--closedcontourcmd", "PSL,200.0,5.5,0",
            "--mergedist", "6.0",
            "--outputcmd", "PSL,min,0;_VECMAG(U850,V850),max,2",
            "--timefilter", "3hr", # Assuming 3hr data step
            "--latname", "lat",
            "--lonname", "lon"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"DetectNodes failed: {result.stderr}")
            raise RuntimeError(f"DetectNodes failed: {result.stderr}")
            
        logger.success(f"✓ Detections saved: {output_txt}")

    def run_stitching(self, input_txt: str, output_txt: str):
        """Run StitchNodes (Connect Detections)"""
        logger.info("  3. Stitching tracks...")
        
        cmd = [
            str(self.stitch_nodes),
            "--in", input_txt,
            "--out", output_txt,
            "--range", "8.0",
            "--minlength", "10",
            "--maxgap", "1",
            "--threshold", "lat,<=,50.0,8;lat,>=,-50.0,8"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"StitchNodes failed: {result.stderr}")
            raise RuntimeError(f"StitchNodes failed: {result.stderr}")
            
        logger.success(f"✓ Tracks stitched: {output_txt}")

    def tempest_tracks_to_geojson(self, track_file: str, output_file: str) -> str:
        """
        Convert TempestExtremes track file to GeoJSON for AFRO Storm
        """
        logger.info("  4. Converting to GeoJSON...")
        
        tracks = []
        current_track = None
        
        try:
            with open(track_file, 'r') as f:
                for line in f:
                    parts = line.strip().split()
                    if not parts: continue

                    if line.startswith('start'):
                        if current_track:
                            tracks.append(current_track)
                        
                        track_id = parts[1]
                        current_track = {
                            'track_id': track_id,
                            'points': [],
                            'max_wind': 0,
                            'min_pressure': 999999,
                            'peak_location': None
                        }
                    else:
                        # Output format based on --outputcmd
                        # Standard assumption: start 
                        # i j lon lat year month day hour psl wind
                        # 0 1 2   3   4    5     6   7    8   9    10
                        
                        try:
                            # Adjust indices if needed based on actual output format
                            point = {
                                'lon': float(parts[3]),
                                'lat': float(parts[4]),
                                'year': int(parts[5]),
                                'month': int(parts[6]),
                                'day': int(parts[7]),
                                'hour': int(parts[8]),
                                'pressure': float(parts[9]) if len(parts) > 9 else None,
                                'wind': float(parts[10]) if len(parts) > 10 else None
                            }
                            
                            current_track['points'].append(point)
                            
                            if point['wind'] and point['wind'] > current_track['max_wind']:
                                current_track['max_wind'] = point['wind']
                                current_track['peak_location'] = [point['lon'], point['lat']]
                            
                            if point['pressure'] and point['pressure'] < current_track['min_pressure']:
                                current_track['min_pressure'] = point['pressure']
                                
                        except (ValueError, IndexError):
                            continue
            
            # Add last track
            if current_track:
                tracks.append(current_track)
            
            # Convert to GeoJSON Features
            features = []
            
            for track in tracks:
                if not track['points']: continue

                # Calculate category
                max_wind_kt = track['max_wind'] * 1.944  # m/s to knots
                category = self._get_category(max_wind_kt)
                
                # Calculate ACE (Accumulated Cyclone Energy) approximation
                # ACE = 10^-4 * sum(vmax^2) for vmax >= 35kt, every 6hr
                # We have 3hr data usually, so careful with scaling
                ace = sum((p['wind'] * 1.944)**2 for p in track['points'] if p['wind'] and p['wind']*1.944 >= 34) / 10000
                
                feature = {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': [[p['lon'], p['lat']] for p in track['points']]
                    },
                    'properties': {
                        'track_id': track['track_id'],
                        'peak_intensity_knots': round(max_wind_kt, 1),
                        'peak_category': category,
                        'min_pressure_hpa': round(track['min_pressure'] / 100, 1), # Pa -> hPa
                        'ace': round(ace, 2),
                        'peak_location': track['peak_location'],
                        'num_points': len(track['points']),
                        'duration_hours': len(track['points']) * 3,
                        'timestamps': [
                            f"{p['year']}-{p['month']:02d}-{p['day']:02d}T{p['hour']:02d}:00:00Z" 
                            for p in track['points']
                        ]
                    }
                }
                
                features.append(feature)
            
            geojson = {
                'type': 'FeatureCollection',
                'features': features
            }
            
            with open(output_file, 'w') as f:
                json.dump(geojson, f, indent=2)
            
            logger.success(f"✓ Converted {len(features)} tracks to GeoJSON")
            return output_file
            
        except Exception as e:
            logger.error(f"GeoJSON conversion failed: {e}")
            raise

    def _get_category(self, speed_kt):
        if speed_kt >= 137: return "CAT5_CATASTROPHIC"
        if speed_kt >= 113: return "CAT4_EXTREME"
        if speed_kt >= 96: return "CAT3_DEVASTATING"
        if speed_kt >= 83: return "CAT2_DANGEROUS"
        if speed_kt >= 64: return "CAT1_HAZARDOUS"
        if speed_kt >= 34: return "TROPICAL_STORM"
        return "TROPICAL_DEPRESSION"

    def process_fnv3_file(self, fnv3_file: str, output_dir: str = "public/data/tempest"):
        """
        Complete processing: FNV3 → Cyclone tracks → GeoJSON
        """
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        base_name = Path(fnv3_file).stem
        temp_ready = f"temp_{base_name}_ready.nc"
        temp_detected = f"temp_{base_name}_detected.txt"
        temp_tracks = f"temp_{base_name}_tracks.txt"
        final_geojson = f"{output_dir}/cyclones_{base_name}.geojson"
        
        try:
            self.prepare_fnv3_for_tempestextremes(fnv3_file, temp_ready)
            self.run_detection(temp_ready, temp_detected)
            self.run_stitching(temp_detected, temp_tracks)
            self.tempest_tracks_to_geojson(temp_tracks, final_geojson)
            logger.success(f"🔥 Pipeline complete! Output: {final_geojson}")
            return final_geojson
            
        finally:
            # Cleanup
            for f in [temp_ready, temp_detected, temp_tracks]:
                if os.path.exists(f):
                    os.remove(f)

if __name__ == "__main__":
    # Ensure binary path is set correctly
    pipeline = TempestPipeline(tempest_bin_dir="backend/afro-storm-pipeline/bin")
    # pipeline.process_fnv3_file("path/to/data.nc")
