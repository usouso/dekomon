// 作り直しの 版 — 自動モード（?auto=1）で 何周回か 回して エラーが ないか 見る。node tools/auto.js [周回=3]
'use strict';
var { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path');
var RUNS = parseInt(process.argv[2] || '3', 10), PORT = 8792;
(async function () {
  var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise(function (r) { setTimeout(r, 800); });
  var browser = await chromium.launch(), errs = [], ends = [];
  try {
    var page = await (await browser.newContext({ viewport: { width: 1366, height: 650 } })).newPage();
    page.on('pageerror', function (e) { errs.push(String(e)); });
    page.on('console', function (m) { var t = m.text(); if (t.indexOf('[でこもん auto]') === 0) { ends.push(t); console.log(t); } });
    await page.goto('http://localhost:' + PORT + '/index.html?reset=1&auto=1&speed=50&seed=3');
    var t0 = Date.now();
    while (ends.length < RUNS && Date.now() - t0 < 240000 && !errs.length) await page.waitForTimeout(500);
  } finally { await browser.close(); sv.kill(); }
  if (errs.length) console.log('✕ エラー ' + errs.join(' / '));
  var ok = !errs.length && ends.length >= RUNS;
  console.log(ok ? '合格（自動モード ' + ends.length + ' 周回）' : '不合格');
  process.exit(ok ? 0 : 1);
})();
