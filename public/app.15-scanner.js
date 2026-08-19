/* ============================================================
   BARCODE SCANNER — scan-to-pick & scan-to-receive.
   Uses the native BarcodeDetector (Chromium / Android) for live camera
   scanning; always exposes a manual box that also captures USB/Bluetooth
   scanner-gun input (they type the code, then Enter). Operates generically on
   any modal input marked data-scan-sku / data-scan-max, so both the Pick and
   the GRN modals reuse it unchanged.
   ============================================================ */

// Cached sku/name/barcode map so the pick/GRN modals resolve a scanned code
// without pulling full inventory each time.
async function loadBarcodeMap(force) {
  if (APP._barcodeMap && !force) return APP._barcodeMap;
  const d = await api('/barcode-map').catch(() => null);
  const byBarcode = {}, bySku = {};
  (d?.items || []).forEach(it => {
    const bc = String(it.barcode || '').trim();
    if (bc) byBarcode[bc] = it;
    bySku[String(it.sku || '').trim().toUpperCase()] = it;
  });
  APP._barcodeMap = { byBarcode, bySku };
  return APP._barcodeMap;
}

// Resolve a scanned string to an item: barcode first, then SKU (a scanner may
// read a SKU-printed label or a QR encoding the SKU).
function resolveScan(code) {
  const m = APP._barcodeMap; if (!m) return null;
  const c = String(code || '').trim(); if (!c) return null;
  return m.byBarcode[c] || m.bySku[c.toUpperCase()] || null;
}

// Panel markup dropped into the top of a pick/GRN modal. verb: 'pick'|'receive'.
function scanPanelHtml(verb) {
  const word = verb === 'pick' ? 'pick' : 'receive';
  return `<div class="scan-panel">
    <div class="scan-head">
      <span class="scan-title">📷 Scan to ${word}</span>
      <span class="scan-status" id="scan-status">Scan an item to start — counts reset to 0 on first scan.</span>
    </div>
    <div class="scan-body">
      <div class="scan-cam" id="scan-cam" hidden>
        <video id="scan-video" playsinline muted></video>
        <div class="scan-reticle"></div>
      </div>
      <div class="scan-controls">
        <button type="button" class="btn btn-secondary btn-sm" id="scan-cam-btn" ${dataAct('scanStartCamera')}>📷 Start camera</button>
        <input type="text" id="scan-input" class="scan-input" placeholder="Scan or type barcode / SKU, then Enter" autocomplete="off" autocapitalize="off" spellcheck="false">
      </div>
      <div class="scan-tally" id="scan-tally"></div>
    </div>
  </div>`;
}

// Lazily load the bundled ZXing decoder (only when the native BarcodeDetector
// is absent — e.g. iPhone Safari/Chrome, desktop Safari/Firefox).
let _zxingPromise = null;
function ensureZXing() {
  if (window.ZXing && window.ZXing.BrowserMultiFormatReader) return Promise.resolve(true);
  if (_zxingPromise) return _zxingPromise;
  _zxingPromise = new Promise(resolve => {
    const s = document.createElement('script');
    s.src = '/vendor/zxing.min.js';
    s.onload = () => resolve(!!(window.ZXing && window.ZXing.BrowserMultiFormatReader));
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return _zxingPromise;
}

// Start scanning `video`, invoking onCode(rawValue) per decode. Prefers the
// native BarcodeDetector; falls back to the bundled ZXing decoder so the camera
// works on iPhone Safari/Chrome and desktop Safari/Firefox too. Returns
// { stop } on success, or { error:'camera'|'unsupported' }.
async function startCameraScan(video, onCode) {
  if (!video) return { error: 'unsupported' };
  if ('BarcodeDetector' in window) {
    let detector = null;
    try {
      let fmts = ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','codabar','qr_code'];
      if (BarcodeDetector.getSupportedFormats) {
        const sup = await BarcodeDetector.getSupportedFormats();
        const f = fmts.filter(x => sup.includes(x)); fmts = f.length ? f : sup;
      }
      detector = new BarcodeDetector({ formats: fmts });
    } catch (e) { detector = null; }
    if (detector) {
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }); }
      catch (e) { return { error: 'camera' }; }
      video.srcObject = stream; await video.play().catch(() => {});
      const state = { running: true, raf: 0 };
      const loop = async () => {
        if (!state.running) return;
        try { const codes = await detector.detect(video); if (codes && codes.length && codes[0].rawValue) onCode(codes[0].rawValue); } catch (e) {}
        state.raf = requestAnimationFrame(loop);
      };
      loop();
      return { stop() { state.running = false; if (state.raf) cancelAnimationFrame(state.raf); try { stream.getTracks().forEach(t => t.stop()); } catch (e) {} if (video) video.srcObject = null; } };
    }
  }
  // ZXing fallback
  const ok = await ensureZXing();
  if (!ok) return { error: 'unsupported' };
  let reader;
  try { reader = new window.ZXing.BrowserMultiFormatReader(); } catch (e) { return { error: 'unsupported' }; }
  const cb = (result) => { if (result) { const t = result.getText ? result.getText() : (result.text || ''); if (t) onCode(t); } };
  try {
    if (typeof reader.decodeFromConstraints === 'function') {
      await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, video, cb);
    } else {
      await reader.decodeFromVideoDevice(undefined, video, cb);
    }
  } catch (e) { try { reader.reset(); } catch (_) {} return { error: 'camera' }; }
  return { stop() { try { reader.reset(); } catch (e) {} if (video) video.srcObject = null; } };
}

