// でこもん 作り直しの版 — 札の文が 文字どおりに 動くかの テスト。node tests.js
'use strict';
var S = require('./sim.js');
var C = S.CFG, pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('✕ ' + name); } }
function base(o) { return Object.assign({ hp: 50, atk: 5, def: 0, spd: 5, luck: 0 }, o || {}); }
// 運を 0 に して（会心 3% は 残る）。crit を 消したい ときは CFG を 一時 0 に
function noLuck(fn) { var a = C.critBase, b = C.critPerLuck; C.critBase = 0; C.critPerLuck = 0; try { fn(); } finally { C.critBase = a; C.critPerLuck = b; } }
function P(o, parts, kw) { return { base: base(o), kw: kw || [], parts: parts || [], enemy: false }; }
function E(o, parts, kw) { return { base: base(o), kw: kw || [], parts: parts || [], enemy: true }; }
function hits(res, who) { return res.events.filter(function (e) { return e.t === 'hit' && e.who === who; }); }
function firstHand(res, who) { var out = [], on = false; res.events.forEach(function (e) { if (e.t === 'hand') on = (e.who === who && e.n === 1); else if (on && e.t === 'hit' && e.who === who) out.push(e); }); return out; }
function handHits(res, who, n) { var out = [], on = false; res.events.forEach(function (e) { if (e.t === 'hand') on = (e.who === who && e.n === n); else if (on && e.t === 'hit' && e.who === who) out.push(e); }); return out; }

