
import os
import json

def setup_credentials():
    home_dir = os.path.expanduser("~")
    
    # CDS Credentials (New System)
    cds_file = os.path.join(home_dir, ".cdsapirc")
    cds_content = "url: https://cds.climate.copernicus.eu/api\nkey: 5945706b-2c63-4d1b-8ad7-0cd04e0d18ff"
    
    with open(cds_file, "w") as f:
        f.write(cds_content)
    print(f"✅ Created {cds_file}")
    
    # ECMWF Credentials (Legacy/Mars)
    ecmwf_file = os.path.join(home_dir, ".ecmwfapirc")
    ecmwf_data = {
        "url": "https://api.ecmwf.int/v1",
        "key": "5251e4354229856ee1e8aa23fd6a4c1c",
        "email": "akiniobong10@gmail.com"
    }
    ecmwf_content = json.dumps(ecmwf_data, indent=4)
    
    with open(ecmwf_file, "w") as f:
        f.write(ecmwf_content)
    print(f"✅ Created {ecmwf_file}")

    print("\n🎉 Environment Ready for Earth Data!")

if __name__ == "__main__":
    setup_credentials()
