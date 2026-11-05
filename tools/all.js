// たたみやま 版1 — まとめて確かめる：node tools/all.js [--quick]
// 順に：tests.js → bot.js（--quick なら 300回・短い探索）→ tools/check.js（4つの大きさ）→ tools/screens.js → tools/frames.js
// どれかが失敗したら そこで止まり、終了コードが 0 以外になる。終わったら ブラウザは 各ツールが自分で閉じる。
'use strict';
var { spawnSync } = require('child_process');
var path = require('path');
var quick = process.argv.indexOf('--quick') >= 0;
var root = path.join(__dirname, '..');
var steps = [
  ['tests.js', []],
  ['bot.js', quick ? ['--runs', '300', '--quick'] : ['--runs', '1000']],
  ['tools/check.js', ['--runs', quick ? '1' : '3']],
  ['tools/screens.js', []],
  ['tools/frames.js', []]
];
var t0 = Date.now();
for (var i = 0; i < steps.length; i++) {
  var s = steps[i];
  console.log('\n===== ' + s[0] + ' ' + s[1].join(' ') + ' =====');
  var r = spawnSync(process.execPath, [path.join(root, s[0])].concat(s[1]), { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) { console.error('\n' + s[0] + ' が失敗した（終了コード ' + r.status + '）'); process.exit(r.status || 1); }
}
console.log('\n全部 終わった（' + Math.round((Date.now() - t0) / 1000) + '秒）');
