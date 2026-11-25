/* BMRB design converter: LandXML / GeoJSON -> design JSON (bmrb-design-v1)
   Runs in the browser (window.BMRB) and in Node (module.exports) for testing.
   Needs: proj4, EGM96_PH (egm96_ph.js). */
(function (root) {
  "use strict";
  const CRS = {
    "3121": "+proj=tmerc +lat_0=0 +lon_0=117 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-127.62,-67.24,-47.04,-3.068,4.903,1.578,-1.06 +units=m +no_defs",
    "3122": "+proj=tmerc +lat_0=0 +lon_0=119 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-127.62,-67.24,-47.04,-3.068,4.903,1.578,-1.06 +units=m +no_defs",
    "3123": "+proj=tmerc +lat_0=0 +lon_0=121 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-127.62,-67.24,-47.04,-3.068,4.903,1.578,-1.06 +units=m +no_defs",
    "3124": "+proj=tmerc +lat_0=0 +lon_0=123 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-127.62,-67.24,-47.04,-3.068,4.903,1.578,-1.06 +units=m +no_defs",
    "3125": "+proj=tmerc +lat_0=0 +lon_0=125 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-127.62,-67.24,-47.04,-3.068,4.903,1.578,-1.06 +units=m +no_defs",
    "32650": "+proj=utm +zone=50 +datum=WGS84 +units=m +no_defs",
    "32651": "+proj=utm +zone=51 +datum=WGS84 +units=m +no_defs",
    "4326": "+proj=longlat +datum=WGS84 +no_defs"
  };
  const CRS_NAMES = { "3121": "PRS92 / Zone 1", "3122": "PRS92 / Zone 2", "3123": "PRS92 / Zone 3", "3124": "PRS92 / Zone 4",
    "3125": "PRS92 / Zone 5", "32650": "WGS84 / UTM 50N", "32651": "WGS84 / UTM 51N", "4326": "WGS84 lon/lat" };
  const PALETTE = [[0.95,0.55,0.15],[0.2,0.6,0.95],[0.95,0.3,0.3],[0.3,0.8,0.4],[0.85,0.75,0.2],[0.6,0.4,0.9],
    [0.2,0.85,0.85],[0.95,0.45,0.7],[0.55,0.75,0.25],[0.9,0.6,0.4],[0.45,0.55,0.95]];

  const P4 = () => root.proj4 || (typeof require !== "undefined" ? require("proj4") : null);
  const G = () => root.EGM96_PH;

  function geoid(lat, lon) {
    const g = G();
    let x = (lon - g.lon0) / g.step, y = (lat - g.lat0) / g.step;
    if (x < 0 || y < 0 || x >= g.nx - 1 || y >= g.ny - 1) throw new Error(`Outside geoid grid (Philippines): ${lat.toFixed(3)}, ${lon.toFixed(3)}`);
    const i = Math.floor(y), j = Math.floor(x), fy = y - i, fx = x - j, d = g.data, nx = g.nx;
    return d[i*nx+j]*(1-fx)*(1-fy) + d[i*nx+j+1]*fx*(1-fy) + d[(i+1)*nx+j]*(1-fx)*fy + d[(i+1)*nx+j+1]*fx*fy;
  }
  function makeProj(epsg) {
    const def = CRS[String(epsg)];
    if (!def) throw new Error(`Unsupported coordinate system EPSG:${epsg}`);
    const t = P4()(def, CRS["4326"]);
    return (E, N) => t.forward([E, N]);            // -> [lon, lat]
  }
  // WGS84 ECEF + local ENU frame
  const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F);
  function ecef(lon, lat, h) {
    const lo = lon * Math.PI / 180, la = lat * Math.PI / 180, s = Math.sin(la), c = Math.cos(la);
    const n = A / Math.sqrt(1 - E2 * s * s);
    return [(n + h) * c * Math.cos(lo), (n + h) * c * Math.sin(lo), (n * (1 - E2) + h) * s];
  }
  function enuFrame(lon0, lat0, h0) {
    const o = ecef(lon0, lat0, h0), lo = lon0 * Math.PI / 180, la = lat0 * Math.PI / 180;
    const e = [-Math.sin(lo), Math.cos(lo), 0];
    const n = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
    const u = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    return (lon, lat, h) => { const p = ecef(lon, lat, h), d = [p[0]-o[0], p[1]-o[1], p[2]-o[2]];
      return [d[0]*e[0]+d[1]*e[1]+d[2]*e[2], d[0]*n[0]+d[1]*n[1]+d[2]*n[2], d[0]*u[0]+d[1]*u[1]+d[2]*u[2]]; };
  }
  function b64(f32) {
    const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
    if (typeof Buffer !== "undefined" && !root.document) return Buffer.from(u8).toString("base64");
    let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const kids = (el, name) => Array.from(el.childNodes || []).filter(n => n.nodeType === 1 && (n.localName || n.nodeName) === name);
  const all = (el, name) => Array.from(el.getElementsByTagName(name));
  const nums = s => s.trim().split(/\s+/).map(Number);
  const fmtSta = s => `${Math.floor(s / 1000)}+${(s % 1000).toFixed(2).padStart(6, "0")}`;
  const r8 = v => Math.round(v * 1e8) / 1e8, r3 = v => Math.round(v * 1e3) / 1e3;

  function parseLandXML(text, opt = {}) {
    const DP = root.DOMParser || (typeof require !== "undefined" ? require("@xmldom/xmldom").DOMParser : null);
    const doc = new DP().parseFromString(text, "text/xml");
    const log = [];
    const cs = all(doc, "CoordinateSystem")[0];
    let epsg = opt.crs && opt.crs !== "auto" ? String(opt.crs) : (cs && cs.getAttribute("epsgCode")) || null;
    if (!epsg) throw new Error("No coordinate system in LandXML. Choose one in the upload form.");
    const toLL = makeProj(epsg);
    const maxEdge = opt.maxEdge || 40;

    // ---- surfaces
    const surfs = [];
    for (const s of all(doc, "Surface")) {
      const pts = new Map();
      for (const p of all(s, "P")) { const [n, e, z] = nums(p.textContent); pts.set(p.getAttribute("id"), [e, n, z]); }
      const faces = []; let hidden = 0, zero = 0, longe = 0;
      for (const f of all(s, "F")) {
        if (f.getAttribute("i") === "1") { hidden++; continue; }
        const ids = f.textContent.trim().split(/\s+/), q = ids.map(i => pts.get(i));
        if (q.some(v => !v)) continue;
        if (q.some(v => v[2] === 0)) { zero++; continue; }
        const ed = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (Math.max(ed(q[0], q[1]), ed(q[1], q[2]), ed(q[2], q[0])) > maxEdge) { longe++; continue; }
        faces.push(ids);
      }
      if (!faces.length) { log.push(`${s.getAttribute("name")}: no faces, skipped`); continue; }
      surfs.push({ name: s.getAttribute("name"), pts, faces });
      log.push(`${s.getAttribute("name")}: ${faces.length} faces (dropped: hidden ${hidden}, Z=0 ${zero}, edge>${maxEdge}m ${longe})`);
    }
    // ---- geographic coords cache
    const llCache = new Map();
    const llh = (sid, id, p) => { const k = sid + "|" + id; let v = llCache.get(k);
      if (!v) { const [lon, lat] = toLL(p[0], p[1]); v = [lon, lat, p[2] + geoid(lat, lon)]; llCache.set(k, v); } return v; };
    // origin = mean of all surface points (or alignments later)
    let sx = 0, sy = 0, cnt = 0;
    surfs.forEach((s, si) => s.pts.forEach((p, id) => { const v = llh(si, id, p); sx += v[0]; sy += v[1]; cnt++; }));

    // ---- alignments
    const aligns = [];
    for (const a of all(doc, "Alignment")) {
      const cg = kids(a, "CoordGeom")[0]; if (!cg) continue;
      const P = [], S = []; let s0 = 0;
      for (const el of Array.from(cg.childNodes).filter(n => n.nodeType === 1)) {
        const t = el.localName || el.nodeName;
        const rd = nm => { const k = kids(el, nm)[0]; if (!k) return null; const [n, e] = nums(k.textContent); return [e, n]; };
        const St = rd("Start"), En = rd("End"), L = parseFloat(el.getAttribute("length"));
        if (!St || !En || !isFinite(L)) continue;
        let seg = [], u = [];
        if (t === "Curve") {
          const C = rd("Center"), rad = Math.hypot(St[0] - C[0], St[1] - C[1]);
          const a0 = Math.atan2(St[1] - C[1], St[0] - C[0]), a1 = Math.atan2(En[1] - C[1], En[0] - C[0]);
          let d = a1 - a0; const TP = 2 * Math.PI;
          d = el.getAttribute("rot") === "ccw" ? ((d % TP) + TP) % TP : -(((-d % TP) + TP) % TP);
          const n = Math.max(2, Math.floor(L / 2));
          for (let k = 0; k <= n; k++) { const f = k / n; u.push(f); seg.push([C[0] + rad * Math.cos(a0 + d * f), C[1] + rad * Math.sin(a0 + d * f)]); }
        } else {
          if (t !== "Line") log.push(`${a.getAttribute("name")}: ${t} approximated as straight line`);
          const n = Math.max(1, Math.floor(L / 5));
          for (let k = 0; k <= n; k++) { const f = k / n; u.push(f); seg.push([St[0] + (En[0] - St[0]) * f, St[1] + (En[1] - St[1]) * f]); }
        }
        const first = P.length ? 1 : 0;
        for (let k = first; k < seg.length; k++) { P.push(seg[k]); S.push(s0 + L * u[k]); }
        s0 += L;
      }
      if (P.length < 2) continue;
      const st0 = parseFloat(a.getAttribute("staStart") || "0"); for (let k = 0; k < S.length; k++) S[k] += st0;
      const pa = all(a, "ProfAlign")[0];
      let pv = null, prof = null;
      if (pa) {
        pv = Array.from(pa.childNodes).filter(n => n.nodeType === 1 && /^(PVI|ParaCurve|CircCurve)$/.test(n.localName || n.nodeName))
          .map(n => nums(n.textContent)).filter(v => v.length >= 2).sort((x, y) => x[0] - y[0]);
        if (pv.length < 2) pv = null; else prof = pa.getAttribute("name");
      }
      aligns.push({ name: a.getAttribute("name"), P, S, pv, prof });
    }
    if (!surfs.length) aligns.forEach(a => a.P.forEach(p => { const [lon, lat] = toLL(p[0], p[1]); sx += lon; sy += lat; cnt++; }));
    if (!cnt) throw new Error("No surfaces or alignments found in this LandXML.");
    const lon0 = sx / cnt, lat0 = sy / cnt, N0 = geoid(lat0, lon0), h0 = 10 + N0;
    const toENU = enuFrame(lon0, lat0, h0);

    // ---- surface meshes + footprints
    const surfaces = [], footprints = [];
    surfs.forEach((s, si) => {
      const pos = new Float32Array(s.faces.length * 9);
      s.faces.forEach((ids, fi) => {
        let v = ids.map(id => toENU(...llh(si, id, s.pts.get(id))));
        const nz = (v[1][0]-v[0][0])*(v[2][1]-v[0][1]) - (v[1][1]-v[0][1])*(v[2][0]-v[0][0]);
        if (nz < 0) v = [v[0], v[2], v[1]];
        v.forEach((q, k) => pos.set(q, fi * 9 + k * 3));
      });
      surfaces.push({ name: s.name, color: PALETTE[si % PALETTE.length], triangles: s.faces.length, positions: b64(pos) });
      // boundary loop
      const ec = new Map(); const key = (a, b) => a < b ? a + "|" + b : b + "|" + a;
      s.faces.forEach(f => [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]].forEach(([a, b]) => { const k = key(a, b); ec.set(k, (ec.get(k) || 0) + 1); }));
      const adj = new Map();
      ec.forEach((n, k) => { if (n !== 1) return; const [a, b] = k.split("|"); (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); });
      const seen = new Set(); let best = null, bestA = -1;
      for (const st of adj.keys()) {
        if (seen.has(st)) continue; const loop = [st]; seen.add(st); let prev = null, cur = st;
        for (;;) { const nx = (adj.get(cur) || []).filter(v => v !== prev && !seen.has(v)); if (!nx.length) break; prev = cur; cur = nx[0]; seen.add(cur); loop.push(cur); }
        if (loop.length < 4) continue;
        let ar = 0; for (let k = 0; k < loop.length; k++) { const p = s.pts.get(loop[k]), q = s.pts.get(loop[(k + 1) % loop.length]); ar += p[0] * q[1] - q[0] * p[1]; }
        ar = Math.abs(ar) / 2; if (ar > bestA) { bestA = ar; best = loop; }
      }
      if (best) {
        const ring = best.map(id => { const v = llh(si, id, s.pts.get(id)); return [r8(v[0]), r8(v[1])]; }); ring.push(ring[0]);
        let zmin = Infinity, zmax = -Infinity; s.pts.forEach(p => { if (p[2] > 0) { zmin = Math.min(zmin, p[2]); zmax = Math.max(zmax, p[2]); } });
        footprints.push({ type: "Feature", properties: { name: s.name, area_m2: Math.round(bestA * 10) / 10, zmin_msl: r3(zmin), zmax_msl: r3(zmax) },
          geometry: { type: "Polygon", coordinates: [ring] } });
      }
    });

    // ---- alignment features
    const feats = [];
    const interp = (x, xs, ys) => { if (x <= xs[0]) return ys[0]; if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
      let i = 1; while (xs[i] < x) i++; const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + f * (ys[i] - ys[i - 1]); };
    for (const al of aligns) {
      const { P, S, pv } = al, xs = pv && pv.map(v => v[0]), ys = pv && pv.map(v => v[1]);
      const emit = (idx, has) => {
        if (idx.length < 2) return;
        const coords = idx.map(i => { const [lon, lat] = toLL(P[i][0], P[i][1]);
          return has ? [r8(lon), r8(lat), r3(interp(S[i], xs, ys) + geoid(lat, lon))] : [r8(lon), r8(lat)]; });
        feats.push({ type: "Feature", properties: { kind: "alignment", name: al.name, profile: has ? al.prof : null,
          height: has ? "ellipsoid (MSL+EGM96)" : "clamp to ground", sta_from: fmtSta(S[idx[0]]), sta_to: fmtSta(S[idx[idx.length - 1]]) },
          geometry: { type: "LineString", coordinates: coords } });
      };
      const I = S.map((_, i) => i);
      if (pv) {
        const lo = xs[0], hi = xs[xs.length - 1];
        emit(I.filter(i => S[i] >= lo - 1 && S[i] <= hi + 1), true);
        if (S[0] < lo - 1) { emit(I.filter(i => S[i] <= lo), false); log.push(`${al.name}: no design profile before ${fmtSta(lo)}`); }
        if (S[S.length - 1] > hi + 1) { emit(I.filter(i => S[i] >= hi), false); log.push(`${al.name}: no design profile after ${fmtSta(hi)}`); }
      } else { emit(I, false); log.push(`${al.name}: no design profile -> drawn on ground`); }
      for (let st = Math.ceil(S[0] / 100) * 100; st <= S[S.length - 1] + 1e-6; st += 100) {
        const E = interp(st, S, P.map(p => p[0])), N = interp(st, S, P.map(p => p[1])), [lon, lat] = toLL(E, N);
        const has = pv && st >= xs[0] && st <= xs[xs.length - 1], g = [r8(lon), r8(lat)];
        if (has) g.push(r3(interp(st, xs, ys) + geoid(lat, lon)));
        feats.push({ type: "Feature", properties: { kind: "station", alignment: al.name, label: fmtSta(st) }, geometry: { type: "Point", coordinates: g } });
      }
    }
    return { format: "bmrb-design-v1", cluster: opt.cluster || null, source: opt.fileName || null, kind: "landxml",
      crs: `EPSG:${epsg}`, crs_name: CRS_NAMES[epsg] || "", vertical: "MSL -> ellipsoid (EGM96)",
      origin: { lon: lon0, lat: lat0, h: h0 }, surfaces,
      alignments: { type: "FeatureCollection", features: feats },
      footprints: { type: "FeatureCollection", features: footprints },
      areas: { type: "FeatureCollection", features: [] },
      stats: { surfaces: surfaces.length, triangles: surfaces.reduce((a, s) => a + s.triangles, 0),
               alignments: aligns.length, geoid_m: Math.round(N0 * 100) / 100 }, log };
  }

  // GeoJSON: heights "msl" (add geoid), "ellipsoid" (keep), "ground" (drop Z, clamp)
  function parseGeoJSON(text, opt = {}) {
    const gj = JSON.parse(text);
    const fc = gj.type === "FeatureCollection" ? gj : { type: "FeatureCollection", features: gj.type === "Feature" ? [gj] : [{ type: "Feature", properties: {}, geometry: gj }] };
    let epsg = opt.crs && opt.crs !== "auto" ? String(opt.crs) : "4326";
    const m = gj.crs && gj.crs.properties && /EPSG:+(\d+)/.exec(gj.crs.properties.name || "");
    if ((!opt.crs || opt.crs === "auto") && m) epsg = m[1];
    const toLL = epsg === "4326" ? (x, y) => [x, y] : makeProj(epsg);
    const hmode = opt.heights || "ground", log = [];
    const conv = c => { const [lon, lat] = toLL(c[0], c[1]);
      if (hmode === "ground" || c.length < 3) return [r8(lon), r8(lat)];
      return [r8(lon), r8(lat), r3(hmode === "msl" ? c[2] + geoid(lat, lon) : c[2])]; };
    const mapc = (c, d) => d === 0 ? conv(c) : c.map(x => mapc(x, d - 1));
    const depth = { Point: 0, MultiPoint: 1, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3 };
    const lines = [], areas = []; let sx = 0, sy = 0, n = 0;
    for (const f of fc.features) {
      const g = f.geometry; if (!g || !(g.type in depth)) { log.push("Skipped feature without supported geometry"); continue; }
      const out = { type: "Feature", properties: Object.assign({ name: (f.properties && (f.properties.name || f.properties.Name)) || "" }, f.properties || {}),
        geometry: { type: g.type, coordinates: mapc(g.coordinates, depth[g.type]) } };
      let c0 = out.geometry.coordinates; while (Array.isArray(c0[0])) c0 = c0[0];
      sx += c0[0]; sy += c0[1]; n++;
      if (/Polygon/.test(g.type)) areas.push(out);
      else { out.properties.kind = out.properties.kind || (/Point/.test(g.type) ? "point" : "alignment");
             out.properties.height = hmode === "ground" ? "clamp to ground" : "ellipsoid"; lines.push(out); }
    }
    if (!n) throw new Error("No features found in this GeoJSON.");
    return { format: "bmrb-design-v1", cluster: opt.cluster || null, source: opt.fileName || null, kind: "geojson",
      crs: `EPSG:${epsg}`, crs_name: CRS_NAMES[epsg] || "", vertical: hmode,
      origin: { lon: sx / n, lat: sy / n, h: 0 }, surfaces: [],
      alignments: { type: "FeatureCollection", features: lines }, footprints: { type: "FeatureCollection", features: [] },
      areas: { type: "FeatureCollection", features: areas },
      stats: { features: lines.length + areas.length }, log };
  }

  const api = { parseLandXML, parseGeoJSON, CRS_NAMES, geoid };
  root.BMRB = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
