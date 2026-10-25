// でこもん 版6 — ボット検証（Node で実行: node bot.js [周回数] [固定の周回数] [表の回数]）
'use strict';
var S = require('./sim.js');
// 調整用：DEKO_CFG='{"boss":{"hp":1.4}}' のように数値を上書きできる
if (process.env.DEKO_CFG) { var ov = JSON.parse(process.env.DEKO_CFG); Object.keys(ov).forEach(function (k) { if (typeof ov[k] === 'object' && S.CFG[k]) Object.assign(S.CFG[k], ov[k]); else S.CFG[k] = ov[k]; }); console.log('CFG override: ' + process.env.DEKO_CFG); }
var RUNS = parseInt(process.argv[2] || '2000', 10);
var FIXED_RUNS = parseInt(process.argv[3] || '100', 10);
var TABLE_TRIALS = parseInt(process.argv[4] || '200', 10);
var rng = S.makeRng(20261025);
var NB = S.CFG.runBattles;

function pct(x) { return (x * 100).toFixed(1) + '%'; }
function f1(x) { return x.toFixed(1); }
function f2(x) { return x.toFixed(2); }
function cname(c) { return c.length ? c.map(function (p) { return S.PART_BY_ID[p].name; }).join('＋') : '（なし）'; }
function comboKey(parts, lv2) {
  var ps = parts.slice().sort();
  var l2 = ps.filter(function (p) { return lv2.indexOf(p) >= 0; });
  return ps.join(',') + '|' + l2.join(',');
}
function comboName(key) {
  var sp = key.split('|'), ps = sp[0] ? sp[0].split(',') : [], l2 = sp[1] ? sp[1].split(',') : [];
  return ps.length ? ps.map(function (p) { return S.PART_BY_ID[p].name + (l2.indexOf(p) >= 0 ? '（Lv2 ' + S.PART_BY_ID[p].lv2name + '）' : ''); }).join('＋') : '（なし）';
}

