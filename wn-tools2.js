/* WireNerd Tools — batch 2 (adds to window.WNT). NEC 2023 tables; verify against your adopted code. */
(function (root) {
  'use strict';
  var W = root.WNT, SQ3 = Math.sqrt(3);
  var STD = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500,
    600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000]; // 240.6(A)
  function nextStd(a) { for (var i = 0; i < STD.length; i++) if (STD[i] >= a - 1e-9) return STD[i]; return null; }
  function stdAtOrBelow(a) { var r = null; for (var i = 0; i < STD.length; i++) if (STD[i] <= a + 1e-9) r = STD[i]; return r; }

  /* transformer */
  function xfmr(o) { // {kva, pv, sv, phase}
    var k = o.phase === '3' ? SQ3 : 1;
    return { ip: o.kva * 1000 / (k * o.pv), is: o.kva * 1000 / (k * o.sv) };
  }
  /* series / parallel */
  function resist(list, volts) {
    var rs = list.filter(function (r) { return r > 0; }); if (!rs.length) return null;
    var s = rs.reduce(function (a, b) { return a + b; }, 0), p = 1 / rs.reduce(function (a, b) { return a + 1 / b; }, 0);
    var out = { series: s, parallel: p, n: rs.length, rs: rs };
    if (volts > 0) {
      out.sI = volts / s; out.sDrops = rs.map(function (r) { return out.sI * r; }); out.sP = volts * out.sI;
      out.pI = volts / p; out.pBranch = rs.map(function (r) { return volts / r; }); out.pP = volts * out.pI;
    }
    return out;
  }
  /* power triangle: any two of kw,kva,kvar,pf */
  function triangle(v) {
    var kw = v.kw, kva = v.kva, kvar = v.kvar, pf = v.pf, have = ['kw', 'kva', 'kvar', 'pf'].filter(function (k) { return v[k] != null; });
    if (have.length !== 2) return { error: 'Enter exactly two values.' };
    if (pf != null && !(pf > 0 && pf <= 1)) return { error: 'Power factor must be between 0 and 1.' };
    var key = have.join(',');
    if (key === 'kw,kva') { if (kw > kva) return { error: 'kW can’t be larger than kVA.' }; kvar = Math.sqrt(kva * kva - kw * kw); pf = kw / kva; }
    else if (key === 'kw,kvar') { kva = Math.sqrt(kw * kw + kvar * kvar); pf = kw / kva; }
    else if (key === 'kw,pf') { kva = kw / pf; kvar = Math.sqrt(kva * kva - kw * kw); }
    else if (key === 'kva,kvar') { if (kvar > kva) return { error: 'kVAR can’t be larger than kVA.' }; kw = Math.sqrt(kva * kva - kvar * kvar); pf = kw / kva; }
    else if (key === 'kva,pf') { kw = kva * pf; kvar = Math.sqrt(kva * kva - kw * kw); }
    else if (key === 'kvar,pf') { if (pf >= 1) return { error: 'At PF 1 there is no kVAR.' }; kva = kvar / Math.sqrt(1 - pf * pf); kw = kva * pf; }
    return { kw: kw, kva: kva, kvar: kvar, pf: pf, angle: Math.acos(pf) * 180 / Math.PI };
  }
  /* bends */
  function rolling(o) { var t = Math.sqrt(o.rise * o.rise + o.roll * o.roll), m = W.OFFSET[o.angle]; return { trueOff: t, dist: t * m[0], shrink: t * m[1] }; }
  function saddle4(o) { // {height, angle, near, far}  marks from the pipe end
    var m = W.OFFSET[o.angle], D = o.height * m[0], s = o.height * m[1];
    return { dist: D, shrink: s, total: 2 * s, m1: o.near + s - D, m2: o.near + s, m3: o.far + s, m4: o.far + s + D };
  }
  function kick(o) { var a = Math.atan(o.rise / o.run) * 180 / Math.PI; return { angle: a, travel: Math.sqrt(o.rise * o.rise + o.run * o.run) }; }
  /* breaker */
  function breaker(o) { var req = o.amps * (o.cont ? 1.25 : 1); return { req: req, size: nextStd(req) }; }

  /* motors: NEC 430.248 (1-ph) and 430.250 (3-ph) full-load current */
  var M1 = { v: ['115', '200', '208', '230'], hp: ['1/6', '1/4', '1/3', '1/2', '3/4', '1', '1-1/2', '2', '3', '5', '7-1/2', '10'],
    t: { '1/6': [4.4, 2.5, 2.4, 2.2], '1/4': [5.8, 3.3, 3.2, 2.9], '1/3': [7.2, 4.1, 4.0, 3.6], '1/2': [9.8, 5.6, 5.4, 4.9], '3/4': [13.8, 7.9, 7.6, 6.9],
      '1': [16, 9.2, 8.8, 8], '1-1/2': [20, 11.5, 11, 10], '2': [24, 13.8, 13.2, 12], '3': [34, 19.6, 18.7, 17], '5': [56, 32.2, 30.8, 28],
      '7-1/2': [80, 46, 44, 40], '10': [100, 57.5, 55, 50] } };
  var M3 = { v: ['200', '208', '230', '460', '575'], hp: ['1/2', '3/4', '1', '1-1/2', '2', '3', '5', '7-1/2', '10', '15', '20', '25', '30', '40', '50', '60', '75', '100', '125', '150', '200'],
    t: { '1/2': [2.5, 2.4, 2.2, 1.1, 0.9], '3/4': [3.7, 3.5, 3.2, 1.6, 1.3], '1': [4.8, 4.6, 4.2, 2.1, 1.7], '1-1/2': [6.9, 6.6, 6.0, 3.0, 2.4],
      '2': [7.8, 7.5, 6.8, 3.4, 2.7], '3': [11.0, 10.6, 9.6, 4.8, 3.9], '5': [17.5, 16.7, 15.2, 7.6, 6.1], '7-1/2': [25.3, 24.2, 22, 11, 9],
      '10': [32.2, 30.8, 28, 14, 11], '15': [48.3, 46.2, 42, 21, 17], '20': [62.1, 59.4, 54, 27, 22], '25': [78.2, 74.8, 68, 34, 27],
      '30': [92, 88, 80, 40, 32], '40': [120, 114, 104, 52, 41], '50': [150, 143, 130, 65, 52], '60': [177, 169, 154, 77, 62],
      '75': [221, 211, 192, 96, 77], '100': [285, 273, 248, 124, 99], '125': [359, 343, 312, 156, 125], '150': [414, 396, 360, 180, 144],
      '200': [552, 528, 480, 240, 192] } };
  var OCPD = { itb: [2.5, 'Inverse-time breaker'], tdf: [1.75, 'Dual-element (time-delay) fuse'], ntdf: [3.0, 'Non-time-delay fuse'], itrip: [8.0, 'Instantaneous-trip breaker'] };
  function motor(o) { // {phase, hp, volts, metal, col, ocpd, fla, sf115}
    var T = o.phase === '3' ? M3 : M1, flc = T.t[o.hp][T.v.indexOf(o.volts)];
    var need = flc * 1.25, A = W.AMP[o.metal][o.col], wire = null;
    for (var i = 0; i < W.SIZES.length; i++) { var s = W.SIZES[i]; if (A[s] != null && A[s] >= need - 1e-9) { wire = s; break; } }
    var oc = OCPD[o.ocpd], max = flc * oc[0], dev = nextStd(max);
    var ol = o.fla > 0 ? o.fla * (o.sf115 ? 1.25 : 1.15) : null;
    return { flc: flc, need: need, wire: wire, wireAmp: wire ? A[wire] : null, ocMax: max, ocNext: dev, ocName: oc[1], ocPct: oc[0] * 100, ol: ol };
  }
  /* derating: 310.15(B)(1)(1) ambient correction (30°C base) and 310.15(C)(1) adjustment */
  var AMB = [[10, 1.29, 1.20, 1.15], [15, 1.22, 1.15, 1.12], [20, 1.15, 1.11, 1.08], [25, 1.08, 1.05, 1.04], [30, 1.00, 1.00, 1.00],
    [35, 0.91, 0.94, 0.96], [40, 0.82, 0.88, 0.91], [45, 0.71, 0.82, 0.87], [50, 0.58, 0.75, 0.82], [55, 0.41, 0.67, 0.76],
    [60, null, 0.58, 0.71], [65, null, 0.47, 0.65], [70, null, 0.33, 0.58], [75, null, null, 0.50], [80, null, null, 0.41], [85, null, null, 0.29]];
  function ambFactor(c, col) { var k = col === 60 ? 1 : col === 75 ? 2 : 3; for (var i = 0; i < AMB.length; i++) if (c <= AMB[i][0]) return AMB[i][k]; return null; }
  function adjFactor(n) { return n <= 3 ? 1 : n <= 6 ? 0.8 : n <= 9 ? 0.7 : n <= 20 ? 0.5 : n <= 30 ? 0.45 : n <= 40 ? 0.4 : 0.35; }
  function derate(o) { // {size, metal, insCol, termCol, ambientC, ccc}
    var base = W.AMP[o.metal][o.insCol][o.size], cf = ambFactor(Math.ceil(o.ambientC), o.insCol), af = adjFactor(o.ccc);
    if (cf == null) return { error: 'This insulation isn’t rated for that ambient temperature.' };
    var der = base * cf * af, term = W.AMP[o.metal][o.termCol][o.size];
    return { base: base, cf: cf, af: af, derated: der, term: term, final: Math.min(der, term) };
  }
  /* grounding: 250.122 EGC and 250.66 GEC */
  var EGC = [[15, '14', '12'], [20, '12', '10'], [60, '10', '8'], [100, '8', '6'], [200, '6', '4'], [300, '4', '2'], [400, '3', '1'], [500, '2', '1/0'],
    [600, '1', '2/0'], [800, '1/0', '3/0'], [1000, '2/0', '4/0'], [1200, '3/0', '250'], [1600, '4/0', '350'], [2000, '250', '400'], [2500, '350', '600'],
    [3000, '400', '600'], [4000, '500', '750'], [5000, '700', '1200'], [6000, '800', '1200']];
  function egc(amps) { for (var i = 0; i < EGC.length; i++) if (amps <= EGC[i][0]) return { cu: EGC[i][1], al: EGC[i][2], row: EGC[i][0] }; return null; }
  var KC = { '8': 16.51, '6': 26.24, '4': 41.74, '3': 52.62, '2': 66.36, '1': 83.69, '1/0': 105.6, '2/0': 133.1, '3/0': 167.8, '4/0': 211.6 };
  function kcmil(s) { return +s >= 250 ? +s : KC[s] != null ? KC[s] : W.CMIL[s] / 1000; }
  function gec(o) { // {size (largest ungrounded, total per phase), metal}
    var k = kcmil(o.size), cuEq = o.metal === 'cu', r;
    // rows in copper kcmil / aluminum kcmil upper bounds
    var rows = [[66.36, 105.6, '8', '6'], [105.6, 167.8, '6', '4'], [167.8, 250, '4', '2'], [350, 500, '2', '1/0'], [600, 900, '1/0', '3/0'], [1100, 1750, '2/0', '4/0'], [Infinity, Infinity, '3/0', '250']];
    for (var i = 0; i < rows.length; i++) { if (k <= (cuEq ? rows[i][0] : rows[i][1]) + 1e-9) { r = rows[i]; break; } }
    return { cu: r[2], al: r[3] };
  }
  /* AWG <-> mm2 */
  var IEC = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
  function awgToMm2(s) {
    if (+s >= 250) return +s * 0.506707;
    var n = s.indexOf('/') > 0 ? -(+s.split('/')[0] - 1) : +s; // 1/0 -> 0, 2/0 -> -1 ...
    var d = 0.005 * Math.pow(92, (36 - n) / 39); return Math.PI / 4 * d * d * 645.16;
  }
  function nearestIEC(mm) { var best = IEC[0]; IEC.forEach(function (x) { if (Math.abs(x - mm) < Math.abs(best - mm)) best = x; }); var up = IEC.filter(function (x) { return x >= mm; })[0]; return { nearest: best, up: up }; }

  var add = { STD: STD, nextStd: nextStd, xfmr: xfmr, resist: resist, triangle: triangle, rolling: rolling, saddle4: saddle4, kick: kick,
    breaker: breaker, M1: M1, M3: M3, OCPD: OCPD, motor: motor, AMB: AMB, ambFactor: ambFactor, adjFactor: adjFactor, derate: derate,
    EGC: EGC, egc: egc, gec: gec, IEC: IEC, awgToMm2: awgToMm2, nearestIEC: nearestIEC };
  for (var k in add) W[k] = add[k];
})(typeof window !== 'undefined' ? window : globalThis);
