// でこもん 版8 — 文字どおりテスト（Node で実行: node tests.js）
// 札の文に書いてあることが、そのとおりに起きるかを 1つずつ確かめる。乱れなし（variance 0）。
// 出力は REPORT.md に貼る表（札・文・期待・実測・一致）。1つでも合わなければ 終了コード 1。
'use strict';
var S = require('./sim.js');
var CFG = S.CFG;
// 決定 21-d：札の 文の テストは 段階の 倍率（相手 ×1.06）で 数を 書いている。序盤（1・2戦目）の やさしさ CFG.early は ここでは 切り、下の「序盤の やさしさ」で 別に 確かめる
var EARLY0 = CFG.early.slice(); CFG.early = [1, 1];
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
  // おおぐい：あいてを たおすたび たいりょくの 上限 +ooguiStep（周回のあいだ残る。+ooguiCap まで）
  var st = CFG.lv2.ooguiStep, cap = CFG.lv2.ooguiCap, base = CFG.playerHp;
  var r = fight({ parts: ['leech'], lv2: ['leech'] }, dummy({ hp: 20, spd: 1 }));
  var up = evs(r, function (ev) { return ev.t === 'maxUp'; });
  var koAt = evs(r, function (ev) { return ev.t === 'ko'; })[0];
  var lastT = r.hands[r.hands.length - 1].events.map(function (ev) { return ev.t; });
  row('Lv2 おおぐい', S.PART_BY_ID.leech.lv2text + '（たおした 手の ko の あとに 1回）', { n: 1, amt: st, maxHp: base + st, total: st, afterKo: true, sum: st },
    { n: up.length, amt: up[0] && up[0].amt, maxHp: up[0] && up[0].maxHp, total: up[0] && up[0].total, afterKo: !!(up[0] && koAt && up[0].handNo === koAt.handNo && lastT.indexOf('maxUp') > lastT.indexOf('ko')), sum: r.summary.oogui });
  // 周回のあいだ残る：grow.oogui に足して 次の戦いへ。たおすたびに増え、上限で とまる
  var grow = S.emptyGrow(), starts = [], gains = [];
  for (var b = 0; b < 10; b++) {
    var rb = fight({ parts: ['leech'], lv2: ['leech'], grow: grow }, dummy({ hp: 20, spd: 1 }));
    starts.push(rb.pf.maxHp - (rb.summary.oogui || 0)); gains.push(rb.summary.oogui);
    grow.oogui = (grow.oogui || 0) + rb.summary.oogui;
  }
  var expStarts = [], expGains = [], acc = 0;
  for (var b2 = 0; b2 < 10; b2++) { expStarts.push(base + acc); var g = Math.min(st, cap - acc); expGains.push(g); acc += g; }
  row('Lv2 おおぐい', '周回のあいだ残る：つぎの戦いは ふえた 上限で 始まる（10戦の 始めの 上限）', expStarts, starts);
  row('Lv2 おおぐい', '+' + cap + ' で とまる（10戦の ふえた量）', expGains, gains);
  row('Lv2 おおぐい', '合計は +' + cap + '（上限 ' + (base + cap) + '）', { total: cap, maxHp: base + cap }, { total: grow.oogui, maxHp: S.playerDef(grow).hp });
  // 途中セーブ：grow ごと JSON で保存して 読み込んでも 残る
  var loaded = JSON.parse(JSON.stringify({ grow: grow })).grow;
  row('Lv2 おおぐい', '途中セーブ（grow を 保存して 読み込む）でも ふえた 上限は 残る', base + cap, S.makeFighter('p', S.playerDef(loaded, 'テスト'), ['leech'], 1, ['leech']).maxHp);
  // 付けていない・まけた・16手の判定勝ち では ふえない
  var rn = fight({ parts: ['claw'], lv2: ['leech'] }, dummy({ hp: 20, spd: 1 }));
  var rl = fight({ parts: ['leech'], lv2: ['leech'] }, dummy({ hp: 10000, atk: 60, spd: 1 }));
  var rt = fight({ parts: ['leech'], lv2: ['leech'] }, dummy({ hp: 10000, atk: 1, spd: 1 }));
  row('Lv2 おおぐい', 'すいつくくちを 付けていない／まけた／16手の 判定勝ち では ふえない', { notOn: 0, lose: 0, timeout: 0, tWin: 'p' }, { notOn: rn.summary.oogui, lose: rl.summary.oogui, timeout: rt.summary.oogui, tWin: rt.timeout ? rt.winner : 'not-timeout' });
  // Lv1 では ふえない
  var r1 = fight({ parts: ['leech'] }, dummy({ hp: 20, spd: 1 }));
  row('Lv2 おおぐい', 'Lv1 の すいつくくちでは ふえない', 0, r1.summary.oogui);
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
  row('やまの ぬし', 'たいりょく 75.5×1.06×1.9×1.6 = 243、こうげき 10.3×1.06×1.9×1.1 = 22.8（＋おもい +3）。おもい・かいふく、ツノ・おもし・ふさふさ', [243, 22.8, 'heavy,regen', 'horn,weight,fur'], [rb.e.maxHp, Math.round(rb.ef.baseAtk * 10) / 10, S.BOSS.traits.join(','), S.BOSS.parts.join(',')]);
  // さいだいの いちげき
  var rm = fight({ parts: ['horn', 'weight'] }, dummy());
  row('さいだいの いちげき', '自分の 1げき・はんげきの 最大（ツノ 37）', { dmg: 37, label: 'ツノ' }, rm.summary.maxHit);
})();

