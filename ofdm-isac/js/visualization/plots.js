/* =========================================================================
 * OFDM E2E — canvas plot helpers (Layer C). Pure rendering; data in, pixels
 * out. Every plot labels its axes/units and the processing stage it shows.
 * ========================================================================= */

const FG = "#e6edf3", MUT = "#8b949e", GRID = "#20262e", AXIS = "#2a3038";

export function clear(cv) {
  const x = cv.getContext("2d");
  const w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height;
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  x.clearRect(0, 0, cv.width, cv.height);
  x.fillStyle = "#0b0f14"; x.fillRect(0, 0, cv.width, cv.height);
  return x;
}

function title(x, cv, txt) {
  x.fillStyle = MUT; x.font = "11px sans-serif"; x.textAlign = "left";
  x.fillText(txt, 8, 14);
}

export function scatter(cv, pts, opts = {}) {
  const x = clear(cv), W = cv.width, H = cv.height;
  const lim = opts.lim ?? 1.5;
  x.strokeStyle = GRID; x.lineWidth = 1; x.beginPath();
  for (let g = -1; g <= 1; g++) {
    const p = ((g / (2 * lim) + 0.5)) * W;
    x.moveTo(p, 0); x.lineTo(p, H); x.moveTo(0, (g / (2 * lim) + 0.5) * H); x.lineTo(W, (g / (2 * lim) + 0.5) * H);
  }
  x.stroke();
  x.strokeStyle = AXIS; x.beginPath();
  x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.moveTo(0, H / 2); x.lineTo(W, H / 2); x.stroke();
  const s = W / (2 * lim);
  x.fillStyle = opts.color ?? "rgba(255,214,10,0.9)";
  for (let i = 0; i < pts.re.length; i++) {
    const px = W / 2 + pts.re[i] * s, py = H / 2 - pts.im[i] * s;
    x.fillRect(px - 1.6, py - 1.6, 3.2, 3.2);
  }
  title(x, cv, opts.title ?? "");
  x.fillStyle = MUT; x.textAlign = "right";
  x.fillText("I →, Q ↑ (normalized, E_s=1)", W - 8, H - 6);
}

export function timeSeries(cv, sig, fs, opts = {}) {
  const x = clear(cv), W = cv.width, H = cv.height, padL = 36, padB = 20;
  const n = sig.re.length;
  let mx = 1e-9;
  for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(sig.re[i]), Math.abs(sig.im[i]));
  const X = (i) => padL + (W - padL - 8) * i / (n - 1);
  const Y = (v) => H / 2 - (H / 2 - padB) * v / (1.1 * mx);
  x.strokeStyle = AXIS; x.beginPath(); x.moveTo(padL, H / 2); x.lineTo(W - 8, H / 2); x.stroke();
  const line = (arr, col) => {
    x.strokeStyle = col; x.lineWidth = 0.8; x.beginPath();
    for (let i = 0; i < n; i++) { const px = X(i), py = Y(arr[i]); i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
  };
  line(sig.re, "#58a6ff"); line(sig.im, "#f0883e");
  if (opts.marks) for (const m of opts.marks) {
    x.strokeStyle = m.col; x.setLineDash([5, 4]); x.beginPath();
    x.moveTo(X(m.at), 18); x.lineTo(X(m.at), H - padB); x.stroke(); x.setLineDash([]);
    x.fillStyle = m.col; x.font = "10px sans-serif"; x.textAlign = "left";
    x.fillText(m.label, Math.min(X(m.at) + 3, W - 60), 26);
  }
  title(x, cv, opts.title ?? "");
  x.fillStyle = MUT; x.font = "10px sans-serif"; x.textAlign = "center";
  x.fillText(`time (µs @ ${(fs / 1e6).toFixed(1)} Msps) — blue I, orange Q`, W / 2, H - 5);
}

