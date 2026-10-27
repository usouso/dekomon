// でこもん 版8 — 画面ごとの大きさの検査と スクリーンショット（ヘッドレス Chrome / Playwright）
// 使い方: node tools/screens.js [--sizes 1366x650,1920x950,375x812] [--port 8787] [--shots] [--shotsize 1366x650,1920x910]（--shotsize は カンマで いくつでも。スマホは いつも 撮る）
// やること: 自動周回では開かない画面（タイトル・たまごの 2択・親を選ぶ・始め（たまごから）・ぬし・わかれみち・バトル前・勝ち・そだち・ちょうじょう・クリア・負け・図鑑・殿堂（系譜））を
//   window.__dekomon.dbg で開いて、ページの scrollWidth×scrollHeight と 窓の大きさ、中でスクロールする箱（clientHeight／scrollHeight）を表にする。
//   --shots で screenshots/ に 画像を保存（egg_pick.png・egg_start.png・egg_spark.png・dendo_lineage.png・fork_650.png・result_650.png・over_650.png など）。
//   途中セーブ（たまごから 始めた周回で 保存 → 開き直す → 同じ画面）も ここで確かめる。終わったら ブラウザと サーバーを 必ず閉じる。
'use strict';
var { chromium } = require('playwright');
var { spawn } = require('child_process');
var path = require('path');
var fs = require('fs');

function arg(name, def) { var i = process.argv.indexOf('--' + name); if (i < 0) return def; var v = process.argv[i + 1]; return (v === undefined || v.indexOf('--') === 0) ? true : v; }
var SIZES = String(arg('sizes', '1366x650,1920x950,375x812')).split(',').map(function (s) { var a = s.split('x'); return { w: parseInt(a[0], 10), h: parseInt(a[1], 10) }; });
var PORT = parseInt(arg('port', '8788'), 10);
var SHOTS = arg('shots', false) === true;
var SHOTSIZE = String(arg('shotsize', '1366x650'));
var SHOT_DIR = path.join(__dirname, '..', 'screenshots');
var ZB = arg('zb', ''); // 試し用：広い窓の 基準の大きさ（例 1600x760）。index.html の ?zb= に渡す

function startServer() {
  return new Promise(function (resolve) {
    var sv = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
    sv.stdout.on('data', function () { resolve(sv); });
    setTimeout(function () { resolve(sv); }, 1500);
  });
}