// ======================= 版7・版8：報酬の順（版8で「新しいパーツを先」に固定）・なれ +10・噛み合い 9〜11 =======================
(function () {
  var T = S.ENEMY_BY_ID.turtle; // イシガメ：コウラ・ツノ
  var ALL = S.PART_IDS.slice();
  var others = ALL.filter(function (id) { return id !== 'shell' && id !== 'horn'; });
  var rng = function () { return S.makeRng(5); };
  var kinds = function (rs) { return rs.map(function (r) { return r.kind + ':' + r.part; }); };
  // 1 相手のパーツで 持っていないもの → 拾う
  var r1 = S.rewardsFor(T, [], [], rng(), false);
  row('報酬の順 1', '相手のパーツ（コウラ・ツノ）で 持っていないもの → 拾う', { n: 1, kind: 'part', fromEnemy: true }, { n: r1.length, kind: r1[0] && r1[0].kind, fromEnemy: !!r1[0] && T.parts.indexOf(r1[0].part) >= 0 });
  // 2 無ければ 16種で 持っていないもの → 拾う（版8：相手のパーツを 持っていても、新しいパーツが 先）
  var r2 = S.rewardsFor(T, ['shell', 'horn'], [], rng(), false);
  row('報酬の順 2', '相手のパーツを 両方 持っている（Lv2 でない）→ 16種で 持っていないものを 拾う（なれ +10 より 先）', { n: 1, kind: 'part', notOwned: true }, { n: r2.length, kind: r2[0] && r2[0].kind, notOwned: !!r2[0] && others.indexOf(r2[0].part) >= 0 });
  // 3 無ければ 相手のパーツで Lv2 でないもの → なれ +10（16種 全部 持っているとき）
  var r3 = S.rewardsFor(T, ALL, [], rng(), false);
  row('報酬の順 3', '16種 全部 持っていて 相手のパーツは Lv2 でない → 相手のパーツの なれ +10', { n: 1, kind: 'nare', amt: 10, fromEnemy: true }, { n: r3.length, kind: r3[0] && r3[0].kind, amt: r3[0] && r3[0].amt, fromEnemy: !!r3[0] && T.parts.indexOf(r3[0].part) >= 0 });
  // 4 無ければ 持っている Lv2 でないパーツ → なれ +10
  var r4 = S.rewardsFor(T, ALL, ['shell', 'horn'], rng(), false);
  row('報酬の順 4', '16種 全部 持っていて 相手のパーツは Lv2 → 持っている Lv2 でないパーツの なれ +10', { n: 1, kind: 'nare', notLv2: true }, { n: r4.length, kind: r4[0] && r4[0].kind, notLv2: !!r4[0] && others.indexOf(r4[0].part) >= 0 });
  // 5 無ければ なし
  var r5 = S.rewardsFor(T, ALL, ALL, rng(), false);
  row('報酬の順 5', '16種 全部 持っていて 全部 Lv2 → なし', 0, r5.length);
  // 版8：newFirst の切り替えは 消えた
  row('報酬の順（版8）', 'CFG.nare.newFirst は 消した（順は 1つだけ）', true, S.CFG.nare.newFirst === undefined);
  // てごわいの 2つ目：持っていない中から 1つ
  var r6 = S.rewardsFor(T, ALL.filter(function (id) { return id !== 'wing' && id !== 'fang'; }), [], rng(), true);
  row('てごわいの 2つ目', '持っていないのが はね・キバ の 2つ → 1つ目と 2つ目で 両方 拾う（別のもの）', { kinds: ['part', 'part'], set: 'fang,wing' }, { kinds: kinds(r6).map(function (k) { return k.split(':')[0]; }), set: r6.map(function (x) { return x.part; }).sort().join(',') });
  var r6b = S.rewardsFor(T, ALL.filter(function (id) { return id !== 'wing'; }), [], rng(), true);
  row('てごわいの 2つ目', '持っていないのが はね だけ → 1つ目 はね を 拾い、2つ目は 持っている Lv2 でないパーツの なれ +10', ['part:wing', 'nare'], [r6b[0] && (r6b[0].kind + ':' + r6b[0].part), r6b[1] && r6b[1].kind]);
  // てごわいの 2つ目：無ければ 持っている Lv2 でないパーツ（1つ目と別）の なれ +10
  var r7 = S.rewardsFor(T, ALL, [], rng(), true);
  row('てごわいの 2つ目', '16種 全部 持っている → 2つ目は 1つ目と別の パーツの なれ +10', { n: 2, kinds: ['nare', 'nare'], different: true }, { n: r7.length, kinds: kinds(r7).map(function (k) { return k.split(':')[0]; }), different: r7.length === 2 && r7[0].part !== r7[1].part });
  // てごわいの 2つ目：無ければ なし（Lv2 でないのが 1つだけ）
  var r8 = S.rewardsFor(T, ALL, ALL.filter(function (id) { return id !== 'fang'; }), rng(), true);
  row('てごわいの 2つ目', 'なれ を付けられるのが キバ 1つだけ → 1つ目 キバの なれ +10、2つ目 なし', ['nare:fang'], kinds(r8));
  // なれ +10 を 0 にすると（A/B の B）：その報酬は なし
  var dup = CFG.nare.dup; CFG.nare.dup = 0;
  var r9 = S.rewardsFor(T, ALL, [], rng(), true);
  CFG.nare.dup = dup;
  row('なれ +10 なし（A/B）', 'nare.dup = 0 のとき 16種 全部 持っていれば なし', 0, r9.length);
  // なれ +10：spark.nare に足され、満タンを超えたあとの 最初の発動で 必ず ひらめく
  var nare = { fang: 12 };
  var ap = S.applyReward({ kind: 'nare', part: 'fang', amt: 10 }, ['fang'], nare, []);
  row('なれ +10', 'なれ 12 の キバに +10 → 22（満タン 20 を超えた）', { to: 22, full: true, stored: 22 }, { to: ap.to, full: ap.full, stored: nare.fang });
  var pf = S.makeFighter('p', S.playerDef(null, 'テスト'), ['fang'], 1, []);
  var ef = S.makeFighter('e', dummy(), [], 1, []);
  var rs = S.simulateBattle(pf, ef, 'plain', { rng: S.makeRng(3), spark: { stage: 1, pity: 0, nare: nare } });
  var sp = evs(rs, function (ev) { return ev.t === 'spark'; })[0];
  var firstAct = evs(rs, function (ev) { return ev.t === 'act' && ev.part === 'fang'; })[0];
  row('なれ +10', 'そのあとの 最初の発動（なれ 23 > 20）で 必ず ひらめく（by: nare）', { part: 'fang', by: 'nare', hand: 1, n: 23 }, { part: sp && sp.part, by: sp && sp.by, hand: sp && sp.handNo, n: firstAct && firstAct.n });
  var ap2 = S.applyReward({ kind: 'nare', part: 'fang', amt: 10 }, ['fang'], { fang: 3 }, ['fang']);
  row('なれ +10', 'Lv2 のパーツには なれ が付かない（applyReward は null）', null, ap2);
  var ap3 = S.applyReward({ kind: 'nare', part: 'fang', amt: 10 }, ['fang'], { fang: 3 }, []);
  row('なれ +10', 'なれ 3 → 13 は まだ 満タンでない', { to: 13, full: false }, { to: ap3.to, full: ap3.full });
  // 噛み合い 3 が 消えて、9・10・11 が ある（版8：10・11 は 差し替え）
  row('噛み合いの一覧', '3「じょうたい＋ひかるめ」は なく、9・10・11 と 技 入りの 12〜15 が ある（14 こ）。10 ふきとばし＋ばねあし、11 かいたい＋ツノ', { n: 14, ids: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], has3: false, n10: 'ふきとばし＋ばねあし', n11: 'かいたい＋ツノ' }, { n: S.SYNERGIES.length, ids: S.SYNERGIES.map(function (x) { return x.id; }), has3: !!S.SYN_BY_ID[3], n10: S.SYN_BY_ID[10].name, n11: S.SYN_BY_ID[11].name });
  row('噛み合いの文', '図鑑の文は 2行まで（40文字 以下）', true, S.SYNERGIES.every(function (x) { return x.desc.length <= 40; }));
  // 9 はじく＋トゲ：起きる（相手の 1げき 11−4 = 7 ≤ 10 → 0 に はじく → 同じ 1げきで トゲの はんげき）
  var r10 = fight({ parts: ['scale', 'spike'], lv2: ['scale'] }, dummy({ spd: 20 }));
  var h10 = r10.hands[0].events.map(function (ev) { return ev.t + (ev.deflect ? '(0)' : '') + (ev.id ? ev.id : ''); });
  row('はじく＋トゲ', S.SYN_BY_ID[9].desc, ['hit(0)', 'act', 'counter', 'synergy9'], h10.slice(0, 4));
  // 9 起きない：うろこが Lv1（はじかない）
  var r11 = fight({ parts: ['scale', 'spike'], lv2: [] }, dummy({ spd: 20 }));
  row('はじく＋トゲ', 'うろこが Lv1 なら はじかないので 起きない（はんげきは 出る）', { syn9: false, counters: true }, { syn9: r11.summary.synergies.some(function (x) { return x.id === 9; }), counters: countersBy(r11, 'p').length > 0 });
  // 10 ふきとばし＋ばねあし：起きる（自分の 3手め：ばねあしで 2かい、ツノ Lv2 の 1げきで 相手の つぎの手が とぶ → 相手の手が とんで 自分の 4手めが つづく）
  var r12 = fight({ parts: ['horn', 'spring'], lv2: ['horn'] }, dummy({ spd: 5 }));
  var dbl12 = r12.hands.filter(function (h) { return h.actor === 'p' && h.events.some(function (ev) { return ev.t === 'double'; }); })[0];
  var i12 = r12.hands.indexOf(dbl12);
  var seq12 = r12.hands.slice(i12, i12 + 3).map(function (h) { return h.actor + (h.events.some(function (ev) { return ev.t === 'skip'; }) ? ':skip' : ':' + h.events.filter(function (ev) { return ev.t === 'hit'; }).length + 'hits'); });
  row('ふきとばし＋ばねあし', S.SYN_BY_ID[10].desc, { hits: 2, blown: true, syn10: true, seq: ['p:2hits', 'e:skip', 'p:1hits'] }, { hits: dbl12.events.filter(function (ev) { return ev.t === 'hit'; }).length, blown: dbl12.events.some(function (ev) { return ev.t === 'blown'; }), syn10: dbl12.events.some(function (ev) { return ev.t === 'synergy' && ev.id === 10; }), seq: seq12 });
  // 10 起きない：ツノが Lv1 なら とばさない（ツノ＋ばねあし（2）は 起きる）
  var r13 = fight({ parts: ['horn', 'spring'], lv2: [] }, dummy({ spd: 5 }));
  row('ふきとばし＋ばねあし', 'ツノが Lv1 なら とばさないので 起きない（2「ツノ＋ばねあし」は 起きる）', { syn10: false, syn2: true, blown: 0 }, { syn10: r13.summary.synergies.some(function (x) { return x.id === 10; }), syn2: r13.summary.synergies.some(function (x) { return x.id === 2; }), blown: evs(r13, function (ev) { return ev.t === 'blown'; }).length });
  // 10 起きない：ぬま では ばねあしが 2かい こうげきできない（ふきとばしは 出る）
  var r13m = fight({ parts: ['horn', 'spring'], lv2: ['horn'] }, dummy({ spd: 5 }), 'mud');
  row('ふきとばし＋ばねあし', 'ぬま では ばねあしが 1かいなので 起きない（ふきとばしは 出る）', { syn10: false, blown: true }, { syn10: r13m.summary.synergies.some(function (x) { return x.id === 10; }), blown: evs(r13m, function (ev) { return ev.t === 'blown'; }).length > 0 });
  // 11 かいたい＋ツノ（昼の作業で差し替え）：起きる。相手の コウラが かいたいで こわれている ところから、自分の 3手め（ツノの手）が すぐ来るように ownHands を 2 に。
  //   コウラが こわれているので ツノの 1げきは へらない（13 × 2.5 = 32.5 → 33。こわれていなければ −33% で 22）
  function syn11(r) { return r.summary.synergies.some(function (x) { return x.id === 11; }); }
  function syn11first(r) { // 自分の 最初の ツノの手 だけで 見る
    var h = r.hands.filter(function (x) { return x.actor === 'p' && x.events.some(function (ev) { return ev.t === 'hit' && ev.horn; }); })[0];
    return !!h && h.events.some(function (ev) { return ev.t === 'synergy' && ev.id === 11; });
  }
  function hornHit(r) { var h = evs(r, function (ev) { return ev.t === 'hit' && ev.side === 'p' && ev.horn; })[0]; return h ? h.dmg : null; }
  function fight11(lv2, broken) {
    var pp = S.makeFighter('p', S.playerDef(null, 'テスト'), ['crush', 'horn'], 1, lv2);
    var ee = S.makeFighter('e', dummy({ spd: 5, parts: ['shell'] }), ['shell'], 1, []);
    if (broken) { ee.active.shell = false; ee.broken.shell = 3; }
    pp.ownHands = 2;
    return S.simulateBattle(pp, ee, 'plain', { variance: 0, rng: S.makeRng(1) });
  }
  var r14 = fight11(['crush'], true);
  row('かいたい＋ツノ', S.SYN_BY_ID[11].desc + '（コウラが こわれている ところから。ツノは へらずに 33）', { horn: 33, syn11: true }, { horn: hornHit(r14), syn11: syn11first(r14) });
  // 11 起きない：パーツが こわれていなければ（コウラで 22 に へる）
  var r15 = fight11(['crush'], false);
  row('かいたい＋ツノ', 'パーツが こわれていない あいてでは 起きない（最初の ツノの手。コウラで 22 に へる）', { horn: 22, syn11: false }, { horn: hornHit(r15), syn11: syn11first(r15) });
  // 11 起きない：くだくツメが Lv1（かいたい なし）なら、こわれていても 噛み合いでは ない
  var r16 = fight11([], true);
  row('かいたい＋ツノ', 'くだくツメが Lv1 なら（かいたいで こわしたのでは ないので）起きない', { horn: 33, syn11: false }, { horn: hornHit(r16), syn11: syn11(r16) });
  // 11 実戦の形：イシガメ（コウラ・ツノ）に くだくツメ Lv2＋ツノ で、もろく → こわす → ツノ の順が そろえば 起きる
  var fired11 = 0;
  for (var sd = 1; sd <= 60; sd++) { var rf = fight({ parts: ['crush', 'horn', 'fang'], lv2: ['crush'] }, S.ENEMY_BY_ID.turtle, 'plain', { rng: S.makeRng(sd) }); if (syn11(rf)) fired11++; }
  row('かいたい＋ツノ', 'イシガメ 相手に 60 戦（乱数の種 1〜60）で 1回以上 起きる', true, fired11 > 0);
})();

