'use strict';
// Evaluates automatic-check telemetry only; never certifies real input or visual QA.
function qualityGate(rows, opts) {
  const out = [];
  const add = (size, code, detail) => out.push({ size, code, detail });
  opts = opts || {};
  const required = Array.isArray(opts.sizes) ? opts.sizes : [];
  const inner0 = Array.isArray(opts.inner0) ? opts.inner0 : [];
  const number = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const sizeOK = s => typeof s === 'string' && /^[1-9][0-9]*x[1-9][0-9]*$/.test(s);
  if (!Number.isInteger(opts.runs) || opts.runs <= 0) add(null, 'config', 'runs must be a positive integer');
  if (!required.length || required.some(s => !sizeOK(s)) || new Set(required).size !== required.length) add(null, 'config', 'required sizes must be nonempty, valid and unique');
  if (inner0.some(s => !sizeOK(s) || !required.includes(s))) add(null, 'config', 'inner0 sizes must be included in required sizes');
  if (!Array.isArray(rows)) { add(null, 'missing-data', 'rows missing'); return out; }
  const seen = new Set();
  for (const r of rows) {
    if (!r || !r.size || !Number.isInteger(r.size.w) || !Number.isInteger(r.size.h) || r.size.w <= 0 || r.size.h <= 0) { add(null, 'missing-data', 'row size invalid'); continue; }
    const key = r.size.w + 'x' + r.size.h;
    if (seen.has(key)) add(key, 'duplicate-size', 'size reported more than once');
    seen.add(key);
    if (!required.includes(key)) add(key, 'unexpected-size', 'size was not requested');
    const A = r.a && r.a.auto;
    if (!A || typeof A !== 'object') { add(key, 'missing-data', 'auto telemetry missing'); continue; }
    for (const [label, n] of [['measured runs', r.runs], ['auto runs', A.runs]]) {
      if (!number(n) || !Number.isInteger(n)) add(key, 'missing-data', label + ' invalid');
      else if (n < opts.runs) add(key, 'incomplete-runs', label + ': ' + n + '/' + opts.runs);
    }
    for (const field of ['mismatches', 'overlaps', 'seeThrough', 'doubleFlash']) {
      if (!number(A[field])) add(key, 'missing-data', field + ' invalid');
      else if (A[field] > 0) add(key, field, String(A[field]));
    }
    if (!number(r.mism)) add(key, 'missing-data', 'console mismatch count invalid');
    else if (r.mism > 0) add(key, 'console-mismatch', String(r.mism));
    for (const field of ['autoLines', 'errs', 'misc']) {
      if (!Array.isArray(r[field])) add(key, 'missing-data', field + ' missing');
    }
    if (Array.isArray(r.autoLines) && !r.autoLines.length) add(key, 'missing-data', 'no auto progress logs');
    if (Array.isArray(r.misc) && r.misc.length) add(key, 'console-or-pageerror', r.misc.slice(0, 10).join('; '));
    for (const field of ['overlaps', 'seeThrough']) {
      if (!Array.isArray(r.a[field])) add(key, 'missing-data', field + ' details missing');
      else if (r.a[field].length) add(key, field + '-details', String(r.a[field].length));
    }
    function counts(field, enforceZero) {
      const values = A[field];
      if (!values || typeof values !== 'object' || Array.isArray(values)) { add(key, 'missing-data', field + ' missing'); return; }
      for (const [screen, n] of Object.entries(values)) {
        if (!number(n)) add(key, 'missing-data', field + '.' + screen + ' invalid');
        else if (enforceZero && n > 0) add(key, field, screen + ': ' + n);
      }
    }
    counts('pageScroll', r.size.w >= 900);
    counts('innerScroll', inner0.includes(key));
    counts('screens', false);
    if (A.screens && !Object.values(A.screens).some(n => number(n) && n > 0)) add(key, 'missing-data', 'no screen samples');
  }
  for (const key of required) if (!seen.has(key)) add(key, 'missing-size', 'requested size not tested');
  return out;
}
module.exports = qualityGate;
