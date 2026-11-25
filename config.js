/* Site settings for the Bicol River Basin 3D Design Review.
   Edit this file only (index.html never needs changing for these).
   Everything here is visible in the browser, so use only browser-safe keys. */
window.APP_CONFIG = {
  TITLE:            "Bicol River Basin – 3D Design Review",

  // Cesium ion (https://ion.cesium.com) – optional.
  // Empty token  -> Esri satellite imagery on a flat globe, no terrain.
  // With a token -> Cesium World Terrain (or your own DTM asset) + your orthophoto asset.
  ION_TOKEN:        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Ik1nNzM4VDdyRHFMZUliSVIiLCJqdGkiOiJmY2Q5MDc1ZC00YjNmLTQyM2MtODlmOC1kNTAxZDljNDkzMzEiLCJpZCI6NTU2NDY3LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3OTU1Nzg5ODR9.4_7ysJLLK92OezMK9s4_GhukE9SuEiI-gQchXkRTXzg",
  TERRAIN_ASSET_ID: 6204501,   // "Bicol CP3 DTM 1m (MSL)" – bare ground with river bed, merged with Cesium World Terrain
  ORTHO_ASSET_ID:   6204871,   // CP3_Bicol River-Orthophoto-001 (4.9 GB GeoTIFF); null = Bing aerial (with token) or Esri
  DSM_ASSET_ID:     6204507,   // "Bicol CP3 DSM 1m (MSL)" – surface model, switchable in Layers

  // Supabase design store – optional. Leave empty to open LandXML / GeoJSON files from your PC.
  // Needs a public bucket and a "design_uploads" table (see README.md).
  SUPABASE_URL:     "",
  SUPABASE_KEY:     "",        // publishable (anon) key only
  BUCKET:           "design",

  CLUSTERS:         [],        // e.g. ["Naga", "Pili", "Libmanan"] – shown in the list even before a design exists
  CLIP_MATCH:       "channel", // design surfaces whose name contains this text can cut the terrain
  HOME:             { lon: 123.112, lat: 13.648, height: 12000 }  // Bicol River CP3 (west of Naga City)
};