// ======================= 版8：卵（継いだパーツ・おやの ひらめき・名前） =======================
(function () {
  // startItems に 継ぐパーツを 渡すと、6つのうち 1つが それ。同じ場所のパーツは 選ばれない。せめ・まもり・うごき は そろう
  var allOk = true, locOk = true, catOk = true, nOk = true;
  for (var sd = 1; sd <= 200; sd++) {
    var pid = S.PART_IDS[sd % 16];
    var items = S.startItems(S.makeRng(sd), pid);
    if (items.indexOf(pid) < 0) allOk = false;
    if (items.length !== 6 || new Set(items).size !== 6) nOk = false;
    var loc = S.PART_BY_ID[pid].loc;
    if (items.filter(function (id) { return S.PART_BY_ID[id].loc === loc; }).length !== 1) locOk = false;
    ['atk', 'def', 'mov'].forEach(function (c) { if (!items.some(function (id) { return S.PART_BY_ID[id].cat === c; })) catOk = false; });
  }
  row('卵：始めの もちもの', '継ぐパーツが 6つのうちの 1つ。同じ場所のパーツは 選ばれない。せめ・まもり・うごき が そろう（種 1〜200 × 16種）', { has: true, six: true, loc: true, cat: true }, { has: allOk, six: nOk, loc: locOk, cat: catOk });
  // 決定 21-b：はじめての 周回（few）は せめ・まもり・うごき 1つずつの 3つ。3つとも 場所が ちがう（全部 つけられる）。卵が あれば few は 無視
  var fewN = true, fewCat = true, fewLoc = true;
  for (var fs = 1; fs <= 300; fs++) {
    var fi = S.startItems(S.makeRng(fs), null, true);
    if (fi.length !== 3) fewN = false;
    if (fi.map(function (id) { return S.PART_BY_ID[id].cat; }).join(',') !== 'atk,def,mov') fewCat = false;
    if (new Set(fi.map(function (id) { return S.PART_BY_ID[id].loc; })).size !== 3) fewLoc = false;
  }
  var fewEgg = S.startItems(S.makeRng(9), 'fang', true);
  row('はじめての 周回：始めの もちもの', 'few なら 3つ（せめ・まもり・うごき の 順に 1つずつ・場所は みな ちがう。種 1〜300）。卵（継ぐ パーツ あり）なら いつもの 6つ', { n3: true, cat: true, loc: true, egg6: true }, { n3: fewN, cat: fewCat, loc: fewLoc, egg6: fewEgg.length === 6 && fewEgg.indexOf('fang') >= 0 });
  var plain = S.startItems(S.makeRng(7)), plain2 = S.startItems(S.makeRng(7), null);
  row('卵：始めの もちもの', '継がないときは いままでと 同じ（乱数の使い方も 同じ）', true, JSON.stringify(plain) === JSON.stringify(plain2) && plain.length === 6);
  // 継いだパーツは なれ full+1 で始まり、1戦目の 最初の発動で 必ず ひらめく（by: parent）
  var nare = {}; nare.fang = CFG.nare.full + 1;
  var pf = S.makeFighter('p', S.playerDef(null, 'テスト'), ['fang'], 1, []);
  var ef = S.makeFighter('e', dummy(), [], 1, []);
  var rs = S.simulateBattle(pf, ef, 'plain', { rng: S.makeRng(3), spark: { stage: 1, pity: 0, nare: nare, parent: 'fang' } });
  var sp = evs(rs, function (ev) { return ev.t === 'spark'; })[0];
  var firstAct = evs(rs, function (ev) { return ev.t === 'act' && ev.part === 'fang'; })[0];
  row('卵：おやの ひらめき', '継いだパーツ（なれ 21）は 最初の発動で 必ず ひらめく。spark の by は parent', { part: 'fang', by: 'parent', hand: 1, firstAct: 1, resBy: 'parent' }, { part: sp && sp.part, by: sp && sp.by, hand: sp && sp.handNo, firstAct: firstAct && firstAct.handNo, resBy: rs.sparkBy });
  // 継いだパーツを 付けなければ 起きない（ほかのパーツは ふつうの ひらめき）
  var rs2 = S.simulateBattle(S.makeFighter('p', S.playerDef(null, 'テスト'), ['claw'], 1, []), S.makeFighter('e', dummy(), [], 1, []), 'plain', { rng: S.makeRng(3), spark: { stage: 1, pity: 0, nare: nare, parent: 'fang' } });
  row('卵：おやの ひらめき', '継いだパーツを 付けていなければ おやの ひらめきは 起きない', false, rs2.sparkBy === 'parent');
  // なれ満タン（parent でない）は by: nare のまま
  var rs3 = S.simulateBattle(S.makeFighter('p', S.playerDef(null, 'テスト'), ['fang'], 1, []), S.makeFighter('e', dummy(), [], 1, []), 'plain', { rng: S.makeRng(3), spark: { stage: 1, pity: 0, nare: { fang: 21 } } });
  row('卵：おやの ひらめき', 'ふつうの なれ満タンは by: nare のまま（parent を 渡していない）', 'nare', rs3.sparkBy);
  // 名前：親の頭の文字を継ぐ
  var heads = ['ぺっごか', 'えーい', 'あい', 'ぬ'].map(S.nameHead);
  row('卵：名前の頭', '頭の文字は 1文字。2文字めが「っ」「ー」なら 2文字', ['ぺっ', 'えー', 'あ', 'ぬ'], heads);
  var okName = true;
  for (var sd2 = 1; sd2 <= 300; sd2++) { var nm = S.makeName(S.makeRng(sd2), 'ぺっ'); if (nm.slice(0, 2) !== 'ぺっ' || nm.length < 3 || nm.length > 4) okName = false; var nm2 = S.makeName(S.makeRng(sd2), 'あ'); if (nm2.charAt(0) !== 'あ' || nm2.length < 2 || nm2.length > 4) okName = false; }
  row('卵：名前', '子の名前は 親の頭の文字から 始まり、2〜4文字（種 1〜300）', true, okName);
})();