// ページの中で使う：殿堂に 親子のいる3体を入れ、周回を n 戦ぶん進めた状態を作る
var PAGE_HELPERS = function () {
  var D = window.__dekomon, S = window.DekoSim, G = D.G;
  window.__h = {
    seedHall: function () {
      var mk = function (name, wins, parts, lv2, gen, parent, parentName, inherited, color, eggUsed, id) {
        return { id: id, name: name, wins: wins, parts: parts, lv2: lv2, sparked: lv2.slice(), synergies: [1, 6], grow: { tough: 1, strong: 1, quick: 1 }, growHist: ['strong', 'quick', 'tough'], maxHit: { dmg: 41, label: 'ツノ' }, boss: wins >= 10,
          enemies: [], date: '2026-10-26', cleared: wins >= 10, parent: parent, parentName: parentName, inherited: inherited, gen: gen, color: color, eggUsed: eggUsed };
      };
      D.STORE.hall.length = 0;
      D.STORE.hall.push(mk('ぺっこぶ', 7, ['claw', 'tail', 'fang'], ['fang'], 3, 'p2', 'ぺっご', 'fang', '#f0a35e', null, 'p3'));
      D.STORE.hall.push(mk('ぺっご', 10, ['horn', 'spring', 'shell'], ['horn', 'fang', 'shell'], 2, 'p1', 'ぺっごか', 'horn', '#f0a35e', 'ぺっこぶ', 'p2'));
      D.STORE.hall.push(mk('えーい', 9, ['leech', 'claw', 'tail'], ['leech', 'claw'], 1, null, null, null, '#8fb8ff', null, 'p4'));
      D.STORE.hall.push(mk('ぺっごか', 10, ['horn', 'weight', 'scale'], ['horn', 'scale'], 1, null, null, null, '#f0a35e', 'ぺっご', 'p1'));
      D.STORE.hall.push(mk('むむ', 3, ['fang', 'wing'], [], 1, null, null, null, '#9ad36a', null, 'p5'));
    },
    // n 戦ぶん 進める（いまの G.battle から。勝ち。lastWin=false なら 最後は負け）
    advance: function (n, lastWin) {
      for (var k = 0; k < n; k++) {
        var b = G.battle;
        var p = S.pathOf(G.run, b, 0); G.run.choices[b] = 0;
        if (b < S.CFG.runBattles - 1) S.forkRewards(G.run, b, G.owned, G.lv2, G.rng);
        var e = S.enemyDefOf(p.enemy), f = S.FIELD_BY_ID[p.field];
        var parts = S.bestLoadout(G.owned, p.enemy, b + 1, p.field, G.grow, G.lv2, !!p.hard).parts;
        var res = S.runBattle(parts, p.enemy, b + 1, p.field, { rng: S.makeRng(b + 5), grow: G.grow, lv2: G.lv2, hard: !!p.hard, spark: { stage: b + 1, pity: 0, nare: G.nare } });
        var win = (k === n - 1) ? lastWin !== false : true;
        G.history.push({ enemy: e, field: f, hard: !!p.hard, parts: parts, win: win, hands: res.nHands, timeout: res.timeout, summary: res.summary, spark: res.spark });
        G.lastSummary = { sum: res.summary, enemy: e, spark: res.spark }; G.lastParts = parts.slice();
        if (res.spark && G.lv2.indexOf(res.spark) < 0) { G.lv2.push(res.spark); G.sparked.push(res.spark); }
        G.rewards = (p.rewards || []).slice();
        if (win) {
          G.wins++;
          G.picked = [];
          if (b < S.CFG.runBattles - 1) G.rewards.forEach(function (r) { var got = S.applyReward(r, G.owned, G.nare, G.lv2); if (got) G.picked.push(got); });
          G.rewards = [];
        }
        G.battle = win ? b + 1 : b;
        if (win && S.growAfterWin(G.wins)) { var gd = S.growDirection(G.acc); G.grow[gd.dir]++; G.growHist.push(gd.dir); }
      }
      G.forkFor = -1;
    },
    measure: function () {
      var de = document.documentElement;
      var zz = window.__zoom || 1; // 広い窓：body と 窓の 大きさは 単位が そろわないので、html の scroll* を html の client* と比べる
      var sw = zz === 1 ? Math.max(de.scrollWidth, document.body.scrollWidth) : de.scrollWidth, sh = zz === 1 ? Math.max(de.scrollHeight, document.body.scrollHeight) : de.scrollHeight;
      var boxes = document.querySelectorAll(window.__SCROLL_BOXES); // index.html と 同じ 箱の一覧
      var inner = [];
      for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; if (b.clientHeight <= 0) continue; var hx = b.classList.contains('plist') && b.scrollWidth > b.clientWidth + 1; inner.push((b.id || b.className.split(' ').slice(0, 2).join('.')) + ' ' + b.clientHeight + '／' + b.scrollHeight + (hx ? '（横 ' + b.clientWidth + '／' + b.scrollWidth + '）' : '') + (b.scrollHeight > b.clientHeight + 1 || hx ? '（中スクロール）' : '')); }
      var z = window.__zoom || 1, iw = z === 1 ? window.innerWidth : de.clientWidth, ih = z === 1 ? window.innerHeight : de.clientHeight;
      return { screen: G.screen, page: sw + '×' + sh, win: window.innerWidth + '×' + window.innerHeight + (z !== 1 ? '（倍率 ' + z.toFixed(2) + '）' : ''), pageScroll: sh > ih + 1 || sw > iw + 1, inner: inner };
    }
  };
};

