// 作り直しの 版 — タイトルの 殿堂（でんどう）の 検査。殿堂が いちばん 多い 形（6つ・長い 名前・🥚 の 親と のこした 技）＋ たまご の 帯で：
//   ページの スクロール 0（PC）・横 0・はみ出し 0・1人の 行が 名前・🥚 の とちゅうで 折れない・殿堂の 文字 14px 以上・殿堂の 名前の 色が 見出しより うすく ない・エラー 0。
//   殿堂が 0 の ときは 箱を 出さない。node tools/dendo.js [出す フォルダ]
'use strict';
var { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
var OUT = process.argv[2] || path.join(__dirname, '..', 'screenshots');
var SIZES = [[1366, 650], [1920, 910], [375, 812]], PORT = 8797;
fs.mkdirSync(OUT, { recursive: true });
function lum(c) { var m = c.match(/\d+/g).map(Number); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; }
(async function () {
  var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise(function (r) { setTimeout(r, 800); });
  var browser = null, bad = 0;
  var hall = [];
  for (var i = 0; i < 7; i++) hall.push({ name: ['ぺっごか', 'ぽんこ', 'ぴここ', 'ごろすけ', 'みみたん', 'どどんぱ', 'ぷにぷに'][i], sp: ['ころん', 'ごつん', 'ぴゅん', 'どしん'][i % 4], wins: 10 - i, clear: i % 3 === 0, parts: [], waza: [], from: i % 2 ? 'ぺっごか' : null, egg: (i % 2 && i !== 5) ? null : 'kakenuke', at: 1000 + i }); // 5ばん＝親も のこした 技も ある いちばん 長い 行
  try {
    browser = await chromium.launch(); // 起動に しっぱい しても finally で サーバーを とめる
    for (var sz of SIZES) {
      var tag = sz[0] + 'x' + sz[1];
      for (var form of ['empty', 'full']) {
        var ctx = await browser.newContext({ viewport: { width: sz[0], height: sz[1] } }), page = await ctx.newPage(), errs = [];
        page.on('pageerror', function (e) { errs.push(String(e)); });
        await page.goto('http://localhost:' + PORT + '/index.html?reset=1&seed=11');
        if (form === 'full') {
          await page.evaluate(function (h) { localStorage.setItem('remake.hall', JSON.stringify(h)); localStorage.setItem('remake.egg', JSON.stringify({ waza: 'kakenuke', parent: 'ぺっごか', sp: 'koron', wins: 10 })); }, hall);
          await page.goto('http://localhost:' + PORT + '/index.html?seed=11');
        }
        await page.waitForTimeout(250);
        var m = await page.evaluate(function () {
          var de = document.documentElement, h = document.getElementById('hall'), out = { pageScroll: de.scrollHeight - innerHeight, wide: de.scrollWidth - innerWidth, clip: [] };
          document.querySelectorAll('.screen.on *').forEach(function (el) { var r = el.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.clip.push(el.className || el.tagName); });
          out.shown = getComputedStyle(h).display !== 'none' && h.getBoundingClientRect().height > 0;
          out.lines = h.querySelectorAll('.hrow').length; out.split = Array.prototype.filter.call(h.querySelectorAll('.hseg'), function (e) { return e.getClientRects().length > 1; }).length; out.font = parseFloat(getComputedStyle(h).fontSize);
          out.color = getComputedStyle(h).color; var b = h.querySelector('b'); out.head = b ? getComputedStyle(b).color : out.color;
          out.overflow = h.scrollWidth - h.clientWidth;
          out.nokoshi = h.textContent.indexOf('を のこした') >= 0; // 親の 🥚 と のこした 技の 🥚 を ことばで 分ける
          return out;
        });
        var pc = sz[0] > 700, fail;
        if (form === 'empty') {
          fail = m.shown || errs.length;
          console.log((fail ? '✕ ' : '○ ') + tag + ' 殿堂 0：箱を 出さない（' + (m.shown ? 'でて いる' : 'でて いない') + '）');
        } else {
          fail = !m.shown || m.lines !== 6 || !m.nokoshi || m.split > 0 || m.font < 14 || lum(m.color) < lum(m.head) || m.wide > 0 || m.overflow > 0 || m.clip.length || (pc && m.pageScroll > 0) || errs.length;
          console.log((fail ? '✕ ' : '○ ') + tag + ' 殿堂 6つ：文字 ' + m.font + 'px・「を のこした」' + (m.nokoshi ? 'あり' : 'なし') + '・とちゅうで 折れた ' + m.split + '・名前の 色 ' + m.color + '（見出し ' + m.head + '）・ページの スクロール ' + m.pageScroll + ' 横 ' + m.wide + ' 箱の 横 ' + m.overflow + (m.clip.length ? ' はみ出し ' + m.clip.slice(0, 5).join(',') : '') + (errs.length ? ' エラー ' + errs.join(' / ') : ''));
          await page.screenshot({ path: path.join(OUT, 're4_title_dendo_' + tag + '.png') });
        }
        if (fail) bad++;
        await ctx.close();
      }
    }
  } finally { if (browser) await browser.close(); sv.kill(); }
  console.log(bad ? '✕ ' + bad + ' こ' : '合格');
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