// ======================= 2026-10-27 決定 10-A：てごわいの 戦いでは なれが 2倍 =======================
(function () {
  function battle(hard, nare) {
    var pf = S.makeFighter('p', S.playerDef(null, 'テスト'), ['fang'], 1, []);
    var ef = S.makeFighter('e', dummy(), [], 1, [], { hard: hard });
    return S.simulateBattle(pf, ef, 'plain', { rng: S.makeRng(5), variance: 0, spark: { stage: 1, pity: 0, nare: nare || {} } });
  }
  var rH = battle(true), rN = battle(false);
  var aH = evs(rH, function (ev) { return ev.t === 'act' && ev.part === 'fang'; }), aN = evs(rN, function (ev) { return ev.t === 'act' && ev.part === 'fang'; });
  row('てごわい：なれ ×2', 'てごわいの 相手では 発動1回で なれ +2（1回目 2・2回目 4）。発動の 回数は そのまま', { step: 2, n1: 2, n2: 4, gain: 2 * aH.length, acts: aH.length },
    { step: aH[0] && aH[0].step, n1: aH[0] && aH[0].n, n2: aH[1] && aH[1].n, gain: rH.summary.nareGain.fang, acts: rH.summary.activations.fang });
  row('てごわい：なれ ×2', 'ふつうの 相手では 発動1回で なれ +1', { step: 1, n1: 1, gain: aN.length }, { step: aN[0] && aN[0].step, n1: aN[0] && aN[0].n, gain: rN.summary.nareGain.fang });
  // 満タン 20 を 超えた 発動で 必ず ひらめく（19 → 21）
  var pf = S.makeFighter('p', S.playerDef(null, 'テスト'), ['fang'], 1, []);
  var ef = S.makeFighter('e', dummy(), [], 1, [], { hard: true });
  var rs = S.simulateBattle(pf, ef, 'plain', { rng: S.makeRng(3), spark: { stage: 1, pity: 0, nare: { fang: S.CFG.nare.full - 1 } } });
  var sp = evs(rs, function (ev) { return ev.t === 'spark'; })[0];
  var a1 = evs(rs, function (ev) { return ev.t === 'act' && ev.part === 'fang'; })[0];
  row('てごわい：なれ ×2', 'なれ 19 で てごわい → 最初の発動で 21（満タン 20 を超えた）→ 必ず ひらめく（by: nare）', { n: S.CFG.nare.full + 1, part: 'fang', by: 'nare', hand: 1 }, { n: a1 && a1.n, part: sp && sp.part, by: sp && sp.by, hand: sp && sp.handNo });
  // キーで 切れる（nareMul 1 なら 前と 同じ）
  var m0 = S.CFG.hard.nareMul; S.CFG.hard.nareMul = 1; var rOff = battle(true); S.CFG.hard.nareMul = m0;
  var aOff = evs(rOff, function (ev) { return ev.t === 'act' && ev.part === 'fang'; });
  row('てごわい：なれ ×2', 'CFG.hard.nareMul = 1 なら てごわいでも +1（前と 同じ）', { step: 1, gain: aOff.length }, { step: aOff[0] && aOff[0].step, gain: rOff.summary.nareGain.fang });
  // Lv2 の パーツには なれが たまらない
  var pl = S.makeFighter('p', S.playerDef(null, 'テスト'), ['fang'], 1, ['fang']);
  var el2 = S.makeFighter('e', dummy(), [], 1, [], { hard: true });
  var rl = S.simulateBattle(pl, el2, 'plain', { rng: S.makeRng(5), variance: 0, spark: { stage: 1, pity: 0, nare: {} } });
  row('てごわい：なれ ×2', 'Lv2 の パーツには なれが たまらない', 0, rl.summary.nareGain.fang || 0);
})();

