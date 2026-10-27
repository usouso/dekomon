// 決定 17-e の 確かめ：戦いの 開幕の 1げきめに 音が 出るか（と ?mute=1・?auto=1 では 鳴らないか）。
// 使い方：node serve.js 8799 を 動かしてから node tools/oto.js [port]（ポートは 空いている 番号なら 何でも）
// やること：Web Audio の 音の 始まり（oscillator・noise の start）と ダメージの 数字が 出た 時刻を 記録する。
//  1. ふつう：「たたかう」を 押した すぐ あとに 合図の 音（go）・1げきめの 数字と 同じ 時刻（±30ms）に 音。
//  2. ?mute=1 と ?auto=1：音量（MASTER の gain）が 0。
// 本当の スピーカーで 聞こえるかは ここでは 分からない（ヘッドレスの Chrome。ぼくくんの PC で 聞いて 確かめる）。
'use strict';
const { chromium } = require('playwright');
const PORT = process.argv[2] || '8799';
const HOOK = () => {
  window.__snd = []; window.__gain = [];
  const T = () => Math.round(performance.now());
  const AC = window.AudioContext;
  ['createOscillator', 'createBufferSource'].forEach(fn => {
    const orig = AC.prototype[fn];
    AC.prototype[fn] = function () { const o = orig.call(this); const st = o.start; o.start = function () { window.__snd.push(['oto', T(), window.__dekomon && window.__dekomon.masterGain ? window.__dekomon.masterGain() : null]); return st.apply(this, arguments); }; return o; };
  });
  const sta = AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime = function (v) { window.__gain.push(v); return sta.apply(this, arguments); };
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('dmg')) window.__snd.push(['DMG', T(), n.textContent]); }))).observe(document, { subtree: true, childList: true });
};
async function run(b, q) {
  const page = await (await b.newContext({ viewport: { width: 1366, height: 650 } })).newPage();
  await page.addInitScript(HOOK);
  await page.goto('http://localhost:' + PORT + '/?seed=3&reset=1' + q);
  if (q.indexOf('auto=1') >= 0) { await page.waitForTimeout(4000); }
  else {
    await page.click('#startBtn'); await page.waitForTimeout(200);
    await page.evaluate(() => { const D = window.__dekomon, G = D.G; if (!G.run) D.dbg.startRun(null, null, 'koron'); G.run.choices[0] = 0; G.rewards = []; D.dbg.showPre(); });
    await page.waitForTimeout(150);
    const ids = await page.evaluate(() => Array.from(document.querySelectorAll('#plist .kv-card')).map(c => c.dataset.id));
    for (const id of ids.slice(0, 3)) await page.click(`#plist .kv-card[data-id="${id}"]`);
    // 決定 21-a：わくが 空いていると 1回目は「まだ つけられるよ」（戦いは 始まらない）。先に 1回 押して 2回目を はかる
    if (await page.evaluate(() => { const G = window.__dekomon.G; return G.attached.length < 3; })) { await page.click('#fightBtn'); await page.waitForTimeout(100); }
    await page.evaluate(() => { window.__snd.length = 0; window.__snd.push(['FIGHT', Math.round(performance.now())]); });
    await page.click('#fightBtn');
    await page.waitForTimeout(3500);
  }
  const r = await page.evaluate(() => ({ snd: window.__snd, gain: window.__gain }));
  await page.context().close();
  return r;
}
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  let ok = true;
  const a = await run(b, '');
  const f = a.snd.find(x => x[0] === 'FIGHT'), after = a.snd.filter(x => x[1] >= f[1]);
  const go = after.find(x => x[0] === 'oto'), d1 = after.find(x => x[0] === 'DMG');
  const near = d1 && after.some(x => x[0] === 'oto' && Math.abs(x[1] - d1[1]) <= 30);
  console.log('ふつう：たたかう→合図の 音 ' + (go ? (go[1] - f[1]) + 'ms' : 'なし') + '、1げきめ（' + (d1 ? d1[2] + '・' + (d1[1] - f[1]) + 'ms' : 'なし') + '）に 音 ' + (near ? 'あり' : 'なし') + '、音量 ' + a.gain.slice(-1)[0]);
  if (!go || go[1] - f[1] > 150 || !near || !(a.gain.slice(-1)[0] > 0)) ok = false;
  for (const q of ['&mute=1', '&auto=1&bg=1&speed=10']) {
    const m = await run(b, q);
    const g = m.gain.length ? m.gain[m.gain.length - 1] : '（音を 使っていない）';
    const loud = m.snd.filter(x => x[0] === 'oto' && x[2] !== null && x[2] > 0); // 鳴り始めた 瞬間の 全体の 音量
    console.log(q + '：鳴り始めた 瞬間の 音量が 0 で ない 音 ' + loud.length + '（音 ' + m.snd.filter(x => x[0] === 'oto').length + '）');
    if (loud.length) ok = false;
    console.log(q + '：音量 ' + g + '（' + (g === 0 || typeof g === 'string' ? '鳴らない' : '鳴る！') + '）');
    if (!(g === 0 || typeof g === 'string')) ok = false;
  }
  await b.close();
  console.log(ok ? '合格' : '不合格'); process.exitCode = ok ? 0 : 1;
})();