export function lineChart(cv, xs, series, opts = {}) {
  /* series: [{ys, col, label, dash?}] ; opts.logY, opts.xLabel, yLabel */
  const x = clear(cv), W = cv.width, H = cv.height;
  const padL = 46, padR = 10, padT = 20, padB = 28;
  const logY = !!opts.logY;
  let yMin = Infinity, yMax = -Infinity;
  for (const s of series) for (const v of s.ys) {
    if (v == null || (logY && v <= 0)) continue;
    const t = logY ? Math.log10(v) : v;
    yMin = Math.min(yMin, t); yMax = Math.max(yMax, t);
  }
  if (!isFinite(yMin)) { yMin = 0; yMax = 1; }
  if (opts.yMinFloor != null && logY) yMin = Math.max(yMin, Math.log10(opts.yMinFloor));
  if (yMax - yMin < 1e-9) yMax = yMin + 1;
  const X = (v) => padL + (W - padL - padR) * (v - xs[0]) / (xs[xs.length - 1] - xs[0] || 1);
  const Y = (v) => {
    const t = logY ? Math.log10(Math.max(v, Math.pow(10, yMin))) : v;
    return padT + (H - padT - padB) * (yMax - t) / (yMax - yMin);
  };
  x.strokeStyle = GRID; x.fillStyle = MUT; x.font = "10px sans-serif";
  if (logY) {
    for (let e = Math.ceil(yMin); e <= Math.floor(yMax); e++) {
      const y = padT + (H - padT - padB) * (yMax - e) / (yMax - yMin);
      x.beginPath(); x.moveTo(padL, y); x.lineTo(W - padR, y); x.stroke();
      x.textAlign = "right"; x.fillText("1e" + e, padL - 4, y + 3);
    }
  }
  x.textAlign = "center";
  const step = Math.max(1, Math.round((xs.length - 1) / 6));
  for (let i = 0; i < xs.length; i += step) {
    const px = X(xs[i]);
    x.strokeStyle = GRID; x.beginPath(); x.moveTo(px, padT); x.lineTo(px, H - padB); x.stroke();
    x.fillStyle = MUT; x.fillText(xs[i], px, H - padB + 14);
  }
  for (const s of series) {
    x.strokeStyle = s.col; x.lineWidth = s.width ?? 1.8;
    x.setLineDash(s.dash ? [5, 4] : []);
    x.beginPath(); let started = false;
    for (let i = 0; i < s.ys.length; i++) {
      const v = s.ys[i];
      if (v == null || (logY && v <= 0)) continue;
      const px = X(xs[i]), py = Y(v);
      if (!started) { x.moveTo(px, py); started = true; } else x.lineTo(px, py);
    }
    x.stroke(); x.setLineDash([]);
    if (s.points) {
      x.fillStyle = s.col;
      for (let i = 0; i < s.ys.length; i++) {
        const v = s.ys[i]; if (v == null || (logY && v <= 0)) continue;
        x.beginPath(); x.arc(X(xs[i]), Y(v), 2.5, 0, 6.283); x.fill();
      }
    }
  }
  title(x, cv, opts.title ?? "");
  x.fillStyle = MUT; x.textAlign = "center";
  x.fillText(opts.xLabel ?? "", W / 2, H - 5);
  // legend
  let lx = padL + 6;
  for (const s of series) {
    x.fillStyle = s.col; x.fillRect(lx, padT + 2, 12, 3);
    x.fillStyle = MUT; x.textAlign = "left"; x.fillText(s.label, lx + 15, padT + 7);
    lx += 15 + x.measureText(s.label).width + 14;
  }
}

export function stems(cv, mags, opts = {}) {
  const x = clear(cv), W = cv.width, H = cv.height, padL = 36, padB = 22;
  let mx = 1e-9; for (const v of mags) mx = Math.max(mx, v);
  const n = mags.length;
  const X = (i) => padL + (W - padL - 10) * i / Math.max(n - 1, 1);
  const Y = (v) => H - padB - (H - padB - 24) * v / (1.1 * mx);
  x.strokeStyle = AXIS; x.beginPath(); x.moveTo(padL, H - padB); x.lineTo(W - 10, H - padB); x.stroke();
  x.strokeStyle = opts.color ?? "#58a6ff"; x.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    x.beginPath(); x.moveTo(X(i), H - padB); x.lineTo(X(i), Y(mags[i])); x.stroke();
    x.beginPath(); x.arc(X(i), Y(mags[i]), 2.5, 0, 6.283);
    x.fillStyle = opts.color ?? "#58a6ff"; x.fill();
  }
  title(x, cv, opts.title ?? "");
  x.fillStyle = MUT; x.font = "10px sans-serif"; x.textAlign = "center";
  x.fillText(opts.xLabel ?? "tap delay (samples)", W / 2, H - 5);
}

