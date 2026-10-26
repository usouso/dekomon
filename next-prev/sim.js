// でこもん 版8 — ゲームのルール（画面のコードは入れない）
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
    // Lv2（ひらめき後。数字の上乗せではなく「新しく起きること」。数値は調整の対象）
    lv2: { eyeDodges: 1, poisonGrow: 1, ooguiStep: 4, ooguiCap: 24, clawSpdDown: 1, brokenHands: 3, jump2Mult: 1.3, stompMult: 1.5, zushinMax: 8,
           shellHideBelow: 0.3, deflectMax: 10, extendHands: 1, storeMax: 8, storeStep: 2, tailwindMax: 6, tailwindStep: 1 },
    // 分かれ道の「てごわい」相手と、頂上の ぬし
    hard: { hp: 1.15, atk: 1.15 },
    boss: { hp: 1.6, atk: 1.1 },
    // ひらめきの確率：発動1回あたり base ＋ 段階ごとに perStage ＋ 出なかった戦いごとに pity。1戦に1回まで。
    spark: { base: 0.010, perStage: 0.002, pity: 0.015 },
    // なれ：そのパーツの発動回数（周回で累計）が full になると、次の発動で必ずひらめく
    nare: { full: 20, dup: 10 },   // dup：もう持っているパーツを もらったときの「なれ +10」（版7）。0 なら その報酬は なし。順は「新しいパーツを先」で固定（版8。rewardFor）
    // そだち：3勝・6勝・9勝のあと。前の そだち からの「うけた・あてた・せんて」を norm で割って いちばん大きい方向に育つ
    grow: { every: 3, hp: 12, atk: 2, spd: 3, size: 0.10, norm: { received: 18.5, landed: 20.3, first: 6.7 } },
    // 体の性質
    traitFastSpd: 6, traitHeavySpd: -4, traitHeavyAtk: 3,
    regenHeal: 5, chargeMult: 2, chargeEvery: 3, toughHp: 1.3,
    // 状態
    poisonRatio: 0.45, poisonHands: 3, staggerMult: 0.5, brittleMult: 1.6, brittleHands: 5, rainStatusHands: 1,
    // 相手の段階
    enemyBase: 1.06,
    stageHp: 0.10, stageAtk: 0.10,
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
    poison:  { id: 'poison',  name: 'どく',   desc: 'まいての おわりに ダメージ（コウラ・かたいで へらない）' },
    stagger: { id: 'stagger', name: 'よろけ', desc: 'つぎの こうげきが ×0.5' },
    brittle: { id: 'brittle', name: 'もろい', desc: 'うける 1げきが ×1.6（5手）' }
  };

  // ---------- 体の性質 ----------
  var TRAITS = {
    hard:     { id: 'hard',     name: 'かたい',     desc: 'うける 1げきと はんげきが −4' },
    ranged:   { id: 'ranged',   name: 'とおくから', desc: 'はんげきを うけない' },
    fast:     { id: 'fast',     name: 'はやい',     desc: 'はやさ +6' },
    heavy:    { id: 'heavy',    name: 'おもい',     desc: 'はやさ −4、こうげき +3' },
    regen:    { id: 'regen',    name: 'かいふく',   desc: 'じぶんの手の はじめに たいりょく +5' },
    poisoner: { id: 'poisoner', name: 'どくもち',   desc: 'あてた あいてを どくに' },
    charge:   { id: 'charge',   name: 'ためる',     desc: '3手ごとに こうげきが ×2（おおわざ）' },
    tough:    { id: 'tough',    name: 'しぶとい',   desc: 'たいりょく ×1.3' }
  };
  var TRAIT_IDS = Object.keys(TRAITS);

  // ---------- そだちの方向 ----------
  var GROWS = {
    tough:  { id: 'tough',  name: 'がんじょう', desc: 'たいりょくの 上限 +' + 12, key: 'received' },
    strong: { id: 'strong', name: 'たくましい', desc: 'こうげき +' + 2, key: 'landed' },
    quick:  { id: 'quick',  name: 'すばやい',   desc: 'はやさ +' + 3, key: 'first' }
  };
  var GROW_IDS = ['tough', 'strong', 'quick'];

  // ---------- 噛み合い ----------
  var SYNERGIES = [
    { id: 1, name: 'おもし＋ツメ',       parts: ['weight', 'claw'],  desc: 'おもしの +4 が、ツメの 2〜3げき ぜんぶに のる' },
    { id: 2, name: 'ツノ＋ばねあし',     parts: ['horn', 'spring'],  desc: '2かい こうげきする手は、ツノの ×2.5 も 2かい' },
    { id: 4, name: 'しっぽ＋はね',       parts: ['tail', 'wing'],    desc: 'さきに よろけさせて、あいての つぎの こうげきを ×0.5 に' },
    { id: 5, name: 'キバ＋コウラ',       parts: ['fang', 'shell'],   desc: 'コウラで うけながら、どくで たおす（どくは へらない）' },
    { id: 6, name: 'すいつくくち＋ツメ', parts: ['leech', 'claw'],   desc: '2〜3げきの こうげきで 1げきごとに かいふく' },
    { id: 7, name: 'くだくツメ＋ツノ',   parts: ['crush', 'horn'],   desc: 'もろくした あいてに ツノの ×2.5' },
    { id: 8, name: 'はね＋ツメ',         parts: ['wing', 'claw'],    desc: 'はねで はやさを こえて、ツメが 3げきに' },
    // 版7：Lv2 入りの噛み合い（lv2 に その Lv2 が いるパーツ）。3「じょうたい＋ひかるめ」は 札の文そのものなので 消した
    { id: 9,  name: 'はじく＋トゲ',       parts: ['scale', 'spike'],  lv2: ['scale'],           desc: '0 に はじいた 1げきにも、トゲが はんげきする' },
    // 版8：10・11 を差し替え（id は ずらさない。保存に 10・11 が残っていても 新しい定義で数える）
    { id: 10, name: 'ふきとばし＋ばねあし', parts: ['horn', 'spring'],  lv2: ['horn'],            desc: '3手めに 2かい こうげきして、あいての手も とばす。3かい つづけて うごく' },
    // 昼の作業：11 を「かいたい＋ばねあし」から「かいたい＋ツノ」に（版8 質問1-A。ばねあしの 3手ごと との重なりが 要らない）
    { id: 11, name: 'かいたい＋ツノ',       parts: ['crush', 'horn'],   lv2: ['crush'],           desc: 'もろくして パーツを こわした あいてに、ツノの ×2.5 が はいる' }
  ];
  SYNERGIES.forEach(function (s) { if (!s.lv2) s.lv2 = []; });
  var SYN_BY_ID = {}; SYNERGIES.forEach(function (s) { SYN_BY_ID[s.id] = s; });

  // ---------- パーツ（16種。場所8つ×2） ----------
  var hasTrait = function (c, t) { return c.eT[t] === true; };
  var PARTS = [
    { id: 'horn', name: 'おおきなツノ', short: 'ツノ', loc: 'head', cat: 'atk', weight: 'heavy',
      effect: '3手ごとに、こうげきの 1げきめが ×2.5', lv2name: 'ふきとばし', lv2text: 'ツノの 1げきが あたると、あいての つぎの手が とぶ',
      goods: [{ text: 'かたい あいて', when: function (c) { return hasTrait(c, 'hard') || !!c.eA.scale; } },
              { text: 'コウラを もつ あいて', when: function (c) { return !!c.eA.shell; } }],
      bads: [{ text: 'ぬかるみ（おもい）', when: function (c) { return c.f === 'mud'; } },
             { text: 'よろけに してくる あいて', when: function (c) { return !!c.eA.tail; } }] },
    { id: 'eye', name: 'ひかるめ', short: 'ひかるめ', loc: 'head', cat: 'atk', weight: 'light',
      effect: 'どく・よろけ・もろいの あいてに あてると ×1.5', lv2name: 'みきり', lv2text: 'ツノと おおわざを 1戦に1回 よける',
      goods: [{ text: 'じょうたいを かけられる とき', when: function (c) { return !!(c.pA.fang || c.pA.crush || c.pA.tail) && !c.eA.fur; } }],
      bads: [{ text: 'ふさふさの あいて', when: function (c) { return !!c.eA.fur; } },
             { text: 'あめ（じょうたいが すぐ きえる）', when: function (c) { return c.f === 'rain'; } }] },
    { id: 'fang', name: 'どくのキバ', short: 'キバ', loc: 'mouth', cat: 'atk', weight: 'none',
      effect: 'あてた あいてを どくに する（どくは コウラ・かたいで へらない）', lv2name: 'もうどく', lv2text: 'どくの ダメージが 手ごとに +1 ずつ ふえる',
      goods: [{ text: 'かたい・コウラの あいて（どくは へらない）', when: function (c) { return hasTrait(c, 'hard') || !!c.eA.scale || !!c.eA.shell; } }],
      bads: [{ text: 'ふさふさの あいて', when: function (c) { return !!c.eA.fur; } },
             { text: 'あめ（どくが 1手で きえる）', when: function (c) { return c.f === 'rain'; } }] },
    { id: 'leech', name: 'すいつくくち', short: 'すいつく', loc: 'mouth', cat: 'def', weight: 'none',
      effect: 'あたえた ダメージの 1/3 を 1げきごとに かいふく', lv2name: 'おおぐい', lv2text: 'あいてを たおすたび たいりょくの 上限 +' + CFG.lv2.ooguiStep + '（しゅうかいの あいだ のこる。+' + CFG.lv2.ooguiCap + ' まで）',
      goods: [{ text: 'しぶとい・かいふくの あいて（ながい たたかい）', when: function (c) { return hasTrait(c, 'tough') || hasTrait(c, 'regen'); } }],
      bads: [{ text: 'かたい あいて（ダメージが へる）', when: function (c) { return hasTrait(c, 'hard') || !!c.eA.scale; } }] },
    { id: 'claw', name: 'するどいツメ', short: 'ツメ', loc: 'fore', cat: 'atk', weight: 'light',
      effect: 'こうげきが 2げきに なる（1げき ×0.6）。はやさで かてば 3げき', lv2name: 'つめあと', lv2text: 'あてるたび あいての はやさ −1',
      goods: [{ text: 'おそい あいて（3かい）', when: function (c) { return c.pSpd > c.eSpd; } }],
      bads: [{ text: 'かたい あいて', when: function (c) { return hasTrait(c, 'hard') || !!c.eA.scale; } },
             { text: 'トゲを もつ あいて', when: function (c) { return !!c.eA.spike && !c.pRanged; } }] },
    { id: 'crush', name: 'くだくツメ', short: 'くだく', loc: 'fore', cat: 'atk', weight: 'heavy',
      effect: 'あてた あいてを もろく する（うける ダメージ ×1.6、5手）', lv2name: 'かいたい', lv2text: 'もろい あいてに あてると パーツを 1つ 3手 こわす',
      goods: [{ text: 'コウラ・しぶといの あいて', when: function (c) { return !!c.eA.shell || hasTrait(c, 'tough'); } }],
      bads: [{ text: 'ふさふさの あいて', when: function (c) { return !!c.eA.fur; } },
             { text: 'ぬかるみ（おもい）', when: function (c) { return c.f === 'mud'; } }] },
    { id: 'spring', name: 'ばねあし', short: 'ばねあし', loc: 'hind', cat: 'mov', weight: 'light',
      effect: '3手ごとに、1手で 2かい こうげき する', lv2name: 'おおジャンプ', lv2text: '2かい こうげきする手の 2かいめが ×1.3',
      goods: [{ text: 'つよいかぜ（かるい）', when: function (c) { return c.f === 'wind'; } }],
      bads: [{ text: 'ぬかるみ（とべない）', when: function (c) { return c.f === 'mud'; } },
             { text: 'トゲを もつ あいて', when: function (c) { return !!c.eA.spike && !c.pRanged; } }] },
    { id: 'longleg', name: 'ながいあし', short: 'ながいあし', loc: 'hind', cat: 'mov', weight: 'none',
      effect: 'こうげきが とおくからに なる（はんげき されない）', lv2name: 'ふみつけ', lv2text: 'じぶんより おそい あいてに あてると ×1.5',
      goods: [{ text: 'トゲを もつ あいて', when: function (c) { return !!c.eA.spike && c.f !== 'wind'; } }],
      bads: [{ text: 'つよいかぜ（とおくからが むこう）', when: function (c) { return c.f === 'wind'; } }] },
    { id: 'spike', name: 'トゲ', short: 'トゲ', loc: 'back', cat: 'def', weight: 'none',
      effect: 'ちかくから 1げき うけるたび はんげき（じぶんの こうげき ×0.6）', lv2name: 'ばらまき', lv2text: 'とおくからの あいてにも はんげきが とどく',
      goods: [{ text: 'なんかいも なぐる あいて', when: function (c) { return c.eMany && !c.eRanged; } }],
      bads: [{ text: 'とおくから こうげきする あいて', when: function (c) { return c.eRanged; } }] },
    { id: 'weight', name: 'おもし', short: 'おもし', loc: 'back', cat: 'atk', weight: 'heavy',
      effect: '1げきごとに +4（倍率に のらない）', lv2name: 'ずしん', lv2text: 'あいてより おそいぶん 1げき＋（+8まで）',
      goods: [{ text: 'かたい あいて', when: function (c) { return hasTrait(c, 'hard') || !!c.eA.scale; } }],
      bads: [{ text: 'ぬかるみ（おもい）', when: function (c) { return c.f === 'mud'; } }] },
    { id: 'shell', name: 'かたいコウラ', short: 'コウラ', loc: 'belly', cat: 'def', weight: 'heavy',
      effect: 'うける 1げきと はんげきが −33%（どくは へらない）', lv2name: 'こうらごもり', lv2text: 'たいりょくが 3わりを きった さいしょの手、うける 1げきが 0',
      goods: [{ text: 'いちげきが つよい あいて', when: function (c) { return c.eBigHit; } }],
      bads: [{ text: 'どくもち あいて（どくは ふせげない）', when: function (c) { return hasTrait(c, 'poisoner') || !!c.eA.fang; } },
             { text: 'ぬかるみ（おもい）', when: function (c) { return c.f === 'mud'; } }] },
    { id: 'scale', name: 'いしのうろこ', short: 'うろこ', loc: 'belly', cat: 'def', weight: 'heavy',
      effect: 'かたく なる：うける 1げきと はんげきが −4（どくは へらない）', lv2name: 'はじく', lv2text: '10いかの 1げきと はんげきを 0 に はじく',
      goods: [{ text: 'なんかいも なぐる あいて', when: function (c) { return c.eMany; } }],
      bads: [{ text: 'いちげきが つよい あいて', when: function (c) { return c.eBigHit; } },
             { text: 'ぬかるみ（おもい）', when: function (c) { return c.f === 'mud'; } }] },
    { id: 'tail', name: 'ふといしっぽ', short: 'しっぽ', loc: 'tail', cat: 'mov', weight: 'heavy',
      effect: 'あてた あいては つぎの こうげきが ×0.5', lv2name: 'ふりまわし', lv2text: 'じぶんの手の おわりに、あいての じょうたいが 1手 のびる',
      goods: [{ text: 'ためる あいて', when: function (c) { return hasTrait(c, 'charge'); } },
              { text: 'いちげきが つよい あいて', when: function (c) { return c.eBigHit; } }],
      bads: [{ text: 'ふさふさの あいて', when: function (c) { return !!c.eA.fur; } },
             { text: 'あめ', when: function (c) { return c.f === 'rain'; } },
             { text: 'ぬかるみ（おもい）', when: function (c) { return c.f === 'mud'; } }] },
    { id: 'longtail', name: 'ながいしっぽ', short: 'ながしっぽ', loc: 'tail', cat: 'def', weight: 'none',
      effect: 'じぶんの手の おわりに たいりょく +4', lv2name: 'たくわえ', lv2text: 'まんたんの ときの かいふくは こうげき +2 に（+8まで）',
      goods: [{ text: 'どくもち あいて', when: function (c) { return hasTrait(c, 'poisoner') || !!c.eA.fang; } }],
      bads: [{ text: 'いちげきが つよい あいて', when: function (c) { return c.eBigHit; } }] },
    { id: 'wing', name: 'はね', short: 'はね', loc: 'shoulder', cat: 'mov', weight: 'light',
      effect: 'はやさ +10', lv2name: 'おいかぜ', lv2text: 'せんこうなら じぶんの手ごとに こうげき +1 ずつ（+6まで）',
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
      effect: 'どく・よろけ・もろい を うけない', lv2name: 'もふもふ', lv2text: 'かけられた じょうたいを あいてに はねかえす',
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
  // 頂上の ぬし（10戦目）。基礎は ふつうの相手の平均（たいりょく 75.5・こうげき 10.3）の ×1.5／×1.1。段階の伸びは他と同じ
  var AVG_HP = ENEMIES.reduce(function (a, e) { return a + e.hp; }, 0) / ENEMIES.length;   // 75.5
  var AVG_ATK = ENEMIES.reduce(function (a, e) { return a + e.atk; }, 0) / ENEMIES.length; // 10.3
  var BOSS = { id: 'boss', name: 'やまの ぬし', hp: AVG_HP, atk: AVG_ATK, spd: 8, traits: ['heavy', 'regen'], parts: ['horn', 'weight', 'fur'], boss: true, index: 'boss',
    look: { size: 1.6, color: '#6b3fa0', eyes: 'glow' } };
  var ENEMY_BY_ID = {}; ENEMIES.forEach(function (e) { ENEMY_BY_ID[e.id] = e; }); ENEMY_BY_ID.boss = BOSS;
  function enemyDefOf(idx) { return idx === 'boss' ? BOSS : ENEMIES[idx]; }

  // ---------- フィールド ----------
  var FIELDS = [
    { id: 'plain', name: 'もり',       short: 'もり',   color: '#2f5a3a', desc: 'なにも おきない。' },
    { id: 'mud',   name: 'ぬま',       short: 'ぬま',   color: '#5a4228', desc: 'おもいパーツは はやさ −8。ばねあしは 1手で 1かいしか こうげき できない。' },
    { id: 'wind',  name: 'おね',       short: 'おね',   color: '#8fa3b8', desc: 'とおくからの こうげきが むこうに なる（はんげきが あたる）。かるいパーツは はやさ +5。' },
    { id: 'rain',  name: 'あめのたに', short: 'あめ',   color: '#2b4f7a', desc: 'どく・よろけ・もろいが 1手で きえる。はねの +10 が きえる。' }
  ];
  var FIELD_BY_ID = {};
  FIELDS.forEach(function (f, i) { f.index = i; FIELD_BY_ID[f.id] = f; });
  var SUMMIT = { id: 'summit', name: 'ちょうじょう', short: 'ちょうじょう', color: '#d8e6f2', desc: 'なにも おきない。ぬしが まっている。', index: 4 };
  FIELD_BY_ID.summit = SUMMIT;

  // ---------- そだち ----------
  // grow = { tough: n, strong: n, quick: n }（それぞれの方向に育った回数）
  // grow.oogui：おおぐい（すいつくくち Lv2）で ふえた たいりょくの 上限（この周回の合計。周回のあいだ残る。途中セーブも grow ごと）
  function emptyGrow() { return { tough: 0, strong: 0, quick: 0 }; }
  function growCount(grow) { return grow ? (grow.tough || 0) + (grow.strong || 0) + (grow.quick || 0) : 0; }
  function playerDef(grow, name) {
    var g = grow || emptyGrow();
    return { id: 'player', name: name || 'あなた',
      hp: CFG.playerHp + CFG.grow.hp * (g.tough || 0) + (g.oogui || 0), atk: CFG.playerAtk + CFG.grow.atk * (g.strong || 0), spd: CFG.playerSpd + CFG.grow.spd * (g.quick || 0),
      traits: [], parts: [], grow: g };
  }
  var PLAYER_DEF = playerDef(null);
  // 前の そだち からの「うけた・あてた・せんて」の数で方向を決める。acc = { received, landed, first }
  function growDirection(acc) {
    var n = CFG.grow.norm;
    var sc = { tough: (acc.received || 0) / n.received, strong: (acc.landed || 0) / n.landed, quick: (acc.first || 0) / n.first };
    var best = 'tough';
    GROW_IDS.forEach(function (id) { if (sc[id] > sc[best] + 1e-9) best = id; });
    return { dir: best, scores: sc };
  }
  function growAfterWin(wins) { return wins > 0 && wins % CFG.grow.every === 0 && wins < CFG.runBattles; }

  // ---------- 乱数（種つき。状態を取り出して 保存・復元できる） ----------
  function makeRng(seed, state) {
    var s = state !== undefined ? (state >>> 0) : ((seed >>> 0) || 0x9e3779b9);
    var f = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.getState = function () { return s; };
    f.setState = function (v) { s = v >>> 0; };
    return f;
  }
  function randInt(rng, n) { return Math.floor(rng() * n); }
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = randInt(rng, i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ---------- 名前（ひらがな 2〜4文字）。版8：head（親の頭の文字）を渡すと その文字から始まる ----------
  var SYL = ['あ','い','う','え','お','か','き','く','け','こ','さ','し','す','せ','そ','た','ち','つ','て','と','な','に','ぬ','ね','の','は','ひ','ふ','へ','ほ','ま','み','む','め','も','や','ゆ','よ','ら','り','る','れ','ろ','わ','が','ぎ','ぐ','げ','ご','ざ','じ','ず','ぜ','ぞ','だ','で','ど','ば','び','ぶ','べ','ぼ','ぱ','ぴ','ぷ','ぺ','ぽ'];
  function makeName(rng, head) {
    var n = 2 + (rng() < 0.4 ? 1 : 0);
    var s = '';
    for (var i = 0; i < n; i++) s += SYL[randInt(rng, SYL.length)];
    var r = rng();
    if (s.length <= 3 && r < 0.18) s = s.charAt(0) + 'っ' + s.slice(1);
    else if (s.length <= 3 && r < 0.36) s = s.charAt(0) + 'ー' + s.slice(1);
    else if (s.length <= 3 && r < 0.55) s += 'ん';
    s = s.slice(0, 4);
    if (head) { // 親の頭の文字を継ぐ（1〜2文字）。残りは 作った名前の 後ろから。2文字より短くならないように
      var rest = s.slice(head.length);
      if (rest.length < 1) rest = s.slice(-1);
      s = (head + rest).slice(0, 4);
    }
    return s;
  }
  // 名前の頭の文字（1文字。2文字めが「っ」「ー」なら 2文字）
  function nameHead(name) { var h = (name || '').charAt(0); var c2 = (name || '').charAt(1); if (c2 === 'っ' || c2 === 'ー') h += c2; return h; }

  // ---------- 戦う者 ----------
  function toSet(arr) { var s = {}; (arr || []).forEach(function (x) { s[x] = true; }); return s; }
  function makeFighter(side, def, parts, stage, lv2, opts) {
    var s = stage || 1;
    var isEnemy = side === 'e';
    var hard = !!(opts && opts.hard);
    var hpMul = (isEnemy ? CFG.enemyBase * (1 + CFG.stageHp * (s - 1)) * (hard ? CFG.hard.hp : 1) * (def.boss ? CFG.boss.hp : 1) : 1);
    var atkMul = (isEnemy ? CFG.enemyBase * (1 + CFG.stageAtk * (s - 1)) * (hard ? CFG.hard.atk : 1) * (def.boss ? CFG.boss.atk : 1) : 1);
    var traits = def.traits || [];
    var T = toSet(traits);
    var maxHp = Math.round(def.hp * hpMul * (T.tough ? CFG.toughHp : 1));
    return {
      side: side, id: def.id, name: def.name, stage: s,
      maxHp: maxHp, hp: maxHp,
      baseAtk: def.atk * atkMul, baseSpd: def.spd,
      traits: traits, T: T, parts: parts.slice(), active: toSet(parts), lv2: toSet(lv2 || []),
      status: { poison: null, stagger: 0, staggerBy: null, brittle: null },
      ownHands: 0, hard: hard, boss: !!def.boss,
      // 版5：Lv2 の効果で戦いの中で変わるもの
      oogui: (def.grow && def.grow.oogui) || 0, // おおぐいで この周回に ふえた 上限（playerDef の grow から）
      spdMod: 0, atkMod: 0, dodgeLeft: CFG.lv2.eyeDodges, shellHideHand: 0, skipNext: false, broken: {}, stored: 0, tailwind: 0
    };
  }
  function isHard(f) { return !!(f.T.hard || f.active.scale); }
  function hardFlat(f) { return (f.T.hard || f.active.scale) ? CFG.hardFlat : 0; }
  function isRanged(f, fieldId) { return (!!f.T.ranged || !!f.active.longleg) && fieldId !== 'wind'; }
  function effAtk(f) { return f.baseAtk + (f.T.heavy ? CFG.traitHeavyAtk : 0) + (f.atkMod || 0); }
  function effSpd(f, fieldId, noWing) {
    var spd = f.baseSpd + (f.T.fast ? CFG.traitFastSpd : 0) + (f.T.heavy ? CFG.traitHeavySpd : 0) + (f.spdMod || 0);
    PART_IDS.forEach(function (p) {
      if (!f.active[p]) return;
      var w = PART_BY_ID[p].weight;
      if (w === 'heavy') spd += fieldId === 'mud' ? CFG.mudHeavySpd : CFG.heavySpd;
      if (w === 'light') spd += fieldId === 'wind' ? CFG.windLightSpd : CFG.lightSpd;
      if (p === 'wing' && !noWing && fieldId !== 'rain') spd += CFG.wingSpd;
    });
    return spd;
  }
  function hasStatus(f) { return !!(f.status.poison || f.status.stagger > 0 || f.status.brittle); }

  // ---------- バトル ----------
  // opts: { variance, rng, spark: { stage, pity, nare: {part: 回数}, parent: 継いだパーツ } }
  // ひらめきは 自分の側だけ、乱れがあるときだけ、1戦に1回。なれ が full なら その発動で必ず。
  // 版8：卵で継いだパーツ（spark.parent）は なれ full+1 で始まるので 最初の発動で必ず ひらめく。その spark は by:'parent'（「おやの ○○を おもいだした！」）
  // events の種類（版5で追加）:
  //   act {side:'p', part, n}        自分のパーツが発動した（n は この周回の なれ の累計。Lv2 のパーツは出さない）
  //   spark {side, part, by}         ひらめき（by: 'nare'・'chance'・'parent'（版8：卵で継いだパーツ））
  //   skip {side}                    ふきとばされて その手が とぶ      blown {side}            ふきとばされた
  //   dodge {side, part:'eye'}       ツノ・おおわざを よけた           poison に追加: grow（もうどく：つぎの手から +grow）
  //   maxUp {side, amt, total, cap, maxHp, hp} 上限が ふえた（おおぐい。あいてを たおした 手の ko の あと）  spdDown {side, spd}     はやさが さがった
  //   broken {side, part, hands}     パーツが こわれた                 repaired {side, part}   なおった
  //   shellHide {side}               こうらごもり                      statusExtend {side, statuses:[...]} 状態が のびた
  //   store {side, atk}              たくわえ（こうげき +1）           tailwind {side, n, atk} おいかぜ
  //   reflect {side, status}         状態を はねかえした（side は はねかえした側）
  //   hit に追加: stomp, zushin, deflect（0 に はじいた）, jump2（おおジャンプの 2かいめ ×1.3）, dodged
  //   版6：どく・もろい・よろけ と すいつくくちの かいふくは、1げきが あたった（dmg>0）ときだけ。トゲの はんげきは 0 の 1げきでも 返す
  //   counter に追加: thrown（ばらまき：とおくからの相手に 届いた）
  function simulateBattle(p, e, fieldId, opts) {
    opts = opts || {};
    var variance = (opts.variance === undefined) ? CFG.variance : opts.variance;
    var rng = opts.rng || function () { return 0.5; };
    function vary(x) { return variance > 0 ? x * (1 + variance * (2 * rng() - 1)) : x; }
    var sparkOpt = opts.spark || null;
    var nareBase = (sparkOpt && sparkOpt.nare) || {};
    var sparkDone = false, sparkPart = null, sparkBy = null;
    var activations = {};
    function trySpark(f, part, events) {
      if (f.side !== 'p' || !f.active[part]) return false;
      activations[part] = (activations[part] || 0) + 1;
      if (f.lv2[part]) return false;
      var nare = (nareBase[part] || 0) + activations[part];
      events.push({ t: 'act', side: f.side, part: part, n: nare });
      if (!sparkOpt || sparkDone || variance <= 0) return false;
      var chance = CFG.spark.base + CFG.spark.perStage * ((sparkOpt.stage || 1) - 1) + CFG.spark.pity * (sparkOpt.pity || 0);
      var byNare = nare > CFG.nare.full; // full に なった あと（full を超えた）の発動で必ず
      var roll = rng();
      if (byNare || roll < chance) {
        sparkDone = true; sparkPart = part; sparkBy = byNare ? ((sparkOpt.parent === part) ? 'parent' : 'nare') : 'chance'; f.lv2[part] = true;
        events.push({ t: 'spark', side: f.side, part: part, by: sparkBy });
        return true;
      }
      return false;
    }

    var F = { p: p, e: e };
    var spd = { p: effSpd(p, fieldId), e: effSpd(e, fieldId) };
    var spdNoWing = { p: effSpd(p, fieldId, true), e: effSpd(e, fieldId, true) };
    function refreshSpd(side) { spd[side] = effSpd(F[side], fieldId); spdNoWing[side] = effSpd(F[side], fieldId, true); }
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
    var first = O.first, second = O.second, gap = O.gap;
    var start = { pSpd: spd.p, eSpd: spd.e, first: first, double: gap, wingHelped: O.wingHelped, events: startEvents };

    var hands = [];
    var winner = null, timeout = false, poisonKO = false;
    var dealt = { p: {}, e: {} };
    var shellBlocks = { p: 0, e: 0 };
    var synFired = {};
    var synergies = [];
    var statusHands = fieldId === 'rain' ? CFG.rainStatusHands : null;
    var received = 0, landed = 0, firstHands = 0; // そだち用：自分が受けた回数・当てた回数・先手の手
    var maxHit = { dmg: 0, label: '' }; // さいだいの いちげき（自分の 1げき・はんげき）
    function noteHit(side, label, dmg) { if (side === 'p' && dmg > maxHit.dmg) maxHit = { dmg: dmg, label: label }; }
    var lv2Used = {}; // この戦いで Lv2 の効果が出たパーツ（確認用）
    function usedLv2(part) { lv2Used[part] = (lv2Used[part] || 0) + 1; }

    function addDealt(side, label, dmg) { dealt[side][label] = (dealt[side][label] || 0) + dmg; }
    function fireSyn(side, id, events) {
      var key = side + id;
      if (synFired[key]) return;
      synFired[key] = true;
      synergies.push({ id: id, side: side });
      events.push({ t: 'synergy', side: side, id: id, name: SYN_BY_ID[id].name });
    }
    function heal(f, amt, src, part, events) {
      if (amt <= 0 || f.hp <= 0) return 0;
      var before = f.hp;
      f.hp = Math.min(f.maxHp, f.hp + amt);
      if (f.hp > before) events.push({ t: 'heal', side: f.side, src: src, part: part, amt: f.hp - before, hp: f.hp });
      return f.hp - before;
    }
    function applyStatus(a, d, st, events, noReflect) {
      if (d.hp <= 0) return;
      if (d.active.fur) {
        trySpark(d, 'fur', events);
        if (d.lv2.fur && !noReflect) {
          // もふもふ：はねかえす
          usedLv2('fur');
          events.push({ t: 'reflect', side: d.side, status: st });
          applyStatus(d, a, st, events, true);
          return;
        }
        events.push({ t: 'blocked', side: d.side, status: st, part: 'fur' });
        return;
      }
      if (st === 'poison') {
        var dmg = Math.max(1, Math.round(effAtk(a) * CFG.poisonRatio));
        var grow = (a.lv2.fang && a.active.fang) ? CFG.lv2.poisonGrow : 0; // もうどく：手ごとに +1
        var cur = d.status.poison;
        if (cur && cur.by === a.side) { dmg = Math.max(dmg, cur.dmg); grow = Math.max(grow, cur.grow || 0); }
        d.status.poison = { left: statusHands || CFG.poisonHands, dmg: dmg, by: a.side, grow: grow };
        events.push({ t: 'status', side: d.side, status: 'poison', by: a.side, hands: d.status.poison.left, grow: grow });
      } else if (st === 'brittle') {
        d.status.brittle = { left: statusHands || CFG.brittleHands, mult: CFG.brittleMult };
        events.push({ t: 'status', side: d.side, status: 'brittle', by: a.side, hands: d.status.brittle.left, mult: CFG.brittleMult });
      } else if (st === 'stagger') {
        d.status.stagger = Math.max(d.status.stagger, 1); d.status.staggerBy = a.side;
        events.push({ t: 'status', side: d.side, status: 'stagger', by: a.side, hands: 1 });
      }
    }
    function breakPart(a, d, events) {
      // かいたい：相手の 付いている パーツを1つ、3手だけ こわす
      var cands = Object.keys(d.active).filter(function (pid) { return d.active[pid]; });
      if (!cands.length) return;
      var pid = cands[randInt(rng, cands.length)];
      d.active[pid] = false; d.broken[pid] = CFG.lv2.brokenHands;
      refreshSpd(d.side); usedLv2('crush');
      events.push({ t: 'broken', side: d.side, part: pid, hands: CFG.lv2.brokenHands, by: a.side });
    }

    function attack(a, d, events, isDouble, ctx, handNo, second) {
      var ranged = isRanged(a, fieldId);
      if (a.active.longleg && ranged) trySpark(a, 'longleg', events);
      var claws = !!a.active.claw;
      if (claws) trySpark(a, 'claw', events);
      var nHits = claws ? (spd[a.side] > spd[d.side] ? CFG.clawHitsFast : CFG.clawHitsSlow) : 1;
      var wingMadeThree = claws && (spd[a.side] > spd[d.side]) && a.active.wing && fieldId !== 'rain' && !(spdNoWing[a.side] > spd[d.side]);
      var hornNow = !!a.active.horn && (a.ownHands % CFG.hornEvery === 0);
      var chargeNow = !!a.T.charge && (a.ownHands % CFG.chargeEvery === 0);
      var staggered = a.status.stagger > 0;
      var jump2 = !!(second && a.active.spring && a.lv2.spring); // おおジャンプ：2かいめの こうげきが ×1.3
      if (jump2) usedLv2('spring');
      var hornHit = false, eyeHit = false, landedHere = 0, halvedAny = false, countered = false;
      var partBroken = Object.keys(d.broken).length > 0; // 噛み合い11：かいたいで 相手の パーツが こわれている あいだ（この こうげきの はじめ）
      if (a.active.leech) trySpark(a, 'leech', events);
      for (var h = 0; h < nHits; h++) {
        var parts = [];
        var mult = 1;
        if (claws) { mult *= CFG.clawMult; parts.push('claw'); }
        var thisHorn = (h === 0 && hornNow);
        if (thisHorn) { trySpark(a, 'horn', events); mult *= CFG.hornMult; parts.push('horn'); hornHit = true; }
        if (chargeNow) mult *= CFG.chargeMult;
        var bigMove = thisHorn || chargeNow;
        // みきり：相手の おおわざを 1戦に1回 よける
        if (bigMove && d.active.eye && d.lv2.eye && d.dodgeLeft > 0) {
          trySpark(d, 'eye', events);
          d.dodgeLeft--; usedLv2('eye');
          events.push({ t: 'dodge', side: d.side, part: 'eye', by: a.side });
          events.push({ t: 'hit', side: a.side, parts: parts, dmg: 0, hit: h + 1, hits: nHits, hp: d.hp, shell: 0, hard: false, hardFlat: 0, ranged: ranged,
            big: bigMove, horn: thisHorn, bigmove: chargeNow, eye: false, halved: false, brittle: 0, label: thisHorn ? 'ツノ' : 'おおわざ', dodged: true });
          continue;
        }
        var eyeNow = !!a.active.eye && hasStatus(d);
        if (eyeNow) { trySpark(a, 'eye', events); mult *= CFG.eyeMult; parts.push('eye'); eyeHit = true; }
        if (staggered) { mult *= CFG.staggerMult; halvedAny = true; }
        if (jump2) mult *= CFG.lv2.jump2Mult;
        // ふみつけ：じぶんより おそい あいてに ×1.5
        var stomp = false;
        if (a.active.longleg && a.lv2.longleg && spd[a.side] > spd[d.side]) {
          mult *= CFG.lv2.stompMult; stomp = true; usedLv2('longleg');
        }
        var flat = 0, zushin = 0;
        if (a.active.weight) {
          if (h === 0) trySpark(a, 'weight', events);
          flat = CFG.weightAtk; parts.push('weight');
          // ずしん：おそいほど つよい
          if (a.lv2.weight && spd[d.side] > spd[a.side]) { zushin = Math.min(CFG.lv2.zushinMax, spd[d.side] - spd[a.side]); flat += zushin; usedLv2('weight'); }
        }
        var brittleNow = !!d.status.brittle;
        var dmg = vary(effAtk(a) * mult) + flat;
        if (brittleNow) dmg *= d.status.brittle.mult;
        var blocked = 0;
        if (d.active.shell) {
          trySpark(d, 'shell', events);
          blocked = dmg * CFG.shellReduce; dmg -= blocked; shellBlocks[d.side]++;
        }
        if (isHard(d)) { if (d.active.scale) trySpark(d, 'scale', events); dmg -= hardFlat(d); }
        dmg = Math.max(1, Math.round(dmg));
        var deflect = false, shellHide = false;
        // はじく：10以下の いちげきは 0
        if (d.active.scale && d.lv2.scale && dmg <= CFG.lv2.deflectMax) { dmg = 0; deflect = true; usedLv2('scale'); }
        // こうらごもり：たいりょくが 3割を切った さいしょの手は うける ダメージ 0
        if (dmg > 0 && d.active.shell && d.lv2.shell && d.hp / d.maxHp < CFG.lv2.shellHideBelow && (d.shellHideHand === 0 || d.shellHideHand === handNo)) {
          if (d.shellHideHand === 0) d.shellHideHand = handNo;
          dmg = 0; shellHide = true; usedLv2('shell');
        }
        d.hp = Math.max(0, d.hp - dmg);
        if (dmg > 0) { landedHere++; if (a.side === 'p') landed++; else received++; }
        var label = thisHorn ? 'ツノ' : (chargeNow ? 'おおわざ' : (claws ? 'ツメ' : (eyeNow ? 'ひかるめ' : 'こうげき')));
        if (dmg > 0) addDealt(a.side, label, dmg);
        events.push({ t: 'hit', side: a.side, parts: parts, dmg: dmg, hit: h + 1, hits: nHits, hp: d.hp,
          shell: blocked > 0 ? Math.round(blocked) : 0, hard: isHard(d), hardFlat: isHard(d) ? hardFlat(d) : 0, ranged: ranged,
          big: bigMove, horn: thisHorn, bigmove: chargeNow, eye: eyeNow, halved: staggered,
          brittle: brittleNow ? d.status.brittle.mult : 0, label: label, stomp: stomp, zushin: zushin, deflect: deflect, shellHide: shellHide,
          jump2: jump2 });
        noteHit(a.side, label, dmg);
        if (shellHide) events.push({ t: 'shellHide', side: d.side });
        if (thisHorn && brittleNow && dmg > 0) fireSyn(a.side, 7, events);
        // 噛み合い11：かいたいで パーツが こわれている あいてに、ツノの 1げきが あたった
        if (thisHorn && dmg > 0 && partBroken && a.lv2.crush && a.active.crush) fireSyn(a.side, 11, events);
        // つめあと：あてるたび あいての はやさ −1
        if (claws && a.lv2.claw && dmg > 0) { d.spdMod -= CFG.lv2.clawSpdDown; refreshSpd(d.side); usedLv2('claw'); events.push({ t: 'spdDown', side: d.side, spd: spd[d.side] }); }
        if (a.active.leech && dmg > 0) {
          var hl = Math.max(1, Math.round(dmg * CFG.leechRatio));
          if (heal(a, hl, 'すいつくくち', 'leech', events) > 0) ctx.heals++;
        }
        if (d.hp <= 0) break;
        // ふきとばし：ツノの 1げきが あたると 相手の つぎの手が とぶ
        if (thisHorn && a.lv2.horn && dmg > 0) {
          d.skipNext = true; usedLv2('horn'); events.push({ t: 'blown', side: d.side, by: a.side });
          // 噛み合い10：ばねあしで 2かい こうげきする手に、ツノの 1げきが あたって ふきとばした（3かい つづけて うごく）
          if (isDouble && a.active.spring) fireSyn(a.side, 10, events);
        }
        // どく・もろい・よろけは「あてた」ときだけ（0 に はじかれた／こもられた 1げきでは かからない）
        if (dmg > 0) {
          if (a.active.fang) { trySpark(a, 'fang', events); applyStatus(a, d, 'poison', events); }
          else if (a.T.poisoner) applyStatus(a, d, 'poison', events);
          if (a.active.crush) {
            trySpark(a, 'crush', events);
            if (brittleNow && a.lv2.crush) breakPart(a, d, events); // かいたい（もろい相手に当てたとき）
            applyStatus(a, d, 'brittle', events);
          }
          if (a.active.tail) { trySpark(a, 'tail', events); applyStatus(a, d, 'stagger', events); }
        }
        // はんげき（トゲ）：1げき うけるたび（0 でも）。ばらまき なら とおくからの相手にも
        if (d.active.spike && (!ranged || d.lv2.spike)) {
          trySpark(d, 'spike', events);
          var thrown = ranged && d.lv2.spike;
          if (thrown) usedLv2('spike');
          var c = vary(effAtk(d) * CFG.spikeRatio);
          if (a.active.shell) { trySpark(a, 'shell', events); c *= (1 - CFG.shellReduce); shellBlocks[a.side]++; }
          if (isHard(a)) { if (a.active.scale) trySpark(a, 'scale', events); c -= hardFlat(a); }
          c = Math.max(1, Math.round(c));
          var cDeflect = false;
          if (a.active.scale && a.lv2.scale && c <= CFG.lv2.deflectMax) { c = 0; cDeflect = true; usedLv2('scale'); }
          a.hp = Math.max(0, a.hp - c);
          if (c > 0) { addDealt(d.side, 'はんげき', c); if (d.side === 'p') landed++; else received++; }
          countered = true;
          events.push({ t: 'counter', side: d.side, part: 'spike', dmg: c, hp: a.hp, thrown: thrown, deflect: cDeflect });
          noteHit(d.side, 'はんげき', c);
          if (deflect) fireSyn(d.side, 9, events); // 噛み合い9：0 に はじいた 1げきにも はんげき
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
      if (a.active.weight && landedHere >= 2) fireSyn(a.side, 1, events);
      if (isDouble && hornHit) fireSyn(a.side, 2, events);
      if (wingMadeThree && landedHere > 0) fireSyn(a.side, 8, events);
    }

    for (var i = 0; i < CFG.maxHands; i++) {
      var actorSide;
      if (gap) actorSide = (i < 2) ? first : (((i - 2) % 2 === 0) ? second : first);
      else actorSide = (i % 2 === 0) ? first : second;
      var a = F[actorSide], d = F[actorSide === 'p' ? 'e' : 'p'];
      a.ownHands++;
      var remH = (CFG.hornEvery - a.ownHands % CFG.hornEvery) % CFG.hornEvery;
      var remS = (CFG.springEvery - a.ownHands % CFG.springEvery) % CFG.springEvery;
      var remC = (CFG.chargeEvery - a.ownHands % CFG.chargeEvery) % CFG.chargeEvery;
      var hand = { n: i + 1, actor: actorSide, events: [],
        countdown: { horn: a.active.horn ? remH : null, spring: a.active.spring ? remS : null, charge: a.T.charge ? remC : null } };
      var ev = hand.events;
      if (i === 0 && startEvents.length) { startEvents.forEach(function (x) { ev.push(x); }); }
      // こわれた パーツは 手ごとに なおっていく
      ['p', 'e'].forEach(function (sd) {
        var f = F[sd];
        Object.keys(f.broken).forEach(function (pid) {
          f.broken[pid]--;
          if (f.broken[pid] <= 0) { delete f.broken[pid]; f.active[pid] = true; refreshSpd(sd); ev.push({ t: 'repaired', side: sd, part: pid }); }
        });
      });
      var skipped = a.skipNext;
      if (skipped) {
        a.skipNext = false;
        ev.push({ t: 'skip', side: actorSide });
      } else {
        if (actorSide === 'p' && first === 'p') firstHands++;
        // はねの発動：先手を取った手ごと（版4の答え 2-A）
        if (actorSide === 'p' && first === 'p' && a.active.wing && fieldId !== 'rain') trySpark(a, 'wing', ev);
        // おいかぜ：先手なら 手ごとに こうげき +1
        if (a.active.wing && a.lv2.wing && actorSide === first && fieldId !== 'rain' && a.tailwind < CFG.lv2.tailwindMax) {
          a.tailwind += CFG.lv2.tailwindStep; a.atkMod += CFG.lv2.tailwindStep; usedLv2('wing');
          ev.push({ t: 'tailwind', side: actorSide, n: a.tailwind, atk: Math.round(effAtk(a)) });
        }
        if (a.T.regen && a.hp > 0) heal(a, CFG.regenHeal, 'かいふく', null, ev);
        if (a.T.charge && remC === 1) ev.push({ t: 'charge', side: actorSide });
        var actions = 1;
        if (a.active.spring && fieldId !== 'mud' && remS === 0) {
          trySpark(a, 'spring', ev);
          actions = 2; ev.push({ t: 'double', side: actorSide, part: 'spring' });
        }
        var ctx = { heals: 0 };
        for (var k = 0; k < actions; k++) {
          attack(a, d, ev, actions === 2, ctx, i + 1, k === 1);
          if (d.hp <= 0 || a.hp <= 0) break;
        }
        if (ctx.heals >= 2) fireSyn(actorSide, 6, ev);
        if (d.hp > 0 && a.hp > 0 && a.active.longtail) {
          trySpark(a, 'longtail', ev);
          if (a.hp >= a.maxHp && a.lv2.longtail && a.stored < CFG.lv2.storeMax) {
            // たくわえ：まんたんの ときの 回復は こうげき +1 に
            a.stored += CFG.lv2.storeStep; a.atkMod += CFG.lv2.storeStep; usedLv2('longtail');
            ev.push({ t: 'store', side: actorSide, n: a.stored, atk: Math.round(effAtk(a)) });
          } else heal(a, CFG.longtailHeal, 'ながいしっぽ', 'longtail', ev);
        }
        // ふりまわし：じぶんの手の おわりに、相手の じょうたいが 1手 のびる
        if (a.active.tail && a.lv2.tail && d.hp > 0 && a.hp > 0) {
          var ext = [];
          if (d.status.poison) { d.status.poison.left += CFG.lv2.extendHands; ext.push({ status: 'poison', hands: d.status.poison.left }); }
          if (d.status.brittle) { d.status.brittle.left += CFG.lv2.extendHands; ext.push({ status: 'brittle', hands: d.status.brittle.left }); }
          if (d.status.stagger > 0) { d.status.stagger += CFG.lv2.extendHands; ext.push({ status: 'stagger', hands: d.status.stagger }); }
          if (ext.length) { usedLv2('tail'); ev.push({ t: 'statusExtend', side: d.side, statuses: ext }); }
        }
      }
      if (d.hp > 0 && a.hp > 0) {
        ['p', 'e'].forEach(function (sd) {
          var f = F[sd];
          if (f.status.poison && f.hp > 0 && F[sd === 'p' ? 'e' : 'p'].hp > 0) {
            var pd = f.status.poison.dmg;
            f.hp = Math.max(0, f.hp - pd);
            addDealt(f.status.poison.by, 'どく', pd);
            ev.push({ t: 'poison', side: sd, dmg: pd, hp: f.hp, grow: f.status.poison.grow || 0 });
            if (f.status.poison.grow) { f.status.poison.dmg += f.status.poison.grow; usedLv2('fang'); }
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
    // おおぐい：あいてを たおすたび たいりょくの 上限 +ooguiStep（この周回のあいだ残る。合計 ooguiCap まで）。16手の判定勝ちは「たおした」ではない
    var ooguiUp = 0;
    if (!timeout && winner === 'p' && e.hp <= 0 && p.lv2.leech && p.active.leech) {
      var had = p.oogui;
      ooguiUp = Math.max(0, Math.min(CFG.lv2.ooguiStep, CFG.lv2.ooguiCap - had));
      if (ooguiUp > 0) {
        p.maxHp += ooguiUp; p.hp += ooguiUp; usedLv2('leech');
        lastEv.push({ t: 'maxUp', side: 'p', amt: ooguiUp, total: had + ooguiUp, cap: CFG.lv2.ooguiCap, maxHp: p.maxHp, hp: p.hp });
      }
    }
    if (!timeout && poisonKO) {
      var wf = F[winner];
      if (wf.active.fang && wf.active.shell && shellBlocks[winner] >= 3) fireSyn(winner, 5, lastEv);
    }
    return { winner: winner, timeout: timeout, nHands: hands.length, hands: hands, start: start,
      p: { hp: p.hp, maxHp: p.maxHp }, e: { hp: e.hp, maxHp: e.maxHp },
      spark: sparkPart, sparkBy: sparkBy,
      summary: { dealt: dealt, synergies: synergies, poisonKO: poisonKO, activations: activations, spark: sparkPart, sparkBy: sparkBy,
        received: received, landed: landed, firstHands: firstHands, first: first, lv2Used: lv2Used, maxHit: maxHit, oogui: ooguiUp } };
  }

  // 便利：1戦をつくって回す。opts.grow（そだち）, opts.lv2（Lv2 のパーツ）, opts.spark, opts.name
  function runBattle(playerParts, enemyIndex, stage, fieldId, opts) {
    opts = opts || {};
    var def = enemyDefOf(enemyIndex);
    var p = makeFighter('p', playerDef(opts.grow || null, opts.name), playerParts, 1, opts.lv2 || []);
    var e = makeFighter('e', def, def.parts, stage, [], { hard: !!opts.hard });
    return simulateBattle(p, e, fieldId, opts);
  }

  // ---------- 画面用：◎✕ ----------
  function withPart(attached, partId) {
    if (attached.indexOf(partId) >= 0) return attached.slice();
    var loc = PART_BY_ID[partId].loc;
    return attached.filter(function (a) { return PART_BY_ID[a].loc !== loc; }).concat([partId]);
  }
  function partHints(partId, enemyDef, fieldId, attached, lv2, grow) {
    var p = makeFighter('p', playerDef(grow || null), withPart(attached || [], partId), 1, lv2 || []);
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
  // 1〜9戦目は 分かれ道（2つの道。片方は てごわい：相手 ×1.15、もらえるもの 2つ）。10戦目は ぬし。
  function newRun(rng) {
    var steps = [];
    for (var i = 0; i < CFG.runBattles - 1; i++) {
      var pair = shuffle(ENEMIES.map(function (e) { return e.index; }), rng).slice(0, 2);
      var f1 = FIELDS[randInt(rng, FIELDS.length)].id;
      var others = FIELDS.filter(function (f) { return f.id !== f1; });
      var f2 = others[randInt(rng, others.length)].id;
      var hardSide = randInt(rng, 2);
      var a = { enemy: pair[0], field: f1, hard: hardSide === 0 }, b = { enemy: pair[1], field: f2, hard: hardSide === 1 };
      steps.push([a, b]);
    }
    return { steps: steps, boss: { enemy: 'boss', field: SUMMIT.id, hard: false }, battle: 0, wins: 0, history: [], name: makeName(rng) };
  }
  // その戦いの道（選んだ側）。battle 0..8 は steps[battle][choice]、9 は ぬし
  function pathOf(run, battle, choice) { return battle >= CFG.runBattles - 1 ? run.boss : run.steps[battle][choice || 0]; }
  // 始めの もちもの 6つ：せめ・まもり・うごき から 1つずつ ＋ 残りから 3つ。
  // 版8：inherit（卵で継ぐパーツ）を渡すと、それが 6つのうちの 1つ（その種類の 1つ目）になり、同じ場所のパーツは ランダムに選ばない
  function startItems(rng, inherit) {
    var picked = [];
    if (inherit && PART_BY_ID[inherit]) {
      var ih = PART_BY_ID[inherit];
      picked.push(inherit);
      CATS.forEach(function (c) {
        if (c.id === ih.cat) return;
        var cands = PARTS.filter(function (p) { return p.cat === c.id && p.loc !== ih.loc; });
        picked.push(cands[randInt(rng, cands.length)].id);
      });
      var rest2 = PART_IDS.filter(function (id) { return picked.indexOf(id) < 0 && PART_BY_ID[id].loc !== ih.loc; });
      return picked.concat(shuffle(rest2, rng).slice(0, 6 - picked.length));
    }
    CATS.forEach(function (c) {
      var cands = PARTS.filter(function (p) { return p.cat === c.id; });
      picked.push(cands[randInt(rng, cands.length)].id);
    });
    var rest = PART_IDS.filter(function (id) { return picked.indexOf(id) < 0; });
    return picked.concat(shuffle(rest, rng).slice(0, 3));
  }
  // かてば もらえる（版7・版8）。報酬は { kind:'part', part }（拾う）か { kind:'nare', part, amt }（そのパーツの なれ +10）。なしは null。
  // 順（版8で固定。版7 質問1-A「新しいパーツを先」）：1 相手のパーツで 持っていないもの → 2 16種で 持っていないもの → 3 相手のパーツで Lv2 でないもの（なれ +10）→ 4 持っている Lv2 でないもの（なれ +10）→ 5 なし
  function pickOne(cands, rng) { return cands.length ? cands[randInt(rng, cands.length)] : null; }
  function rewardFor(enemyDef, owned, lv2, rng) {
    lv2 = lv2 || [];
    var notOwned = function (id) { return owned.indexOf(id) < 0; };
    var ownedNotLv2 = function (id) { return owned.indexOf(id) >= 0 && lv2.indexOf(id) < 0; };
    var r = pickOne(enemyDef.parts.filter(notOwned), rng);
    if (r) return { kind: 'part', part: r };
    r = pickOne(PART_IDS.filter(notOwned), rng);
    if (r) return { kind: 'part', part: r };
    if (CFG.nare.dup > 0) { r = pickOne(enemyDef.parts.filter(ownedNotLv2), rng); if (r) return { kind: 'nare', part: r, amt: CFG.nare.dup }; }
    if (CFG.nare.dup > 0) { r = pickOne(PART_IDS.filter(ownedNotLv2), rng); if (r) return { kind: 'nare', part: r, amt: CFG.nare.dup }; }
    return null;
  }
  // てごわい なら 2つ。2つ目：持っていない中から 1つ → なければ 持っている Lv2 でないパーツ（1つ目と別）の なれ +10 → なければ なし。配列で返す（0〜2個）
  function rewardsFor(enemyDef, owned, lv2, rng, hard) {
    lv2 = lv2 || [];
    var out = [];
    var r1 = rewardFor(enemyDef, owned, lv2, rng);
    if (r1) out.push(r1);
    if (hard) {
      var p1 = r1 ? r1.part : null;
      var r2 = pickOne(PART_IDS.filter(function (id) { return owned.indexOf(id) < 0 && id !== p1; }), rng);
      if (r2) out.push({ kind: 'part', part: r2 });
      else if (CFG.nare.dup > 0) {
        r2 = pickOne(PART_IDS.filter(function (id) { return owned.indexOf(id) >= 0 && lv2.indexOf(id) < 0 && id !== p1; }), rng);
        if (r2) out.push({ kind: 'nare', part: r2, amt: CFG.nare.dup });
      }
    }
    return out;
  }
  // 分かれ道に来たとき：両方の道の「かてば もらえる」を決めて path.rewards に入れる（ぬしは なし）。画面とボットで 同じ順に乱数を使う
  function forkRewards(run, battle, owned, lv2, rng) {
    if (battle >= CFG.runBattles - 1) { run.boss.rewards = []; return [run.boss]; }
    var step = run.steps[battle];
    step.forEach(function (path) { path.rewards = rewardsFor(enemyDefOf(path.enemy), owned, lv2, rng, path.hard); });
    return step;
  }
  // 勝ったあと 報酬を受け取る（owned・nare を書き換える）。返り値：{ kind:'part', part } ／ { kind:'nare', part, amt, from, to, full }（full：つぎの発動で ひらめく）／ null
  function applyReward(r, owned, nare, lv2) {
    if (!r) return null;
    if (r.kind === 'part') { if (owned.indexOf(r.part) >= 0) return null; owned.push(r.part); return { kind: 'part', part: r.part }; }
    if (r.kind === 'nare') {
      if ((lv2 || []).indexOf(r.part) >= 0) return null; // Lv2 のパーツには なれ は付かない
      var from = nare[r.part] || 0, to = from + r.amt;
      nare[r.part] = to;
      return { kind: 'nare', part: r.part, amt: r.amt, from: from, to: to, full: to >= CFG.nare.full };
    }
    return null;
  }

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
  function growKey(grow) { var g = grow || emptyGrow(); return (g.tough || 0) + ',' + (g.strong || 0) + ',' + (g.quick || 0) + ',' + (g.oogui || 0); }
  function score(res) {
    return (res.winner === 'p' ? 1 : 0) + 0.5 * (res.p.hp / res.p.maxHp - res.e.hp / res.e.maxHp);
  }
  var memo = {};
  function clearMemo() { memo = {}; }
  function bestLoadout(owned, enemyIndex, stage, fieldId, grow, lv2, hard) {
    var key = ownedMask(owned) + '|' + enemyIndex + '|' + stage + '|' + fieldId + '|' + growKey(grow) + '|' + ownedMask(lv2 || []) + '|' + (hard ? 'H' : '');
    if (memo[key]) return memo[key];
    var best = null;
    // 乱れなし1回 ＋ 種を固定した乱れあり2回 の平均で選ぶ（乱れなしだけだと、1点差の きわどい組み合わせを選んでしまう）
    var h = 0; for (var ci = 0; ci < key.length; ci++) h = (h * 31 + key.charCodeAt(ci)) >>> 0;
    loadouts(owned).forEach(function (combo) {
      var res = runBattle(combo, enemyIndex, stage, fieldId, { variance: 0, grow: grow || null, lv2: lv2 || [], hard: hard });
      var s = score(res);
      for (var t = 1; t <= 2; t++) s += score(runBattle(combo, enemyIndex, stage, fieldId, { rng: makeRng(h + t * 7919 + ownedMask(combo)), grow: grow || null, lv2: lv2 || [], hard: hard }));
      s /= 3;
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
    GROWS: GROWS, GROW_IDS: GROW_IDS, emptyGrow: emptyGrow, growCount: growCount, growDirection: growDirection, growAfterWin: growAfterWin,
    SYNERGIES: SYNERGIES, SYN_BY_ID: SYN_BY_ID,
    PARTS: PARTS, PART_BY_ID: PART_BY_ID, PART_IDS: PART_IDS, CATS: CATS,
    ENEMIES: ENEMIES, BOSS: BOSS, ENEMY_BY_ID: ENEMY_BY_ID, enemyDefOf: enemyDefOf, FIELDS: FIELDS, SUMMIT: SUMMIT, FIELD_BY_ID: FIELD_BY_ID, PLAYER_DEF: PLAYER_DEF, playerDef: playerDef, makeName: makeName, nameHead: nameHead,
    makeRng: makeRng, randInt: randInt, shuffle: shuffle,
    makeFighter: makeFighter, effSpd: effSpd, effAtk: effAtk, isHard: isHard, isRanged: isRanged,
    simulateBattle: simulateBattle, runBattle: runBattle,
    partHints: partHints, withPart: withPart,
    newRun: newRun, pathOf: pathOf, forkRewards: forkRewards, startItems: startItems, rewardFor: rewardFor, rewardsFor: rewardsFor, applyReward: applyReward,
    loadouts: loadouts, bestLoadout: bestLoadout, randomLoadout: randomLoadout, clearMemo: clearMemo, score: score
  };
});
