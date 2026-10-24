// でこもん 版4 — ゲームのルール（画面のコードは入れない）
// ブラウザ（index.html）と Node（bot.js）の両方から同じファイルを読み込む。
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DekoSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------- 数値（調整はここだけ） ----------
  var CFG = {
    playerHp: 115, playerAtk: 13, playerSpd: 10,
    runBattles: 10,        // 1周回は10戦
    growHp: 1, growAtk: 0.2, // 勝つたびに たいりょく +1、こうげき +0.2（調整の結果。REPORT 参照）
    maxHands: 16,
    speedGap: 8,
    // パーツ（Lv1）
    hornMult: 2.5, hornEvery: 3,
    eyeMult: 1.5,
    clawMult: 0.6, clawHitsSlow: 2, clawHitsFast: 3,
    leechRatio: 1 / 3,
    springEvery: 3,
    spikeRatio: 0.6,
    weightAtk: 4,
    shellReduce: 0.33,
    hardFlat: 4,
    longtailHeal: 4,
    wingSpd: 10,
    lightSpd: 2, windLightSpd: 5, heavySpd: -3, mudHeavySpd: -8,
    // Lv2（ひらめき後）
    lv2: { hornMult: 3.0, eyeMult: 2.0, poisonRatio: 0.6, leechRatio: 0.42, clawExtra: 1, brittleMult: 1.8, springEvery: 2,
           longlegAtk: 2, spikeRatio: 0.75, weightAtk: 6, shellReduce: 0.40, hardFlat: 5, staggerCharges: 2, longtailHeal: 6, wingSpd: 14, furSpd: 8 },
    // ひらめきの確率：発動1回あたり base ＋ 段階ごとに perStage ＋ 出なかった戦いごとに pity。1戦に1回まで。
    spark: { base: 0.015, perStage: 0.002, pity: 0.02 },
    // 体の性質
    traitFastSpd: 6, traitHeavySpd: -4, traitHeavyAtk: 3,
    regenHeal: 5, chargeMult: 2, chargeEvery: 3, toughHp: 1.3,
    // 状態
    poisonRatio: 0.45, poisonHands: 3, staggerMult: 0.5, brittleMult: 1.6, brittleHands: 5, rainStatusHands: 1,
    // 相手の段階
    enemyBase: 1.06,
    stageHp: 0.07, stageAtk: 0.07,
    variance: 0.15
  };

  // ---------- 体の場所 ----------
  var LOCS = [
    { id: 'head', name: 'あたま' }, { id: 'mouth', name: 'くち' }, { id: 'fore', name: 'まえあし' }, { id: 'hind', name: 'うしろあし' },
    { id: 'back', name: 'せなか' }, { id: 'belly', name: 'おなか' }, { id: 'tail', name: 'しっぽ' }, { id: 'shoulder', name: 'かた' }
  ];
  var LOC_BY_ID = {}; LOCS.forEach(function (l) { LOC_BY_ID[l.id] = l; });

  // ---------- 状態 ----------
  var STATUSES = {
    poison:  { id: 'poison',  name: 'どく',   desc: 'まいて の おわりに ダメージ' },
    stagger: { id: 'stagger', name: 'よろけ', desc: 'つぎの こうげきが ×0.5' },
    brittle: { id: 'brittle', name: 'もろい', desc: 'うける ダメージが ふえる' }
  };

  // ---------- 体の性質 ----------
  var TRAITS = {
    hard:     { id: 'hard',     name: 'かたい',     desc: 'うける 1げき −4' },
    ranged:   { id: 'ranged',   name: 'とおくから', desc: 'はんげきを うけない' },
    fast:     { id: 'fast',     name: 'はやい',     desc: 'はやさ +6' },
    heavy:    { id: 'heavy',    name: 'おもい',     desc: 'はやさ −4、こうげき +3' },
    regen:    { id: 'regen',    name: 'かいふく',   desc: 'じぶんの手の はじめに +5' },
    poisoner: { id: 'poisoner', name: 'どくもち',   desc: 'あてた あいてを どくに' },
    charge:   { id: 'charge',   name: 'ためる',     desc: '3手ごとに ×2 の おおわざ' },
    tough:    { id: 'tough',    name: 'しぶとい',   desc: 'たいりょく ×1.3' }
  };
  var TRAIT_IDS = Object.keys(TRAITS);

  // ---------- 噛み合い ----------
  var SYNERGIES = [
    { id: 1, name: 'おもし＋ツメ',       parts: ['weight', 'claw'],  desc: 'おもしの +4 が、ツメの 2〜3かい ぜんぶに のる' },
    { id: 2, name: 'ツノ＋ばねあし',     parts: ['horn', 'spring'],  desc: '2かい うごく手に ツノの ×2.5 が かさなる' },
    { id: 3, name: 'じょうたい＋ひかるめ', parts: ['eye', null],     desc: 'どく・よろけ・もろいの あいてに ひかるめの ×1.5' },
    { id: 4, name: 'しっぽ＋はね',       parts: ['tail', 'wing'],    desc: 'さきに よろけさせて、あいての つぎの こうげきを 半分に' },
    { id: 5, name: 'キバ＋コウラ',       parts: ['fang', 'shell'],   desc: 'コウラで うけながら、どくで たおす' },
    { id: 6, name: 'すいつくくち＋ツメ', parts: ['leech', 'claw'],   desc: '2〜3かいの こうげきで そのたび かいふく' },
    { id: 7, name: 'くだくツメ＋ツノ',   parts: ['crush', 'horn'],   desc: 'もろくした あいてに ツノの ×2.5' },
    { id: 8, name: 'はね＋ツメ',         parts: ['wing', 'claw'],    desc: 'はねで はやさを こえて、ツメが 3かいに' }
  ];
  var SYN_BY_ID = {}; SYNERGIES.forEach(function (s) { SYN_BY_ID[s.id] = s; });

  // ---------- パーツ（16種。場所8つ×2） ----------
  var hasTrait = function (c, t) { return c.eT[t] === true; };
  var PARTS = [
    { id: 'horn', name: 'おおきなツノ', short: 'ツノ', loc: 'head', cat: 'atk', weight: 'heavy',
      effect: '3手ごとに、さいしょの 1げきが ×2.5', lv2text: '×3.2 になり、あてた あいてを よろけに',
      goods: [{ text: 'かたい あいて', when: function (c) { return hasTrait(c, 'hard') || !!c.eA.scale; } },
              { text: 'コウラを もつ あいて', when: function (c) { return !!c.eA.shell; } }],
      bads: [{ text: 'ぬかるみ（おもい）', when: function (c) { return c.f === 'mud'; } },
             { text: 'よろけに してくる あいて', when: function (c) { return !!c.eA.tail; } }] },
    { id: 'eye', name: 'ひかるめ', short: 'ひかるめ', loc: 'head', cat: 'atk', weight: 'light',
      effect: 'どく・よろけ・もろい の あいてに ×1.5', lv2text: '×1.8 に',
      goods: [{ text: 'じょうたいを かけられる とき', when: function (c) { return !!(c.pA.fang || c.pA.crush || c.pA.tail) && !c.eA.fur; } }],
      bads: [{ text: 'ふさふさの あいて', when: function (c) { return !!c.eA.fur; } },
             { text: 'あめ（じょうたいが すぐ きえる）', when: function (c) { return c.f === 'rain'; } }] },
    { id: 'fang', name: 'どくのキバ', short: 'キバ', loc: 'mouth', cat: 'atk', weight: 'none',
      effect: 'あてた あいてを どくに する', lv2text: 'どくが ×0.7 に',
      goods: [{ text: 'かたい・コウラの あいて（どくは へらない）', when: function (c) { return hasTrait(c, 'hard') || !!c.eA.scale || !!c.eA.shell; } }],
      bads: [{ text: 'ふさふさの あいて', when: function (c) { return !!c.eA.fur; } },
             { text: 'あめ（どくが 1手で きえる）', when: function (c) { return c.f === 'rain'; } }] },
    { id: 'leech', name: 'すいつくくち', short: 'すいつく', loc: 'mouth', cat: 'def', weight: 'none',
      effect: 'あたえた ダメージの 1/3 かいふく', lv2text: '1/2 かいふく に',
      goods: [{ text: 'しぶとい・かいふくの あいて（ながい たたかい）', when: function (c) { return hasTrait(c, 'tough') || hasTrait(c, 'regen'); } }],
      bads: [{ text: 'かたい あいて（ダメージが へる）', when: function (c) { return hasTrait(c, 'hard') || !!c.eA.scale; } }] },
    { id: 'claw', name: 'するどいツメ', short: 'ツメ', loc: 'fore', cat: 'atk', weight: 'light',
      effect: '1手で 2かい こうげき（×0.6）。はやさで かてば 3かい', lv2text: 'かいすう +1',
      goods: [{ text: 'おそい あいて（3かい）', when: function (c) { return c.pSpd > c.eSpd; } }],
      bads: [{ text: 'かたい あいて', when: function (c) { return hasTrait(c, 'hard') || !!c.eA.scale; } },
             { text: 'トゲを もつ あいて', when: function (c) { return !!c.eA.spike && !c.pRanged; } }] },
    { id: 'crush', name: 'くだくツメ', short: 'くだく', loc: 'fore', cat: 'atk', weight: 'heavy',
      effect: 'あてた あいてを もろくする（うける ダメージ ×1.6）', lv2text: 'もろい ×2.0 に',
      goods: [{ text: 'コウラ・しぶといの あいて', when: function (c) { return !!c.eA.shell || hasTrait(c, 'tough'); } }],
      bads: [{ text: 'ふさふさの あいて', when: function (c) { return !!c.eA.fur; } },
             { text: 'ぬかるみ（おもい）', when: function (c) { return c.f === 'mud'; } }] },
    { id: 'spring', name: 'ばねあし', short: 'ばねあし', loc: 'hind', cat: 'mov', weight: 'light',
      effect: '3手ごとに、1手で 2かい うごく', lv2text: '2手ごとに 2かい うごく',
      goods: [{ text: 'つよいかぜ（かるい）', when: function (c) { return c.f === 'wind'; } }],
      bads: [{ text: 'ぬかるみ（とべない）', when: function (c) { return c.f === 'mud'; } },
             { text: 'トゲを もつ あいて', when: function (c) { return !!c.eA.spike && !c.pRanged; } }] },
    { id: 'longleg', name: 'ながいあし', short: 'ながいあし', loc: 'hind', cat: 'mov', weight: 'none',
      effect: 'こうげきが とおくからに なる（はんげき されない）', lv2text: 'さらに こうげき +3',
      goods: [{ text: 'トゲを もつ あいて', when: function (c) { return !!c.eA.spike && c.f !== 'wind'; } }],
      bads: [{ text: 'つよいかぜ（とおくからが むこう）', when: function (c) { return c.f === 'wind'; } }] },
    { id: 'spike', name: 'トゲ', short: 'トゲ', loc: 'back', cat: 'def', weight: 'none',
      effect: 'ちかくから こうげき されるたび はんげき（じぶんの こうげき ×0.6）', lv2text: 'はんげき ×0.9 に',
      goods: [{ text: 'なんかいも なぐる あいて', when: function (c) { return c.eMany && !c.eRanged; } }],
      bads: [{ text: 'とおくから こうげきする あいて', when: function (c) { return c.eRanged; } }] },
    { id: 'weight', name: 'おもし', short: 'おもし', loc: 'back', cat: 'atk', weight: 'heavy',
      effect: 'こうげきの 1げきごとに +4', lv2text: '1げきごとに +7 に',
      goods: [{ text: 'かたい あいて', when: function (c) { return hasTrait(c, 'hard') || !!c.eA.scale; } }],
      bads: [{ text: 'ぬかるみ（おもい）', when: function (c) { return c.f === 'mud'; } }] },
    { id: 'shell', name: 'かたいコウラ', short: 'コウラ', loc: 'belly', cat: 'def', weight: 'heavy',
      effect: 'うける ダメージ −33%', lv2text: '−45% に',
      goods: [{ text: 'いちげきが つよい あいて', when: function (c) { return c.eBigHit; } }],
      bads: [{ text: 'どくもち あいて（どくは ふせげない）', when: function (c) { return hasTrait(c, 'poisoner') || !!c.eA.fang; } },
             { text: 'ぬかるみ（おもい）', when: function (c) { return c.f === 'mud'; } }] },
    { id: 'scale', name: 'いしのうろこ', short: 'うろこ', loc: 'belly', cat: 'def', weight: 'heavy',
      effect: 'かたく なる（うける 1げき −4）', lv2text: 'うける 1げき −7 に',
      goods: [{ text: 'なんかいも なぐる あいて', when: function (c) { return c.eMany; } }],
      bads: [{ text: 'いちげきが つよい あいて', when: function (c) { return c.eBigHit; } },
             { text: 'ぬかるみ（おもい）', when: function (c) { return c.f === 'mud'; } }] },
    { id: 'tail', name: 'ふといしっぽ', short: 'しっぽ', loc: 'tail', cat: 'mov', weight: 'heavy',
      effect: 'あてた あいてを よろけに する（つぎの こうげき ×0.5）', lv2text: 'よろけが つぎの 2かいに',
      goods: [{ text: 'ためる あいて', when: function (c) { return hasTrait(c, 'charge'); } },
              { text: 'いちげきが つよい あいて', when: function (c) { return c.eBigHit; } }],
      bads: [{ text: 'ふさふさの あいて', when: function (c) { return !!c.eA.fur; } },
             { text: 'あめ', when: function (c) { return c.f === 'rain'; } },
             { text: 'ぬかるみ（おもい）', when: function (c) { return c.f === 'mud'; } }] },
    { id: 'longtail', name: 'ながいしっぽ', short: 'ながしっぽ', loc: 'tail', cat: 'def', weight: 'none',
      effect: 'じぶんの手の おわりに たいりょく +4', lv2text: '+8 に',
      goods: [{ text: 'どくもち あいて', when: function (c) { return hasTrait(c, 'poisoner') || !!c.eA.fang; } }],
      bads: [{ text: 'いちげきが つよい あいて', when: function (c) { return c.eBigHit; } }] },
    { id: 'wing', name: 'はね', short: 'はね', loc: 'shoulder', cat: 'mov', weight: 'light',
      effect: 'はやさ +10', lv2text: 'はやさ +16 に',
      goods: [{ text: 'はやい あいて', when: function (c) {
                 if (c.f === 'rain') return false;
                 var firstW = c.pSpd >= c.eSpd, firstNo = c.pSpdNoWing >= c.eSpd;
                 var gapW = Math.abs(c.pSpd - c.eSpd) >= CFG.speedGap, gapNo = Math.abs(c.pSpdNoWing - c.eSpd) >= CFG.speedGap;
                 if (firstW !== firstNo) return true;
                 if (firstW && gapW && !gapNo) return true;
                 if (!firstW && gapNo && !gapW) return true;
                 return false;
               } },
              { text: 'つよいかぜ', when: function (c) { return c.f === 'wind'; } }],
      bads: [{ text: 'あめ（ぬれて きかない）', when: function (c) { return c.f === 'rain'; } }] },
    { id: 'fur', name: 'ふさふさのけ', short: 'ふさふさ', loc: 'shoulder', cat: 'def', weight: 'light',
      effect: 'どく・よろけ・もろい を うけない', lv2text: 'さらに はやさ +4',
      goods: [{ text: 'じょうたいを かけてくる あいて', when: function (c) { return c.eStatus; } }],
      bads: [{ text: 'じょうたいを つかわない あいて', when: function (c) { return !c.eStatus; } }] }
  ];
  var PART_BY_ID = {};
  PARTS.forEach(function (p, i) {
    p.index = i; PART_BY_ID[p.id] = p;
    p.locName = LOC_BY_ID[p.loc].name;
    p.good = p.goods.map(function (g) { return g.text; }).join('・');
    p.bad = p.bads.map(function (b) { return b.text; }).join('・');
  });
  var PART_IDS = PARTS.map(function (p) { return p.id; });
  var CATS = [{ id: 'atk', name: 'せめ' }, { id: 'def', name: 'まもり' }, { id: 'mov', name: 'うごき' }];

  // ---------- 相手（10体） ----------
  var ENEMIES = [
    { id: 'turtle',  name: 'イシガメ',       hp: 85, atk: 11, spd: 4,  traits: ['hard', 'heavy'],      parts: ['shell', 'horn'] },
    { id: 'snake',   name: 'ヒルヘビ',       hp: 70, atk: 10, spd: 12, traits: ['poisoner', 'fast'],   parts: ['fang'] },
    { id: 'deer',    name: 'ツノジカ',       hp: 80, atk: 11, spd: 9,  traits: ['charge'],             parts: ['horn', 'wing'] },
    { id: 'hedgehog', name: 'ハリネズ',      hp: 70, atk: 10, spd: 7,  traits: ['tough', 'regen'],     parts: ['spike', 'fur'] },
    { id: 'bird',    name: 'ヤリドリ',       hp: 70, atk: 11, spd: 11, traits: ['ranged', 'fast'],     parts: ['wing'] },
    { id: 'frog',    name: 'ドロガエル',     hp: 75, atk: 10, spd: 7,  traits: ['hard'],               parts: ['spike', 'longtail'] },
    { id: 'wolf',    name: 'ツタオオカミ',   hp: 70, atk: 9,  spd: 11, traits: ['fast', 'tough'],      parts: ['claw', 'spring'] },
    { id: 'jelly',   name: 'ヒカリクラゲ',   hp: 80, atk: 10, spd: 8,  traits: ['regen', 'ranged'],    parts: ['leech', 'eye'] },
    { id: 'boar',    name: 'マグマイノシシ', hp: 85, atk: 11, spd: 6,  traits: ['heavy', 'charge'],    parts: ['weight', 'crush'] },
    { id: 'cat',     name: 'カゲネコ',       hp: 70, atk: 10, spd: 12, traits: ['fast', 'poisoner'],   parts: ['tail', 'longleg'] }
  ];
  ENEMIES.forEach(function (e, i) { e.index = i; });

  // ---------- フィールド ----------
  var FIELDS = [
    { id: 'plain', name: 'ふつう',     desc: 'なにも おきない。' },
    { id: 'mud',   name: 'ぬかるみ',   desc: 'おもいパーツは はやさ −8。ばねあしは とべない。' },
    { id: 'wind',  name: 'つよいかぜ', desc: 'とおくからの こうげきが むこうに なる（はんげきが あたる）。かるいパーツは はやさ +5。' },
    { id: 'rain',  name: 'あめ',       desc: 'どく・よろけ・もろいが 1手で きえる。はねの +10 が きえる。' }
  ];
  var FIELD_BY_ID = {};
  FIELDS.forEach(function (f, i) { f.index = i; FIELD_BY_ID[f.id] = f; });

  // 自分：勝った数だけ育つ
  function playerDef(wins, name) {
    var w = wins || 0;
    return { id: 'player', name: name || 'あなた', hp: CFG.playerHp + CFG.growHp * w, atk: CFG.playerAtk + CFG.growAtk * w, spd: CFG.playerSpd, traits: [], parts: [], wins: w };
  }
  var PLAYER_DEF = playerDef(0);

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
    for (var i = a.length - 1; i > 0; i--) { var j = randInt(rng, i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ---------- 名前（ひらがな 2〜4文字） ----------
  var SYL = ['あ','い','う','え','お','か','き','く','け','こ','さ','し','す','せ','そ','た','ち','つ','て','と','な','に','ぬ','ね','の','は','ひ','ふ','へ','ほ','ま','み','む','め','も','や','ゆ','よ','ら','り','る','れ','ろ','わ','が','ぎ','ぐ','げ','ご','ざ','じ','ず','ぜ','ぞ','だ','で','ど','ば','び','ぶ','べ','ぼ','ぱ','ぴ','ぷ','ぺ','ぽ'];
  function makeName(rng) {
    var n = 2 + (rng() < 0.4 ? 1 : 0);
    var s = '';
    for (var i = 0; i < n; i++) s += SYL[randInt(rng, SYL.length)];
    var r = rng();
    if (s.length <= 3 && r < 0.18) s = s.charAt(0) + 'っ' + s.slice(1);
    else if (s.length <= 3 && r < 0.36) s = s.charAt(0) + 'ー' + s.slice(1);
    else if (s.length <= 3 && r < 0.55) s += 'ん';
    return s.slice(0, 4);
  }

  // ---------- 戦う者 ----------
  function toSet(arr) { var s = {}; (arr || []).forEach(function (x) { s[x] = true; }); return s; }
  function makeFighter(side, def, parts, stage, lv2) {
    var s = stage || 1;
    var isEnemy = side === 'e';
    var hpMul = (isEnemy ? CFG.enemyBase * (1 + CFG.stageHp * (s - 1)) : 1);
    var atkMul = (isEnemy ? CFG.enemyBase * (1 + CFG.stageAtk * (s - 1)) : 1);
    var traits = def.traits || [];
    var T = toSet(traits);
    var maxHp = Math.round(def.hp * hpMul * (T.tough ? CFG.toughHp : 1));
    return {
      side: side, id: def.id, name: def.name, stage: s,
      maxHp: maxHp, hp: maxHp,
      baseAtk: def.atk * atkMul, baseSpd: def.spd,
      traits: traits, T: T, parts: parts.slice(), active: toSet(parts), lv2: toSet(lv2 || []),
      status: { poison: null, stagger: 0, staggerBy: null, brittle: null },
      ownHands: 0
    };
  }
  function isHard(f) { return !!(f.T.hard || f.active.scale); }
  function hardFlat(f) { return Math.max(f.T.hard ? CFG.hardFlat : 0, f.active.scale ? (f.lv2.scale ? CFG.lv2.hardFlat : CFG.hardFlat) : 0); }
  function isRanged(f, fieldId) { return (!!f.T.ranged || !!f.active.longleg) && fieldId !== 'wind'; }
  function effAtk(f) { return f.baseAtk + (f.T.heavy ? CFG.traitHeavyAtk : 0) + (f.active.longleg && f.lv2.longleg ? CFG.lv2.longlegAtk : 0); }
  function effSpd(f, fieldId, noWing) {
    var spd = f.baseSpd + (f.T.fast ? CFG.traitFastSpd : 0) + (f.T.heavy ? CFG.traitHeavySpd : 0);
    PART_IDS.forEach(function (p) {
      if (!f.active[p]) return;
      var w = PART_BY_ID[p].weight;
      if (w === 'heavy') spd += fieldId === 'mud' ? CFG.mudHeavySpd : CFG.heavySpd;
      if (w === 'light') spd += fieldId === 'wind' ? CFG.windLightSpd : CFG.lightSpd;
      if (p === 'wing' && !noWing && fieldId !== 'rain') spd += f.lv2.wing ? CFG.lv2.wingSpd : CFG.wingSpd;
      if (p === 'fur' && f.lv2.fur) spd += CFG.lv2.furSpd;
    });
    return spd;
  }
  function hasStatus(f) { return !!(f.status.poison || f.status.stagger > 0 || f.status.brittle); }

  // ---------- バトル ----------
  // opts: { variance, rng, spark: { stage, pity } }  ひらめきは 自分の側だけ、乱れがあるときだけ、1戦に1回。
  // events の種類（版3から追加）: spark {side, part}  ひらめき（その場で Lv2 の効果が出る）
  //                             blocked {side, status, part:'fur'}  ふさふさが状態を防いだ
  //                             statusTick {side, status, hands}   状態の残り手数が減った
  function simulateBattle(p, e, fieldId, opts) {
    opts = opts || {};
    var variance = (opts.variance === undefined) ? CFG.variance : opts.variance;
    var rng = opts.rng || function () { return 0.5; };
    function vary(x) { return variance > 0 ? x * (1 + variance * (2 * rng() - 1)) : x; }
    var sparkOpt = opts.spark || null;
    var sparkDone = false, sparkPart = null;
    var activations = {};
    function trySpark(f, part, events) {
      if (f.side !== 'p' || !f.active[part]) return false;
      activations[part] = (activations[part] || 0) + 1;
      if (!sparkOpt || sparkDone || variance <= 0 || f.lv2[part]) return false;
      var chance = CFG.spark.base + CFG.spark.perStage * ((sparkOpt.stage || 1) - 1) + CFG.spark.pity * (sparkOpt.pity || 0);
      if (rng() < chance) {
        sparkDone = true; sparkPart = part; f.lv2[part] = true;
        events.push({ t: 'spark', side: f.side, part: part });
        return true;
      }
      return false;
    }

    var F = { p: p, e: e };
    var spd = { p: effSpd(p, fieldId), e: effSpd(e, fieldId) };
    var spdNoWing = { p: effSpd(p, fieldId, true), e: effSpd(e, fieldId, true) };
    function order() {
      var first = spd.p >= spd.e ? 'p' : 'e';
      var second = first === 'p' ? 'e' : 'p';
      var gap = Math.abs(spd.p - spd.e) >= CFG.speedGap;
      var fw = F[first], wingHelped = false;
      if (fw.active.wing && fieldId !== 'rain') {
        var nw = {}; nw[first] = spdNoWing[first]; nw[second] = spd[second];
        var first2 = nw.p >= nw.e ? 'p' : 'e';
        var gap2 = Math.abs(nw.p - nw.e) >= CFG.speedGap;
        if (first2 !== first || (gap && !gap2)) wingHelped = true;
      }
      return { first: first, second: second, gap: gap, wingHelped: wingHelped };
    }
    var startEvents = [];
    var O = order();
    if (O.wingHelped && O.first === 'p' && trySpark(p, 'wing', startEvents)) {
      spd.p = effSpd(p, fieldId); O = order();
    }
    var first = O.first, second = O.second, gap = O.gap;
    var start = { pSpd: spd.p, eSpd: spd.e, first: first, double: gap, wingHelped: O.wingHelped, events: startEvents };

    var hands = [];
    var winner = null, timeout = false, poisonKO = false;
    var dealt = { p: {}, e: {} };
    var shellBlocks = { p: 0, e: 0 };
    var synFired = {};
    var synergies = [];
    var statusHands = fieldId === 'rain' ? CFG.rainStatusHands : null;

    function addDealt(side, label, dmg) { dealt[side][label] = (dealt[side][label] || 0) + dmg; }
    function fireSyn(side, id, events) {
      var key = side + id;
      if (synFired[key]) return;
      synFired[key] = true;
      synergies.push({ id: id, side: side });
      events.push({ t: 'synergy', side: side, id: id, name: SYN_BY_ID[id].name });
    }
    function applyStatus(a, d, st, events) {
      if (d.hp <= 0) return;
      if (d.active.fur) {
        trySpark(d, 'fur', events); if (d.lv2.fur) spd[d.side] = effSpd(d, fieldId);
        events.push({ t: 'blocked', side: d.side, status: st, part: 'fur' });
        return;
      }
      if (st === 'poison') {
        var ratio = a.lv2.fang && a.active.fang ? CFG.lv2.poisonRatio : CFG.poisonRatio;
        var dmg = Math.max(1, Math.round(effAtk(a) * ratio));
        d.status.poison = { left: statusHands || CFG.poisonHands, dmg: dmg, by: a.side };
        events.push({ t: 'status', side: d.side, status: 'poison', by: a.side, hands: d.status.poison.left });
      } else if (st === 'brittle') {
        var mult = a.lv2.crush ? CFG.lv2.brittleMult : CFG.brittleMult;
        d.status.brittle = { left: statusHands || CFG.brittleHands, mult: mult };
        events.push({ t: 'status', side: d.side, status: 'brittle', by: a.side, hands: d.status.brittle.left, mult: mult });
      } else if (st === 'stagger') {
        var charges = (a.lv2.tail && a.active.tail) ? CFG.lv2.staggerCharges : 1;
        d.status.stagger = Math.max(d.status.stagger, charges); d.status.staggerBy = a.side;
        events.push({ t: 'status', side: d.side, status: 'stagger', by: a.side, hands: charges });
      }
    }

    function attack(a, d, events, isDouble, ctx) {
      var ranged = isRanged(a, fieldId);
      if (a.active.longleg && ranged) trySpark(a, 'longleg', events);
      var claws = !!a.active.claw;
      if (claws) trySpark(a, 'claw', events);
      var nHits = claws ? (spd[a.side] > spd[d.side] ? CFG.clawHitsFast : CFG.clawHitsSlow) + (a.lv2.claw ? CFG.lv2.clawExtra : 0) : 1;
      var wingMadeThree = claws && (spd[a.side] > spd[d.side]) && a.active.wing && fieldId !== 'rain' && !(spdNoWing[a.side] > spd[d.side]);
      var hornNow = !!a.active.horn && (a.ownHands % CFG.hornEvery === 0);
      var chargeNow = !!a.T.charge && (a.ownHands % CFG.chargeEvery === 0);
      var staggered = a.status.stagger > 0;
      var hornHit = false, eyeHit = false, landed = 0, halvedAny = false;
      if (a.active.leech) trySpark(a, 'leech', events);
      for (var h = 0; h < nHits; h++) {
        var parts = [];
        var mult = 1;
        if (claws) { mult *= CFG.clawMult; parts.push('claw'); }
        var thisHorn = (h === 0 && hornNow);
        if (thisHorn) { trySpark(a, 'horn', events); mult *= (a.lv2.horn ? CFG.lv2.hornMult : CFG.hornMult); parts.push('horn'); hornHit = true; }
        if (chargeNow) mult *= CFG.chargeMult;
        var eyeNow = !!a.active.eye && hasStatus(d);
        if (eyeNow) { trySpark(a, 'eye', events); mult *= (a.lv2.eye ? CFG.lv2.eyeMult : CFG.eyeMult); parts.push('eye'); eyeHit = true; }
        if (staggered) { mult *= CFG.staggerMult; halvedAny = true; }
        var flat = 0;
        if (a.active.weight) { if (h === 0) trySpark(a, 'weight', events); flat = a.lv2.weight ? CFG.lv2.weightAtk : CFG.weightAtk; parts.push('weight'); }
        var brittleNow = !!d.status.brittle;
        var dmg = vary(effAtk(a) * mult) + flat;
        if (brittleNow) dmg *= d.status.brittle.mult;
        var blocked = 0;
        if (d.active.shell) {
          trySpark(d, 'shell', events);
          blocked = dmg * (d.lv2.shell ? CFG.lv2.shellReduce : CFG.shellReduce); dmg -= blocked; shellBlocks[d.side]++;
        }
        if (isHard(d)) { if (d.active.scale) trySpark(d, 'scale', events); dmg -= hardFlat(d); }
        dmg = Math.max(1, Math.round(dmg));
        d.hp = Math.max(0, d.hp - dmg);
        landed++;
        var label = thisHorn ? 'ツノ' : (chargeNow ? 'おおわざ' : (claws ? 'ツメ' : (eyeNow ? 'ひかるめ' : 'こうげき')));
        addDealt(a.side, label, dmg);
        events.push({ t: 'hit', side: a.side, parts: parts, dmg: dmg, hit: h + 1, hits: nHits, hp: d.hp,
          shell: blocked > 0 ? Math.round(blocked) : 0, hard: isHard(d), hardFlat: isHard(d) ? hardFlat(d) : 0, ranged: ranged,
          big: thisHorn || chargeNow, horn: thisHorn, bigmove: chargeNow, eye: eyeNow, halved: staggered,
          brittle: brittleNow ? d.status.brittle.mult : 0, label: label });
        if (thisHorn && brittleNow) fireSyn(a.side, 7, events);
        if (a.active.leech) {
          var heal = Math.max(1, Math.round(dmg * (a.lv2.leech ? CFG.lv2.leechRatio : CFG.leechRatio)));
          var before = a.hp;
          a.hp = Math.min(a.maxHp, a.hp + heal);
          if (a.hp > before) { events.push({ t: 'heal', side: a.side, src: 'すいつくくち', part: 'leech', amt: a.hp - before, hp: a.hp }); ctx.heals++; }
        }
        if (d.hp <= 0) break;
        if (a.active.fang) { trySpark(a, 'fang', events); applyStatus(a, d, 'poison', events); }
        else if (a.T.poisoner) applyStatus(a, d, 'poison', events);
        if (a.active.crush) { trySpark(a, 'crush', events); applyStatus(a, d, 'brittle', events); }
        if (a.active.tail) { trySpark(a, 'tail', events); applyStatus(a, d, 'stagger', events); }
        if (thisHorn && a.lv2.horn) applyStatus(a, d, 'stagger', events);
        if (!ranged && d.active.spike) {
          trySpark(d, 'spike', events);
          var c = vary(effAtk(d) * (d.lv2.spike ? CFG.lv2.spikeRatio : CFG.spikeRatio));
          if (a.active.shell) { trySpark(a, 'shell', events); c *= (1 - (a.lv2.shell ? CFG.lv2.shellReduce : CFG.shellReduce)); shellBlocks[a.side]++; }
          if (isHard(a)) { if (a.active.scale) trySpark(a, 'scale', events); c -= hardFlat(a); }
          c = Math.max(1, Math.round(c));
          a.hp = Math.max(0, a.hp - c);
          addDealt(d.side, 'はんげき', c);
          events.push({ t: 'counter', side: d.side, part: 'spike', dmg: c, hp: a.hp });
          if (a.hp <= 0) break;
        }
      }
      if (staggered) {
        a.status.stagger--;
        if (a.status.stagger <= 0) { a.status.stagger = 0; events.push({ t: 'statusEnd', side: a.side, status: 'stagger' }); }
        else events.push({ t: 'statusTick', side: a.side, status: 'stagger', hands: a.status.stagger });
        var by = a.status.staggerBy;
        if (halvedAny && by && F[by].active.tail && F[by].active.wing && by === first) fireSyn(by, 4, events);
        if (a.status.stagger <= 0) a.status.staggerBy = null;
      }
      if (a.active.weight && landed >= 2) fireSyn(a.side, 1, events);
      if (isDouble && hornHit) fireSyn(a.side, 2, events);
      if (eyeHit) fireSyn(a.side, 3, events);
      if (wingMadeThree && landed > 0) fireSyn(a.side, 8, events);
    }

    for (var i = 0; i < CFG.maxHands; i++) {
      var actorSide;
      if (gap) actorSide = (i < 2) ? first : (((i - 2) % 2 === 0) ? second : first);
      else actorSide = (i % 2 === 0) ? first : second;
      var a = F[actorSide], d = F[actorSide === 'p' ? 'e' : 'p'];
      a.ownHands++;
      var springEvery = a.lv2.spring ? CFG.lv2.springEvery : CFG.springEvery;
      var remH = (CFG.hornEvery - a.ownHands % CFG.hornEvery) % CFG.hornEvery;
      var remS = (springEvery - a.ownHands % springEvery) % springEvery;
      var remC = (CFG.chargeEvery - a.ownHands % CFG.chargeEvery) % CFG.chargeEvery;
      var hand = { n: i + 1, actor: actorSide, events: [],
        countdown: { horn: a.active.horn ? remH : null, spring: a.active.spring ? remS : null, charge: a.T.charge ? remC : null } };
      var ev = hand.events;
      if (i === 0 && startEvents.length) { startEvents.forEach(function (x) { ev.push(x); }); }
      if (a.T.regen && a.hp > 0) {
        var b0 = a.hp; a.hp = Math.min(a.maxHp, a.hp + CFG.regenHeal);
        if (a.hp > b0) ev.push({ t: 'heal', side: actorSide, src: 'かいふく', amt: a.hp - b0, hp: a.hp });
      }
      if (a.T.charge && remC === 1) ev.push({ t: 'charge', side: actorSide });
      var actions = 1;
      if (a.active.spring && fieldId !== 'mud' && remS === 0) {
        trySpark(a, 'spring', ev);
        actions = 2; ev.push({ t: 'double', side: actorSide, part: 'spring' });
      }
      var ctx = { heals: 0 };
      for (var k = 0; k < actions; k++) {
        attack(a, d, ev, actions === 2, ctx);
        if (d.hp <= 0 || a.hp <= 0) break;
      }
      if (ctx.heals >= 2) fireSyn(actorSide, 6, ev);
      if (d.hp > 0 && a.hp > 0 && a.active.longtail) {
        trySpark(a, 'longtail', ev);
        var b1 = a.hp; a.hp = Math.min(a.maxHp, a.hp + (a.lv2.longtail ? CFG.lv2.longtailHeal : CFG.longtailHeal));
        if (a.hp > b1) ev.push({ t: 'heal', side: actorSide, src: 'ながいしっぽ', part: 'longtail', amt: a.hp - b1, hp: a.hp });
      }
      if (d.hp > 0 && a.hp > 0) {
        ['p', 'e'].forEach(function (sd) {
          var f = F[sd];
          if (f.status.poison && f.hp > 0 && F[sd === 'p' ? 'e' : 'p'].hp > 0) {
            var pd = f.status.poison.dmg;
            f.hp = Math.max(0, f.hp - pd);
            addDealt(f.status.poison.by, 'どく', pd);
            ev.push({ t: 'poison', side: sd, dmg: pd, hp: f.hp });
            if (f.hp <= 0) poisonKO = true;
            f.status.poison.left--;
            if (f.status.poison.left <= 0 && f.hp > 0) { f.status.poison = null; ev.push({ t: 'statusEnd', side: sd, status: 'poison' }); }
          }
          if (f.status.brittle && f.hp > 0) {
            f.status.brittle.left--;
            if (f.status.brittle.left <= 0) { f.status.brittle = null; ev.push({ t: 'statusEnd', side: sd, status: 'brittle' }); }
            else ev.push({ t: 'statusTick', side: sd, status: 'brittle', hands: f.status.brittle.left });
          }
          if (statusHands && f.status.stagger > 0 && f.hp > 0) { f.status.stagger = 0; f.status.staggerBy = null; ev.push({ t: 'statusEnd', side: sd, status: 'stagger' }); }
        });
      }
      hands.push(hand);
      if (d.hp <= 0) { winner = actorSide; ev.push({ t: 'ko', side: d.side }); break; }
      if (a.hp <= 0) { winner = d.side; ev.push({ t: 'ko', side: a.side }); break; }
    }
    if (!winner) {
      timeout = true;
      var pr = p.hp / p.maxHp, er = e.hp / e.maxHp;
      winner = pr >= er ? 'p' : 'e';
      hands[hands.length - 1].events.push({ t: 'timeout', winner: winner });
    }
    var lastEv = hands[hands.length - 1].events;
    if (!timeout && poisonKO) {
      var wf = F[winner];
      if (wf.active.fang && wf.active.shell && shellBlocks[winner] >= 3) fireSyn(winner, 5, lastEv);
    }
    return { winner: winner, timeout: timeout, nHands: hands.length, hands: hands, start: start,
      p: { hp: p.hp, maxHp: p.maxHp }, e: { hp: e.hp, maxHp: e.maxHp },
      spark: sparkPart,
      summary: { dealt: dealt, synergies: synergies, poisonKO: poisonKO, activations: activations, spark: sparkPart } };
  }

  // 便利：1戦をつくって回す。opts.wins（育ち）, opts.lv2（Lv2 のパーツ）, opts.spark, opts.name
  function runBattle(playerParts, enemyIndex, stage, fieldId, opts) {
    opts = opts || {};
    var p = makeFighter('p', playerDef(opts.wins || 0, opts.name), playerParts, 1, opts.lv2 || []);
    var e = makeFighter('e', ENEMIES[enemyIndex], ENEMIES[enemyIndex].parts, stage);
    return simulateBattle(p, e, fieldId, opts);
  }

  // ---------- 画面用：◎✕ ----------
  function withPart(attached, partId) {
    if (attached.indexOf(partId) >= 0) return attached.slice();
    var loc = PART_BY_ID[partId].loc;
    return attached.filter(function (a) { return PART_BY_ID[a].loc !== loc; }).concat([partId]);
  }
  function partHints(partId, enemyDef, fieldId, attached, lv2) {
    var p = makeFighter('p', PLAYER_DEF, withPart(attached || [], partId), 1, lv2 || []);
    var e = makeFighter('e', enemyDef, enemyDef.parts, 1);
    var ctx = {
      e: enemyDef, f: fieldId, eT: e.T, eA: e.active, pA: p.active,
      pSpd: effSpd(p, fieldId), pSpdNoWing: effSpd(p, fieldId, true), eSpd: effSpd(e, fieldId),
      pRanged: isRanged(p, fieldId), eRanged: isRanged(e, fieldId),
      eBigHit: !!(e.active.horn || e.T.charge || e.T.heavy || e.active.weight),
      eMany: !!(e.active.claw || e.active.spring),
      eStatus: !!(e.T.poisoner || e.active.fang || e.active.tail || e.active.crush)
    };
    var def = PART_BY_ID[partId];
    var map = function (arr) { return arr.map(function (it) { return { text: it.text, on: !!it.when(ctx) }; }); };
    var good = map(def.goods), bad = map(def.bads);
    return { good: good, bad: bad,
      anyGood: good.some(function (x) { return x.on; }), anyBad: bad.some(function (x) { return x.on; }) };
  }

  // ---------- 周回ともちもの ----------
  function newRun(rng) {
    var order = shuffle(ENEMIES.map(function (e) { return e.index; }), rng).slice(0, CFG.runBattles);
    var fields = [];
    for (var i = 0; i < CFG.runBattles; i++) fields.push(FIELDS[randInt(rng, FIELDS.length)].id);
    return { enemies: order, fields: fields, battle: 0, wins: 0, history: [], name: makeName(rng) };
  }
  function startItems(rng) {
    var picked = [];
    CATS.forEach(function (c) {
      var cands = PARTS.filter(function (p) { return p.cat === c.id; });
      picked.push(cands[randInt(rng, cands.length)].id);
    });
    var rest = PART_IDS.filter(function (id) { return picked.indexOf(id) < 0; });
    return picked.concat(shuffle(rest, rng).slice(0, 3));
  }
  function pickPart(owned, rng) {
    var rest = PART_IDS.filter(function (id) { return owned.indexOf(id) < 0; });
    return rest.length ? rest[randInt(rng, rest.length)] : null;
  }
  function pickAfterWin(wins) { return wins % 2 === 0 && wins < CFG.runBattles; }

  // ---------- ボットの判断 ----------
  function loadouts(owned) {
    var out = [[]];
    var n = owned.length;
    for (var i = 0; i < n; i++) {
      out.push([owned[i]]);
      for (var j = i + 1; j < n; j++) {
        if (PART_BY_ID[owned[i]].loc === PART_BY_ID[owned[j]].loc) continue;
        out.push([owned[i], owned[j]]);
        for (var k = j + 1; k < n; k++) {
          var lk = PART_BY_ID[owned[k]].loc;
          if (lk === PART_BY_ID[owned[i]].loc || lk === PART_BY_ID[owned[j]].loc) continue;
          out.push([owned[i], owned[j], owned[k]]);
        }
      }
    }
    return out;
  }
  function ownedMask(owned) { var m = 0; owned.forEach(function (p) { m |= 1 << PART_BY_ID[p].index; }); return m; }
  function score(res) {
    return (res.winner === 'p' ? 1 : 0) + 0.5 * (res.p.hp / res.p.maxHp - res.e.hp / res.e.maxHp);
  }
  var memo = {};
  function clearMemo() { memo = {}; }
  function bestLoadout(owned, enemyIndex, stage, fieldId, wins, lv2) {
    var key = ownedMask(owned) + '|' + enemyIndex + '|' + stage + '|' + fieldId + '|' + (wins || 0) + '|' + ownedMask(lv2 || []);
    if (memo[key]) return memo[key];
    var best = null;
    loadouts(owned).forEach(function (combo) {
      var res = runBattle(combo, enemyIndex, stage, fieldId, { variance: 0, wins: wins || 0, lv2: lv2 || [] });
      var s = score(res);
      if (!best || s > best.score + 1e-9) best = { parts: combo, score: s, win: res.winner === 'p', nHands: res.nHands };
    });
    memo[key] = best;
    return best;
  }
  function randomLoadout(owned, rng) {
    var k = randInt(rng, 4);
    var out = [], used = {};
    shuffle(owned, rng).forEach(function (id) {
      if (out.length >= k) return;
      var loc = PART_BY_ID[id].loc;
      if (used[loc]) return;
      used[loc] = true; out.push(id);
    });
    return out;
  }

  return {
    CFG: CFG, LOCS: LOCS, LOC_BY_ID: LOC_BY_ID, STATUSES: STATUSES, TRAITS: TRAITS, TRAIT_IDS: TRAIT_IDS,
    SYNERGIES: SYNERGIES, SYN_BY_ID: SYN_BY_ID,
    PARTS: PARTS, PART_BY_ID: PART_BY_ID, PART_IDS: PART_IDS, CATS: CATS,
    ENEMIES: ENEMIES, FIELDS: FIELDS, FIELD_BY_ID: FIELD_BY_ID, PLAYER_DEF: PLAYER_DEF, playerDef: playerDef, makeName: makeName,
    makeRng: makeRng, randInt: randInt, shuffle: shuffle,
    makeFighter: makeFighter, effSpd: effSpd, effAtk: effAtk, isHard: isHard, isRanged: isRanged,
    simulateBattle: simulateBattle, runBattle: runBattle,
    partHints: partHints, withPart: withPart,
    newRun: newRun, startItems: startItems, pickPart: pickPart, pickAfterWin: pickAfterWin,
    loadouts: loadouts, bestLoadout: bestLoadout, randomLoadout: randomLoadout, clearMemo: clearMemo, score: score
  };
});
