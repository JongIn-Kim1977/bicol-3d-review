/* crosssect.js — BMRB 3D Design Review Ver 2.0
 * LandXML corridor cross sections (Civil 3D export) -> section data, alignment geometry, section SVG, concrete lofts.
 * Browser: window.CrossSect   Node: require("./crosssect.js")   (no dependencies)
 *
 * Verified on Ver1_InFRA2_BMRB_BuayanCluster_08Oct2026_mbt.xml:
 *   CrossSectPnt = "offset elevation"; offset is right-positive; elevation is RELATIVE to the design profile,
 *   so absolute elevation (MSL) = profile(sta) + value. This matches the corridor TIN exactly.
 *   The first ProfAlign of each alignment is used (same rule as landxml.js).
 */
(function (root) {
  "use strict";
  const VERSION = "2.0.1";
  // same definitions as landxml.js
  const TOWGS = "+towgs84=-127.62,-67.24,-47.04,-3.068,4.903,1.578,-1.06";
  const CRS = {
    "3121": `+proj=tmerc +lat_0=0 +lon_0=117 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 ${TOWGS} +units=m +no_defs`,
    "3122": `+proj=tmerc +lat_0=0 +lon_0=119 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 ${TOWGS} +units=m +no_defs`,
    "3123": `+proj=tmerc +lat_0=0 +lon_0=121 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 ${TOWGS} +units=m +no_defs`,
    "3124": `+proj=tmerc +lat_0=0 +lon_0=123 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 ${TOWGS} +units=m +no_defs`,
    "3125": `+proj=tmerc +lat_0=0 +lon_0=125 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 ${TOWGS} +units=m +no_defs`,
    "32650": "+proj=utm +zone=50 +datum=WGS84 +units=m +no_defs",
    "32651": "+proj=utm +zone=51 +datum=WGS84 +units=m +no_defs"
  };
  const MATERIAL = {                       // shape name (Civil 3D shape code) -> display
    Concrete: { color: "#c9c9c4", label: "Concrete" },
    Pave1:    { color: "#6f6f6f", label: "Pavement" },
    _default: { color: "#b39b74", label: "" }
  };
  const num = s => s.trim().split(/\s+/).map(Number);
  const attr = (tag, name) => { const m = tag.match(new RegExp("\\b" + name + '="([^"]*)"')); return m ? m[1] : null; };
  const r3 = v => Math.round(v * 1000) / 1000;
  const fmtSta = s => `${Math.floor(s / 1000)}+${(s % 1000).toFixed(2).padStart(6, "0")}`;
  function parseSta(text) {                 // "1+240", "1+240.5", "1240" -> 1240
    const t = String(text).trim().replace(/\s/g, "");
    const m = /^(\d+)\+(\d+(?:\.\d*)?)$/.exec(t);
    if (m) return Number(m[1]) * 1000 + Number(m[2]);
    const v = Number(t); return isFinite(v) ? v : null;
  }

  // ---------- profile ----------
  function profileFn(pvi) {
    return sta => {
      if (pvi.length < 2 || sta < pvi[0][0] - 1 || sta > pvi[pvi.length - 1][0] + 1) return null;
      for (let i = 0; i < pvi.length - 1; i++) {
        const [s1, z1] = pvi[i], [s2, z2] = pvi[i + 1];
        if (sta <= s2) return z1 + (z2 - z1) * Math.max(0, Math.min(1, (sta - s1) / (s2 - s1)));
      }
      return pvi[pvi.length - 1][1];
    };
  }
  function parseProfiles(xml) {
    const out = [], re = /<ProfAlign\b([^>]*)>([\s\S]*?)<\/ProfAlign>/g; let m;
    while ((m = re.exec(xml))) {
      const pvi = [], pr = /<(PVI|ParaCurve|CircCurve|UnsymParaCurve)\b[^>]*>([^<]*)</g; let p;
      while ((p = pr.exec(m[2]))) { const v = num(p[2]); if (v.length >= 2) pvi.push([v[0], v[1]]); }
      pvi.sort((a, b) => a[0] - b[0]);
      out.push({ name: attr("<x" + m[1], "name") || "", pvi });
    }
    return out;
  }

  // ---------- alignment geometry (grid E,N) ----------
  function parseGeom(xml, staStart) {
    const cg = /<CoordGeom\b[^>]*>([\s\S]*?)<\/CoordGeom>/.exec(xml); if (!cg) return null;
    const P = [], S = []; let s0 = staStart;
    const re = /<(Line|Curve|Spiral|IrregularLine)\b([^>]*)>([\s\S]*?)<\/\1>/g; let m;
    const pt = (body, tag) => { const k = new RegExp("<" + tag + "\\b[^>]*>([^<]*)<").exec(body); if (!k) return null; const [n, e] = num(k[1]); return [e, n]; };
    while ((m = re.exec(cg[1]))) {
      const t = m[1], head = "<x" + m[2], St = pt(m[3], "Start"), En = pt(m[3], "End"), L = Number(attr(head, "length"));
      if (!St || !En || !isFinite(L)) continue;
      const seg = [], u = [];
      if (t === "Curve") {
        const Cn = pt(m[3], "Center"), rad = Math.hypot(St[0] - Cn[0], St[1] - Cn[1]);
        const a0 = Math.atan2(St[1] - Cn[1], St[0] - Cn[0]), a1 = Math.atan2(En[1] - Cn[1], En[0] - Cn[0]);
        let d = a1 - a0; const TP = 2 * Math.PI;
        d = attr(head, "rot") === "ccw" ? ((d % TP) + TP) % TP : -(((-d % TP) + TP) % TP);
        const n = Math.max(2, Math.ceil(L));                          // ~1 m chords
        for (let k = 0; k <= n; k++) { const f = k / n; u.push(f); seg.push([Cn[0] + rad * Math.cos(a0 + d * f), Cn[1] + rad * Math.sin(a0 + d * f)]); }
      } else { u.push(0, 1); seg.push(St, En); }                     // Spiral approximated as straight (as in landxml.js)
      for (let k = P.length ? 1 : 0; k < seg.length; k++) { P.push(seg[k]); S.push(s0 + L * u[k]); }
      s0 += L;
    }
    return P.length >= 2 ? { P, S } : null;
  }
  /** point and unit tangent at a station: {E, N, tE, tN} */
  function at(al, sta) {
    const { P, S } = al.geom; let i = 1;
    if (sta <= S[0]) i = 1; else if (sta >= S[S.length - 1]) i = S.length - 1;
    else { let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid] < sta) lo = mid; else hi = mid; } i = hi; }
    const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, f = (sta - S[i - 1]) / ((S[i] - S[i - 1]) || 1);
    return { E: a[0] + (b[0] - a[0]) * f, N: a[1] + (b[1] - a[1]) * f, tE: (b[0] - a[0]) / L, tN: (b[1] - a[1]) / L };
  }
  /** grid point of (station, offset); offset right-positive */
  function gridPoint(al, sta, off) { const p = at(al, sta); return [p.E + p.tN * off, p.N - p.tE * off]; }
  /** nearest station / offset / distance of a grid point */
  function project(al, E, N) {
    const { P, S } = al.geom; let best = { dist: Infinity };
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
      const f = Math.max(0, Math.min(1, ((E - a[0]) * dx + (N - a[1]) * dy) / L2));
      const x = a[0] + dx * f, y = a[1] + dy * f, d = Math.hypot(E - x, N - y);
      if (d < best.dist) { const L = Math.sqrt(L2); best = { dist: d, sta: S[i - 1] + (S[i] - S[i - 1]) * f, off: ((E - x) * dy - (N - y) * dx) / L }; }
    }
    return best;
  }

  // ---------- sections ----------
  function parseSection(xml) {
    const shapes = [], links = [], re = /<DesignCrossSectSurf\b([^>]*)>([\s\S]*?)<\/DesignCrossSectSurf>/g; let m;
    while ((m = re.exec(xml))) {
      const head = "<x" + m[1], pts = [], pr = /<CrossSectPnt\b([^>]*)>([^<]*)</g; let p;
      while ((p = pr.exec(m[2]))) { const v = num(p[2]); if (v.length >= 2) pts.push([v[0], v[1], attr("<x" + p[1], "code")]); }
      if (!pts.length) continue;
      const item = { name: attr(head, "name") || "", pts };
      if (attr(head, "closedArea") === "true") { item.area = Number(attr(head, "area")) || 0; shapes.push(item); } else links.push(item);
    }
    return { shapes, links };
  }

  /** parse(xmlText) -> { epsg, alignments:[{ name, profile, staStart, staEnd, geom, sections:[{sta, grade, shapes, links}] }], warnings } */
  function parse(xml) {
    const cs = /<CoordinateSystem\b[^>]*>/.exec(xml), epsg = cs ? attr(cs[0], "epsgCode") : null;
    const out = { epsg, alignments: [], warnings: [] };
    const re = /<Alignment\b([^>]*)>([\s\S]*?)<\/Alignment>/g; let m;
    while ((m = re.exec(xml))) {
      const head = "<x" + m[1], body = m[2], name = attr(head, "name");
      const block = /<CrossSects\b[\s\S]*?<\/CrossSects>/.exec(body); if (!block) continue;
      const profiles = parseProfiles(body).filter(p => p.pvi.length >= 2);
      if (!profiles.length) { out.warnings.push(`${name}: cross sections but no design profile – skipped`); continue; }
      const geom = parseGeom(body, Number(attr(head, "staStart") || 0));
      if (!geom) { out.warnings.push(`${name}: no horizontal geometry – skipped`); continue; }
      const prof = profiles[0], z = profileFn(prof.pvi), sections = [];
      const cr = /<CrossSect\b([^>]*?)(?:\/>|>([\s\S]*?)<\/CrossSect>)/g; let c;
      while ((c = cr.exec(block[0]))) {
        const sta = Number(attr("<x" + c[1], "sta")), z0 = z(sta);
        if (z0 === null || !isFinite(sta)) continue;
        const sec = parseSection(c[2] || "");
        if (!sec.shapes.length && !sec.links.length) continue;
        const abs = it => { it.pts = it.pts.map(([o, r, code]) => [r3(o), r3(z0 + r), code]); };
        sec.shapes.forEach(abs); sec.links.forEach(abs);
        sections.push({ sta, grade: r3(z0), shapes: sec.shapes, links: sec.links });
      }
      sections.sort((a, b) => a.sta - b.sta);
      if (sections.length) out.alignments.push({ name, profile: prof.name, staStart: sections[0].sta, staEnd: sections[sections.length - 1].sta, geom, sections });
    }
    return out;
  }
  function nearestIndex(al, sta) {
    const s = al.sections; let lo = 0, hi = s.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (s[mid].sta < sta) lo = mid; else hi = mid; }
    return Math.abs(s[lo].sta - sta) <= Math.abs(s[hi].sta - sta) ? lo : hi;
  }

  // ---------- section geometry helpers ----------
  function extent(sec) {
    let o0 = Infinity, o1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const it of [...sec.links, ...sec.shapes]) for (const [o, z] of it.pts) { o0 = Math.min(o0, o); o1 = Math.max(o1, o); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { o0, o1, z0, z1 };
  }
  /** top design elevation at an offset (upper envelope of links and shape edges), or null */
  function designAt(sec, off) {
    let best = null;
    for (const l of [...sec.links, ...sec.shapes]) for (let i = 1; i < l.pts.length; i++) {
      const [o1, z1] = l.pts[i - 1], [o2, z2] = l.pts[i]; const lo = Math.min(o1, o2), hi = Math.max(o1, o2);
      if (off < lo - 1e-6 || off > hi + 1e-6) continue;
      const z = hi - lo < 1e-6 ? Math.max(z1, z2) : z1 + (z2 - z1) * (off - o1) / (o2 - o1);
      if (best === null || z > best) best = z;
    }
    return best;
  }
  function interp(pts, x) {
    if (!pts || pts.length < 2 || x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, za] = pts[i - 1], [b, zb] = pts[i]; return za + (zb - za) * (x - a) / ((b - a) || 1); }
    return null;
  }
  function areas(sec) { const a = {}; for (const s of sec.shapes) a[s.name] = (a[s.name] || 0) + s.area; return a; }

  // ---------- design-top segments (for properties and per-segment textures) ----------
  /** segments(sec) -> [{key:"R2", side, idx, o1,z1,c1, o2,z2,c2, link}] ordered from the centreline outwards on each side.
   *  A segment key (L1, L2 … / R1, R2 …) is stable along a reach where the section shape does not change. */
  function segments(sec) {
    if (sec._segs) return sec._segs;
    const top = sec.links.filter(l => l.name === "Top"), links = top.length ? top : sec.links, out = [], seen = new Set();
    for (const l of links) for (let i = 1; i < l.pts.length; i++) {
      let [o1, z1, c1] = l.pts[i - 1], [o2, z2, c2] = l.pts[i];
      if (Math.hypot(o2 - o1, z2 - z1) < 0.01) continue;
      if (o2 < o1) [o1, z1, c1, o2, z2, c2] = [o2, z2, c2, o1, z1, c1];
      const k = `${o1}|${z1}|${o2}|${z2}`; if (seen.has(k)) continue; seen.add(k);
      out.push({ o1, z1, c1, o2, z2, c2, link: l.name });
    }
    // Some Civil 3D exports drop the Top link on one slope but keep the shape: use shape edges whose both ends are coded "Top"
    for (const sh of sec.shapes) for (let i = 1; i < sh.pts.length; i++) {
      let [o1, z1, c1] = sh.pts[i - 1], [o2, z2, c2] = sh.pts[i];
      if (c1 !== "Top" || c2 !== "Top" || Math.hypot(o2 - o1, z2 - z1) < 0.01) continue;
      if (o2 < o1) [o1, z1, c1, o2, z2, c2] = [o2, z2, c2, o1, z1, c1];
      const k = `${o1}|${z1}|${o2}|${z2}`; if (seen.has(k)) continue; seen.add(k);
      out.push({ o1, z1, c1, o2, z2, c2, link: `${sh.name} top edge (no Top link)` });
    }
    const mid = s => (s.o1 + s.o2) / 2;
    const R = out.filter(s => mid(s) >= 0).sort((a, b) => mid(a) - mid(b));
    const L = out.filter(s => mid(s) < 0).sort((a, b) => mid(b) - mid(a));
    R.forEach((s, i) => { s.side = "R"; s.idx = i + 1; s.key = "R" + (i + 1); });
    L.forEach((s, i) => { s.side = "L"; s.idx = i + 1; s.key = "L" + (i + 1); });
    Object.defineProperty(sec, "_segs", { value: L.concat(R), enumerable: false });   // cache, not serialised
    return sec._segs;
  }
  function segInfo(s) {
    const dx = s.o2 - s.o1, dz = s.z2 - s.z1, len = Math.hypot(dx, dz);
    const ratio = Math.abs(dz) < 1e-3 ? "level" : Math.abs(dx) < 1e-3 ? "vertical" : `1 : ${(Math.abs(dx / dz)).toFixed(2)}`;
    return { width: Math.abs(dx), rise: s.side === "L" ? -dz : dz, len, ratio, pct: Math.abs(dx) < 1e-3 ? null : (dz / dx) * (s.side === "L" ? -100 : 100) };
  }
  const sideCount = (sec, side) => segments(sec).filter(s => s.side === side).length;
  /** contiguous reach around section index si where the number of segments on `side` stays the same */
  function reach(al, si, side) {
    const c = sideCount(al.sections[si], side); let a = si, b = si;
    while (a > 0 && sideCount(al.sections[a - 1], side) === c && al.sections[a].sta - al.sections[a - 1].sta <= 10.5) a--;
    while (b < al.sections.length - 1 && sideCount(al.sections[b + 1], side) === c && al.sections[b + 1].sta - al.sections[b].sta <= 10.5) b++;
    return { i0: a, i1: b, from: al.sections[a].sta, to: al.sections[b].sta, n: b - a + 1 };
  }
  /** texture id for every segment of every section from assignments [{side, idx, from, to, tex}] (later ones win) */
  function bandMap(al, assigns) {
    return al.sections.map(sec => { const m = {};
      for (const a of assigns || []) if (sec.sta >= a.from - 1e-6 && sec.sta <= a.to + 1e-6) { const k = a.side + a.idx;
        if (segments(sec).some(s => s.key === k)) { if (a.tex) m[k] = a.tex; else delete m[k]; } }
      return m; });
  }
  /** quads joining equal-key segments of neighbouring sections that share a texture:
   *  {tex: [[ [sta,off,z,u,v] x4 ], ...]}  u = station (m), v = distance along the segment (m) */
  function bandQuads(al, assigns, maxGap = 10.5) {
    const map = bandMap(al, assigns), out = {}, secs = al.sections;
    for (let i = 1; i < secs.length; i++) {
      if (secs[i].sta - secs[i - 1].sta > maxGap) continue;
      for (const [k, tex] of Object.entries(map[i])) {
        if (map[i - 1][k] !== tex) continue;
        const A = segments(secs[i - 1]).find(s => s.key === k), B = segments(secs[i]).find(s => s.key === k);
        if (!A || !B) continue;
        const out1 = A.side === "L" ? [A.o2, A.z2, A.o1, A.z1] : [A.o1, A.z1, A.o2, A.z2];   // inner -> outer
        const out2 = B.side === "L" ? [B.o2, B.z2, B.o1, B.z1] : [B.o1, B.z1, B.o2, B.z2];
        const la = Math.hypot(A.o2 - A.o1, A.z2 - A.z1), lb = Math.hypot(B.o2 - B.o1, B.z2 - B.z1);
        (out[tex] = out[tex] || []).push([
          [secs[i - 1].sta, out1[0], out1[1], secs[i - 1].sta, 0], [secs[i - 1].sta, out1[2], out1[3], secs[i - 1].sta, la],
          [secs[i].sta, out2[2], out2[3], secs[i].sta, lb], [secs[i].sta, out2[0], out2[1], secs[i].sta, 0]]);
      }
    }
    return out;
  }

  // ---------- SVG ----------
  /** svg(sec, ground, {width, height, vex}) -> { svg, map } ; ground = [[off, zMSL], ...] or null */
  function svg(sec, ground, opt = {}) {
    const W = opt.width || 900, H = opt.height || 260, vex = opt.vex || 1, M = { l: 52, r: 14, t: 14, b: 30 };
    const e = extent(sec); let o0 = e.o0, o1 = e.o1, z0 = e.z0, z1 = e.z1;
    if (ground) for (const [o, z] of ground) { o0 = Math.min(o0, o); o1 = Math.max(o1, o); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const po = Math.max(0.5, (o1 - o0) * 0.03), pz = Math.max(0.3, (z1 - z0) * 0.10);   // breathing room
    o0 -= po; o1 += po; z0 -= pz; z1 += pz;
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    let sx = pw / Math.max(o1 - o0, 1), sz = sx * vex;                     // px per metre
    if ((z1 - z0) * sz > ph) { sz = ph / Math.max(z1 - z0, 0.5); sx = sz / vex; }
    const cx = (o0 + o1) / 2, cz = (z0 + z1) / 2;
    const X = o => M.l + pw / 2 + (o - cx) * sx, Z = z => M.t + ph / 2 - (z - cz) * sz;
    const ox = o => (o - (M.l + pw / 2)) / sx + cx;                         // px -> offset
    const step = v => { const r = v / 6, p = Math.pow(10, Math.floor(Math.log10(r))), n = r / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; };
    const so = step(pw / sx), szs = step(ph / sz);
    const p = [];
    p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui,sans-serif" font-size="11">`);
    p.push(`<rect x="${M.l}" y="${M.t}" width="${pw}" height="${ph}" fill="none" stroke="#3a3f45"/>`);
    const oa = ox(M.l), ob = ox(M.l + pw), za = cz - ph / 2 / sz, zb = cz + ph / 2 / sz;
    for (let o = Math.ceil(oa / so) * so; o <= ob; o += so) { const x = X(o).toFixed(1);
      p.push(`<line x1="${x}" y1="${M.t}" x2="${x}" y2="${M.t + ph}" stroke="${Math.abs(o) < 1e-9 ? "#6b7480" : "#2c3136"}" ${Math.abs(o) < 1e-9 ? 'stroke-dasharray="3 3"' : ""}/>`);
      p.push(`<text x="${x}" y="${H - M.b + 14}" fill="#9aa4ad" text-anchor="middle">${+o.toFixed(2)}</text>`); }
    for (let z = Math.ceil(za / szs) * szs; z <= zb; z += szs) { const y = Z(z).toFixed(1);
      p.push(`<line x1="${M.l}" y1="${y}" x2="${M.l + pw}" y2="${y}" stroke="#2c3136"/>`);
      p.push(`<text x="${M.l - 6}" y="${(+y + 4).toFixed(1)}" fill="#9aa4ad" text-anchor="end">${+z.toFixed(2)}</text>`); }
    p.push(`<text x="${M.l + pw}" y="${H - 4}" fill="#6f7a84" text-anchor="end">offset (m, right +)   ·   elevation (m MSL)${vex !== 1 ? `   ·   vertical ×${vex}` : ""}</text>`);
    if (ground && ground.length > 1) {
      const d = ground.map(([o, z], i) => `${i ? "L" : "M"}${X(o).toFixed(1)},${Z(z).toFixed(1)}`).join("");
      p.push(`<path d="${d}L${X(ground[ground.length - 1][0]).toFixed(1)},${M.t + ph}L${X(ground[0][0]).toFixed(1)},${M.t + ph}Z" fill="#d2a15f" fill-opacity="0.12"/>`);
      p.push(`<path d="${d}" fill="none" stroke="#d2a15f" stroke-width="1.6"/>`);
    }
    sec.shapes.forEach((s, si) => { const mt = MATERIAL[s.name] || MATERIAL._default;
      p.push(`<path data-shape="${si}" d="${s.pts.map(([o, z], i) => `${i ? "L" : "M"}${X(o).toFixed(1)},${Z(z).toFixed(1)}`).join("")}Z" fill="${mt.color}" fill-opacity="0.85" stroke="#1e2226" stroke-width="0.6"><title>${s.name} ${s.area.toFixed(3)} m²</title></path>`); });
    const segs = segments(sec), seg = s => `M${X(s.o1).toFixed(1)},${Z(s.z1).toFixed(1)}L${X(s.o2).toFixed(1)},${Z(s.z2).toFixed(1)}`;
    if (opt.bands) {                                          // per-segment texture: textured band under the design line
      const used = new Set(Object.values(opt.bands).map(b => b.id));
      p.push("<defs>" + [...used].map(id => { const b = Object.values(opt.bands).find(x => x.id === id);
        return `<pattern id="tx-${id}" patternUnits="userSpaceOnUse" width="36" height="36"><image href="${b.url}" width="36" height="36"/></pattern>`; }).join("") + "</defs>");
      for (const s of segs) { const b = opt.bands[s.key]; if (b) p.push(`<path d="${seg(s)}" stroke="url(#tx-${b.id})" stroke-width="10" fill="none"/>`); }
    }
    for (const l of sec.links) { const top = l.name !== "Datum";
      p.push(`<path d="${l.pts.map(([o, z], i) => `${i ? "L" : "M"}${X(o).toFixed(1)},${Z(z).toFixed(1)}`).join("")}" fill="none" stroke="${top ? "#ff6b5b" : "#8fa3ad"}" stroke-width="${top ? 2 : 1}" ${top ? "" : 'stroke-dasharray="4 3"'}/>`); }
    if (opt.selected) for (const s of segs) if (s.key === opt.selected) p.push(`<path d="${seg(s)}" stroke="#ffd54f" stroke-width="4" stroke-dasharray="6 3" fill="none"/>`);
    if (opt.labels) for (const s of segs) p.push(`<text x="${((X(s.o1) + X(s.o2)) / 2).toFixed(1)}" y="${((Z(s.z1) + Z(s.z2)) / 2 - 8).toFixed(1)}" fill="#cfe3e7" font-size="10" text-anchor="middle">${s.key}</text>`);
    p.push(`<circle cx="${X(0).toFixed(1)}" cy="${Z(sec.grade).toFixed(1)}" r="3.5" fill="#ffd54f"/>`);
    p.push(`<text x="${(X(0) + 6).toFixed(1)}" y="${(Z(sec.grade) + (opt.labels ? 16 : -6)).toFixed(1)}" fill="#ffd54f">EL ${sec.grade.toFixed(3)}</text>`);
    if (opt.interactive) for (const s of segs) p.push(`<path class="hit" data-seg="${s.key}" d="${seg(s)}" stroke="#fff" stroke-opacity="0" stroke-width="14" fill="none" pointer-events="stroke" style="cursor:pointer"/>`);
    p.push(`</svg>`);
    return { svg: p.join(""), map: { X, Z, ox, left: M.l, right: M.l + pw, top: M.t, bottom: M.t + ph, W, H } };
  }

  // ---------- concrete lofts between consecutive sections ----------
  /** loft(al, shapeName) -> array of triangles [[sta,off,z] x3] joining matching shapes of neighbouring sections */
  function loft(al, shapeName = "Concrete", maxGap = 10.5) {
    const tris = [], secs = al.sections;
    const sig = s => { let o = 0; for (const q of s.pts) o += q[0]; return o / s.pts.length; };
    for (let i = 1; i < secs.length; i++) {
      const A = secs[i - 1], B = secs[i]; if (B.sta - A.sta > maxGap) continue;
      const sa = A.shapes.filter(s => s.name === shapeName), sb = B.shapes.filter(s => s.name === shapeName);
      const used = new Set();
      for (const a of sa) {
        const ca = sig(a); let best = null, bd = 1.5;
        sb.forEach((b, j) => { if (used.has(j) || b.pts.length !== a.pts.length) return; const d = Math.abs(sig(b) - ca); if (d < bd) { bd = d; best = j; } });
        if (best === null) continue; used.add(best);
        const b = sb[best];
        for (let k = 1; k < a.pts.length; k++) {
          const p1 = [A.sta, a.pts[k - 1][0], a.pts[k - 1][1]], p2 = [A.sta, a.pts[k][0], a.pts[k][1]];
          const q1 = [B.sta, b.pts[k - 1][0], b.pts[k - 1][1]], q2 = [B.sta, b.pts[k][0], b.pts[k][1]];
          tris.push([p1, p2, q2], [p1, q2, q1]);
        }
      }
    }
    return tris;
  }

  const api = { VERSION, CRS, MATERIAL, parse, at, gridPoint, project, nearestIndex, extent, designAt, interp, areas, svg, loft, fmtSta, parseSta,
    segments, segInfo, reach, bandMap, bandQuads };
  root.CrossSect = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