// ---------- 周回を遊ぶ（画面と同じ手順：分かれ道 → 拾い物の決定 → 戦い → なれ → 拾い → そだち。10戦目は ぬし） ----------
function newStats() {
  var st = { runs: 0, clears: 0, reach5: 0, sumWins: 0, winsHist: [], battles: 0, timeouts: 0, hands: [],
    stage: [], use: {}, syn: {}, count: [0, 0, 0, 0], sparks: 0, sparkNare: 0, sparkChance: 0, sparkZero: 0, sparkByPart: {}, actByPart: {}, sparkHist: [],
    growDir: { tough: 0, strong: 0, quick: 0 }, growByStage: [], wins: 0, rewards: 0, rewardsFromEnemy: 0, lv2Used: {},
    forks: 0, hardChosen: 0, hardB: { n: 0, w: 0 }, normB: { n: 0, w: 0 }, boss: { n: 0, w: 0 }, maxHits: [], maxHitLabel: {}, combos: {} };
  for (var i = 0; i <= NB; i++) st.winsHist.push(0);
  for (var j = 0; j < NB; j++) { st.stage.push({ n: 0, w: 0 }); st.growByStage.push({ n: 0, tough: 0, strong: 0, quick: 0 }); }
  S.PART_IDS.forEach(function (p) { st.use[p] = 0; st.sparkByPart[p] = 0; st.actByPart[p] = 0; st.lv2Used[p] = 0; });
  S.SYNERGIES.forEach(function (s) { st.syn[s.id] = 0; });
  return st;
}
function playRun(chooser, stats, fixedParts) {
  var run = S.newRun(rng);
  var owned = fixedParts ? S.PART_IDS.slice() : S.startItems(rng);
  var wins = 0, lv2 = [], pity = 0, nare = {}, grow = S.emptyGrow(), acc = { received: 0, landed: 0, first: 0 }, sparksThisRun = 0;
  var synSeen = {};
  for (var b = 0; b < NB; b++) {
    var stage = b + 1;
    var paths = S.forkRewards(run, b, owned, rng); // 両方の道の「かてば もらえる」を先に決める（画面と同じ順で乱数を使う）
    var path;
    if (b < NB - 1) {
      var choice = chooser.fork(paths, owned, stage, grow, lv2, fixedParts);
      path = paths[choice];
      stats.forks++; if (path.hard) stats.hardChosen++;
    } else path = paths[0];
    var eIdx = path.enemy, fId = path.field, hard = !!path.hard;
    var enemy = S.enemyDefOf(eIdx);
    var rewards = fixedParts ? [] : path.rewards;
    var parts = fixedParts ? fixedParts : chooser.loadout(owned, eIdx, stage, fId, grow, lv2, hard);
    var res = S.runBattle(parts, eIdx, stage, fId, { rng: rng, grow: grow, lv2: lv2, hard: hard, spark: { stage: stage, pity: pity, nare: nare } });
    stats.battles++;
    stats.hands.push(res.nHands);
    stats.count[parts.length]++;
    parts.forEach(function (p) { stats.use[p]++; });
    if (res.timeout) stats.timeouts++;
    res.summary.synergies.forEach(function (s) { if (s.side === 'p') synSeen[s.id] = true; });
    Object.keys(res.summary.activations).forEach(function (p) { stats.actByPart[p] += res.summary.activations[p]; if (lv2.indexOf(p) < 0) nare[p] = (nare[p] || 0) + res.summary.activations[p]; });
    Object.keys(res.summary.lv2Used).forEach(function (p) { stats.lv2Used[p]++; });
    stats.maxHits.push(res.summary.maxHit.dmg);
    if (res.summary.maxHit.label) stats.maxHitLabel[res.summary.maxHit.label] = (stats.maxHitLabel[res.summary.maxHit.label] || 0) + 1;
    var ck = comboKey(parts, lv2);
    if (!stats.combos[ck]) stats.combos[ck] = { n: 0, w: 0, hit: 0 };
    stats.combos[ck].n++; stats.combos[ck].hit += res.summary.maxHit.dmg;
    // そだちの材料
    stats.growByStage[b].n++;
    acc.received += res.summary.received; acc.landed += res.summary.landed; acc.first += res.summary.firstHands;
    if (res.spark) { stats.sparks++; stats.sparkByPart[res.spark]++; sparksThisRun++; pity = 0; if (res.sparkBy === 'nare') stats.sparkNare++; else stats.sparkChance++; if (lv2.indexOf(res.spark) < 0) lv2.push(res.spark); }
    else pity++;
    stats.stage[b].n++;
    var won = res.winner === 'p';
    var bucket = enemy.boss ? stats.boss : (hard ? stats.hardB : stats.normB);
    bucket.n++; if (won) bucket.w++;
    if (won) { stats.stage[b].w++; wins++; stats.wins++; stats.combos[ck].w++; } else break;
    rewards.forEach(function (rw) { owned.push(rw); stats.rewards++; if (enemy.parts.indexOf(rw) >= 0) stats.rewardsFromEnemy++; });
    if (S.growAfterWin(wins)) {
      var dir = S.growDirection(acc).dir;
      grow[dir]++; stats.growDir[dir]++;
      for (var s2 = b + 1; s2 < NB; s2++) stats.growByStage[s2][dir]++; // この段階以降の戦いは この育ちを持って戦う
      acc = { received: 0, landed: 0, first: 0 };
    }
  }
  Object.keys(synSeen).forEach(function (id) { stats.syn[id]++; });
  stats.runs++;
  stats.winsHist[wins]++;
  if (wins === NB) stats.clears++;
  if (wins >= 5) stats.reach5++;
  stats.sumWins += wins;
  stats.sparkHist.push(sparksThisRun);
  if (sparksThisRun === 0) stats.sparkZero++;
}
function handsSummary(h) {
  var sorted = h.slice().sort(function (a, b) { return a - b; });
  var n = sorted.length;
  var mean = sorted.reduce(function (a, b) { return a + b; }, 0) / n;
  var within = sorted.filter(function (x) { return x >= 8 && x <= 14; }).length / n;
  var under = sorted.filter(function (x) { return x < 8; }).length / n;
  return { mean: mean, p10: sorted[Math.floor(n * 0.1)], p50: sorted[Math.floor(n * 0.5)], p90: sorted[Math.floor(n * 0.9)], within: within, under: under };
}
function growShare(st) {
  var tot = st.growDir.tough + st.growDir.strong + st.growDir.quick;
  return { tough: tot ? st.growDir.tough / tot : 0, strong: tot ? st.growDir.strong / tot : 0, quick: tot ? st.growDir.quick / tot : 0, total: tot };
}
function rate(b) { return b.n ? b.w / b.n : 0; }
function reportBot(name, st) {
  var hs = handsSummary(st.hands);
  console.log('### ' + name + '（周回 ' + st.runs + ' 回）');
  console.log('');
  console.log('| 10連勝率 | 5勝到達 | 平均連勝 | ' + st.winsHist.map(function (_, i) { return i + '勝'; }).join(' | ') + ' |');
  console.log('|' + new Array(st.winsHist.length + 4).join('---|'));
  console.log('| ' + pct(st.clears / st.runs) + ' | ' + pct(st.reach5 / st.runs) + ' | ' + f2(st.sumWins / st.runs) + ' | ' + st.winsHist.map(function (x) { return pct(x / st.runs); }).join(' | ') + ' |');
  console.log('');
  console.log('| 段階 | ' + st.stage.map(function (_, i) { return i + 1 + (i === NB - 1 ? '（ぬし）' : ''); }).join(' | ') + ' |');
  console.log('|' + new Array(st.stage.length + 2).join('---|'));
  console.log('| その戦いの勝率 | ' + st.stage.map(function (s) { return s.n ? pct(s.w / s.n) : '-'; }).join(' | ') + ' |');
  console.log('');
  console.log('分かれ道：てごわい側を選んだ ' + pct(st.forks ? st.hardChosen / st.forks : 0) + '。その戦いの勝率：てごわい側 ' + pct(rate(st.hardB)) + '（' + st.hardB.n + ' 戦）／ ふつう側 ' + pct(rate(st.normB)) + '（' + st.normB.n + ' 戦）。ぬし：勝率 ' + pct(rate(st.boss)) + '（' + st.boss.n + ' 戦）');
  console.log('手数：平均 ' + f1(hs.mean) + '、中央 ' + hs.p50 + '、10%点 ' + hs.p10 + '、90%点 ' + hs.p90 + '、8〜14手 ' + pct(hs.within) + '、8手未満 ' + pct(hs.under) + '、16手で判定 ' + pct(st.timeouts / st.battles));
  console.log('つけた個数：0個 ' + pct(st.count[0] / st.battles) + '、1個 ' + pct(st.count[1] / st.battles) + '、2個 ' + pct(st.count[2] / st.battles) + '、3個 ' + pct(st.count[3] / st.battles));
  var sh = st.sparkHist.slice().sort(function (a, b) { return a - b; });
  console.log('ひらめき：1周回あたり 平均 ' + f2(st.sparks / st.runs) + ' 回（なれ満タン ' + f2(st.sparkNare / st.runs) + '、確率 ' + f2(st.sparkChance / st.runs) + '。中央 ' + sh[Math.floor(sh.length / 2)] + '、最大 ' + sh[sh.length - 1] + '）、0回の周回 ' + pct(st.sparkZero / st.runs) + '、1戦あたり ' + pct(st.sparks / st.battles));
  var gs = growShare(st);
  console.log('そだちの方向：がんじょう ' + pct(gs.tough) + '、たくましい ' + pct(gs.strong) + '、すばやい ' + pct(gs.quick) + '（そだち ' + gs.total + ' 回、1周回あたり ' + f2(gs.total / st.runs) + '）');
  console.log('拾い：勝ち ' + st.wins + ' 回のうち 拾えた数 ' + f2(st.wins ? st.rewards / st.wins : 0) + ' 個／勝ち、そのうち 相手のパーツ ' + pct(st.rewards ? st.rewardsFromEnemy / st.rewards : 0));
  var mh = st.maxHits.slice().sort(function (a, b) { return a - b; });
  var buckets = [0, 0, 0, 0, 0, 0];
  mh.forEach(function (x) { buckets[x <= 20 ? 0 : x <= 40 ? 1 : x <= 60 ? 2 : x <= 80 ? 3 : x <= 100 ? 4 : 5]++; });
  var labels = Object.keys(st.maxHitLabel).sort(function (a, b) { return st.maxHitLabel[b] - st.maxHitLabel[a]; }).slice(0, 4).map(function (k) { return k + ' ' + pct(st.maxHitLabel[k] / st.battles); }).join('、');
  console.log('さいだいの いちげき（1戦ごと）：中央 ' + mh[Math.floor(mh.length / 2)] + '、90%点 ' + mh[Math.floor(mh.length * 0.9)] + '、最大 ' + mh[mh.length - 1] + '。〜20 ' + pct(buckets[0] / mh.length) + '、21〜40 ' + pct(buckets[1] / mh.length) + '、41〜60 ' + pct(buckets[2] / mh.length) + '、61〜80 ' + pct(buckets[3] / mh.length) + '、81〜100 ' + pct(buckets[4] / mh.length) + '、101〜 ' + pct(buckets[5] / mh.length) + '。何で出たか：' + labels);
  console.log('');
  return hs;
}

