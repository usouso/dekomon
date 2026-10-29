// 作り直しの 版 — 画面ごとの 写真と 検査（ページの スクロール・はみ出し・エラー）。node tools/shots.js [出す フォルダ]
'use strict';
var { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
var OUT = process.argv[2] || path.join(__dirname, '..', 'screenshots');
var SIZES = [[1366, 650], [1920, 910], [375, 812]], PORT = 8791;
fs.mkdirSync(OUT, { recursive: true });
(async function () {
  var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise(function (r) { setTimeout(r, 800); });
  var browser = await chromium.launch(), bad = 0;
  try {
    for (var sz of SIZES) {
      var ctx = await browser.newContext({ viewport: { width: sz[0], height: sz[1] } }), page = await ctx.newPage(), errs = [];
      page.on('pageerror', function (e) { errs.push(String(e)); });
      await page.goto('http://localhost:' + PORT + '/index.html?reset=1&seed=11&speed=20');
      var tag = sz[0] + 'x' + sz[1];
      async function snap(name) {
        await page.waitForTimeout(150);
        var m = await page.evaluate(function () {
          var de = document.documentElement, out = { pageScroll: de.scrollHeight - innerHeight, wide: de.scrollWidth - innerWidth, clip: [] };
          document.querySelectorAll('.screen.on *').forEach(function (el) { var r = el.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.clip.push(el.className || el.tagName); });
          out.clip = out.clip.slice(0, 5);
          var ko = document.getElementById('kotoba'); out.kot = (ko && ko.classList.contains('on')) ? ko.scrollHeight - ko.clientHeight : 0;
          return out;
        });
        var pc = sz[0] > 700;
        var fail = m.wide > 0 || m.clip.length || (pc && (m.pageScroll > 0 || m.kot > 0));
        if (fail) bad++;
        console.log((fail ? '✕ ' : '○ ') + tag + ' ' + name + ' ページの スクロール ' + m.pageScroll + ' 横 ' + m.wide + (m.kot ? ' ことばの 中の スクロール ' + m.kot : '') + (m.clip.length ? ' はみ出し ' + m.clip.join(',') : ''));
        await page.screenshot({ path: path.join(OUT, 're1_' + name + '_' + tag + '.png') });
      }
      await snap('title');
      await page.click('#bStart'); await snap('species');
      await page.click('[data-go="koron"]'); await snap('fork');
      await page.click('.road[data-road="0"] button'); await snap('prep');
      await page.hover('#slots [data-pick]').catch(function () {}); await snap('prep_hover');
      // じゅんびで パーツを タップ（えらぶ）しても 帯の 説明が 最初の 文に もどらない
      var pk = await page.$('#slots [data-pick]');
      if (pk) { await page.click('#slots [data-pick]'); var tipTxt = await page.evaluate(function () { return document.getElementById('tip').textContent; }); var pkBad = tipTxt.indexOf('ここに せつめいが でるよ') >= 0; if (pkBad) bad++; console.log((pkBad ? '✕ ' : '○ ') + tag + ' パーツを タップした あとの 帯：' + tipTxt.slice(0, 24)); }
      await page.click('#prep .kbtn'); await snap('kotoba'); await page.click('#bKotobaX');
      await page.click('#bFight'); await page.waitForTimeout(600); await snap('battle');
      // 下の 帯（#tip）が 自分の 体力に かぶらない（スマホの 戦いは タップした ときだけ 出す）
      var tipOv = async function () { return page.evaluate(function () { var t = document.getElementById('tip'), h = document.getElementById('mHpN'); if (!t || !h || getComputedStyle(t).display === 'none') return { shown: false, ov: false, hpBottom: h ? Math.round(h.getBoundingClientRect().bottom) : -1, vh: innerHeight }; var a = t.getBoundingClientRect(), b = h.getBoundingClientRect(); return { shown: true, ov: a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right, hpBottom: Math.round(b.bottom), vh: innerHeight }; }); };
      var t0 = await tipOv(); var tipBad = t0.ov || (sz[0] <= 700 && t0.shown); if (tipBad) bad++; // スマホは 帯の 高さで かぶり方が かわるので、出て いない ことも 見る
      console.log((tipBad ? '✕ ' : '○ ') + tag + ' 戦いの 下の 帯：' + (t0.shown ? 'でて いる' : 'でて いない') + '・体力の 数に かぶる ' + (t0.ov ? 'はい' : 'いいえ') + '（体力の 下 ' + t0.hpBottom + ' / 画面 ' + t0.vh + '）');
      if (sz[0] <= 700) {
        await page.click('#bMe [data-kw]'); var t1 = await tipOv(); await page.screenshot({ path: path.join(OUT, 're1_battle_tip_' + tag + '.png') });
        await page.click('#bMe', { position: { x: 4, y: 4 } }); var t2 = await tipOv();
        var tapBad = !t1.shown || t1.ov || t2.shown; if (tapBad) bad++; // 出た 帯も 体力に かぶらない
        console.log((tapBad ? '✕ ' : '○ ') + tag + ' ことばを タップ → 帯 ' + (t1.shown ? 'でた' : 'でない') + (t1.ov ? '（体力に かぶる）' : '（体力に かぶらない）') + '・ほかを タップ → ' + (t2.shown ? 'のこる' : 'とじた'));
      }
      await page.waitForSelector('#result.on', { timeout: 60000 }); await snap('result');
      // 負けを 見る：ちから 0 に して 戦う
      await page.evaluate(function () { var G = window.__re.G; G.run.stats.atk = 0; G.run.stats.hp = 3; });
      var again = await page.$('#bNext') || await page.$('#bAgain'); await again.click();
      if (await page.$('#fork.on')) await page.click('.road[data-road="0"] button');
      await page.click('#bFight'); await page.click('#bSkip');
      await page.waitForSelector('#result.on', { timeout: 60000 }); await snap('lose');
      // もう一度（おなじ 道）：戦いの 始めに 前の 戦いの「○手め」が 残らない（dot の QA P3）
      await page.click('#bAgain');
      var hn = await page.evaluate(function () { var b = document.getElementById('bFight'); var before = document.getElementById('handN').textContent; var d = document.createElement('div'); d.className = 'dmg'; d.textContent = '9'; document.getElementById('arena').appendChild(d); b.click(); return { before: before, after: document.getElementById('handN').textContent, dmg: document.querySelectorAll('#arena .dmg').length }; });
      var hnBad = hn.before === '' || hn.after !== '' || hn.dmg !== 0; // 前が 空なら 確かめに ならない
      console.log((hn.dmg ? '✕ ' : '○ ') + tag + ' もう一度の 始めの 浮かぶ 数字（前の 戦いの 残り）：' + hn.dmg);
      if (hnBad) bad++;
      console.log((hnBad ? '✕ ' : '○ ') + tag + ' もう一度の 始めの「手め」：前 「' + hn.before + '」→ 始め 「' + hn.after + '」');
      await page.click('#bSkip'); await page.waitForSelector('#result.on', { timeout: 60000 });
      if (errs.length) { bad++; console.log('✕ エラー ' + errs.join(' / ')); }
      await ctx.close();
    }
  } finally { await browser.close(); sv.kill(); }
  console.log(bad ? '不合格 ' + bad : '合格');
  process.exit(bad ? 1 : 0);
})();
