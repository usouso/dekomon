// でこもん 版6 — 文字どおりテスト（Node で実行: node tests.js）
// 札の文に書いてあることが、そのとおりに起きるかを 1つずつ確かめる。乱れなし（variance 0）。
// 出力は REPORT.md に貼る表（札・文・期待・実測・一致）。1つでも合わなければ 終了コード 1。
'use strict';
var S = require('./sim.js');
var CFG = S.CFG;
var rows = [], fails = 0;

function dummy(over) {
  var d = { id: 'dummy', name: 'ダミー', hp: 1000, atk: 10, spd: 10, traits: [], parts: [] };
  Object.keys(over || {}).forEach(function (k) { d[k] = over[k]; });
  return d;
}
// 戦いを 1つ回す。p: {parts, lv2, grow}, e: 相手の定義, field, opts
function fight(p, e, field, opts) {
  opts = opts || {};
  var pf = S.makeFighter('p', S.playerDef(p.grow || null, 'テスト'), p.parts || [], 1, p.lv2 || []);
  var ef = S.makeFighter('e', e, e.parts || [], opts.stage || 1, [], { hard: !!opts.hard });
  var res = S.simulateBattle(pf, ef, field || 'plain', { variance: 0, rng: opts.rng || S.makeRng(1) });
  res.pf = pf; res.ef = ef;
  return res;
}
function evs(res, pred) {
  var out = [];
  res.hands.forEach(function (h, i) { h.events.forEach(function (ev) { if (pred(ev, h, i)) { var c = Object.assign({}, ev); c.handNo = i + 1; c.actor = h.actor; out.push(c); } }); });
  return out;
}
function hitsBy(res, side) { return evs(res, function (ev) { return ev.t === 'hit' && ev.side === side; }); }
function countersBy(res, side) { return evs(res, function (ev) { return ev.t === 'counter' && ev.side === side; }); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function row(card, text, expect, actual) {
  var ok = same(expect, actual);
  if (!ok) fails++;
  rows.push({ card: card, text: text, expect: expect, actual: actual, ok: ok });
}
function fmt(v) { return typeof v === 'string' ? v : JSON.stringify(v); }
// プレイヤー こうげき 13。相手 ダミー こうげき 10 → 段1 で 10.6 → 1げき 11
var P = CFG.playerAtk; // 13

// ======================= 16 のパーツ =======================
(function () {
  // ツノ
  var r = fight({ parts: ['horn'] }, dummy());
  var h = hitsBy(r, 'p').map(function (x) { return x.dmg; }).slice(0, 6);
  row('ツノ', S.PART_BY_ID.horn.effect, [13, 13, 33, 13, 13, 33], h);
  var hornHits = hitsBy(r, 'p').filter(function (x) { return x.horn; }).map(function (x) { return x.actor === 'p' ? r.hands[x.handNo - 1].n : 0; });
  row('ツノ', '3手ごと（自分の 3・6手目）に 1げきめだけ', 'ツノの手 2回：自分の 3・6手目', hornHits.length === 2 && h[2] === 33 && h[5] === 33 ? 'ツノの手 2回：自分の 3・6手目' : JSON.stringify(hornHits));
  // ツメ＋ツノ：1げきめ だけ ×2.5
  var r2 = fight({ parts: ['horn', 'claw'] }, dummy({ spd: 12 })); // ツメは かるい（+2）→ 自分 12、相手 12 で はやさ 同じ
  var hornHandNo = hitsBy(r2, 'p').filter(function (y) { return y.horn; })[0].handNo;
  var hand3 = hitsBy(r2, 'p').filter(function (x) { return x.handNo === hornHandNo; }).map(function (x) { return x.dmg; });
  row('ツノ＋ツメ', 'こうげきの 1げきめが ×2.5（2げきめは ×2.5 しない）', [20, 8], hand3);
})();
(function () {
  // ひかるめ：相手に 状態が あるときだけ ×1.5（キバで どくに してから）
  var r = fight({ parts: ['eye', 'fang'] }, dummy());
  var h = hitsBy(r, 'p').slice(0, 2).map(function (x) { return [x.dmg, x.eye]; });
  row('ひかるめ', S.PART_BY_ID.eye.effect, [[13, false], [20, true]], h);
  var r2 = fight({ parts: ['eye'] }, dummy());
  row('ひかるめ', '状態の ない あいてには ×1 のまま', [13, 13], hitsBy(r2, 'p').slice(0, 2).map(function (x) { return x.dmg; }));
})();
(function () {
  // キバ：どく（こうげき 13 × 0.45 = 5.85 → 6）。コウラ・かたいで へらない
  var r = fight({ parts: ['fang'] }, dummy());
  var st = evs(r, function (ev) { return ev.t === 'status' && ev.side === 'e'; })[0];
  var pz = evs(r, function (ev) { return ev.t === 'poison' && ev.side === 'e'; }).slice(0, 3).map(function (x) { return x.dmg; });
  row('キバ', S.PART_BY_ID.fang.effect, { status: 'poison', hands: 3, dmg: [6, 6, 6] }, { status: st && st.status, hands: st && st.hands, dmg: pz });
  var r2 = fight({ parts: ['fang'] }, dummy({ traits: ['hard'], parts: ['shell'] }));
  var pz2 = evs(r2, function (ev) { return ev.t === 'poison' && ev.side === 'e'; }).slice(0, 2).map(function (x) { return x.dmg; });
  var hit2 = hitsBy(r2, 'p')[0].dmg;
  row('キバ vs コウラ・かたい', 'どくは コウラ・かたいで へらない（1げきは へる）', { poison: [6, 6], hit: 5 }, { poison: pz2, hit: hit2 });
})();
(function () {
  // すいつくくち：1げきごとに 1/3 かいふく（先に 11 うけてから）
  var r = fight({ parts: ['leech'] }, dummy({ spd: 20 }));
  var heals = evs(r, function (ev) { return ev.t === 'heal' && ev.side === 'p'; }).slice(0, 2).map(function (x) { return x.amt; });
  row('すいつくくち', S.PART_BY_ID.leech.effect, [4, 4], heals);
  var r2 = fight({ parts: ['leech', 'claw'] }, dummy({ spd: 20 }));
  var firstHand = r2.hands.filter(function (h) { return h.actor === 'p'; })[0];
  var hl = firstHand.events.filter(function (ev) { return ev.t === 'heal' && ev.side === 'p'; }).map(function (x) { return x.amt; });
  row('すいつくくち＋ツメ', '1げきごとに かいふく（2げき → 2回）', [3, 3], hl);
})();
(function () {
  // ツメ：2げき（×0.6 → 7.8 → 8）。はやさで かてば 3げき
  var r = fight({ parts: ['claw'] }, dummy({ spd: 12 })); // ツメは かるい（+2）→ 自分 12、相手 12
  var first = r.hands.filter(function (h) { return h.actor === 'p'; })[0];
  var d = first.events.filter(function (ev) { return ev.t === 'hit'; }).map(function (x) { return x.dmg; });
  row('ツメ', S.PART_BY_ID.claw.effect + '（はやさ 同じ 12 対 12）', [8, 8], d);
  var r2 = fight({ parts: ['claw'] }, dummy({ spd: 5 }));
  var first2 = r2.hands.filter(function (h) { return h.actor === 'p'; })[0];
  row('ツメ', 'はやさで かてば 3げき', [8, 8, 8], first2.events.filter(function (ev) { return ev.t === 'hit'; }).map(function (x) { return x.dmg; }));
})();
(function () {
  // くだくツメ：もろい（×1.6、5手）
  var r = fight({ parts: ['crush'] }, dummy());
  var h = hitsBy(r, 'p').slice(0, 2).map(function (x) { return [x.dmg, x.brittle]; });
  var st = evs(r, function (ev) { return ev.t === 'status' && ev.status === 'brittle'; })[0];
  row('くだくツメ', S.PART_BY_ID.crush.effect, { hits: [[13, 0], [21, 1.6]], hands: 5 }, { hits: h, hands: st && st.hands });
  // 5手：かけた手の おわりから 1手ごとに 1 へる（4 → 3）。かけなおすと 5 に もどる
  var ticks = evs(r, function (ev) { return (ev.t === 'statusTick' || ev.t === 'status') && ev.status === 'brittle'; }).slice(0, 4).map(function (x) { return x.hands; });
  row('くだくツメ', '5手：手ごとに 1 へる（かけた手 5 → 4、つぎの手 3、かけなおして 5 → 4）', [5, 4, 3, 5], ticks);
})();
(function () {
  // ばねあし：3手ごとに 1手で 2かい こうげき
  var r = fight({ parts: ['spring'] }, dummy());
  var mine = r.hands.filter(function (h) { return h.actor === 'p'; }).slice(0, 6);
  var per = mine.map(function (h) { return h.events.filter(function (ev) { return ev.t === 'hit'; }).length; });
  row('ばねあし', S.PART_BY_ID.spring.effect, [1, 1, 2, 1, 1, 2], per);
  var r2 = fight({ parts: ['spring'] }, dummy(), 'mud');
  var per2 = r2.hands.filter(function (h) { return h.actor === 'p'; }).slice(0, 3).map(function (h) { return h.events.filter(function (ev) { return ev.t === 'hit'; }).length; });
  row('ばねあし（ぬま）', S.FIELD_BY_ID.mud.desc, [1, 1, 1], per2);
})();
(function () {
  // ながいあし：とおくから → はんげき されない。おね では むこう
  var r = fight({ parts: ['longleg'] }, dummy({ parts: ['spike'] }));
  row('ながいあし', S.PART_BY_ID.longleg.effect, 0, countersBy(r, 'e').length);
  var r2 = fight({ parts: ['longleg'] }, dummy({ parts: ['spike'] }), 'wind');
  row('ながいあし（おね）', 'おね では とおくからが むこうに なる（はんげきが あたる）', true, countersBy(r2, 'e').length > 0);
})();
(function () {
  // トゲ：ちかくから 1げき うけるたび はんげき（13 × 0.6 = 7.8 → 8）
  var r = fight({ parts: ['spike'] }, dummy({ parts: ['claw'], spd: 20 }));
  var firstE = r.hands.filter(function (h) { return h.actor === 'e'; })[0];
  var c = firstE.events.filter(function (ev) { return ev.t === 'counter' && ev.side === 'p'; }).map(function (x) { return x.dmg; });
  row('トゲ', S.PART_BY_ID.spike.effect + '（相手の ツメ 3げき → 3回）', [8, 8, 8], c);
  var r2 = fight({ parts: ['spike'] }, dummy({ traits: ['ranged'], spd: 20 }));
  row('トゲ vs とおくから', 'とおくからの あいてには はんげき しない', 0, countersBy(r2, 'p').length);
  // 0 に はじいた 1げきでも 1げき うけた → はんげき する
  var r3 = fight({ parts: ['spike', 'scale'], lv2: ['scale'] }, dummy({ spd: 20 }));
  var e1 = r3.hands.filter(function (h) { return h.actor === 'e'; })[0];
  var hit0 = e1.events.filter(function (ev) { return ev.t === 'hit'; })[0];
  row('トゲ＋はじく', '0 に はじいた 1げきにも はんげき', { hit: 0, counter: 8 }, { hit: hit0.dmg, counter: (e1.events.filter(function (ev) { return ev.t === 'counter'; })[0] || {}).dmg });
})();
(function () {
  // おもし：1げきごとに +4。倍率に のらない
  var r = fight({ parts: ['weight'] }, dummy());
  row('おもし', S.PART_BY_ID.weight.effect, 17, hitsBy(r, 'p')[0].dmg);
  var r2 = fight({ parts: ['weight', 'horn'] }, dummy());
  var hornHit = hitsBy(r2, 'p').filter(function (x) { return x.horn; })[0];
  row('おもし＋ツノ', '+4 は ×2.5 に のらない（13×2.5＋4 = 36.5 → 37。のると 43）', 37, hornHit.dmg);
  var r3 = fight({ parts: ['weight', 'claw'] }, dummy({ spd: 10 }));
  var f3 = r3.hands.filter(function (h) { return h.actor === 'p'; })[0];
  row('おもし＋ツメ', '1げきごとに +4（7.8＋4 → 12 が 2げき）', [12, 12], f3.events.filter(function (ev) { return ev.t === 'hit'; }).map(function (x) { return x.dmg; }));
})();
(function () {
  // コウラ：うける 1げきと はんげきが −33%。どくは へらない
  var r = fight({ parts: ['shell'] }, dummy({ spd: 20 }));
  row('コウラ', 'うける 1げき −33%（10.6 → 7.1 → 7）', 7, hitsBy(r, 'e')[0].dmg);
  var r2 = fight({ parts: ['shell'] }, dummy({ parts: ['spike'] }));
  var r2n = fight({ parts: [] }, dummy({ parts: ['spike'] }));
  row('コウラ', 'はんげきも −33%（6.36 → 4.26 → 4。なしなら 6）', [4, 6], [countersBy(r2, 'e')[0].dmg, countersBy(r2n, 'e')[0].dmg]);
  var r3 = fight({ parts: ['shell'] }, dummy({ traits: ['poisoner'], spd: 20 }));
  var r3n = fight({ parts: [] }, dummy({ traits: ['poisoner'], spd: 20 }));
  var pz = function (res) { return evs(res, function (ev) { return ev.t === 'poison' && ev.side === 'p'; })[0].dmg; };
  row('コウラ vs どく', S.PART_BY_ID.shell.effect, [5, 5], [pz(r3), pz(r3n)]);
})();
(function () {
  // うろこ：かたく なる（−4）。はんげきも −4。どくは へらない
  var r = fight({ parts: ['scale'] }, dummy({ spd: 20 }));
  row('うろこ', 'うける 1げき −4（10.6 → 6.6 → 7）', 7, hitsBy(r, 'e')[0].dmg);
  var r2 = fight({ parts: ['scale'] }, dummy({ parts: ['spike'] }));
  row('うろこ', 'はんげきも −4（6.36 → 2.36 → 2）', 2, countersBy(r2, 'e')[0].dmg);
  var r3 = fight({ parts: ['scale'] }, dummy({ traits: ['poisoner'], spd: 20 }));
  row('うろこ vs どく', S.PART_BY_ID.scale.effect, 5, evs(r3, function (ev) { return ev.t === 'poison' && ev.side === 'p'; })[0].dmg);
})();
(function () {
  // ふといしっぽ：あてた あいては つぎの こうげきが ×0.5（10.6 → 5.3 → 5）。その つぎは もどる
  var r = fight({ parts: ['tail'] }, dummy({ spd: 5 }));
  // 自分が先手。相手の 1手目は ×0.5。2手目の前に 自分が また あてるので また ×0.5。→ 相手に よろけを かけ直せない形で 確かめる：自分は 2手に 1回しか あてない（ふきとばしで 相手を とばす代わりに、相手を はやく して 相手の手を 2回 続けさせる）
  var r2 = fight({ parts: ['tail'] }, dummy({ spd: 20, parts: ['spring'] })); // 相手の 3手目は ばねあしで 2かい こうげき → 1かいめ だけ ×0.5
  var dblE = r2.hands.filter(function (h) { return h.actor === 'e' && h.events.some(function (ev) { return ev.t === 'double'; }); })[0];
  var eh = dblE.events.filter(function (ev) { return ev.t === 'hit'; }).map(function (x) { return [x.dmg, x.halved]; });
  row('ふといしっぽ', S.PART_BY_ID.tail.effect + '（相手が 1手で 2かい こうげき：1かいめ ×0.5、2かいめは もどる）', [[5, true], [11, false]], eh);
  row('ふといしっぽ', '自分が先手 → 相手の 1手目が ×0.5', [5, true], [hitsBy(r, 'e')[0].dmg, hitsBy(r, 'e')[0].halved]);
})();
(function () {
  // ながいしっぽ：じぶんの手の おわりに +4
  var r = fight({ parts: ['longtail'] }, dummy({ spd: 20 }));
  var mine = r.hands.filter(function (h) { return h.actor === 'p'; })[0];
  var heal = mine.events.filter(function (ev) { return ev.t === 'heal' && ev.side === 'p'; }).map(function (x) { return [x.amt, x.src]; });
  var last = mine.events[mine.events.length - 1];
  row('ながいしっぽ', S.PART_BY_ID.longtail.effect, { heal: [[4, 'ながいしっぽ']], afterHit: true }, { heal: heal, afterHit: mine.events.indexOf(mine.events.filter(function (ev) { return ev.t === 'heal'; })[0]) > mine.events.indexOf(mine.events.filter(function (ev) { return ev.t === 'hit'; })[0]) });
})();
(function () {
  // はね：はやさ +10。あめ では きえる
  var r = fight({ parts: ['wing'] }, dummy());
  row('はね', S.PART_BY_ID.wing.effect + '（10 ＋ はね 10 ＋ かるい 2 = 22）', 22, r.start.pSpd);
  var r2 = fight({ parts: ['wing'] }, dummy(), 'rain');
  row('はね（あめのたに）', 'はねの +10 が きえる（かるい +2 は のこる → 12）', 12, r2.start.pSpd);
})();
(function () {
  // ふさふさ：どく・よろけ・もろい を うけない
  var r = fight({ parts: ['fur'] }, dummy({ traits: ['poisoner'], parts: ['crush', 'tail'], spd: 20 }));
  var got = evs(r, function (ev) { return ev.t === 'status' && ev.side === 'p'; }).length;
  var blocked = evs(r, function (ev) { return ev.t === 'blocked' && ev.side === 'p'; }).length;
  row('ふさふさ', S.PART_BY_ID.fur.effect, { statuses: 0, blockedMoreThan0: true }, { statuses: got, blockedMoreThan0: blocked > 0 });
})();

// ======================= 16 の Lv2 =======================
(function () {
  // ふきとばし
  var r = fight({ parts: ['horn'], lv2: ['horn'] }, dummy());
  var blown = evs(r, function (ev) { return ev.t === 'blown'; })[0];
  var skip = evs(r, function (ev) { return ev.t === 'skip'; })[0];
  row('Lv2 ふきとばし', S.PART_BY_ID.horn.lv2text, { blownAtHornHand: true, skipNextEnemyHand: true }, { blownAtHornHand: !!blown && hitsBy(r, 'p').filter(function (x) { return x.horn; })[0].handNo === blown.handNo, skipNextEnemyHand: !!skip && skip.handNo === blown.handNo + 1 && skip.side === 'e' });
})();
(function () {
  // みきり：ツノと おおわざを 1戦に1回 よける
  var r = fight({ parts: ['eye'], lv2: ['eye'] }, dummy({ traits: ['charge'], spd: 20 }));
  var big = hitsBy(r, 'e').filter(function (x) { return x.big; }).slice(0, 2).map(function (x) { return [x.dmg, !!x.dodged]; });
  row('Lv2 みきり', S.PART_BY_ID.eye.lv2text + '（おおわざ：1回目 よける、2回目は うける）', [[0, true], [21, false]], big);
  var r2 = fight({ parts: ['eye'], lv2: ['eye'] }, dummy({ parts: ['horn'], spd: 20 }));
  var big2 = hitsBy(r2, 'e').filter(function (x) { return x.big; }).slice(0, 2).map(function (x) { return [x.dmg, !!x.dodged]; });
  row('Lv2 みきり', 'ツノも よける（1回目 0、2回目 27）', [[0, true], [27, false]], big2);
})();
(function () {
  // もうどく：どくの ダメージが 手ごとに +1 ずつ
  var r = fight({ parts: ['fang'], lv2: ['fang'] }, dummy());
  var pz = evs(r, function (ev) { return ev.t === 'poison' && ev.side === 'e'; }).slice(0, 5).map(function (x) { return x.dmg; });
  row('Lv2 もうどく', S.PART_BY_ID.fang.lv2text, [6, 7, 8, 9, 10], pz);
})();
(function () {
  // おおぐい：すいついた ぶんの はんぶんが 上限に（+40まで）
  var r = fight({ parts: ['leech'], lv2: ['leech'] }, dummy({ spd: 20 }));
  var ups = evs(r, function (ev) { return ev.t === 'maxUp'; }).slice(0, 2).map(function (x) { return [x.amt, x.maxHp]; });
  row('Lv2 おおぐい', S.PART_BY_ID.leech.lv2text + '（かいふく 4 → 上限 +2）', [[2, 117], [2, 119]], ups);
  var saved = CFG.maxHands; CFG.maxHands = 80;
  var r2 = fight({ parts: ['leech', 'claw'], lv2: ['leech'] }, dummy({ hp: 100000, spd: 1 }));
  CFG.maxHands = saved;
  var total = evs(r2, function (ev) { return ev.t === 'maxUp'; }).reduce(function (a, x) { return a + x.amt; }, 0);
  row('Lv2 おおぐい', '+40 まで（長い戦いでも 上限は 115+40=155 で とまる）', { total: 40, maxHp: 155 }, { total: total, maxHp: r2.p.maxHp });
})();
(function () {
  // つめあと：あてるたび はやさ −1
  var r = fight({ parts: ['claw'], lv2: ['claw'] }, dummy({ spd: 10 }));
  var sd = evs(r, function (ev) { return ev.t === 'spdDown'; }).slice(0, 3).map(function (x) { return x.spd; });
  row('Lv2 つめあと', S.PART_BY_ID.claw.lv2text, [9, 8, 7], sd);
})();
(function () {
  // かいたい：もろい あいてに あてると パーツを 1つ 3手 こわす
  var r = fight({ parts: ['crush'], lv2: ['crush'] }, dummy({ parts: ['shell', 'horn'] }));
  var br = evs(r, function (ev) { return ev.t === 'broken'; })[0];
  var rp = evs(r, function (ev) { return ev.t === 'repaired'; })[0];
  var secondHit = hitsBy(r, 'p')[1];
  row('Lv2 かいたい', S.PART_BY_ID.crush.lv2text, { brokenAt2ndHit: true, hands: 3, repairedAfter: 3 }, { brokenAt2ndHit: !!br && br.handNo === secondHit.handNo && secondHit.brittle === 1.6, hands: br && br.hands, repairedAfter: rp && br ? rp.handNo - br.handNo : null });
})();
(function () {
  // おおジャンプ：2かい こうげきする手の 2かいめが ×1.3（13 → 16.9 → 17）
  var r = fight({ parts: ['spring'], lv2: ['spring'] }, dummy());
  var dbl = r.hands.filter(function (h) { return h.actor === 'p' && h.events.some(function (ev) { return ev.t === 'double'; }); })[0];
  row('Lv2 おおジャンプ', S.PART_BY_ID.spring.lv2text, [13, 17], dbl.events.filter(function (ev) { return ev.t === 'hit'; }).map(function (x) { return x.dmg; }));
})();
(function () {
  // ふみつけ：じぶんより おそい あいてに あてると ×1.5
  var r = fight({ parts: ['longleg'], lv2: ['longleg'] }, dummy({ spd: 5 }));
  var r2 = fight({ parts: ['longleg'], lv2: ['longleg'] }, dummy({ spd: 10 }));
  row('Lv2 ふみつけ', S.PART_BY_ID.longleg.lv2text + '（おそい 20 ／ 同じ 13）', [20, 13], [hitsBy(r, 'p')[0].dmg, hitsBy(r2, 'p')[0].dmg]);
})();
(function () {
  // ばらまき：とおくからの あいてにも はんげき
  var r = fight({ parts: ['spike'], lv2: ['spike'] }, dummy({ traits: ['ranged'], spd: 20 }));
  var c = countersBy(r, 'p')[0];
  row('Lv2 ばらまき', S.PART_BY_ID.spike.lv2text, { counter: 8, thrown: true }, { counter: c && c.dmg, thrown: !!(c && c.thrown) });
})();
(function () {
  // ずしん：あいてより おそいぶん 1げき＋（+8まで）
  var r = fight({ parts: ['weight'], lv2: ['weight'] }, dummy({ spd: 12 }));
  var r2 = fight({ parts: ['weight'], lv2: ['weight'] }, dummy({ spd: 40 }));
  row('Lv2 ずしん', S.PART_BY_ID.weight.lv2text + '（自分 7・相手 12 → +5 ／ 相手 40 → +8）', [22, 25], [hitsBy(r, 'p')[0].dmg, hitsBy(r2, 'p')[0].dmg]);
})();
(function () {
  // こうらごもり：3わりを きった さいしょの手、うける 1げきが 0
  var r = fight({ parts: ['shell'], lv2: ['shell'] }, dummy({ atk: 40, spd: 20, hp: 100000 }));
  var eh = hitsBy(r, 'e').slice(0, 6).map(function (x) { return [x.dmg, !!x.shellHide, x.hp]; });
  row('Lv2 こうらごもり', S.PART_BY_ID.shell.lv2text + '（28 ずつ うけて 31＝27% に なった つぎの手だけ 0）', [[28, false, 87], [28, false, 59], [28, false, 31], [0, true, 31], [28, false, 3], [28, false, 0]], eh);
})();
(function () {
  // はじく：10いかの 1げきと はんげきを 0 に
  var r = fight({ parts: ['scale'], lv2: ['scale'] }, dummy({ spd: 20 }));
  var r2 = fight({ parts: ['scale'], lv2: ['scale'] }, dummy({ spd: 20, atk: 20 }));
  var r3 = fight({ parts: ['scale'], lv2: ['scale'] }, dummy({ parts: ['spike'] }));
  row('Lv2 はじく', S.PART_BY_ID.scale.lv2text + '（7 → 0 ／ 17 は そのまま ／ はんげき 2 → 0）', [[0, true], [17, false], [0, true]], [[hitsBy(r, 'e')[0].dmg, hitsBy(r, 'e')[0].deflect], [hitsBy(r2, 'e')[0].dmg, hitsBy(r2, 'e')[0].deflect], [countersBy(r3, 'e')[0].dmg, countersBy(r3, 'e')[0].deflect]]);
})();
(function () {
  // ふりまわし：じぶんの手の おわりに 相手の じょうたいが 1手 のびる
  var r = fight({ parts: ['tail', 'fang'], lv2: ['tail'] }, dummy());
  var mine = r.hands.filter(function (h) { return h.actor === 'p'; })[0];
  var ext = mine.events.filter(function (ev) { return ev.t === 'statusExtend'; })[0];
  var lastIdx = mine.events.length - 1;
  var afterHits = ext && mine.events.indexOf(ext) > mine.events.map(function (e) { return e.t; }).lastIndexOf('hit');
  row('Lv2 ふりまわし', S.PART_BY_ID.tail.lv2text, { atEndOfHand: true, poison: 4, stagger: 2 }, { atEndOfHand: !!afterHits, poison: ext && (ext.statuses.filter(function (s) { return s.status === 'poison'; })[0] || {}).hands, stagger: ext && (ext.statuses.filter(function (s) { return s.status === 'stagger'; })[0] || {}).hands });
})();
(function () {
  // たくわえ：まんたんの ときの かいふくは こうげき +2 に（+8まで）
  var r = fight({ parts: ['longtail', 'scale'], lv2: ['longtail', 'scale'] }, dummy({ atk: 1 }));
  var st = evs(r, function (ev) { return ev.t === 'store'; }).map(function (x) { return x.n; });
  var hits = hitsBy(r, 'p').slice(0, 6).map(function (x) { return x.dmg; });
  row('Lv2 たくわえ', S.PART_BY_ID.longtail.lv2text, { stored: [2, 4, 6, 8], hits: [13, 15, 17, 19, 21, 21] }, { stored: st, hits: hits });
})();
(function () {
  // おいかぜ：せんこうなら じぶんの手ごとに こうげき +1 ずつ（+6まで）
  var r = fight({ parts: ['wing'], lv2: ['wing'] }, dummy({ spd: 5 }));
  var hits = hitsBy(r, 'p').slice(0, 7).map(function (x) { return x.dmg; });
  row('Lv2 おいかぜ', S.PART_BY_ID.wing.lv2text, [14, 15, 16, 17, 18, 19, 19], hits);
  var r2 = fight({ parts: ['wing'], lv2: ['wing'] }, dummy({ spd: 30 }));
  row('Lv2 おいかぜ', 'せんこうで ないと のらない', 0, evs(r2, function (ev) { return ev.t === 'tailwind'; }).length);
})();
(function () {
  // もふもふ：かけられた じょうたいを あいてに はねかえす
  var r = fight({ parts: ['fur'], lv2: ['fur'] }, dummy({ traits: ['poisoner'], spd: 20 }));
  var ref = evs(r, function (ev) { return ev.t === 'reflect'; })[0];
  var st = evs(r, function (ev) { return ev.t === 'status' && ev.side === 'e'; })[0];
  row('Lv2 もふもふ', S.PART_BY_ID.fur.lv2text, { reflect: 'poison', enemyPoisoned: true, poisonDmg: 6 }, { reflect: ref && ref.status, enemyPoisoned: !!st, poisonDmg: (evs(r, function (ev) { return ev.t === 'poison' && ev.side === 'e'; })[0] || {}).dmg });
})();

// ======================= 8 の性質 =======================
(function () {
  var r = fight({ parts: [] }, dummy({ traits: ['hard'] }));
  var r2 = fight({ parts: ['spike'] }, dummy({ traits: ['hard'], spd: 20 }));
  row('かたい', S.TRAITS.hard.desc + '（13 → 9 ／ はんげき 7.8 → 4）', [9, 4], [hitsBy(r, 'p')[0].dmg, countersBy(r2, 'p')[0].dmg]);
  var r3 = fight({ parts: ['spike'] }, dummy({ traits: ['ranged'], spd: 20 }));
  var r3w = fight({ parts: ['spike'] }, dummy({ traits: ['ranged'], spd: 20 }), 'wind');
  row('とおくから', S.TRAITS.ranged.desc + '（おね では むこう）', [0, true], [countersBy(r3, 'p').length, countersBy(r3w, 'p').length > 0]);
  var r4 = fight({ parts: [] }, dummy({ traits: ['fast'] }));
  row('はやい', S.TRAITS.fast.desc, 16, r4.start.eSpd);
  var r5 = fight({ parts: [] }, dummy({ traits: ['heavy'], spd: 20 }));
  row('おもい', S.TRAITS.heavy.desc + '（はやさ 16、1げき 10.6+3 → 14）', [16, 14], [r5.start.eSpd, hitsBy(r5, 'e')[0].dmg]);
  var r6 = fight({ parts: [] }, dummy({ traits: ['regen'], spd: 5 }));
  var eh = r6.hands.filter(function (h) { return h.actor === 'e'; })[0];
  var hl = eh.events.filter(function (ev) { return ev.t === 'heal'; })[0];
  row('かいふく', S.TRAITS.regen.desc, { amt: 5, beforeHit: true }, { amt: hl && hl.amt, beforeHit: !!hl && eh.events.indexOf(hl) < eh.events.indexOf(eh.events.filter(function (ev) { return ev.t === 'hit'; })[0]) });
  var r7 = fight({ parts: [] }, dummy({ traits: ['poisoner'], spd: 20 }));
  var st7 = evs(r7, function (ev) { return ev.t === 'status' && ev.side === 'p'; })[0];
  row('どくもち', S.TRAITS.poisoner.desc, { status: 'poison', dmg: 5 }, { status: st7 && st7.status, dmg: (evs(r7, function (ev) { return ev.t === 'poison' && ev.side === 'p'; })[0] || {}).dmg });
  var r8 = fight({ parts: [] }, dummy({ traits: ['charge'], spd: 20 }));
  var eh8 = hitsBy(r8, 'e').slice(0, 3).map(function (x) { return [x.dmg, x.label]; });
  row('ためる', S.TRAITS.charge.desc, [[11, 'こうげき'], [11, 'こうげき'], [21, 'おおわざ']], eh8);
  var r9 = fight({ parts: [] }, dummy({ traits: ['tough'], hp: 100 }));
  row('しぶとい', S.TRAITS.tough.desc + '（100 × 1.06 × 1.3 = 137.8 → 138）', 138, r9.e.maxHp);
})();

// ======================= 噛み合い・場所・組み合わせ =======================
(function () {
  // ツノ＋ばねあし：2かい こうげきする手は ツノの ×2.5 も 2かい
  var r = fight({ parts: ['horn', 'spring'] }, dummy());
  var dbl = r.hands.filter(function (h) { return h.actor === 'p' && h.events.some(function (ev) { return ev.t === 'double'; }); })[0];
  row('ツノ＋ばねあし', S.SYN_BY_ID[2].desc, { hits: [33, 33], synergy: true }, { hits: dbl.events.filter(function (ev) { return ev.t === 'hit'; }).map(function (x) { return x.dmg; }), synergy: dbl.events.some(function (ev) { return ev.t === 'synergy' && ev.id === 2; }) });
  // ツメ＋ばねあし＋はやさで勝つ → 3手目に 6げき
  var r2 = fight({ parts: ['claw', 'spring'] }, dummy({ spd: 5 }));
  var dbl2 = r2.hands.filter(function (h) { return h.actor === 'p' && h.events.some(function (ev) { return ev.t === 'double'; }); })[0];
  row('ツメ＋ばねあし', 'はやさで かつ → 3手目は 3げき × 2かい = 6げき', 6, dbl2.events.filter(function (ev) { return ev.t === 'hit'; }).length);
  // おもし＋ツメ
  var r3 = fight({ parts: ['weight', 'claw'] }, dummy({ spd: 10 }));
  row('おもし＋ツメ', S.SYN_BY_ID[1].desc, true, evs(r3, function (ev) { return ev.t === 'synergy' && ev.id === 1; }).length > 0);
  // はね＋ツメ：はねで はやさを こえて 3げき
  var r4 = fight({ parts: ['wing', 'claw'] }, dummy({ spd: 15 }));
  var f4 = r4.hands.filter(function (h) { return h.actor === 'p'; })[0];
  row('はね＋ツメ', S.SYN_BY_ID[8].desc + '（自分 10+10=20 ＞ 相手 15）', { hits: 3, synergy: true }, { hits: f4.events.filter(function (ev) { return ev.t === 'hit'; }).length, synergy: f4.events.some(function (ev) { return ev.t === 'synergy' && ev.id === 8; }) });
  // くだくツメ＋ツノ
  var r5 = fight({ parts: ['crush', 'horn'] }, dummy());
  var hh = hitsBy(r5, 'p').filter(function (x) { return x.horn; })[0];
  row('くだくツメ＋ツノ', S.SYN_BY_ID[7].desc + '（13 × 2.5 × 1.6 = 52）', { dmg: 52, synergy: true }, { dmg: hh.dmg, synergy: evs(r5, function (ev) { return ev.t === 'synergy' && ev.id === 7; }).length > 0 });
  // あめのたに：状態が 1手で きえる
  var r6 = fight({ parts: ['fang'] }, dummy(), 'rain');
  var st6 = evs(r6, function (ev) { return ev.t === 'status' && ev.side === 'e'; })[0];
  row('あめのたに', S.FIELD_BY_ID.rain.desc, 1, st6 && st6.hands);
  // ぬま：おもいパーツは はやさ −8
  var r7 = fight({ parts: ['weight'] }, dummy(), 'mud');
  var r7p = fight({ parts: ['weight'] }, dummy(), 'plain');
  row('ぬま', 'おもいパーツは はやさ −8（もり では −3）', [2, 7], [r7.start.pSpd, r7p.start.pSpd]);
  // おね：かるいパーツは +5
  var r8 = fight({ parts: ['claw'] }, dummy(), 'wind');
  var r8p = fight({ parts: ['claw'] }, dummy(), 'plain');
  row('おね', 'かるいパーツは はやさ +5（もり では +2）', [15, 12], [r8.start.pSpd, r8p.start.pSpd]);
  // 0 に はじかれた 1げきでは どくが かからない（版6：あてた ときだけ）
  var r9 = fight({ parts: ['scale'], lv2: ['scale'] }, dummy({ traits: ['poisoner'], spd: 20 }));
  row('あてた ときだけ', '0 に はじかれた 1げきでは どくが かからない', 0, evs(r9, function (ev) { return ev.t === 'status' && ev.side === 'p'; }).length);
  // てごわい：たいりょく・こうげき ×1.15
  var rh = fight({ parts: [] }, dummy({ hp: 100 }), 'plain', { hard: true });
  row('てごわい', 'たいりょく・こうげき ×1.15（100×1.06×1.15 = 121.9 → 122 ／ 1げき 10.6×1.15 = 12.2 → 12）', [122, 12], [rh.e.maxHp, hitsBy(rh, 'e')[0].dmg]);
  // ぬし：段階10で ふつうの相手の平均 × 1.5 ／ × 1.1
  var rb = fight({ parts: [] }, S.BOSS, 'plain', { stage: 10 });
  row('やまの ぬし', 'たいりょく 75.5×1.06×1.9×1.5 = 228、こうげき 10.3×1.06×1.9×1.1 = 22.8（かたい・かいふく、ツノ・コウラ・ふといしっぽ）', [228, 22.8], [rb.e.maxHp, Math.round(rb.ef.baseAtk * 10) / 10]);
  // さいだいの いちげき
  var rm = fight({ parts: ['horn', 'weight'] }, dummy());
  row('さいだいの いちげき', '自分の 1げき・はんげきの 最大（ツノ 37）', { dmg: 37, label: 'ツノ' }, rm.summary.maxHit);
})();

// ======================= 出力 =======================
console.log('| 札 | 文 | 期待 | 実測 | 一致 |');
console.log('|---|---|---|---|---|');
rows.forEach(function (r) { console.log('| ' + r.card + ' | ' + r.text + ' | ' + fmt(r.expect) + ' | ' + fmt(r.actual) + ' | ' + (r.ok ? '○' : '✕') + ' |'); });
console.log('');
console.log(rows.length + ' 件中 ' + (rows.length - fails) + ' 件 一致、' + fails + ' 件 不一致');
process.exit(fails ? 1 : 0);