async function openScreens(browser, size, shots) {
  var ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
  var page = await ctx.newPage();
  var errs = [];
  page.on('pageerror', function (e) { errs.push('pageerror: ' + e.message); });
  page.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  var base = 'http://localhost:' + PORT + '/?mute=1&seed=4242&reset=1' + (ZB ? '&zb=' + ZB : '');
  await page.goto(base);
  await page.evaluate(PAGE_HELPERS);
  var rows = [];
  async function snap(label, file) {
    await page.waitForTimeout(250);
    var m = await page.evaluate(function () { return window.__h.measure(); });
    m.label = label; rows.push(m);
    if (shots && file) await page.screenshot({ path: path.join(SHOT_DIR, file), fullPage: false });
  }
  var sfx = size.w >= 900 ? '_' + size.h : '_sp';
  // タイトル
  await snap('タイトル', shots ? 'title' + sfx + '.png' : null);
  // 殿堂（系譜）
  await page.evaluate(function () { window.__h.seedHall(); window.__dekomon.dbg.openDendo(); });
  await snap('殿堂（系譜 5体）', null);
  await page.evaluate(function () { var k = document.querySelector('#dendoList .family .kids'); if (k) k.parentElement.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(200);
  if (shots) await page.screenshot({ path: path.join(SHOT_DIR, 'dendo_lineage' + sfx + '.png') });
  await page.evaluate(function () { var b = document.querySelector('#dendo .pcbody'); if (b) b.scrollTop = 0; });
  // たまごの 2択 → 親を選ぶ
  await page.evaluate(function () { window.__dekomon.dbg.showEggQ(); });
  await snap('たまご 2択', 'egg_choice' + sfx + '.png');
  await page.evaluate(function () { window.__dekomon.dbg.showEgg(); });
  await snap('親を選ぶ（3体）', 'egg_pick' + sfx + '.png');
  // たまごから 始める（えーい：Lv2 2つ → つめあと を継ぐ）
  await page.evaluate(function () { var ps = window.__dekomon.dbg.eggParents(); var i = ps.map(function (h) { return h.name; }).indexOf('えーい'); window.__dekomon.dbg.startRunEgg(i, 'claw'); });
  await snap('始め（たまごから）', 'egg_start' + sfx + '.png');
  var startInfo = await page.evaluate(function () { var G = window.__dekomon.G; return { name: G.run.name, gen: G.gen, egg: G.egg, color: G.color, owned: G.owned.slice(), nare: G.nare, saved: !!localStorage.getItem('dekomon8.run') }; });
  // 途中セーブ：開き直して ▶ → 同じ始めの画面
  await page.goto('http://localhost:' + PORT + '/?mute=1' + (ZB ? '&zb=' + ZB : ''));
  await page.evaluate(PAGE_HELPERS);
  var contLbl = await page.evaluate(function () { return document.getElementById('contLbl').textContent; });
  await page.click('#startBtn');
  await page.waitForTimeout(200);
  var resumed = await page.evaluate(function () { var G = window.__dekomon.G; return { screen: G.screen, name: G.run.name, gen: G.gen, egg: G.egg, color: G.color, owned: G.owned.slice(), nare: G.nare, head: document.getElementById('startHead').textContent, genTxt: document.getElementById('startGen').textContent, parentTag: !!document.querySelector('#startList .tag.parent'), eggNote: document.getElementById('startEgg').textContent }; });
  rows.push({ label: '途中セーブ（たまごから）', save: { before: startInfo, contLbl: contLbl, after: resumed, same: JSON.stringify([startInfo.name, startInfo.gen, startInfo.egg, startInfo.color, startInfo.owned, startInfo.nare]) === JSON.stringify([resumed.name, resumed.gen, resumed.egg, resumed.color, resumed.owned, resumed.nare]) } });
  // ぬし
  await page.evaluate(function () { window.__dekomon.dbg.showBossIntro(); });
  await snap('やまの ぬし', 'boss' + sfx + '.png');
  // わかれみち（1戦目。もちもの 6こ）
  await page.evaluate(function () { window.__dekomon.dbg.showFork(); });
  await snap('わかれみち（6こ）', 'fork' + sfx + '.png');
  // バトル前（1戦目）
  await page.evaluate(function () { var G = window.__dekomon.G; G.run.choices[0] = 0; G.rewards = (G.run.steps[0][0].rewards || []).slice(); window.__dekomon.dbg.showPre(); });
  await snap('バトル前（1戦目）', 'pre' + sfx + '.png');
  // 決定 16：長押し（0.4秒）で 文（クリックは つける）。タッチの 長押しを まねる
  await page.evaluate(function () { var c = document.querySelector('#plist .kv-card[data-id="claw"]') || document.querySelector('#plist .kv-card'); if (c) c.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, clientX: 5, clientY: 5 })); window.__lp = c; });
  await page.waitForTimeout(550);
  await page.evaluate(function () { if (window.__lp) window.__lp.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true })); });
  await snap('バトル前（パーツの文を 開いた）', 'pre_info' + sfx + '.png');
  await page.evaluate(function () { document.getElementById('partPop').classList.remove('on'); });
  // メニュー（≡）を開いた ところ
  await page.evaluate(function () { document.getElementById('menuBtn').click(); });
  await snap('メニュー', 'menu' + sfx + '.png');
  await page.evaluate(function () { document.getElementById('menuBtn').click(); });
  // 6戦 進めて わかれみち（16こ 近く・Lv2 あり）→ 勝ち → そだち
  await page.evaluate(function () { window.__h.advance(6, true); window.__dekomon.dbg.showFork(); });
  var owned6 = await page.evaluate(function () { return window.__dekomon.G.owned.length + 'こ・Lv2 ' + window.__dekomon.G.lv2.length; });
  await snap('わかれみち（7戦目。' + owned6 + '）', 'fork7' + sfx + '.png');
  await page.evaluate(function () { window.__dekomon.dbg.showWin(true); });
  await snap('勝ち', 'win' + sfx + '.png');
  await page.evaluate(function () { window.__dekomon.dbg.showGrow('strong', true); });
  await snap('そだち', null);
  // 9戦目：わかれみち → バトル前（もちもの 多め・Lv2・おやの札）
  await page.evaluate(function () { window.__h.advance(2, true); window.__dekomon.dbg.showFork(); });
  var owned9 = await page.evaluate(function () { return window.__dekomon.G.owned.length + 'こ・Lv2 ' + window.__dekomon.G.lv2.length; });
  await snap('わかれみち（9戦目。' + owned9 + '）', 'fork9' + sfx + '.png');
  var stay = await page.evaluate(function () { var r = document.querySelector('#forkPaths .kv-rwb'); if (r) r.click(); return { screen: window.__dekomon.G.screen, info: !!(document.querySelector('#forkInfo .info:not(.empty)') || document.querySelector('#partPop.on .info')) }; });
  await snap('わかれみち（もらえるものの 文を 開いた：画面 ' + stay.screen + '・文 ' + (stay.info ? 'あり' : 'なし') + '）', 'fork9_info' + sfx + '.png');
  await page.evaluate(function () { document.getElementById('partPop').classList.remove('on'); });
  await page.evaluate(function () { var G = window.__dekomon.G, S = window.DekoSim; G.run.choices[G.battle] = 0; S.forkRewards(G.run, G.battle, G.owned, G.lv2, G.rng); G.forkFor = G.battle; G.rewards = (S.pathOf(G.run, G.battle, 0).rewards || []).slice(); window.__dekomon.dbg.showPre(); });
  await snap('バトル前（9戦目。' + owned9 + '）', 'pre9' + sfx + '.png');
  // いちばん 多いとき：16こ 全部・Lv2 8つ・3つ つけた（札の文が いちばん 長い）。見たあと もとに もどす
  await page.evaluate(function () { var G = window.__dekomon.G, S = window.DekoSim; window.__keep = { owned: G.owned.slice(), lv2: G.lv2.slice() }; G.owned = S.PART_IDS.slice(); G.lv2 = ['horn', 'fang', 'claw', 'shell', 'tail', 'wing', 'spike', 'crush']; window.__dekomon.dbg.showPre(); ['claw', 'tail', 'fang'].forEach(function (id) { var c = document.querySelector('#plist .kv-card[data-id="' + id + '"]'); if (c) c.click(); }); });
  await snap('バトル前（16こ・Lv2 8・3つ つけた）', 'pre16' + sfx + '.png');
  // いちばん 舞台が 高く なるとき：てごわい（もらえるもの 2つ）・同じ場所の つけかえ（注意の 1行）
  await page.evaluate(function () { var G = window.__dekomon.G; G.rewards = [{ kind: 'nare', part: 'longleg', amt: 10 }, { kind: 'nare', part: 'longtail', amt: 10 }]; window.__dekomon.dbg.showPre(); ['claw', 'crush', 'tail', 'longtail'].forEach(function (id) { var c = document.querySelector('#plist .kv-card[data-id="' + id + '"]'); if (c) c.click(); }); });
  await snap('バトル前（もらえる 2つ・つけかえの 注意）', null);
  await page.evaluate(function () { var G = window.__dekomon.G; G.owned = window.__keep.owned; G.lv2 = window.__keep.lv2; });
  // ちょうじょう
  await page.evaluate(function () { window.__h.advance(1, true); window.__dekomon.dbg.showSummit(); });
  await snap('ちょうじょう', 'summit' + sfx + '.png');
  // クリア（10戦）
  await page.evaluate(function () { var G = window.__dekomon.G; var S = window.DekoSim; var p = G.run.boss; var parts = S.bestLoadout(G.owned, 'boss', 10, 'summit', G.grow, G.lv2, false).parts; var res = S.runBattle(parts, 'boss', 10, 'summit', { rng: S.makeRng(77), grow: G.grow, lv2: G.lv2 }); G.history.push({ enemy: S.BOSS, field: S.SUMMIT, hard: false, parts: parts, win: true, hands: res.nHands, timeout: res.timeout, summary: res.summary, spark: res.spark }); G.lastSummary = { sum: res.summary, enemy: S.BOSS, spark: res.spark }; G.lastParts = parts; G.wins = 10; G.battle = 9; window.__dekomon.dbg.showClear(); });
  await snap('クリア（10戦）', 'result' + sfx + '.png');
  // 負け（9戦目で まけ）：新しい周回を作って 9戦
  await page.evaluate(function () { window.__dekomon.dbg.startRun(); window.__h.advance(9, false); window.__dekomon.dbg.showOver(); });
  await snap('負け（9戦目で まけ）', 'over' + sfx + '.png');
  // 図鑑（パーツ・かみあい）
  await page.evaluate(function () { window.__dekomon.dbg.openZukan(); window.__dekomon.dbg.zukanTab('parts'); });
  await snap('図鑑（パーツ）', 'zukan_parts' + sfx + '.png');
  await page.evaluate(function () { window.__dekomon.dbg.zukanTab('syn'); });
  await snap('図鑑（かみあい）', 'zukan_syn' + sfx + '.png');
  await ctx.close();
  return { size: size, rows: rows, errs: errs };
}

