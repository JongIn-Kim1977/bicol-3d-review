/* textures.js — BMRB 3D Design Review Ver 2.0 (prototype)
 * Procedural, seamless sample textures for common river-dike slope protection types.
 * Generic samples for visual review only; not design materials. Browser only: window.DikeTextures
 */
(function () {
  "use strict";
  const S = 256;                                            // texture size (px)
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;

  // seamless Voronoi: per pixel nearest cell, F1, F2 (toroidal distance)
  function voronoi(n, r) {
    const P = []; for (let i = 0; i < n; i++) P.push([r() * S, r() * S]);
    const cell = new Uint16Array(S * S), f1 = new Float32Array(S * S), f2 = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let a = 1e9, b = 1e9, ia = 0;
      for (let i = 0; i < n; i++) {
        let dx = Math.abs(x - P[i][0]), dy = Math.abs(y - P[i][1]); if (dx > S / 2) dx = S - dx; if (dy > S / 2) dy = S - dy;
        const d = Math.sqrt(dx * dx + dy * dy); if (d < a) { b = a; a = d; ia = i; } else if (d < b) b = d;
      }
      const k = y * S + x; cell[k] = ia; f1[k] = a; f2[k] = b;
    }
    return { P, cell, f1, f2 };
  }
  function canvas() { const c = document.createElement("canvas"); c.width = c.height = S; return c; }
  function fromPixels(fn) { const c = canvas(), ctx = c.getContext("2d"), im = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const [R, G, B] = fn(x, y), k = (y * S + x) * 4;
      im.data[k] = clamp(R); im.data[k + 1] = clamp(G); im.data[k + 2] = clamp(B); im.data[k + 3] = 255; }
    ctx.putImageData(im, 0, 0); return c; }

  function concrete() {                                      // 2 m x 2 m panels with joints and weep holes
    const r = rng(11), blot = []; for (let i = 0; i < 40; i++) blot.push([r() * S, r() * S, 10 + r() * 40, (r() - 0.5) * 14]);
    return fromPixels((x, y) => {
      let v = 182 + (r() - 0.5) * 16;
      for (const [bx, by, br, bv] of blot) { let dx = Math.abs(x - bx), dy = Math.abs(y - by); if (dx > S / 2) dx = S - dx; if (dy > S / 2) dy = S - dy;
        const d = Math.hypot(dx, dy); if (d < br) v += bv * (1 - d / br); }
      const jx = Math.min(x % 128, 128 - x % 128), jy = Math.min(y % 128, 128 - y % 128);
      if (jx < 1.5 || jy < 1.5) v = 105;
      if (Math.hypot((x % 128) - 64, (y % 128) - 64) < 4) v = 70;
      return [v, v - 1, v - 5];
    });
  }
  function grouted() {                                       // stones set in mortar (grouted riprap / stone masonry)
    const r = rng(23), V = voronoi(34, r), col = V.P.map(() => { const b = 105 + r() * 60, w = r() * 18; return [b + w, b + w * 0.6, b - 4]; });
    return fromPixels((x, y) => { const k = y * S + x, e = V.f2[k] - V.f1[k], n = (r() - 0.5) * 18;
      if (e < 4.5) { const m = 196 + n * 0.5; return [m, m - 2, m - 8]; }
      const sh = 0.72 + 0.28 * Math.min(1, e / 18), c = col[V.cell[k]]; return [c[0] * sh + n, c[1] * sh + n, c[2] * sh + n]; });
  }
  function gabion() {                                        // small stones behind hexagonal-ish wire mesh, box seams
    const r = rng(37), V = voronoi(90, r), col = V.P.map(() => { const b = 120 + r() * 55; return [b + 6, b + 2, b - 8]; });
    return fromPixels((x, y) => { const k = y * S + x, e = V.f2[k] - V.f1[k], n = (r() - 0.5) * 16;
      const w1 = ((x + y) % 32 + 32) % 32, w2 = ((x - y) % 32 + 32) % 32;
      if (x < 2 || y < 2 || x > S - 3 || y > S - 3) return [168, 170, 172];          // box seam wire
      if (w1 < 1.4 || w2 < 1.4) return [150 + n * 0.3, 152 + n * 0.3, 155 + n * 0.3];  // mesh wire
      if (e < 2.5) return [55, 52, 48];
      const sh = 0.65 + 0.35 * Math.min(1, e / 10), c = col[V.cell[k]]; return [c[0] * sh + n, c[1] * sh + n, c[2] * sh + n]; });
  }
  function sodding() {                                       // grass cover with blade strokes
    const r = rng(53), c = canvas(), ctx = c.getContext("2d");
    ctx.fillStyle = "#5f8f3e"; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 5200; i++) {
      const x = r() * S, y = r() * S, L = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 1.2, g = 110 + r() * 80;
      ctx.strokeStyle = `rgb(${50 + r() * 50 | 0},${g | 0},${30 + r() * 30 | 0})`; ctx.lineWidth = 1 + r() * 0.8;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        if (x + ox < -10 || x + ox > S + 10 || y + oy < -10 || y + oy > S + 10) continue;
        ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L); ctx.stroke(); }
    }
    return c;
  }
  function riprap() {                                        // dumped rock, larger stones, dark voids, top-left light
    const r = rng(71), V = voronoi(20, r), col = V.P.map(() => { const b = 100 + r() * 55; return [b, b - 2, b - 6]; });
    return fromPixels((x, y) => { const k = y * S + x, e = V.f2[k] - V.f1[k], n = (r() - 0.5) * 22;
      if (e < 3.5) return [38 + n * 0.3, 36 + n * 0.3, 34 + n * 0.3];
      const p = V.P[V.cell[k]]; let dx = x - p[0], dy = y - p[1]; if (dx > S / 2) dx -= S; if (dx < -S / 2) dx += S; if (dy > S / 2) dy -= S; if (dy < -S / 2) dy += S;
      const lit = 1 - 0.0035 * (dx + dy), sh = (0.55 + 0.45 * Math.min(1, e / 22)) * lit, c = col[V.cell[k]];
      return [c[0] * sh + n, c[1] * sh + n, c[2] * sh + n]; });
  }

  // tile = metres covered by one texture repeat
  const DEFS = [
    { id: "concrete", label: "Concrete slope", ko: "콘크리트 호안", tile: 1.33, make: concrete },
    { id: "grouted",  label: "Grouted riprap",  ko: "찰쌓기 사석",  tile: 2, make: grouted },
    { id: "gabion",   label: "Gabion",          ko: "개비온",       tile: 2, make: gabion },
    { id: "sodding",  label: "Sodding",         ko: "떼붙임",       tile: 3, make: sodding },
    { id: "riprap",   label: "Riprap",          ko: "사석(막쌓기)", tile: 3, make: riprap }
  ];
  let cache = null;
  function all() { if (!cache) cache = DEFS.map(d => ({ ...d, url: d.make().toDataURL("image/png") })); return cache; }
  window.DikeTextures = { all, get: id => all().find(t => t.id === id) || null };
})();
