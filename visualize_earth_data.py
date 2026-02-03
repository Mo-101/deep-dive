
# Earth Data Visualization Setup
# Phase 3: Setup & Imports

# CDS API library
import cdsapi

# Libraries for working with multidimensional arrays
import xarray as xr

# Library to work with zip-archives and OS-functions
import zipfile
import os

# Libraries for plotting and visualising data
import matplotlib.pyplot as plt
try:
    import cartopy.crs as ccrs
    print("✅ Cartopy successfully imported.")
except ImportError:
    print("⚠️ Cartopy not found or failed to import. Map plotting may be limited.")
    ccrs = None

# Disable warnings for data download via API
import urllib3
urllib3.disable_warnings()

# Load Environment Variables
from dotenv import load_dotenv
load_dotenv()

# ==========================================
# CONFIGURATION
# ==========================================

# Directory to store data
# Configured in .env as EARTH_DATA_DIR (Default: ./data_dir/)
DATADIR = os.getenv("EARTH_DATA_DIR", "./data_dir/")
os.makedirs(DATADIR, exist_ok=True)
print(f"📂 Data Storage Path: {DATADIR}")


# USER PROVIDED ZIP FILES
ZIP_FILES = [
    r"C:\Users\idona\Downloads\337020867914c38a805e9a0084c1c56a.zip",
    r"C:\Users\idona\Downloads\902e006bb136eec2630a7785d6ed7ced.zip"
]

def extract_and_load_data():
    netcdf_files = []
    
    for zip_path in ZIP_FILES:
        if os.path.exists(zip_path):
            print(f"\n📦 Found zip file: {zip_path}")
            try:
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    print("   Extracting...")
                    zip_ref.extractall(DATADIR)
                    
                    # List extracted files
                    for file in zip_ref.namelist():
                        if file.endswith('.nc'):
                            full_path = os.path.join(DATADIR, file)
                            netcdf_files.append(full_path)
                            print(f"   - Extracted: {file}")
            except Exception as e:
                print(f"   ❌ Error extracting: {e}")
        else:
            print(f"⚠️ Zip file not found: {zip_path}")

    return netcdf_files

# Execute extraction ONLY if needed
print("\n🔄 Checking Data Files...")
# Get list of .nc files in DATADIR
current_nc_files = [os.path.join(DATADIR, f) for f in os.listdir(DATADIR) if f.endswith('.nc')]

if len(current_nc_files) > 0:
    print(f"✅ Found {len(current_nc_files)} existing NetCDF files. Skipping re-extraction.")
    nc_files = current_nc_files
else:
    print("⚠️ No NetCDF files found in storage. Starting extraction...")
    nc_files = extract_and_load_data()

# Directory for saving figures
FIGPATH = os.path.join(DATADIR, 'figures') # Saving in data dir to keep together
os.makedirs(FIGPATH, exist_ok=True)
print(f"📂 Figure Storage: {FIGPATH}")

if nc_files:
    print(f"\n🔬 PHASE 4: EXPLORE DATA")
    print(f"--------------------------------")
    
    # Load the first file to explore
    target_file = nc_files[0]
    try:
        ds = xr.open_dataset(target_file)
        
        print(f"\n📄 Dataset: {os.path.basename(target_file)}")
        print(f"📅 Time Steps: {ds.sizes.get('time', 'Unknown')}")
        print(f"🌍 Dimensions: {dict(ds.sizes)}")
        print(f"📊 Variables: {list(ds.data_vars)}")
        
        # BASIC PLOT of the first variable
        first_var = list(ds.data_vars)[0]
        print(f"\n🎨 Generating preview for variable: '{first_var}'...")
        
        plt.figure(figsize=(10, 6))
        # Select first time step and plot
        if 'time' in ds.coords:
            data_slice = ds[first_var].isel(time=0)
            time_str = str(ds['time'].values[0])[:10]
        else:
            data_slice = ds[first_var]
            time_str = "Static"
            
        data_slice.plot(cmap='jet')
        plt.title(f"{first_var.upper()} - {time_str}")
        
        save_path = os.path.join(FIGPATH, f'preview_{first_var}.png')
        plt.savefig(save_path)
        print(f"✅ Preview saved to: {save_path}")
        plt.close()
        
    except Exception as e:
        print(f"❌ Error analyzing NetCDF: {e}")
else:
    print("\n⚠️ No NetCDF files found to analyze.")

print("\n🚀 Phase 4 Exploration Complete!")
