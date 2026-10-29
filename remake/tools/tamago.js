// 作り直しの 版 — たまご（周回の おわりに 覚えた 技を 1つ のこし、次の 子が 覚えて 生まれる）の 検査。実際の クリックで：
//   ぬしに 勝って クリア → おわり → 🥚 たまごの 画面（覚えた 技 2つ）→ とじて 開きなおすと「つづきから」で 同じ 画面 → 1つ えらぶ
//   → タイトルの 殿堂に「→ たまごに」→ 種類を 選ぶ 画面に 🥚 の 帯（つかわない／つかう）→ ほかの 種類で 始める → カードに 🥚 の 技・帯の 説明
//   → ハート 0 で おわっても たまごの 画面 →「のこさない」で たまごは のこる。
//   どの 画面も ページの スクロール 0（PC）・横 0・はみ出し 0・エラー 0。1920×910 は 中の スクロールも 0。node tools/tamago.js [出す フォルダ]
'use strict';
var { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
var OUT = process.argv[2] || path.join(__dirname, '..', 'screenshots');
var SIZES = [[1366, 650], [1920, 910], [375, 812]], PORT = 8795;
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
      var URL = 'http://localhost:' + PORT + '/index.html?seed=12&speed=20&mute=1';
      await page.goto(URL + '&reset=1');
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
        await page.screenshot({ path: path.join(OUT, 're3_' + name + '_' + tag + '.png') });
      }
      // 1. ころんで ぬしの 前（9しょう）・覚えた 技 2つ・勝てる つよさ
      await page.click('#bStart');
      var noBar = await page.evaluate(function () { return document.getElementById('eggbar').textContent; });
      check(noBar === '', 'たまご なし：種類を 選ぶ 画面に 帯は ない');
      await page.click('[data-go="koron"]');
      await page.evaluate(function () { var G = window.__re.G, S = window.__re.S, run = G.run; run.wins = S.CFG.runBattles - 1; run.learned = ['teppeki', 'kakenuke']; run.stats.hp = 999; run.stats.atk = 80; run.fork = S.makeFork(run); });
      await page.click('.road[data-road="0"] button');
      await page.click('#bFight'); await page.click('#bSkip');
      await page.waitForSelector('#result.on', { timeout: 60000 });
      await page.click('#bNext');
      var eg = await page.evaluate(function () { return { on: document.querySelector('.screen.on').id, n: document.querySelectorAll('#eggw [data-egg]').length, h: document.querySelector('#eggw h1').textContent, want: window.__re.G.run.learned.length }; });
      check(eg.on === 'egg' && eg.n === eg.want, 'クリアの あと：' + eg.h + '（えらべる 技 ' + eg.n + '＝覚えた 技 ' + eg.want + '。さいごの 勝ちで ひらめく ことも ある）');
      await snap('egg_pick');
      // 2. とじて 開きなおす →「はじめる」でも 先に たまごの 画面（だまって 消さない）→ もう一度 とじて「つづきから」
      await page.goto(URL);
      await page.click('#bStart');
      var st = await page.evaluate(function () { return { on: document.querySelector('.screen.on').id, egg: localStorage.getItem('remake.egg') }; });
      check(st.on === 'egg' && (st.egg === null || st.egg === 'null'), 'とじて 開きなおして「はじめる」：先に たまごの 画面（たまごは まだ 消えない）');
      await page.goto(URL);
      var cont = await page.evaluate(function () { return getComputedStyle(document.getElementById('bCont')).display !== 'none'; });
      await page.click('#bCont');
      var eg2 = await page.evaluate(function () { return { on: document.querySelector('.screen.on').id, n: document.querySelectorAll('#eggw [data-egg]').length }; });
      check(cont && eg2.on === 'egg' && eg2.n === eg.n, 'とじて 開きなおす：「つづきから」で たまごの 画面に もどる');
      await page.click('#eggw [data-egg="kakenuke"]');
      var t = await page.evaluate(function () { return { on: document.querySelector('.screen.on').id, hall: document.getElementById('hall').textContent, egg: localStorage.getItem('remake.egg'), run: localStorage.getItem('remake.run'), cont: getComputedStyle(document.getElementById('bCont')).display }; });
      check(t.on === 'title' && t.hall.indexOf('たまごに「かけぬけ」') >= 0 && /kakenuke/.test(t.egg || '') && t.run === 'null' && t.cont === 'none', 'えらんだ あと：タイトル・殿堂「' + t.hall.slice(0, 40) + '」・たまごを 保存・周回は おわり');
      await snap('title_hall');
      // 3. 種類を 選ぶ：🥚 の 帯。つかわない ⇄ つかう
      await page.click('#bStart');
      var bar = await page.evaluate(function () { var b = document.querySelector('#eggbar .eggbar'); return b ? b.textContent : ''; });
      check(bar.indexOf('かけぬけ') >= 0 && bar.indexOf('どの 子も') >= 0, '種類を 選ぶ：帯「' + bar.slice(0, 40) + '」');
      var cards = await page.evaluate(function () { return document.querySelectorAll('#spgrid .wz.oya').length; });
      check(cards === 4, '種類の カード 4枚 ぜんぶに 🥚 の 技（' + cards + '）');
      await snap('species_egg');
      await page.click('#bEggUse');
      var off = await page.evaluate(function () { var b = document.querySelector('#eggbar .eggbar'); return b.classList.contains('off') && b.textContent.indexOf('つかわない') >= 0 && !document.querySelector('#spgrid .wz.oya'); });
      await page.click('#bEggUse');
      var on2 = await page.evaluate(function () { return !document.querySelector('#eggbar .eggbar').classList.contains('off'); });
      check(off && on2, '帯の ボタンで つかわない ⇄ つかう');
      // 4. ほかの 種類（ぴゅん）で 始める → 覚えて いる・🥚 の 印
      await page.click('[data-go="pyun"]');
      var ch = await page.evaluate(function () { var G = window.__re.G; return { learned: G.run.learned.join(), inherit: G.run.inherit, egg: localStorage.getItem('remake.egg') }; });
      check(ch.learned === 'kakenuke' && ch.inherit && ch.inherit.parent && ch.egg === 'null', 'ぴゅんで 始める：かけぬけを 覚えて いる（親 ' + (ch.inherit && ch.inherit.parent) + ')・たまごは つかった');
      await page.click('.road[data-road="0"] button');
      var oya = await page.evaluate(function () { var e = document.querySelector('#pMe .wz.oya'); return e ? e.textContent : ''; });
      await page.click('#pMe .wz.oya');
      var tip = await page.evaluate(function () { return document.getElementById('tip').textContent; });
      check(oya === '🥚かけぬけ' && tip.indexOf('おやから うけついだ') >= 0, 'じゅんびの カード：「' + oya + '」・帯「' + tip.slice(0, 26) + '…」');
      if (!pc) await page.click('#pMe', { position: { x: 4, y: 4 } });
      await snap('prep_oya');
      // 4b. 継いだ 技を 使える パーツ（はやい＝ばねあし）で 勝つ → 「なじんだ！」と レベルアップ（ひらめかない ように する）
      await page.evaluate(function () { var G = window.__re.G, S = window.__re.S, run = G.run; S.CFG.hira.chance = 0; S.CFG.hira.perLuck = 0; S.CFG.hira.hard = 0; run.owned = ['longtail', 'spring']; run.equip = { atk: null, def: 'longtail', mov: 'spring' }; run.stats.hp = 999; run.stats.atk = 80; run.nare = {}; if (run.fork.roads[0].hard) run.fork.roads.reverse(); });
      await page.evaluate(function () { document.getElementById('bBack').click(); }); await page.click('.road[data-road="0"] button');
      await page.click('#bFight'); await page.click('#bSkip');
      await page.waitForSelector('#result.on', { timeout: 60000 });
      var nj = await page.evaluate(function () { var h = document.querySelector('#resw h2.hira'); return { h: h ? h.textContent : '', up: document.querySelectorAll('#resw .lvl .fx-up').length, spd: (document.querySelector('#resw .lvl') || {}).textContent || '' }; });
      check(nj.h.indexOf('なじんだ') >= 0 && /はやさ|💨/.test(nj.spd), '継いだ 技で はじめて 勝つ：「' + nj.h + '」と レベルアップの 行');
      await snap('result_najimu');
      await page.click('#bNext');
      await page.click('.road[data-road="0"] button');
      // 5. ハート 0 で おわる → たまごの 画面 →「のこさない」→ 前の たまごは のこる
      await page.evaluate(function () { localStorage.setItem('remake.egg', JSON.stringify({ waza: 'teppeki', parent: 'まえの子', sp: 'gotsun' })); var G = window.__re.G; G.run.hearts = 1; G.run.stats.hp = 1; G.run.stats.def = 0; G.run.stats.atk = 1; G.run.learned = ['kakenuke', 'fuiuchi']; });
      await page.click('#bFight'); await page.click('#bSkip');
      await page.waitForSelector('#result.on', { timeout: 60000 });
      await page.click('#bNext');
      var lo = await page.evaluate(function () { return { on: document.querySelector('.screen.on').id, n: document.querySelectorAll('#eggw [data-egg]').length, oyaMark: (document.querySelector('#eggw [data-egg="kakenuke"] b') || {}).textContent, old: document.getElementById('eggw').textContent.indexOf('いれかわる') >= 0 }; });
      check(lo.on === 'egg' && lo.n === 2 && lo.oyaMark === '🥚かけぬけ' && lo.old, 'ハート 0：たまごの 画面（' + lo.n + 'つ・継いだ 技は 🥚・いまの たまごと いれかわる と 出る）');
      await snap('egg_lose');
      await page.click('#bNoEgg');
      var keep = await page.evaluate(function () { return { on: document.querySelector('.screen.on').id, egg: localStorage.getItem('remake.egg'), hall: document.getElementById('hall').textContent }; });
      check(keep.on === 'title' && /teppeki/.test(keep.egg || '') && keep.hall.indexOf('の こ') >= 0, '「のこさない」：前の たまごは のこる・殿堂に「🥚○○の こ」');
      if (errs.length) { bad++; console.log('✕ エラー ' + errs.join(' / ')); }
      await ctx.close();
    }
  } finally { if (browser) await browser.close(); sv.kill(); }
  console.log(bad ? '不合格 ' + bad : '合格');
  process.exit(bad ? 1 : 0);
})();
