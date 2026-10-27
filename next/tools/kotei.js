// 決定 17-a の 確かめ：「画面が 急に 動く」が 起きないか（実際の マウス・クリックで）。
// 使い方：node serve.js 8799 を 動かしてから node tools/kotei.js [port] [大きさ,…]（既定 1920x910,1366x650。PC 用：スマホは 文が 上に 出るので 使わない）
// やること：
//  1. どの画面も 同じ 倍率か（タイトル・種類を 選ぶ・始め・ぬし・わかれみち・バトル前・勝ち・そだち・ちょうじょう・クリア・負け・図鑑・殿堂）。
//  2. バトル前（もちもの 16こ・Lv2 8）で、もちものに マウスを 合わせる・クリックで つける／はずす・相手の 札に 合わせる を 30回 して、
//     そのたびに 倍率と 大きな 箱（体の 台・手札の 列・相手の 欄）の 位置と 大きさが 変わらないか（24px より 大きい ずれ＝急に 動いた）。
//  3. わかれみち（もらえるものに 合わせる）も 同じ。
// 合格：1 で 倍率が 1つ、2・3 で 急に 動いた 0。終わったら ブラウザを 閉じる。
'use strict';
const { chromium } = require('playwright');
const PORT = process.argv[2] || '8799';
const SIZES = (process.argv[3] || '1920x910,1366x650').split(',').map(s => s.split('x').map(Number));

const ANCHORS = '.screen.on .kv-stage, .screen.on .kv-handcol, .screen.on .kv-side, .screen.on .dr-door, .screen.on h2';
function snapJs(sel) {
  const bs = Array.from(document.querySelectorAll(sel)).filter(b => b.offsetParent);
  return { z: window.__zoom || 1, cls: ['ew1700', 'eshort', 'ewide'].filter(c => document.documentElement.classList.contains(c)).join(' '), boxes: bs.map(b => [b.id || b.className.split(' ')[0], b.offsetLeft, b.offsetTop, b.offsetWidth, b.offsetHeight]) };
}
function diff(a, b) {
  if (a.z !== b.z) return '倍率 ' + a.z + '→' + b.z;
  if (a.cls !== b.cls) return '並び ' + a.cls + '→' + b.cls;
  if (a.boxes.length !== b.boxes.length) return '箱の 数 ' + a.boxes.length + '→' + b.boxes.length;
  for (let i = 0; i < a.boxes.length; i++) {
    const x = a.boxes[i], y = b.boxes[i];
    for (let k = 1; k <= 4; k++) if (Math.abs(x[k] - y[k]) > 24) return y[0] + ' ' + x.slice(1).join(',') + '→' + y.slice(1).join(',');
  }
  return '';
}

