// たたみやま 版1 — スクリーンショット（ヘッドレス Chrome / Playwright）
// 使い方: node tools/screens.js [--sizes 1366x768,1920x1080,1920x910,375x812] [--port 8788]
// 大きさごとに：積む画面（たたみ方を選んでいる途中）・運ぶ途中・1日の終わり・最後 を screenshots/ に保存する。
// ページの scrollWidth×scrollHeight も表にする。終わったら ブラウザと サーバーを 必ず閉じる。
'use strict';
var { chromium } = require('playwright');
var { spawn } = require('child_process');
var path = require('path');
function arg(name, def) { var i = process.argv.indexOf('--' + name); if (i < 0) return def; var v = process.argv[i + 1]; return (v === undefined || v.indexOf('--') === 0) ? true : v; }
var SIZES = String(arg('sizes', '1366x768,1920x1080,1920x910,375x812')).split(',').map(function (s) { var a = s.split('x'); return { w: parseInt(a[0], 10), h: parseInt(a[1], 10) }; });
var PORT = parseInt(arg('port', '8788'), 10);
var DIR = path.join(__dirname, '..', 'screenshots');
function startServer() { return new Promise(function (resolve) { var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] }); sv.stdout.on('data', function () { resolve(sv); }); setTimeout(function () { resolve(sv); }, 1500); }); }
async function shots(browser, size) {
  var ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
  var page = await ctx.newPage();
  var errs = []; page.on('pageerror', function (e) { errs.push(e.message); }); page.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  var sfx = size.w + 'x' + size.h;
  var rows = [];
  async function measure(label) {
    await page.waitForTimeout(150);
    var m = await page.evaluate(function () { var de = document.documentElement; return { page: Math.max(de.scrollWidth, document.body.scrollWidth) + '×' + Math.max(de.scrollHeight, document.body.scrollHeight), win: window.innerWidth + '×' + window.innerHeight, scroll: Math.max(de.scrollHeight, document.body.scrollHeight) > window.innerHeight + 1 || Math.max(de.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1, chk: window.__tatami.checkOverlap() }; });
    m.label = label; rows.push(m);
  }
  // 1) タイトル
  await page.goto('http://localhost:' + PORT + '/?mute=1&seed=11&reset=1');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(DIR, 'title_' + sfx + '.png') });
  // 2) 積む画面：3日目（14まい）で いくつか積み、Tシャツを選んで たたみ方を見せている途中
  await page.evaluate(function () { var W = window.__tatami; W.start(11); W.setDay(2, []); W.place('jeans', 'jeans_half', 0); W.place('towel', 'towel_quad', 0); W.place('jeans', 'jeans_third', 0); W.place('socks', 'socks_line', 0); W.place('sheet', 'sheet_fold', 1); W.place('tshirt', 'tshirt_square', 1); W.place('socks', 'socks_line', 1); W.place('slick', 'slick_fold', 2); W.select('tshirt'); });
  await page.waitForTimeout(250);
  await measure('積む（3日目・たたみ方を選ぶ途中）');
  await page.screenshot({ path: path.join(DIR, 'stack_' + sfx + '.png') });
  // 2b) 数字が変わる瞬間（よつおりの上に みつおり → 2→0 と 4→0）
  await page.evaluate(function () { var W = window.__tatami; W.G.sel = null; W.G.selFold = null; W.place('towel', 'towel_quad', 3); });
  await page.waitForTimeout(80);
  await page.evaluate(function () { var W = window.__tatami; W.place('jeans', 'jeans_third', 3); });
  await page.waitForTimeout(350);
  await measure('数字が変わった直後');
  await page.screenshot({ path: path.join(DIR, 'change_' + sfx + '.png') });
  // 3) 運ぶ途中：1日目、合計9の山（seed 5 は ねこで落ちる）
  await page.goto('http://localhost:' + PORT + '/?mute=1&seed=5&reset=1&speed=1');
  await page.evaluate(function () { var W = window.__tatami; W.start(5); ['tshirt_square', 'tshirt_square', 'socks_line', 'socks_line', 'towel_roll', 'jeans_half'].forEach(function (f) { W.place(W.T.FOLD_BY_ID[f].kind, f, 0); }); W.carry(); });
  var got = false, t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    await page.waitForTimeout(60);
    var st = await page.evaluate(function () { var cs = document.getElementById('carrierStack'); return { hot: !!cs.querySelector('.fx-hot'), screen: window.__tatami.G.screen, drop: !!cs.querySelector('.fx-drop') }; });
    if (st.hot && !got) { await page.waitForTimeout(300); await measure('運ぶ（落ちる直前）'); await page.screenshot({ path: path.join(DIR, 'carry_' + sfx + '.png') }); got = true; }
    if (st.drop) { await page.waitForTimeout(250); await measure('運ぶ（落ちている）'); await page.screenshot({ path: path.join(DIR, 'fall_' + sfx + '.png') }); break; }
    if (st.screen !== 'carry') break;
  }
  while (Date.now() - t0 < 40000) { await page.waitForTimeout(200); var sc = await page.evaluate(function () { return window.__tatami.G.screen; }); if (sc !== 'carry') break; }
  await measure('1日の終わり');
  await page.screenshot({ path: path.join(DIR, 'evening_' + sfx + '.png') });
  // 4) 最後（3日目の夕方）：3日目に 1つの山で 運ぶ → 落ちて「あと◯まい」になることが多い
  await page.evaluate(function () { var W = window.__tatami; W.setSpeed(2.5); W.startDay(1); W.G.basket.forEach(function (it) { }); var b = W.G.basket.slice(); b.forEach(function (it, i) { var fs = W.T.foldsOf(it.kind); W.place(it.kind, fs[0].id, i % 2); }); });
  await page.evaluate(function () { window.__tatami.OPT.speed = 10; window.__tatami.setSpeed(2.5); window.__tatami.carry(); });
  t0 = Date.now(); while (Date.now() - t0 < 60000) { await page.waitForTimeout(200); var sc2 = await page.evaluate(function () { return window.__tatami.G.screen; }); if (sc2 !== 'carry') break; }
  await page.click('#nextBtn');
  await page.evaluate(function () { var W = window.__tatami; var b = W.G.basket.slice(); b.forEach(function (it, i) { var fs = W.T.foldsOf(it.kind); W.place(it.kind, fs[fs.length - 1].id, i % 2); }); W.carry(); });
  t0 = Date.now(); while (Date.now() - t0 < 60000) { await page.waitForTimeout(200); var sc3 = await page.evaluate(function () { return window.__tatami.G.screen; }); if (sc3 !== 'carry') break; }
  await measure('最後');
  await page.screenshot({ path: path.join(DIR, 'end_' + sfx + '.png') });
  await ctx.close();
  return { size: size, rows: rows, errs: errs };
}
(async function () {
  var sv = await startServer(); var browser = await chromium.launch(); var out = [];
  try { for (var i = 0; i < SIZES.length; i++) { out.push(await shots(browser, SIZES[i])); console.error('done ' + SIZES[i].w + 'x' + SIZES[i].h); } }
  finally { await browser.close(); sv.kill(); }
  console.log('| 大きさ | 画面 | ページ（scrollWidth×scrollHeight） | 窓 | ページのスクロール | 重なり | はみ出し |');
  console.log('|---|---|---|---|---|---|---|');
  out.forEach(function (o) { o.rows.forEach(function (r) { console.log('| ' + o.size.w + '×' + o.size.h + ' | ' + r.label + ' | ' + r.page + ' | ' + r.win + ' | ' + (r.scroll ? '**あり**' : '0') + ' | ' + r.chk.overlaps + ' | ' + r.chk.overflow + ' |'); }); });
  out.forEach(function (o) { var seen = {}; o.rows.forEach(function (r) { r.chk.list.forEach(function (x) { var k = JSON.stringify([x.screen, x.kind, x.a, x.b]); if (seen[k]) return; seen[k] = true; if (!seen.__h) { seen.__h = true; console.log('\n### ' + o.size.w + '×' + o.size.h + ' の重なりの詳細'); } console.log('- ' + r.label + '：' + JSON.stringify(x)); }); }); if (o.errs.length) { console.log('\nconsole のエラー（' + o.size.w + '×' + o.size.h + '）：'); o.errs.slice(0, 5).forEach(function (e) { console.log('- ' + e); }); } });
})().catch(function (e) { console.error(e); process.exit(1); });
