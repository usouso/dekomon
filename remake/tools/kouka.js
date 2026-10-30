// でこもん 作り直しの版 — パーツ・技の「やくに たって いるか」を 数える 道具（決定 25 の 見つけ方）
// 使い方：node tools/kouka.js [周回の数=150] [合わせの 周回=40]
//  1) でたらめ：でたらめボットで 周回を 回し、戦う たびに その 場面（自分の 強さ・相手）を そのまま 使って、
//     16 パーツから 役割ごとに でたらめに 1つずつ（なし も）つけた 戦いを もう1回 する（seed は 同じ）。
//     パーツごとに「つけた ときの 勝率」と「同じ 役割で ほかを つけた ときの 勝率」の 差を 出す（差が 小さい・マイナス＝やくに たって いない 候補）。
//  2) 合わせ：合わせボット（ヒントと 同じ 計算）が もって いる ときに 選んだ 割合。
//  3) 技・キーワードの 発動：上の でたらめの 戦いで 1戦 あたり 何回 出たか（技を もって いる 戦いだけで 割る）。
'use strict';
var path = require('path');
var S = require(path.join(__dirname, '..', 'sim.js'));
if (process.env.DEKO_CFG) { var o = JSON.parse(process.env.DEKO_CFG); Object.keys(o).forEach(function (k) { S.CFG[k] = o[k]; }); } // 比べる とき：DEKO_CFG='{"renMult":0.7}'
var N = parseInt(process.argv[2] || '150', 10), NG = parseInt(process.argv[3] || '40', 10);
var t0 = Date.now();

var part = {}; S.PARTS.forEach(function (p) { part[p.id] = { on: 0, onW: 0, off: 0, offW: 0, owned: 0, picked: 0 }; });
var waza = {}; S.WAZA.forEach(function (w) { waza[w.id] = { battles: 0, fires: 0, wins: 0 }; });
var kwFire = {};
var nb = 0;

function rndEquip(rng) { // 役割ごとに その 役割の パーツか なし を でたらめに（なしは 1/5）
  var eq = {};
  S.ROLES.forEach(function (r) { var c = S.PARTS.filter(function (p) { return p.role === r.id; }); eq[r.id] = rng() < 0.2 ? null : c[Math.floor(rng() * c.length)].id; });
  return eq;
}
function probe(run, ri, rng) {
  var road = run.fork.roads[ri], s = run.fork.stage, d = S.enemyDef(road.idx);
  var eq = rndEquip(rng);
  var w = S.wazaFor(run, eq);
  var res = S.battle(S.playerSrc(run, eq), S.enemySrc(road.idx, s, road.hard), S.mix(run.seed, 60000 + nb), { waza: w, eName: d.name });
  nb++;
  S.ROLES.forEach(function (r) {
    S.PARTS.forEach(function (p) { if (p.role !== r.id) return;
      if (eq[r.id] === p.id) { part[p.id].on++; if (res.win) part[p.id].onW++; }
      else if (eq[r.id]) { part[p.id].off++; if (res.win) part[p.id].offW++; } });
  });
  w.forEach(function (id) { waza[id].battles++; if (res.win) waza[id].wins++; });
  res.events.forEach(function (e) {
    if (e.who !== 'p') return;
    if (e.t === 'waza' && waza[e.w]) waza[e.w].fires++;
    if (e.t === 'kw') kwFire[e.kw] = (kwFire[e.kw] || 0) + 1;
    if ((e.t === 'hit' || e.t === 'counter') && e.wz) e.wz.forEach(function (id) { if (id === 'kakenuke' || id === 'todome') waza[id].fires++; }); // 1げきに のる だけで 'waza' の 行が ない 技（ちからこめ・ふいうちは 'waza' の 行で 数える）
  });
}

