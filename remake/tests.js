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
  ok(st.def === C.hardDef && st.hp === 51 && st.atk === 5 + C.heavyAtk && st.spd === 5 + C.heavySpd, 'かたいコウラ：かたい（まもり +2）・おもい（こうげき +2 はやさ −2）・たいりょく +1（10-31 強さ合わせ その4）');
  st = S.statsOf(P({}, ['wing']));
  ok(st.spd === 5 + C.fastSpd && st.luck === 2 && st.dodge === C.dodgeHirari + C.dodgePerLuck * 2 && st.crit === C.critBase + C.critPerLuck * 2, 'はね：はやい（はやさ +3）・ひらり（かいひ +15%）・うん +2（10-31 強さ合わせ その10：+1 → +2）');
  st = S.statsOf(E({}, ['wing']));
  ok(st.luck === 0 && st.dodge === C.dodgeHirari && st.crit === 0, 'はね：相手が もっても うんは 0（相手は うんを 持たない＝ツノジカは 前と 同じ）');
  st = S.statsOf(P({}, ['tail']));
  ok(st.atk === 5 && st.spd === 5 + 1 && st.luck === 0 && st.kw.stagger && !st.kw.heavy, 'ふといしっぽ：よろけ・はやさ +1（おもいは ない。11-01 強さ合わせ その13）');
  ok(S.PART_BY_ID.tail.kw.join() === 'stagger', 'ふといしっぽ：キーワードは よろけ だけ');
  // カゲネコ：生まれつき おもい ＋ ふといしっぽ で 前（しっぽが おもい）と 同じ 強さ（段階 1・10、てごわいも）
  [1, 10].forEach(function (s) { [false, true].forEach(function (hd) {
    var ci = S.ENEMIES.findIndex(function (e) { return e.id === 'cat'; });
    var now = S.statsOf(S.enemySrc(ci, s, hd));
    var old = S.statsOf({ base: S.enemyBase(ci, s, hd), kw: ['yokeru'], parts: ['fang'], enemy: true }); old.atk += C.heavyAtk; old.spd = Math.max(0, old.spd + C.heavySpd + 1);
    ok(now.atk === old.atk && now.spd === old.spd && now.hp === old.hp && now.def === old.def && now.dodge === old.dodge && now.kw.heavy && now.kw.stagger, 'カゲネコ：段階' + s + (hd ? '・てごわい' : '') + ' は 前と 同じ（こうげき ' + now.atk + '・はやさ ' + now.spd + '）');
  }); });
  st = S.statsOf(S.enemySrc(S.ENEMIES.findIndex(function (e) { return e.id === 'bird'; }), 1, false));
  var stOld = S.statsOf({ base: S.enemyBase(S.ENEMIES.findIndex(function (e) { return e.id === 'bird'; }), 1, false), kw: ['yokeru'], parts: [], enemy: true });
  ok(S.ENEMY_BY_ID.bird.atk === 2 && st.atk === stOld.atk + 3 + 2, 'ヤリドリ：ながいあし +3・ひかるめ +2（もとの こうげき 2。10-31 その7 で 4 → 3・その11 で 3 → 2）');
  // 段階1の ヤリドリの こうげきは 前（もと 4・ひかるめ +1）と 同じ 7（はじめての 1戦目を きつく しない）
  ok(st.atk === 7, 'ヤリドリ：段階1の こうげきは 前と 同じ 7（' + st.atk + '）');
  st = S.statsOf(E({}, ['tail']));
  ok(st.atk === 5 && st.spd === 5 + 1, 'ふといしっぽ：相手が もっても 同じ（はやさ +1）');
  st = S.statsOf(P({}, ['longleg']));
  ok(st.atk === 5 + 3 && st.spd === 5 && st.hp === 50, 'ながいあし：こうげき +3（はやさは かわらない。10-30 その3 で +2・10-31 その11 で +3）');
  // 数字の ひとこと（bonus）は 札の 2行目と 同じ（文字どおり）
  var STN = { hp: 'たいりょく', atk: 'こうげき', def: 'まもり', spd: 'はやさ', luck: 'うん' };
  S.PARTS.forEach(function (p) { if (!p.bonus) return;
    var want = Object.keys(p.bonus).map(function (k) { return STN[k] + ' +' + p.bonus[k]; }).join('・');
    ok(p.line === want, p.name + '：2行目「' + p.line + '」は 中身（' + want + '）と 同じ'); });
  st = S.statsOf(E({ luck: 5 }, [], ['yokeru']));
  ok(st.luck === 0 && st.crit === 0 && st.dodge === C.dodgeYokeru, '相手は うんを 持たない・よける 25%');
  ok(S.statsOf(P({ luck: 3 })).crit === 0, '（テスト用に 会心 0）');

  // ふつうの 1げき＝こうげき − まもり（1 より 下がらない）
  var r = S.battle(P({ atk: 5 }), E({ def: 2, atk: 0 }), 1);
  ok(hits(r, 'p')[0].dmg === 3, '1げき＝こうげき − まもり');
  r = S.battle(P({ atk: 1 }), E({ def: 5, atk: 0 }), 1);
  ok(hits(r, 'p')[0].dmg === 1, '1げきは 1 より 下がらない');
  // れんげき：2げき・1げきは 7わり
  r = S.battle(P({ atk: 10, spd: 1 }, ['claw']), E({ atk: 0, spd: 9 }), 1);
  var f = firstHand(r, 'p');
  ok(f.length === 2 && f[0].dmg === 7 && f[0].dmg === Math.round(10 * C.renMult), 'れんげき：2げき、1げきは こうげきの 7わり（ツメ：はやくない ときは 2げき）');
  ok(S.KW_BY_ID.ren.text() === 'こうげきが 2げきに なる（1げきは こうげきの 7わり）', 'れんげきの 文の「7わり」は CFG.renMult と 同じ（文字どおり）');
  ok(Math.abs(C.renMult * 10 - Math.round(C.renMult * 10)) < 1e-9, 'CFG.renMult は 0.1 きざみ（文の「○わり」と 動きが ずれない）');
  r = S.battle(P({ atk: 4, spd: 1 }, ['claw']), E({ atk: 0, spd: 9 }), 1); f = firstHand(r, 'p');
  ok(f.length === 2 && f[0].dmg + f[1].dmg === 6, 'れんげき：こうげき 4 なら 3＋3（1げきより 多い。0.6 の ときは 2＋2 で ふえなかった）');
  r = S.battle(P({ atk: 10, spd: 9 }, ['claw']), E({ atk: 0, spd: 1 }), 1);
  ok(firstHand(r, 'p').length === 3, 'ツメ：あいてより はやければ 3げき');
  // ためる：3手ごとに ×2、ツノは まもりを むしする
  r = S.battle(P({ atk: 4 }, ['horn']), E({ atk: 0, def: 3, hp: 200 }), 1);
  var h1 = handHits(r, 'p', 1)[0], h3 = handHits(r, 'p', 3)[0];
  ok(h1.dmg === 4 - 3 && h3.dmg === 4 * C.chargeMult && h3.pierce, 'ためる：3手めは ×2・ツノ：ためた 1げきは まもりを むしする');
  // 10-31 強さ合わせ その8：ツノの キーワードは「ためる」だけ（おもい なし）。もつ 相手（ツノジカ・ぬし）は 生まれつき おもい で 前と 同じ 強さ
  st = S.statsOf(P({}, ['horn']));
  ok(S.PART_BY_ID.horn.kw.join() === 'charge' && st.atk === 5 && st.spd === 5, 'ツノ：キーワードは ためる だけ（こうげき・はやさは かわらない）');
  ['deer', 'boss'].forEach(function (id) {
    var idx = id === 'boss' ? 'boss' : S.ENEMIES.findIndex(function (e) { return e.id === id; }), d = S.ENEMY_BY_ID[id];
    [1, 10].forEach(function (s) {
      var now = S.statsOf(S.enemySrc(idx, s, true));
      // 前の 形：ツノが「ためる・おもい」、相手の 生まれつきに おもい なし
      var hk = S.PART_BY_ID.horn.kw; S.PART_BY_ID.horn.kw = ['charge', 'heavy'];
      var old = S.statsOf({ base: S.enemyBase(idx, s, true), kw: d.kw.filter(function (k) { return k !== 'heavy'; }), parts: d.parts, enemy: true });
      S.PART_BY_ID.horn.kw = hk;
      ok(d.kw.indexOf('heavy') >= 0 && now.atk === old.atk && now.spd === old.spd && now.hp === old.hp && now.def === old.def, d.name + '：生まれつき おもい で 前と 同じ（段階' + s + '・こうげき ' + now.atk + '・はやさ ' + now.spd + '）');
    });
  });
  // ねらいうち：じょうたいの あいてへ +2（キバで どく → 2手めから）
  r = S.battle(P({ atk: 5 }, ['eye', 'fang'].slice(0, 1)), E({ atk: 0, hp: 200 }), 1);
  ok(handHits(r, 'p', 2)[0].dmg === 5 + S.PART_BY_ID.eye.bonus.atk, 'ねらいうち：じょうたい でない あいてには ふえない（ひかるめ こうげき +' + S.PART_BY_ID.eye.bonus.atk + '）');
  r = S.battle(P({ atk: 5 }, ['eye', 'fang']), E({ atk: 0, hp: 200 }), 1);
  ok(handHits(r, 'p', 1)[0].dmg === 5 + S.PART_BY_ID.eye.bonus.atk && handHits(r, 'p', 2)[0].dmg === 5 + S.PART_BY_ID.eye.bonus.atk + C.neraiPlus, 'ねらいうち：どくの あいてへの 1げき +2');
  // どく：手の おわりに 2・3手。まもりで へらない。キバ：あてる たびに どくが +3（はじめの 1げきから）
  r = S.battle(P({ atk: 1 }, ['fang']), E({ atk: 0, def: 9, hp: 200 }), 1);
  var po = r.events.filter(function (e) { return e.t === 'poison' && e.who === 'e'; });
  ok(C.fangPlus === 3 && po[0].dmg === C.poisonDmg + 3 && po[1].dmg === C.poisonDmg + 6 && po[2].dmg === C.poisonDmg + 9, 'どく：まもりで へらない・キバ：あてる たびに どくの ダメージ +3');
  ok(S.PART_BY_ID.fang.line === 'あてる たびに どくの ダメージ +' + C.fangPlus, 'キバの 2行目は 中身（+' + C.fangPlus + '）と 同じ');
  // キバ なしの どく（キーワード だけ）は ふえない：何回 あてても 2
  r = S.battle(P({ atk: 1 }, [], ['poison']), E({ atk: 0, def: 9, hp: 200 }), 1);
  po = r.events.filter(function (e) { return e.t === 'poison' && e.who === 'e'; });
  ok(po.length >= 3 && po.slice(0, 3).every(function (e) { return e.dmg === C.poisonDmg; }), 'キバ なしの どくは ふえない（' + C.poisonDmg + ' の まま）');
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
  // いしのうろこ（11-01 強さ合わせ その14）：1げき うけるたび まもり +1（+3 まで）。はんげきも 1げき。強さの 数字（st.def）は かえない
  ok(S.PART_BY_ID.scale.line === '1げき うけるたび まもり +1（+' + C.scaleMax + ' まで）' && C.scaleMax === 3 && !S.PART_BY_ID.scale.bonus, 'いしのうろこ：2行目は 中身（+1・+' + C.scaleMax + ' まで）と 同じ');
  r = S.battle(P({ atk: 1, hp: 300, spd: 1 }, ['scale']), E({ atk: 10, hp: 300, spd: 9 }), 1);
  var sh = hits(r, 'e').slice(0, 5).map(function (e) { return e.dmg; });
  ok(sh.join() === [8, 7, 6, 5, 5].join(), 'いしのうろこ：うけるたび まもり +1、+3 で とまる（' + sh.join() + '）');
  ok(r.events.filter(function (e) { return e.t === 'kw' && e.kw === 'scaleStack' && e.who === 'p'; }).map(function (e) { return e.n; }).join() === '1,2,3', 'いしのうろこ：ログは 1・2・3 の 3回だけ');
  ok(r.pSt.def === C.hardDef && S.statsOf(P({}, ['scale'])).def === C.hardDef, 'いしのうろこ：強さの まもりは かたいの +2 だけ（戦いの あとも かわらない）');
  r = S.battle(P({ atk: 1, hp: 300, spd: 9 }, ['scale']), E({ atk: 10, hp: 300, spd: 1 }, ['spike']), 1);
  cs = r.events.filter(function (e) { return e.t === 'counter'; });
  ok(cs[0].dmg === 3 && hits(r, 'e')[0].dmg === 7 && cs[1].dmg === 1, 'いしのうろこ：はんげきも 1げき（うけると まもり +1。3 → 7 → 1）');
  var ci0 = r.events.findIndex(function (e) { return e.t === 'counter'; }), si0 = r.events.findIndex(function (e) { return e.t === 'kw' && e.kw === 'scaleStack'; });
  ok(ci0 >= 0 && si0 === ci0 + 1, 'いしのうろこ：はんげきを うけた あとに かたく なる（ログの 順）');
  r = S.battle(P({ atk: 1, hp: 300, spd: 1 }, ['scale']), E({ atk: 10, hp: 300, spd: 9 }), 1, { waza: ['teppeki'] });
  sh = hits(r, 'e').slice(0, 3).map(function (e) { return e.dmg; });
  ok(sh.join() === '1,7,6', 'いしのうろこ＋てっぺき：さいしょは 1、そのあとも うろこが たまる（' + sh.join() + '）');
  r = S.battle(P({ atk: 1, hp: 8, spd: 1 }, ['scale']), E({ atk: 10, hp: 300, spd: 9 }), 1);
  ok(!r.win && r.events.filter(function (e) { return e.t === 'kw' && e.kw === 'scaleStack'; }).length === 0, 'いしのうろこ：たおれた 1げきでは かたく ならない');
  r = S.battle(P({ atk: 20, hp: 300, spd: 1 }, ['horn']), E({ atk: 10, hp: 900, spd: 9 }, ['scale']), 1);
  var hc = hits(r, 'p').filter(function (e) { return e.charged; })[0];
  ok(hc && hc.pierce && hc.dmg === Math.round(20 * C.chargeMult), 'ツノの ためた 1げきは うろこで ふえた まもりも むしする');
  // ヒカリクラゲ・ぬし：うろこを 外して 生まれつき かたい・もとの まもり 0 → 1 で 前（うろこ：かたい・まもり +1）と 同じ 強さ（段階 1・10、てごわいも）
  ['jelly', 'boss'].forEach(function (id) { [1, 10].forEach(function (s2) { [false, true].forEach(function (hd) {
    var ix = id === 'boss' ? 'boss' : S.ENEMIES.findIndex(function (e) { return e.id === id; });
    var now = S.statsOf(S.enemySrc(ix, s2, hd));
    ok(S.enemyDef(ix).def === 1 && S.enemyDef(ix).parts.indexOf('scale') < 0 && now.kw.hard && !now.specials.scaleStack && now.def === Math.floor((s2 - 1) / C.stageDefEvery) + 1 + C.hardDef, id + '：段階' + s2 + (hd ? '・てごわい' : '') + ' の まもりは 前と 同じ（' + now.def + '）');
  }); }); });
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
  r = S.battle(P({ atk: 5, hp: 60 }), E({ atk: 2, hp: 500 }, ['spike']), 1, { waza: ['gaman'] });
  // 1手め：こうげき 1げき → はんげきを 1げき うける。あいての こうげきで もう 1げき。2手めは +2
  ok(handHits(r, 'p', 2)[0].dmg === 5 + 2 - 1, 'がまん：はんげきで うけた 1げきも 数える（まもり +1 の トゲ）');
  r = S.battle(P({ atk: 1, hp: 60, spd: 9 }, ['crush', 'spike']), E({ atk: 1, hp: 500, spd: 1 }), 1);
  var cc = r.events.filter(function (e) { return e.t === 'counter' && e.who === 'p'; });
  ok(cc.length > 0 && cc[0].dmg === Math.round((1 + 1 + C.heavyAtk) * C.counterRatio) + C.brittlePlus, 'はんげきも 1げき：もろい あいてへ +2');
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
ok(w.win && run2.wins === 1 && w.reward.length === (w.road.hard ? 2 : 1) && (C.hira.on ? (!!w.hira === !!w.level) : !!w.level) && run2.fork.stage === 2, '勝つと もらえる（てごわいは 2つ）・ひらめいたら レベルアップ・つぎの 分かれ道');
for (var k = 0; k < 9; k++) S.fight(run2, 0, run2.equip);
ok(run2.clear && run2.over && run2.history[9].e === 'boss', '10戦目は ぬし・勝てば クリア');
// 同じ 種で 同じ 結果（画面と ボットが そろう）
var a1 = S.newRun(77, 'pyun'), a2 = S.newRun(77, 'pyun');
var x1 = S.fight(a1, 1, a1.equip), x2 = S.fight(a2, 1, a2.equip);
ok(JSON.stringify(x1.res.events) === JSON.stringify(x2.res.events), '同じ 種で 同じ 戦い');
// パーツの 数・キーワードの 数
ok(S.PARTS.length === 16 && S.ENEMIES.length === 10, 'パーツ 16・相手 10');
ok(S.PARTS.every(function (p) { return p.kw.every(function (k) { return !!S.KW_BY_ID[k]; }); }), 'パーツの キーワードは 一覧に ある');