// ---------- ボット ----------
function scoreOf(parts, path, stage, grow, lv2) {
  var r = S.runBattle(parts, path.enemy, stage, path.field, { variance: 0, grow: grow, lv2: lv2, hard: path.hard });
  return (r.winner === 'p' ? 1 : 0) + 0.5 * (r.p.hp / r.p.maxHp - r.e.hp / r.e.maxHp);
}
// 合わせ：毎戦 その相手に最良の3つ。分かれ道は「勝ちやすい方」（もらえるものは見ない）
var matchedBot = {
  loadout: function (owned, eIdx, stage, fId, grow, lv2, hard) { return S.bestLoadout(owned, eIdx, stage, fId, grow, lv2, hard).parts; },
  fork: function (paths, owned, stage, grow, lv2) {
    var s0 = S.bestLoadout(owned, paths[0].enemy, stage, paths[0].field, grow, lv2, paths[0].hard).score;
    var s1 = S.bestLoadout(owned, paths[1].enemy, stage, paths[1].field, grow, lv2, paths[1].hard).score;
    return s1 > s0 ? 1 : 0;
  }
};
// ランダム：パーツも道も ランダム
var randomBot = {
  loadout: function (owned) { return S.randomLoadout(owned, rng); },
  fork: function () { return S.randInt(rng, 2); }
};
// てごわい：道は必ず てごわい側。パーツは 合わせと同じ
var hardBot = {
  loadout: matchedBot.loadout,
  fork: function (paths) { return paths[0].hard ? 0 : 1; }
};
// 固定：パーツは固定。道は その3つで 勝ちやすい方
var fixedBot = {
  loadout: null,
  fork: function (paths, owned, stage, grow, lv2, fixedParts) { return scoreOf(fixedParts, paths[1], stage, grow, lv2) > scoreOf(fixedParts, paths[0], stage, grow, lv2) ? 1 : 0; }
};

