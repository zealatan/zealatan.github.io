/* Re-import an exported ofdm-e2e-signals JSON and regenerate the chain from its
 * config + seed + stored bits. Usage: node tests/regenerate_export.mjs <file.json>
 * Exit code 0 only if every stored signal is reproduced exactly. */
import fs from "node:fs";
import { parseExport, regenerate } from "../js/experiments/export.js";

const file = process.argv[2];
if (!file) { console.error("usage: node tests/regenerate_export.mjs <file.json>"); process.exit(2); }
const doc = parseExport(fs.readFileSync(file, "utf8"));
const rg = regenerate(doc);
const rows = ["txIQ", "qamSymbols", "rxIQ", "channelImpulseResponse", "equalizedSymbols"];
for (const k of rows) console.log(`${k.padEnd(24)} maxAbsDiff=${rg[k].maxAbs}  NMSE=${rg[k].nmse}`);
console.log(`txBits equal: ${rg.txBitsEqual}   rxBits equal: ${rg.rxBitsEqual}`);
console.log(`BER regenerated=${rg.ber}  stored=${rg.storedBer}`);
const exact = rows.every(k => rg[k].maxAbs === 0) && rg.txBitsEqual && rg.rxBitsEqual && rg.ber === rg.storedBer;
console.log(exact ? "REPRODUCED EXACTLY" : "NOT REPRODUCED");
process.exit(exact ? 0 : 1);
