// 決定 16 の 押し方の 確かめ：PC（マウスを 合わせると 文・クリックで つける／はずす）とスマホ（タップで つける・長押しで 文）
// 使い方：node serve.js 8799 を 動かしてから node tools/oshikata.js [port]
var PORT = process.argv[2] || '8799';
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const out = {};
  // PC
  let ctx = await b.newContext({ viewport: { width: 1920, height: 910 } });
  let page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:' + PORT + '/?mute=1&seed=7&reset=1');
  await page.evaluate(() => { window.__dekomon.STORE.hall.push({ id: 'h0', name: 'まえ', wins: 0, boss: false, gen: 1, parent: null, eggUsed: null, parts: [], lv2: [], sparked: [], synergies: [], grow: {}, growHist: [], maxHit: { dmg: 1, label: '' }, enemies: [], date: '2026-10-28' }); /* 殿堂 1体（決定 21-b の はじめての 3つを さけて いつもの 6つ・0こ から） */ window.__dekomon.dbg.startRun(); const G = window.__dekomon.G; G.run.choices[0] = 0; G.rewards = []; window.__dekomon.dbg.showPre(); });
  await page.waitForTimeout(200);
  const id = await page.evaluate(() => document.querySelector('#plist .kv-card').dataset.id);
  out.how = await page.textContent('#kvHow');
  await page.hover(`#plist .kv-card[data-id="${id}"]`);
  await page.waitForTimeout(100);
  out.pcHoverInfo = await page.evaluate(() => (document.querySelector('#preInfo .if-name') || {}).textContent);
  out.pcHoverAttached = await page.evaluate(() => window.__dekomon.G.attached.slice());
  await page.click(`#plist .kv-card[data-id="${id}"]`);
  out.pcClick1 = await page.evaluate(() => window.__dekomon.G.attached.slice());
  await page.click(`#plist .kv-card[data-id="${id}"]`);
  out.pcClick2 = await page.evaluate(() => window.__dekomon.G.attached.slice());
  await page.mouse.move(5, 5); await page.waitForTimeout(100);
  out.pcLeaveInfo = await page.evaluate(() => (document.querySelector('#preInfo .if-name') || {}).textContent);
  // fork hover of chip
  await page.evaluate(() => window.__dekomon.dbg.showFork()); await page.waitForTimeout(200);
  await page.hover('#forkPaths .kv-chip'); await page.waitForTimeout(100);
  out.forkHover = await page.evaluate(() => (document.querySelector('#forkInfo .if-name') || {}).textContent + ' / ' + window.__dekomon.G.screen);
  await page.hover('#forkPaths .kv-st'); await page.waitForTimeout(100);
  out.forkStat = await page.evaluate(() => (document.querySelector('#forkInfo .if-name') || {}).textContent);
  out.pcErrs = errs.slice();
  await ctx.close();
  // phone
  ctx = await b.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:' + PORT + '/?mute=1&seed=7&reset=1');
  await page.evaluate(() => { window.__dekomon.STORE.hall.push({ id: 'h0', name: 'まえ', wins: 0, boss: false, gen: 1, parent: null, eggUsed: null, parts: [], lv2: [], sparked: [], synergies: [], grow: {}, growHist: [], maxHit: { dmg: 1, label: '' }, enemies: [], date: '2026-10-28' }); /* 殿堂 1体（決定 21-b の はじめての 3つを さけて いつもの 6つ・0こ から） */ window.__dekomon.dbg.startRun(); const G = window.__dekomon.G; G.run.choices[0] = 0; G.rewards = []; window.__dekomon.dbg.showPre(); });
  await page.waitForTimeout(200);
  out.phHow = await page.textContent('#kvHow');
  await page.tap(`#plist .kv-card[data-id="${id}"]`); await page.waitForTimeout(100);
  out.phTap = await page.evaluate(() => [window.__dekomon.G.attached.slice(), document.getElementById('partPop').classList.contains('on')]);
  // long press via CDP touch
  const box = await page.locator(`#plist .kv-card[data-id="${id}"]`).boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(600);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  out.phLong = await page.evaluate(() => [window.__dekomon.G.attached.slice(), document.getElementById('partPop').classList.contains('on'), (document.querySelector('#partPopBox .if-name') || {}).textContent]);
  out.phErrs = errs;
  console.log(JSON.stringify(out, null, 1));
  var ok = out.pcHoverInfo && !out.pcHoverAttached.length && out.pcClick1.length === 1 && !out.pcClick2.length && out.phTap[0].length === 1 && !out.phTap[1] && out.phLong[0].length === 1 && out.phLong[1] && !out.pcErrs.length && !out.phErrs.length;
  console.log(ok ? '合格' : '不合格'); process.exitCode = ok ? 0 : 1;
  await b.close();
})();
