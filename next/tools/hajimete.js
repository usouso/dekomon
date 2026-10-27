// 決定 21 の「はじめての 周回」の 確かめ（実際の 画面で）。
// 使い方：node serve.js 8799 を 動かしてから node tools/hajimete.js [port]
// 21-c：はじめての 周回（殿堂 0体）は もちものの ◎✕ を 会ったことの ない 相手にも 出す。殿堂に 1体 でも いれば 会った 相手だけ。
// 合格で 終了コード 0。ブラウザは 閉じる。
'use strict';
const { chromium } = require('playwright');
const PORT = process.argv[2] || '8799';
(async () => {
  const b = await chromium.launch();
  let fail = 0; const ng = (m) => { fail++; console.log('  ✕ ' + m); };
  const page = await (await b.newContext({ viewport: { width: 1366, height: 650 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:' + PORT + '/?mute=1&seed=7&reset=1');
  // 相手に とくい・にがてが 出やすいよう 16こ 全部を もたせて、いくつかの 道で 数える
  const count = (withHall) => page.evaluate((wh) => {
    const D = window.__dekomon, G = D.G, S = window.DekoSim;
    D.STORE.hall.length = 0;
    if (wh) D.STORE.hall.push({ id: 'h1', name: 'むむ', wins: 3, parts: ['fang'], lv2: [], sparked: [], synergies: [], grow: S.emptyGrow(), growHist: [], maxHit: null, boss: false, enemies: [], date: '2026-10-28' });
    const out = [];
    for (let k = 0; k < 4; k++) {
      D.dbg.startRun(null, null, 'koron'); G.owned = S.PART_IDS.slice(); G.run.choices[0] = k % 2; G.rewards = [];
      const e = S.enemyDefOf(S.pathOf(G.run, 0, k % 2).enemy);
      D.STORE.met[e.id] = 0;
      D.dbg.showPre();
      out.push(document.querySelectorAll('#plist .kv-card .mark').length);
    }
    return out;
  }, withHall);
  const a = await count(false), h = await count(true);
  console.log('殿堂 0体：◎✕ の 数 ' + a.join(',') + '／殿堂 1体：' + h.join(','));
  if (!a.some(n => n > 0)) ng('はじめての 周回で ◎✕ が 出ない');
  if (h.some(n => n > 0)) ng('殿堂が あるのに 会っていない 相手に ◎✕ が 出た');
  if (errs.length) ng('エラー ' + errs.join(' / '));
  await b.close();
  console.log(fail ? '失敗 ' + fail : '合格');
  process.exit(fail ? 1 : 0);
})();
