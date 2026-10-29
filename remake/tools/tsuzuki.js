// 作り直しの 版 — 戦いを 見て いる とちゅうで とじても「つづきから」で その 戦いを もう一度 見て、結果の 画面まで 行けるか。
// 実際の クリック（タイトル → 種類 → 道 → たたかう）で 進め、戦いの とちゅうで 開きなおす。node tools/tsuzuki.js
'use strict';
var { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path');
var PORT = 8792;
(async function () {
  var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise(function (r) { setTimeout(r, 800); });
  var browser, bad = 0;
  function ok(c, msg) { if (!c) bad++; console.log((c ? '○ ' : '✕ ') + msg); }
  try {
    browser = await chromium.launch();
    for (var seed of [11, 4, 23, -11, -4, -23]) { // マイナスは パーツを はずして 負けを 見る
      var lose = seed < 0; seed = Math.abs(seed);
      var ctx = await browser.newContext({ viewport: { width: 1366, height: 650 } }), page = await ctx.newPage(), errs = [];
      page.on('pageerror', function (e) { errs.push(String(e)); });
      var U = 'http://localhost:' + PORT + '/index.html?seed=' + seed + '&speed=1';
      await page.goto(U + '&reset=1');
      await page.click('#bStart');
      await page.click('#spgrid [data-go]');
      await page.click('#forkw .road' + (lose ? '[data-road="1"]' : '') + ' button');
      if (lose) { await page.evaluate(function () { var G = window.__re.G; G.run.equip = { atk: null, def: null, mov: null }; G.run.stats.hp = 3; }); } // 負けの 画面を 見る ための 用意（クリック では ない）
      await page.click('#bFight');
      await page.waitForTimeout(400); // 戦いの とちゅう
      var st = await page.evaluate(function () { var G = window.__re.G; return { scr: document.body.getAttribute('data-scr'), owned: G.run.owned.length, wins: G.run.wins, hearts: G.run.hearts, last: !!G.last, over: G.run.over }; });
      seed = (lose ? '負け ' : '') + seed;
      ok(st.scr === 'battle', seed + '：戦いの とちゅう（' + st.scr + '）');
      if (st.over) { console.log('  （この 戦いで 周回が おわる ので 見なおしは ない）'); await ctx.close(); continue; }
      ok(st.last, seed + '：見て いる 戦いが 保存されて いる');
      await page.goto(U); // 開きなおす（reset なし）
      var t = await page.evaluate(function () { return { scr: document.body.getAttribute('data-scr'), cont: getComputedStyle(document.getElementById('bCont')).display !== 'none' }; });
      ok(t.scr === 'title' && t.cont, seed + '：タイトルに「つづきから」');
      await page.click('#bCont');
      var b = await page.evaluate(function () { return { scr: document.body.getAttribute('data-scr'), log: document.getElementById('log').children.length }; });
      ok(b.scr === 'battle', seed + '：つづきから → 戦いを はじめから 見る（' + b.scr + '、ログ ' + b.log + '行）');
      await page.click('#bSkip').catch(function () {});
      if (!(await page.waitForSelector('#result.on', { timeout: 20000 }).then(function () { return true; }, function () { return false; }))) { ok(false, seed + '：結果の 画面に 行かない'); await ctx.close(); continue; }
      var r = await page.evaluate(function () { var G = window.__re.G; return { h1: (document.querySelector('#resw h1') || {}).textContent, owned: G.run.owned.length, wins: G.run.wins, hearts: G.run.hearts, log2: document.getElementById('log2').children.length, endLine: /かった|まけた/.test((document.getElementById('log2').lastElementChild || {}).textContent || ''), hall: JSON.parse(localStorage.getItem('remake.hall') || '[]').length }; });
      ok(r.owned === st.owned && r.wins === st.wins && r.hearts === st.hearts, seed + '：見なおしで 結果は 変わらない（' + r.h1 + '・パーツ ' + r.owned + '・' + r.wins + 'しょう・ハート ' + r.hearts + '）');
      ok(r.log2 >= 3 && r.endLine, seed + '：結果の 画面に 戦いの きろく（' + r.log2 + '行・さいごは 勝ち負け）');
      ok(r.hall === 0, seed + '：殿堂は ふえない（' + r.hall + '）');
      var nx = (await page.$('#bNext')) ? '#bNext' : '#bAgain';
      await page.click(nx);
      var l = await page.evaluate(function () { return { last: !!window.__re.G.last, ls: localStorage.getItem('remake.last') }; });
      ok(!l.last && (l.ls === null || l.ls === 'null'), seed + '：つぎへ 進んだら 見なおしは 消える');
      await page.goto(U);
      await page.click('#bCont');
      var f = await page.evaluate(function () { return document.body.getAttribute('data-scr'); });
      ok(f === 'fork', seed + '：もう一度 開くと ふつうの「つづきから」（' + f + '）');
      ok(errs.length === 0, seed + '：エラー ' + errs.length + (errs.length ? ' ' + errs[0] : ''));
      await ctx.close();
    }
  } finally {
    if (browser) await browser.close();
    sv.kill();
  }
  console.log(bad ? '✕ ' + bad + 'つ おかしい' : '○ ぜんぶ よい');
  process.exit(bad ? 1 : 0);
})();
