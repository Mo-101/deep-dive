# AFRO Storm - Verification Guide

## How to Check if Weather Animations Are Working

### Step 1: Open Browser Console
1. Open your app in browser (http://localhost:8086 or your deployed URL)
2. Press F12 to open Developer Tools
3. Click "Console" tab
4. Look for these messages:

```
[AfricaMap] cycloneData updated: X features
[WeatherAnimationController] Received X cyclones from FNV3
[CycloneWindField] Starting with X cyclones
[CycloneWindField] Canvas added to map
```

**If you see these messages** → Data is flowing correctly
**If you DON'T see these** → Data isn't loading (check network tab for errors)

### Step 2: Check for Animation Control Panel
Look for a control panel in the **top-right corner** of the map that says:
- "Weather Animations" 
- Has toggles for: Wind Particles, Cyclone Wind Field, Flood Animation, Cyclone Detection

**If you see this panel** → Components are rendering
**If you DON'T see it** → Check if `cycloneData` is loaded (see Step 1)

### Step 3: Verify Canvas Layers Exist
1. In Developer Tools, click "Elements" tab
2. Press Ctrl+F and search for: `cyclone-wind-field-canvas`
3. You should find a `<canvas>` element inside the map container

**If canvas exists** → Animation layer is created
**If canvas missing** → Check console for errors

### Step 4: Check Z-Index Issues
The animation canvas should have:
- `position: absolute`
- `z-index: 15` (or higher)
- `pointer-events: none`

If the canvas exists but you don't see animations:
1. In Elements tab, click on the canvas element
2. Check Computed Styles → z-index
3. If z-index is lower than map layers, animations are behind the map

### Step 5: Test with Demo Data
If no cyclone data is loading, the animations won't show. Check:
1. Network tab → look for requests to `/data/geojson/fnv3/`
2. If 404 errors, demo data isn't available
3. The app should fallback to `/data/geojson/cyclones.geojson`

### Common Issues

#### Issue 1: " cycloneData is null"
- FNV3 data files not found
- Check `public/data/geojson/fnv3/` directory exists
- Or check fallback `public/data/geojson/cyclones.geojson`

#### Issue 2: Canvas exists but nothing visible
- Animations only show when cyclones exist in data
- Check if cyclones are in current viewport (map might be zoomed wrong area)
- Default view is Africa - cyclones might be in Indian Ocean

#### Issue 3: Control panel not visible
- `showControls` starts as `true` but there's a toggle button
- Look for settings icon (gear icon) in top-right
- Click it to show/hide control panel

#### Issue 4: Performance issues
- Animation uses Canvas API (GPU accelerated)
- 2,000 particles can be heavy on old devices
- Reduce `particleCount` to 500 in WeatherAnimationController.tsx

### Quick Fix Test

Add this test button to force show animations:

```typescript
// In AfricaMap.tsx, add inside the return:
<button 
  onClick={() => {
    console.log('Cyclone data:', cycloneData);
    console.log('Map instance:', mapRef.current);
    alert(cycloneData ? `Found ${cycloneData.features.length} cyclones` : 'No cyclone data');
  }}
  style={{position: 'absolute', top: 10, left: 10, zIndex: 1000}}
>
  Debug: Check Data
</button>
```

### Expected Behavior

When working correctly:
1. Map loads with FNV3 cyclone data
2. Control panel appears top-right
3. By default: "Cyclone Wind Field" and "Cyclone Detection" are ON
4. You see:
   - Rotating wind patterns around cyclone centers
   - Category labels (TD, TS, CAT1, etc.)
   - Formation probability circles
   - Eye wall animation

### If Nothing Works

The animations require:
1. Mapbox map to be fully loaded
2. Cyclone data to be available
3. Browser support for Canvas API

Test with minimal code:
```javascript
// In browser console
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:100;background:rgba(255,0,0,0.3);pointer-events:none';
document.querySelector('.mapboxgl-canvas-container').appendChild(canvas);
```

If you see a red overlay → Canvas works, issue is with data
If no red overlay → Canvas/Mapbox issue

---

**Bottom line:** Check the console logs first. If you see "[CycloneWindField] Starting with X cyclones", the code is working but you might not see it due to data or viewport issues.