noLuck(function () {
  // 強さの 計算
  var st = S.statsOf(P({}, ['shell']));
  ok(st.def === C.hardDef && st.hp === 53 && st.atk === 5 + C.heavyAtk && st.spd === 5 + C.heavySpd, 'かたいコウラ：かたい（まもり +2）・おもい（こうげき +2 はやさ −2）・たいりょく +3');
  st = S.statsOf(P({}, ['wing']));
  ok(st.spd === 5 + C.fastSpd && st.luck === 1 && st.dodge === C.dodgeHirari + C.dodgePerLuck * 1, 'はね：はやい（はやさ +3）・ひらり（かいひ +15%）・うん +1');
  st = S.statsOf(E({ luck: 5 }, [], ['yokeru']));
  ok(st.luck === 0 && st.crit === 0 && st.dodge === C.dodgeYokeru, '相手は うんを 持たない・よける 25%');
  ok(S.statsOf(P({ luck: 3 })).crit === 0, '（テスト用に 会心 0）');

  // ふつうの 1げき＝こうげき − まもり（1 より 下がらない）
  var r = S.battle(P({ atk: 5 }), E({ def: 2, atk: 0 }), 1);
  ok(hits(r, 'p')[0].dmg === 3, '1げき＝こうげき − まもり');
  r = S.battle(P({ atk: 1 }), E({ def: 5, atk: 0 }), 1);
  ok(hits(r, 'p')[0].dmg === 1, '1げきは 1 より 下がらない');
  // れんげき：2げき・1げきは 6わり
  r = S.battle(P({ atk: 10, spd: 1 }, ['claw']), E({ atk: 0, spd: 9 }), 1);
  var f = firstHand(r, 'p');
  ok(f.length === 2 && f[0].dmg === Math.round(10 * C.renMult), 'れんげき：2げき、1げきは こうげきの 6わり（ツメ：はやくない ときは 2げき）');
  r = S.battle(P({ atk: 10, spd: 9 }, ['claw']), E({ atk: 0, spd: 1 }), 1);
  ok(firstHand(r, 'p').length === 3, 'ツメ：あいてより はやければ 3げき');
  // ためる：3手ごとに ×2、ツノは まもりを むしする
  r = S.battle(P({ atk: 4 }, ['horn']), E({ atk: 0, def: 3, hp: 200 }), 1);
  var h1 = handHits(r, 'p', 1)[0], h3 = handHits(r, 'p', 3)[0];
  ok(h1.dmg === (4 + C.heavyAtk) - 3 && h3.dmg === (4 + C.heavyAtk) * C.chargeMult && h3.pierce, 'ためる：3手めは ×2・ツノ：ためた 1げきは まもりを むしする');
  // ねらいうち：じょうたいの あいてへ +2（キバで どく → 2手めから）
  r = S.battle(P({ atk: 5 }, ['eye', 'fang'].slice(0, 1)), E({ atk: 0, hp: 200 }), 1);
  ok(handHits(r, 'p', 2)[0].dmg === 6, 'ねらいうち：じょうたい でない あいてには ふえない（ひかるめ こうげき +1）');
  r = S.battle(P({ atk: 5 }, ['eye', 'fang']), E({ atk: 0, hp: 200 }), 1);
  ok(handHits(r, 'p', 1)[0].dmg === 6 && handHits(r, 'p', 2)[0].dmg === 6 + C.neraiPlus, 'ねらいうち：どくの あいてへの 1げき +2');
  // どく：手の おわりに 2・3手。まもりで へらない。キバ：どくの あいてに あてると +1
  r = S.battle(P({ atk: 1 }, ['fang']), E({ atk: 0, def: 9, hp: 200 }), 1);
  var po = r.events.filter(function (e) { return e.t === 'poison' && e.who === 'e'; });
  ok(po[0].dmg === C.poisonDmg && po[1].dmg === C.poisonDmg + 1 && po[2].dmg === C.poisonDmg + 2, 'どく：まもりで へらない・キバ：どくの あいてに あてると どくが +1');
  // へっちゃら
  r = S.battle(P({ atk: 1 }, ['fang']), E({ atk: 0, hp: 200 }, ['fur']), 1);
  ok(r.events.filter(function (e) { return e.t === 'poison'; }).length === 0, 'へっちゃら：どくを うけない');
  // よろけ：つぎの こうげきが ×0.5
  r = S.battle(P({ atk: 1, spd: 9 }, ['tail']), E({ atk: 10, spd: 1, hp: 200 }), 1);
  ok(hits(r, 'e')[0].dmg === 5, 'よろけ：あいての つぎの こうげきが ×0.5');
  // もろく：うける 1げき +2（3手）
  r = S.battle(P({ atk: 3 }, ['crush']), E({ atk: 0, hp: 200 }), 1);
  var c1 = handHits(r, 'p', 1)[0].dmg, c2 = handHits(r, 'p', 2)[0].dmg;
  ok(c2 === c1 + C.brittlePlus, 'もろく：うける 1げき +2');
  // はんげき：ちかくからの 1げきごとに こうげきの 半分。とおくからは うけない
  r = S.battle(P({ atk: 5 }), E({ atk: 6, hp: 200 }, ['spike']), 1);
  var cs = r.events.filter(function (e) { return e.t === 'counter'; });
  ok(cs.length > 0 && cs[0].dmg === 3, 'はんげき：こうげきの 半分で やりかえす');
  r = S.battle(P({ atk: 5 }, ['longleg']), E({ atk: 6, hp: 200 }, ['spike']), 1);
  ok(r.events.filter(function (e) { return e.t === 'counter'; }).length === 0, 'とおくから：はんげきを うけない');
  // かいふく・すいとり
  r = S.battle(P({ hp: 50 }, ['longtail']), E({ atk: 5 }), 1);
  ok(r.events.some(function (e) { return e.t === 'heal' && e.src === 'regen' && e.n === C.regenHeal; }), 'かいふく：じぶんの手の はじめに +2');
  r = S.battle(P({ atk: 9, hp: 50 }, ['leech']), E({ atk: 5, hp: 200 }), 1);
  ok(r.events.some(function (e) { return e.t === 'heal' && e.src === 'leech' && e.n === 3; }), 'すいとり：あたえた 9 の 1/3＝3');
  // おもし：1げきごとに +1
  r = S.battle(P({ atk: 5 }, ['weight']), E({ atk: 0, hp: 200 }), 1);
  ok(firstHand(r, 'p')[0].dmg === 5 + C.heavyAtk + 1, 'おもし：おもい（+2）と 1げきごとに +1');
  // ばねあし：3手ごとに もう1かい
  r = S.battle(P({ atk: 5 }, ['spring']), E({ atk: 0, hp: 500 }), 1);
  ok(handHits(r, 'p', 3).length === 2 && handHits(r, 'p', 2).length === 1, 'ばねあし：3手ごとに もう1かい こうげき');
  // ひっちゅう：よける を やぶる
  var dd = 0, d2 = 0;
  for (var i = 0; i < 40; i++) {
    dd += S.battle(P({ atk: 1 }), E({ atk: 0, hp: 300 }, [], ['yokeru']), i).events.filter(function (e) { return e.t === 'dodge'; }).length;
    d2 += S.battle(P({ atk: 1 }, ['eye']), E({ atk: 0, hp: 300 }, [], ['yokeru']), i).events.filter(function (e) { return e.t === 'dodge'; }).length;
  }
  ok(dd > 50 && d2 === 0, 'よける：よける ことが ある・ひっちゅう：よけられない');
  ok(S.statsOf(E({}, ['wing'])).dodge === C.dodgeHirari, '相手の はね：ひらり（かいひ +15%）は 相手にも 効く');
  var kept = 0, tried = 0;
  for (var q = 0; q < 60; q++) { var rq = S.battle(P({ atk: 2, hp: 20 }), E({ atk: 4, hp: 300 }, [], ['yokeru']), q, { waza: ['kokozo'] });
    var on = false, done = false; rq.events.forEach(function (e) { if (e.t === 'waza' && e.w === 'kokozo') { on = true; } else if (on && !done && e.t === 'hit' && e.who === 'p') { done = true; tried++; if (e.crit) kept++; } }); }
  ok(tried > 0 && kept === tried, 'ここぞ：よけられても さいしょに あたる 1げきが かいしん（' + kept + '/' + tried + '）');
  // おおなぐり：よけられても つぎに あたる 1げきが ×2（Codex P2）
  var okO = true, seenO = 0;
  for (var q2 = 0; q2 < 80; q2++) { var ro = S.battle(P({ atk: 5 }), E({ atk: 0, hp: 500 }, [], ['yokeru']), q2, { waza: ['oonaguri'] });
    var onO = false; ro.events.forEach(function (e) { if (e.t === 'waza' && e.w === 'oonaguri') onO = true; else if (onO && e.t === 'hit' && e.who === 'p') { onO = false; seenO++; if (e.dmg !== 10 && e.dmg !== 20) okO = false; } }); }
  ok(okO && seenO > 0, 'おおなぐり：よけられても つぎに あたる 1げきが ×2');
  // たおれた あとに すいとりで 生きかえらない（Codex P2）
  var revive = 0;
  for (var q3 = 0; q3 < 200; q3++) { var rl = S.battle(P({ atk: 6, hp: 3 }, ['leech']), E({ atk: 1, hp: 300 }, ['spike']), q3); if (rl.events.some(function (e, i) { return e.t === 'heal' && e.who === 'p' && rl.events.slice(0, i).reverse().find(function (x) { return x.to === 'p' && x.hp !== undefined; }) && rl.events.slice(0, i).reverse().find(function (x) { return x.to === 'p' && x.hp !== undefined; }).hp <= 0; })) revive++; }
  ok(revive === 0, 'たおれた あとに すいとりで かいふく しない');
  // 時間ぎれ：のこりの わりあいで（同じなら あいて）
  r = S.battle(P({ atk: 1, hp: 300 }), E({ atk: 1, hp: 300 }), 1);
  ok(r.timeout && r.win === false, '時間ぎれで 同じ わりあい → あいての かち');
  // 技
  r = S.battle(P({ atk: 2, hp: 20 }), E({ atk: 4, hp: 300 }), 1, { waza: ['kokozo'] });
  ok(r.events.some(function (e) { return e.t === 'waza' && e.w === 'kokozo'; }) && r.events.filter(function (e) { return e.t === 'hit' && e.who === 'p' && e.crit; }).length >= 1, 'ここぞ：半分より すくない 最初の手、かならず かいしん');
  r = S.battle(P({ atk: 5 }), E({ atk: 0, hp: 500 }), 1, { waza: ['oonaguri'] });
  ok(handHits(r, 'p', 4)[0].dmg === 10 && handHits(r, 'p', 3)[0].dmg === 5, 'おおなぐり：4手ごとに 1げきめが ×2');
  r = S.battle(P({ atk: 5 }), E({ atk: 0, hp: 500 }), 1, { waza: ['hayauchi'] });
  ok(handHits(r, 'p', 1).length === 2 && handHits(r, 'p', 2).length === 1, 'はやうち：さいしょの じぶんの手は 2かい こうげき');
  r = S.battle(P({ atk: 5 }), E({ atk: 0, hp: 500 }), 1, { waza: ['renda'] });
  ok(handHits(r, 'p', 4).length === 2, 'れんだ：4手ごとに もう1かい');
  r = S.battle(P({ atk: 5, hp: 10 }), E({ atk: 1, hp: 500 }), 1, { waza: ['ikari'] });
  ok(r.events.filter(function (e) { return e.t === 'hit' && e.who === 'p'; }).some(function (e) { return e.dmg === 7; }), 'いかり：半分より すくないと こうげき +2');
  r = S.battle(P({ atk: 5, hp: 40 }), E({ atk: 2, hp: 500 }), 1, { waza: ['gaman'] });
  ok(handHits(r, 'p', 2)[0].dmg === 6, 'がまん：1げき うけたら つぎの こうげきの 1げき +1');
  r = S.battle(P({ hp: 40 }), E({ atk: 2, hp: 500 }), 1, { waza: ['hitoiki'] });
  ok(r.events.some(function (e) { return e.t === 'heal' && e.src === 'hitoiki'; }), 'ひといき：4手ごとに たいりょく +3');
});
// 会心：うんで 出る（×2）
var cr = 0, n = 0;
for (var j = 0; j < 200; j++) { var rr = S.battle(P({ atk: 5, luck: 10 }), E({ atk: 0, hp: 500 }), j); hits(rr, 'p').forEach(function (h) { n++; if (h.crit) { cr++; } }); }
ok(cr / n > 0.15 && cr / n < 0.31, 'かいしん％＝3＋うん×2（うん 10 で 23%）：' + (100 * cr / n).toFixed(1) + '%');