// ---------- その2：ひらめきで 覚える 技（札の 文 どおり） ----------
function hasW(res, who, w) { return res.events.some(function (e) { return e.t === 'waza' && e.who === who && e.w === w; }); }
noLuck(function () {
  var D = C.dodgePerLuck; C.dodgePerLuck = 0;
  try {
    // ちからこめ：4手ごとに つぎに あたる 1げき +3
    var r = S.battle(P({ atk: 5 }), E({ atk: 0, hp: 300 }), 1, { waza: ['chikara'] });
    ok(handHits(r, 'p', 3)[0].dmg === 5 && handHits(r, 'p', 4)[0].dmg === 8 && hasW(r, 'p', 'chikara'), 'ちからこめ：4手めの 1げき +3');
    // かけぬけ：あいてより はやければ 1げき +1（おそい ときは ふえない）
    r = S.battle(P({ atk: 5, spd: 9 }), E({ atk: 0, spd: 1, hp: 300 }), 1, { waza: ['kakenuke'] });
    var r0 = S.battle(P({ atk: 5, spd: 1 }), E({ atk: 0, spd: 9, hp: 300 }), 1, { waza: ['kakenuke'] });
    ok(hits(r, 'p')[0].dmg === 6 && hits(r0, 'p')[0].dmg === 5, 'かけぬけ：はやければ 1げき +1');
    // とどめ：あいての たいりょくが 半分より すくないと 1げき +2
    r = S.battle(P({ atk: 10 }), E({ atk: 0, hp: 30 }), 1, { waza: ['todome'] });
    var th = hits(r, 'p'); // 30 → 20 → 10（半分より すくない）→ 12
    ok(th[0].dmg === 10 && th[1].dmg === 10 && th[2].dmg === 12, 'とどめ：あいてが 半分より すくないと +2');
    // しつこい：あてた どく・もろいが 1手 ながく（どく 3 → 4手・もろい 3 → 4手）
    var stN = function (res, st) { var e = res.events.filter(function (x) { return x.t === 'status' && x.st === st; })[0]; return e && e.n; };
    r = S.battle(P({ atk: 1 }, ['fang']), E({ atk: 0, hp: 300 }), 1, { waza: ['shitsukoi'] }); r0 = S.battle(P({ atk: 1 }, ['fang']), E({ atk: 0, hp: 300 }), 1, {});
    ok(stN(r, 'poison') === C.poisonHands + 1 && stN(r0, 'poison') === C.poisonHands, 'しつこい：どくが 1手 ながい');
    r = S.battle(P({ atk: 1 }, ['crush']), E({ atk: 0, hp: 300 }), 1, { waza: ['shitsukoi'] }); r0 = S.battle(P({ atk: 1 }, ['crush']), E({ atk: 0, hp: 300 }), 1, {});
    ok(stN(r, 'brittle') === C.brittleHands + 1 && stN(r0, 'brittle') === C.brittleHands, 'しつこい：もろいが 1手 ながい');
    // ふいうち：さいしょに あたる 1げき +3
    r = S.battle(P({ atk: 5 }), E({ atk: 0, hp: 300 }), 1, { waza: ['fuiuchi'] });
    ok(handHits(r, 'p', 1)[0].dmg === 8 && handHits(r, 'p', 2)[0].dmg === 5, 'ふいうち：さいしょに あたる 1げき +3');
    // てっぺき：さいしょに うける 1げきは 1（はんげきでも）
    r = S.battle(P({ atk: 0, spd: 1, hp: 300 }), E({ atk: 9, spd: 9, hp: 300 }), 1, { waza: ['teppeki'] });
    var eh = hits(r, 'e'); ok(eh[0].dmg === 1 && eh[1].dmg === 9, 'てっぺき：さいしょに うける 1げきは 1 ダメージ');
    r = S.battle(P({ atk: 5, spd: 9, hp: 300 }), E({ atk: 10, spd: 1, hp: 300 }, ['spike']), 1, { waza: ['teppeki'] });
    var cs = r.events.filter(function (e) { return e.t === 'counter'; });
    ok(cs[0].dmg === 1 && hits(r, 'e')[0].dmg === 10, 'てっぺき：さいしょが はんげきでも 1（つぎの 1げきは ふつう）');
    // ふっかつ：たいりょくが 半分より すくない 最初の手の はじめに +5（1かいだけ）
    r = S.battle(P({ atk: 0, hp: 20 }), E({ atk: 6, hp: 300 }), 1, { waza: ['fukkatsu'] });
    var fk = r.events.filter(function (e) { return e.t === 'heal' && e.src === 'fukkatsu'; });
    ok(fk.length === 1 && fk[0].n === 5, 'ふっかつ：半分より すくない 最初の手に たいりょく +5（1かい）');
    // みかわし：よけるたび +2
    C.dodgePerLuck = D;
    r = S.battle(P({ atk: 0, hp: 40 }, ['wing']), E({ atk: 3, hp: 300 }), 3, { waza: ['mikawashi'] });
    var dg = r.events.filter(function (e) { return e.t === 'dodge' && e.who === 'p'; }).length, mh = r.events.filter(function (e) { return e.t === 'waza' && e.w === 'mikawashi'; }).length;
    ok(dg > 0 && dg === mh, 'みかわし：よけるたび（' + dg + 'かい）');
    var mhe = r.events.filter(function (e) { return e.t === 'heal' && e.src === 'mikawashi'; });
    ok(mhe.length > 0 && mhe.every(function (e) { return e.n > 0 && e.n <= 2; }) && mhe.some(function (e) { return e.n === 2; }), 'みかわし：たいりょく +2（満タンの ときは ふえない）');
    C.dodgePerLuck = 0;
    // ふっかつは かいふく より 先に 見る（ながいしっぽ）
    r = S.battle(P({ atk: 0, hp: 20, spd: 1 }, ['longtail']), E({ atk: 12, spd: 9, hp: 300 }), 1, { waza: ['fukkatsu'] }); // 22 → 10、かいふくで 12（前の 順なら 出ない）
    ok(r.events.some(function (e) { return e.t === 'heal' && e.src === 'fukkatsu'; }), 'ふっかつ：かいふくの パーツでも 出る（かいふくより 先）');
    // ログで 見える：かけぬけ・とどめ・ふいうち・ちからこめ は のった 1げきに 印
    r = S.battle(P({ atk: 10, spd: 9 }), E({ atk: 0, spd: 1, hp: 30 }), 1, { waza: ['kakenuke', 'todome', 'fuiuchi'] });
    var hh = hits(r, 'p');
    ok(hh[0].wz.indexOf('kakenuke') >= 0 && hh[0].wz.indexOf('fuiuchi') >= 0 && hh[0].wz.indexOf('todome') < 0 && hh[hh.length - 1].wz.indexOf('todome') >= 0, 'かけぬけ・とどめ・ふいうち：のった 1げきの ログに 印');
  } finally { C.dodgePerLuck = D; }
});
// 技を 使える 条件：その キーワードの パーツを つけて いる ときだけ
var rr = S.newRun(11, 'koron'); rr.learned = ['teppeki', 'chikara'];
var wz1 = S.wazaFor(rr, { atk: 'weight', def: null, mov: null }), wz2 = S.wazaFor(rr, { atk: 'eye', def: 'scale', mov: null });
ok(wz1.indexOf('chikara') >= 0 && wz1.indexOf('teppeki') < 0 && wz2.indexOf('teppeki') >= 0 && wz2.indexOf('chikara') < 0 && wz1.indexOf('kokozo') >= 0, '覚えた 技は その キーワードの パーツで だけ 使える（うまれつきは いつでも）');
ok(S.LEARN.length === 8 && Object.keys(S.LEARN_BY_KW).length === 16 && S.PARTS.every(function (p) { return p.kw.every(function (k) { return S.LEARN_BY_KW[k]; }); }), '覚える 技 8つで パーツの キーワード 16 を 全部 おおう');
// なれ：つけた パーツの キーワードごとに +1・てごわい +2・満タンで かならず ひらめく
var hr = S.newRun(12, 'gotsun'); hr.equip = { atk: 'weight', def: null, mov: null };
S.addNare(hr, false); ok(hr.nare.heavy === 1, 'なれ：つけた キーワードに +1');
S.addNare(hr, true); ok(hr.nare.heavy === 3, 'なれ：てごわい +2（満タン 3）');
S.addNare(hr, true); ok(hr.nare.heavy === 3, 'なれ：満タンを こえない');
var hz = S.hirameki(hr, { hard: false });
ok(hz === 'chikara' && hr.learned[0] === 'chikara' && hr.nare.heavy === 0 && hr.nare.charge === 0, '満タンなら かならず ひらめく（なれは 0）');
ok(S.hirameki(hr, { hard: false }) === null, 'もう 覚えた 技の キーワードしか ないと ひらめかない');
var lv = S.levelUp(hr, 'def'); ok(lv.def === 1, 'ひらめいた 技の ステータス（てっぺき＝まもり）は かならず +1');
// ひらめきの 成長：5能力とも +1（対応する 能力と、種類の 成長率で 上がる 能力）
var hiraGrowthCases = [
  { w: 'chikara', part: 'weight', kw: 'heavy', stat: 'atk' },
  { w: 'kakenuke', part: 'claw', kw: 'ren', stat: 'spd' },
  { w: 'todome', part: 'eye', kw: 'nerai', stat: 'atk' },
  { w: 'shitsukoi', part: 'fang', kw: 'poison', stat: 'luck' },
  { w: 'fuiuchi', part: 'longleg', kw: 'ranged', stat: 'spd' },
  { w: 'teppeki', part: 'scale', kw: 'hard', stat: 'def' },
  { w: 'fukkatsu', part: 'longtail', kw: 'regen', stat: 'hp' },
  { w: 'mikawashi', part: 'fur', kw: 'immune', stat: 'luck' }
];
S.SPECIES.forEach(function (sp) {
  [1, 2].forEach(function (seed) {
    hiraGrowthCases.forEach(function (c) {
      var gr = S.newRun(seed, sp.id), eq = { atk: null, def: null, mov: null };
      eq[S.PART_BY_ID[c.part].role] = c.part; gr.owned = [c.part]; gr.nare[c.kw] = C.hira.nareMax;
      gr.stats.hp = 999; gr.stats.atk = 999;
      var before = Object.assign({}, gr.stats), out = S.fight(gr, 0, eq);
      ok(out.win && out.hira === c.w && out.level && out.level[c.stat] === 1 &&
        S.STATS.every(function (s) { var up = out.level[s.id] || 0; return (up === 0 || up === 1) && gr.stats[s.id] - before[s.id] === up; }) &&
        gr.levels.length === 1 && JSON.stringify(gr.levels[0]) === JSON.stringify(out.level),
        sp.name + '・seed ' + seed + '・' + c.w + '：対応する 能力は +1、ほかの 成長も +1（保存する 値と 同じ）');
    });
  });
});
// 同じ seed の 旧モードは HP +2 の まま。切り替えても 成長する 能力と、HP 以外の 増分は 同じ
var growthOn = C.hira.on;
try {
  S.SPECIES.forEach(function (sp) {
    var onRun = S.newRun(2, sp.id), offRun = S.newRun(2, sp.id);
    onRun.stats.hp = offRun.stats.hp = 999; onRun.stats.atk = offRun.stats.atk = 999;
    var eq = { atk: null, def: 'longtail', mov: null }; onRun.nare.regen = C.hira.nareMax;
    C.hira.on = true; var onOut = S.fight(onRun, 0, eq);
    C.hira.on = false; var offOut = S.fight(offRun, 0, eq);
    ok(onOut.hira === 'fukkatsu' && onOut.level.hp === 1 && offOut.win && !offOut.hira && offOut.level.hp === C.hpUp &&
      offRun.stats.hp === 999 + C.hpUp && S.STATS.every(function (s) { return s.id === 'hp' || onOut.level[s.id] === offOut.level[s.id]; }),
      sp.name + '：ひらめきは HP +1、旧モードは HP +' + C.hpUp + '（ほかの 成長は 同じ）');
  });
} finally { C.hira.on = growthOn; }
// ひらめきの 確率は 画面と 同じ パーツ込みの うん（はね うん +2）
var oc = C.hira.chance, op = C.hira.perLuck; C.hira.chance = 0; C.hira.perLuck = 1;
var lk = S.newRun(14, 'koron'); lk.stats.luck = 0; lk.equip = { atk: null, def: null, mov: 'wing' };
var lk2 = S.newRun(14, 'koron'); lk2.stats.luck = 0; lk2.equip = { atk: null, def: null, mov: 'longleg' };
var g1 = S.hirameki(lk, { hard: false }), g2 = S.hirameki(lk2, { hard: false });
C.hira.chance = oc; C.hira.perLuck = op;
ok(g1 && !g2, 'ひらめき：はねの うん（+2）も 確率に 入る（画面の うんと 同じ）');
// 前の 保存（その1）：nare・learned が なくても 戦える
var old = S.newRun(13, 'pyun'); delete old.nare; delete old.learned;
var oo = S.fight(old, 0, old.equip); ok(oo && Array.isArray(old.learned) && typeof old.nare === 'object', '前の 保存（nare・learned なし）でも 戦える');
// ひらめきの ない 勝ちでは レベルアップしない／off なら 勝つたび
C.hira.on = false; var of = S.newRun(6, 'doshin'); of.stats.atk = 99; of.stats.hp = 999; var ow = S.fight(of, 0, of.equip); C.hira.on = true;
ok(ow.win && ow.level && !ow.hira, 'CFG.hira.on＝false：その1 の まま 勝つたび レベルアップ');
// ---------- その2 の 2つ目：自由枠（CFG.free） ----------
var fr = S.newRun(21, 'gotsun'); fr.owned = ['horn', 'eye', 'shell', 'wing', 'claw', 'scale'];
fr.wins = C.free.at - 1; ok(!S.freeOpen(fr) && S.slotCount(fr) === 3, '自由枠：' + (C.free.at - 1) + 'しょうでは まだ ひらかない（枠 3）');
fr.wins = C.free.at; ok(S.freeOpen(fr) && S.slotCount(fr) === 4, '自由枠：' + C.free.at + 'しょうで ひらく（枠 4）');
var ce = S.cleanEquip(fr, { atk: 'horn', def: 'shell', mov: 'wing', free: 'eye' });
ok(ce.free === 'eye' && S.equipList(ce).length === 4, '自由枠：せめを 2つ（ツノ＋ひかるめ）つけられる');
ok(S.cleanEquip(fr, { atk: 'horn', def: 'shell', mov: 'wing', free: 'horn' }).free === null, '自由枠：ほかの 枠と 同じ パーツは 入らない');
ok(S.cleanEquip(fr, { atk: 'shell', def: 'scale', mov: 'wing', free: 'fang' }).atk === null && S.cleanEquip(fr, { atk: 'horn', free: 'fang' }).free === null, '役割の 枠は その 役割だけ・もって いない パーツは 入らない');
fr.wins = C.free.at - 1; ok(!('free' in S.cleanEquip(fr, { atk: 'horn', free: 'eye' })), '自由枠：ひらく まえは 4つ目を すてる');
// 4つ目の パーツの つよさが 戦いに 入る（ひかるめ こうげき +2。10-31 強さ合わせ その7）
fr.wins = C.free.at;
var st3 = S.statsOf(S.playerSrc(fr, { atk: 'horn', def: 'shell', mov: 'wing' })), st4 = S.statsOf(S.playerSrc(fr, { atk: 'horn', def: 'shell', mov: 'wing', free: 'eye' }));
ok(st4.atk === st3.atk + S.PART_BY_ID.eye.bonus.atk && S.PART_BY_ID.eye.bonus.atk === 2, '自由枠の パーツの ボーナスも 入る（ひかるめ こうげき +2）');
// 覚えた 技で 使えるのは 枠の 数まで（覚えた 順）
var wc = S.newRun(22, 'koron'); wc.owned = ['horn', 'eye', 'shell', 'wing']; wc.learned = ['chikara', 'teppeki', 'kakenuke', 'mikawashi', 'todome'];
var born = S.SPECIES_BY_ID.koron.waza.length;
var w3 = S.wazaFor(wc, { atk: 'horn', def: 'shell', mov: 'wing' });
ok(w3.length === born + 3 && w3.slice(born).join() === 'chikara,teppeki,kakenuke', '枠 3：覚えた 技は 3つまで（覚えた 順。4つ 使える 形でも）');
wc.wins = C.free.at;
var w4 = S.wazaFor(wc, { atk: 'horn', def: 'shell', mov: 'wing', free: 'eye' });
ok(w4.length === born + 4 && w4.slice(born).join() === 'chikara,teppeki,kakenuke,mikawashi', '枠 4：覚えた 技は 4つまで');
C.free.on = false; var wOff = S.wazaFor(wc, { atk: 'horn', def: 'shell', mov: 'wing', free: 'eye' }); C.free.on = true;
ok(wOff.length === born + 4, 'CFG.free.on＝false：数の 上限なし・4つ目は 数えない（その2 の 1つ目の まま）');
// fight：5しょうめで「ひらいた」・ひらいた あとは 4つ目で 戦う
var fo = S.newRun(23, 'doshin'); fo.stats.hp = 999; fo.stats.atk = 99; var opened = [], usedFree = false;
while (!fo.over && fo.wins < C.runBattles) {
  var eq = { atk: fo.owned.filter(function (p) { return S.PART_BY_ID[p].role === 'atk'; })[0] || null, def: null, mov: null };
  var spare = fo.owned.filter(function (p) { return p !== eq.atk; })[0]; eq.free = spare;
  var o5 = S.fight(fo, 0, eq); if (o5.freeOpened) opened.push(fo.wins);
  if (fo.equip.free) usedFree = usedFree || (S.equipList(fo.equip).indexOf(spare) >= 0 && fo.history[fo.history.length - 1].s > C.free.at);
  if (fo.wins <= C.free.at && fo.equip.free) { usedFree = 'early'; break; }
}
ok(opened.join() === String(C.free.at) && usedFree === true, '自由枠：' + C.free.at + 'しょうめの 勝ちで 1回だけ「ひらいた」・' + (C.free.at + 1) + '戦目から 4つ目で 戦う');
// 前の 保存（equip に free が ない）でも 戦える
var ofr = S.newRun(24, 'pyun'); ofr.wins = C.free.at; ofr.fork = S.makeFork(ofr); delete ofr.equip.free;
var oo2 = S.fight(ofr, 0, ofr.equip); ok(oo2 && ofr.equip.free === null, '前の 保存（free なし）でも 戦える');
// ヒント：ひらいた あとは 4つ目も えらぶ（ほかの 枠と ちがう パーツ か なし）
var be = S.newRun(25, 'gotsun'); be.owned = S.PART_IDS.slice(); be.wins = C.free.at; be.fork = S.makeFork(be);
var bb = S.bestEquip(be, 0, 3).equip;
ok('free' in bb && (bb.free === null || (bb.free !== bb.atk && bb.free !== bb.def && bb.free !== bb.mov)), 'ヒント：4つ目も えらぶ（同じ パーツは 2つに しない）');
be.wins = C.free.at - 1; ok(!('free' in S.bestEquip(be, 0, 2).equip), 'ヒント：ひらく まえは 3つだけ');

