// 決定 21-a の 確かめ：つけ忘れの 警告（実際の クリックで）。
// 使い方：node serve.js 8799 を 動かしてから node tools/tsukewasure.js [port]
// 見ること（375x812・1366x650・1920x910）：
//  1. わくが 空いて いて つけられる もちものが あるとき、たたかう 1回目 → 戦いは 始まらない・空いた わくが 光る・「まだ つけられるよ」が 見える（画面の 中）・ボタンが「このまま たたかう」。
//  2. 2回目 → 戦いが 始まる。
//  3. 3つ つけたら 1回で 始まる。0こ でも 警告。
//  4. 同じ 体の場所しか 残っていない（つけられる ものが ない）ときは 警告しない。
//  5. ?auto=1 は 警告で 止まらない（自動モード）。
// 合格で 終了コード 0。ブラウザは 閉じる。
'use strict';
const { chromium } = require('playwright');
const PORT = process.argv[2] || '8799';
const URL = 'http://localhost:' + PORT + '/';
(async () => {
  const b = await chromium.launch();
  let fail = 0;
  const ng = (m) => { fail++; console.log('  ✕ ' + m); };
  for (const [W, H] of [[375, 812], [1366, 650], [1920, 910]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H } });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    const open = async (owned) => {
      await page.goto(URL + '?mute=1&seed=7&reset=1');
      await page.evaluate((o) => { const D = window.__dekomon; D.STORE.hall.push({ id: 'h0', name: 'まえ', wins: 0, boss: false, gen: 1, parent: null, eggUsed: null, parts: [], lv2: [], sparked: [], synergies: [], grow: {}, growHist: [], maxHit: { dmg: 1, label: '' }, enemies: [], date: '2026-10-28' }); /* 殿堂 1体（決定 21-b の はじめての 3つ・つけた 状態を さけて いつもの 6つ・0こ から） */ D.dbg.startRun(null, null, 'koron'); if (o) D.G.owned = o; D.dbg.showPre(); }, owned || null);
      await page.waitForTimeout(150);
    };
    const st = () => page.evaluate(() => {
      const G = window.__dekomon.G, vis = (el) => { if (!el || !el.offsetParent) return false; const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; };
      const msg = Array.from(document.querySelectorAll('#pre .fx-warn')).filter(e => /まだ つけられるよ/.test(e.textContent));
      return { screen: G.screen, btn: document.getElementById('fightBtn').textContent, glow: document.querySelectorAll('#slots .kv-slot.empty.fx-slot-warn').length, empty: document.querySelectorAll('#slots .kv-slot.empty').length, msgVis: msg.some(vis) };
    });
    console.log(W + 'x' + H);
    // 1・2：1つ つけて たたかう
    await open();
    let ids = await page.evaluate(() => Array.from(document.querySelectorAll('#plist .kv-card')).map(c => c.dataset.id));
    await page.click(`#plist .kv-card[data-id="${ids[0]}"]`); await page.mouse.move(2, 2);
    await page.click('#fightBtn'); await page.waitForTimeout(150);
    let s = await st();
    if (s.screen !== 'pre') ng('1回目で 戦いが 始まった');
    if (s.glow !== 2 || s.empty !== 2) ng('空いた わくが 光っていない ' + s.glow + '/' + s.empty);
    if (!s.msgVis) ng('「まだ つけられるよ」が 画面の 中に 見えない');
    if (s.btn !== 'このまま たたかう') ng('ボタンの 文字 ' + s.btn);
    await page.click('#fightBtn'); await page.waitForTimeout(150);
    s = await st(); if (s.screen !== 'pre') ng('警告の すぐ あとの 連打で 戦いが 始まった');
    await page.waitForTimeout(600);
    await page.click('#fightBtn'); await page.waitForTimeout(150);
    s = await st(); if (s.screen !== 'battle') ng('2回目で 戦いが 始まらない ' + s.screen);
    // 3：3つ つけたら 1回
    await open();
    const locs = await page.evaluate(() => { const S = window.DekoSim, seen = {}, out = []; window.__dekomon.G.owned.forEach(id => { const l = S.PART_BY_ID[id].loc; if (!seen[l] && out.length < 3) { seen[l] = 1; out.push(id); } }); return out; });
    for (const id of locs) await page.click(`#plist .kv-card[data-id="${id}"]`);
    await page.mouse.move(2, 2);
    s = await st(); if (s.btn !== 'たたかう') ng('3つ つけたのに ボタンが ' + s.btn);
    await page.click('#fightBtn'); await page.waitForTimeout(150);
    s = await st(); if (s.screen !== 'battle') ng('3つ つけて 1回で 始まらない');
    // 0こ でも 警告
    await open(); await page.click('#fightBtn'); await page.waitForTimeout(150);
    s = await st(); if (s.screen !== 'pre' || s.glow !== 3 || !s.msgVis) ng('0こ で 警告が 見えない ' + JSON.stringify(s));
    // 警告の あと 1つ つけても のこりの わくは 光った まま（ボタンの「このまま」と 合う）
    await page.waitForTimeout(600);
    ids = await page.evaluate(() => Array.from(document.querySelectorAll('#plist .kv-card')).map(c => c.dataset.id));
    await page.click(`#plist .kv-card[data-id="${ids[0]}"]`); await page.mouse.move(2, 2);
    s = await st(); if (s.glow !== 2 || s.btn !== 'このまま たたかう') ng('1つ つけたら 光が 消えた ' + JSON.stringify(s));
    // 4：つけられる ものが ない（もちものが 1つ だけ）
    await open(['horn']); await page.click('#plist .kv-card[data-id="horn"]'); await page.mouse.move(2, 2);
    await page.click('#fightBtn'); await page.waitForTimeout(150);
    s = await st(); if (s.screen !== 'battle') ng('つけられる ものが ないのに 止まった');
    if (errs.length) ng('エラー ' + errs.join(' / '));
    await ctx.close();
  }
  // 6：はじめての 周回（殿堂 0体・決定 21-b）は 3つ つけた 状態で 始まる → 警告なしで 1回で 戦う
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 650 } }); const page = await ctx.newPage();
    await page.goto(URL + '?mute=1&seed=7&reset=1');
    await page.evaluate(() => { const D = window.__dekomon; D.dbg.startRun(null, null, 'koron'); D.dbg.showPre(); });
    await page.waitForTimeout(150);
    const att = await page.evaluate(() => window.__dekomon.G.attached.length);
    await page.click('#fightBtn'); await page.waitForTimeout(200);
    const scr = await page.evaluate(() => window.__dekomon.G.screen);
    console.log('はじめての 周回：つけて いる ' + att + '・1回目で ' + scr);
    if (att === 3 && scr === 'pre') ng('はじめての 周回で 3つ つけて いるのに 警告で 止まった');
    await ctx.close();
  }
  // 5：?auto=1
  const ctx = await b.newContext({ viewport: { width: 1366, height: 650 } });
  const page = await ctx.newPage();
  await page.goto(URL + '?auto=1&bg=1&speed=10&seed=11&reset=1');
  let seen = false; const t0 = Date.now();
  while (Date.now() - t0 < 20000) { await page.waitForTimeout(200); const sc = await page.evaluate(() => window.__dekomon.G.screen); if (sc === 'battle') { seen = true; break; } }
  if (!seen) ng('?auto=1 で 戦いに 入らない（自動モード）');
  await ctx.close();
  await b.close();
  console.log(fail ? '失敗 ' + fail : '合格');
  process.exit(fail ? 1 : 0);
})();