console.log('# でこもん 版6 ボット結果');
console.log('');
console.log('ぬし：たいりょく ×' + S.CFG.boss.hp + '、こうげき ×' + S.CFG.boss.atk + '（ふつうの相手の平均 ' + S.BOSS.hp + '・' + S.BOSS.atk + ' が基礎）。てごわい：たいりょく ×' + S.CFG.hard.hp + '、こうげき ×' + S.CFG.hard.atk);
console.log('');
var t0 = Date.now();
var stR = newStats();
for (var i = 0; i < RUNS; i++) playRun(randomBot, stR);
var hsR = reportBot('ランダムボット（場所の制約を守って 0〜3個ランダム。道もランダム）', stR);
var stM = newStats();
for (var j = 0; j < RUNS; j++) playRun(matchedBot, stM);
var hsM = reportBot('合わせボット（毎戦その相手に最良の3つ。道は勝ちやすい方。ひらめき狙いはしない）', stM);
var stH = newStats();
for (var j2 = 0; j2 < RUNS; j2++) playRun(hardBot, stH);
var hsH = reportBot('てごわいボット（道は必ず てごわい側。パーツは合わせと同じ）', stH);

console.log('### 合わせボットのパーツ使用率（その戦いで付けていた割合）とひらめき');
console.log('');
console.log('| パーツ | ' + S.PART_IDS.map(function (p) { return S.PART_BY_ID[p].name; }).join(' | ') + ' |');
console.log('|' + new Array(S.PART_IDS.length + 2).join('---|'));
var useRates = S.PART_IDS.map(function (p) { return stM.use[p] / stM.battles; });
console.log('| 使用率 | ' + useRates.map(pct).join(' | ') + ' |');
var sparkShare = S.PART_IDS.map(function (p) { return stM.sparks ? stM.sparkByPart[p] / stM.sparks : 0; });
console.log('| 全ひらめきに占める割合 | ' + sparkShare.map(pct).join(' | ') + ' |');
var sparkPerAct = S.PART_IDS.map(function (p) { return stM.actByPart[p] ? stM.sparkByPart[p] / stM.actByPart[p] : 0; });
console.log('| 発動1回あたりのひらめき率 | ' + sparkPerAct.map(pct).join(' | ') + ' |');
console.log('| 発動の回数（周回あたり） | ' + S.PART_IDS.map(function (p) { return f1(stM.actByPart[p] / stM.runs); }).join(' | ') + ' |');
console.log('| Lv2 の効果が出た戦い（周回あたり） | ' + S.PART_IDS.map(function (p) { return f2(stM.lv2Used[p] / stM.runs); }).join(' | ') + ' |');
console.log('');

