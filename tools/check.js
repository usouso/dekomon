// たたみやま 版1 — 画面の検査（ヘッドレス Chrome / Playwright）
// 使い方: node tools/check.js [--runs 3] [--sizes 1366x768,1920x1080,1920x910,375x812] [--port 8787] [--seed 1]
// やること: node serve.js を立てて、?auto=1&bg=1&speed=10&mute=1 の自動プレイ（3日）を 大きさごとに runs 周回し、
//   ui.js が console に出す '[たたみやま auto]'（ずれ・おちた・数字の変化）と '[たたみやま 検査]'（重なり・はみ出し・ページのスクロール）を集めて 表（Markdown）にする。
//   終わったら ブラウザと サーバーを 必ず閉じる。
'use strict';
var { chromium } = require('playwright');
var { spawn } = require('child_process');
var path = require('path');
function arg(name, def) { var i = process.argv.indexOf('--' + name); if (i < 0) return def; var v = process.argv[i + 1]; return (v === undefined || v.indexOf('--') === 0) ? true : v; }
var RUNS = parseInt(arg('runs', '3'), 10);
var SIZES = String(arg('sizes', '1366x768,1920x1080,1920x910,375x812')).split(',').map(function (s) { var a = s.split('x'); return { w: parseInt(a[0], 10), h: parseInt(a[1], 10) }; });
var PORT = parseInt(arg('port', '8787'), 10);
var SEED0 = parseInt(arg('seed', '1'), 10);
var TIMEOUT_MS = parseInt(arg('timeout', String(10 * 60 * 1000)), 10);
function startServer() {
  return new Promise(function (resolve, reject) {
    var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
    sv.stdout.on('data', function () { resolve(sv); });
    sv.stderr.on('data', function (d) { process.stderr.write(String(d)); });
    sv.on('exit', function (c) { if (c) reject(new Error('serve.js exit ' + c)); });
    setTimeout(function () { resolve(sv); }, 1500);
  });
}
async function runSize(browser, size, idx) {
  var ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
  var page = await ctx.newPage();
  var autoLines = [], errs = [], mism = [], misc = [];
  page.on('console', function (m) { var t = m.text(); if (t.indexOf('[たたみやま auto]') === 0) autoLines.push(t); else if (t.indexOf('[たたみやま 検査]') === 0) errs.push(t); else if (t.indexOf('[たたみやま] 画面と計算がずれた') === 0) mism.push(t); else if (m.type() === 'error') misc.push(t); });
  page.on('pageerror', function (e) { misc.push('pageerror: ' + e.message); });
  var seed = SEED0 + idx * 100;
  await page.goto('http://localhost:' + PORT + '/?auto=1&bg=1&speed=10&mute=1&seed=' + seed + '&reset=1&runs=' + RUNS);
  var t0 = Date.now(), fin = false;
  while (!fin && Date.now() - t0 < TIMEOUT_MS) {
    await page.waitForTimeout(500);
    fin = await page.evaluate(function () { var W = window.__tatami; return W && (W.G.auto.finished || !!W.G.auto.error); }).catch(function () { return false; });
  }
  var a = await page.evaluate(function () { var A = window.__tatami.G.auto; return { auto: A, overlaps: window.__overlaps || [], inner: window.innerWidth + 'x' + window.innerHeight }; });
  await ctx.close();
  return { size: size, seed: seed, a: a, autoLines: autoLines, errs: errs, mism: mism, misc: misc, sec: Math.round((Date.now() - t0) / 1000) };
}
function fmtObj(o) { var ks = Object.keys(o || {}); return ks.length ? ks.map(function (k) { return k + ' ' + o[k]; }).join('、') : 'なし'; }
(async function () {
  var sv = await startServer();
  var browser = await chromium.launch();
  var rows = [];
  try { for (var i = 0; i < SIZES.length; i++) { var r = await runSize(browser, SIZES[i], i); rows.push(r); console.error('done ' + r.size.w + 'x' + r.size.h + ' (' + r.sec + 's)'); } }
  finally { await browser.close(); sv.kill(); }
  console.log('| 画面 | 窓の内側 | 周回 | 日 | 画面と計算のずれ | おちた | 数字の変化 | 重なり | はみ出し | ページのスクロール | エラー |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  rows.forEach(function (r) {
    var A = r.a.auto;
    console.log('| ' + (r.size.w >= 900 ? 'PC' : 'スマホ') + ' ' + r.size.w + '×' + r.size.h + '（seed ' + r.seed + '〜） | ' + r.a.inner + ' | ' + A.runs + ' | ' + A.days + ' | ' + A.mismatches + ' | ' + A.falls + ' | ' + A.changes + ' | ' + A.overlaps + ' | ' + A.overflow + ' | ' + fmtObj(A.pageScroll) + ' | ' + (r.misc.length + (A.error ? 1 : 0)) + ' |');
  });
  console.log('');
  rows.forEach(function (r) {
    console.log('### ' + r.size.w + 'x' + r.size.h);
    console.log('最後の auto の行：' + (r.autoLines[r.autoLines.length - 1] || '（なし）'));
    if (r.a.auto.error) console.log('auto のエラー：' + r.a.auto.error);
    if (r.mism.length) { console.log('ずれ：'); r.mism.slice(0, 10).forEach(function (m) { console.log('- ' + m); }); }
    console.log('検査の行（' + r.errs.length + '）：');
    var seen = {}; r.errs.forEach(function (e) { if (!seen[e]) { seen[e] = true; console.log('- ' + e); } });
    if (r.misc.length) { console.log('そのほかの console エラー（' + r.misc.length + '）：'); r.misc.slice(0, 10).forEach(function (m) { console.log('- ' + m); }); }
    console.log('');
  });
})().catch(function (e) { console.error(e); process.exit(1); });
