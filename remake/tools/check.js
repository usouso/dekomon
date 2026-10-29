// 作り直しの 版 — 画面の 検査（next/tools/check.js の かわり。index.html は 変えずに 外から 見る）
// 使い方：node tools/check.js [--runs 6] [--sizes 1366x650,1920x910,375x812] [--speed 3] [--seed 1301] [--port 8793] [--timeout 600]
// やること：serve.js を 立てて ?auto=1&mute=1（自動モード）で 周回を 回し、ページの 中で 120ミリ秒ごとに 見る：
//   重なり（ちがう 文字どうしの 箱が 重なる）・ページの スクロール（PC）・中の スクロール（戦いの きろく・ことばの ページは のぞく）・
//   横の はみ出し・小さい 文字（12px 未満）・画面と 計算の ずれ（戦いの おわりの 体力の 数が sim.js の 結果と 同じか）・エラー。
// 合格の 条件：重なり 0・横 0・はみ出し 0・小さい 文字 0・ずれ 0・エラー 0・PC の ページの スクロール 0・--inner0 の 大きさ（既定 1920x910）の 中の スクロール 0。
// 表の 全部の 数を 読む こと（終了コード 0 だけで 合格に しない）。透け（決定 19 の 透け）は まだ 見て いない。
'use strict';
var { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path');
function arg(n, d) { var i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; }
var RUNS = parseInt(arg('runs', '6'), 10), SPEED = parseFloat(arg('speed', '3')), SEED0 = parseInt(arg('seed', '1301'), 10);
var PORT = parseInt(arg('port', '8793'), 10), TIMEOUT = parseInt(arg('timeout', '600'), 10) * 1000;
var SIZES = String(arg('sizes', '1366x650,1920x910,375x812')).split(',').map(function (s) { var a = s.split('x'); return [+a[0], +a[1]]; });
var INNER0 = String(arg('inner0', '1920x910')).split(',');

// ページの 中で 動く 見張り（index.html より 先に 入る）
function watcher() {
  var W = window.__chk = { samples: 0, over: {}, overN: 0, pageScroll: {}, inner: {}, wide: {}, clip: {}, small: {}, mism: [], ends: 0, last: null };
  // sim.js の fight を 包んで、最後の 戦いの 結果を 取っておく（画面と 計算の 比べ用）
  var api;
  Object.defineProperty(window, 'DekoRe', { configurable: true, get: function () { return api; }, set: function (v) {
    api = v; var f = v.fight; v.fight = function () { var o = f.apply(this, arguments); W.last = { pHp: o.res.pHp, pMax: o.res.pMax, eHp: o.res.eHp, eMax: o.res.eMax }; return o; };
  } });
  function inc(m, k) { m[k] = (m[k] || 0) + 1; }
  function clipRect(el, r) {
    for (var a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      var cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        var c = a.getBoundingClientRect();
        r = { l: Math.max(r.l, c.left), t: Math.max(r.t, c.top), r: Math.min(r.r, c.right), b: Math.min(r.b, c.bottom) };
        if (r.r - r.l < 1 || r.b - r.t < 1) return null;
      }
    }
    return r;
  }
  function name(el) { return (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') || el.tagName.toLowerCase(); }
  function sample() {
    var scr = document.querySelector('.screen.on'); if (!scr) return;
    W.samples++;
    var sid = scr.id, de = document.documentElement;
    var kot = document.getElementById('kotoba'), kotOn = kot && kot.classList.contains('on');
    var key = kotOn ? 'kotoba' : sid;
    var ps = de.scrollHeight - innerHeight; if (ps > 0) W.pageScroll[key] = Math.max(W.pageScroll[key] || 0, ps);
    var wd = de.scrollWidth - innerWidth; if (wd > 0) W.wide[key] = Math.max(W.wide[key] || 0, wd);
    var roots = kotOn ? [kot] : [scr]; var tip = document.getElementById('tip'); if (tip && !kotOn) roots.push(tip);
    var boxes = [];
    roots.forEach(function (root) {
      // 中の スクロール（戦いの きろくは スクロールして よい・ことばの ページは ページの スクロールで 見る）
      root.querySelectorAll('*').forEach(function (el) {
        if (el.id === 'log' || el.id === 'log2') return;
        var cs = getComputedStyle(el);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight - el.clientHeight > 1) { var k = key + ' ' + name(el); W.inner[k] = Math.max(W.inner[k] || 0, el.scrollHeight - el.clientHeight); }
      });
      var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (var n = tw.nextNode(); n; n = tw.nextNode()) {
        if (!n.nodeValue.trim()) continue;
        var el = n.parentElement; if (!el || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        var fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 12) inc(W.small, key + ' ' + name(el) + ' ' + fs + 'px');
        var rg = document.createRange(); rg.selectNodeContents(n);
        Array.prototype.forEach.call(rg.getClientRects(), function (rc) {
          if (rc.width < 2 || rc.height < 2) return;
          var r = clipRect(el, { l: rc.left, t: rc.top, r: rc.right, b: rc.bottom }); if (!r) return;
          if (rc.right > innerWidth + 1 || rc.left < -1) { if (r.r > innerWidth + 1 || r.l < -1) inc(W.clip, key + ' ' + name(el)); }
          boxes.push({ el: el, r: r });
        });
      }
    });
    // 重なり：ちがう 要素の 文字の 箱が、小さい ほうの 3わり 以上 重なる（同じ 要素の 中は 見ない）
    for (var i = 0; i < boxes.length; i++) for (var j = i + 1; j < boxes.length; j++) {
      var a = boxes[i], b = boxes[j]; if (a.el === b.el) continue;
      var w = Math.min(a.r.r, b.r.r) - Math.max(a.r.l, b.r.l), h = Math.min(a.r.b, b.r.b) - Math.max(a.r.t, b.r.t);
      if (w < 3 || h < 3) continue;
      var sa = (a.r.r - a.r.l) * (a.r.b - a.r.t), sb = (b.r.r - b.r.l) * (b.r.b - b.r.t);
      if (w * h < 0.3 * Math.min(sa, sb)) continue;
      var k2 = key + ' 「' + a.el.textContent.trim().slice(0, 10) + '」' + name(a.el) + ' × 「' + b.el.textContent.trim().slice(0, 10) + '」' + name(b.el);
      if (!W.over[k2]) W.overN++;
      W.over[k2] = (W.over[k2] || 0) + 1;
    }
  }
  // 戦いの おわり（結果の 画面が 出た 瞬間）：画面の 体力の 数と 計算
  function endCheck() {
    W.ends++; if (!W.last) return;
    var m = document.getElementById('mHpN'), f = document.getElementById('fHpN');
    var want = W.last.pHp + ' / ' + W.last.pMax, want2 = W.last.eHp + ' / ' + W.last.eMax;
    if (!m || m.textContent !== want) W.mism.push('じぶん ' + (m && m.textContent) + ' ≠ ' + want);
    if (!f || f.textContent !== want2) W.mism.push('あいて ' + (f && f.textContent) + ' ≠ ' + want2);
    W.last = null;
  }
  addEventListener('DOMContentLoaded', function () {
    var res = document.getElementById('result'), was = false;
    new MutationObserver(function () { var on = res.classList.contains('on'); if (on && !was) endCheck(); was = on; }).observe(res, { attributes: true, attributeFilter: ['class'] });
    setInterval(function () { try { sample(); } catch (e) { W.err = String(e); } }, 120); });
}

(async function () {
  var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise(function (r) { setTimeout(r, 800); });
  var browser = await chromium.launch(), bad = 0, rows = [];
  try {
    for (var si = 0; si < SIZES.length; si++) {
      var sz = SIZES[si], tag = sz[0] + 'x' + sz[1], pc = sz[0] > 700;
      var ctx = await browser.newContext({ viewport: { width: sz[0], height: sz[1] }, deviceScaleFactor: 1, hasTouch: !pc }), page = await ctx.newPage();
      var errs = [], runs = 0, lines = [];
      await page.addInitScript(watcher);
      page.on('pageerror', function (e) { errs.push(String(e)); });
      page.on('console', function (m) { var t = m.text(); if (t.indexOf('[でこもん auto]') === 0) { runs++; lines.push(t.replace('[でこもん auto] 周回 おわり：', '')); } else if (m.type() === 'error') errs.push(t); });
      await page.goto('http://localhost:' + PORT + '/index.html?reset=1&auto=1&mute=1&speed=' + SPEED + '&seed=' + (SEED0 + si * 600));
      var t0 = Date.now();
      while (runs < RUNS && Date.now() - t0 < TIMEOUT && !errs.length) await page.waitForTimeout(500);
      var W = await page.evaluate(function () { return window.__chk; });
      await ctx.close();
      var innerBad = INNER0.indexOf(tag) >= 0 ? Object.keys(W.inner).length : 0;
      var pageBad = pc ? Object.keys(W.pageScroll).length : 0;
      var fail = W.overN + Object.keys(W.wide).length + Object.keys(W.clip).length + Object.keys(W.small).length + W.mism.length + errs.length + pageBad + innerBad + (runs < RUNS ? 1 : 0) + (W.err ? 1 : 0);
      if (fail) bad++;
      rows.push({ tag: tag, runs: runs, sec: Math.round((Date.now() - t0) / 1000), W: W, errs: errs, fail: fail, lines: lines });
    }
  } finally { await browser.close(); sv.kill(); }
  function fmt(o) { var k = Object.keys(o); return k.length ? k.map(function (x) { return x + '（' + o[x] + '）'; }).join('、') : '0'; }
  console.log('| 大きさ | 周回 | 秒 | 見た 回数 | 戦いの おわり | 重なり | ページの スクロール | 中の スクロール | 横 | はみ出し | 小さい 文字 | ずれ | エラー |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  rows.forEach(function (r) {
    console.log('| ' + r.tag + ' | ' + r.runs + ' | ' + r.sec + ' | ' + r.W.samples + ' | ' + r.W.ends + ' | ' + r.W.overN + ' | ' + fmt(r.W.pageScroll) + ' | ' + fmt(r.W.inner) + ' | ' + fmt(r.W.wide) + ' | ' + Object.keys(r.W.clip).length + ' | ' + Object.keys(r.W.small).length + ' | ' + r.W.mism.length + ' | ' + (r.errs.length + (r.W.err ? 1 : 0)) + ' |');
  });
  rows.forEach(function (r) {
    console.log('\n## ' + r.tag + (r.fail ? ' ✕' : ' ○') + '　周回：' + r.lines.join('／'));
    if (r.W.overN) console.log('重なり（見た 回数）：\n- ' + Object.keys(r.W.over).map(function (k) { return k + '（' + r.W.over[k] + '）'; }).join('\n- '));
    if (Object.keys(r.W.clip).length) console.log('はみ出し：' + fmt(r.W.clip));
    if (Object.keys(r.W.small).length) console.log('小さい 文字：' + fmt(r.W.small));
    if (r.W.mism.length) console.log('ずれ：' + r.W.mism.slice(0, 5).join(' / '));
    if (r.errs.length || r.W.err) console.log('エラー：' + r.errs.concat(r.W.err ? ['見張り ' + r.W.err] : []).slice(0, 5).join(' / '));
  });
  console.log('\n' + (bad ? '不合格 ' + bad : '合格') + '（INNER0＝' + INNER0.join(',') + '。表の 全部の 数を 読む こと）');
  process.exit(bad ? 1 : 0);
})();
