// たたみやま 版1 — 画面（表示と操作だけ。ルールは rules.js）
// 切り替え：?auto=1（自動で3日遊ぶ。必ず無音）&bg=1（タイマーで進める）&speed=10&mute=1&seed=N&reset=1
(function () {
  'use strict';
  var T = window.Tatami;
  var $ = function (id) { return document.getElementById(id); };
  var Q = {}; location.search.replace(/^\?/, '').split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); Q[decodeURIComponent(p[0])] = p.length > 1 ? decodeURIComponent(p[1]) : '1'; });
  var OPT = { auto: Q.auto === '1', bg: Q.bg === '1', speed: parseFloat(Q.speed || '1') || 1, mute: Q.mute === '1', seed: Q.seed ? parseInt(Q.seed, 10) : null, reset: Q.reset === '1', runs: parseInt(Q.runs || '1', 10) };
  if (OPT.auto) OPT.mute = true;
  if (OPT.reset) { try { localStorage.removeItem('tatami1.guide'); localStorage.removeItem('tatami1.vol'); } catch (e) { } }

  var KIND_COLOR = { tshirt: '#7fb3ff', socks: '#ffb27f', towel: '#8fd68f', jeans: '#4a6fb5', slick: '#d9c2ff', sheet: '#fff0b3' };
  var KIND_DARK = { tshirt: '#3d6fb8', socks: '#c2742f', towel: '#3f8f3f', jeans: '#243d6b', slick: '#8b6bc4', sheet: '#b89a2a' };
  // 形ごとの 高さ（山の中。単位は viewBox の 240分の）と 幅（88分の）
  var SHAPE = { flat: { h: 18, w: 66 }, tube: { h: 25, w: 60 }, pair: { h: 18, w: 60 }, ball: { h: 30, w: 34 }, thick: { h: 26, w: 56 }, long: { h: 19, w: 82 }, short: { h: 30, w: 44 }, shiny: { h: 18, w: 66 }, wide: { h: 15, w: 88 } };
  var VBH = 300; // 山の絵の viewBox の高さ
  var SHORT = { tshirt: 'Tシャツ', socks: 'くつした', towel: 'タオル', jeans: 'ジーンズ', slick: 'つるつる', sheet: 'シーツ' };
  var STATION_ART = {
    shikii: '<rect x="4" y="26" width="52" height="8" rx="2" fill="#b08a5a"/><rect x="4" y="24" width="52" height="3" fill="#d9b98a"/>',
    neko: '<ellipse cx="30" cy="30" rx="18" ry="9" fill="#555"/><circle cx="44" cy="22" r="8" fill="#555"/><path d="M38 16 l2 -7 l5 5z M47 15 l3 -6 l2 7z" fill="#555"/><path d="M12 30 q-8 -4 -4 -12" stroke="#555" stroke-width="3" fill="none"/><circle cx="42" cy="21" r="1.4" fill="#fff"/><circle cx="47" cy="21" r="1.4" fill="#fff"/>',
    kaidan: '<path d="M4 38 h14 v-9 h14 v-9 h14 v-9 h10 v27z" fill="#a9906f"/><path d="M4 38 h14 v-9 h14 v-9 h14 v-9 h10" stroke="#6e5a40" stroke-width="2" fill="none"/>',
    tansu: '<rect x="10" y="6" width="40" height="32" rx="3" fill="#c48a4a"/><rect x="13" y="9" width="34" height="12" rx="2" fill="#e0a86a"/><rect x="13" y="23" width="34" height="12" rx="2" fill="#e0a86a"/><circle cx="30" cy="15" r="1.8" fill="#5a3a1a"/><circle cx="30" cy="29" r="1.8" fill="#5a3a1a"/>'
  };

  // ---------- 状態 ----------
  var G = {
    screen: 'title', day: 0, carried: [], basket: [], stacks: [], sel: null, selFold: null, nextId: 1,
    rng: null, seed: 0, speedMul: 1, guideDone: false, dayLog: [], total: { delivered: 0, fallen: 0, stars: 0 }, fallRecs: [],
    carrying: null, lastChange: null,
    auto: { runs: 0, days: 0, mismatches: 0, overlaps: 0, overflow: 0, pageScroll: {}, falls: 0, changes: 0, plan: [], uiDays: [], seeds: [] }
  };
  try { G.guideDone = localStorage.getItem('tatami1.guide') === 'done'; } catch (e) { }
  if (OPT.auto) G.guideDone = false; // 自動でも 案内の文字を出して 重なりを検査する

  function setSpeed(m) { G.speedMul = m; document.documentElement.style.setProperty('--spd', String(m * OPT.speed)); try { localStorage.setItem('tatami1.speed', String(m)); } catch (e) { } var bs = $('speedSeg').querySelectorAll('button'); for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', parseFloat(bs[i].getAttribute('data-speed')) === m); }
  function D(ms) { return ms / (G.speedMul * OPT.speed); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, D(ms)); }); }

  // ---------- 音（WebAudio の短い効果音だけ） ----------
  var AC = null, master = null, volume = 0.3;
  try { var sv = localStorage.getItem('tatami1.vol'); if (sv !== null) volume = Math.max(0, Math.min(1, parseFloat(sv))); } catch (e) { }
  function audioInit() {
    if (AC || OPT.mute) return;
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = volume * 0.5; master.connect(AC.destination); } catch (e) { AC = null; }
  }
  function tone(freq, dur, type, gain, when, slide) {
    if (!AC || OPT.mute) return;
    if (AC.state === 'suspended') { try { AC.resume(); } catch (e) { } }
    var t = AC.currentTime + (when || 0);
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain || 0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, gain, when, lp) {
    if (!AC || OPT.mute) return;
    var t = AC.currentTime + (when || 0);
    var n = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = AC.createBufferSource(); s.buffer = buf;
    var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 900;
    var g = AC.createGain(); g.gain.value = gain || 0.3;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  var SFX = {
    click: function () { tone(880, 0.05, 'triangle', 0.15); },
    pat: function () { noise(0.09, 0.35, 0, 1400); tone(180, 0.09, 'sine', 0.25, 0.02, 90); },
    place: function () { tone(140, 0.12, 'sine', 0.3, 0, 70); noise(0.05, 0.15, 0, 600); },
    back: function () { tone(400, 0.08, 'triangle', 0.12, 0, 300); },
    good: function () { tone(660, 0.12, 'triangle', 0.25); tone(990, 0.18, 'triangle', 0.25, 0.1); tone(1320, 0.25, 'sine', 0.18, 0.2); },
    up: function () { tone(330, 0.12, 'square', 0.12); tone(262, 0.2, 'square', 0.12, 0.1); },
    shake: function (n) { noise(0.12 + 0.06 * n, 0.25 + 0.1 * n, 0, 500); tone(90, 0.2, 'sine', 0.2, 0, 60); },
    calm: function () { tone(1046, 0.08, 'sine', 0.12); tone(1318, 0.12, 'sine', 0.1, 0.08); },
    hot: function () { tone(220, 0.25, 'sawtooth', 0.1); tone(233, 0.25, 'sawtooth', 0.1); },
    fall: function () { tone(400, 0.45, 'sawtooth', 0.2, 0, 110); noise(0.3, 0.3, 0.3, 700); },
    deliver: function () { tone(523, 0.12, 'triangle', 0.2); tone(784, 0.25, 'triangle', 0.2, 0.12); },
    star: function () { tone(784, 0.1, 'sine', 0.2); tone(988, 0.1, 'sine', 0.2, 0.1); tone(1319, 0.3, 'sine', 0.2, 0.2); },
    success: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.22, i * 0.14); }); tone(1319, 0.6, 'sine', 0.2, 0.6); }
  };

  // ---------- 絵（SVG） ----------
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  // 1枚の絵。cx: 中心x、by: 下のy、w,h: 大きさ。fold: たたみ方（kind だけなら かごの中の まだ たたんでいない姿）
  function pieceSVG(kind, fold, cx, by, w, h, opts) {
    opts = opts || {};
    var c = KIND_COLOR[kind], d = KIND_DARK[kind];
    var x = cx - w / 2, y = by - h, s = '';
    var shape = fold ? T.FOLD_BY_ID[fold].shape : 'raw';
    var sw = opts.stroke || 1.5;
    switch (shape) {
      case 'raw': // たたむ前：くしゃっとした布
        s += '<path d="M' + x + ' ' + (y + h * 0.6) + ' q' + (w * 0.15) + ' -' + (h * 0.7) + ' ' + (w * 0.35) + ' -' + (h * 0.2) + ' q' + (w * 0.15) + ' ' + (h * 0.5) + ' ' + (w * 0.3) + ' -' + (h * 0.3) + ' q' + (w * 0.15) + ' -' + (h * 0.2) + ' ' + (w * 0.35) + ' ' + (h * 0.5) + ' l-' + (w * 0.05) + ' ' + (h * 0.4) + ' h-' + (w * 0.9) + 'z" fill="' + c + '" stroke="' + d + '" stroke-width="' + sw + '" stroke-linejoin="round"/>';
        break;
      case 'flat': // 平たい四角（えり）
        s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2.5" fill="' + c + '" stroke="' + d + '" stroke-width="' + sw + '"/>';
        s += '<path d="M' + (cx - w * 0.12) + ' ' + (y + 1) + ' q' + (w * 0.12) + ' ' + (h * 0.5) + ' ' + (w * 0.24) + ' 0" fill="none" stroke="' + d + '" stroke-width="' + sw + '"/>';
        break;
      case 'shiny': // ツヤの線
        s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2.5" fill="' + c + '" stroke="' + d + '" stroke-width="' + sw + '"/>';
        for (var k = 0; k < 3; k++) { var gx = x + w * (0.2 + k * 0.25); s += '<line x1="' + gx + '" y1="' + (y + h - 2) + '" x2="' + (gx + w * 0.1) + '" y2="' + (y + 2) + '" stroke="#fff" stroke-width="' + (sw * 1.4) + '" stroke-linecap="round" opacity=".9"/>'; }
        break;
      case 'tube': // 筒（うずまき）
        var r = h / 2;
        s += '<rect x="' + x + '" y="' + y + '" width="' + (w - r) + '" height="' + h + '" rx="' + (r * 0.9) + '" fill="' + c + '" stroke="' + d + '" stroke-width="' + sw + '"/>';
        s += '<ellipse cx="' + (x + w - r) + '" cy="' + (y + r) + '" rx="' + (r * 0.75) + '" ry="' + r + '" fill="' + c + '" stroke="' + d + '" stroke-width="' + sw + '"/>';
        s += '<path d="M' + (x + w - r) + ' ' + (y + r) + ' m-' + (r * 0.4) + ' 0 a' + (r * 0.4) + ' ' + (r * 0.55) + ' 0 1 1 ' + (r * 0.4) + ' ' + (r * 0.5) + '" fill="none" stroke="' + d + '" stroke-width="' + sw + '"/>';
        s += '<line x1="' + (x + 3) + '" y1="' + (y + h * 0.35) + '" x2="' + (x + w - r * 1.6) + '" y2="' + (y + h * 0.35) + '" stroke="#fff" stroke-width="' + sw + '" opacity=".6"/>';
        break;
      case 'pair': // 2足 ならべる
        for (var p = 0; p < 2; p++) { var px = x + p * (w / 2) + 2, pw = w / 2 - 4; s += '<path d="M' + px + ' ' + y + ' h' + (pw * 0.5) + ' v' + (h * 0.5) + ' h' + (pw * 0.5) + ' q' + (pw * 0.1) + ' 0 ' + (pw * 0.1) + ' ' + (h * 0.25) + ' v' + (h * 0.25) + ' h-' + (pw * 1.1) + 'z" fill="' + c + '" stroke="' + d + '" stroke-width="' + sw + '" stroke-linejoin="round"/>'; s += '<rect x="' + px + '" y="' + y + '" width="' + (pw * 0.5) + '" height="' + (h * 0.2) + '" fill="#fff" opacity=".7"/>'; }
        break;
      case 'ball': // 玉
        var br = Math.min(w, h) / 2;
        s += '<circle cx="' + cx + '" cy="' + (by - br) + '" r="' + br + '" fill="' + c + '" stroke="' + d + '" stroke-width="' + sw + '"/>';
        s += '<path d="M' + (cx - br * 0.9) + ' ' + (by - br * 1.2) + ' q' + br + ' ' + (br * 0.9) + ' ' + (br * 1.8) + ' -' + (br * 0.2) + '" fill="none" stroke="' + d + '" stroke-width="' + sw + '"/>';
        s += '<rect x="' + (cx - br * 0.5) + '" y="' + (by - br * 2 + 1) + '" width="' + (br * 0.8) + '" height="' + (br * 0.3) + '" rx="1" fill="#fff" opacity=".7"/>';
        break;
      case 'thick': // 厚い四角（層の線）
        s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="' + c + '" stroke="' + d + '" stroke-width="' + sw + '"/>';
        for (var q = 1; q <= 2; q++) s += '<line x1="' + (x + 2) + '" y1="' + (y + h * q / 3) + '" x2="' + (x + w - 2) + '" y2="' + (y + h * q / 3) + '" stroke="' + d + '" stroke-width="' + sw + '" opacity=".8"/>';
        break;
      case 'long': // 長い
        s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="' + c + '" stroke="' + d + '" stroke-width="' + sw + '"/>';
        s += '<line x1="' + cx + '" y1="' + (y + 2) + '" x2="' + cx + '" y2="' + (y + h - 2) + '" stroke="' + d + '" stroke-width="' + sw + '" opacity=".8"/>';
        s += '<line x1="' + (x + 3) + '" y1="' + (y + h - 3) + '" x2="' + (x + w - 3) + '" y2="' + (y + h - 3) + '" stroke="#e8c070" stroke-width="' + sw + '" stroke-dasharray="3 2"/>';
        break;
      case 'short': // 短くて厚い
        s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="' + c + '" stroke="' + d + '" stroke-width="' + sw + '"/>';
        for (var q2 = 1; q2 <= 2; q2++) s += '<line x1="' + (x + 2) + '" y1="' + (y + h * q2 / 3) + '" x2="' + (x + w - 2) + '" y2="' + (y + h * q2 / 3) + '" stroke="' + d + '" stroke-width="' + sw + '" opacity=".8"/>';
        s += '<line x1="' + (x + 3) + '" y1="' + (y + h - 3) + '" x2="' + (x + w - 3) + '" y2="' + (y + h - 3) + '" stroke="#e8c070" stroke-width="' + sw + '" stroke-dasharray="3 2"/>';
        break;
      case 'wide': // 幅が広い
        s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2" fill="' + c + '" stroke="' + d + '" stroke-width="' + sw + '"/>';
        s += '<line x1="' + (x + 2) + '" y1="' + (y + h / 2) + '" x2="' + (x + w - 2) + '" y2="' + (y + h / 2) + '" stroke="' + d + '" stroke-width="' + sw + '" opacity=".7"/>';
        break;
    }
    if (fold && T.FOLD_BY_ID[fold].dir && !opts.noDir) {
      var fs = opts.dirSize || 10;
      s += '<text x="' + (x + w - 1) + '" y="' + (y - 1) + '" text-anchor="end" font-size="' + fs + '" font-weight="700" fill="' + d + '" stroke="#fff" stroke-width="2" paint-order="stroke">' + T.FOLD_BY_ID[fold].dir + '</text>';
    }
    return s;
  }
  // かご・ボタン用の 小さな1枚（横長の箱に おさめる）
  function iconSVG(kind, fold, cls) {
    var sh = fold ? SHAPE[T.FOLD_BY_ID[fold].shape] : { h: 16, w: 60 };
    var H = 30, W = 100, scale = Math.min(1.1, 22 / sh.h, 90 / sh.w);
    var w = sh.w * scale, h = sh.h * scale;
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="' + (cls || '') + '" aria-hidden="true">' + pieceSVG(kind, fold, W / 2 - 2, H - 2, w, h, { dirSize: 12, stroke: 1.5 }) + '</svg>';
  }
  // 山の絵：items 下から上。layers に 各段の 中心y（240分の）を返す
  function stackSVG(items, calc, out, opts) {
    opts = opts || {};
    var sumH = 0; items.forEach(function (it) { sumH += SHAPE[T.FOLD_BY_ID[it.fold].shape].h; });
    var scale = Math.min(1, (VBH - 14) / Math.max(1, sumH));
    var y = VBH - 4, s = '', ys = [];
    items.forEach(function (it, i) {
      var F = T.FOLD_BY_ID[it.fold], sh = SHAPE[F.shape];
      var h = sh.h * scale, w = sh.w;
      var cls = 'layer' + (i === items.length - 1 ? ' fx-top' : '');
      s += '<g class="' + cls + '" data-i="' + i + '">' + pieceSVG(it.kind, it.fold, 46, y, w, h, { dirSize: 11 }) + '</g>';
      ys.push(y - h / 2);
      y -= h;
    });
    if (out) { out.ys = ys; out.hs = items.map(function (it) { return SHAPE[T.FOLD_BY_ID[it.fold].shape].h * scale; }); }
    return '<svg viewBox="0 0 150 ' + VBH + '" preserveAspectRatio="xMidYMax meet" aria-hidden="true">' + s + '</svg>';
  }
  // 山の各段の 数字を置く。box の中で SVG は 下寄せ・中央（xMidYMax meet）なので、同じ計算で px に直す。
  // 段が薄くて 数字が重なるなら 2列（ジグザグ）、それでも重なるなら 等間隔に並べる。
  var RO = window.ResizeObserver ? new ResizeObserver(function (entries) { entries.forEach(function (en) { var b = en.target; if (b.__nums && b.isConnected) { var W = b.clientWidth, H = b.clientHeight; if (b.__nums.W !== W || b.__nums.H !== H) { var old = b.querySelectorAll('.gnum'); for (var i = 0; i < old.length; i++) old[i].remove(); layoutNums(b, b.__nums.out, b.__nums.calc, b.__nums.opts); } } }); }) : null;
  function layoutNums(box, out, calc, opts) {
    opts = opts || {};
    box.__nums = { out: out, calc: calc, opts: opts, W: box.clientWidth, H: box.clientHeight };
    if (RO) RO.observe(box);
    var n = out.ys.length; if (!n) return;
    var W = box.clientWidth, H = box.clientHeight; if (!W || !H) return;
    var sc = Math.min(W / 150, H / VBH), offY = H - VBH * sc, offX = (W - 150 * sc) / 2;
    var els = [];
    for (var i = 0; i < n; i++) {
      var g = document.createElement('div');
      var r = calc.items[i];
      g.className = 'gnum' + (r.gura === 0 ? ' z' : '') + (opts.hot === i ? ' chg up' : '');
      g.textContent = r.gura; g.setAttribute('data-li', i);
      if (opts.onlyHot && opts.hot !== i) g.classList.add('hidden');
      box.appendChild(g); els.push(g);
    }
    var numH = els[0].offsetHeight || 20, numW = els[0].offsetWidth || 24;
    if (H < numH + 4) { els.forEach(function (e) { e.classList.add('hidden'); }); box.setAttribute('data-nummode', 'none'); box.__geom = { offX: offX, offY: offY, sc: sc, numH: numH }; return; }
    var minLayer = Math.min.apply(null, out.hs) * sc;
    var mode = minLayer >= numH + 1 ? 'one' : (minLayer * 2 >= numH + 1 && 28 * sc >= numW + 2 && offX + 132 * sc + numW / 2 <= W + 1 ? 'zig' : 'pitch');
    if (opts.onlyHot) mode = 'one';
    var show = {}; for (var q = 0; q < n; q++) show[q] = true;
    if (mode === 'pitch') {
      // 等間隔に 置けるだけ 置く。足りなければ ぐら0 の段は 小さな緑の丸にして、数字は 0でない段（と いちばん上）に使う
      var cap = Math.max(1, Math.floor((H - 4) / (numH + 1)));
      var idx = []; for (var q2 = 0; q2 < n; q2++) idx.push(q2);
      if (idx.length > cap) { idx = idx.filter(function (q3) { return calc.items[q3].gura > 0 || q3 === opts.hot || q3 === n - 1; }); }
      if (idx.length > cap) idx = idx.slice(idx.length - cap);
      show = {}; idx.forEach(function (q4) { show[q4] = true; });
      var pos = {}; idx.forEach(function (q5, r) { pos[q5] = H - 2 - numH / 2 - r * (numH + 1); });
    }
    for (var j = 0; j < n; j++) {
      var y = offY + out.ys[j] * sc, x = offX + 104 * sc;
      if (mode === 'zig' && (j % 2)) x = offX + 132 * sc;
      if (mode === 'pitch') {
        if (show[j]) y = pos[j];
        else if (calc.items[j].gura === 0) { els[j].classList.add('gdot'); els[j].textContent = ''; els[j].setAttribute('aria-label', '0'); }
        else els[j].classList.add('hidden');
      }
      y = Math.max(numH / 2 + 1, Math.min(H - numH / 2 - 1, y));
      els[j].style.left = x + 'px'; els[j].style.top = y + 'px';
    }
    box.setAttribute('data-nummode', mode);
    box.__geom = { offX: offX, offY: offY, sc: sc, numH: numH };
  }
  function personSVG() { return '<circle cx="60" cy="12" r="9" fill="#f3c9a4" stroke="#8a5a3a" stroke-width="1.5"/><path d="M44 54 v-18 q0 -10 16 -10 q16 0 16 10 v18z" fill="#6aa9d9" stroke="#2f5f8a" stroke-width="1.5"/><path d="M44 36 l-10 -4 M76 36 l10 -4" stroke="#f3c9a4" stroke-width="5" stroke-linecap="round"/>'; }
  function titleArt() {
    var items = [{ kind: 'jeans', fold: 'jeans_half' }, { kind: 'towel', fold: 'towel_quad' }, { kind: 'tshirt', fold: 'tshirt_square' }, { kind: 'socks', fold: 'socks_ball' }];
    var s = '', y = 154; items.forEach(function (it) { var sh = SHAPE[T.FOLD_BY_ID[it.fold].shape]; var h = sh.h * 1.5, w = sh.w * 1.8; s += pieceSVG(it.kind, it.fold, 110, y, w, h, { noDir: true, stroke: 2 }); y -= h; });
    return s;
  }

  // ---------- かご・たたみ方・山の描画 ----------
  function stackFolds(st) { return st.map(function (it) { return it.fold; }); }
  function tripsToday() { return T.DAYS[G.day].trips; }
  function setScreen(sc) { G.screen = sc; document.body.className = 'sc-' + sc; }
  function guide(id, on) { var e = $(id); e.classList.toggle('hidden', !(on && !G.guideDone)); }
  function renderHead() {
    $('dayLbl').textContent = (G.day + 1) + '日目／3';
    $('tripLbl').textContent = 'おうふく ' + tripsToday() + 'かい';
  }
  function renderBasket() {
    var b = $('basket'); b.innerHTML = '';
    $('basketCnt').textContent = G.basket.length ? 'のこり ' + G.basket.length + 'まい' : 'からっぽ';
    G.basket.forEach(function (it) {
      var e = document.createElement('div');
      e.className = 'bitem' + (G.sel === it.id ? ' sel' : '') + (it.fold ? ' folded' : '');
      e.setAttribute('data-id', it.id);
      e.innerHTML = iconSVG(it.kind, it.fold) + '<div class="nm">' + esc(SHORT[it.kind]) + '</div>' + (it.fold ? '<div class="fdg">' + T.FOLD_BY_ID[it.fold].gura + '</div>' : '');
      e.addEventListener('click', function () { onBasketClick(it.id); });
      b.appendChild(e);
    });
    var sel = selItem();
    guide('gSelect', G.screen === 'stack' && !sel && G.basket.length > 0);
  }
  function selItem() { for (var i = 0; i < G.basket.length; i++) if (G.basket[i].id === G.sel) return G.basket[i]; return null; }
  function renderFolds() {
    var box = $('folds'), it = selItem(); box.innerHTML = '';
    $('foldWho').textContent = it ? T.KIND_BY_ID[it.kind].name : '';
    if (!it) { $('foldHint').textContent = G.basket.length ? 'かごの 1まいを えらぶ' : ''; box.className = ''; guide('gFold', false); return; }
    var fs = T.foldsOf(it.kind);
    box.className = fs.length === 1 ? 'one' : '';
    fs.forEach(function (F) {
      var btn = document.createElement('button');
      btn.className = 'fbtn' + (G.selFold === F.id ? ' sel' : '');
      btn.setAttribute('data-fold', F.id);
      btn.innerHTML = iconSVG(it.kind, F.id) + '<div class="fn"><span>' + esc(F.name) + '</span><span class="g">ぐら ' + F.gura + '</span></div><div class="ft">' + (F.text ? esc(F.text) : 'こうか なし') + '</div>';
      btn.addEventListener('click', function () { onFoldClick(F.id); });
      box.appendChild(btn);
    });
    $('foldHint').textContent = G.selFold ? 'つむ やまを えらぶ（いちばん上に のる）' : 'たたみかたを えらぶ';
    guide('gFold', !G.selFold);
  }
  function judgeOf(total, acc) {
    var v = total + (acc || 0);
    if (v > T.CFG.capacity) return { cls: 'bad', text: 'おちる' };
    if (total <= T.CFG.safeLine && !acc) return { cls: '', text: 'かならず とどく' };
    if (total <= T.CFG.safeLine) return { cls: '', text: 'とどく' };
    return { cls: 'luck', text: 'うん しだい' };
  }
  function barHTML(total, acc, opts) {
    acc = acc || 0;
    var cells = '';
    for (var i = 0; i < 10; i++) {
      var cls = 'cell';
      if (i < total) cls += ' g' + (i >= T.CFG.safeLine ? ' luck' : '');
      else if (i < total + acc) cls += ' s';
      if (total + acc > 10 && i < 10) cls += ' over';
      cells += '<div class="' + cls + '"></div>';
    }
    var j = judgeOf(total, acc);
    var parts = [];
    if (acc) { parts.push('ぐら&nbsp;' + total); parts.push('＋ゆれ&nbsp;' + acc); parts.push('＝<span class="tot">' + (total + acc) + '</span>／10'); }
    else if (opts && opts.height) { parts.push('<span class="brk">ぐら&nbsp;' + (total - opts.height) + '</span>'); parts.push('<span class="brk">＋たかさ&nbsp;' + opts.height + '</span>'); parts.push('<span class="brk">＝</span><span class="tot">' + total + '</span>／10'); }
    else parts.push('<span class="lbl">ごうけい&nbsp;</span><span class="tot">' + total + '</span>／10');
    return '<div class="cells">' + cells + '<div class="line4"></div></div><div class="txt">' + parts.map(function (p) { return '<span>' + p + '</span>'; }).join('') + '<span class="judge ' + j.cls + '">' + j.text + '</span></div>';
  }
  function slotLabel(i, st) { var done = G.carrying && G.carrying.done.indexOf(i) >= 0; return 'やま' + (i + 1) + (done ? '　はこんだ' : (st.length ? '　' + st.length + 'まい' : '')); }
  function renderStacks(fx) {
    var box = $('stacks'); box.innerHTML = '';
    var canPlace = G.screen === 'stack' && !!selItem() && !!G.selFold;
    var pending = [];
    for (var i = 0; i < tripsToday(); i++) {
      (function (i) {
        var st = G.stacks[i] || (G.stacks[i] = []);
        var calc = T.stackCalc(stackFolds(st));
        var slot = document.createElement('div');
        slot.className = 'slot' + (canPlace ? ' can' : '') + (G.carrying && G.carrying.done.indexOf(i) >= 0 ? ' away' : '');
        slot.setAttribute('data-slot', i);
        var out = {};
        var html = '<div class="sname">' + slotLabel(i, st) + '</div><div class="stackbox">' + stackSVG(st, calc, out) + '</div><div class="bar">' + barHTML(calc.total, 0, { height: calc.height }) + '</div>';
        slot.innerHTML = html;
        var sb = slot.querySelector('.stackbox');
        slot.addEventListener('click', function (ev) { onSlotClick(i, ev); });
        box.appendChild(slot);
        pending.push({ sb: sb, out: out, calc: calc });
      })(i);
    }
    pending.forEach(function (p) { layoutNums(p.sb, p.out, p.calc); }); // 全部 並べてから（幅が決まってから）数字を置く
    var used = G.stacks.filter(function (s) { return s.length; }).length;
    $('stacksNote').textContent = used < tripsToday() ? '（つかわない おうふくは ☆）' : '';
    guide('gStack', canPlace);
    var canCarry = G.screen === 'stack' && G.basket.length === 0 && used > 0;
    $('carryBtn').disabled = !canCarry;
    $('carryNote').textContent = G.screen === 'stack' ? (G.basket.length ? 'かごを からに すると おせる' : (used < tripsToday() ? '☆' + (tripsToday() - used) + '（つかわない おうふく）' : '')) : '';
    guide('gCarry', canCarry);
    if (fx) showChanges(fx);
  }
  // 積んだとき 数字が変わった段に「3→0」を出し、効果を出した段と 受けた段を光らせる
  function showChanges(fx) {
    var slot = $('stacks').querySelector('.slot[data-slot="' + fx.slot + '"]'); if (!slot) return;
    var sb = slot.querySelector('.stackbox'); var layers = sb.querySelectorAll('.layer'); var nums = sb.querySelectorAll('.gnum');
    var anyDown = false, anyUp = false;
    fx.changes.forEach(function (ch) {
      var n = nums[ch.i]; if (!n) return;
      n.classList.add('chg'); if (ch.to > ch.from) n.classList.add('up');
      var pop = document.createElement('div'); pop.className = 'fx-chg' + (ch.to > ch.from ? ' up' : ''); pop.textContent = ch.from + '→' + ch.to;
      var gm = sb.__geom || { offX: 0, sc: 1 };
      pop.style.left = (gm.offX + 46 * gm.sc) + 'px'; pop.style.top = n.style.top; sb.appendChild(pop);
      if (layers[ch.i]) layers[ch.i].classList.add('fx-take');
      ch.givers.forEach(function (gi) { if (layers[gi]) layers[gi].classList.add('fx-give'); });
      if (ch.to < ch.from) anyDown = true; else anyUp = true;
      setTimeout(function () { pop.remove(); n.classList.remove('chg', 'up'); }, D(1600));
    });
    if (layers[fx.placed]) layers[fx.placed].classList.add('fx-pat');
    if (anyDown) SFX.good(); else if (anyUp) SFX.up();
    G.lastChange = fx; G.auto.changes += fx.changes.length;
  }

  // ---------- 操作 ----------
  function onBasketClick(id) {
    if (G.screen !== 'stack') return;
    audioInit(); SFX.click();
    if (G.sel === id) { G.sel = null; G.selFold = null; }
    else { G.sel = id; var it = selItem(); G.selFold = it.fold || null; }
    renderBasket(); renderFolds(); renderStacks();
  }
  function onFoldClick(foldId) {
    var it = selItem(); if (!it || G.screen !== 'stack') return;
    audioInit();
    G.selFold = foldId; it.fold = foldId;
    SFX.pat();
    renderBasket(); renderFolds(); renderStacks();
    var tile = $('basket').querySelector('.bitem[data-id="' + it.id + '"] svg'); if (tile) tile.classList.add('fx-pat');
  }
  function onSlotClick(i, ev) {
    if (G.screen !== 'stack') return;
    audioInit();
    var it = selItem();
    if (it && G.selFold) { placeItem(it, G.selFold, i); return; }
    // いちばん上を押すと かごに戻る
    var layer = ev && ev.target && ev.target.closest ? ev.target.closest('.layer') : null;
    var st = G.stacks[i];
    if (layer && st.length && parseInt(layer.getAttribute('data-i'), 10) === st.length - 1) { unplaceTop(i); return; }
    if (it && !G.selFold) { $('foldHint').textContent = 'さきに たたみかたを えらぶ'; var fb = $('foldBox'); fb.style.boxShadow = '0 0 0 3px #4a7fd6'; setTimeout(function () { fb.style.boxShadow = ''; }, 600); }
  }
  function placeItem(it, foldId, slotIdx) {
    var st = G.stacks[slotIdx];
    var before = T.stackCalc(stackFolds(st));
    G.basket = G.basket.filter(function (x) { return x.id !== it.id; });
    it.fold = foldId; st.push(it);
    var after = T.stackCalc(stackFolds(st));
    var li = st.length - 1;
    var changes = T.diffCalc(before, after).map(function (d) { return { i: d.i, from: d.from, to: d.to, givers: after.items[d.i].changes.filter(function (c) { return c.from === li; }).map(function (c) { return c.from; }) }; });
    var printed = T.FOLD_BY_ID[foldId].gura, r = after.items[li];
    if (r.gura !== printed) changes.push({ i: li, from: printed, to: r.gura, givers: r.condHit ? [] : r.changes.map(function (c) { return c.from; }) });
    G.sel = null; G.selFold = null;
    SFX.place();
    renderBasket(); renderFolds(); renderStacks({ slot: slotIdx, placed: li, changes: changes });
  }
  function unplaceTop(slotIdx) {
    var st = G.stacks[slotIdx]; if (!st.length) return;
    var before = T.stackCalc(stackFolds(st));
    var it = st.pop(); it.fold = null; G.basket.push(it);
    var after = T.stackCalc(stackFolds(st));
    var changes = T.diffCalc(before, after).map(function (d) { return { i: d.i, from: d.from, to: d.to, givers: [] }; });
    G.sel = null; G.selFold = null;
    SFX.back();
    renderBasket(); renderFolds(); renderStacks(changes.length ? { slot: slotIdx, placed: -1, changes: changes } : null);
  }

  // ---------- 運ぶ（ログを 時間どおりに 再生するだけ） ----------
  function renderStations(now) {
    var s = '';
    T.CFG.events.forEach(function (ev, i) { s += '<div class="st' + (now === i ? ' now' : '') + '"><svg viewBox="0 0 60 40">' + STATION_ART[ev.id] + '</svg><div class="sn">' + ev.name + '</div><div>ゆれ ' + ev.shake + '</div></div>'; });
    s += '<div class="st' + (now === 3 ? ' now' : '') + '"><svg viewBox="0 0 60 40">' + STATION_ART.tansu + '</svg><div class="sn">タンス</div><div>とどく</div></div>';
    $('stations').innerHTML = s;
  }
  var LEFT = ['0%', '20%', '40%', '60%']; // 運ぶ人の幅は 40%。はみ出さないように
  function renderCarrierStack(items, calc, hot) {
    var out = {}; var cs = $('carrierStack');
    cs.innerHTML = stackSVG(items, calc, out);
    layoutNums(cs, out, calc, { hot: hot, onlyHot: cs.clientHeight < 150 });
  }
  function tilt(total, acc) { var v = Math.min(1, (total + acc) / T.CFG.capacity); var deg = v * v * 26; $('carrierStack').style.transform = 'rotate(' + (acc % 2 ? -deg : deg) + 'deg)'; }
  function carryMsg(html) { $('carryMsg').innerHTML = html; }
  function itemName(fold) { var F = T.FOLD_BY_ID[fold]; return T.KIND_BY_ID[F.kind].name + '（' + F.name + '）'; }
  async function startCarry() {
    if (G.screen !== 'stack') return;
    audioInit(); SFX.click();
    setScreen('carry');
    if (!G.guideDone) { G.guideDone = true; try { localStorage.setItem('tatami1.guide', 'done'); } catch (e) { } }
    ['gSelect', 'gFold', 'gStack', 'gCarry'].forEach(function (id) { guide(id, false); });
    var used = G.stacks.filter(function (s) { return s.length; });
    var folds = used.map(stackFolds);
    var res = T.runDay(G.day, folds, G.rng); // 乱数は ここでだけ引く（山の順に 出来事×3）
    G.carrying = { res: res, done: [], delivered: 0 };
    var recs = [];
    $('carryBtn').disabled = true; $('carryNote').textContent = 'はこんでいる…';
    $('carryBar').classList.remove('hidden'); $('carrier').classList.remove('hidden');
    $('delivered').textContent = '';
    renderStacks();
    var stackIdx = []; G.stacks.forEach(function (s, i) { if (s.length) stackIdx.push(i); });
    for (var k = 0; k < used.length; k++) {
      var si = stackIdx[k], items = used[k].slice(), r = res.results[k];
      var calc = T.stackCalc(stackFolds(items));
      renderStations(-1);
      var car = $('carrier'); car.style.transition = 'none'; car.style.left = '-2%'; void car.offsetWidth; car.style.transition = '';
      renderCarrierStack(items, calc, -1); tilt(calc.total, 0);
      $('carryBar').innerHTML = barHTML(calc.total, 0);
      carryMsg('やま' + (si + 1) + 'を はこぶ（ぐら ' + calc.total + '）');
      await wait(700);
      for (var e = 0; e < r.log.length; e++) {
        var en = r.log[e];
        car.style.left = LEFT[e];
        await wait(1200);
        renderStations(e);
        var evDef = T.CFG.events[e];
        if (en.calm) { SFX.calm(); carryMsg(evDef.name + '：<span class="calm">' + evDef.calm + '（ゆれなし）</span>'); }
        else { SFX.shake(evDef.shake); carryMsg(evDef.name + '：<b>ゆれ +' + evDef.shake + '</b>'); }
        $('carryBar').innerHTML = barHTML(en.totalBefore, en.acc);
        tilt(en.totalBefore, en.acc);
        await wait(900);
        for (var d = 0; d < en.drops.length; d++) {
          var dr = en.drops[d];
          renderCarrierStack(dr.stack.map(function (f) { return { kind: T.FOLD_BY_ID[f].kind, fold: f }; }), dr.calc, dr.fromIndex);
          var ls = $('carrierStack').querySelectorAll('.layer');
          if (ls[dr.fromIndex]) ls[dr.fromIndex].classList.add('fx-hot');
          SFX.hot();
          carryMsg(evDef.name + '：ぐら ' + dr.total + '＋ゆれ ' + dr.acc + '＝' + (dr.total + dr.acc) + ' ＞ 10！<br>ぐらが いちばん 大きい <b>' + itemName(dr.fromFold) + '</b>から 上が おちる');
          await wait(800);
          SFX.fall();
          for (var li = dr.fromIndex; li < ls.length; li++) { ls[li].classList.add('fx-drop'); ls[li].style.animationDelay = ((li - dr.fromIndex) * 60 / (G.speedMul * OPT.speed)) + 'ms'; }
          var nums = $('carrierStack').querySelectorAll('.gnum'); for (var ni = dr.fromIndex; ni < nums.length; ni++) nums[ni].style.opacity = '0';
          recs.push({ day: G.day, event: evDef, fromFold: dr.fromFold, items: dr.items, stack: si, total: dr.total, acc: dr.acc });
          G.auto.falls += dr.items.length;
          await wait(900);
          var remain = dr.stack.slice(0, dr.fromIndex);
          var c2 = T.stackCalc(remain);
          renderCarrierStack(remain.map(function (f) { return { kind: T.FOLD_BY_ID[f].kind, fold: f }; }), c2, -1);
          $('carryBar').innerHTML = barHTML(c2.total, en.acc);
          tilt(c2.total, en.acc);
          carryMsg(evDef.name + '：' + dr.items.length + 'まい おちた（' + itemName(dr.fromFold) + 'から 上）。のこり ぐら ' + c2.total + '＋ゆれ ' + en.acc + '＝' + (c2.total + en.acc) + (remain.length ? '' : '。ぜんぶ おちた'));
          await wait(700);
        }
        if (!en.remain.length) break;
      }
      if (r.delivered.length) {
        car.style.left = LEFT[3];
        await wait(1200);
        renderStations(3);
        SFX.deliver();
        tilt(0, 0);
        carryMsg('タンスに とどいた：' + r.delivered.length + 'まい' + (r.fallen.length ? '（おちた ' + r.fallen.length + 'まい）' : ''));
      } else { carryMsg('ぜんぶ おちた…'); }
      G.carrying.delivered += r.delivered.length;
      G.carrying.done.push(si);
      $('delivered').textContent = 'きょう とどいた：' + G.carrying.delivered + 'まい';
      renderStacks();
      await wait(800);
    }
    $('carrier').classList.add('hidden'); $('carryBar').classList.add('hidden');
    renderStations(-1);
    endDay(res, recs);
  }

  // ---------- 夕方・次の日・おわり ----------
  function fallRecHTML(rec) {
    var shown = rec.items.slice(0, 6);
    var pics = shown.map(function (f) { return iconSVG(T.FOLD_BY_ID[f].kind, f); }).join('') + (rec.items.length > 6 ? '<span>＋' + (rec.items.length - 6) + '</span>' : '');
    return '<div class="fallrec"><svg viewBox="0 0 60 40">' + STATION_ART[rec.event.id] + '</svg><div class="txt">' + rec.event.name + 'で、やま' + (rec.stack + 1) + 'の <b>' + esc(itemName(rec.fromFold)) + '</b>から 上 ' + rec.items.length + 'まい（ぐら ' + rec.total + '＋ゆれ ' + rec.acc + '）</div><div class="picks">' + pics + '</div></div>';
  }
  function endDay(res, recs) {
    setScreen('evening');
    var used = G.stacks.filter(function (s) { return s.length; }).length;
    var stars = Math.max(0, tripsToday() - used);
    var dayRes = { day: G.day + 1, delivered: res.delivered.length, fallen: res.fallen.length, stars: stars, recs: recs, stacks: used };
    G.dayLog.push(dayRes);
    G.total.delivered += dayRes.delivered; G.total.fallen += dayRes.fallen; G.total.stars += stars;
    G.carried = res.fallen.map(function (f) { return T.FOLD_BY_ID[f].kind; });
    G.fallRecs = G.fallRecs.concat(recs);
    if (stars) SFX.star();
    if (G.day < 2) {
      $('evTitle').textContent = (G.day + 1) + '日目の ゆうがた';
      $('evLine').innerHTML = 'とどいた <b>' + dayRes.delivered + '</b>まい　おちた <b>' + dayRes.fallen + '</b>まい' + (dayRes.fallen ? '（あらいなおして あしたの かごへ）' : '');
      $('evStars').textContent = stars ? '☆' + stars + '（つかわなかった おうふく ' + stars + 'かい）' : '☆0（おうふくを ぜんぶ つかった）';
      $('falls').innerHTML = recs.length ? recs.map(fallRecHTML).join('') : '<div class="fallrec">おちなかった！</div>';
      $('evNote').textContent = 'あしたは ' + T.basketOf(G.day + 1, G.carried).length + 'まい・おうふく ' + T.DAYS[G.day + 1].trips + 'かい';
      $('evening').classList.remove('hidden'); $('stackUI').classList.add('hidden');
    } else {
      var left = G.carried.length;
      $('endBig').textContent = left === 0 ? 'せいこう！' : 'あと ' + left + 'まい';
      $('endBig').className = left === 0 ? 'ok' : '';
      $('endLine').innerHTML = '3日で とどいた <b>' + G.total.delivered + '</b>まい' + (left ? '　のこり <b>' + left + '</b>まい' : '　かごは からっぽ');
      $('endStars').textContent = '☆の ごうけい ' + G.total.stars + '（' + G.dayLog.map(function (d) { return '☆' + d.stars; }).join('・') + '）';
      $('endDays').innerHTML = G.dayLog.map(function (d) { return d.day + '日目：とどいた ' + d.delivered + '・おちた ' + d.fallen; }).join('<br>') + (recs.length ? '<div id="falls" style="margin-top:6px">' + recs.map(fallRecHTML).join('') + '</div>' : '');
      $('endSeed').textContent = 'たね ' + G.seed;
      $('end').classList.remove('hidden'); $('stackUI').classList.add('hidden');
      setScreen('end');
      if (left === 0) SFX.success();
    }
    $('carryNote').textContent = '';
  }
  function startDay(d) {
    G.day = d; G.basket = []; G.stacks = []; G.sel = null; G.selFold = null; G.carrying = null;
    T.basketOf(d, G.carried).forEach(function (kind) { G.basket.push({ id: G.nextId++, kind: kind, fold: null }); });
    setScreen('stack');
    $('evening').classList.add('hidden'); $('end').classList.add('hidden'); $('stackUI').classList.remove('hidden');
    renderHead(); renderBasket(); renderFolds(); renderStacks(); renderStations(-1);
    carryMsg(d === 0 ? 'つんだら「はこぶ」。はこぶのは みまもるだけ。' : 'きのう おちたのは かごに もどっている。');
    $('delivered').textContent = '';
  }
  function newRun(seed) {
    G.seed = seed; G.rng = T.makeRng(seed); G.carried = []; G.dayLog = []; G.total = { delivered: 0, fallen: 0, stars: 0 }; G.fallRecs = [];
    startDay(0);
  }
  $('nextBtn').addEventListener('click', function () { if (G.screen !== 'evening') return; SFX.click(); startDay(G.day + 1); });
  $('againBtn').addEventListener('click', function () { if (G.screen !== 'end') return; SFX.click(); newRun(OPT.seed !== null ? OPT.seed : ((Date.now() ^ (Math.random() * 1e9)) >>> 0)); });
  $('carryBtn').addEventListener('click', function () { startCarry(); });
  $('speedSeg').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return; setSpeed(parseFloat(b.getAttribute('data-speed'))); });
  $('vol').value = Math.round(volume * 100);
  $('vol').addEventListener('input', function () { volume = parseInt($('vol').value, 10) / 100; if (master) master.gain.value = volume * 0.5; try { localStorage.setItem('tatami1.vol', String(volume)); } catch (e) { } });
  $('vol').addEventListener('change', function () { audioInit(); SFX.click(); });
  $('startBtn').addEventListener('click', function () { audioInit(); SFX.click(); $('title').classList.add('hidden'); newRun(OPT.seed !== null ? OPT.seed : ((Date.now() ^ (Math.random() * 1e9)) >>> 0)); });
  $('titleArt').innerHTML = titleArt();
  $('carrier').querySelector('.person').innerHTML = personSVG();
  var sp0 = 1; try { sp0 = parseFloat(localStorage.getItem('tatami1.speed') || '1') || 1; } catch (e) { }
  setSpeed(sp0 === 2.5 ? 2.5 : 1);
  renderStations(-1);
  window.addEventListener('resize', function () { if (G.screen === 'stack' || G.screen === 'carry') renderStacks(); });

  // ---------- 検査：文字の重なり・はみ出し・ページのスクロール（?auto=1 のあいだ） ----------
  var seenOverlap = {};
  function textRects(e) { var rg = document.createRange(); rg.selectNodeContents(e); var rs = rg.getClientRects(), out = []; for (var i = 0; i < rs.length; i++) { var r = rs[i]; if (r.width <= 0 || r.height <= 0) continue; out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }); } return out; }
  function isect(a, b) { var r = { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) }; r.width = r.right - r.left; r.height = r.bottom - r.top; return (r.width > 0 && r.height > 0) ? r : null; }
  function clipRect(e, r) {
    var er = e.getBoundingClientRect();
    var out = isect(r, { left: er.left - 1, top: er.top - 1, right: er.right + 1, bottom: er.bottom + 1 });
    var p = e.parentElement;
    while (out && p && p !== document.body) { var cs = getComputedStyle(p); if (cs.overflow !== 'visible' || cs.overflowY !== 'visible' || cs.overflowX !== 'visible') out = isect(out, p.getBoundingClientRect()); p = p.parentElement; }
    return out;
  }
  function textElements() {
    var out = [], vw = window.innerWidth, vh = window.innerHeight;
    var root = $('title').classList.contains('hidden') ? $('app') : $('title');
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.closest('svg')) continue;
      var hasText = false;
      for (var k = 0; k < e.childNodes.length; k++) { var n = e.childNodes[k]; if (n.nodeType === 3 && n.textContent.trim()) { hasText = true; break; } }
      if (!hasText) continue;
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (!e.offsetParent && cs.position !== 'fixed') continue;
      if (parseFloat(cs.opacity) < 0.3) continue;
      var er = e.getBoundingClientRect();
      if (er.width <= 0 || er.height <= 0 || er.bottom < 0 || er.top > vh || er.right < 0 || er.left > vw) continue;
      var trs = textRects(e); if (!trs.length) trs = [er];
      var rects = []; trs.forEach(function (tr) { var c = clipRect(e, tr); if (c) rects.push(c); });
      if (!rects.length) continue;
      out.push({ el: e, rects: rects, er: er, text: e.textContent.trim().slice(0, 30), button: e.tagName === 'BUTTON' });
    }
    // 固定のボタン（はこぶ・つぎの日・↻・はやい）も相手に入れる：文字が その上に 入っていたら 重なり
    if (root === $('app')) [$('carryBtn'), $('nextBtn'), $('againBtn')].forEach(function (b) { if (!b || b.offsetParent === null) return; var r = b.getBoundingClientRect(); if (r.width <= 0) return; out.push({ el: b, rects: [r], er: r, text: 'ボタン ' + b.textContent.trim(), button: true, fixed: true }); });
    return out;
  }
  function checkOverlap() {
    var els = textElements();
    for (var i = 0; i < els.length; i++) {
      var a = els[i];
      if (a.fixed) continue;
      if (a.el.scrollWidth > a.el.clientWidth + 2 && a.el.clientWidth > 0 && getComputedStyle(a.el).overflow !== 'visible') report('はみ出し', a.text, '(箱 ' + a.el.clientWidth + 'px / 文字 ' + a.el.scrollWidth + 'px)', a.er, null, a.el);
      var par = a.el.parentElement;
      if (par && par !== document.body) { var pr = par.getBoundingClientRect(); if (pr.width > 0 && (a.er.right > pr.right + 3 || a.er.left < pr.left - 3 || a.er.bottom > pr.bottom + 3)) report('親の外', a.text, (par.id || par.className || par.tagName), a.er, pr, a.el, par); }
      var mr = 0, mb = 0; a.rects.forEach(function (r) { mr = Math.max(mr, r.right); mb = Math.max(mb, r.bottom); }); // overflow で切り取られた部分は数えない
      if (mr > window.innerWidth + 1 || mb > window.innerHeight + 1) report('画面の外', a.text, window.innerWidth + '×' + window.innerHeight, a.er, null, a.el);
      for (var j = 0; j < els.length; j++) {
        if (j === i) continue;
        var b = els[j];
        if (!b.fixed && j < i) continue;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (a.el.closest('#carrierStack') && b.el.closest('#carrierStack')) continue; // 傾いている山の中の数字どうしは、回転で箱が重なるだけ（配置は同じ）
        var hit = null;
        for (var x = 0; x < a.rects.length && !hit; x++) for (var y = 0; y < b.rects.length && !hit; y++) {
          var ra = a.rects[x], rb = b.rects[y];
          var ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ox > 3 && oy > 3) hit = [ra, rb];
        }
        if (hit) report('重なり', a.text, b.text, hit[0], hit[1], a.el, b.el);
      }
    }
  }
  function report(kind, t1, t2, ra, rb, ea, eb) {
    var key = G.screen + '|' + kind + '|' + t1 + '|' + t2;
    if (seenOverlap[key]) return;
    seenOverlap[key] = true;
    if (kind === 'はみ出し' || kind === '親の外' || kind === '画面の外') G.auto.overflow++; else G.auto.overlaps++;
    var R = function (r) { return r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null; };
    var path = function (e) { var out = []; while (e && e !== document.body && out.length < 4) { out.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : '')); e = e.parentElement; } return out.join(' < '); };
    console.error('[たたみやま 検査] ' + kind + '：' + G.screen + '：「' + t1 + '」｜「' + t2 + '」 ' + JSON.stringify(R(ra)) + ' ' + JSON.stringify(R(rb)));
    (window.__overlaps = window.__overlaps || []).push({ screen: G.screen, kind: kind, a: t1, b: t2, ra: R(ra), rb: R(rb), pa: ea ? path(ea) : '', pb: eb ? path(eb) : '', size: window.innerWidth + 'x' + window.innerHeight });
  }
  function checkScroll() {
    var de = document.documentElement;
    var sh = Math.max(de.scrollHeight, document.body.scrollHeight), sw = Math.max(de.scrollWidth, document.body.scrollWidth);
    if (sh > window.innerHeight + 1 || sw > window.innerWidth + 1) { var k = G.screen + ' ' + sw + 'x' + sh; G.auto.pageScroll[k] = (G.auto.pageScroll[k] || 0) + 1; }
    // 画面の下まで 使っているか（main の箱が 窓からはみ出していないか）
    var m = $('main').getBoundingClientRect(); if (m.bottom > window.innerHeight + 1) { var k2 = G.screen + ' main ' + Math.round(m.bottom) + '>' + window.innerHeight; G.auto.pageScroll[k2] = (G.auto.pageScroll[k2] || 0) + 1; }
  }

  // ---------- 自動プレイ（?auto=1）：画面を通して 3日遊び、最後に rules.js の計算と比べる ----------
  function autoPlan(dayIndex, kinds, rng) {
    // コツ2つ に ランダムを少し混ぜる：ふたつおり いちばん下・まるめる いちばん上、ほかは ランダムなたたみ方
    var trips = T.DAYS[dayIndex].trips, k = Math.max(1, Math.min(trips, Math.floor(rng() * trips) + 1));
    var pool = kinds.slice(); for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    var st = []; for (var s = 0; s < k; s++) st.push({ b: null, m: [], t: null });
    st.forEach(function (x) { var j = pool.indexOf('jeans'); if (j >= 0 && rng() < 0.8) { x.b = 'jeans_half'; pool.splice(j, 1); } });
    st.forEach(function (x) { var j = pool.indexOf('socks'); if (j >= 0 && rng() < 0.8) { x.t = 'socks_ball'; pool.splice(j, 1); } });
    pool.forEach(function (kind, i) { var fs = T.foldsOf(kind); st[i % k].m.push(fs[Math.floor(rng() * fs.length)].id); });
    return st.map(function (x) { var o = []; if (x.b) o.push(x.b); o = o.concat(x.m); if (x.t) o.push(x.t); return o; }).filter(function (o) { return o.length; });
  }
  async function autoRun() {
    var seedBase = OPT.seed !== null ? OPT.seed : 1;
    var click = function (el) { if (!el) throw new Error('auto: 押すものがない'); el.click(); };
    for (var run = 0; run < OPT.runs; run++) {
      var seed = seedBase + run;
      G.auto.plan = []; G.auto.uiDays = []; G.auto.seeds.push(seed);
      if (run === 0) { $('startBtn').click(); newRun(seed); } else { click($('againBtn')); newRun(seed); }
      var prng = T.makeRng(seed * 31 + 7);
      for (var d = 0; d < 3; d++) {
        var kinds = G.basket.map(function (it) { return it.kind; });
        var plan = autoPlan(d, kinds, prng);
        G.auto.plan.push(plan);
        for (var si = 0; si < plan.length; si++) {
          for (var li = 0; li < plan[si].length; li++) {
            var fold = plan[si][li], kind = T.FOLD_BY_ID[fold].kind;
            var it = null; for (var bi = 0; bi < G.basket.length; bi++) if (G.basket[bi].kind === kind) { it = G.basket[bi]; break; }
            click($('basket').querySelector('.bitem[data-id="' + it.id + '"]'));
            await wait(120);
            click($('folds').querySelector('.fbtn[data-fold="' + fold + '"]'));
            await wait(120);
            click($('stacks').querySelector('.slot[data-slot="' + si + '"]'));
            await wait(160);
          }
        }
        // 置き直しも 1回 試す（いちばん上を かごに戻して、もう一度 積む）
        if (d === 0 && plan[0].length) {
          var top = G.stacks[0][G.stacks[0].length - 1], topFold = top.fold;
          var layer = $('stacks').querySelector('.slot[data-slot="0"] .layer.fx-top'); if (layer) { layer.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(120); }
          var it2 = G.basket[G.basket.length - 1]; click($('basket').querySelector('.bitem[data-id="' + it2.id + '"]')); await wait(100);
          click($('folds').querySelector('.fbtn[data-fold="' + topFold + '"]')); await wait(100);
          click($('stacks').querySelector('.slot[data-slot="0"]')); await wait(100);
        }
        click($('carryBtn'));
        while (G.screen === 'carry') await wait(200);
        var dl = G.dayLog[G.dayLog.length - 1];
        G.auto.uiDays.push({ delivered: dl.delivered, fallen: dl.fallen, stars: dl.stars, text: (d < 2 ? $('evLine').textContent + ' ' + $('evStars').textContent : $('endLine').textContent + ' ' + $('endStars').textContent) });
        G.auto.days++;
        await wait(600);
        if (d < 2) click($('nextBtn'));
      }
      // 答え合わせ：同じ seed・同じ山で rules.js を 最初から回す
      var rng2 = T.makeRng(seed), carried = [], mism = [];
      for (var d2 = 0; d2 < 3; d2++) {
        var res = T.runDay(d2, G.auto.plan[d2], rng2);
        var ui = G.auto.uiDays[d2];
        var stars = T.DAYS[d2].trips - G.auto.plan[d2].length;
        if (res.delivered.length !== ui.delivered || res.fallen.length !== ui.fallen || stars !== ui.stars) mism.push('day' + (d2 + 1) + ' 画面 ' + JSON.stringify(ui) + ' 計算 ' + JSON.stringify({ delivered: res.delivered.length, fallen: res.fallen.length, stars: stars }));
        // 画面の文字（夕方・おわり）にも 同じ数が出ているか
        var txt = ui.text.replace(/\s/g, '');
        if (d2 < 2 && (txt.indexOf('とどいた' + res.delivered.length + 'まい') < 0 || txt.indexOf('おちた' + res.fallen.length + 'まい') < 0 || txt.indexOf('☆' + stars) < 0)) mism.push('day' + (d2 + 1) + ' 夕方の文字がずれた：' + ui.text);
        var endLeft = res.fallen.length;
        if (d2 === 2) { var totalStars = G.auto.uiDays.reduce(function (a, x) { return a + x.stars; }, 0); if (txt.indexOf('☆のごうけい' + totalStars) < 0 || ($('endBig').textContent !== (endLeft === 0 ? 'せいこう！' : 'あと ' + endLeft + 'まい'))) mism.push('おわりの文字がずれた：' + ui.text + ' / ' + $('endBig').textContent); }
        carried = res.fallen.map(function (f) { return T.FOLD_BY_ID[f].kind; });
        if (d2 < 2 && T.basketOf(d2 + 1, carried).length !== G.auto.plan[d2 + 1].reduce(function (a, s) { return a + s.length; }, 0)) mism.push('day' + (d2 + 2) + ' かごの枚数がずれた');
      }
      if (mism.length) { G.auto.mismatches += mism.length; console.error('[たたみやま] 画面と計算がずれた ' + mism.join(' / ')); }
      G.auto.runs++;
      console.log('[たたみやま auto] 周回 ' + G.auto.runs + '（seed ' + seed + '）、ずれ ' + G.auto.mismatches + '、おちた ' + G.auto.falls + '、数字の変化 ' + G.auto.changes + '、重なり ' + G.auto.overlaps + '、はみ出し ' + G.auto.overflow + '、ページスクロール ' + JSON.stringify(G.auto.pageScroll) + '、' + $('endBig').textContent + '、' + $('endStars').textContent);
      await wait(800);
    }
    G.auto.finished = true;
  }
  if (OPT.auto) {
    setInterval(function () { try { checkOverlap(); checkScroll(); } catch (e) { console.error('[たたみやま 検査] error ' + e.message); } }, 100);
    setTimeout(function () { autoRun().catch(function (e) { console.error('[たたみやま auto] error ' + (e && e.stack || e)); G.auto.error = String(e); }); }, 300);
  }

  // ---------- 外から使う（確認・スクリーンショット用） ----------
  window.__tatami = {
    G: G, T: T, OPT: OPT, SFX: SFX,
    start: function (seed) { $('title').classList.add('hidden'); newRun(seed || 1); },
    place: function (kind, fold, slot) { var it = null; for (var i = 0; i < G.basket.length; i++) if (G.basket[i].kind === kind) { it = G.basket[i]; break; } if (!it) return false; placeItem(it, fold, slot); return true; },
    select: function (kind) { for (var i = 0; i < G.basket.length; i++) if (G.basket[i].kind === kind) { onBasketClick(G.basket[i].id); return true; } return false; },
    fold: onFoldClick, carry: startCarry, unplace: unplaceTop, setSpeed: setSpeed, startDay: startDay,
    setDay: function (d, carried) { G.carried = carried || []; startDay(d); },
    showEvening: function (res, recs) { endDay(res, recs); },
    checkOverlap: function () { checkOverlap(); checkScroll(); return { overlaps: G.auto.overlaps, overflow: G.auto.overflow, pageScroll: G.auto.pageScroll, list: window.__overlaps || [] }; }
  };
})();