// おもいだした！ の瞬間（1戦目の バトル。再生速度を落として 撮る）
async function shotSpark(browser, size) {
  var ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
  var page = await ctx.newPage();
  await page.goto('http://localhost:' + PORT + '/?mute=1&seed=4242&reset=1&speed=0.5' + (ZB ? '&zb=' + ZB : ''));
  await page.evaluate(PAGE_HELPERS);
  await page.evaluate(function () { window.__h.seedHall(); var ps = window.__dekomon.dbg.eggParents(); var i = ps.map(function (h) { return h.name; }).indexOf('えーい'); window.__dekomon.dbg.startRunEgg(i, 'claw'); });
  await page.evaluate(function () { var G = window.__dekomon.G; G.run.choices[0] = 0; window.DekoSim.forkRewards(G.run, 0, G.owned, G.lv2, G.rng); G.forkFor = 0; G.rewards = (G.run.steps[0][0].rewards || []).slice(); window.__dekomon.dbg.showPre(); });
  await page.waitForTimeout(200);
  // 継いだ キバを つけて たたかう
  await page.evaluate(function () { var c = document.querySelector('#plist .kv-card[data-id="claw"]'); if (c) c.click(); });
  await page.waitForTimeout(100);
  await page.click('#fightBtn');
  if (await page.evaluate(function () { return window.__dekomon.G.screen === 'pre'; })) { await page.waitForTimeout(700); await page.click('#fightBtn'); } // 決定 21-a：わくが 空いていると 1回目は「まだ つけられるよ」
  var got = false, t0 = Date.now(), text = '';
  while (Date.now() - t0 < 30000) {
    await page.waitForTimeout(60);
    var st = await page.evaluate(function () { var p = document.getElementById('sparkpop'); return { on: p.classList.contains('on'), t1: document.getElementById('sparkT1').textContent, t2: document.getElementById('sparkName').textContent, screen: window.__dekomon.G.screen }; });
    if (st.on) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOT_DIR, 'egg_spark' + (size.w >= 900 ? '' : '_sp') + '.png') }); got = true; text = st.t1 + ' ／ ' + st.t2; break; }
    if (st.screen !== 'battle') break;
  }
  await ctx.close();
  return { got: got, text: text };
}