console.log('### 噛み合いの発動率（合わせボットの周回のうち、自分の側で1回以上発動した割合）');
console.log('');
console.log('| 噛み合い | ' + S.SYNERGIES.map(function (s) { return s.id + ' ' + s.name; }).join(' | ') + ' |');
console.log('|' + new Array(S.SYNERGIES.length + 2).join('---|'));
var synRates = S.SYNERGIES.map(function (s) { return stM.syn[s.id] / stM.runs; });
console.log('| 発動率 | ' + synRates.map(pct).join(' | ') + ' |');
console.log('| ランダム | ' + S.SYNERGIES.map(function (s) { return pct(stR.syn[s.id] / stR.runs); }).join(' | ') + ' |');
console.log('');

// ---------- いちばん強かった 3つ＋Lv2 の組み合わせ（合わせボットの戦いから。30戦以上） ----------
console.log('### いちばん強かった 3つ＋Lv2 の組み合わせ 上位10（合わせボットの戦い。同じ組み合わせで 30 戦以上。勝率順）');
console.log('');
console.log('| 順 | 組み合わせ | 戦った数 | 勝率 | さいだいの いちげき（平均） |');
console.log('|---|---|---|---|---|');
var comboRows = Object.keys(stM.combos).map(function (k) { var c = stM.combos[k]; return { key: k, n: c.n, win: c.w / c.n, hit: c.hit / c.n }; }).filter(function (r) { return r.n >= 30; });
comboRows.sort(function (a, b) { return b.win - a.win || b.n - a.n; });
comboRows.slice(0, 10).forEach(function (r, i) { console.log('| ' + (i + 1) + ' | ' + comboName(r.key) + ' | ' + r.n + ' | ' + pct(r.win) + ' | ' + f1(r.hit) + ' |'); });
console.log('');

// ---------- Lv2 の効き：同じ相手に Lv1 と Lv2 で戦ったときの勝率の差 ----------
console.log('### Lv2 の効き（そのパーツを含む固定3つ 84通り × 相手10 × 場所4、段階5、育ちなし、乱れあり各 4 回。Lv1 と Lv2 の勝率の差）');
console.log('');
console.log('| パーツ | Lv2 の名前 | Lv1 勝率 | Lv2 勝率 | 差 | Lv2 の効果が出た割合 |');
console.log('|---|---|---|---|---|---|');
var triples = S.loadouts(S.PART_IDS).filter(function (c) { return c.length === 3; });
var lv2Delta = {};
S.PART_IDS.forEach(function (p) {
  var w1 = 0, w2 = 0, n = 0, used = 0;
  triples.filter(function (c) { return c.indexOf(p) >= 0; }).forEach(function (combo) {
    S.ENEMIES.forEach(function (e) {
      S.FIELDS.forEach(function (f) {
        for (var t = 0; t < 4; t++) {
          if (S.runBattle(combo, e.index, 5, f.id, { rng: rng }).winner === 'p') w1++;
          var r2 = S.runBattle(combo, e.index, 5, f.id, { rng: rng, lv2: [p] });
          if (r2.winner === 'p') w2++;
          if (r2.summary.lv2Used[p]) used++;
          n++;
        }
      });
    });
  });
  lv2Delta[p] = (w2 - w1) / n;
  console.log('| ' + S.PART_BY_ID[p].name + ' | ' + S.PART_BY_ID[p].lv2name + ' | ' + pct(w1 / n) + ' | ' + pct(w2 / n) + ' | ' + ((w2 - w1) / n * 100 >= 0 ? '+' : '') + ((w2 - w1) / n * 100).toFixed(1) + ' | ' + pct(used / n) + ' |');
});
console.log('');

