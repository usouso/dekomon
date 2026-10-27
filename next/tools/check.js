// でこもん 版8 — 画面の検査（ヘッドレス Chrome / Playwright）
// 使い方: node tools/check.js [--runs 30] [--sizes 1366x650,1920x910,375x812] [--port 8787] [--egg] [--seed 1301] [--inner0 1920x910]
// --inner0：この大きさでは「中のスクロール」0 が 合格の条件（既定 1920x910。カンマで いくつでも）。合格しなければ 終了コード 1。
// やること: node serve.js を立てて、?auto=1&bg=1&speed=10&mute=1 の自動周回を 大きさごとに回し、
//   index.html の auto モードが console に出す '[でこもん auto]' の行と '[でこもん 検査]'（重なり・はみ出し・透け・ページのスクロール・2回の明るさ）、
//   '[でこもん] 画面と計算がずれた' を集めて、表（Markdown）にする。終わったら ブラウザと サーバーを 必ず閉じる。
// --egg を付けると ?egg=1（親になれる子がいれば たまごから。2周回目以降）。
'use strict';
var { chromium } = require('playwright');
var { spawn } = require('child_process');
var path = require('path');
var qualityGate = require('./check-gate');

function arg(name, def) { var i = process.argv.indexOf('--' + name); if (i < 0) return def; var v = process.argv[i + 1]; return (v === undefined || v.indexOf('--') === 0) ? true : v; }
var RUNS = parseInt(arg('runs', '30'), 10);
var SIZES = String(arg('sizes', '1366x650,1920x910,375x812')).split(',').map(function (s) { var a = s.split('x'); return { w: parseInt(a[0], 10), h: parseInt(a[1], 10) }; });
var PORT = parseInt(arg('port', '8787'), 10);
var EGG = arg('egg', false) === true;
var SEED0 = parseInt(arg('seed', '1301'), 10);
var TIMEOUT_MS = parseInt(arg('timeout', String(25 * 60 * 1000)), 10);
var INNER0 = String(arg('inner0', '1920x910')).split(',');

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
  var autoLines = [], errs = [], mism = 0, misc = [];
  page.on('console', function (m) {
    var t = m.text();
    if (t.indexOf('[でこもん auto]') === 0) autoLines.push(t);
    else if (t.indexOf('[でこもん 検査]') === 0) errs.push(t);
    else if (t.indexOf('[でこもん] 画面と計算がずれた') === 0) mism++;
    else if (m.type() === 'error') misc.push(t);
  });
  page.on('pageerror', function (e) { misc.push('pageerror: ' + e.message); });
  var seed = SEED0 + idx * 600;
  var url = 'http://localhost:' + PORT + '/?auto=1&bg=1&speed=10&mute=1&seed=' + seed + '&reset=1' + (EGG ? '&egg=1' : '');
  await page.goto(url);
  var t0 = Date.now(), runs = 0;
  while (runs < RUNS && Date.now() - t0 < TIMEOUT_MS) {
    await page.waitForTimeout(1000);
    runs = await page.evaluate(function () { return window.__dekomon ? window.__dekomon.G.auto.runs : 0; }).catch(function () { return runs; });
  }
  var a = await page.evaluate(function () { var A = window.__dekomon.G.auto; return { auto: A, bright: window.__dekomon.G.brightChanges, overlaps: window.__overlaps || [], seeThrough: window.__seeThrough || [], hall: window.__dekomon.STORE.hall.length, parents: window.__dekomon.dbg.eggParents().length, inner: window.innerWidth + 'x' + window.innerHeight }; });
  await ctx.close();
  return { size: size, seed: seed, runs: runs, a: a, autoLines: autoLines, errs: errs, mism: mism, misc: misc, sec: Math.round((Date.now() - t0) / 1000) };
}

function fmtObj(o) { var ks = Object.keys(o || {}); return ks.length ? ks.map(function (k) { return k + ' ' + o[k]; }).join('、') : 'なし'; }

(async function () {
  var sv = await startServer();
  var browser = await chromium.launch();
  var rows = [];
  try {
    for (var i = 0; i < SIZES.length; i++) {
      var r = await runSize(browser, SIZES[i], i);
      rows.push(r);
      console.error('done ' + r.size.w + 'x' + r.size.h + ' runs ' + r.runs + ' (' + r.sec + 's)');
    }
  } finally {
    await browser.close();
    sv.kill();
  }
  console.log('| 画面 | 大きさ（窓の内側） | 周回 | 戦い | 10連勝 | たまご周回 | おやの ひらめき | ずれ | 重なり・はみ出し | 透け | 1手に2回の明るさ | ページがスクロールした画面 | 中でスクロールした画面（回数） |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  rows.forEach(function (r) {
    var A = r.a.auto;
    var kind = r.size.w >= 900 ? 'PC' : 'スマホ';
    console.log('| ' + kind + ' ' + r.size.w + '×' + r.size.h + '（seed ' + r.seed + '〜） | ' + r.a.inner + ' | ' + A.runs + ' | ' + A.battles + ' | ' + A.clears + ' | ' + A.eggRuns + ' | ' + A.sparkParent + ' | ' + A.mismatches + ' | ' + A.overlaps + ' | ' + A.seeThrough + ' | ' + A.doubleFlash + ' | ' + fmtObj(A.pageScroll) + ' | ' + fmtObj(A.innerScroll) + ' |');
  });
  console.log('');
  rows.forEach(function (r) {
    console.log('### ' + r.size.w + 'x' + r.size.h);
    console.log('最後の auto の行：' + (r.autoLines[r.autoLines.length - 1] || '（なし）'));
    console.log('検査の行（' + r.errs.length + '）：');
    var seen = {}; r.errs.forEach(function (e) { if (!seen[e]) { seen[e] = true; console.log('- ' + e); } });
    if (r.a.overlaps.length) { console.log('重なりの詳細：'); r.a.overlaps.slice(0, 30).forEach(function (o) { console.log('- ' + JSON.stringify(o)); }); }
    if (r.misc.length) { console.log('そのほかの console エラー（' + r.misc.length + '）：'); r.misc.slice(0, 10).forEach(function (m) { console.log('- ' + m); }); }
    console.log('殿堂 ' + r.a.hall + ' 体、親になれる子 ' + r.a.parents + ' 体');
    console.log('');
    // 画面ごとの 中のスクロール（調べた回数は 0.1秒ごと）と 倍率
    var A = r.a.auto, sc = Object.keys(A.screens).sort();
    console.log('| 画面 | 調べた回数 | 中でスクロール | 例 | 倍率（回数） |');
    console.log('|---|---|---|---|---|');
    sc.forEach(function (s) { console.log('| ' + s + ' | ' + A.screens[s] + ' | ' + (A.innerScroll[s] || 0) + ' | ' + ((A.innerEx || {})[s] || '-') + ' | ' + fmtObj((A.zooms || {})[s]) + ' |'); });
    console.log('');
  });
  // QUALITY_GATE_BEGIN: automatic telemetry only; manual input and visual QA remain separate.
  var issues = qualityGate(rows, {
    runs: RUNS,
    sizes: SIZES.map(function (s) { return s.w + 'x' + s.h; }),
    inner0: INNER0
  });
  issues.forEach(function (issue) { console.log('品質判定：' + JSON.stringify(issue)); });
  console.log('自動検査の範囲：' + (issues.length ? '不合格 ' + issues.length + '件' : '合格（実入力・実画面の独立確認は別工程）'));
  if (issues.length) process.exitCode = 1;
  // QUALITY_GATE_END
})().catch(function (e) { console.error(e); process.exit(1); });