(async function () {
  var sv = await startServer();
  var browser = await chromium.launch();
  var out = [], spark = null;
  try {
    for (var i = 0; i < SIZES.length; i++) {
      var sz = SIZES[i];
      var shots = SHOTS && (SHOTSIZE.split(',').indexOf(sz.w + 'x' + sz.h) >= 0 || sz.w < 900);
      out.push(await openScreens(browser, sz, shots));
      console.error('done ' + sz.w + 'x' + sz.h);
    }
    if (SHOTS) { var ss = SHOTSIZE.split(',')[0].split('x'); spark = await shotSpark(browser, { w: parseInt(ss[0], 10), h: parseInt(ss[1], 10) }); }
  } finally {
    await browser.close(); sv.kill();
  }
  out.forEach(function (o) {
    console.log('### ' + o.size.w + '×' + o.size.h + '（ページ scrollWidth×scrollHeight ／ 窓。中の箱 clientHeight／scrollHeight）');
    console.log('');
    console.log('| 画面 | ページ | 中の箱 |');
    console.log('|---|---|---|');
    o.rows.forEach(function (r) {
      if (r.save) { console.log('| ' + r.label + ' | ' + (r.save.same ? '保存前と 開き直したあとが 同じ（名前・○だいめ・親・色・もちもの・なれ）' : '**違う**') + '　タイトル「' + r.save.contLbl + '」 | 画面 ' + r.save.after.screen + '、「' + r.save.after.head + '」「' + r.save.after.genTxt + '」、おやの札 ' + (r.save.after.parentTag ? 'あり' : 'なし') + '、注「' + r.save.after.eggNote + '」 |'); return; }
      console.log('| ' + r.label + ' | ' + r.page + (r.pageScroll ? ' **（ページがスクロール）**' : '') + ' | ' + (r.inner.length ? r.inner.join('、') : '-') + ' |');
    });
    console.log('');
    if (o.errs.length) { console.log('console のエラー：'); o.errs.forEach(function (e) { console.log('- ' + e); }); console.log(''); }
  });
  if (spark) console.log('おもいだした！ の瞬間：' + (spark.got ? '撮れた（' + spark.text + '）' : '撮れなかった'));
})().catch(function (e) { console.error(e); process.exit(1); });