// ---------- 固定の周回：16パーツ全部を持ち、3つ固定（448通り） ----------
var fixedRows = [];
triples.forEach(function (combo) {
  var st = newStats();
  for (var r = 0; r < FIXED_RUNS; r++) playRun(fixedBot, st, combo);
  var mh = st.maxHits.slice().sort(function (a, b) { return a - b; });
  fixedRows.push({ combo: combo, clear: st.clears / st.runs, reach5: st.reach5 / st.runs, avg: st.sumWins / st.runs, sparks: st.sparks / st.runs, boss: rate(st.boss), hit: mh[Math.floor(mh.length / 2)] });
});
fixedRows.sort(function (a, b) { return b.clear - a.clear || b.avg - a.avg; });
console.log('### 固定の周回（' + triples.length + ' 通り × 各 ' + FIXED_RUNS + ' 周回。同じ3つを使い続けるので なれ が たまりやすい。道は その3つで勝ちやすい方）');
console.log('');
console.log('| 順 | 組み合わせ | 10連勝率 | 5勝到達 | 平均連勝 | ひらめき/周回 | ぬし勝率 | さいだいの いちげき（中央） |');
console.log('|---|---|---|---|---|---|---|---|');
fixedRows.slice(0, 10).forEach(function (r, i) { console.log('| ' + (i + 1) + ' | ' + cname(r.combo) + ' | ' + pct(r.clear) + ' | ' + pct(r.reach5) + ' | ' + f2(r.avg) + ' | ' + f2(r.sparks) + ' | ' + pct(r.boss) + ' | ' + r.hit + ' |'); });
console.log('| … | | | | | | | |');
fixedRows.slice(-5).forEach(function (r, i) { console.log('| ' + (fixedRows.length - 4 + i) + ' | ' + cname(r.combo) + ' | ' + pct(r.clear) + ' | ' + pct(r.reach5) + ' | ' + f2(r.avg) + ' | ' + f2(r.sparks) + ' | ' + pct(r.boss) + ' | ' + r.hit + ' |'); });
console.log('');
var fixedBest = fixedRows[0];
console.log('固定の最高 ' + pct(fixedBest.clear) + '（' + cname(fixedBest.combo) + '）、全448通りの平均 ' + pct(fixedRows.reduce(function (a, r) { return a + r.clear; }, 0) / fixedRows.length));
console.log('');

// ---------- 相手×段階（1・5・10。育ちあり：合わせボットの その段階の平均的な育ち）＋ ぬし ----------
function meanGrowAt(stageIdx) {
  var g = stM.growByStage[stageIdx];
  return g.n ? { tough: g.tough / g.n, strong: g.strong / g.n, quick: g.quick / g.n } : S.emptyGrow();
}
console.log('### 相手×段階（16パーツ全部から その相手・場所に最良の3つ、乱れありで各 ' + TABLE_TRIALS + ' 回。場所4つの平均。育ちあり＝合わせボットの その段階の平均の育ち。Lv2なし。ぬしは段階10・ちょうじょう だけ）');
console.log('');
var growNote = [1, 5, 10].map(function (s) { var g = meanGrowAt(s - 1); return '段' + s + '：がんじょう ' + f2(g.tough) + '・たくましい ' + f2(g.strong) + '・すばやい ' + f2(g.quick); }).join('／');
console.log('育ちの平均（回数）：' + growNote);
console.log('');
console.log('| 相手 | 段1 | 段5 | 段10 | 段10で選ばれた組み合わせ（もり。ぬしは ちょうじょう） |');
console.log('|---|---|---|---|---|');
var tableMin10 = 1, tableMinName = '', bossTable = 0;
S.ENEMIES.concat([S.BOSS]).forEach(function (e) {
  var cells = [], best10 = null;
  [1, 5, 10].forEach(function (s) {
    if (e.boss && s !== 10) { cells.push(null); return; }
    var g = meanGrowAt(s - 1);
    var sum = 0;
    var fields = e.boss ? [S.SUMMIT] : S.FIELDS;
    fields.forEach(function (f) {
      var best = S.bestLoadout(S.PART_IDS, e.index, s, f.id, g, []);
      if (s === 10 && (f.id === 'plain' || e.boss)) best10 = best;
      var w = 0;
      for (var t = 0; t < TABLE_TRIALS; t++) { if (S.runBattle(best.parts, e.index, s, f.id, { rng: rng, grow: g }).winner === 'p') w++; }
      sum += w / TABLE_TRIALS;
    });
    var r = sum / fields.length;
    cells.push(r);
    if (e.boss) bossTable = r;
    else if (s === 10 && r < tableMin10) { tableMin10 = r; tableMinName = e.name; }
  });
  console.log('| ' + e.name + (e.boss ? '（段10・育ちあり）' : '') + ' | ' + cells.map(function (x) { return x === null ? '-' : pct(x) + (e.boss ? (x < 0.6 || x > 0.85 ? ' ⚠' : '') : (x < 0.6 ? ' ⚠' : '')); }).join(' | ') + ' | ' + cname(best10.parts) + ' |');
});
console.log('');

