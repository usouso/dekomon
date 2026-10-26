// でこもん 試作版 — ぼくくんの 試遊の 記録（決定 12。ルールは 変えない）
// ブラウザ（index.html）と Node（tests.js・tools/kiroku.js）の 両方から 同じファイルを 読む。画面のコードは 入れない。
// しまう場所：ブラウザの中だけ（localStorage の 'next.dekomon.kiroku'）。外へは 送らない。?auto=1 では 記録しない（index.html 側で 止める）。
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DekoKiroku = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = 1;
  var MAX_RUNS = 50;

  function pad(n) { return ('0' + n).slice(-2); }
  // その端末の 時刻（ぼくくんの PC なら 日本時間）。例：2026-10-27 21:05 +09:00
  function stamp(d) {
    var off = -d.getTimezoneOffset(), sg = off >= 0 ? '+' : '-'; off = Math.abs(off);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' ' + sg + pad(Math.floor(off / 60)) + ':' + pad(off % 60);
  }
  function empty() { return { v: VERSION, runs: [] }; }
  function normalize(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.runs)) return empty();
    data.v = VERSION;
    data.runs = data.runs.filter(function (r) { return r && typeof r === 'object' && Array.isArray(r.battles); });
    data.runs.forEach(function (r) {
      r.battles = r.battles.filter(function (b) { return b && typeof b === 'object' && typeof b.no === 'number'; });
      if (!Array.isArray(r.sec)) r.sec = [];
      r.sec = r.sec.map(function (t) { return t && typeof t === 'object' ? t : {}; });
      if (r.end === undefined) r.end = null;
    });
    return data;
  }
  function runId(d) { return d.getTime().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36); }
  // 終わっていない 周回を「とちゅうで やめた」に する（いま 続けている id は のこす）
  function closeOpen(store, keepId, now) {
    store.runs.forEach(function (r) {
      if (!r.end && r.id !== keepId) r.end = { at: stamp(now), wins: r.battles.filter(function (b) { return b.win; }).length, abandoned: true };
    });
  }
  // 周回の 始め。info：{ ver, name, gen, egg:{parentName, part}|null, resumed, fromBattle }
  function newRun(store, info, now) {
    now = now || new Date();
    closeOpen(store, null, now);
    var r = { id: runId(now), start: stamp(now), ver: info.ver || '', kind: info.egg ? 'egg' : 'new', name: info.name || '', gen: info.gen || 1,
      parent: info.egg ? info.egg.parentName : null, inherit: info.egg ? info.egg.part : null, battles: [], sec: [], end: null };
    if (info.auto) r.auto = true; // 確かめ用の 自動（?auto=1&kiroku=1）
    if (info.resumed) { r.resumed = true; r.fromBattle = info.fromBattle || 1; }
    store.runs.push(r);
    while (store.runs.length > MAX_RUNS) store.runs.shift();
    return r;
  }
  function findRun(store, id) {
    if (!id) return null;
    for (var i = 0; i < store.runs.length; i++) if (store.runs[i].id === id) return store.runs[i];
    return null;
  }
  // その画面に いた 秒を 足す（battleIdx：0 = 1戦目）。0.1 秒の 単位
  function addTime(run, battleIdx, screen, sec) {
    if (!run || run.end || !(sec > 0) || battleIdx < 0) return;
    while (run.sec.length <= battleIdx) run.sec.push({});
    var t = run.sec[battleIdx];
    t[screen] = Math.round(((t[screen] || 0) + sec) * 10) / 10;
  }
  // 戦いの おわり。b：{ no, hard, enemy, field, other, parts, win, hands, timeout, spark, sparkBy, synergies:[{id,first}], waza, got }
  function addBattle(run, b) {
    if (!run || run.end) return;
    // 同じ 戦いを 2回 入れない（とちゅうセーブから やりなおした など）
    run.battles = run.battles.filter(function (x) { return x.no !== b.no; });
    run.battles.push(b);
    run.battles.sort(function (a, c) { return a.no - c.no; });
  }
  // 周回の おわり。e：{ wins, maxHit, lostTo, boss }
  function endRun(run, e, now) {
    if (!run || run.end) return;
    now = now || new Date();
    run.end = { at: stamp(now), wins: e.wins, maxHit: e.maxHit || null, lostTo: e.lostTo || null, boss: !!e.boss };
  }
  // 1戦の 噛み合い：同じものは 1つに まとめて 回数。first＝図鑑に まだ 無かった
  function synergyList(list, zukanBefore) {
    var out = [], at = {};
    (list || []).forEach(function (s) {
      if (s.side !== 'p') return;
      if (at[s.id] === undefined) { at[s.id] = out.length; out.push({ id: s.id, n: 0, first: (zukanBefore || []).indexOf(s.id) < 0 }); }
      out[at[s.id]].n++;
    });
    return out;
  }

  var SETSUMEI = {
    'これは': 'でこもん 試作版（next/）を ぼくくんが 遊んだ 記録。ブラウザの中に ためて、≡メニューの「きろくを ほぞん」で 書き出した もの。外へは 送っていない。',
    'jisho': 'id → 名前（parts＝パーツ、enemies＝相手、fields＝ばしょ、synergies＝噛み合い）',
    'runs': '周回（古い じゅん。最大 ' + MAX_RUNS + '）',
    'runs[].start': '始めた 時刻（その端末の 時刻）',
    'runs[].ver': '版（next ＋ ルールの数値 CFG の 指紋。数値が 変わると 指紋も 変わる）',
    'runs[].kind': 'new＝あたらしい なかま／egg＝たまごから（parent＝親の名前、inherit＝継いだ Lv2 の パーツ）',
    'runs[].name / gen': 'その子の 名前・○だいめ',
    'runs[].auto': '確かめ用の 自動プレイ（ぼくくんの 遊びでは ない）。ふつうは 無い',
    'runs[].resumed / fromBattle': 'とちゅうセーブから 記録を 始めた（記録が できる前の 周回）。fromBattle 戦目から',
    'runs[].battles[]': '戦いごと',
    'battles[].no': '何戦目（1〜10。10 は やまの ぬし）',
    'battles[].hard': 'てごわいを 選んだか',
    'battles[].enemy / field': '選んだ道の 相手・ばしょ',
    'battles[].other': 'もう片方の道 { enemy, field, hard }（10戦目は null）',
    'battles[].parts': 'つけた パーツ（最大 3）',
    'battles[].win / hands / timeout': '勝ったか・手数・16手で おわったか',
    'battles[].spark / sparkBy': 'ひらめいた パーツ（なければ null）・きっかけ（nare＝なれ満タン／chance＝運／parent＝おやの を おもいだした）',
    'battles[].synergies': '発動した 噛み合い [{ id, n＝回数, first＝初めて みつけた }]',
    'battles[].waza': 'モンスターの 技の 発動（決定 13 の あとで 入る。いまは なし）',
    'battles[].got': 'もらったもの [{ kind:part, part }｜{ kind:nare, part, amt }]（まけたら 空）',
    'battles[].sec': 'その戦いで 画面に いた 秒 { start＝周回の 始め・boss＝ぬしの 紹介（1戦目に つく）, fork＝わかれみち, summit＝ちょうじょう, pre＝バトル前（着せかえ）, battle＝戦い, win＝勝ち, grow＝そだち, zukan / dendo＝とちゅうで 見た }。画面を 開いたまま 離れた 時間も 入る（別の タブ・閉じている あいだ・タイトルに 出ている あいだは 入らない）。戦いの とちゅうで 出て やりなおすと battle は 2回分',
    'runs[].secMada': 'まだ 終わっていない 戦いの 秒 [{ no＝何戦目, sec }]（その 戦いの 前で やめた・とちゅうで 書き出した。どこで 迷ったか 見る）',
    'runs[].end': '周回の おわり { at, wins＝勝ち数, maxHit＝さいだいの いちげき {dmg,label}, lostTo＝負けた 相手, boss＝ぬしを 倒した, abandoned＝とちゅうで やめた }。null は まだ 続いている'
  };
  // 書き出す 形：先頭に 説明・辞書。sec は 戦いの 中へ 入れる
  function exportData(store, S, now) {
    now = now || new Date();
    var jisho = { parts: {}, enemies: {}, fields: {}, synergies: {} };
    if (S) {
      S.PARTS.forEach(function (p) { jisho.parts[p.id] = p.name; });
      Object.keys(S.ENEMY_BY_ID).forEach(function (k) { jisho.enemies[k] = S.ENEMY_BY_ID[k].name; });
      Object.keys(S.FIELD_BY_ID).forEach(function (k) { jisho.fields[k] = S.FIELD_BY_ID[k].name; });
      S.SYNERGIES.forEach(function (s) { jisho.synergies[s.id] = s.name; });
    }
    var runs = store.runs.map(function (r) {
      var o = JSON.parse(JSON.stringify(r));
      var done = {};
      o.battles.forEach(function (b) { b.sec = r.sec[b.no - 1] || {}; done[b.no] = true; });
      // まだ 終わっていない 戦い（その前で やめた・とちゅう）の 秒も 残す（Codex PR #7）
      o.secMada = [];
      r.sec.forEach(function (t, i) { if (!done[i + 1] && t && Object.keys(t).length) o.secMada.push({ no: i + 1, sec: t }); });
      delete o.sec;
      return o;
    });
    return { _setsumei: SETSUMEI, kakidashita: stamp(now), v: VERSION, jisho: jisho, runs: runs };
  }
  function fileName(now) { now = now || new Date(); return 'dekomon-kiroku-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + '.json'; }

  // 要約（tools/kiroku.js と tests で 使う）。返すのは 行の 配列
  function summarize(data) {
    var J = data.jisho || { parts: {}, enemies: {}, fields: {}, synergies: {} };
    var nm = function (tbl, id) { return (tbl && tbl[id]) || String(id); };
    var runs = data.runs || [];
    var lines = [];
    var allB = 0, allHard = 0, allForks = 0, partUse = {}, lost = {}, wins = [], firstSyn = 0, sparks = 0;
    lines.push('| # | 始めた | 名前 | 始め方 | 勝ち数 | てごわい | ひらめき | 新しい噛み合い | 負けた相手 |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    runs.forEach(function (r, i) {
      var forks = r.battles.filter(function (b) { return b.no < 10; });
      var hard = forks.filter(function (b) { return b.hard; }).length;
      var sp = r.battles.filter(function (b) { return b.spark; }).length;
      var fs = 0; r.battles.forEach(function (b) { (b.synergies || []).forEach(function (s) { if (s.first) fs++; }); });
      var w = r.end ? r.end.wins : r.battles.filter(function (b) { return b.win; }).length;
      var lostTo = r.end && r.end.lostTo ? nm(J.enemies, r.end.lostTo) : (r.end && r.end.boss ? '（ぬしを たおした）' : (r.end && r.end.abandoned ? '（とちゅうで やめた）' : (r.end ? '' : '（つづいている）')));
      lines.push('| ' + (i + 1) + ' | ' + r.start + ' | ' + r.name + ' | ' + (r.kind === 'egg' ? 'たまご（' + (r.parent || '') + '）' : 'あたらしい') + (r.resumed ? '・とちゅうから' : '') + (r.auto ? '・自動' : '') + ' | ' + w + ' | ' + hard + '/' + forks.length + ' | ' + sp + ' | ' + fs + ' | ' + lostTo + ' |');
      allB += r.battles.length; allHard += hard; allForks += forks.length; sparks += sp; firstSyn += fs;
      if (r.end && !r.end.abandoned) wins.push(w);
      if (r.end && r.end.lostTo) lost[r.end.lostTo] = (lost[r.end.lostTo] || 0) + 1;
      r.battles.forEach(function (b) { (b.parts || []).forEach(function (p) { partUse[p] = (partUse[p] || 0) + 1; }); });
    });
    lines.push('');
    lines.push('- 周回 ' + runs.length + '（おわった ' + wins.length + '）・戦い ' + allB);
    lines.push('- 勝ち数の 平均：' + (wins.length ? (Math.round(wins.reduce(function (a, b) { return a + b; }, 0) / wins.length * 10) / 10) : '—') + '　10連勝：' + wins.filter(function (w) { return w >= 10; }).length);
    lines.push('- てごわいを 選んだ 割合：' + (allForks ? Math.round(allHard / allForks * 100) + '%（' + allHard + '/' + allForks + '）' : '—'));
    lines.push('- ひらめき：' + sparks + '（1周回 ' + (runs.length ? Math.round(sparks / runs.length * 10) / 10 : '—') + '）・新しく みつけた 噛み合い：' + firstSyn);
    var top = Object.keys(partUse).sort(function (a, b) { return partUse[b] - partUse[a]; }).slice(0, 6);
    lines.push('- よく つけた パーツ：' + (top.length ? top.map(function (p) { return nm(J.parts, p) + ' ' + partUse[p]; }).join('、') : '—'));
    var lk = Object.keys(lost).sort(function (a, b) { return lost[b] - lost[a]; });
    lines.push('- 負けた 相手：' + (lk.length ? lk.map(function (e) { return nm(J.enemies, e) + ' ' + lost[e]; }).join('、') : '—'));
    return lines;
  }

  return { VERSION: VERSION, MAX_RUNS: MAX_RUNS, stamp: stamp, empty: empty, normalize: normalize, newRun: newRun, findRun: findRun, closeOpen: closeOpen,
    addTime: addTime, addBattle: addBattle, endRun: endRun, synergyList: synergyList, exportData: exportData, fileName: fileName, summarize: summarize };
});
