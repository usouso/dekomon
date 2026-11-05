// たたみやま 版1 — コマ送り画像（0.05秒ごとに 10コマを 横に並べた 1枚）を 2つ作る
// 使い方: node tools/frames.js [--port 8789] [--size 1366x768]
//  1) change_frames.png … ぐらの数字が変わる瞬間（よつおりの上に みつおりを置く → 2→0 と 4→0）
//  2) fall_frames.png   … 山が落ちる瞬間（合計9の山、seed 5 は かいだんで落ちる）
// CDP の screencast で コマを集め、0.05秒ごとに いちばん近いコマを選ぶ。終わったら ブラウザと サーバーを 必ず閉じる。
'use strict';
var { chromium } = require('playwright');
var { spawn } = require('child_process');
var path = require('path'), fs = require('fs');
function arg(name, def) { var i = process.argv.indexOf('--' + name); if (i < 0) return def; var v = process.argv[i + 1]; return (v === undefined || v.indexOf('--') === 0) ? true : v; }
var PORT = parseInt(arg('port', '8789'), 10);
var SZ = String(arg('size', '1366x768')).split('x').map(Number);
var DIR = path.join(__dirname, '..', 'screenshots');
function startServer() { return new Promise(function (resolve) { var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] }); sv.stdout.on('data', function () { resolve(sv); }); setTimeout(function () { resolve(sv); }, 1500); }); }

// screencast を 集める（frames: [{t, data(base64)}]）
async function record(page, startFn, waitMs, clip) {
  var cdp = await page.context().newCDPSession(page);
  var frames = [];
  cdp.on('Page.screencastFrame', function (ev) { frames.push({ t: Date.now(), data: ev.data }); cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(function () { }); });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: SZ[0], maxHeight: SZ[1] });
  await page.waitForTimeout(250);
  var t0 = Date.now();
  var t1 = await startFn(); if (t1) t0 = t1;
  await page.waitForTimeout(waitMs);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  return { frames: frames, t0: t0 };
}
// t0 から 0.05秒ごとに 10コマ 選んで、横に並べて 1枚にする（別ページで <img> を並べて撮る）
async function strip(browser, rec, clip, outFile, label) {
  var picks = [];
  for (var k = 0; k < 10; k++) {
    var want = rec.t0 + k * 50, best = null;
    rec.frames.forEach(function (f) { if (f.t >= rec.t0 - 30 && (!best || Math.abs(f.t - want) < Math.abs(best.t - want))) best = f; });
    if (!best) best = rec.frames[rec.frames.length - 1];
    picks.push({ k: k, f: best, dt: best ? best.t - rec.t0 : null });
  }
  var ctx = await browser.newContext({ viewport: { width: 10 * (clip.w + 6) + 10, height: clip.h + 50 }, deviceScaleFactor: 1 });
  var pg = await ctx.newPage();
  var html = '<html><body style="margin:0;background:#222;font:14px sans-serif;color:#fff"><div style="padding:4px 6px">' + label + '</div><div style="display:flex;gap:6px;padding:0 4px">' + picks.map(function (p) {
    return '<div style="position:relative;width:' + clip.w + 'px;height:' + clip.h + 'px;overflow:hidden;background:#000"><img src="data:image/png;base64,' + (p.f ? p.f.data : '') + '" style="position:absolute;left:' + (-clip.x) + 'px;top:' + (-clip.y) + 'px;width:' + SZ[0] + 'px;height:' + SZ[1] + 'px"><div style="position:absolute;left:2px;bottom:2px;background:#000a;padding:1px 5px">' + (p.k * 50 / 1000).toFixed(2) + 's（じっさい ' + (p.dt === null ? '-' : (p.dt / 1000).toFixed(2)) + 's）</div></div>';
  }).join('') + '</div></body></html>';
  await pg.setContent(html);
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: outFile });
  await ctx.close();
  return picks.map(function (p) { return p.dt; });
}
(async function () {
  var sv = await startServer(); var browser = await chromium.launch();
  try {
    var ctx = await browser.newContext({ viewport: { width: SZ[0], height: SZ[1] }, deviceScaleFactor: 1 });
    var page = await ctx.newPage();
    // 1) 数字が変わる瞬間：3日目、山1に よつおり → みつおり
    await page.goto('http://localhost:' + PORT + '/?mute=1&seed=11&reset=1&speed=0.5');
    await page.evaluate(function () { var W = window.__tatami; W.start(11); W.setDay(2, []); W.place('jeans', 'jeans_half', 0); W.place('tshirt', 'tshirt_roll', 0); W.place('towel', 'towel_quad', 0); });
    await page.waitForTimeout(600);
    var slot = await page.evaluate(function () { var r = document.querySelector('.slot[data-slot="0"]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    var clip1 = { x: Math.max(0, Math.round(slot.x - 10)), y: Math.round(slot.y + slot.h * 0.45), w: Math.round(slot.w + 20), h: Math.round(slot.h * 0.55) };
    var rec1 = await record(page, async function () { await page.evaluate(function () { window.__tatami.place('jeans', 'jeans_third', 0); }); }, 900, clip1);
    var dts1 = await strip(browser, rec1, clip1, path.join(DIR, 'change_frames.png'), 'ぐらの数字が変わる瞬間：よつおり(2) の上に みつおり(4) → 2→0 と 4→0（0.05秒ごと・speed 0.5）');
    console.log('change_frames.png コマ ' + rec1.frames.length + '、選んだ時刻 ' + JSON.stringify(dts1));
    // 2) 山が落ちる瞬間：1日目 合計9、seed 5（かいだんで ジーンズが落ちる）
    await page.goto('http://localhost:' + PORT + '/?mute=1&seed=5&reset=1&speed=0.5');
    await page.evaluate(function () { var W = window.__tatami; W.start(5); ['tshirt_square', 'tshirt_square', 'socks_line', 'socks_line', 'towel_roll', 'jeans_half'].forEach(function (f) { W.place(W.T.FOLD_BY_ID[f].kind, f, 0); }); W.carry(); });
    var road = await page.evaluate(function () { var r = document.getElementById('road').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    var clip2 = { x: Math.round(road.x), y: Math.round(road.y + 90), w: Math.round(road.w), h: Math.min(Math.round(road.h - 90), 420) };
    // 落ちる直前（fx-hot）まで待ってから 記録を始める
    var t0 = Date.now(), ok = false;
    while (Date.now() - t0 < 60000) { await page.waitForTimeout(40); var hot = await page.evaluate(function () { return !!document.querySelector('#carrierStack .fx-hot'); }); if (hot) { ok = true; break; } }
    if (!ok) throw new Error('落ちる瞬間が来なかった');
    var rec2 = await record(page, async function () { var t1 = Date.now(); while (Date.now() - t1 < 5000) { await page.waitForTimeout(15); var d = await page.evaluate(function () { return !!document.querySelector('#carrierStack .fx-drop'); }); if (d) break; } return Date.now() - 60; }, 700, clip2);
    var dts2 = await strip(browser, rec2, clip2, path.join(DIR, 'fall_frames.png'), '山が落ちる瞬間：かいだんで ぐら9＋ゆれ3 ＞ 10 → ジーンズ(3) から上が落ちる（0.05秒ごと・speed 0.5）');
    console.log('fall_frames.png コマ ' + rec2.frames.length + '、選んだ時刻 ' + JSON.stringify(dts2));
    await ctx.close();
  } finally { await browser.close(); sv.kill(); }
})().catch(function (e) { console.error(e); process.exit(1); });
