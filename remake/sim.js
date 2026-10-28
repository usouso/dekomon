// でこもん 作り直しの版（remake/）— ゲームのルール（画面のコードは入れない）
// ブラウザ（index.html）と Node（bot.js・tests.js）の両方から同じファイルを読む。
// 設計書：https://claude.ai/artifact/GGMbMbeSY1gf7wLvytHtyb （キーワード・5つの ステータス・うん・役割の 枠・ハート）
// その1（2026-10-29）：キーワードの パーツ 16・相手 10＋ぬし・種類 4（1つの テーマ）・ハート 3・負けの 理由・ヒント。
//   ひらめき（技を 覚える）・自由枠・卵・場所 は まだ（その2 以降）。かわりに 勝つと「レベルアップ」（FE 式。その2 で ひらめきに つなぐ）。
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DekoRe = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------- 数値（調整は ここだけ） ----------
  var CFG = {
    runBattles: 10, hearts: 3, maxRounds: 12,
    // キーワード
    renMult: 0.6,          // れんげき：1げきは こうげきの 6わり
    chargeEvery: 3, chargeMult: 2, // ためる：じぶんの 3手ごとに その手の こうげきが ×2
    heavyAtk: 2, heavySpd: -2,     // おもい
    neraiPlus: 2,          // ねらいうち：じょうたいの あいてへの 1げき +2
    poisonDmg: 2, poisonHands: 3,  // どく：じぶんの手の おわりに 2 ダメージ（3手）
    staggerMult: 0.5,      // よろけ：つぎの こうげきが ×0.5
    brittlePlus: 2, brittleHands: 3, // もろい：うける 1げき +2（3手）
    hardDef: 2,            // かたい：まもり +2
    counterRatio: 0.5,     // はんげき：ちかくから 1げき うけるたび じぶんの こうげきの 半分で
    regenHeal: 2,          // かいふく：じぶんの手の はじめに たいりょく +2
    leechRatio: 1 / 3,     // すいとり：あたえた ダメージの 1/3
    fastSpd: 3,            // はやい：はやさ +3
    // うん
    critBase: 3, critPerLuck: 2, critSharp: 15, critMult: 2, // かいしん％ ＝ 3 ＋ うん×2（＋するどい 15）、ダメージ ×2
    dodgePerLuck: 2, dodgeHirari: 15, dodgeYokeru: 25,        // かいひ％：じぶん＝うん×2（＋ひらり 15）、あいて＝よける 25
    // 相手の 強さ（段階 s＝1〜10）
    stageHp: 0.25, stageAtk: 0.18, stageDefEvery: 4,
    hard: { hp: 1.2, atk: 1 },     // てごわい：たいりょく ×1.2・こうげき +1
    boss: { hp: 1.3, atk: 1 },
    hpUp: 2,               // レベルアップの たいりょくは +2（ほかは +1）
    startParts: 3,         // はじめの もちもの（役割ごとに 1つ）
    // 負けの 理由の 確かめ（決定 28-2：当たらない 理由は 出さない）。同じ 相手と reasonTries 回 戦わせて、
    // 理由が すすめる 向きに 1つの 枠を かえると reasonGain 以上 勝ちやすく、関係ない 1つを かえた 平均より reasonOver 以上 上の ときだけ その 理由を 出す
    reasonTries: 24, reasonGain: 0.15, reasonOver: 0.10,
    closeRate: 0.5         // もとの パーツでも この 勝率 以上なら「うんが わるかった」
  };

  // ---------- キーワード（役割の 色：せめ＝赤・まもり＝青・うごき＝緑・うん＝黄・じょうたい＝紫） ----------
  var KW = [
    { id: 'ren',     name: 'れんげき',   role: 'atk',  text: function () { return 'こうげきが 2げきに なる（1げきは こうげきの 6わり）'; } },
    { id: 'charge',  name: 'ためる',     role: 'atk',  text: function () { return 'じぶんの ' + CFG.chargeEvery + '手ごとに、その手の こうげきが ×' + CFG.chargeMult; } },
    { id: 'heavy',   name: 'おもい',     role: 'atk',  text: function () { return 'こうげき +' + CFG.heavyAtk + '、はやさ ' + CFG.heavySpd; } },
    { id: 'nerai',   name: 'ねらいうち', role: 'atk',  text: function () { return 'じょうたいの あいてへの 1げき +' + CFG.neraiPlus; } },
    { id: 'ranged',  name: 'とおくから', role: 'atk',  text: function () { return 'はんげきを うけない'; } },
    { id: 'poison',  name: 'どく',       role: 'st',   text: function () { return 'あてた あいては どく（手の おわりに ' + CFG.poisonDmg + ' ダメージ・' + CFG.poisonHands + '手。まもりで へらない）'; } },
    { id: 'stagger', name: 'よろけ',     role: 'st',   text: function () { return 'あてた あいての つぎの こうげきが ×' + CFG.staggerMult; } },
    { id: 'brittle', name: 'もろく',     role: 'st',   text: function () { return 'あてた あいては もろい（うける 1げき +' + CFG.brittlePlus + '・' + CFG.brittleHands + '手）'; } },
    { id: 'hard',    name: 'かたい',     role: 'def',  text: function () { return 'まもり +' + CFG.hardDef; } },
    { id: 'counter', name: 'はんげき',   role: 'def',  text: function () { return 'ちかくから 1げき うけるたび、こうげきの 半分で やりかえす'; } },
    { id: 'regen',   name: 'かいふく',   role: 'def',  text: function () { return 'じぶんの手の はじめに たいりょく +' + CFG.regenHeal; } },
    { id: 'leech',   name: 'すいとり',   role: 'def',  text: function () { return 'あたえた ダメージの 1/3 だけ かいふく'; } },
    { id: 'immune',  name: 'へっちゃら', role: 'def',  text: function () { return 'どく・よろけ・もろい を うけない'; } },
    { id: 'fast',    name: 'はやい',     role: 'mov',  text: function () { return 'はやさ +' + CFG.fastSpd; } },
    { id: 'sharp',   name: 'するどい',   role: 'luck', text: function () { return 'かいしん +' + CFG.critSharp + '%'; } },
    { id: 'hirari',  name: 'ひらり',     role: 'luck', text: function () { return 'かいひ +' + CFG.dodgeHirari + '%'; } },
    { id: 'yokeru',  name: 'よける',     role: 'luck', text: function () { return '1げきを ' + CFG.dodgeYokeru + '% で よける（あいてだけ）'; } },
    { id: 'sure',    name: 'ひっちゅう', role: 'luck', text: function () { return 'よけられない'; } }
  ];
  var KW_BY_ID = {}; KW.forEach(function (k, i) { k.index = i; KW_BY_ID[k.id] = k; });
  var ROLES = [{ id: 'atk', name: 'せめ', color: '#e5534b' }, { id: 'def', name: 'まもり', color: '#4a8fe7' }, { id: 'mov', name: 'うごき', color: '#46b85a' }];
  var ROLE_COLOR = { atk: '#e5534b', def: '#4a8fe7', mov: '#46b85a', luck: '#e8b923', st: '#a66bd6' };
  var STATS = [{ id: 'hp', name: 'たいりょく' }, { id: 'atk', name: 'こうげき' }, { id: 'def', name: 'まもり' }, { id: 'spd', name: 'はやさ' }, { id: 'luck', name: 'うん' }];

  // ---------- パーツ 16（1行目＝キーワード、2行目＝その パーツだけの ひとこと。文字どおりに 動く） ----------
  // bonus：ひとことが 数字の ときの 中身。special：ひとことが 動きの ときの 名前（battle の 中で 見る）
  var PARTS = [
    { id: 'horn', short: 'ツノ',     name: 'ツノ',         role: 'atk', kw: ['charge', 'heavy'],  line: 'ためた 1げきは まもりを むしする', special: 'hornPierce' },
    { id: 'eye', short: 'ひかるめ',      name: 'ひかるめ',     role: 'atk', kw: ['nerai', 'sure'],    line: 'こうげき +1', bonus: { atk: 1 } },
    { id: 'fang', short: 'キバ',     name: 'どくのキバ',   role: 'atk', kw: ['poison'],           line: 'どくの あいてに あてると どくが +1', special: 'fangGrow' },
    { id: 'claw', short: 'ツメ',     name: 'するどいツメ', role: 'atk', kw: ['ren'],              line: 'あいてより はやければ 3げき', special: 'claw3' },
    { id: 'crush', short: 'くだく',    name: 'くだくツメ',   role: 'atk', kw: ['brittle', 'heavy'], line: 'こうげき +1', bonus: { atk: 1 } },
    { id: 'weight', short: 'おもし',   name: 'おもし',       role: 'atk', kw: ['heavy'],            line: '1げきごとに +1', special: 'weightPlus' },
    { id: 'leech', short: 'すいつく', name: 'すいつくくち', role: 'def', kw: ['leech'],            line: 'たいりょく +3', bonus: { hp: 3 } },
    { id: 'spike', short: 'トゲ',    name: 'トゲ',         role: 'def', kw: ['counter'],          line: 'まもり +1', bonus: { def: 1 } },
    { id: 'shell', short: 'コウラ',    name: 'かたいコウラ', role: 'def', kw: ['hard', 'heavy'],    line: 'たいりょく +3', bonus: { hp: 3 } },
    { id: 'scale', short: 'うろこ',    name: 'いしのうろこ', role: 'def', kw: ['hard'],             line: 'まもり +1', bonus: { def: 1 } },
    { id: 'longtail', short: 'ながお', name: 'ながいしっぽ', role: 'def', kw: ['regen'],            line: 'たいりょく +2', bonus: { hp: 2 } },
    { id: 'fur', short: 'ふさふさ',      name: 'ふさふさのけ', role: 'def', kw: ['immune'],           line: 'たいりょく +3', bonus: { hp: 3 } },
    { id: 'spring', short: 'ばね',   name: 'ばねあし',     role: 'mov', kw: ['fast'],             line: '3手ごとに もう1かい こうげき', special: 'springExtra' },
    { id: 'longleg', short: 'ながあし',  name: 'ながいあし',   role: 'mov', kw: ['ranged'],           line: 'はやさ +1', bonus: { spd: 1 } },
    { id: 'tail', short: 'しっぽ',     name: 'ふといしっぽ', role: 'mov', kw: ['stagger', 'heavy'], line: 'こうげき +1', bonus: { atk: 1 } },
    { id: 'wing', short: 'はね',     name: 'はね',         role: 'mov', kw: ['fast', 'hirari'],   line: 'うん +1', bonus: { luck: 1 } }
  ];
  var PART_BY_ID = {}; PARTS.forEach(function (p, i) { p.index = i; PART_BY_ID[p.id] = p; });
  var PART_IDS = PARTS.map(function (p) { return p.id; });

  // ---------- 技（生まれつき。種類ごとに 2つ。いつでも 出る） ----------
  var WAZA = [
    { id: 'kokozo',  name: 'ここぞ',     text: 'たいりょくが 半分より すくない 最初の手から、つぎに あたる 1げきが かならず かいしん' },
    { id: 'lucky',   name: 'ラッキー',   text: 'よけた つぎの じぶんの手から、つぎに あたる 1げきが かならず かいしん' },
    { id: 'hitoiki', name: 'ひといき',   text: '4手ごとに、じぶんの手の はじめに たいりょく +3' },
    { id: 'gaman',   name: 'がまん',     text: '1げき うけるたび、つぎの こうげきの 1げき +1（+3 まで）' },
    { id: 'hayauchi', name: 'はやうち',  text: 'さいしょの じぶんの手は 2かい こうげき' },
    { id: 'renda',   name: 'れんだ',     text: '4手ごとに、もう1かい こうげき' },
    { id: 'oonaguri', name: 'おおなぐり', text: '4手ごとに、つぎに あたる 1げきが ×2' },
    { id: 'ikari',   name: 'いかり',     text: 'たいりょくが 半分より すくないと こうげき +2' }
  ];
  var WAZA_BY_ID = {}; WAZA.forEach(function (w) { WAZA_BY_ID[w.id] = w; });

  // ---------- 種類 4（1つの テーマ：生まれつきの キーワード・伸びやすい ステータス） ----------
  // grow：レベルアップで その ステータスが 上がる 確率（FE の 成長率）。いまは ひらめきが まだ ないので 勝つたびに 1回。
  var SPECIES = [
    { id: 'koron',  name: 'ころん', theme: 'うんの子',   kw: 'sharp', color: '#e8a33c', shape: 'round',
      base: { hp: 23, atk: 5, def: 0, spd: 6, luck: 5 }, grow: { hp: 0.65, atk: 0.45, def: 0.25, spd: 0.4, luck: 0.7 }, waza: ['kokozo', 'lucky'] },
    { id: 'gotsun', name: 'ごつん', theme: 'まもりの子', kw: 'hard',  color: '#7d8a96', shape: 'block',
      base: { hp: 20, atk: 4, def: 0, spd: 3, luck: 2 }, grow: { hp: 0.6, atk: 0.4, def: 0.65, spd: 0.25, luck: 0.3 }, waza: ['hitoiki', 'gaman'] },
    { id: 'pyun',   name: 'ぴゅん', theme: 'はやさの子', kw: 'fast',  color: '#4fb3a9', shape: 'slim',
      base: { hp: 19, atk: 5, def: 0, spd: 6, luck: 3 }, grow: { hp: 0.5, atk: 0.45, def: 0.25, spd: 0.7, luck: 0.4 }, waza: ['hayauchi', 'renda'] },
    { id: 'doshin', name: 'どしん', theme: 'ちからの子', kw: 'heavy', color: '#c0504d', shape: 'big',
      base: { hp: 22, atk: 4, def: 0, spd: 4, luck: 2 }, grow: { hp: 0.6, atk: 0.7, def: 0.3, spd: 0.25, luck: 0.3 }, waza: ['oonaguri', 'ikari'] }
  ];
  var SPECIES_BY_ID = {}; SPECIES.forEach(function (s) { SPECIES_BY_ID[s.id] = s; });

  // ---------- 相手 10＋ぬし（相手は うんを 持たない。会心・回避は キーワードの ときだけ） ----------
  var ENEMIES = [
    { id: 'turtle',   name: 'イシガメ',       hp: 15, atk: 3, def: 0, spd: 3, kw: [],         parts: ['shell', 'horn'],    color: '#8a9a5b', shape: 'wide' },
    { id: 'snake',    name: 'ヒルヘビ',       hp: 14, atk: 3, def: 0, spd: 5, kw: ['fast'],   parts: ['fang'],             color: '#7a5fa8', shape: 'blob' },
    { id: 'deer',     name: 'ツノジカ',       hp: 15, atk: 3, def: 0, spd: 5, kw: [],         parts: ['horn', 'wing'],     color: '#c99a5b', shape: 'tall' },
    { id: 'hedgehog', name: 'ハリネズ',       hp: 15, atk: 3, def: 0, spd: 3, kw: ['regen'],  parts: ['spike', 'fur'],     color: '#9c7a5a', shape: 'round' },
    { id: 'bird',     name: 'ヤリドリ',       hp: 13, atk: 4, def: 0, spd: 6, kw: ['yokeru'], parts: ['longleg', 'eye'],   color: '#d9b36c', shape: 'tall' },
    { id: 'frog',     name: 'ドロガエル',     hp: 15, atk: 3, def: 0, spd: 3, kw: ['hard'],   parts: ['spike', 'longtail'], color: '#7b6a4e', shape: 'blob' },
    { id: 'wolf',     name: 'ツタオオカミ',   hp: 14, atk: 3, def: 0, spd: 5, kw: [],         parts: ['claw', 'spring'],   color: '#5fa86a', shape: 'blob' },
    { id: 'jelly',    name: 'ヒカリクラゲ',   hp: 15, atk: 3, def: 0, spd: 4, kw: ['ranged'], parts: ['leech', 'scale'],   color: '#6f9ceb', shape: 'dome' },
    { id: 'boar',     name: 'マグマイノシシ', hp: 15, atk: 3, def: 0, spd: 4, kw: [],         parts: ['weight', 'crush'],  color: '#b5413a', shape: 'wide' },
    { id: 'cat',      name: 'カゲネコ',       hp: 13, atk: 3, def: 0, spd: 6, kw: ['yokeru'], parts: ['tail', 'fang'],     color: '#4a4f66', shape: 'round' }
  ];
  ENEMIES.forEach(function (e, i) { e.index = i; });
  var BOSS = { id: 'boss', name: 'やまの ぬし', hp: 22, atk: 3, def: 0, spd: 3, kw: ['regen', 'immune'], parts: ['horn', 'scale'], color: '#6b3fa0', shape: 'wide', boss: true, index: 'boss' };
  var ENEMY_BY_ID = {}; ENEMIES.forEach(function (e) { ENEMY_BY_ID[e.id] = e; }); ENEMY_BY_ID.boss = BOSS;
  function enemyDef(idx) { return idx === 'boss' ? BOSS : ENEMIES[idx]; }

  // ---------- 乱数 ----------
  function rngFrom(seed) {
    var a = (seed >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function mix(a, b) { var h = (Math.imul((a >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) + Math.imul((b >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x27D4EB2F) >>> 0; return (h ^ (h >>> 16)) >>> 0; }
  function shuffle(arr, rng) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- 強さの 計算（画面も これを 使う。画面で 計算しなおさない） ----------
  // src：{ base:{hp,atk,def,spd,luck}, kw:[生まれつき], parts:[id], enemy:bool }
  function statsOf(src) {
    var b = src.base, kw = {};
    (src.kw || []).forEach(function (k) { kw[k] = true; });
    var plus = { hp: 0, atk: 0, def: 0, spd: 0, luck: 0 }, specials = {};
    (src.parts || []).forEach(function (pid) {
      var p = PART_BY_ID[pid]; if (!p) return;
      p.kw.forEach(function (k) { kw[k] = true; });
      if (p.bonus) Object.keys(p.bonus).forEach(function (s) { plus[s] += p.bonus[s]; });
      if (p.special) specials[p.special] = true;
    });
    var st = {
      hp: b.hp + plus.hp,
      atk: b.atk + plus.atk + (kw.heavy ? CFG.heavyAtk : 0),
      def: b.def + plus.def + (kw.hard ? CFG.hardDef : 0),
      spd: Math.max(0, b.spd + plus.spd + (kw.fast ? CFG.fastSpd : 0) + (kw.heavy ? CFG.heavySpd : 0)),
      luck: src.enemy ? 0 : b.luck + plus.luck
    };
    st.crit = src.enemy ? (kw.sharp ? CFG.critSharp : 0) : CFG.critBase + CFG.critPerLuck * st.luck + (kw.sharp ? CFG.critSharp : 0);
    st.dodge = src.enemy ? (kw.yokeru ? CFG.dodgeYokeru : 0) + (kw.hirari ? CFG.dodgeHirari : 0) : CFG.dodgePerLuck * st.luck + (kw.hirari ? CFG.dodgeHirari : 0);
    st.kw = kw; st.specials = specials;
    return st;
  }
  // 相手の 段階ごとの 基礎（s＝1〜10、hard＝てごわい）
  function enemyBase(idx, s, hard) {
    var d = enemyDef(idx);
    var hp = d.hp * (1 + CFG.stageHp * (s - 1)) * (hard ? CFG.hard.hp : 1) * (d.boss ? CFG.boss.hp : 1);
    var atk = d.atk * (1 + CFG.stageAtk * (s - 1)) + (hard ? CFG.hard.atk : 0) + (d.boss ? CFG.boss.atk : 0);
    return { hp: Math.round(hp), atk: Math.round(atk), def: d.def + Math.floor((s - 1) / CFG.stageDefEvery), spd: d.spd, luck: 0 };
  }
  function enemySrc(idx, s, hard) { var d = enemyDef(idx); return { base: enemyBase(idx, s, hard), kw: d.kw, parts: d.parts, enemy: true }; }
  function playerSrc(run, equip) {
    var sp = SPECIES_BY_ID[run.species];
    return { base: run.stats, kw: [sp.kw], parts: equipList(equip), enemy: false };
  }
  function equipList(equip) { var e = equip || {}; return ['atk', 'def', 'mov'].map(function (r) { return e[r]; }).filter(function (x) { return !!x; }); }

  // ---------- 戦い ----------
  // 1手＝どちらか 片方の 番。1まわり（round）に 両方が 1手ずつ。はやい ほうが 先（同じなら じぶん）。maxRounds で 時間ぎれ＝のこりの たいりょくの わりあいで 決める（同じなら あいての かち）。
  // 返すもの：{ win, rounds, events:[...], taken:{src:dmg}, dealt, pHp, eHp, timeout }
  function fighter(side, name, src, waza) {
    var st = statsOf(src);
    return { side: side, name: name, st: st, kw: st.kw, sp: st.specials, hp: st.hp, maxHp: st.hp, hands: 0,
      poison: 0, poisonPow: 0, stagger: false, brittle: 0, waza: waza || [], kokozoUsed: false, luckyNext: false, gaman: 0 };
  }
  function battle(pSrc, eSrc, seed, opts) {
    opts = opts || {};
    var rng = rngFrom(seed);
    var P = fighter('p', opts.pName || 'じぶん', pSrc, opts.waza), E = fighter('e', opts.eName || 'あいて', eSrc, []);
    var ev = [], taken = { hit: 0, charge: 0, poison: 0, counter: 0 }, dodged = { p: 0, e: 0 };
    var log = function (o) { ev.push(o); };
    var first = P.st.spd >= E.st.spd ? P : E, second = first === P ? E : P;
    log({ t: 'start', first: first.side, pSpd: P.st.spd, eSpd: E.st.spd });
    var timeout = false, r;
    function dead() { return P.hp <= 0 || E.hp <= 0; }
    function dmgTo(t, n, src, from) {
      t.hp -= n; if (t.side === 'p') taken[src] = (taken[src] || 0) + n;
    }
    function heal(f, n, src) { if (n <= 0 || f.hp >= f.maxHp) return; var h = Math.min(n, f.maxHp - f.hp); f.hp += h; log({ t: 'heal', who: f.side, n: h, src: src, hp: f.hp }); }
    function oneAttack(a, d, opt) {
      // opt：{ hits, mult1（1げきめの 倍率）, forceCrit1 }
      var hits = opt.hits, mult = a.kw.ren ? CFG.renMult : 1;
      var charged = a.kw.charge && a.hands % CFG.chargeEvery === 0;
      if (charged) log({ t: 'kw', who: a.side, kw: 'charge' });
      var st = a.stagger; if (st) { a.stagger = false; log({ t: 'kw', who: a.side, kw: 'stagger', on: 'self' }); }
      var atk = a.st.atk + (a.waza.indexOf('ikari') >= 0 && a.hp * 2 < a.maxHp ? 2 : 0);
      var dealtSum = 0;
      for (var h = 0; h < hits && !dead(); h++) {
        // かいひ
        var dodge = a.kw.sure ? 0 : d.st.dodge;
        if (dodge > 0 && rng() * 100 < dodge) { dodged[d.side]++; log({ t: 'dodge', who: d.side, by: d.kw.yokeru ? 'yokeru' : d.kw.hirari ? 'hirari' : 'luck' }); if (d.waza.indexOf('lucky') >= 0) d.luckyNext = true; continue; }
        var m = mult * (charged ? CFG.chargeMult : 1) * (st ? CFG.staggerMult : 1) * (a.multPending || 1); a.multPending = 0;
        var raw = atk * m;
        if (a.sp.weightPlus) raw += 1;
        if (a.gaman) { raw += a.gaman; a.gaman = 0; }
        var status = d.poison > 0 || d.stagger || d.brittle > 0;
        if (a.kw.nerai && status) raw += CFG.neraiPlus;
        if (d.brittle > 0) raw += CFG.brittlePlus;
        var def = (charged && a.sp.hornPierce) ? 0 : d.st.def;
        var dmg = Math.max(1, Math.round(raw) - def);
        var crit = a.critPending || rng() * 100 < a.st.crit; a.critPending = false;
        if (crit) dmg *= CFG.critMult;
        dmgTo(d, dmg, charged ? 'charge' : 'hit', a.side);
        dealtSum += dmg;
        log({ t: 'hit', who: a.side, to: d.side, dmg: dmg, crit: !!crit, charged: !!charged, nerai: !!(a.kw.nerai && status), brittle: d.brittle > 0, pierce: !!(charged && a.sp.hornPierce && d.st.def > 0), hp: d.hp });
        if (d.waza.indexOf('gaman') >= 0 && d.gaman < 3) d.gaman++;
        if (d.hp > 0) {
          // じょうたいを かける
          if (!d.kw.immune) {
            if (a.kw.poison) { if (d.poison > 0 && a.sp.fangGrow) { d.poisonPow++; log({ t: 'kw', who: a.side, kw: 'fangGrow', n: CFG.poisonDmg + d.poisonPow }); } d.poison = CFG.poisonHands; log({ t: 'status', who: d.side, st: 'poison' }); }
            if (a.kw.stagger) { d.stagger = true; log({ t: 'status', who: d.side, st: 'stagger' }); }
            if (a.kw.brittle) { d.brittle = CFG.brittleHands; log({ t: 'status', who: d.side, st: 'brittle' }); }
          } else if (a.kw.poison || a.kw.stagger || a.kw.brittle) log({ t: 'kw', who: d.side, kw: 'immune' });
          // はんげき
          if (d.kw.counter && !a.kw.ranged) {
            // はんげきも「1げき」：うける 側の もろい（+2）・はんげきする 側の ねらいうち（+2）が のる
            var craw = Math.round(d.st.atk * CFG.counterRatio) + (a.brittle > 0 ? CFG.brittlePlus : 0) + (d.kw.nerai && (a.poison > 0 || a.stagger || a.brittle > 0) ? CFG.neraiPlus : 0);
            var c = Math.max(1, craw - a.st.def);
            dmgTo(a, c, 'counter', d.side);
            if (a.waza.indexOf('gaman') >= 0 && a.gaman < 3) a.gaman++;
            log({ t: 'counter', who: d.side, to: a.side, dmg: c, hp: a.hp });
          }
        }
      }
      if (a.kw.leech && dealtSum > 0 && a.hp > 0) heal(a, Math.round(dealtSum * CFG.leechRatio), 'leech');
    }
    function turn(a, d) {
      a.hands++;
      log({ t: 'hand', who: a.side, n: a.hands });
      if (a.kw.regen) heal(a, CFG.regenHeal, 'regen');
      if (a.waza.indexOf('hitoiki') >= 0 && a.hands % 4 === 0) { log({ t: 'waza', who: a.side, w: 'hitoiki' }); heal(a, 3, 'hitoiki'); }
      var hits = 1;
      if (a.kw.ren) hits = (a.sp.claw3 && a.st.spd > d.st.spd) ? 3 : 2;
      var forceCrit1 = false, mult1 = 0;
      if (a.waza.indexOf('kokozo') >= 0 && !a.kokozoUsed && a.hp * 2 < a.maxHp) { a.kokozoUsed = true; forceCrit1 = true; log({ t: 'waza', who: a.side, w: 'kokozo' }); }
      if (a.luckyNext) { a.luckyNext = false; forceCrit1 = true; log({ t: 'waza', who: a.side, w: 'lucky' }); }
      if (a.waza.indexOf('oonaguri') >= 0 && a.hands % 4 === 0) { mult1 = 2; log({ t: 'waza', who: a.side, w: 'oonaguri' }); }
      if (forceCrit1) a.critPending = true;
      if (mult1) a.multPending = mult1;
      oneAttack(a, d, { hits: hits });
      var extra = 0;
      if (!dead() && a.sp.springExtra && a.hands % 3 === 0) { log({ t: 'kw', who: a.side, kw: 'springExtra' }); extra++; oneAttack(a, d, { hits: hits }); }
      if (!dead() && a.waza.indexOf('hayauchi') >= 0 && a.hands === 1) { log({ t: 'waza', who: a.side, w: 'hayauchi' }); oneAttack(a, d, { hits: hits }); }
      if (!dead() && a.waza.indexOf('renda') >= 0 && a.hands % 4 === 0) { log({ t: 'waza', who: a.side, w: 'renda' }); oneAttack(a, d, { hits: hits }); }
      // 手の おわり：どく・もろいが へる
      if (!dead() && a.poison > 0) { var pd = CFG.poisonDmg + a.poisonPow; dmgTo(a, pd, 'poison', d.side); log({ t: 'poison', who: a.side, dmg: pd, hp: a.hp }); a.poison--; if (!a.poison) a.poisonPow = 0; }
      if (a.brittle > 0) a.brittle--;
    }
    for (r = 1; r <= CFG.maxRounds && !dead(); r++) {
      turn(first, second); if (dead()) break;
      turn(second, first);
    }
    var win;
    if (E.hp <= 0 && P.hp > 0) win = true;
    else if (P.hp <= 0) win = false;
    else { timeout = true; win = (P.hp / P.maxHp) > (E.hp / E.maxHp); }
    log({ t: 'end', win: win, timeout: timeout });
    return { win: win, rounds: Math.min(r, CFG.maxRounds), events: ev, taken: taken, dodged: dodged, timeout: timeout,
      pHp: Math.max(0, P.hp), pMax: P.maxHp, eHp: Math.max(0, E.hp), eMax: E.maxHp, pSt: P.st, eSt: E.st };
  }

  // ---------- 負けの 理由（決定 28。戦いの ログから ルール側で 決める。{ id, text, hope, show } ） ----------
  // fix：理由が すすめる 向き（どの 枠に どんな パーツを 入れると よいか）。hope の 文と そろえる。
  //   loseReason は「その 向きに 1つ かえると ほんとうに 勝ちやすく なるか」を 戦わせて 確かめ、当たらない 理由は とばす（決定 28-2）。
  var STATUS_NAME = { poison: 'どく', charge: 'ためた こうげき', counter: 'はんげき', hit: 'ふつうの こうげき' };
  function hasKw(pid, kws) { return PART_BY_ID[pid].kw.some(function (k) { return kws.indexOf(k) >= 0; }); }
  var REASONS = [
    // もとの パーツでも 半分 以上 勝てる なら、ほかの 理由より 先に「うんが わるかった」（うんの 負け。確かめは baseRate そのもの）
    { id: 'close', when: function (c) { return c.baseRate != null && c.baseRate >= CFG.closeRate; },
      make: function () { return { kind: 'close', text: 'うんが わるかった！ おなじ パーツでも かてる あいてだよ', hope: 'もう一度 ためそう' }; } },
    { id: 'dodged', when: function (c) { return c.res.dodged.e >= 3; },
      fix: function () { return [{ role: 'atk', ok: function (p) { return hasKw(p, ['sure']); } }]; },
      make: function (c) { return { kind: 'weak', text: c.eName + 'に ' + c.res.dodged.e + 'かい よけられた', hope: 'よけられない ちからを さがそう', kw: 'yokeru' }; } },
    { id: 'taken', when: function (c) { var t = c.res.taken, tot = t.hit + t.charge + t.poison + t.counter; var k = bigSrc(t); return tot > 0 && k !== 'hit' && t[k] >= tot * 0.35; },
      fix: function (c) { var k = bigSrc(c.res.taken);
        if (k === 'poison') return [{ role: 'def', ok: function (p) { return hasKw(p, ['immune', 'regen']); } }];
        if (k === 'counter') return [{ role: 'mov', ok: function (p) { return hasKw(p, ['ranged']); } }];
        return [{ role: 'atk', ok: function () { return true; } }, { role: 'mov', ok: function () { return true; } }]; },
      make: function (c) { var k = bigSrc(c.res.taken); var hopes = { poison: 'どくに まけない まもりを ためそう', charge: 'ためる 手が くる まえに たおせる ちからを さがそう', counter: 'はんげきを うけない こうげきを さがそう' };
        return { kind: 'guard', text: STATUS_NAME[k] + 'で ' + c.res.taken[k] + ' けずられた', hope: hopes[k], src: k, kw: { counter: 'ranged', poison: 'immune' }[k] }; } },
    { id: 'hardRen', when: function (c) { return c.eSt.kw.hard && c.pSt.kw.ren; },
      fix: function () { return [{ role: 'atk', ok: function (p) { return !hasKw(p, ['ren']); } }]; },
      make: function (c) { return { kind: 'weak', text: 'かたい あいてに こまかい こうげきが ききにくかった', hope: 'ちがう せめの パーツも ためそう', kw: 'hard' }; } },
    // さいごの 受け皿（確かめない）
    { id: 'power', when: function () { return true; },
      make: function (c) { return { kind: 'power', text: 'いまの つよさでは まだ むずかしい あいてだった', hope: c.hard ? 'もう片方の 道や、ほかの パーツを ためそう' : 'パーツを かえて もう一度 ためそう' }; } }
  ];
  function bigSrc(t) { var best = 'hit'; ['charge', 'poison', 'counter'].forEach(function (k) { if ((t[k] || 0) > (t[best] || 0)) best = k; }); return best; }
  // 同じ 相手と CFG.reasonTries 回 戦った 勝率（理由の 確かめ用。ゲームの 乱数とは 別の 種）
  function tryRate(ctx, equip) {
    var w = 0, pSrc = playerSrc(ctx.run, equip);
    for (var i = 0; i < CFG.reasonTries; i++) if (battle(pSrc, ctx.eSrc, mix(5150 + i, ctx.stage * 13 + (ctx.hard ? 1 : 0)), { waza: ctx.waza }).win) w++;
    return w / CFG.reasonTries;
  }
  // 理由の 向きが 当たって いるか：{ hit, base, fix, ctrl }
  function checkFix(ctx, fixes, base) {
    var eq = ctx.equip, best = 0, remSet = {}, ctrl = [], n = 0;
    fixes.forEach(function (f) { PARTS.forEach(function (p) {
      if (p.role !== f.role || p.id === eq[f.role] || !f.ok(p.id)) return;
      remSet[f.role + ':' + p.id] = true; var e = { atk: eq.atk, def: eq.def, mov: eq.mov }; e[f.role] = p.id; best = Math.max(best, tryRate(ctx, e)); n++;
    }); });
    if (!n) return { hit: false, base: base, fix: base, ctrl: base };
    PARTS.forEach(function (p) {
      if (p.id === eq[p.role] || remSet[p.role + ':' + p.id]) return;
      var e = { atk: eq.atk, def: eq.def, mov: eq.mov }; e[p.role] = p.id; ctrl.push(tryRate(ctx, e));
    });
    var c = ctrl.length ? ctrl.reduce(function (a, b) { return a + b; }, 0) / ctrl.length : base;
    return { hit: best - base >= CFG.reasonGain - 1e-9 && best - c >= CFG.reasonOver - 1e-9, base: base, fix: best, ctrl: c };
  }
  // ctx：{ eName, hard, run, equip, eSrc, stage, waza }（run が ない とき＝確かめ なしで 上から 順に）
  function loseReason(res, ctx) {
    var c = { res: res, pSt: res.pSt, eSt: res.eSt, eName: ctx.eName, hard: ctx.hard, baseRate: null };
    var can = !!(ctx.run && ctx.eSrc);
    if (can) c.baseRate = tryRate(ctx, ctx.equip);
    for (var i = 0; i < REASONS.length; i++) {
      var R = REASONS[i];
      if (!R.when(c)) continue;
      var chk = null;
      if (R.fix && can) { chk = checkFix(ctx, R.fix(c), c.baseRate); if (!chk.hit) continue; }
      var o = R.make(c); o.id = R.id; if (chk) o.check = chk; else if (can) o.base = c.baseRate;
      return o;
    }
  }

  // ---------- 周回 ----------
  function newRun(seed, species) {
    var sp = SPECIES_BY_ID[species] || SPECIES[0];
    var rng = rngFrom(mix(seed, 777));
    var owned = ROLES.map(function (r) { var c = PARTS.filter(function (p) { return p.role === r.id; }); return c[Math.floor(rng() * c.length)].id; });
    var run = { v: 1, seed: seed >>> 0, species: sp.id, stats: JSON.parse(JSON.stringify(sp.base)), hearts: CFG.hearts, wins: 0,
      owned: owned, equip: { atk: owned[0], def: owned[1], mov: owned[2] }, tries: 0, lossStreak: 0, levels: [], history: [], over: false, clear: false };
    run.fork = makeFork(run);
    return run;
  }
  // 分かれ道：段階 s の 2つの 道（片方が てごわい）。ぬしの 段（10戦目）は 1つ。
  function makeFork(run) {
    var s = run.wins + 1;
    if (s >= CFG.runBattles) return { stage: s, roads: [{ idx: 'boss', hard: false }] };
    var rng = rngFrom(mix(run.seed, 1000 + s));
    var pair = shuffle(ENEMIES.map(function (e) { return e.index; }), rng).slice(0, 2);
    var hardSide = rng() < 0.5 ? 0 : 1;
    return { stage: s, roads: pair.map(function (idx, i) { return { idx: idx, hard: i === hardSide }; }) };
  }
  function rewardsFor(run, road) {
    // 相手の パーツで もって いない もの → 16種で もって いない もの。てごわいは 2つ。
    var rng = rngFrom(mix(run.seed, 5000 + run.wins * 7 + (road.hard ? 1 : 0)));
    var d = enemyDef(road.idx), out = [];
    var want = road.hard ? 2 : 1;
    shuffle(d.parts, rng).forEach(function (p) { if (out.length < want && run.owned.indexOf(p) < 0 && out.indexOf(p) < 0) out.push(p); });
    shuffle(PART_IDS, rng).forEach(function (p) { if (out.length < want && run.owned.indexOf(p) < 0 && out.indexOf(p) < 0) out.push(p); });
    return out;
  }
  function battleSeed(run, road) { return mix(mix(run.seed, 2000 + run.wins), run.tries * 31 + (road.hard ? 7 : 3) + (road.idx === 'boss' ? 99 : road.idx)); }
  // 1戦 戦って run を すすめる。返すもの：{ res, win, reward:[parts], level:{stat:+n}, reason, over, clear }
  function fight(run, roadIndex, equip) {
    var road = run.fork.roads[roadIndex];
    var s = run.fork.stage, d = enemyDef(road.idx);
    run.equip = { atk: equip.atk || null, def: equip.def || null, mov: equip.mov || null };
    var res = battle(playerSrc(run, run.equip), enemySrc(road.idx, s, road.hard), battleSeed(run, road), { waza: SPECIES_BY_ID[run.species].waza, eName: d.name });
    var out = { res: res, win: res.win, stage: s, road: road };
    run.history.push({ s: s, e: d.id, hard: road.hard, win: res.win, try: run.tries });
    if (res.win) {
      out.reward = rewardsFor(run, road);
      out.reward.forEach(function (p) { run.owned.push(p); });
      out.level = levelUp(run);
      run.wins++; run.tries = 0; run.lossStreak = 0;
      if (run.wins >= CFG.runBattles) { run.clear = true; run.over = true; out.clear = true; }
      else run.fork = makeFork(run);
    } else {
      run.hearts--; run.tries++; run.lossStreak++;
      out.reason = loseReason(res, { eName: d.name, hard: road.hard, run: run, equip: run.equip, eSrc: enemySrc(road.idx, s, road.hard), stage: s, waza: SPECIES_BY_ID[run.species].waza });
      if (run.hearts <= 0) { run.over = true; out.over = true; }
    }
    return out;
  }
  // レベルアップ（FE 式）：ステータスごとに 成長率の 確率で +1（たいりょくは +2）。1つも 上がらなければ いちばん 成長率の 高い ものを +1。
  function levelUp(run) {
    var sp = SPECIES_BY_ID[run.species], rng = rngFrom(mix(run.seed, 9000 + run.wins)), up = {}, any = false;
    STATS.forEach(function (s) { if (rng() < sp.grow[s.id]) { up[s.id] = s.id === 'hp' ? CFG.hpUp : 1; any = true; } });
    if (!any) { var best = STATS.slice().sort(function (a, b) { return sp.grow[b.id] - sp.grow[a.id]; })[0].id; up[best] = best === 'hp' ? CFG.hpUp : 1; }
    Object.keys(up).forEach(function (k) { run.stats[k] += up[k]; });
    run.levels.push(up);
    return up;
  }
  // ヒント（2回 続けて 負けたとき）：もちものの 組み合わせを 全部 ためして、いちばん 勝ちやすい 組を 返す
  function bestEquip(run, roadIndex, tries) {
    tries = tries || 12;
    var road = run.fork.roads[roadIndex], s = run.fork.stage;
    var byRole = {}; ROLES.forEach(function (r) { byRole[r.id] = [null].concat(run.owned.filter(function (p) { return PART_BY_ID[p].role === r.id; })); });
    var best = null, bestScore = -1, bestN = -1, eSrc = enemySrc(road.idx, s, road.hard), waza = SPECIES_BY_ID[run.species].waza;
    byRole.atk.forEach(function (a) { byRole.def.forEach(function (d) { byRole.mov.forEach(function (m) {
      var eq = { atk: a, def: d, mov: m }, w = 0, pSrc = playerSrc(run, eq);
      for (var i = 0; i < tries; i++) { var r = battle(pSrc, eSrc, mix(4242 + i, s), { waza: waza }); if (r.win) w += 1; else w += 0.001 * (1 - r.eHp / r.eMax); }
      // 同じ くらいなら パーツが 多い 組（「はずす」を むやみに すすめない）
      var n = (a ? 1 : 0) + (d ? 1 : 0) + (m ? 1 : 0);
      var fw = Math.floor(w), fb = Math.floor(bestScore);
      if (fw > fb || (fw === fb && (n > bestN || (n === bestN && w > bestScore)))) { bestScore = w; best = eq; bestN = n; }
    }); }); });
    return { equip: best, rate: Math.floor(bestScore) / tries };
  }

  return { CFG: CFG, KW: KW, KW_BY_ID: KW_BY_ID, ROLES: ROLES, ROLE_COLOR: ROLE_COLOR, STATS: STATS, PARTS: PARTS, PART_BY_ID: PART_BY_ID, PART_IDS: PART_IDS,
    WAZA: WAZA, WAZA_BY_ID: WAZA_BY_ID, SPECIES: SPECIES, SPECIES_BY_ID: SPECIES_BY_ID, ENEMIES: ENEMIES, BOSS: BOSS, ENEMY_BY_ID: ENEMY_BY_ID, enemyDef: enemyDef,
    rngFrom: rngFrom, mix: mix, statsOf: statsOf, enemyBase: enemyBase, enemySrc: enemySrc, playerSrc: playerSrc, equipList: equipList,
    battle: battle, loseReason: loseReason, REASONS: REASONS, newRun: newRun, makeFork: makeFork, rewardsFor: rewardsFor, fight: fight, levelUp: levelUp, bestEquip: bestEquip };
});
