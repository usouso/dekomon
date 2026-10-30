// 作り直しの 版 — ためしあそびの きろく（kiroku.js）の 画面での 検査。実際の クリックで：
//   1. タイトルに「📝 きろく」・1戦 たたかうと きろく（鍵 v3）に 1戦
//   2. ?reset=1 で ゲームの 鍵（run・last・hall・kwSeen・egg・eggTxn）は きえて、きろくと 古い v2 の 鍵は のこる
//   3. 戦いの とちゅうで とじて、きろくが ない ときに 開きなおすと「途中から（resumed）」で 1戦 もどる（2回 開いても ふえない）
//   4. かきだした JSON を tools/read-records.cjs で 読むと 再現 一致
//   5. 古い 形の たまごの 予定（eggTxn）が ある ときの ?reset=1 は 消さずに とまる（きろくも のこる）
//   6. ?auto=1（自動モード）では きろくを 書かない
//   7. 2つ目の タブは とまり、きろくを 書かない（保存の 鍵 Web Locks）
//   node tools/kiroku-check.js
'use strict';
var { chromium } = require('playwright'), { spawn, execFileSync } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
var PORT = 8797, ROOT = 'http://localhost:' + PORT + '/index.html', KEY = 'remake.playtest.records.v3';
(async function () {
  var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  var browser = null, bad = 0;
  function check(ok, msg) { if (!ok) bad++; console.log((ok ? '○ ' : '✕ ') + msg); }
  async function open(page, q) {
    await page.goto(ROOT + q);
    await page.waitForFunction(function () { return !!(window.__re || document.getElementById('bSaveRetry')); });
    return page.evaluate(function () { return !!window.__re; });
  }
  function recs(page) { return page.evaluate(function (k) { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }, KEY); }
  async function fightOne(page) {
    await page.click('#forkw .road button');
    await page.click('#bFight');
    await page.waitForTimeout(300);
  }
  try {
    await new Promise(function (r) { setTimeout(r, 800); });
    browser = await chromium.launch();
    var ctx = await browser.newContext({ viewport: { width: 1366, height: 650 }, acceptDownloads: true }), page = await ctx.newPage(), errs = [];
    page.on('pageerror', function (e) { errs.push(String(e)); });
    var Q = '?seed=12&speed=20&mute=1';
    check(await open(page, Q + '&reset=1'), '画面が できた');
    await page.evaluate(function () { localStorage.setItem('remake.playtest.records.v2.pr48', '{"old":1}'); });
    var bar = await page.evaluate(function () { var b = document.getElementById('bExportRecord'), r = b.getBoundingClientRect(); return { vis: r.width > 0 && r.height > 0, txt: b.title, line: document.querySelector('.recordbar').getBoundingClientRect().height }; });
    check(bar.vis && /そとへは おくらない/.test(bar.txt) && bar.line === 0, '1. タイトルに きろくの ボタン（' + bar.txt + '）・ふだんは 文の 行なし');
    await page.click('#bStart'); await page.click('#spgrid [data-go]');
    await fightOne(page);
    var r1 = await recs(page);
    check(r1 && r1.schemaVersion === 3 && r1.runs.length === 1 && r1.runs[0].battles.length === 1 && !r1.runs[0].resumed, '1. 1戦で きろく 1戦（schema 3）');
    // 3. とちゅうで とじて、きろくを けして 開きなおす → resumed で 1戦
    await page.evaluate(function (k) { localStorage.removeItem(k); }, KEY);
    await open(page, Q); await open(page, Q);
    var r3 = await recs(page);
    check(r3 && r3.runs.length === 1 && r3.runs[0].resumed === true && r3.runs[0].battles.length === 1, '3. 見て いない 戦いは 開きなおすと 途中から きろく（2回 開いても 1戦）');
    // 1戦 すすめて（つづきから → けっか → つぎへ）、もう 1戦
    await page.click('#bCont'); await page.click('#bSkip').catch(function () {});
    await page.waitForSelector('#result.on', { timeout: 20000 });
    await page.click('#bNext, #bAgain');
    if (await page.evaluate(function () { return document.body.getAttribute('data-scr') === 'fork'; })) await fightOne(page); else { await page.click('#bFight'); await page.waitForTimeout(300); }
    var r4 = await recs(page), total = r4 ? r4.runs.reduce(function (n, r) { return n + r.battles.length; }, 0) : 0;
    check(total === 2, '1. 2戦目も きろく（' + total + 'せん）');
    // 4. かきだし → read-records
    await open(page, Q);
    var dl = page.waitForEvent('download'); await page.click('#bExportRecord'); var d = await dl;
    check(/かきだしたよ/.test(await page.textContent('#bExportRecord')), '4. かきだすと ボタンが「かきだしたよ」');
    var file = path.join(os.tmpdir(), 'dekomon-kiroku-check-' + process.pid + '.json'); await d.saveAs(file);
    var out = ''; var okRead = true;
    try { out = execFileSync(process.execPath, [path.join(__dirname, 'read-records.cjs'), file], { encoding: 'utf8' }); } catch (e) { okRead = false; out = String(e.stdout || '') + String(e.stderr || ''); }
    fs.unlinkSync(file);
    check(okRead && /再現一致: 2試合/.test(out), '4. かきだした JSON は 再現 一致（' + (out.split('\n')[1] || out).trim() + '）');
    // 2. ?reset=1
    await page.evaluate(function () { localStorage.setItem('remake.egg', JSON.stringify({ waza: 'x', parent: 'p', sp: 'koron' })); });
    await open(page, Q + '&reset=1');
    var k2 = await page.evaluate(function () { var o = {}; ['run', 'last', 'hall', 'kwSeen', 'egg', 'eggTxn'].forEach(function (k) { o[k] = localStorage.getItem('remake.' + k); }); o.rec = !!localStorage.getItem('remake.playtest.records.v3'); o.v2 = localStorage.getItem('remake.playtest.records.v2.pr48'); return o; });
    check(!k2.run && (!k2.last || k2.last === 'null') && !k2.hall && !k2.egg && !k2.eggTxn && k2.rec && k2.v2 === '{"old":1}', '2. ?reset=1：ゲームの 鍵は きえて（last は 開いた あと null） きろく（v3・古い v2）は のこる');
    // 5. 古い 形の eggTxn ＋ ?reset=1 → 消さずに とまる
    await page.evaluate(function () { localStorage.setItem('remake.run', JSON.stringify({ keep: 1 })); localStorage.setItem('remake.eggTxn', JSON.stringify({ values: { run: null } })); });
    var live = await open(page, Q + '&reset=1');
    var k5 = await page.evaluate(function () { return { run: localStorage.getItem('remake.run'), txn: !!localStorage.getItem('remake.eggTxn'), rec: !!localStorage.getItem('remake.playtest.records.v3'), retry: !!document.getElementById('bSaveRetry') }; });
    check(!live && k5.retry && k5.run && k5.txn && k5.rec, '5. 古い たまごの 予定が あると ?reset=1 でも 消さずに とまる（きろくも のこる）');
    await page.evaluate(function () { localStorage.removeItem('remake.eggTxn'); localStorage.removeItem('remake.run'); });
    // 6. 自動モード
    var before6 = JSON.stringify(await recs(page));
    await open(page, Q + '&auto=1');
    await page.waitForTimeout(2500);
    check(JSON.stringify(await recs(page)) === before6, '6. 自動モード（?auto=1）では きろくを 書かない');
    // 7. 2つ目の タブ
    await open(page, Q);
    var p2 = await ctx.newPage(); await p2.goto(ROOT + Q); await p2.waitForFunction(function () { return !!(window.__re || document.getElementById('bSaveRetry')); });
    var t2 = await p2.evaluate(function () { return { live: !!window.__re, rec: !!document.getElementById('bExportRecord') }; });
    check(!t2.live && !t2.rec, '7. 2つ目の タブは とまり、きろくの ボタンも 出ない');
    await p2.close();
    check(errs.length === 0, 'エラー ' + errs.length + (errs.length ? '：' + errs[0] : ''));
    await ctx.close();
  } catch (e) { bad++; console.log('✕ ' + (e && e.message || e)); }
  finally { if (browser) await browser.close(); sv.kill(); }
  console.log(bad ? '✕ ' + bad + ' こ だめ' : '○ ぜんぶ よい');
  process.exit(bad ? 1 : 0);
})();
