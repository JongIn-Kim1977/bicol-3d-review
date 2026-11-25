/* Site settings for the Bicol River Basin 3D Design Review.
   Edit this file only (index.html never needs changing for these).
   Everything here is visible in the browser, so use only browser-safe keys. */
window.APP_CONFIG = {
  TITLE:            "Bicol River Basin – 3D Design Review",

  // Cesium ion (https://ion.cesium.com) – optional.
  // Empty token  -> Esri satellite imagery on a flat globe, no terrain.
  // With a token -> Cesium World Terrain (or your own DTM asset) + your orthophoto asset.
  ION_TOKEN:        "",
  TERRAIN_ASSET_ID: null,      // your merged DTM asset id (height reference = MSL); null = Cesium World Terrain
  ORTHO_ASSET_ID:   null,      // your orthophoto asset id; null = none

  // Supabase design store – optional. Leave empty to open LandXML / GeoJSON files from your PC.
  // Needs a public bucket and a "design_uploads" table (see README.md).
  SUPABASE_URL:     "",
  SUPABASE_KEY:     "",        // publishable (anon) key only
  BUCKET:           "design",

  CLUSTERS:         [],        // e.g. ["Naga", "Pili", "Libmanan"] – shown in the list even before a design exists
  CLIP_MATCH:       "channel", // design surfaces whose name contains this text can cut the terrain
  HOME:             { lon: 123.25, lat: 13.55, height: 90000 }   // Bicol River Basin (Camarines Sur)
};
