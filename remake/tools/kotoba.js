// 作り直しの 版 — はじめての ことばの ひとことが カードから はみ出さないか（18の ことば × 4つの 大きさ）。node tools/kotoba.js
'use strict';
const { chromium } = require('playwright'); const { spawn } = require('child_process');
(async () => {
  const sv = spawn(process.execPath, [require('path').join(__dirname, '..', 'serve.js'), '8796'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(); let BAD = 0;
  for (const [w, h] of [[1366, 650], [1920, 910], [375, 812], [1024, 700]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    await p.goto('http://localhost:8796/index.html?reset=1'); await p.waitForFunction(function () { return !!window.__re; }); /* 保存の 鍵（Web Locks）を とって 画面が できるまで 待つ */ await p.click('#bStart'); await p.click('[data-go="koron"]');
    for (const sel of ['#forkw .road .card', '#forkw > .card, #forkw .card.me']) {
      const res = await p.evaluate((sel) => {
        const card = document.querySelector(sel), kws = card.querySelector('.kws'), out = [], R = window.__re;
        const cr = card.getBoundingClientRect();
        R.S.KW.forEach(k => { kws.innerHTML = '<span class="kw ' + k.role + ' knew">' + k.name + '<span class="kwn">' + R.KW_SHORT[k.id] + '</span></span>';
          const r = kws.firstChild.getBoundingClientRect(); if (r.right > cr.right - 3) out.push(k.name + ' +' + Math.round(r.right - cr.right + 3)); });
        return out;
      }, sel);
      if (res.length) BAD++; console.log(w + 'x' + h, sel, res.length ? res.join(' ') : 'はみ出し 0');
    }
    await p.close();
  }
  console.log(BAD ? "不合格 " + BAD : "合格"); process.exitCode = BAD ? 1 : 0;
  await b.close(); sv.kill();
})();
