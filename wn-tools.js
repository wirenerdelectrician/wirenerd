/* WireNerd Tools — calculation engine + small UI helpers.
   Every formula here is standard electrical math; code-table values are from the
   NEC (2023) Chapter 3 / Chapter 9 tables. Always verify against your adopted code book. */
(function (root) {
  'use strict';
  var SQ3 = Math.sqrt(3);

  /* ---------- PEIR (Ohm's law + power) ---------- */
  function peir(v) { // v: {P,E,I,R} numbers or null; needs exactly two
    var k = ['P', 'E', 'I', 'R'].filter(function (x) { return v[x] != null && isFinite(v[x]); });
    if (k.length !== 2) return { error: 'Enter exactly two values.' };
    for (var i = 0; i < 2; i++) if (!(v[k[i]] > 0)) return { error: 'Values must be greater than zero.' };
    var P = v.P, E = v.E, I = v.I, R = v.R, steps = [], key = k.join('');
    switch (key) {
      case 'EI': P = E * I; R = E / I; steps = ['Up the ladder: E × I = P', 'Down the ladder: E ÷ I = R']; break;
      case 'ER': I = E / R; P = E * I; steps = ['Middle rung: E ÷ R = I', 'Up the ladder: E × I = P']; break;
      case 'PE': I = P / E; R = E / I; steps = ['Down the ladder: P ÷ E = I', 'Down the ladder: E ÷ I = R']; break;
      case 'IR': E = I * R; P = E * I; steps = ['Up the ladder: I × R = E', 'Up the ladder: E × I = P']; break;
      case 'PI': E = P / I; R = E / I; steps = ['Middle rung: P ÷ I = E', 'Down the ladder: E ÷ I = R']; break;
      case 'PR': I = Math.sqrt(P / R); E = I * R; steps = ['Only P and R known: I = √(P ÷ R)', 'Up the ladder: I × R = E']; break;
    }
    return { P: P, E: E, I: I, R: R, steps: steps };
  }

  /* ---------- Watts / Amps ---------- */
  function wattsToAmps(o) { // {watts, volts, phase:'dc'|'1'|'3', pf}
    var pf = o.phase === 'dc' ? 1 : o.pf, k = o.phase === '3' ? SQ3 : 1;
    return o.watts / (k * o.volts * pf);
  }
  function ampsToWatts(o) { // {amps, volts, phase, pf}
    var pf = o.phase === 'dc' ? 1 : o.pf, k = o.phase === '3' ? SQ3 : 1;
    return o.amps * k * o.volts * pf;
  }

  /* ---------- wire data ---------- */
  var SIZES = ['14', '12', '10', '8', '6', '4', '3', '2', '1', '1/0', '2/0', '3/0', '4/0', '250', '300', '350', '400', '500', '600', '750'];
  // NEC Ch.9 Table 8 — circular mils
  var CMIL = { '14': 4110, '12': 6530, '10': 10380, '8': 16510, '6': 26240, '4': 41740, '3': 52620, '2': 66360, '1': 83690,
    '1/0': 105600, '2/0': 133100, '3/0': 167800, '4/0': 211600, '250': 250000, '300': 300000, '350': 350000, '400': 400000,
    '500': 500000, '600': 600000, '750': 750000 };
  function label(s) { return (+s >= 250) ? s + ' kcmil' : s + ' AWG'; }

  /* ---------- Voltage drop ---------- */
  var KVAL = { cu: 12.9, al: 21.2 }; // ohm·cmil/ft, the values used for code-exam VD math
  function voltageDrop(o) { // {volts, amps, length (one-way ft), size, metal, phase:'1'|'3'}
    var mult = o.phase === '3' ? SQ3 : 2;
    var vd = mult * KVAL[o.metal] * o.amps * o.length / CMIL[o.size];
    return { vd: vd, pct: vd / o.volts * 100, end: o.volts - vd };
  }
  function minSizeForDrop(o, targetPct) {
    for (var i = 0; i < SIZES.length; i++) {
      var r = voltageDrop({ volts: o.volts, amps: o.amps, length: o.length, size: SIZES[i], metal: o.metal, phase: o.phase });
      if (r.pct <= targetPct) return { size: SIZES[i], r: r };
    }
    return null;
  }

  /* ---------- Ampacity — NEC Table 310.16 (2023), not more than 3 current-carrying conductors, 30°C ambient ---------- */
  var AMP = {
    cu: { 60: { '14': 15, '12': 20, '10': 30, '8': 40, '6': 55, '4': 70, '3': 85, '2': 95, '1': 110, '1/0': 125, '2/0': 145, '3/0': 165, '4/0': 195, '250': 215, '300': 240, '350': 260, '400': 280, '500': 320, '600': 350, '750': 400 },
          75: { '14': 20, '12': 25, '10': 35, '8': 50, '6': 65, '4': 85, '3': 100, '2': 115, '1': 130, '1/0': 150, '2/0': 175, '3/0': 200, '4/0': 230, '250': 255, '300': 285, '350': 310, '400': 335, '500': 380, '600': 420, '750': 475 },
          90: { '14': 25, '12': 30, '10': 40, '8': 55, '6': 75, '4': 95, '3': 115, '2': 130, '1': 145, '1/0': 170, '2/0': 195, '3/0': 225, '4/0': 260, '250': 290, '300': 320, '350': 350, '400': 380, '500': 430, '600': 475, '750': 535 } },
    al: { 60: { '12': 15, '10': 25, '8': 35, '6': 40, '4': 55, '3': 65, '2': 75, '1': 85, '1/0': 100, '2/0': 115, '3/0': 130, '4/0': 150, '250': 170, '300': 195, '350': 210, '400': 225, '500': 260, '600': 285, '750': 320 },
          75: { '12': 20, '10': 30, '8': 40, '6': 50, '4': 65, '3': 75, '2': 90, '1': 100, '1/0': 120, '2/0': 135, '3/0': 155, '4/0': 180, '250': 205, '300': 230, '350': 250, '400': 270, '500': 310, '600': 340, '750': 385 },
          90: { '12': 25, '10': 35, '8': 45, '6': 55, '4': 75, '3': 85, '2': 100, '1': 115, '1/0': 135, '2/0': 150, '3/0': 175, '4/0': 205, '250': 230, '300': 260, '350': 280, '400': 305, '500': 350, '600': 385, '750': 435 } }
  };
  // 240.4(D) small-conductor overcurrent limits
  var SMALL = { cu: { '14': 15, '12': 20, '10': 30 }, al: { '12': 15, '10': 25 } };

  /* ---------- Box fill — NEC 314.16 ---------- */
  var BOXVOL = { '18': 1.5, '16': 1.75, '14': 2.0, '12': 2.25, '10': 2.5, '8': 3.0, '6': 5.0 };
  // o: {cond:{'14':n,...}, egcCount, egcSize, devices:[size,...] (one per yoke), clampSize|null, fittings:n, fittingSize}
  function boxFill(o) {
    var lines = [], total = 0, largest = null;
    var order = ['18', '16', '14', '12', '10', '8', '6'];
    order.forEach(function (s) {
      var n = o.cond[s] || 0; if (!n) return;
      var v = n * BOXVOL[s]; total += v; lines.push([n + ' × ' + s + ' AWG conductors', v]);
      if (largest === null || order.indexOf(s) > order.indexOf(largest)) largest = s;
    });
    if (o.egcCount > 0) {
      var eu = 1 + Math.max(0, o.egcCount - 4) * 0.25, ev = eu * BOXVOL[o.egcSize];
      total += ev; lines.push([o.egcCount + ' ground wire' + (o.egcCount > 1 ? 's' : '') + ' (' + o.egcSize + ' AWG) = ' + eu + ' allowance', ev]);
    }
    (o.devices || []).forEach(function (s, i) { var v = 2 * BOXVOL[s]; total += v; lines.push(['Device #' + (i + 1) + ' (2 × ' + s + ' AWG)', v]); });
    if (o.clampSize) { var cv = BOXVOL[o.clampSize]; total += cv; lines.push(['Internal cable clamps (1 × ' + o.clampSize + ' AWG)', cv]); }
    if (o.fittings > 0) { var fv = o.fittings * BOXVOL[o.fittingSize]; total += fv; lines.push([o.fittings + ' support fitting' + (o.fittings > 1 ? 's' : '') + ' (' + o.fittingSize + ' AWG each)', fv]); }
    return { total: total, lines: lines };
  }
  var BOXES = [
    ['4" round/octagon × 1-1/4"', 12.5], ['4" round/octagon × 1-1/2"', 15.5], ['4" round/octagon × 2-1/8"', 21.5],
    ['4" square × 1-1/4"', 18.0], ['4" square × 1-1/2"', 21.0], ['4" square × 2-1/8"', 30.3],
    ['4-11/16" square × 1-1/4"', 25.5], ['4-11/16" square × 1-1/2"', 29.5], ['4-11/16" square × 2-1/8"', 42.0],
    ['3×2 device box × 1-1/2"', 7.5], ['3×2 device box × 2"', 10.0], ['3×2 device box × 2-1/4"', 10.5],
    ['3×2 device box × 2-1/2"', 12.5], ['3×2 device box × 2-3/4"', 14.0], ['3×2 device box × 3-1/2"', 18.0]
  ];

  /* ---------- Conduit fill — EMT (Ch.9 Table 4) with THHN/THWN-2 (Table 5) ---------- */
  var EMT = [['1/2"', 0.304], ['3/4"', 0.533], ['1"', 0.864], ['1-1/4"', 1.496], ['1-1/2"', 2.036], ['2"', 3.356],
             ['2-1/2"', 5.858], ['3"', 8.846], ['3-1/2"', 11.545], ['4"', 14.753]];
  var THHN = { '14': 0.0097, '12': 0.0133, '10': 0.0211, '8': 0.0366, '6': 0.0507, '4': 0.0824, '3': 0.0973, '2': 0.1158,
    '1': 0.1562, '1/0': 0.1855, '2/0': 0.2223, '3/0': 0.2679, '4/0': 0.3237, '250': 0.3970, '300': 0.4608, '350': 0.5242,
    '400': 0.5863, '500': 0.7073 };
  function conduitFill(wires) { // wires: {size:count}
    var n = 0, area = 0;
    Object.keys(wires).forEach(function (s) { var c = wires[s] || 0; n += c; area += c * THHN[s]; });
    var limit = n === 1 ? 0.53 : n === 2 ? 0.31 : 0.40;
    var rows = EMT.map(function (e) { var pct = area / e[1] * 100; return { size: e[0], total: e[1], pct: pct, ok: pct <= limit * 100 + 1e-9 }; });
    var best = null; for (var i = 0; i < rows.length; i++) if (rows[i].ok) { best = rows[i]; break; }
    return { count: n, area: area, limit: limit, rows: rows, best: best };
  }

  /* ---------- Conduit bending — EMT hand bender field rules ---------- */
  var OFFSET = { // angle: [multiplier, shrink per inch of offset]
    10: [6.0, 1 / 16], 22.5: [2.6, 3 / 16], 30: [2.0, 1 / 4], 45: [1.4, 3 / 8], 60: [1.2, 1 / 2] };
  function offset(o) { // {height, angle, toObstacle|null}
    var t = OFFSET[o.angle], dist = o.height * t[0], shrink = o.height * t[1], r = { dist: dist, shrink: shrink };
    if (o.toObstacle != null && o.toObstacle > 0) { r.mark1 = o.toObstacle + shrink; r.mark2 = r.mark1 - dist; }
    return r;
  }
  function saddle3(o) { // {height, toCenter}  45° center, 22.5° outer bends
    var shrink = o.height * 3 / 16, spread = o.height * 2.5;
    var center = o.toCenter + shrink;
    return { shrink: shrink, spread: spread, center: center, before: center - spread, after: center + spread };
  }
  var TAKEUP = { '1/2"': 5, '3/4"': 6, '1"': 8, '1-1/4"': 11 }; // common EMT hand-bender take-up
  function stub90(o) { return { mark: o.height - TAKEUP[o.size], takeup: TAKEUP[o.size] }; }

  /* ---------- formatting ---------- */
  function fmt(x, d) { if (x == null || !isFinite(x)) return '—'; d = d == null ? 2 : d;
    var a = Math.abs(x); var dd = a >= 1000 ? 0 : a >= 100 ? 1 : d;
    return (+x.toFixed(dd)).toLocaleString('en-US', { maximumFractionDigits: dd }); }
  function inch(x) { // nearest 1/16"
    if (x == null || !isFinite(x)) return '—';
    var neg = x < 0; x = Math.abs(x);
    var s = Math.round(x * 16), w = Math.floor(s / 16), f = s % 16, g = 16;
    while (f && f % 2 === 0) { f /= 2; g /= 2; }
    var out = (w ? w : '') + (f ? (w ? ' ' : '') + f + '/' + g : '') ; if (!w && !f) out = '0';
    return (neg ? '−' : '') + out + '"';
  }

  root.WNT = { peir: peir, wattsToAmps: wattsToAmps, ampsToWatts: ampsToWatts, SIZES: SIZES, CMIL: CMIL, label: label,
    voltageDrop: voltageDrop, minSizeForDrop: minSizeForDrop, AMP: AMP, SMALL: SMALL, BOXVOL: BOXVOL, boxFill: boxFill, BOXES: BOXES,
    EMT: EMT, THHN: THHN, conduitFill: conduitFill, OFFSET: OFFSET, offset: offset, saddle3: saddle3, TAKEUP: TAKEUP, stub90: stub90,
    fmt: fmt, inch: inch };
})(typeof window !== 'undefined' ? window : globalThis);