// Wire the manual box + reset state. Call once, right after openModal().
function initScan(verb) {
  APP._scan = { armed: false, counts: {}, verb };
  const input = document.getElementById('scan-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = input.value.trim();
      input.value = '';
      if (v) handleScanCode(v);
    });
  }
  // Reset any prior camera when a new scan modal opens.
  window._scanStop = function () {};
}

// First real scan zeroes the quantity inputs so scanning counts up from 0.
// (Deferred to first scan so a manual-only user keeps the prefilled quantities.)
function scanArmIfNeeded() {
  if (APP._scan && APP._scan.armed) return;
  APP._scan = APP._scan || { counts: {} };
  APP._scan.armed = true;
  document.querySelectorAll('#modal [data-scan-sku]').forEach(inp => {
    inp.value = '0';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const st = document.getElementById('scan-status');
  if (st) st.textContent = 'Counts reset — each scan adds one unit.';
}

function handleScanCode(code) {
  scanArmIfNeeded();
  const hit = resolveScan(code);
  const inp = hit ? document.querySelector(`#modal [data-scan-sku="${cssAttr(hit.sku)}"]`) : null;
  if (!hit || !inp) { scanFeedback('unknown', code); return; }
  const max = parseInt(inp.dataset.scanMax || '999999', 10);
  const cur = parseInt(inp.value || '0', 10) || 0;
  if (cur >= max) { scanFeedback('full', hit.name, cur, max); return; }
  inp.value = String(cur + 1);
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  flashRow(inp);
  tallyScan(hit.sku, hit.name);
  scanFeedback('ok', hit.name, cur + 1, max);
}

// Escape a value for use inside an attribute selector.
function cssAttr(v) { return String(v).replace(/(["\\])/g, '\\$1'); }

function flashRow(inp) {
  const tr = inp.closest('tr'); if (!tr) return;
  tr.classList.add('scan-hit');
  setTimeout(() => tr.classList.remove('scan-hit'), 450);
}

function tallyScan(sku, name) {
  const c = APP._scan.counts = APP._scan.counts || {};
  c[sku] = c[sku] || { name, n: 0 };
  c[sku].n++;
  const el = document.getElementById('scan-tally');
  if (el) el.innerHTML = Object.values(c).map(v => `<span class="scan-chip">${h(v.name)} <b>×${v.n}</b></span>`).join('');
}

let _scanAudio;
function scanBeep(freq, ms) {
  try {
    _scanAudio = _scanAudio || new (window.AudioContext || window.webkitAudioContext)();
    const o = _scanAudio.createOscillator(), g = _scanAudio.createGain();
    o.frequency.value = freq; o.type = 'sine';
    o.connect(g); g.connect(_scanAudio.destination); g.gain.value = 0.05;
    o.start(); setTimeout(() => { try { o.stop(); } catch (e) {} }, ms);
  } catch (e) { /* audio blocked — silent */ }
}

function scanFeedback(kind, name, n, max) {
  if (kind === 'ok')        { scanBeep(880, 55); showToast(`✓ ${name} — ${n}${max && max < 999999 ? '/' + max : ''}`, 'success'); }
  else if (kind === 'full') { scanBeep(392, 130); showToast(`${name} already at its limit (${max})`, 'warning'); }
  else                      { scanBeep(294, 160); showToast(`Not on this list: ${String(name).slice(0, 24)}`, 'error'); }
}

// data-act: begin live camera scanning (native BarcodeDetector or ZXing fallback).
async function scanStartCamera() {
  scanArmIfNeeded();
  const camWrap = document.getElementById('scan-cam');
  const video = document.getElementById('scan-video');
  const btn = document.getElementById('scan-cam-btn');
  const status = document.getElementById('scan-status');
  if (!video) return;
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Starting camera…';

  let lastCode = '', lastAt = 0;
  const engine = await startCameraScan(video, (raw) => {
    const now = Date.now();
    // Same code within 900ms = one physical scan; allow re-scan after that.
    if (raw !== lastCode || now - lastAt > 900) { lastCode = raw; lastAt = now; handleScanCode(raw); }
  });
  if (btn) btn.disabled = false;

  if (!engine || engine.error) {
    const msg = engine && engine.error === 'camera'
      ? 'Camera blocked — allow access or use a scanner gun'
      : 'Live camera scan unavailable here — type a code or use a scanner gun';
    showToast(msg, 'error');
    if (status) status.textContent = msg;
    return;
  }
  if (camWrap) camWrap.hidden = false;
  if (btn) { btn.textContent = 'Stop camera'; btn.setAttribute('data-act', 'scanStopCamera'); }
  if (status) status.textContent = 'Point the camera at a barcode.';
  window._scanStop = function () {
    if (engine.stop) engine.stop();
    if (camWrap) camWrap.hidden = true;
    if (btn) { btn.textContent = '📷 Start camera'; btn.setAttribute('data-act', 'scanStartCamera'); }
    if (status) status.textContent = 'Camera stopped — scan again or type a code.';
  };
}

// data-act: stop live scanning.
function scanStopCamera() { if (typeof window._scanStop === 'function') window._scanStop(); }