export function freqCurves(cv, grid, curves, opts = {}) {
  /* curves: [{H, col, label, dotsAt?}] magnitude over ACTIVE bins, plotted
   * against centred frequency index (negative..positive).                  */
  const x = clear(cv), W = cv.width, H = cv.height, padL = 36, padB = 22;
  const N = grid.N;
  const order = [...grid.activeBins].sort((a, b) => ((a + N / 2) % N) - ((b + N / 2) % N));
  let mx = 1e-9;
  for (const c of curves) for (const k of order) mx = Math.max(mx, Math.hypot(c.H.re[k], c.H.im[k]));
  const X = (i) => padL + (W - padL - 10) * i / (order.length - 1);
  const Y = (v) => H - padB - (H - padB - 26) * v / (1.12 * mx);
  x.strokeStyle = AXIS; x.beginPath(); x.moveTo(padL, H - padB); x.lineTo(W - 10, H - padB); x.stroke();
  for (const c of curves) {
    x.strokeStyle = c.col; x.lineWidth = c.width ?? 1.6; x.beginPath();
    order.forEach((k, i) => {
      const v = Math.hypot(c.H.re[k], c.H.im[k]);
      const px = X(i), py = Y(v);
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    });
    x.stroke();
    if (c.dotsAt) {
      x.fillStyle = c.col;
      for (const k of c.dotsAt) {
        const i = order.indexOf(k); if (i < 0) continue;
        const v = Math.hypot(c.H.re[k], c.H.im[k]);
        x.beginPath(); x.arc(X(i), Y(v), 2.6, 0, 6.283); x.fill();
      }
    }
  }
  title(x, cv, opts.title ?? "|H(f)| over active subcarriers");
  x.fillStyle = MUT; x.font = "10px sans-serif"; x.textAlign = "center";
  x.fillText("subcarrier (negative → positive frequency)", W / 2, H - 5);
  let lx = padL + 6;
  for (const c of curves) {
    x.fillStyle = c.col; x.fillRect(lx, 20, 12, 3);
    x.fillStyle = MUT; x.textAlign = "left"; x.fillText(c.label, lx + 15, 25);
    lx += 15 + x.measureText(c.label).width + 14;
  }
}

export function spectrum(cv, sig, fs, opts = {}) {
  /* magnitude of an N-point FFT of a windowed segment, dB scale */
  const x = clear(cv), W = cv.width, H = cv.height, padL = 40, padB = 22;
  const N = opts.nfft ?? 512;
  const n = Math.min(N, sig.re.length);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < n; i++) {                       // Hann window
    const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
    re[i] = sig.re[i + (opts.offset ?? 0)] * w;
    im[i] = sig.im[i + (opts.offset ?? 0)] * w;
  }
  // simple DFT-free: reuse radix2 via closure-free local implementation
  opts.fft(re, im, false);
  const mags = new Float64Array(N);
  let mx = -Infinity;
  for (let k = 0; k < N; k++) {
    const d = 10 * Math.log10(re[k] ** 2 + im[k] ** 2 + 1e-12);
    mags[(k + N / 2) % N] = d;                        // centre DC
    mx = Math.max(mx, d);
  }
  const X = (i) => padL + (W - padL - 10) * i / (N - 1);
  const Y = (v) => 24 + (H - 24 - padB) * (mx - v) / 60;
  x.strokeStyle = "#d29922"; x.lineWidth = 0.9; x.beginPath();
  for (let i = 0; i < N; i++) {
    const px = X(i), py = Math.min(H - padB, Y(mags[i]));
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.stroke();
  title(x, cv, opts.title ?? "RX spectrum (Hann, dB, 60 dB span)");
  x.fillStyle = MUT; x.font = "10px sans-serif"; x.textAlign = "center";
  x.fillText(`frequency (−fs/2 … +fs/2, fs=${(fs / 1e6).toFixed(1)} MHz)`, W / 2, H - 5);
}

export function syncMetric(cv, M, marks, opts = {}) {
  const x = clear(cv), W = cv.width, H = cv.height, padL = 36, padB = 22;
  const n = M.length;
  const X = (i) => padL + (W - padL - 10) * i / (n - 1);
  const Y = (v) => H - padB - (H - padB - 26) * Math.min(v, 1.05);
  x.strokeStyle = AXIS; x.beginPath(); x.moveTo(padL, H - padB); x.lineTo(W - 10, H - padB); x.stroke();
  x.strokeStyle = "#d29922"; x.lineWidth = 1; x.beginPath();
  for (let i = 0; i < n; i++) { const px = X(i), py = Y(M[i]); i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.stroke();
  for (const m of marks) {
    x.strokeStyle = m.col; x.setLineDash(m.dash ? [5, 4] : []); x.beginPath();
    x.moveTo(X(m.at), 20); x.lineTo(X(m.at), H - padB); x.stroke(); x.setLineDash([]);
    x.fillStyle = m.col; x.font = "10px sans-serif"; x.textAlign = "left";
    x.fillText(m.label, Math.min(X(m.at) + 3, W - 70), 30);
  }
  title(x, cv, opts.title ?? "Schmidl–Cox timing metric M(d) (0..1)");
  x.fillStyle = MUT; x.font = "10px sans-serif"; x.textAlign = "center";
  x.fillText("sample lag d", W / 2, H - 5);
}
