// 通常入力の 通し確認（決定 19）：実際の クリック（スマホは タップ）だけで タイトル → 種類 → 始まり → ぬしの 紹介 → わかれみち → バトル前 → たたかう → 戦い → 結果 まで 進む。
// 決定 21-b も 見る：はじめての 周回（殿堂 0体）の 1戦目は もちもの 3つ（せめ・まもり・うごき）で、3つとも つけた 状態。
// 2周目の 形（殿堂 1体）では もちもの 6つ・何も つけていない。
// 使い方：node serve.js 8799 を 動かしてから node tools/tooshi.js [port] [大きさ,…]   例：node tools/tooshi.js 8799 1366x650,1920x910,375x812
// ?speed=10 で 戦いの 見せ方だけ 早める（押す ところは みな 実際の クリック）。?auto=1 は 使わない。合格で 終了コード 0。ブラウザは 閉じる。
'use strict';
const { chromium } = require('playwright');
const PORT = process.argv[2] || '8799';
const SIZES = (process.argv[3] || '1366x650,1920x910,375x812').split(',').map(s => s.split('x').map(Number));
(async () => {
  const b = await chromium.launch();
  let fail = 0; const ng = (m) => { fail++; console.log('  ✕ ' + m); };
  for (const [w, h] of SIZES) {
    const mobile = w < 700;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    const scr = () => page.evaluate(() => window.__dekomon.G.screen);
    const press = async (sel) => { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 8000 }); if (mobile) await l.tap(); else await l.click(); await page.waitForTimeout(250); };
    const waitScr = async (names, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await scr(); if (names.indexOf(s) >= 0) return s; await page.waitForTimeout(150); } return await scr(); };
    // 1回目：はじめての 周回（殿堂 0体）。2回目：殿堂 1体
    // hall 2＝殿堂 1体 だが 2勝（決定 21-d：まだ「はじめの うち」＝1・2戦目の 相手が やさしい）
    for (const hall of [0, 1, 2]) {
      await page.goto('http://localhost:' + PORT + '/?mute=1&speed=10&seed=7&reset=1');
      await page.waitForTimeout(300);
      if (hall) {
        await page.evaluate((hw) => { const D = window.__dekomon, S = window.DekoSim; D.STORE.hall.push({ id: 'h1', name: 'むむ', wins: hw, parts: ['fang'], lv2: [], sparked: [], synergies: [], grow: S.emptyGrow(), growHist: [], maxHit: null, boss: false, enemies: [], date: '2026-10-28', eggUsed: 'x' }); }, hall === 2 ? 2 : 3);
      }
      const path = [];
      try {
        await press('#startBtn'); path.push(await scr());
        if ((await scr()) === 'shu') { await press('#shuList .shucard'); await press('#shuGo'); path.push(await scr()); }
        if ((await scr()) === 'start') {
          const sc = await page.evaluate(() => ({ t: document.getElementById('startCount').textContent, n: window.__dekomon.G.owned.length }));
          if (sc.t !== 'もちもの（' + sc.n + 'つ）') ng(w + 'x' + h + ' 始まりの 見出しが もちものの 数と ちがう：' + sc.t + '／' + sc.n);
          await press('#startGo'); path.push(await scr());
        }
        if ((await scr()) === 'boss') { await press('#bossGo'); path.push(await scr()); }
        if ((await scr()) === 'fork') { await press('#forkPaths .dr-go'); path.push(await scr()); }
        if ((await scr()) !== 'pre') throw new Error('バトル前に 着かない（' + (await scr()) + '）');
        const st = await page.evaluate(() => { const G = window.__dekomon.G, S = window.DekoSim; return { owned: G.owned.slice(), attached: G.attached.slice(), cats: G.owned.map(id => S.PART_BY_ID[id].cat).join(','), worn: document.querySelectorAll('#plist .kv-card.on, #plist .kv-card.sel, #plist .kv-card.worn').length }; });
        console.log(w + 'x' + h + ' 殿堂 ' + hall + '体：もちもの ' + st.owned.length + '（' + st.cats + '）・つけている ' + st.attached.length);
        if (!hall) {
          if (st.owned.length !== 3 || st.cats !== 'atk,def,mov') ng(w + 'x' + h + ' はじめての 周回の もちものが 3つ（せめ・まもり・うごき）で ない');
          if (st.attached.length !== 3) ng(w + 'x' + h + ' はじめての 周回の 1戦目に 3つ つけた 状態で ない');
        } else {
          if (st.owned.length !== 6) ng(w + 'x' + h + ' 2周目の 形で もちものが 6つで ない');
          if (st.attached.length !== 0) ng(w + 'x' + h + ' 2周目の 形で はじめから つけている');
          // 21-a の つけ忘れの 警告が ある 版では 1回目の たたかうは 止まる。もう一度 押す
        }
        await press('#fightBtn');
        if ((await scr()) === 'pre') { await page.waitForTimeout(700); await press('#fightBtn'); }
        const s1 = await waitScr(['battle'], 4000); path.push(s1);
        // 決定 21-d：はじめの うち（殿堂の だれも 3勝に 届いて いない）は 1戦目の 相手の たいりょくが ×early。画面の 数と 計算を 比べる
        const hp = await page.evaluate(() => { const G = window.__dekomon.G, S = window.DekoSim, e = S.enemyDefOf(S.pathOf(G.run, 0, G.run.choices[0] || 0).enemy), hard = !!S.pathOf(G.run, 0, G.run.choices[0] || 0).hard;
          return { shown: document.getElementById('hpNumE').textContent, easy: S.makeFighter('e', e, e.parts, 1, [], { hard: hard, easy: true }).maxHp, norm: S.makeFighter('e', e, e.parts, 1, [], { hard: hard }).maxHp }; });
        const wantEasy = hall !== 1, want = wantEasy ? hp.easy : hp.norm;
        console.log('  1戦目の 相手の たいりょく：' + hp.shown + '（はじめの うち ' + (wantEasy ? 'はい' : 'いいえ') + '：やさしい ' + hp.easy + '／ふつう ' + hp.norm + '）');
        if (hp.shown !== want + ' / ' + want) ng(w + 'x' + h + ' 殿堂 ' + hall + '：1戦目の 相手の たいりょくが ' + hp.shown + '（ほしい ' + want + '）');
        const s2 = await waitScr(['win', 'over', 'grow'], 60000); path.push(s2);
        if (['win', 'over', 'grow'].indexOf(s2) < 0) throw new Error('戦いが 終わらない（' + s2 + '）');
        if (s2 === 'win') { await press('#winNext'); path.push(await waitScr(['fork', 'grow', 'summit', 'pre'], 6000)); }
        console.log('  通った 画面：title → ' + path.join(' → '));
        // 同じ ページで つぎの 周回を 始めても 前の 周回の 数が 残らない（21-b の 確認役の 指摘）
        const rs = await page.evaluate(() => { const D = window.__dekomon, G = D.G; D.dbg.startRun(null, null, 'koron'); return { b: G.battle, w: G.wins, h: G.history.length, l: G.lv2.length, a: G.attached.length }; });
        if (rs.b || rs.w || rs.h || rs.l || rs.a) ng(w + 'x' + h + ' 同じ ページの つぎの 周回に 前の 数が 残った ' + JSON.stringify(rs));
      } catch (e) { ng(w + 'x' + h + ' 殿堂 ' + hall + '体：' + e.message + '（' + path.join(' → ') + '）'); }
    }
    if (errs.length) ng(w + 'x' + h + ' エラー ' + errs.join(' / '));
    await ctx.close();
  }
  await b.close();
  console.log(fail ? '失敗 ' + fail : '合格');
  process.exit(fail ? 1 : 0);
})();