// 周回：ハート 3・負けたら 同じ 分かれ道・0 で おわり
var run = S.newRun(5, 'koron');
ok(run.hearts === 3 && run.owned.length === 3 && run.equip.atk && run.equip.def && run.equip.mov, 'はじめは ハート 3・もちもの 3（役割ごと）');
var fk = JSON.stringify(run.fork);
run.stats.hp = 1; run.stats.atk = 0;
var o = S.fight(run, 0, run.equip);
ok(!o.win && run.hearts === 2 && JSON.stringify(run.fork) === fk && o.reason && o.reason.text, '負けたら ハート −1・同じ 分かれ道・理由が 1つ');
S.fight(run, 0, run.equip); S.fight(run, 1, run.equip);
ok(run.hearts === 0 && run.over && !run.clear, 'ハート 0 で 周回 おわり');
var run2 = S.newRun(6, 'doshin'); run2.stats.atk = 99; run2.stats.hp = 999;
var w = S.fight(run2, 0, run2.equip);
ok(w.win && run2.wins === 1 && w.reward.length === (w.road.hard ? 2 : 1) && w.level && run2.fork.stage === 2, '勝つと もらえる（てごわいは 2つ）・レベルアップ・つぎの 分かれ道');
for (var k = 0; k < 9; k++) S.fight(run2, 0, run2.equip);
ok(run2.clear && run2.over && run2.history[9].e === 'boss', '10戦目は ぬし・勝てば クリア');
// 同じ 種で 同じ 結果（画面と ボットが そろう）
var a1 = S.newRun(77, 'pyun'), a2 = S.newRun(77, 'pyun');
var x1 = S.fight(a1, 1, a1.equip), x2 = S.fight(a2, 1, a2.equip);
ok(JSON.stringify(x1.res.events) === JSON.stringify(x2.res.events), '同じ 種で 同じ 戦い');
// パーツの 数・キーワードの 数
ok(S.PARTS.length === 16 && S.ENEMIES.length === 10, 'パーツ 16・相手 10');
ok(S.PARTS.every(function (p) { return p.kw.every(function (k) { return !!S.KW_BY_ID[k]; }); }), 'パーツの キーワードは 一覧に ある');
console.log((fail ? '✕ ' : '○ ') + pass + '/' + (pass + fail) + ' 一致');
process.exit(fail ? 1 : 0);