// たまご（その2 の 3つ目）：覚えた 技 1つを のこす → 次の 子は その 技を 覚えた 状態で 始まる
var eg = S.newRun(31, 'koron'); eg.learned = ['teppeki', 'kakenuke']; eg.name = 'ころこ';
ok(S.eggChoices(eg).length === 0, 'たまご：周回の とちゅうは のこせない');
eg.over = true;
ok(S.eggChoices(eg).join() === 'teppeki,kakenuke', 'たまご：おわったら 覚えた 技から えらべる');
ok(S.makeEgg(eg, 'kokozo') === null && S.makeEgg(eg, 'chikara') === null, 'たまご：うまれつきの 技・覚えて いない 技は のこせない');
var egg = S.makeEgg(eg, 'kakenuke');
ok(egg && egg.waza === 'kakenuke' && egg.parent === 'ころこ' && egg.sp === 'koron', 'たまご：技・親の なまえ・種類を もつ');
var plain = S.newRun(77, 'gotsun'), child = S.newRun(77, 'gotsun', egg);
ok(child.learned.join() === 'kakenuke' && child.inherit && child.inherit.parent === 'ころこ' && child.inherit.waza === 'kakenuke', 'たまご：ほかの 種類の 子（ごつん）も その 技を 覚えて 始まる・親を のこす');
ok(JSON.stringify(child.stats) === JSON.stringify(plain.stats) && child.owned.join() === plain.owned.join() && JSON.stringify(child.fork) === JSON.stringify(plain.fork), 'たまご：うまれた ときの ステータス・もちもの・道は たまご なしと 同じ（親の つよさは 継がない）');
// なじんだ：継いだ 技を 使える パーツで はじめて 勝ち（ひらめかなかった）→ 1回 レベルアップ（技の stat かならず +1）。2回目は ない
function winWith(run, equip) { run.stats.hp = 999; run.stats.atk = 99; run.fork = S.makeFork(run); var before = JSON.stringify(run.stats); var ri = run.fork.roads[0].hard ? 1 : 0; var o = S.fight(run, ri, equip); /* ふつうの 道（てごわいは なれ +2 で ひらめく） */ return { o: o, before: JSON.parse(before) }; }
var nj = S.newRun(81, 'gotsun', egg); nj.owned = ['eye', 'longtail', 'spring', 'claw']; // なれが 満タンに ならない よう 毎回 ちがう キーワード
var C0 = C.hira.chance, P0 = C.hira.perLuck, H0 = C.hira.hard; C.hira.chance = 0; C.hira.perLuck = 0; C.hira.hard = 0; // ひらめかない ように
var w1 = winWith(nj, { atk: 'eye', def: null, mov: null });
ok(w1.o.win && !w1.o.oya && !w1.o.level && !nj.inherit.fit, 'なじんだ：継いだ 技を 使えない パーツで 勝っても ない');
var w2 = winWith(nj, { atk: null, def: 'longtail', mov: 'spring' });
ok(w2.o.win && w2.o.oya === 'kakenuke' && w2.o.level && w2.o.level.spd === 1 && nj.stats.spd === w2.before.spd + 1 && nj.inherit.fit, 'なじんだ：はやいの パーツで 勝つと 1回 レベルアップ（はやさ +1）');
var w3 = winWith(nj, { atk: 'horn', def: 'shell', mov: 'spring' });
ok(w3.o.win && !w3.o.oya, 'なじんだ：2回目は ない');
C.egg.oyaLevel = false; var nk = S.newRun(82, 'pyun', egg); var w4 = winWith(nk, { atk: null, def: null, mov: 'spring' }); C.egg.oyaLevel = true;
ok(w4.o.win && !w4.o.oya && !nk.inherit.fit, 'CFG.egg.oyaLevel＝false：なじんだ は ない（技だけ 継ぐ）');
var np = S.newRun(83, 'pyun'); var w5 = winWith(np, { atk: null, def: null, mov: 'spring' }); ok(!w5.o.oya, 'たまご なしの 子には なじんだ は ない');
C.hira.chance = C0; C.hira.perLuck = P0; C.hira.hard = H0;
ok(S.wazaFor(child, { atk: null, def: null, mov: 'spring' }).indexOf('kakenuke') >= 0 && S.wazaFor(child, { atk: null, def: 'shell', mov: null }).indexOf('kakenuke') < 0, 'たまご：継いだ 技も その キーワード（れんげき・はやい）の パーツを つけた ときだけ 使える');
var cf = S.newRun(78, 'pyun', egg); cf.owned = ['claw', 'spring', 'shell']; cf.equip = { atk: 'claw', def: 'shell', mov: 'spring' }; cf.fork = S.makeFork(cf);
S.addNare(cf, false); ok(!cf.nare.ren && !cf.nare.fast, 'たまご：継いだ 技の キーワードは なれが たまらない（もう 覚えて いる）');
C.egg.on = false; var off = S.newRun(77, 'gotsun', egg); var offCh = S.eggChoices(eg); C.egg.on = true;
ok(off.learned.length === 0 && !off.inherit && offCh.length === 0, 'CFG.egg.on＝false：たまごを 使わない');
ok(S.newRun(79, 'doshin', { waza: 'nai' }).learned.length === 0 && S.newRun(79, 'doshin', { waza: 'ikari' }).learned.length === 0, 'たまご：知らない 技・うまれつきの 技の たまごは むし（こわれた 保存でも 動く）');
// 種類の テーマ（強さ合わせで 数字を 動かしても くずさない）：カードの 数字（生まれつきの ことば 込み）で、テーマの ステータスは その 種類が いちばん 高い
(function () {
  var theme = { koron: 'luck', gotsun: 'def', pyun: 'spd', doshin: 'atk' };
  var card = {}; S.SPECIES.forEach(function (sp) { card[sp.id] = S.statsOf({ base: sp.base, kw: [sp.kw], parts: [], enemy: false }); });
  Object.keys(theme).forEach(function (id) {
    var k = theme[id], top = S.SPECIES.every(function (o) { return o.id === id || card[o.id][k] < card[id][k]; });
    ok(top, '種類の テーマ：' + S.SPECIES_BY_ID[id].name + '（' + S.SPECIES_BY_ID[id].theme + '）の ' + k + ' が いちばん 高い');
  });
})();
// ためしあそびの きろく（kiroku.js。dot の recording2 を 最新に 合わせた もの）：ルール・乱数を 変えない・実際の sim で 再現できる・古い 記録を 読まない
(function () {
  var R = require('./kiroku.js');
  function mem(fail) { var d = {}; return { d: d, getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; }, setItem: function (k, v) { if (fail) { var e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } d[k] = String(v); }, removeItem: function (k) { delete d[k]; } }; }
  function play(seed, sp, egg, rec) { // 画面と 同じ 順：before を 写す → fight → きろく
    var run = S.newRun(seed, sp, egg), n = 0; if (rec) rec.begin(run);
    while (!run.over && n++ < 20) {
      var eq = {}; S.ROLES.forEach(function (r) { eq[r.id] = run.owned.filter(function (p) { return S.PART_BY_ID[p].role === r.id; }).pop() || null; });
      if (S.freeOpen(run)) eq.free = run.owned.filter(function (p) { return p !== eq.atk && p !== eq.def && p !== eq.mov; })[0] || null;
      var before = JSON.parse(JSON.stringify(run)), road = (seed + run.history.length) % run.fork.roads.length;
      var out = S.fight(run, road, eq); if (rec) rec.record(before, road, eq, out, run);
    }
    return run;
  }
  var egg = { waza: S.LEARN[0].id, parent: 'ころこ', sp: 'koron' };
  var st = mem(), rec = R.create(st, S, {}), plain = [];
  [[101, 'koron', null], [202, 'gotsun', egg], [303, 'pyun', null], [404, 'doshin', egg]].forEach(function (a) { plain.push(JSON.stringify(play(a[0], a[1], a[2], null))); });
  var withRec = [[101, 'koron', null], [202, 'gotsun', egg], [303, 'pyun', null], [404, 'doshin', egg]].map(function (a) { return JSON.stringify(play(a[0], a[1], a[2], rec)); });
  ok(JSON.stringify(plain) === JSON.stringify(withRec), 'きろく：つけても つけなくても 周回の 結果は 同じ（ルール・乱数に さわらない）');
  var data = JSON.parse(JSON.stringify(rec.exportData())), total = data.runs.reduce(function (n, r) { return n + r.battles.length; }, 0);
  ok(data.schemaVersion === 3 && data.runs.length === 4 && total > 8 && st.getItem(R.KEY) && R.KEY === 'remake.playtest.records.v3', 'きろく：4周回を schema 3 の 鍵 v3 に のこす（' + total + 'せん）');
  var n = -1; try { n = R.replay(data, S); } catch (e) { console.log(e.message); }
  ok(n === total, 'きろく：実際の sim で 全部の 戦いが 再現できる（たまご・ひらめき・じゆう こみ）');
  ok(data.runs[1].egg && data.runs[1].egg.waza === egg.waza && data.runs[1].battles[0].before.inherit.waza === egg.waza, 'きろく：たまごの 子は 継いだ 技（inherit）を 記録');
  var bad = JSON.parse(JSON.stringify(data)); bad.runs[1].battles[0].before.inherit.fit = !bad.runs[1].battles[0].before.inherit.fit;
  var badOk = false; try { R.replay(bad, S); } catch (e) { badOk = true; }
  ok(badOk, 'きろく：たまごの 状態を 書きかえた 記録は 再現 不一致で こばむ');
  var old = JSON.parse(JSON.stringify(data)); old.schemaVersion = 2; old.baseSha = 'fe407060167c177aa77b88a8f88283c52d2809af'; old.build = 'remake-recording-2-pr48';
  var oldOk = false; try { R.validateExport(old); } catch (e) { oldOk = true; }
  ok(oldOk, 'きろく：PR48 の 古い 記録（schema 2）は 読まない');
  var cfg = JSON.parse(JSON.stringify(data)); cfg.engineConfig.hearts = 99; var cfgOk = false; try { R.replay(cfg, S); } catch (e) { cfgOk = true; }
  ok(cfgOk, 'きろく：ルールの 数字（CFG）が ちがう 記録は こばむ');
  var st2 = mem(); st2.setItem('remake.playtest.records.v2.pr48', '{"old":1}'); var r2 = R.create(st2, S, {}); play(505, 'koron', null, r2);
  ok(st2.getItem('remake.playtest.records.v2.pr48') === '{"old":1}' && !r2.status().warning, 'きろく：古い v2 の 鍵は 消さない・さわらない');
  var st3 = mem(true), r3 = R.create(st3, S, {}), threw = false; try { play(606, 'koron', null, r3); } catch (e) { threw = true; }
  ok(!threw && r3.status().warning && typeof r3.releaseForGameSave === 'undefined', 'きろく：書けなくても 例外を 出さない（ゲームは つづく）・容量不足で 記録を けす しくみは ない');
  var st4 = mem(), r4 = R.create(st4, S, { auto: true }); play(707, 'koron', null, r4);
  var st5 = mem(), r5 = R.create(st5, S, { enabled: false }); play(708, 'koron', null, r5);
  ok(Object.keys(st4.d).length === 0 && Object.keys(st5.d).length === 0, 'きろく：自動モード（?auto=1）と きろく OFF では 何も 書かない');
})();
console.log((fail ? '✕ ' : '○ ') + pass + '/' + (pass + fail) + ' 一致');
process.exit(fail ? 1 : 0);