// ---------- 目標との比較 ----------
var ok = function (b) { return b ? '届いた' : '届かない'; };
var minUse = Math.min.apply(null, useRates), minUseName = S.PART_BY_ID[S.PART_IDS[useRates.indexOf(minUse)]].name;
var minSyn = Math.min.apply(null, synRates), minSynName = S.SYNERGIES[synRates.indexOf(minSyn)].name;
var minShare = Math.min.apply(null, sparkShare), maxShare = Math.max.apply(null, sparkShare);
var minShareName = S.PART_BY_ID[S.PART_IDS[sparkShare.indexOf(minShare)]].name, maxShareName = S.PART_BY_ID[S.PART_IDS[sparkShare.indexOf(maxShare)]].name;
var deltas = S.PART_IDS.map(function (p) { return lv2Delta[p]; });
var minDelta = Math.min.apply(null, deltas), maxDelta = Math.max.apply(null, deltas);
var minDeltaName = S.PART_BY_ID[S.PART_IDS[deltas.indexOf(minDelta)]].name, maxDeltaName = S.PART_BY_ID[S.PART_IDS[deltas.indexOf(maxDelta)]].name;
var handsOk = function (hs) { return hs.mean >= 8 && hs.mean <= 14 && hs.p50 >= 8 && hs.p50 <= 14 && hs.within >= 0.5; };
var mClear = stM.clears / stM.runs, hClear = stH.clears / stH.runs, sparksPerRun = stM.sparks / stM.runs, nareSparks = stM.sparkNare / stM.runs;
var gR = growShare(stR), gM = growShare(stM);
var gRmin = Math.min(gR.tough, gR.strong, gR.quick), gRmax = Math.max(gR.tough, gR.strong, gR.quick), gMmin = Math.min(gM.tough, gM.strong, gM.quick);
var hardRel = rate(stM.normB) ? rate(stM.hardB) / rate(stM.normB) : 0;
var mBoss = rate(stM.boss);
console.log('### 目標との比較');
console.log('');
console.log('| 目標 | 結果 | 判定 |');
console.log('|---|---|---|');
console.log('| 合わせの10連勝率 50〜70% | ' + pct(mClear) + ' | ' + ok(mClear >= 0.5 && mClear <= 0.7) + ' |');
console.log('| 合わせの5勝到達 85% 以上 | ' + pct(stM.reach5 / stM.runs) + ' | ' + ok(stM.reach5 / stM.runs >= 0.85) + ' |');
console.log('| ランダムの10連勝率 5% 以下 | ' + pct(stR.clears / stR.runs) + ' | ' + ok(stR.clears / stR.runs <= 0.05) + ' |');
console.log('| 固定の最高が 合わせの 75% 以下 | 固定の最高 ' + pct(fixedBest.clear) + ' ／ 合わせ ' + pct(mClear) + ' → ' + (mClear ? (fixedBest.clear / mClear * 100).toFixed(0) : '-') + '% | ' + ok(mClear > 0 && fixedBest.clear <= mClear * 0.75) + ' |');
console.log('| てごわい側の戦いの勝率が ふつう側の 70% 以上（合わせ） | てごわい ' + pct(rate(stM.hardB)) + ' ／ ふつう ' + pct(rate(stM.normB)) + ' → ' + (hardRel * 100).toFixed(0) + '% | ' + ok(hardRel >= 0.7) + ' |');
console.log('| てごわいボットの10連勝率が 合わせの 50〜90% | てごわい ' + pct(hClear) + ' ／ 合わせ ' + pct(mClear) + ' → ' + (mClear ? (hClear / mClear * 100).toFixed(0) : '-') + '% | ' + ok(mClear > 0 && hClear >= mClear * 0.5 && hClear <= mClear * 0.9) + ' |');
console.log('| 合わせの ぬし勝率 60〜85% | ' + pct(mBoss) + '（てごわい ' + pct(rate(stH.boss)) + '、ランダム ' + pct(rate(stR.boss)) + '） | ' + ok(mBoss >= 0.6 && mBoss <= 0.85) + ' |');
console.log('| 相手×段階（育ちあり）：どの相手も段階10で 60% 以上 | 最低 ' + pct(tableMin10) + '（' + tableMinName + '） | ' + ok(tableMin10 >= 0.6) + ' |');
console.log('| 相手×段階：ぬし（段階10・育ちあり）60〜85% | ' + pct(bossTable) + ' | ' + ok(bossTable >= 0.6 && bossTable <= 0.85) + ' |');
console.log('| パーツ使用率が 16種すべて 7% 以上 | 最低 ' + pct(minUse) + '（' + minUseName + '） | ' + ok(minUse >= 0.07) + ' |');
console.log('| 噛み合い8つが それぞれ 12% 以上 | 最低 ' + pct(minSyn) + '（' + minSynName + '） | ' + ok(minSyn >= 0.12) + ' |');
console.log('| ひらめき 1周回あたり 2〜4回 | ' + f2(sparksPerRun) + ' 回 | ' + ok(sparksPerRun >= 2 && sparksPerRun <= 4) + ' |');
console.log('| ひらめき 0回の周回 10% 以下 | ' + pct(stM.sparkZero / stM.runs) + ' | ' + ok(stM.sparkZero / stM.runs <= 0.10) + ' |');
console.log('| なれ満タンによるひらめき 1周回に 0.5〜1.5回（合わせ） | ' + f2(nareSparks) + ' 回 | ' + ok(nareSparks >= 0.5 && nareSparks <= 1.5) + ' |');
console.log('| Lv2 の効き：16種すべて +3 以上（上限なし） | 最低 ' + (minDelta * 100).toFixed(1) + '（' + minDeltaName + '）、最高 ' + (maxDelta * 100).toFixed(1) + '（' + maxDeltaName + '） | ' + ok(minDelta >= 0.03) + ' |');
console.log('| そだちの方向：ランダムで3方向が それぞれ 20〜50% | がんじょう ' + pct(gR.tough) + '・たくましい ' + pct(gR.strong) + '・すばやい ' + pct(gR.quick) + ' | ' + ok(gRmin >= 0.2 && gRmax <= 0.5) + ' |');
console.log('| そだちの方向：合わせでも3方向とも 10% 以上 | がんじょう ' + pct(gM.tough) + '・たくましい ' + pct(gM.strong) + '・すばやい ' + pct(gM.quick) + ' | ' + ok(gMmin >= 0.1) + ' |');
console.log('| 手数は 8〜14 が中心 | 合わせ：平均 ' + f1(hsM.mean) + '・中央 ' + hsM.p50 + '・範囲内 ' + pct(hsM.within) + ' ／ ランダム：平均 ' + f1(hsR.mean) + '・中央 ' + hsR.p50 + '・範囲内 ' + pct(hsR.within) + ' | ' + ok(handsOk(hsM) && handsOk(hsR)) + ' |');
console.log('（参考）16種それぞれの ひらめきの割合：最低 ' + pct(minShare) + '（' + minShareName + '）、最高 ' + pct(maxShare) + '（' + maxShareName + '）');
console.log('');
console.log('（計算時間 ' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒）');
