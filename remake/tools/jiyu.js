// 作り直しの 版 — 自由枠（5しょうで ひらく 4つ目の 枠）の 検査。実際の クリックで：
//   ひらく まえの 🔒 → 5しょうめの 勝ちで「ひらいた！」→ じゅんびで 4つ目に つける → 役割の 行で 押すと 4つ目から はずれる → 4つで 戦う。
//   どの 画面も ページの スクロール 0（PC）・横 0・はみ出し 0・エラー 0。1920×910 は もちものの 中の スクロールも 0。
//   もちものは 16 ぜんぶ（いちばん 多い 形）。node tools/jiyu.js [出す フォルダ]
'use strict';
var { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
var OUT = process.argv[2] || path.join(__dirname, '..', 'screenshots');
var SIZES = [[1366, 650], [1920, 910], [375, 812]], PORT = 8794;
fs.mkdirSync(OUT, { recursive: true });
(async function () {
  var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  var browser = null, bad = 0;
  try {
    await new Promise(function (r) { setTimeout(r, 800); });
    browser = await chromium.launch();
    for (var sz of SIZES) {
      var ctx = await browser.newContext({ viewport: { width: sz[0], height: sz[1] } }), page = await ctx.newPage(), errs = [];
      page.on('pageerror', function (e) { errs.push(String(e)); });
      await page.goto('http://localhost:' + PORT + '/index.html?reset=1&seed=11&speed=20&mute=1'); await page.waitForFunction(function () { return !!window.__re; }); /* 保存の 鍵（Web Locks）を とって 画面が できるまで 待つ */
      var tag = sz[0] + 'x' + sz[1], pc = sz[0] > 700;
      var check = function (ok, msg) { if (!ok) bad++; console.log((ok ? '○ ' : '✕ ') + tag + ' ' + msg); };
      async function snap(name) {
        await page.waitForTimeout(200);
        var m = await page.evaluate(function () {
          var de = document.documentElement, out = { pageScroll: de.scrollHeight - innerHeight, wide: de.scrollWidth - innerWidth, clip: [], inner: 0 };
          document.querySelectorAll('.screen.on *').forEach(function (el) {
            var r = el.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.clip.push(el.className || el.tagName);
            var cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight - el.clientHeight > 1 && !el.classList.contains('logw')) out.inner = Math.max(out.inner, el.scrollHeight - el.clientHeight);
          });
          out.clip = out.clip.slice(0, 5);
          return out;
        });
        var fail = m.wide > 0 || m.clip.length || (pc && m.pageScroll > 0) || (sz[0] === 1920 && m.inner > 0);
        check(!fail, name + ' ページの スクロール ' + m.pageScroll + ' 横 ' + m.wide + ' 中の スクロール ' + m.inner + (m.clip.length ? ' はみ出し ' + m.clip.join(',') : ''));
        await page.screenshot({ path: path.join(OUT, 're2_' + name + '_' + tag + '.png') });
      }
      await page.click('#bStart');
      await page.click('[data-go="gotsun"]');
      // 4しょう・もちもの 16 ぜんぶ・勝てる つよさ（つぎの 勝ちが 5しょうめ）
      await page.evaluate(function () { var G = window.__re.G, S = window.__re.S, run = G.run; run.wins = S.CFG.free.at - 1; run.owned = S.PART_IDS.slice(); run.stats.hp = 999; run.stats.atk = 60; run.fork = S.makeFork(run); });
      await page.click('.road[data-road="0"] button');
      var lk = await page.evaluate(function () { var r = document.querySelector('#slots .slot.free'); return { locked: !!(r && r.classList.contains('locked')), txt: r ? r.textContent : '', picks: document.querySelectorAll('#slots [data-slot="free"]').length }; });
      check(lk.locked && lk.txt.indexOf('しょうで ひらく') >= 0 && lk.picks === 0, 'ひらく まえ：4つ目の 行は 🔒「' + lk.txt + '」・押せる パーツ ' + lk.picks);
      await snap('prep_locked');
      await page.click('#bFight'); await page.click('#bSkip');
      await page.waitForSelector('#result.on', { timeout: 60000 });
      var op = await page.evaluate(function () { var e = document.querySelector('#resw .fx-open'); return e ? e.textContent : ''; });
      check(op.indexOf('ひらいた') >= 0, '5しょうめの 勝ち：「' + op + '」');
      await snap('result_open');
      await page.click('#bNext');
      await page.click('.road[data-road="0"] button');
      var fr = await page.evaluate(function () { var r = document.querySelector('#slots .slot.free'); return { open: !!(r && !r.classList.contains('locked')), glow: !!(r && r.classList.contains('fx-new')), picks: document.querySelectorAll('#slots [data-slot="free"]').length, h2: document.querySelector('#slots h2').textContent }; });
      check(fr.open && fr.glow && fr.picks === 0 && fr.h2.indexOf('じゆう') >= 0, 'ひらいた あと：4つ目の 行が 光る・「あき」（札 ' + fr.picks + '）・見出し「' + fr.h2 + '」');
      await snap('prep_open');
      // 4つ目に つける：せめの 枠が うまって いる とき、ついて いない せめの パーツを 押す → じゆうへ（「せめを 2つ」）
      var fid = await page.evaluate(function () { var G = window.__re.G, S = window.__re.S, eq = G.run.equip; if (!eq.atk) eq.atk = 'horn'; return G.run.owned.filter(function (p) { return S.PART_BY_ID[p].role === 'atk' && p !== eq.atk; })[0]; });
      await page.click('#slots .slot.atk [data-pick="' + fid + '"]');
      var af = await page.evaluate(function (fid) { var G = window.__re.G, S = window.__re.S; return { free: G.run.equip.free, n: S.equipList(G.run.equip).length, atk2: document.querySelectorAll('#slots .slot.atk .ptile.eq').length, freeTile: !!document.querySelector('#slots .slot.free [data-pick="' + fid + '"]'), glow: !!document.querySelector('#slots .slot.free.fx-new'), meParts: document.querySelectorAll('#pMe .ptile').length }; }, fid);
      check(af.free === fid && af.n === 4 && af.atk2 === 2 && af.freeTile && !af.glow && af.meParts === 4, 'せめの 2つ目 ' + fid + ' → じゆうに 入った（つけた パーツ ' + af.n + '・せめの 行の しるし ' + af.atk2 + '・カードの パーツ ' + af.meParts + '・光は きえる）');
      await snap('prep_four');
      var col = await page.evaluate(function (fid) { var a = getComputedStyle(document.querySelector('#slots .slot.atk [data-pick="' + fid + '"]')).borderColor, f = getComputedStyle(document.querySelector('#slots .slot.free [data-pick="' + fid + '"]')).borderColor, b = getComputedStyle(document.querySelector('#slots .slot.atk .ptile.eq:not(.fx-free)')).borderColor; var h = document.querySelector('#slots h2'), lh = parseFloat(getComputedStyle(h).lineHeight) || parseFloat(getComputedStyle(h).fontSize) * 1.3; return { free: a, row: f, role: b, h2lines: Math.round(h.getBoundingClientRect().height / lh) }; }, fid);
      check(col.free === 'rgb(232, 185, 35)' && col.row === col.free && col.role !== col.free && (!pc || col.h2lines === 1), 'じゆうの パーツは 2つの 行とも 黄色の わく（' + col.free + '・' + col.row + '）・見出し ' + col.h2lines + '行・せめの 枠の パーツは ちがう 色（' + col.role + '）');
      // じゆうの 行の 札を 押すと はずれる
      await page.click('#slots .slot.free [data-pick="' + fid + '"]');
      var mv = await page.evaluate(function () { var G = window.__re.G; return { free: G.run.equip.free, empty: !!document.querySelector('#slots .slot.free .ptile.empty') }; });
      check(!mv.free && mv.empty, 'じゆうの 札を 押すと はずれる（「あき」に もどる）');
      // 覚えた 技が わくの 数より 多い：使えない 技に「わくが たりない」の 説明
      await page.evaluate(function () { var G = window.__re.G; G.run.learned = ['chikara', 'teppeki', 'kakenuke', 'mikawashi', 'todome']; G.run.equip = { atk: 'horn', def: 'shell', mov: 'wing', free: 'eye' }; });
      await page.evaluate(function () { document.getElementById('bBack').click(); }); await page.click('.road[data-road="0"] button'); // スマホは 下の 帯が ボタンに かかる ので 直接（前から 同じ）
      var cp = await page.evaluate(function () { var e = document.querySelector('#pMe [data-cap]'); return { n: document.querySelectorAll('#pMe [data-cap]').length, id: e ? e.getAttribute('data-waza') : '' }; });
      if (cp.id) { await page.click('#pMe [data-waza="' + cp.id + '"]'); }
      var cpt = await page.evaluate(function () { return document.getElementById('tip').textContent; });
      if (!pc) await page.click('#pMe', { position: { x: 4, y: 4 } }); // スマホは 帯を とじる
      check(cp.n === 1 && cp.id === 'todome' && cpt.indexOf('わくが たりなくて') >= 0, 'わざが わくの 数（4）より 多い：' + cp.n + 'つ（' + cp.id + '）に「' + cpt.slice(0, 30) + '…」');
      // もう一度 じゆうに つけて 4つで 戦う
      await page.evaluate(function () { var G = window.__re.G; G.run.learned = []; G.run.equip = { atk: 'horn', def: 'shell', mov: 'wing', free: null }; });
      await page.evaluate(function () { document.getElementById('bBack').click(); }); await page.click('.road[data-road="0"] button'); // スマホは 下の 帯が ボタンに かかる ので 直接（前から 同じ）
      await page.click('#slots .slot.atk [data-pick="eye"]');
      await page.click('#bFight'); await page.waitForTimeout(400);
      var bt = await page.evaluate(function () { var G = window.__re.G, S = window.__re.S; return { eq: JSON.stringify(G.run.equip), n: S.equipList(G.run.equip).length, me: document.querySelectorAll('#bMe .ptile').length }; });
      check(bt.n === 4, '4つで 戦う（つけた パーツ ' + bt.n + '・戦いの カードの パーツ ' + bt.me + '）' + bt.eq);
      await snap('battle_four');
      if (errs.length) { bad++; console.log('✕ エラー ' + errs.join(' / ')); }
      await ctx.close();
    }
  } finally { if (browser) await browser.close(); sv.kill(); }
  console.log(bad ? '不合格 ' + bad : '合格');
  process.exit(bad ? 1 : 0);
})();