// ======================= 2026-10-27 決定 12：試遊の 記録（kiroku.js。ルールは 変えない） =======================
(function () {
  var KR = require('./kiroku.js');
  var t0 = new Date(2026, 9, 27, 21, 5);
  var st = KR.empty();
  var r1 = KR.newRun(st, { ver: 'v', name: 'ぺっご', gen: 1, egg: null }, t0);
  var r2 = KR.newRun(st, { ver: 'v', name: 'ぺっか', gen: 2, egg: { parentName: 'ぺっご', part: 'horn' } }, t0);
  row('記録', '新しい 周回を 始めると、終わっていない 前の 周回は「とちゅうで やめた」になる。たまごは 親と 継いだ パーツ',
    { n: 2, ab: true, kind: 'egg', parent: 'ぺっご', inherit: 'horn', open: null }, { n: st.runs.length, ab: !!(r1.end && r1.end.abandoned), kind: r2.kind, parent: r2.parent, inherit: r2.inherit, open: r2.end });
  KR.addTime(r2, 0, 'pre', 12.34); KR.addTime(r2, 0, 'pre', 1); KR.addTime(r2, 1, 'fork', 3);
  var b = { no: 1, hard: true, enemy: 'wolf', field: 'wind', other: null, parts: ['horn'], win: true, hands: 5, timeout: false, spark: null, sparkBy: null, synergies: [], waza: [], got: [] };
  KR.addBattle(r2, b); KR.addBattle(r2, Object.assign({}, b, { hands: 6 })); KR.addBattle(r2, Object.assign({}, b, { no: 2, hard: false, win: false }));
  row('記録', '画面に いた 秒は 戦いごとに 足す（0.1秒の 単位）。同じ 戦いは 2回 入れない（新しい方）',
    { sec0: { pre: 13.3 }, sec1: { fork: 3 }, nb: 2, hands1: 6 }, { sec0: r2.sec[0], sec1: r2.sec[1], nb: r2.battles.length, hands1: r2.battles[0].hands });
  KR.endRun(r2, { wins: 1, maxHit: { dmg: 30, label: 'ツノ' }, lostTo: 'frog', boss: false }, t0);
  KR.addTime(r2, 1, 'win', 5); KR.addBattle(r2, Object.assign({}, b, { no: 3 }));
  row('記録', '終わった 周回には もう 足さない', { wins: 1, lostTo: 'frog', nb: 2, sec1: { fork: 3 } }, { wins: r2.end.wins, lostTo: r2.end.lostTo, nb: r2.battles.length, sec1: r2.sec[1] });
  row('記録', '噛み合いは 1戦で 1つに まとめて 回数。図鑑に 無かったものは first。相手の 噛み合いは 入れない',
    [{ id: 3, n: 2, first: true }, { id: 5, n: 1, first: false }], KR.synergyList([{ id: 3, side: 'p' }, { id: 5, side: 'p' }, { id: 3, side: 'p' }, { id: 7, side: 'e' }], [5]));
  var big = KR.empty(); for (var i = 0; i < KR.MAX_RUNS + 5; i++) KR.newRun(big, { name: 'n' + i }, t0);
  row('記録', '周回は 最大 ' + KR.MAX_RUNS + '（古いものから 消える）', { n: KR.MAX_RUNS, first: 'n5' }, { n: big.runs.length, first: big.runs[0].name });
  var ex = KR.exportData(st, S, t0);
  row('記録', '書き出しは 先頭に 説明と 辞書。秒は 戦いの 中に 入る（しまってある 形は 変えない）',
    { setsumei: true, horn: S.PART_BY_ID.horn.name, boss: S.BOSS.name, sec: { pre: 13.3 }, mada: [], kept: true, file: 'dekomon-kiroku-20261027-2105.json', at: '2026-10-27 21:05' },
    { setsumei: !!ex._setsumei && Object.keys(ex)[0] === '_setsumei', horn: ex.jisho.parts.horn, boss: ex.jisho.enemies.boss, sec: ex.runs[1].battles[0].sec, mada: ex.runs[1].secMada, kept: Array.isArray(st.runs[1].sec) && st.runs[1].battles[0].sec === undefined, file: KR.fileName(t0), at: ex.kakidashita.slice(0, 16) });
  var st2 = KR.empty(), r3 = KR.newRun(st2, { name: 'x' }, t0); KR.addTime(r3, 0, 'pre', 20); KR.addBattle(r3, Object.assign({}, b, { no: 1 })); KR.addTime(r3, 1, 'fork', 7);
  row('記録', '終わっていない 戦いの 秒も 書き出す（secMada）', [{ no: 2, sec: { fork: 7 } }], KR.exportData(st2, S, t0).runs[0].secMada);
  // 決定 13：種類と 技を 記録に
  var st3 = KR.empty(), r4 = KR.newRun(st3, { name: 'ぴょ', species: 'pyun', waza: ['suki', 'renda'] }, t0);
  KR.addBattle(r4, Object.assign({}, b, { waza: KR.wazaList({ renda: 3, suki: 1 }) }));
  var r5 = KR.newRun(st3, { name: 'な' }, t0);
  var ex3 = KR.exportData(st3, S, t0), sm3 = KR.summarize(ex3).join('\n');
  row('記録', '種類と 技（わざ なしの 周回には 無い）・技の 発動は [{ id, n }]・辞書と 要約に 種類と 技',
    { sp: 'pyun', wz: ['suki', 'renda'], none: false, bw: [{ id: 'renda', n: 3 }, { id: 'suki', n: 1 }], jsp: S.SPECIES_BY_ID.pyun.name, jw: S.WAZA_BY_ID.renda.name, sum: true },
    { sp: r4.species, wz: r4.waza, none: 'species' in r5, bw: ex3.runs[0].battles[0].waza, jsp: ex3.jisho.species.pyun, jw: ex3.jisho.waza.renda, sum: sm3.indexOf(S.SPECIES_BY_ID.pyun.name + ' 1') >= 0 && sm3.indexOf(S.WAZA_BY_ID.renda.name + ' 3') >= 0 });
  var sm = KR.summarize(ex).join('\n');
  row('記録', '要約に 勝ち数・てごわいの 割合・よく つけた パーツ・負けた 相手', { hard: true, part: true, lost: true },
    { hard: sm.indexOf('てごわいを 選んだ 割合：50%（1/2）') >= 0, part: sm.indexOf(S.PART_BY_ID.horn.name + ' 2') >= 0, lost: sm.indexOf('負けた 相手：' + S.ENEMY_BY_ID.frog.name + ' 1') >= 0 });
  row('記録', 'こわれた 記録は 空として 読む・中の こわれた 戦いや 秒は 捨てる（途中セーブとは 別）', { a: 0, b: 0, c: 1, d: 1, sec: [{}, { pre: 1 }] }, (function () { var n = KR.normalize({ runs: [null, { battles: [null, { no: 1 }], sec: [null, { pre: 1 }] }] }); KR.addTime(n.runs[0], 0, 'pre', 0); KR.addBattle(n.runs[0], { no: 2 });
      return { a: KR.normalize(null).runs.length, b: KR.normalize({ runs: 'x' }).runs.length, c: n.runs.length, d: n.runs[0].battles.length - 1, sec: n.runs[0].sec }; })());
})();

