/* =========================================================================
 * OFDM E2E — Monte-Carlo worker (module). Runs real end-to-end frames off
 * the UI thread: BER/EVM vs SNR sweeps and actual image transmission.
 * ========================================================================= */
import { makeGrid, transmit, MODS } from "../phy/engine.js";
import { applyChannel } from "../channel/channel.js";
import { receive } from "../receiver/receiver.js";

/* Accounting: a frame whose receiver throws (frame not located / truncated)
 * yields no recovered bits. Its payload bits are counted as ERRORS (no
 * assumed 50% random-guess rate), and the sync-loss count is reported
 * separately so BER and frame-loss are never conflated. */
function runFrames(cfg, snrDb, minErrors, maxBits, seed0) {
  const grid = makeGrid(cfg.gridCfg ?? {});
  let errs = 0, bits = 0, evmAcc = 0, evmCnt = 0, frames = 0, syncFail = 0;
  while (errs < minErrors && bits < maxBits) {
    const seed = seed0 + frames;
    const tx = transmit({ grid, mod: cfg.mod, seed });
    const ch = applyChannel(tx, { ...cfg.chan, seed,
      noise: { mode: cfg.snrMode, valueDb: snrDb } });
    frames++;
    let r;
    try {
      r = receive(ch.rxIQ, tx, ch, cfg.rx);
    } catch (e) {
      syncFail++;
      errs += tx.txBits.length;
      bits += tx.txBits.length;
      continue;
    }
    errs += r.bitErrors; bits += r.bitTotal; evmAcc += r.evm; evmCnt++;
  }
  return { errs, bits, evm: evmCnt ? evmAcc / evmCnt : null, frames, syncFail };
}

self.onmessage = (ev) => {
  const m = ev.data;
  if (m.type === "sweep") {
    for (let i = 0; i < m.snrList.length; i++) {
      const s = m.snrList[i];
      const r = runFrames(m.cfg, s, m.minErrors, m.maxBits, m.seed0 + i * 100000);
      self.postMessage({ type: "point", i, snrDb: s,
        ber: r.errs / r.bits, evm: r.evm, bits: r.bits, errs: r.errs,
        frames: r.frames, syncFail: r.syncFail });
    }
    self.postMessage({ type: "done" });
  } else if (m.type === "image") {
    // transmit the image's actual bits through the full PHY, frame by frame
    const grid = makeGrid(m.cfg.gridCfg ?? {});
    const bitsPerFrame = grid.dataBins.length * MODS[m.cfg.mod] * grid.nSym;
    const total = m.bits.length;
    const out = new Uint8Array(total);
    let pos = 0, frame = 0, errs = 0;
    while (pos < total) {
      const chunk = new Uint8Array(bitsPerFrame);
      for (let i = 0; i < bitsPerFrame; i++)
        chunk[i] = pos + i < total ? m.bits[pos + i] : 0;
      const seed = m.seed0 + frame;
      const tx = transmit({ grid, mod: m.cfg.mod, seed, txBits: chunk });
      const ch = applyChannel(tx, { ...m.cfg.chan, seed,
        noise: { mode: m.cfg.snrMode, valueDb: m.cfg.snrDb } });
      let rbits;
      try { rbits = receive(ch.rxIQ, tx, ch, m.cfg.rx).rxBits; }
      catch (e) { rbits = chunk.map(() => 0); }
      for (let i = 0; i < bitsPerFrame && pos + i < total; i++) {
        out[pos + i] = rbits[i];
        if (rbits[i] !== m.bits[pos + i]) errs++;
      }
      pos += bitsPerFrame; frame++;
      if (frame % 4 === 0)
        self.postMessage({ type: "imgProgress", done: pos, total });
    }
    self.postMessage({ type: "imgDone", bits: out, errs, total, frames: frame });
  }
};