// 1) でたらめ（4種類）
S.SPECIES.forEach(function (sp) {
  for (var i = 0; i < N; i++) {
    var run = S.newRun(100000 + i * 13, sp.id, null), rng = S.rngFrom(S.mix(100000 + i, 4711)), guard = 0;
    while (!run.over && guard++ < 60) {
      var ri = Math.floor(rng() * run.fork.roads.length);
      probe(run, ri, rng);
      var eq = {}; S.ROLES.forEach(function (r) { var c = run.owned.filter(function (p) { return S.PART_BY_ID[p].role === r.id; }); eq[r.id] = c.length ? c[Math.floor(rng() * c.length)] : null; });
      S.fight(run, ri, eq);
    }
  }
});
// 2) 合わせ：もって いる ときに 選んだ 割合
S.SPECIES.forEach(function (sp) {
  for (var i = 0; i < NG; i++) {
    var run = S.newRun(300000 + i * 17, sp.id, null), guard = 0;
    while (!run.over && guard++ < 60) {
      var best = -1, ri = 0, eq = run.equip;
      run.fork.roads.forEach(function (r, k) { var b = S.bestEquip(run, k, 4); var sc = b.rate + (r.hard ? 0.15 : 0); if (sc > best) { best = sc; ri = k; eq = b.equip; } });
      var list = S.equipList(eq);
      run.owned.forEach(function (p) { part[p].owned++; if (list.indexOf(p) >= 0) part[p].picked++; });
      S.fight(run, ri, eq);
    }
  }
});

function pct(a, b) { return b ? Math.round(100 * a / b) : '—'; }
console.log('## パーツ（でたらめの 戦い ' + nb + '回・合わせ ' + NG + '周回×4種類）');
console.log('| パーツ | 役割 | キーワード | つけた 勝率 | 同じ 役割で ほか | 差 | 合わせで 選んだ（もって いる とき） |');
console.log('|---|---|---|---|---|---|---|');
S.PARTS.slice().map(function (p) { var x = part[p.id]; return { p: p, x: x, diff: x.on && x.off ? 100 * x.onW / x.on - 100 * x.offW / x.off : 0 }; })
  .sort(function (a, b) { return a.diff - b.diff; })
  .forEach(function (o) { var x = o.x, p = o.p;
    console.log('| ' + p.name + ' | ' + p.role + ' | ' + p.kw.join('・') + ' | ' + pct(x.onW, x.on) + '% | ' + pct(x.offW, x.off) + '% | ' + (o.diff >= 0 ? '+' : '') + o.diff.toFixed(1) + ' | ' + pct(x.picked, x.owned) + '%（' + x.owned + '） |'); });
console.log('\n## 技（でたらめの 戦いで、その 技を 使える 戦いだけ）');
console.log('（発動の 単位：かけぬけ・とどめ は 1げきごと〔はんげきも〕、ほかは 1手に 1回。ぶれ：1パーツ 数百戦 なので ±3 くらい は ゆれる）');
console.log('| 技 | 使える 戦い | 1戦 あたりの 発動 | 使える ときの 勝率 |');
console.log('|---|---|---|---|');
var NOLOG = ['gaman', 'ikari', 'shitsukoi']; // ログに 出ない 技（発動は 数えられない）
S.WAZA.forEach(function (w) { var x = waza[w.id]; console.log('| ' + w.name + (w.learn ? '（覚える）' : '（うまれつき）') + ' | ' + x.battles + ' | ' + (NOLOG.indexOf(w.id) >= 0 ? '（ログ なし）' : x.battles ? (x.fires / x.battles).toFixed(2) : '—') + ' | ' + pct(x.wins, x.battles) + '% |'); });
console.log('\n## キーワードの 発動（自分・でたらめの 戦い 全部で）');
console.log(Object.keys(kwFire).sort().map(function (k) { return k + ' ' + kwFire[k]; }).join('・'));
console.log('\n（' + ((Date.now() - t0) / 1000).toFixed(1) + '秒）');
