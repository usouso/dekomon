// 作り直しの 版 — 保存で とまった ときの 文が 理由ごとに 分かれるか（dot の QA：古い 形の たまごの 予定にも「しばらく してから」と 出て いた）。
//   1. 古い 形の eggTxn → 「まっても なおらない」（data-why=stale）・保存は 消さない
//   2. いまの 保存と 合わない eggTxn → stale
//   3. 書けない（たまごの 予定を 書く ときに 失敗）→「しばらく してから」（data-why=write）
//   4. ふつうの とき は とまらない。どれも エラー 0・375 で はみ出し 0。node tools/tomaru.js
'use strict';
var { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path');
var PORT = 8798, U = 'http://localhost:' + PORT + '/index.html?seed=12&speed=20&mute=1';
(async function () {
  var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  var browser = null, bad = 0;
  function check(ok, msg) { if (!ok) bad++; console.log((ok ? '○ ' : '✕ ') + msg); }
  async function open(page, q) { await page.goto(U + (q || '')); await page.waitForFunction(function () { return !!(window.__re || document.getElementById('bSaveRetry')); }); }
  function why(page) { return page.evaluate(function () { var p = document.querySelector('[data-why]'), de = document.documentElement; return { why: p ? p.getAttribute('data-why') : null, txt: p ? p.textContent : '', wide: de.scrollWidth - innerWidth }; }); }
  try {
    await new Promise(function (r) { setTimeout(r, 800); });
    browser = await chromium.launch();
    for (var w of [1366, 375]) {
      var ctx = await browser.newContext({ viewport: { width: w, height: w > 700 ? 650 : 812 } }), page = await ctx.newPage(), errs = [];
      page.on('pageerror', function (e) { errs.push(String(e)); });
      await open(page, '&reset=1');
      check(await page.evaluate(function () { return !!window.__re; }), w + ' 4. ふつうは とまらない');
      await page.evaluate(function () { localStorage.setItem('remake.run', '{"keep":1}'); localStorage.setItem('remake.eggTxn', JSON.stringify({ values: { run: null } })); });
      await open(page); var a = await why(page);
      check(a.why === 'stale' && /なおらない/.test(a.txt) && a.wide <= 0 && await page.evaluate(function () { return localStorage.getItem('remake.run') === '{"keep":1}'; }), w + ' 1. 古い 形の 予定 → まっても なおらない（' + a.txt + '）・保存は のこる');
      await page.evaluate(function () { localStorage.setItem('remake.eggTxn', JSON.stringify({ version: 1, before: { run: '{"other":1}', last: null, egg: null, hall: null }, values: { run: null } })); });
      await open(page); var b = await why(page);
      check(b.why === 'stale', w + ' 2. いまの 保存と 合わない 予定 → stale');
      await page.evaluate(function () { localStorage.removeItem('remake.eggTxn'); localStorage.removeItem('remake.run'); });
      await page.addInitScript(function () { var o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'remake.eggTxn' && v !== 'null') { var e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } return o.call(this, k, v); }; });
      await open(page);
      await page.click('#bStart'); await page.click('#spgrid [data-go]');
      var c = await why(page);
      check(c.why === 'write' && /しばらく/.test(c.txt), w + ' 3. 書けない → しばらく してから（' + c.txt + '）');
      check(errs.length === 0, w + ' エラー ' + errs.length);
      await ctx.close();
    }
  } catch (e) { bad++; console.log('✕ ' + (e && e.message || e)); }
  finally { if (browser) await browser.close(); sv.kill(); }
  console.log(bad ? '✕ ' + bad + ' こ だめ' : '○ ぜんぶ よい');
  process.exit(bad ? 1 : 0);
})();
