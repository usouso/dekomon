// 作り直しの 版 — 戦いを 見て いる とちゅうで とじても「つづきから」で その 戦いを もう一度 見て、結果の 画面まで 行けるか。
// 実際の クリック（タイトル → 種類 → 道 → たたかう）で 進め、戦いの とちゅうで 開きなおす。node tools/tsuzuki.js
// ためす 形：win＝ふつうに 勝つ／lose＝負ける（ハート のこる）／over＝さいごの ハートで 負ける／clear＝ぬしを たおす
'use strict';
var { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path');
var PORT = 8792;
var CASES = [['win', 11], ['win', 4], ['win', 23], ['lose', 11], ['lose', 4], ['lose', 23], ['over', 11], ['over', 4], ['clear', 11], ['clear', 23]];
(async function () {
  var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise(function (r) { setTimeout(r, 800); });
  var browser, bad = 0;
  function ok(c, msg) { if (!c) bad++; console.log((c ? '○ ' : '✕ ') + msg); }
  try {
    browser = await chromium.launch();
    for (var cs of CASES) {
      var kind = cs[0], seed = cs[1], tag = kind + ' ' + seed;
      var ctx = await browser.newContext({ viewport: { width: 1366, height: 650 } }), page = await ctx.newPage(), errs = [];
      page.setDefaultTimeout(5000);
      page.on('pageerror', function (e) { errs.push(String(e)); });
      var U = 'http://localhost:' + PORT + '/index.html?seed=' + seed + '&speed=1';
      function hallN() { return page.evaluate(function () { return JSON.parse(localStorage.getItem('remake.hall') || '[]').length; }); }
      await page.goto(U + '&reset=1');
      await page.click('#bStart');
      await page.click('#spgrid [data-go]');
      // 用意（クリック では ない）：負けは パーツを はずして 体力 1・はやさ 0、ぬしは 9しょうに して 道を ぬしに、強く する
      await page.evaluate(function (kind) {
        var G = window.__re.G, S = window.__re.S;
        if (kind === 'over') G.run.hearts = 1;
        if (kind === 'clear') { G.run.wins = S.CFG.runBattles - 1; G.run.fork = S.makeFork(G.run); G.run.stats.hp = 999; G.run.stats.atk = 99; G.run.stats.spd = 99; }
      }, kind);
      await page.click('#forkw .road button');
      if (kind === 'lose' || kind === 'over') await page.evaluate(function () { var G = window.__re.G; G.run.equip = { atk: null, def: null, mov: null }; G.run.stats.hp = 1; G.run.stats.spd = 0; });
      await page.click('#bFight');
      await page.waitForTimeout(300); // 戦いの とちゅう
      var st = await page.evaluate(function () { var G = window.__re.G; return { scr: document.body.getAttribute('data-scr'), owned: G.run.owned.length, wins: G.run.wins, hearts: G.run.hearts, last: !!G.last, over: G.run.over, clear: G.run.clear }; });
      var wantOver = kind === 'over' || kind === 'clear';
      ok(st.scr === 'battle' && st.over === wantOver && (kind !== 'clear' || st.clear) && (kind === 'win' || kind === 'clear' ? st.hearts === 3 : st.hearts < 3), tag + '：戦いの とちゅう（' + st.scr + '・ハート ' + st.hearts + (st.over ? '・周回 おわり' : '') + '）');
      ok(st.last, tag + '：見て いる 戦いが 保存されて いる');
      var h0 = await hallN();
      ok(h0 === (wantOver ? 1 : 0), tag + '：殿堂（戦った とき）' + h0);
      await page.goto(U); // 開きなおす（reset なし）
      var t = await page.evaluate(function () { return { scr: document.body.getAttribute('data-scr'), cont: getComputedStyle(document.getElementById('bCont')).display !== 'none', hallTxt: document.getElementById('hall').textContent }; });
      ok(t.scr === 'title' && t.cont && t.hallTxt.indexOf('しょう') < 0, tag + '：タイトルに「つづきから」・けっかは まだ 出さない（殿堂の 文「' + t.hallTxt + '」）');
      ok(await hallN() === h0, tag + '：開きなおしても 殿堂は ふえない');
      await page.click('#bCont');
      var b = await page.evaluate(function () { var L = document.getElementById('log'); return { scr: document.body.getAttribute('data-scr'), first: (L.firstElementChild || {}).textContent || '' }; });
      ok(b.scr === 'battle' && b.first.indexOf('もう一度 見る') >= 0, tag + '：つづきから → 戦いを はじめから 見る（' + b.scr + '・「' + b.first + '」）');
      await page.click('#bSkip').catch(function () {});
      if (!(await page.waitForSelector('#result.on', { timeout: 20000 }).then(function () { return true; }, function () { return false; }))) { ok(false, tag + '：結果の 画面に 行かない'); await ctx.close(); continue; }
      var r = await page.evaluate(function () { var G = window.__re.G, L2 = document.getElementById('log2'); return { h1: (document.querySelector('#resw h1') || {}).textContent, owned: G.run.owned.length, wins: G.run.wins, hearts: G.run.hearts, log2: L2.children.length, endLine: /かった|まけた/.test((L2.lastElementChild || {}).textContent || '') }; });
      var wantH1 = kind === 'win' ? /かった/ : kind === 'clear' ? /クリア/ : /まけた/;
      ok(wantH1.test(r.h1 || ''), tag + '：結果の 画面「' + r.h1 + '」');
      ok(r.owned === st.owned && r.wins === st.wins && r.hearts === st.hearts, tag + '：見なおしで 結果は 変わらない（パーツ ' + r.owned + '・' + r.wins + 'しょう・ハート ' + r.hearts + '）');
      ok(r.log2 >= 3 && r.endLine, tag + '：結果の 画面に 戦いの きろく（' + r.log2 + '行・さいごは 勝ち負け）');
      ok(await hallN() === h0, tag + '：見なおしで 殿堂は ふえない');
      var nx = (await page.$('#bNext')) ? '#bNext' : '#bAgain';
      await page.click(nx);
      var l = await page.evaluate(function () { return { last: !!window.__re.G.last, ls: localStorage.getItem('remake.last') }; });
      ok(!l.last && (l.ls === null || l.ls === 'null'), tag + '：つぎへ 進んだら 見なおしは 消える');
      ok(await hallN() === h0, tag + '：「おわり」でも 殿堂は ふえない（' + (await hallN()) + '）');
      await page.goto(U);
      if (wantOver) {
        var t2 = await page.evaluate(function () { return { cont: getComputedStyle(document.getElementById('bCont')).display !== 'none', hallTxt: document.getElementById('hall').textContent }; });
        ok(!t2.cont && t2.hallTxt.indexOf('しょう') >= 0 && await hallN() === 1, tag + '：もう一度 開くと「つづきから」は なく 殿堂に 1つ（' + t2.hallTxt + '）');
      } else {
        await page.click('#bCont');
        var f = await page.evaluate(function () { return document.body.getAttribute('data-scr'); });
        ok(f === 'fork', tag + '：もう一度 開くと ふつうの「つづきから」（' + f + '）');
      }
      ok(errs.length === 0, tag + '：エラー ' + errs.length + (errs.length ? ' ' + errs[0] : ''));
      await ctx.close();
    }
  } finally {
    if (browser) await browser.close();
    sv.kill();
  }
  console.log(bad ? '✕ ' + bad + 'つ おかしい' : '○ ぜんぶ よい');
  process.exit(bad ? 1 : 0);
})();
