import { runIsac } from "./isac.js";

const $ = id => document.getElementById(id);
const cv = $("isacMap"), rangeCv = $("isacRange"), dopplerCv = $("isacDoppler");

function canvas(el) {
  const w = Math.max(300,Math.round(el.clientWidth)), h = Math.max(210,Math.round(el.clientHeight));
  el.width=w; el.height=h;
  const x=el.getContext("2d");x.fillStyle="#0b0f14";x.fillRect(0,0,w,h);
  x.font="12px sans-serif";x.fillStyle="#c9d1d9";return {x,w,h};
}
function line(el, values, title, xLabel) {
  const {x,w,h}=canvas(el), left=48,top=28,bottom=35,right=12;
  const max=Math.max(...values,1e-12);
  x.strokeStyle="#30363d";x.strokeRect(left,top,w-left-right,h-top-bottom);
  x.strokeStyle="#58a6ff";x.lineWidth=2;x.beginPath();
  for(let i=0;i<values.length;i++) {
    const px=left+(w-left-right)*i/(values.length-1),
      py=h-bottom-(h-top-bottom)*values[i]/max;
    i?x.lineTo(px,py):x.moveTo(px,py);
  }
  x.stroke();x.fillStyle="#c9d1d9";x.fillText(title,10,17);
  x.fillStyle="#8b949e";x.fillText(xLabel,left,h-10);
}
function map(result) {
  const {x,w,h}=canvas(cv), left=54,top=28,bottom=36,right=13;
  const maxRangeBin=Math.min(result.rangesM.length-1,Math.ceil(150/result.units.rangeBin));
  const max=Math.max(...result.rd.flatMap(row=>Array.from(row.slice(0,maxRangeBin+1))));
  for(let d=0;d<result.rd.length;d++)for(let p=0;p<=maxRangeBin;p++) {
    const db=20*Math.log10(result.rd[d][p]/max+1e-12), t=Math.max(0,Math.min(1,(db+45)/45));
    x.fillStyle=`rgb(${Math.round(255*t)},${Math.round(80+130*t)},${Math.round(180-120*t)})`;
    const px=left+(w-left-right)*p/(maxRangeBin+1),
      py=top+(h-top-bottom)*(result.rd.length-1-d)/result.rd.length;
    x.fillRect(px,py,(w-left-right)/(maxRangeBin+1)+1,(h-top-bottom)/result.rd.length+1);
  }
  x.fillStyle="#c9d1d9";x.fillText("Range-Doppler map · relative magnitude (−45 to 0 dB)",10,17);
  x.fillStyle="#8b949e";x.fillText(`Range 0–${result.rangesM[maxRangeBin].toFixed(0)} m →`,left,h-10);
  x.save();x.translate(13,h/2+60);x.rotate(-Math.PI/2);x.fillText("Approaching velocity (m/s) →",0,0);x.restore();
  x.fillText(result.velocitiesMps.at(-1).toFixed(0),left+3,top+13);
  x.fillText(result.velocitiesMps[0].toFixed(0),left+3,h-bottom-4);
}
function number(id){return +$(id).value;}
let last=null;
function render(){
  if(!last)return;
  const r=last,pk=r.peaks[0];map(r);
  const d=pk.dopplerBin,p=pk.rangeBin;
  const nr=Math.min(r.rangesM.length,Math.ceil(150/r.units.rangeBin));
  line(rangeCv,Array.from(r.rd[d].slice(0,nr)),`Range profile at ${pk.velocityMps.toFixed(1)} m/s`,
    `Range 0–${r.rangesM[nr-1].toFixed(0)} m →`);
  line(dopplerCv,r.rd.map(row=>row[p]),`Doppler profile at ${pk.rangeM.toFixed(1)} m`,
    `Velocity ${r.velocitiesMps[0].toFixed(0)} to ${r.velocitiesMps.at(-1).toFixed(0)} m/s →`);
  $("isacMetrics").textContent=`Peak: ${pk.rangeM.toFixed(2)} m, ${pk.velocityMps.toFixed(2)} m/s · `+
    `CPI ${(r.units.cpi*1e3).toFixed(3)} ms · ΔR nominal ${r.units.rangeBin.toFixed(2)} m · `+
    `Δv ${r.units.velocityBin.toFixed(2)} m/s · CP ISI-free ${r.units.cpRange.toFixed(1)} m`;
  $("isacWarning").textContent=r.peaks.some(p=>p.rangeM>r.units.cpRange)?
    "A detected peak exceeds the CP distance. Classical division can suffer ISI/ICI there; interpret with care.":
    "Ideal monostatic timing and known transmitted symbols; no RF self-interference model.";
}
function run(){
  try {
    $("isacStatus").textContent="Computing…";
    const targets=[{rangeM:number("targetRange"),velocityMps:number("targetVelocity"),ampRe:1}];
    if($("secondTarget").checked)targets.push({rangeM:number("targetRange2"),
      velocityMps:number("targetVelocity2"),ampRe:number("targetAmplitude2")});
    last=runIsac({fs:20e6,fc:number("carrierGHz")*1e9,nFrames:number("isacFrames"),
      seed:number("isacSeed"),snrDb:number("isacSnr"),targets});
    render();$("isacStatus").textContent="Computed from the copied OFDM waveform";
  }catch(e){$("isacStatus").textContent=`Error: ${e.message}`;}
}
$("runIsac").addEventListener("click",run);
window.addEventListener("resize",render);
run();
