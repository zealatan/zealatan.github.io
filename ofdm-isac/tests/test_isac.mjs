import assert from "node:assert/strict";
import { makeGrid } from "../js/phy/engine.js";
import { buildTrain, targetEcho, sense, runIsac, strongestPeaks, numerology, C } from "../js/isac/isac.js";

const grid = makeGrid();
const fs = 20e6, fc = 24e9, u = numerology(grid,fs,fc,4);
assert.equal(grid.N,128); assert.equal(grid.cp,16); assert.equal(grid.nSym,14);
assert.equal(u.M,64);
assert.ok(Math.abs(u.rangeBin-C/(2*fs))<1e-12);
assert.ok(Math.abs(u.velocityBin-C/(2*fc*u.cpi))<1e-12);

const train = buildTrain({grid,seed:9,nFrames:4});
assert.equal(train.symbols.length,64);
const identity = targetEcho(train,{fs,fc,targets:[{rangeM:0,velocityMps:0}],seed:2});
for(let i=0;i<identity.re.length;i++) {
  assert.ok(Math.abs(identity.re[i]-train.txIQ.re[i])<1e-12);
  assert.ok(Math.abs(identity.im[i]-train.txIQ.im[i])<1e-12);
}
const id = sense(train,identity,fs,fc);
const idPeak = strongestPeaks(id,1)[0];
assert.equal(idPeak.rangeBin,0); assert.equal(idPeak.velocityMps,0);
assert.equal(id.validCounts[0],train.first.pre.X1.re.reduce((n,v,i)=>n+(v*v+train.first.pre.X1.im[i]**2>1e-12),0));

for (const sign of [-1,1]) {
  const p = runIsac({grid,fs,fc,nFrames:4,seed:7,
    targets:[{rangeM:4*u.rangeBin,velocityMps:sign*3*u.velocityBin}]});
  assert.equal(p.peaks[0].rangeBin,4);
  assert.ok(Math.abs(p.peaks[0].velocityMps-sign*3*u.velocityBin)<u.velocityBin/2);
}

const two = runIsac({grid,fs,fc,nFrames:4,seed:7,snrDb:25,
  targets:[{rangeM:3*u.rangeBin,velocityMps:0,ampRe:1},
           {rangeM:8*u.rangeBin,velocityMps:0,ampRe:0.7}]});
assert.deepEqual(new Set(two.peaks.map(p=>p.rangeBin)),new Set([3,8]));

const oneFrame=runIsac({grid,fs,fc,nFrames:1,seed:7,targets:[{rangeM:3*u.rangeBin,velocityMps:0}]});
const fourFrames=runIsac({grid,fs,fc,nFrames:4,seed:7,targets:[{rangeM:3*u.rangeBin,velocityMps:0}]});
assert.ok(fourFrames.units.velocityBin < oneFrame.units.velocityBin/3.9);
assert.ok(fourFrames.peaks[0].amplitude > oneFrame.peaks[0].amplitude*1.8);

const deterministic=runIsac({grid,fs,fc,nFrames:2,seed:7,snrDb:10,targets:[{rangeM:2*u.rangeBin,velocityMps:0}]});
const deterministic2=runIsac({grid,fs,fc,nFrames:2,seed:7,snrDb:10,targets:[{rangeM:2*u.rangeBin,velocityMps:0}]});
assert.deepEqual(deterministic.peaks,deterministic2.peaks);

const fractional=runIsac({grid,fs,fc,nFrames:2,seed:7,
  targets:[{rangeM:4.4*u.rangeBin,velocityMps:0}]});
assert.ok(Math.abs(fractional.peaks[0].rangeM-4.4*u.rangeBin)<=u.rangeBin/2);
assert.equal(fractional.peaks[0].dopplerBin,fractional.units.M/2);

const phase1=Array.from({length:grid.N},(_,k)=>{
  const a=-2*Math.PI*k*3/grid.N;return [Math.cos(a),Math.sin(a)];});
const phase2=Array.from({length:grid.N},(_,k)=>{
  const a=-2*Math.PI*k*(3+grid.N)/grid.N;return [Math.cos(a),Math.sin(a)];});
for(let k=0;k<grid.N;k++)for(let q=0;q<2;q++)assert.ok(Math.abs(phase1[k][q]-phase2[k][q])<1e-12);
const slow=Array.from({length:u.M},(_,m)=>[Math.cos(2*Math.PI*3*m/u.M),Math.sin(2*Math.PI*3*m/u.M)]);
const slowAlias=Array.from({length:u.M},(_,m)=>[Math.cos(2*Math.PI*(3/u.M+1)*m),Math.sin(2*Math.PI*(3/u.M+1)*m)]);
for(let m=0;m<u.M;m++)for(let q=0;q<2;q++)assert.ok(Math.abs(slow[m][q]-slowAlias[m][q])<1e-12);
console.log("ISAC sensing regression: 13 checks passed");