(async () => {
  const b = await chromium.launch();
  let fail = 0;
  for (const [W, H] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: W, height: H } });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('http://localhost:' + PORT + '/?mute=1&seed=7&reset=1');
    // 1. 画面ごとの 倍率
    const zs = await page.evaluate(() => {
      const D = window.__dekomon, G = D.G, S = window.DekoSim, out = {};
      const rec = n => { out[n] = window.__zoom || 1; };
      rec('title');
      D.dbg.openZukan(); rec('zukan'); D.dbg.zukanTab('syn'); rec('zukan(かみあい)');
      D.dbg.openDendo(); rec('dendo');
      D.dbg.startRun(); G.run.choices[0] = 0; G.rewards = [];
      D.dbg.showStart(); rec('start');
      D.dbg.showBossIntro(); rec('boss');
      D.dbg.showFork(); rec('fork');
      D.dbg.showPre(); rec('pre');
      G.owned = S.PART_IDS.slice(); G.lv2 = ['horn', 'fang', 'claw', 'shell', 'tail', 'wing', 'spike', 'crush'];
      D.dbg.showFork(); rec('fork(16こ)');
      D.dbg.showPre(); rec('pre(16こ)');
      const pth = S.pathOf(G.run, 0, 0), parts = G.owned.slice(0, 3);
      const res = S.runBattle(parts, pth.enemy, 1, pth.field, { rng: S.makeRng(5), grow: G.grow, lv2: G.lv2, spark: { stage: 1, pity: 0, nare: G.nare } });
      const e = S.enemyDefOf(pth.enemy), f = S.FIELD_BY_ID[pth.field];
      G.history.push({ enemy: e, field: f, hard: false, parts: parts, win: true, hands: res.nHands, timeout: res.timeout, summary: res.summary, spark: res.spark });
      G.lastSummary = { sum: res.summary, enemy: e, spark: res.spark }; G.lastParts = parts.slice(); G.wins = 1; G.battle = 1;
      D.dbg.showWin(true); rec('win');
      D.dbg.showOver(); rec('over');
      G.battle = 0; G.wins = 0;
      D.dbg.showGrow('strong', true); rec('grow');
      D.dbg.showSummit(); rec('summit');
      return { zs: out, zU: window.__zoomU };
    });
    const vals = Array.from(new Set(Object.values(zs.zs)));
    console.log(`### ${W}x${H}：そろえる 倍率 ${zs.zU}`);
    console.log('画面ごとの 倍率：' + Object.entries(zs.zs).map(([k, v]) => k + ' ' + v).join('、'));
    const odd = Object.entries(zs.zs).filter(([, v]) => v !== zs.zU).map(([k, v]) => k + ' ' + v);
    console.log('倍率が そろわない 画面：' + (odd.length ? odd.join('、') : 'なし') + '（倍率の 種類 ' + vals.length + '）');
    if (W === 1920 && H === 910 && vals.length !== 1) fail++;
    // 2. バトル前 16こ で 実際に 合わせる・押す
    await page.evaluate(() => { const D = window.__dekomon; D.dbg.showPre(); });
    await page.waitForTimeout(150);
    let prev = await page.evaluate(snapJs, ANCHORS), jumps = [], acts = 0, inner = [];
    const ids = await page.evaluate(() => Array.from(document.querySelectorAll('#plist .kv-card')).map(c => c.dataset.id));
    const step = async (what, fn) => {
      await fn(); await page.waitForTimeout(80); acts++;
      const cur = await page.evaluate(snapJs, ANCHORS); const d = diff(prev, cur);
      if (d) jumps.push(what + '：' + d); prev = cur;
      if (W === 1920 && H === 910) { // 1920×910 は 中の スクロールも 0（決定 9）。説明の 欄を 出した ときも
        const ov = await page.evaluate(() => Array.from(document.querySelectorAll(window.__SCROLL_BOXES)).filter(b => b.clientHeight > 0 && b.scrollHeight > b.clientHeight + 1).map(b => (b.id || b.className.split(' ')[0]) + ' ' + b.clientHeight + '/' + b.scrollHeight).join(','));
        if (ov) inner.push(what + '：' + ov);
      }
    };
    for (let i = 0; i < ids.length && acts < 24; i++) {
      const sel = `#plist .kv-card[data-id="${ids[i]}"]`;
      await step('合わせる ' + ids[i], () => page.hover(sel));
      if (i % 3 === 0) await step('クリック ' + ids[i], () => page.click(sel));
    }
    for (const id of ids.slice(0, 6)) await step('はずす／つける ' + id, () => page.click(`#plist .kv-card[data-id="${id}"]`));
    const chips = await page.$$('#eChips > *');
    for (let i = 0; i < Math.min(chips.length, 4); i++) await step('相手の 札 ' + i, () => chips[i].hover());
    await step('マウスを 外す', () => page.mouse.move(3, 3));
    console.log(`バトル前：${acts}回 さわって、急に 動いた ${jumps.length}` + (jumps.length ? '：' + jumps.slice(0, 5).join(' ／ ') : ''));
    if (jumps.length) fail++;
    if (inner.length) { console.log('中の スクロール（1920×910）' + inner.length + '：' + inner.slice(0, 5).join(' ／ ')); fail++; }
    // 3. わかれみち
    await page.evaluate(() => window.__dekomon.dbg.showFork()); await page.waitForTimeout(150);
    prev = await page.evaluate(snapJs, ANCHORS); jumps = []; acts = 0; inner = [];
    const fchips = await page.$$('#forkPaths .kv-chip, #forkPaths .kv-st, #forkPaths .kv-rwb');
    for (let i = 0; i < Math.min(fchips.length, 12); i++) await step('わかれみちの 札 ' + i, () => fchips[i].hover());
    await step('マウスを 外す', () => page.mouse.move(3, 3));
    console.log(`わかれみち：${acts}回 さわって、急に 動いた ${jumps.length}` + (jumps.length ? '：' + jumps.slice(0, 5).join(' ／ ') : ''));
    if (jumps.length) fail++;
    if (inner.length) { console.log('中の スクロール（1920×910）' + inner.length + '：' + inner.slice(0, 5).join(' ／ ')); fail++; }
    if (errs.length) { console.log('エラー：' + errs.join(' ／ ')); fail++; }
    console.log('');
    await ctx.close();
  }
  await b.close();
  console.log(fail ? '不合格' : '合格'); process.exitCode = fail ? 1 : 0;
})();
