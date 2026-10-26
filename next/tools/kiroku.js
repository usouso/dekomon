// でこもん 試作版 — 試遊の 記録の 要約（決定 12）
// 使い方: node tools/kiroku.js dekomon-kiroku-日付.json
//   ≡メニュー「きろくを ほぞん」で 書き出した ファイルを 読んで、周回ごとの 勝ち数・てごわいを 選んだ 割合・よく使った パーツ・負けた 相手 を 表に する。
'use strict';
var fs = require('fs');
var KR = require('../kiroku.js');
var file = process.argv[2];
if (!file) { console.error('使い方: node tools/kiroku.js dekomon-kiroku-日付.json'); process.exit(1); }
var data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('読めなかった: ' + e.message); process.exit(1); }
if (!data || !Array.isArray(data.runs)) { console.error('でこもんの 記録の ファイルでは ない（runs が ない）'); process.exit(1); }
console.log('# でこもん 試遊の 記録の 要約（' + file + '、書き出し ' + (data.kakidashita || '?') + '）\n');
KR.summarize(data).forEach(function (l) { console.log(l); });