// ======================= モンスターの 種類と 技（決定 13。CFG.waza.on で 切りかえ）=======================
(function () {
  var on0 = CFG.waza.on;
  function fixed(v) { var f = function () { return v; }; f.getState = function () { return 0; }; return f; }
  // 技つきの 戦い。mon = { species, waza? }。rngV を 渡すと 確率の 技は いつも その値（0.1 なら 出る・0.9 なら 出ない）
  function fightW(mon, p, e, opts) {
    opts = opts || {};
    CFG.waza.on = true;
    var pf = S.makeFighter('p', S.playerDef(p.grow || null, 'テスト', mon), p.parts || [], 1, p.lv2 || []);
    var ef = S.makeFighter('e', e, e.parts || [], 1, [], {});
    var res = S.simulateBattle(pf, ef, opts.field || 'plain', { variance: 0, rng: opts.rngV !== undefined ? fixed(opts.rngV) : S.makeRng(1) });
    CFG.waza.on = on0;
    res.pf = pf; return res;
  }
  function ownHits(res) { // 自分の手ごとの 1げきの ダメージ
    var out = [];
    res.hands.forEach(function (h) { if (h.actor !== 'p') return; out.push(h.events.filter(function (ev) { return ev.t === 'hit' && ev.side === 'p'; }).map(function (ev) { return ev.dmg; })); });
    return out;
  }
  function wazaEvs(res, id) { return evs(res, function (ev) { return ev.t === 'waza' && ev.id === id; }); }

  CFG.waza.on = false;
  var off = S.playerDef(null, 'x', { species: 'pyun' });
  CFG.waza.on = true;
  var onP = S.playerDef(null, 'x', { species: 'pyun' }), old = S.playerDef(null, 'x', null), inh = S.playerDef(null, 'x', { species: 'koron', waza: ['nerai', 'kiai', 'renda'] });
  CFG.waza.on = on0;
  row('種類', 'わざ なし（CFG.waza.on = false）なら どの 種類でも いままでの 1種（115／13／10・技なし）', { hp: 115, atk: 13, spd: 10, waza: [] }, { hp: off.hp, atk: off.atk, spd: off.spd, waza: off.waza });
  var PY = S.SPECIES_BY_ID.pyun, KO = S.SPECIES_BY_ID.koron;
  row('種類', 'わざ あり：ぴゅんは ' + PY.hp + '／' + PY.atk + '／' + PY.spd + '、技は すきをつく・れんだ', { hp: PY.hp, atk: PY.atk, spd: PY.spd, waza: ['suki', 'renda'] }, { hp: onP.hp, atk: onP.atk, spd: onP.spd, waza: onP.waza });
  row('種類', '種類の ない 古い 保存は ころん（' + KO.hp + '／' + KO.atk + '／' + KO.spd + '）として 読む。技を 3つ 渡すと 3つ（卵で 継ぐ）', { sp: 'koron', hp: KO.hp, w: ['nerai', 'kiai'], w3: 3 }, { sp: old.species, hp: old.hp, w: old.waza, w3: inh.waza.length });
  row('種類', 'どの 種類も 技は 2つ（そっと 1つ・ここぞ 1つ）', true, S.SPECIES.every(function (sp) { return sp.waza.length === 2 && S.WAZA_BY_ID[sp.waza[0]].kind === 'sotto' && S.WAZA_BY_ID[sp.waza[1]].kind === 'kokozo'; }));
  row('技の文', 'どの 技の 文も 2行まで（46文字 以下＝Lv2 の 文と 同じ）', true, S.WAZA.every(function (w) { return w.text().length <= 46; }));

  // ねらいうち（ころん 13）：キバで どくに した あとの 1げきは +3
  var r1 = fightW({ species: 'koron' }, { parts: ['fang'] }, dummy());
  var NR = CFG.waza.nerai;
  row('ねらいうち', S.wazaText('nerai'), [[13], [13 + NR], [13 + NR]], ownHits(r1).slice(0, 3));
  var r1b = fightW({ species: 'koron' }, { parts: [] }, dummy());
  row('ねらいうち', 'じょうたいの ない あいてには +0', [[13], [13]], ownHits(r1b).slice(0, 2));
  // ふんばり：相手 こうげき 30 → 1げき 32。たいりょく 100 → 68 → 36（半分 50 より すくない）→ 自分の 3手め ×2 → 1戦に 1回
  var r2 = fightW({ species: 'koron' }, { parts: [] }, dummy({ atk: 30 }));
  row('ふんばり', S.wazaText('kiai'), { hits: [[13], [13], [26], [13]], n: 1 }, { hits: ownHits(r2).slice(0, 4), n: wazaEvs(r2, 'kiai').length });
  // かみつきかえし（ごつん 11）：あたったとき（確率を 0.1 に）はんげき 11×0.5 = 5.5 → 6。0.9 なら 出ない。とおくからには とどかない
  var r3 = fightW({ species: 'gotsun' }, { parts: [] }, dummy());
  var r3a = fightW({ species: 'gotsun' }, { parts: [] }, dummy(), { rngV: 0.1 });
  var eHits = hitsBy(r3a, 'e').filter(function (x) { return x.dmg > 0; }).length, ks = countersBy(r3a, 'p');
  row('かみつきかえし', S.wazaText('kamitsuki'), { n: eHits, dmg: 6, waza: 'kamitsuki' }, { n: ks.length, dmg: ks[0] && ks[0].dmg, waza: ks[0] && ks[0].waza });
  var r3b = fightW({ species: 'gotsun' }, { parts: [] }, dummy(), { rngV: 0.9 });
  var r3c = fightW({ species: 'gotsun' }, { parts: [] }, dummy({ traits: ['ranged'] }), { rngV: 0.1 });
  row('かみつきかえし', '確率で 出ないときは 0。とおくからの あいて（はんげきを うけない）にも 0', { no: 0, ranged: 0 }, { no: countersBy(r3b, 'p').length, ranged: countersBy(r3c, 'p').length });
  // ひといき（ごつん。はやさ 8 で あと）：じぶんの 4・8手めの はじめに +12
  var hs = [];
  var own = 0; r3b.hands.forEach(function (h) { if (h.actor !== 'p') return; own++; h.events.forEach(function (ev) { if (ev.t === 'heal' && ev.src === 'ひといき') hs.push([own, ev.amt]); }); });
  row('ひといき', S.wazaText('hitoiki'), [[4, CFG.waza.hitoikiHeal], [8, CFG.waza.hitoikiHeal]], hs);
  // すきをつく（ぴゅん 12）：しっぽ＋ツメ で 1げきめで よろけ → 2・3げきめ ×1.5（7.2 → 10.8）
  var r5 = fightW({ species: 'pyun' }, { parts: ['tail', 'claw'] }, dummy());
  row('すきをつく', S.wazaText('suki'), [7, 11, 11], ownHits(r5)[0]);
  // れんだ（ぴゅん）：じぶんの 4・8手めは 2かい
  var r6 = fightW({ species: 'pyun' }, { parts: [] }, dummy({ atk: 1 }));
  row('れんだ', S.wazaText('renda'), [1, 1, 1, 2, 1, 1, 1, 2], ownHits(r6).slice(0, 8).map(function (x) { return x.length; }));
  var re0 = CFG.waza.rendaEvery; CFG.waza.rendaEvery = 3;
  var r6b = fightW({ species: 'pyun' }, { parts: ['spring'] }, dummy({ atk: 1 }));
  CFG.waza.rendaEvery = re0;
  row('れんだ', 'ばねあしと 同じ手なら 3かい（れんだを 3手ごとに して ためす）', [1, 1, 3], ownHits(r6b).slice(0, 3).map(function (x) { return x.length; }));
  // いかり（どしん。はやさ 9 で あと）：あたったとき（0.1）→ つぎの こうげき ×1.5。おおなぐり：じぶんの 5手め 1げきめ ×2
  var DA = S.SPECIES_BY_ID.doshin.atk, IM = CFG.waza.ikariMult, OM = CFG.waza.oonaguriMult, rd = Math.round;
  var r7 = fightW({ species: 'doshin' }, { parts: [] }, dummy(), { rngV: 0.1 });
  row('いかり', S.wazaText('ikari') + '（こうげき ' + DA + '）', [[rd(DA * IM)], [rd(DA * IM)], [rd(DA * IM)], [rd(DA * IM)], [rd(DA * OM * IM)]], ownHits(r7).slice(0, 5));
  var r7b = fightW({ species: 'doshin' }, { parts: [] }, dummy(), { rngV: 0.9 });
  row('おおなぐり', S.wazaText('oonaguri') + '（いかりが 出ないとき）', [[DA], [DA], [DA], [DA], [DA * OM], [DA]], ownHits(r7b).slice(0, 6));
  var r7c = fightW({ species: 'doshin' }, { parts: ['claw'] }, dummy({ spd: 1 }), { rngV: 0.9 });
  row('おおなぐり', 'ツメの 3げきでも ×' + OM + ' は 1げきめ だけ', [rd(DA * 0.6 * OM), rd(DA * 0.6), rd(DA * 0.6)], ownHits(r7c)[4]);
  // 待ち時間の ゲージ：hand.countdown.waza（0 なら この手に 出る）
  var cd = r6.hands.filter(function (h) { return h.actor === 'p'; }).slice(0, 4).map(function (h) { return h.countdown.waza.renda; });
  row('待ち時間', 'れんだの のこり（体の そばの ゲージ用）：3・2・1・0', [3, 2, 1, 0], cd);
  // わざ なし なら 種類を 渡しても 前と 同じ 戦い（乱数の 順番も 同じ）
  var a1 = S.runBattle(['fang', 'claw'], 3, 4, 'plain', { rng: S.makeRng(7) });
  var a2 = S.runBattle(['fang', 'claw'], 3, 4, 'plain', { rng: S.makeRng(7), mon: { species: 'gotsun' } });
  row('わざ なし', 'CFG.waza.on = false なら mon を 渡しても 同じ 結果・技の 出来事なし（前の版との 同じさは bot で 確かめる）', { same: true, ev: 0 }, { same: JSON.stringify(a1) === JSON.stringify(a2), ev: evs(a2, function (ev) { return ev.t === 'waza'; }).length });
  var r3d = fightW({ species: 'gotsun' }, { parts: ['scale'], lv2: ['scale'] }, dummy({ atk: 5 }), { rngV: 0.1 });
  row('かみつきかえし', '0 に はじいた 1げきでも「うけた」ので 出る（トゲと 同じ）', true, countersBy(r3d, 'p').length > 0 && hitsBy(r3d, 'e').every(function (x) { return x.dmg === 0; }));
  var r7d = fightW({ species: 'doshin' }, { parts: [] }, dummy(), { rngV: 0.1 });
  row('いかり', 'summary.waza は ためた 回数（使った ときは 数えない）', wazaEvs(r7d, 'ikari').filter(function (x) { return x.ready; }).length, r7d.summary.waza.ikari);
  row('わざ あり', '技の 回数は summary.waza（記録・ボット用）', { kiai: 1 }, r2.summary.waza);
  // 技 入りの 噛み合い 12〜15（決定 13）
  function synIn(res, id) { return evs(res, function (ev) { return ev.t === 'synergy' && ev.id === id && ev.side === 'p'; }).length > 0; }
  var y12 = fightW({ species: 'gotsun' }, { parts: ['spike'] }, dummy(), { rngV: 0.1 });
  var y12h = y12.hands.filter(function (h) { return h.actor === 'e'; })[0].events.filter(function (ev) { return ev.t === 'counter' && ev.side === 'p'; }).map(function (ev) { return ev.waza || ev.part; });
  var y12b = fightW({ species: 'koron' }, { parts: ['spike'] }, dummy(), { rngV: 0.1 });
  row('かみつきかえし＋トゲ', S.SYN_BY_ID[12].desc + '（かみつきかえしの ない 子では 起きない）', { order: ['spike', 'kamitsuki'], syn: true, other: false }, { order: y12h, syn: synIn(y12, 12), other: synIn(y12b, 12) });
  var y13b = fightW({ species: 'pyun' }, { parts: ['tail'] }, dummy());
  row('すきをつく＋しっぽ＋ツメ', S.SYN_BY_ID[13].desc + '（ツメが ないと 1げきなので 起きない）', { syn: true, tailOnly: false }, { syn: synIn(r5, 13), tailOnly: synIn(y13b, 13) });
  var y14 = fightW({ species: 'koron' }, { parts: ['fang', 'claw'] }, dummy());
  var y14h = ownHits(y14)[0];
  row('ねらいうち＋キバ＋ツメ', S.SYN_BY_ID[14].desc + '（キバだけ・ツメ 1げきめは +0）', { syn: true, fangOnly: false, plus: NR }, { syn: synIn(y14, 14), fangOnly: synIn(r1, 14), plus: y14h[1] - y14h[0] });
  row('いかり＋おおなぐり', S.SYN_BY_ID[15].desc + '（いかりが 出ないと 起きない）', { syn: true, hit5: rd(DA * OM * IM), no: false }, { syn: synIn(r7, 15), hit5: ownHits(r7)[4][0], no: synIn(r7b, 15) });
  row('技 入りの 噛み合い', 'どれも 技を 1つ 以上 もつ（図鑑の「わざ 入り」）。文は 40文字 以下', true, [12, 13, 14, 15].every(function (id) { return S.SYN_BY_ID[id].waza.length > 0 && S.SYN_BY_ID[id].desc.length <= 40; }));
  CFG.waza.on = true;
  var k1 = S.monKey({ species: 'pyun' }), k2 = S.monKey({ species: 'pyun', waza: [] }), k3 = S.monKey(null);
  CFG.waza.on = false;
  row('ボットの 覚え', '技を 省いた（その種類の 2つ）と 空（技なし）は 別の 鍵・わざ なしは 鍵なし', { a: 'Wpyun:suki,renda', b: 'Wpyun:', c: 'Wkoron:nerai,kiai', off: '' }, { a: k1, b: k2, c: k3, off: S.monKey({ species: 'pyun' }) });
  // 手札の ◎（partHints）は いまの 子の 種類の はやさで 見る（ぴゅん 14・ころん 10、あいて 12）
  CFG.waza.on = true;
  var hE = dummy({ spd: 12 }), hF = S.FIELDS[0].id;
  var hPy = S.partHints('claw', hE, hF, [], [], null, { species: 'pyun' }).good[0].on;
  var hKo = S.partHints('claw', hE, hF, [], [], null, { species: 'koron' }).good[0].on;
  CFG.waza.on = false;
  row('ツメ（手札の ◎）', 'おそい あいて（3かい）：はやさは その子の 種類で 見る', { pyun: true, koron: false }, { pyun: hPy, koron: hKo });
  CFG.waza.on = on0;
})();

