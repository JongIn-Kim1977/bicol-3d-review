# Bicol River Basin – 3D Design Review

Read-only web viewer for Civil 3D designs (LandXML) over terrain and satellite imagery, for Philippine river projects.
Based on the InFRA2 BMRB 3D Design Review Ver 2.0, set up for the Bicol River Basin.

## What it does
- 3D globe (CesiumJS 1.121) centred on the Bicol River Basin.
- Opens Civil 3D **LandXML** (surfaces, alignments, profiles, corridor cross sections) or **GeoJSON** directly from your PC – drag & drop onto the map or use *Open design file*. Nothing is uploaded.
- Coordinate systems: PRS92 Zones 1–5 (EPSG 3121–3125), WGS84 UTM 50N/51N, WGS84 lon/lat. Bicol is normally PRS92 Zone 4 (EPSG:3124).
- MSL elevations are converted to ellipsoid heights with the EGM96 geoid grid for the Philippines (`egm96_ph.js`).
- Cross-section panel: click a surface or alignment, step ◀ ▶ (arrow keys), vertical exaggeration, fill/cut readout, separate detail window, shareable link.
- Concrete lofts from cross sections, prototype slope-protection textures, terrain clipping under channel surfaces.
- `export-guide.html`: Civil 3D export rules and an in-browser XML check.

## Settings – `config.js`
| Key | Use |
|---|---|
| `ION_TOKEN` | Cesium ion token. Without it: Esri imagery, flat globe, no existing-ground line in sections. |
| `TERRAIN_ASSET_ID`, `ORTHO_ASSET_ID` | Your own DTM / orthophoto uploaded to Cesium ion. |
| `SUPABASE_URL`, `SUPABASE_KEY`, `BUCKET` | Optional shared design store. Table `design_uploads` (id, cluster, file_name, kind, original_path, converted_path, note, active, created_at) and a public bucket holding the converted JSON (`bmrb-design-v1`) and original XML. |
| `CLUSTERS`, `HOME`, `TITLE`, `CLIP_MATCH` | Project list, start view, title, clip-surface name match. |

## Deploy (Render static site)
Static files only – no build step. On Render: *New → Static Site* → this repository → Build command empty → Publish directory `.`.
Every push to `main` redeploys.

## Files
`index.html` viewer · `section.html` detail window · `landxml.js` LandXML/GeoJSON → design JSON · `crosssect.js` cross sections & SVG · `textures.js` sample textures · `egm96_ph.js` geoid grid · `config.js` settings · `export-guide.html` export guide.
## Terrain (Cesium ion)
- DTM: asset 6204501 "Bicol CP3 DTM 1m (MSL)" - bare ground with river bed, PRS92 Zone 4, 1 m.
- DSM: asset 6204507 "Bicol CP3 DSM 1m (MSL)" - switch in Layers > Terrain. Sections always use the DTM.
- Auto-deploy: Render is connected to GitHub, so every commit to main redeploys the site.
