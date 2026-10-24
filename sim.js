// でこもん 版1 — ゲームのルール（画面のコードは入れない）
// ブラウザ（index.html）と Node（bot.js）の両方から同じファイルを読み込む。
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DekoSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------- 数値（調整はここだけ） ----------
  var CFG = {
    playerHp: 115,
    playerAtk: 12,
    playerSpd: 10,
    maxHands: 16,        // ここまでに決着しなければ 残り体力の割合で勝負
    speedGap: 8,         // はやさの差がこれ以上なら、はやい側が最初に2手うごく
    hornMult: 1.5,       // おおきなツノ：1手の最初の1撃
    clawMult: 0.6,       // するどいツメ：1撃ごと
    clawHitsSlow: 2,
    clawHitsFast: 3,     // はやさで勝っていれば3回
    shellReduce: 0.35,   // かたいコウラ：受けるダメージ −35%
    spikeRatio: 0.6,     // トゲ：反撃 = 自分の攻撃力 × 0.6
    wingSpd: 6,          // はね：はやさ +6（あめでは 0）
    lightSpd: 2,         // かるいパーツ1つにつき +2（つよいかぜでは +5）
    windLightSpd: 5,
    heavySpd: -3,        // おもいパーツ1つにつき −3（ぬかるみでは −8）
    mudHeavySpd: -8,
    springEvery: 3,      // ばねあし：自分の3手ごとに2回うごく
    specialMult: 1.0,    // ほのお／みず：攻撃 ×1.0（タイプ相性とフィールドで変わる）
    superMult: 1.8,      // こうかばつぐん
    weakMult: 0.6,       // いまひとつ
    rainFire: 0.5,
    rainWater: 1.25,
    windWater: 0.6,
    windFire: 1.25,
    hardFlat: 4,         // かたい：1撃ごとに −4
    stageHp: 0.18,       // 相手の体力：段階ごとに +18%
    stageAtk: 0.18,      // 相手の攻撃：段階ごとに +18%
    variance: 0.15       // ダメージ ±15%
  };

  // ---------- パーツ ----------
  var PARTS = [
    { id: 'horn', name: 'おおきなツノ', cat: 'atk', weight: 'heavy', loc: 'あたま',
      effect: '1手の さいしょの 1げきが ×1.5。',
      good: 'かたい あいて', bad: 'ぬかるみ（おもい）' },
    { id: 'claw', name: 'するどいツメ', cat: 'atk', weight: 'light', loc: 'まえあし',
      effect: '1手で 2かい こうげき（×0.6）。はやさで かっていれば 3かい。',
      good: 'おそい あいて', bad: 'かたい あいて・トゲを もつ あいて' },
    { id: 'shell', name: 'かたいコウラ', cat: 'def', weight: 'heavy', loc: 'おなか',
      effect: 'うける ダメージ −35%。ほのお・みずは ふせげない。',
      good: 'いちげきが つよい あいて', bad: 'ほのお・みずを もつ あいて・ぬかるみ' },
    { id: 'spike', name: 'トゲ', cat: 'def', weight: 'none', loc: 'せなか',
      effect: 'ちかくから こうげきされるたび はんげき。',
      good: 'なんかいも なぐる あいて', bad: 'とおくから こうげきする あいて' },
    { id: 'wing', name: 'はね', cat: 'spd', weight: 'light', loc: 'かた',
      effect: 'はやさ +6。せんてを とりやすい。',
      good: 'はやい あいて・つよいかぜ', bad: 'あめ（ぬれて きかない）' },
    { id: 'spring', name: 'ばねあし', cat: 'spd', weight: 'light', loc: 'うしろあし',
      effect: '3手に 1かい、1手で 2かい うごく。',
      good: 'つよいかぜ（かるい）', bad: 'ぬかるみ（とべない）・トゲを もつ あいて' },
    { id: 'fire', name: 'ほのおのいき', cat: 'spc', weight: 'none', loc: 'くち',
      effect: 'こうげきが とおくからの ほのお に なる。くさに ×1.8、みずに ×0.6。',
      good: 'くさタイプ・トゲを もつ あいて・つよいかぜ（×1.25）', bad: 'みずタイプ・あめ（×0.5）' },
    { id: 'water', name: 'みずでっぽう', cat: 'spc', weight: 'none', loc: 'くち',
      effect: 'こうげきが とおくからの みず に なる。ほのおに ×1.8、くさに ×0.6。',
      good: 'ほのおタイプ・トゲを もつ あいて・あめ（×1.25）', bad: 'くさタイプ・つよいかぜ（×0.6）' }
  ];
  var PART_BY_ID = {};
  PARTS.forEach(function (p, i) { p.index = i; PART_BY_ID[p.id] = p; });
  var PART_IDS = PARTS.map(function (p) { return p.id; });
  var CATS = [
    { id: 'atk', name: 'こうげき' }, { id: 'def', name: 'まもり' },
    { id: 'spd', name: 'はやさ' }, { id: 'spc', name: 'とくしゅ' }
  ];

  // ---------- 相手の性質 ----------
  var TRAITS = {
    hard:   { id: 'hard',   name: 'かたい',         desc: 'うける ダメージ −4（1かいごと）' },
    ranged: { id: 'ranged', name: 'とおくからこうげき', desc: 'トゲの はんげきを うけない' },
    fire:   { id: 'fire',   name: 'ほのおタイプ',   desc: 'みずに よわい' },
    water:  { id: 'water',  name: 'みずタイプ',     desc: 'ほのおに つよい' },
    grass:  { id: 'grass',  name: 'くさタイプ',     desc: 'ほのおに よわい・みずに つよい' },
    heavy:  { id: 'heavy',  name: 'おもい',         desc: 'おそい・いちげきが つよい' },
    light:  { id: 'light',  name: 'かるい',         desc: 'はやい・たいりょくが すくない' }
  };

  // ---------- 相手（8体） ----------
  var ENEMIES = [
    { id: 'turtle', name: 'イシガメ',       hp: 100, atk: 14, spd: 3,  traits: ['heavy'],           type: null,    parts: ['shell', 'horn'] },
    { id: 'bird',   name: 'ヤリドリ',       hp: 75,  atk: 12, spd: 15, traits: ['ranged', 'light'], type: null,    parts: ['wing'] },
    { id: 'monkey', name: 'ヒノコザル',     hp: 80,  atk: 12, spd: 13, traits: ['fire', 'light'],   type: 'fire',  parts: ['fire', 'spring'] },
    { id: 'jelly',  name: 'ミズクラゲ',     hp: 85,  atk: 12, spd: 8,  traits: ['water'],           type: 'water', parts: ['water', 'shell'] },
    { id: 'wolf',   name: 'ツタオオカミ',   hp: 85,  atk: 10, spd: 12, traits: ['grass', 'light'],  type: 'grass', parts: ['claw', 'spring'] },
    { id: 'boar',   name: 'マグマイノシシ', hp: 90,  atk: 13, spd: 5,  traits: ['fire', 'hard'],    type: 'fire',  parts: ['spike', 'horn'] },
    { id: 'frog',   name: 'ドロガエル',     hp: 90,  atk: 12, spd: 8,  traits: ['hard', 'water'],   type: 'water', parts: ['spike'] },
    { id: 'owl',    name: 'タネフクロウ',   hp: 80,  atk: 12, spd: 10, traits: ['grass', 'ranged'], type: 'grass', parts: ['wing', 'spike'] }
  ];
  ENEMIES.forEach(function (e, i) { e.index = i; });

  // ---------- フィールド（4種類） ----------
  var FIELDS = [
    { id: 'plain', name: 'ふつう',     desc: 'なにも おきない。' },
    { id: 'mud',   name: 'ぬかるみ',   desc: 'おもいパーツは おそくなる。ばねあしは とべない。' },
    { id: 'rain',  name: 'あめ',       desc: 'ほのおは よわまる（×0.5）。はねは ぬれて きかない。みずは つよまる（×1.25）。' },
    { id: 'wind',  name: 'つよいかぜ', desc: 'とおくからの こうげきも ちかくから になる（トゲが きく）。かるいパーツは はやくなる。ほのおは ひろがる（×1.25）。みずは ちる（×0.6）。' }
  ];
  var FIELD_BY_ID = {};
  FIELDS.forEach(function (f, i) { f.index = i; FIELD_BY_ID[f.id] = f; });

  var PLAYER_DEF = { id: 'player', name: 'あなた', hp: CFG.playerHp, atk: CFG.playerAtk, spd: CFG.playerSpd, traits: [], type: null };

  // ---------- 乱数（種つき） ----------
  function makeRng(seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(rng, n) { return Math.floor(rng() * n); }
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(rng, i + 1); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- 戦う者 ----------
  // ほのお と みず を両方つけると、ほのおは みずで きえる（効かない）。
  function activeParts(parts) {
    var set = {};
    parts.forEach(function (p) { set[p] = true; });
    if (set.fire && set.water) set.fire = false;
    return set;
  }
  function makeFighter(side, def, parts, stage) {
    var s = stage || 1;
    var isEnemy = side === 'e';
    var hpMul = isEnemy ? 1 + CFG.stageHp * (s - 1) : 1;
    var atkMul = isEnemy ? 1 + CFG.stageAtk * (s - 1) : 1;
    var maxHp = Math.round(def.hp * hpMul);
    var traits = def.traits || [];
    return {
      side: side, id: def.id, name: def.name, stage: s,
      maxHp: maxHp, hp: maxHp, atk: def.atk * atkMul, baseSpd: def.spd,
      traits: traits, type: def.type || null,
      hard: traits.indexOf('hard') >= 0, rangedTrait: traits.indexOf('ranged') >= 0,
      parts: parts.slice(), active: activeParts(parts)
    };
  }

  function effSpd(f, fieldId, noWing) {
    var spd = f.baseSpd;
    PART_IDS.forEach(function (p) {
      if (!f.active[p]) return;
      var w = PART_BY_ID[p].weight;
      if (w === 'heavy') spd += fieldId === 'mud' ? CFG.mudHeavySpd : CFG.heavySpd;
      if (w === 'light') spd += fieldId === 'wind' ? CFG.windLightSpd : CFG.lightSpd;
      if (p === 'wing' && !noWing && fieldId !== 'rain') spd += CFG.wingSpd;
    });
    return spd;
  }

  function typeMult(elem, type) {
    if (!elem || !type) return 1;
    if (elem === 'fire' && type === 'grass') return CFG.superMult;
    if (elem === 'fire' && type === 'water') return CFG.weakMult;
    if (elem === 'water' && type === 'fire') return CFG.superMult;
    if (elem === 'water' && type === 'grass') return CFG.weakMult;
    return 1;
  }
  function fieldMult(elem, fieldId) {
    if (elem === 'fire' && fieldId === 'rain') return CFG.rainFire;
    if (elem === 'water' && fieldId === 'rain') return CFG.rainWater;
    if (elem === 'water' && fieldId === 'wind') return CFG.windWater;
    if (elem === 'fire' && fieldId === 'wind') return CFG.windFire;
    return 1;
  }

  // ---------- バトル ----------
  // 戻り値: { winner:'p'|'e', timeout, nHands, hands:[{n, actor, events:[...]}], start:{...}, p:{hp,maxHp}, e:{hp,maxHp} }
  // events の種類:
  //   double  {side, part:'spring'}                         ばねあしで 2回うごく
  //   hit     {side, parts:[...], elem, typeEff, fieldEff, dmg, hit, hits, hp, shell, hard}
  //   counter {side, part:'spike', dmg, hp}                 トゲの はんげき
  //   ko      {side}                                        たおれた側
  //   timeout {winner}
  function simulateBattle(p, e, fieldId, opts) {
    opts = opts || {};
    var variance = (opts.variance === undefined) ? CFG.variance : opts.variance;
    var rng = opts.rng || function () { return 0.5; };
    function vary(x) { return variance > 0 ? x * (1 + variance * (2 * rng() - 1)) : x; }

    var F = { p: p, e: e };
    var spd = { p: effSpd(p, fieldId), e: effSpd(e, fieldId) };
    var first = spd.p >= spd.e ? 'p' : 'e';
    var second = first === 'p' ? 'e' : 'p';
    var gap = Math.abs(spd.p - spd.e) >= CFG.speedGap;
    // はねのおかげで 先手（または 2手）になったか
    var fw = F[first];
    var wingHelped = false;
    if (fw.active.wing && fieldId !== 'rain') {
      var nw = {}; nw[first] = effSpd(fw, fieldId, true); nw[second] = spd[second];
      var first2 = nw.p >= nw.e ? 'p' : 'e';
      var gap2 = Math.abs(nw.p - nw.e) >= CFG.speedGap;
      if (first2 !== first || (gap && !gap2)) wingHelped = true;
    }
    var start = { pSpd: spd.p, eSpd: spd.e, first: first, double: gap, wingHelped: wingHelped,
      fireOut: { p: !!(p.parts.indexOf('fire') >= 0 && !p.active.fire), e: !!(e.parts.indexOf('fire') >= 0 && !e.active.fire) } };

    var hands = [];
    var own = { p: 0, e: 0 };
    var winner = null, timeout = false;

    function attack(a, d, events) {
      var elem = a.active.water ? 'water' : (a.active.fire ? 'fire' : null);
      var ranged = (elem !== null || a.rangedTrait) && fieldId !== 'wind';
      var claws = !!a.active.claw;
      var nHits = claws ? (spd[a.side] > spd[d.side] ? CFG.clawHitsFast : CFG.clawHitsSlow) : 1;
      for (var h = 0; h < nHits; h++) {
        var parts = [];
        var mult = 1;
        if (claws) { mult *= CFG.clawMult; parts.push('claw'); }
        if (h === 0 && a.active.horn) { mult *= CFG.hornMult; parts.push('horn'); }
        var tm = 1, fm = 1;
        if (elem) { mult *= CFG.specialMult; tm = typeMult(elem, d.type); fm = fieldMult(elem, fieldId); mult *= tm * fm; parts.push(elem); }
        var dmg = vary(a.atk * mult);
        var blocked = 0;
        if (d.active.shell && !elem) { blocked = dmg * CFG.shellReduce; dmg -= blocked; }
        if (d.hard) dmg -= CFG.hardFlat;
        dmg = Math.max(1, Math.round(dmg));
        d.hp = Math.max(0, d.hp - dmg);
        events.push({ t: 'hit', side: a.side, parts: parts, elem: elem,
          typeEff: tm > 1 ? 'super' : (tm < 1 ? 'weak' : null), fieldEff: fm,
          dmg: dmg, hit: h + 1, hits: nHits, hp: d.hp, shell: blocked > 0 ? Math.round(blocked) : 0, hard: d.hard, ranged: ranged });
        if (d.hp <= 0) return;
        if (!ranged && d.active.spike) {
          var c = vary(d.atk * CFG.spikeRatio);
          if (a.active.shell) c *= (1 - CFG.shellReduce);
          if (a.hard) c -= CFG.hardFlat;
          c = Math.max(1, Math.round(c));
          a.hp = Math.max(0, a.hp - c);
          events.push({ t: 'counter', side: d.side, part: 'spike', dmg: c, hp: a.hp });
          if (a.hp <= 0) return;
        }
      }
    }

    for (var i = 0; i < CFG.maxHands; i++) {
      var actorSide;
      if (gap) actorSide = (i < 2) ? first : (((i - 2) % 2 === 0) ? second : first);
      else actorSide = (i % 2 === 0) ? first : second;
      var a = F[actorSide], d = F[actorSide === 'p' ? 'e' : 'p'];
      own[actorSide]++;
      var hand = { n: i + 1, actor: actorSide, events: [] };
      var actions = 1;
      if (a.active.spring && fieldId !== 'mud' && own[actorSide] % CFG.springEvery === 0) {
        actions = 2; hand.events.push({ t: 'double', side: actorSide, part: 'spring' });
      }
      for (var k = 0; k < actions; k++) {
        attack(a, d, hand.events);
        if (d.hp <= 0 || a.hp <= 0) break;
      }
      hands.push(hand);
      if (d.hp <= 0) { winner = actorSide; hand.events.push({ t: 'ko', side: d.side }); break; }
      if (a.hp <= 0) { winner = d.side; hand.events.push({ t: 'ko', side: a.side }); break; }
    }
    if (!winner) {
      timeout = true;
      var pr = p.hp / p.maxHp, er = e.hp / e.maxHp;
      winner = pr >= er ? 'p' : 'e';
      hands[hands.length - 1].events.push({ t: 'timeout', winner: winner });
    }
    return { winner: winner, timeout: timeout, nHands: hands.length, hands: hands, start: start,
      p: { hp: p.hp, maxHp: p.maxHp }, e: { hp: e.hp, maxHp: e.maxHp } };
  }

  // 便利：パーツと相手の番号から 1戦をつくって回す
  function runBattle(playerParts, enemyIndex, stage, fieldId, opts) {
    var p = makeFighter('p', PLAYER_DEF, playerParts, 1);
    var e = makeFighter('e', ENEMIES[enemyIndex], ENEMIES[enemyIndex].parts, stage);
    return simulateBattle(p, e, fieldId, opts);
  }

  // ---------- 周回 ----------
  function newRun(rng) {
    var order = shuffle(ENEMIES.map(function (e) { return e.index; }), rng).slice(0, 5);
    var fields = [];
    for (var i = 0; i < 5; i++) fields.push(FIELDS[randInt(rng, FIELDS.length)].id);
    var owned = CATS.map(function (c) {
      var cands = PARTS.filter(function (p) { return p.cat === c.id; });
      return cands[randInt(rng, cands.length)].id;
    });
    return { enemies: order, fields: fields, owned: owned, battle: 0, wins: 0, history: [] };
  }
  function draftOffer(owned, rng) {
    var rest = PART_IDS.filter(function (p) { return owned.indexOf(p) < 0; });
    return shuffle(rest, rng).slice(0, 3);
  }

  // ---------- ボットの判断（画面の ?auto=1 と bot.js で共用） ----------
  function subsets(arr, maxSize) {
    var out = [[]];
    for (var size = 1; size <= Math.min(maxSize, arr.length); size++) {
      (function rec(start, cur) {
        if (cur.length === size) { out.push(cur.slice()); return; }
        for (var i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
      })(0, []);
    }
    return out;
  }
  function ownedMask(owned) {
    var m = 0; owned.forEach(function (p) { m |= 1 << PART_BY_ID[p].index; }); return m;
  }
  function score(res) {
    return (res.winner === 'p' ? 1 : 0) + 0.5 * (res.p.hp / res.p.maxHp - res.e.hp / res.e.maxHp);
  }
  var memo = {};
  function clearMemo() { memo = {}; }
  // 手持ちの全組み合わせ（0〜3個）を乱れゼロで試し、いちばん勝ちやすい組み合わせを返す
  function bestLoadout(owned, enemyIndex, stage, fieldId) {
    var key = ownedMask(owned) + '|' + enemyIndex + '|' + stage + '|' + fieldId;
    if (memo[key]) return memo[key];
    var best = null;
    subsets(owned, 3).forEach(function (combo) {
      if (combo.indexOf('fire') >= 0 && combo.indexOf('water') >= 0) return; // ほのおは きえるので むだ
      var res = runBattle(combo, enemyIndex, stage, fieldId, { variance: 0 });
      var s = score(res);
      if (!best || s > best.score + 1e-9) best = { parts: combo, score: s, win: res.winner === 'p', nHands: res.nHands };
    });
    memo[key] = best;
    return best;
  }
  // ドラフト：次の段階の全相手×全フィールドに対する「最良の組み合わせの点」の平均が いちばん高いパーツ
  function matchedDraft(owned, offered, stage) {
    var best = null;
    offered.forEach(function (cand) {
      var o = owned.concat([cand]);
      var sum = 0, n = 0;
      ENEMIES.forEach(function (e) {
        FIELDS.forEach(function (f) { sum += bestLoadout(o, e.index, stage, f.id).score; n++; });
      });
      var avg = sum / n;
      if (!best || avg > best.avg + 1e-9) best = { part: cand, avg: avg };
    });
    return best ? best.part : offered[0];
  }
  function randomLoadout(owned, rng) {
    var k = randInt(rng, 4);
    return shuffle(owned, rng).slice(0, k);
  }
  function randomDraft(offered, rng) { return offered[randInt(rng, offered.length)]; }

  return {
    CFG: CFG, PARTS: PARTS, PART_BY_ID: PART_BY_ID, PART_IDS: PART_IDS, CATS: CATS,
    TRAITS: TRAITS, ENEMIES: ENEMIES, FIELDS: FIELDS, FIELD_BY_ID: FIELD_BY_ID, PLAYER_DEF: PLAYER_DEF,
    makeRng: makeRng, randInt: randInt, shuffle: shuffle,
    makeFighter: makeFighter, effSpd: effSpd, simulateBattle: simulateBattle, runBattle: runBattle,
    newRun: newRun, draftOffer: draftOffer, subsets: subsets,
    bestLoadout: bestLoadout, matchedDraft: matchedDraft, randomLoadout: randomLoadout, randomDraft: randomDraft,
    clearMemo: clearMemo, score: score
  };
});