// ======================= 決定 21-d：序盤の やさしさ =======================
(function () {
  CFG.early = EARLY0.slice();
  var d = dummy({ hp: 100, atk: 10 });
  var e1 = S.makeFighter('e', d, [], 1, []), e2 = S.makeFighter('e', d, [], 2, []), e3 = S.makeFighter('e', d, [], 3, []);
  var h1 = S.makeFighter('e', d, [], 1, [], { hard: true });
  var r2 = function (x) { return Math.round(x * 100) / 100; };
  row('序盤の やさしさ', '1戦目の 相手は たいりょく・こうげき ×' + EARLY0[0] + '（100×1.06×' + EARLY0[0] + '）', { hp: Math.round(100 * 1.06 * EARLY0[0]), atk: r2(10 * 1.06 * EARLY0[0]) }, { hp: e1.maxHp, atk: r2(e1.baseAtk) });
  row('序盤の やさしさ', '2戦目の 相手は ×' + EARLY0[1] + '（100×1.06×1.1×' + EARLY0[1] + '）', { hp: Math.round(100 * 1.06 * 1.1 * EARLY0[1]), atk: r2(10 * 1.06 * 1.1 * EARLY0[1]) }, { hp: e2.maxHp, atk: r2(e2.baseAtk) });
  row('序盤の やさしさ', '3戦目からは 変えない（100×1.06×1.2）', { hp: Math.round(100 * 1.06 * 1.2), atk: r2(10 * 1.06 * 1.2) }, { hp: e3.maxHp, atk: r2(e3.baseAtk) });
  row('序盤の やさしさ', '1戦目の てごわいは ×' + EARLY0[0] + ' の うえに ×1.15', Math.round(100 * 1.06 * EARLY0[0] * 1.15), h1.maxHp);
  var b1 = S.makeFighter('e', S.BOSS, S.BOSS.parts, 1, []), b10 = S.makeFighter('e', S.BOSS, S.BOSS.parts, 10, []);
  CFG.early = [1, 1];
  var b1o = S.makeFighter('e', S.BOSS, S.BOSS.parts, 1, []), b10o = S.makeFighter('e', S.BOSS, S.BOSS.parts, 10, []);
  row('序盤の やさしさ', 'ぬしは 変えない（どの 段階でも）', [b1o.maxHp, b10o.maxHp], [b1.maxHp, b10.maxHp]);
  CFG.early = [1, 1];
})();

// ======================= 出力 =======================
console.log('| 札 | 文 | 期待 | 実測 | 一致 |');
console.log('|---|---|---|---|---|');
rows.forEach(function (r) { console.log('| ' + r.card + ' | ' + r.text + ' | ' + fmt(r.expect) + ' | ' + fmt(r.actual) + ' | ' + (r.ok ? '○' : '✕') + ' |'); });
console.log('');
console.log(rows.length + ' 件中 ' + (rows.length - fails) + ' 件 一致、' + fails + ' 件 不一致');
process.exit(fails ? 1 : 0);
