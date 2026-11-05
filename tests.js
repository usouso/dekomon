// たたみやま 版1 — 札の文が文字どおりに動くかのテスト：node tests.js
// 例は 指示書 9. のとおり（下 > 上 の順）。
'use strict';
var T = require('./rules.js');
var fails = 0, count = 0;
function eq(name, got, want) {
  count++;
  var g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { console.log('ok   ' + name + ' → ' + g); }
  else { fails++; console.log('NG   ' + name + '\n       欲しい ' + w + '\n       出た   ' + g); }
}
function guras(stack) { var c = T.stackCalc(stack); return { g: c.items.map(function (r) { return r.gura; }), h: c.height, total: c.total }; }

// ---- ぐらの計算 ----
eq('タオルよつおり > ジーンズみつおり', guras(['towel_quad', 'jeans_third']), { g: [0, 0], h: 0, total: 0 });
eq('Tくるくる > くつしたまるめる > ジーンズみつおり', guras(['tshirt_roll', 'socks_ball', 'jeans_third']), { g: [0, 0, 4], h: 0, total: 4 });
eq('ジーンズふたつおり > タオルよつおり > ジーンズみつおり', guras(['jeans_half', 'towel_quad', 'jeans_third']), { g: [0, 0, 0], h: 0, total: 0 });
eq('シーツ > ジーンズみつおり > Tしかく > Tしかく > くつしたならべる', guras(['sheet_fold', 'jeans_third', 'tshirt_square', 'tshirt_square', 'socks_line']), { g: [0, 3, 0, 0, 0], h: 1, total: 4 });
eq('タオルよつおり > シーツ > Tしかく > くつしたならべる > くつしたまるめる', guras(['towel_quad', 'sheet_fold', 'tshirt_square', 'socks_line', 'socks_ball']), { g: [2, 0, 0, 0, 0], h: 1, total: 3 });
eq('Tしかく > くつしたならべる > タオルくるくる', guras(['tshirt_square', 'socks_line', 'towel_roll']), { g: [1, 0, 1], h: 0, total: 2 });
eq('つるつる > Tしかく > くつしたならべる', guras(['slick_fold', 'tshirt_square', 'socks_line']), { g: [0, 2, 2], h: 0, total: 4 });
eq('Tしかく > くつしたならべる > つるつる', guras(['tshirt_square', 'socks_line', 'slick_fold']), { g: [1, 1, 0], h: 0, total: 2 });
eq('つるつる > くつしたまるめる', guras(['slick_fold', 'socks_ball']), { g: [0, 1], h: 0, total: 1 });
eq('くつしたまるめる 1まいだけ', guras(['socks_ball']), { g: [0], h: 0, total: 0 });
eq('ジーンズふたつおり 1まいだけ', guras(['jeans_half']), { g: [0], h: 0, total: 0 });
var S9 = ['tshirt_square', 'tshirt_square', 'socks_line', 'socks_line', 'towel_roll', 'jeans_half'];
eq('Tしかく > Tしかく > ならべる > ならべる > タオルくるくる > ジーンズふたつおり', guras(S9), { g: [1, 1, 1, 0, 1, 3], h: 2, total: 9 });
var S6 = ['jeans_half', 'tshirt_square', 'tshirt_square', 'socks_line', 'socks_line', 'towel_roll'];
eq('ジーンズふたつおり > Tしかく > Tしかく > ならべる > ならべる > タオルくるくる', guras(S6), { g: [0, 1, 1, 1, 0, 1], h: 2, total: 6 });

// 言葉の意味の確かめ（指示書 3.）
eq('くるくるの +2 は すぐ上の1枚だけ（2つ上には届かない）', guras(['tshirt_roll', 'tshirt_square', 'tshirt_square']), { g: [0, 3, 1], h: 0, total: 4 });
eq('足し引きは 0より小さくならない（シーツ −1 を ぐら0 に）', guras(['sheet_fold', 'tshirt_roll']), { g: [5, 0], h: 0, total: 5 });
eq('「0になる」は 足し引きの結果に関係なく 0（よつおり > つるつる？ いや よつおり > しかく の上に くるくる+2）', guras(['tshirt_roll', 'towel_quad', 'tshirt_square']), { g: [0, 4, 0], h: 0, total: 4 });
eq('「いちばん上なら」は 手順1。そのあとの +1 は のる（つるつる > まるめる = 1）', guras(['slick_fold', 'socks_ball']), { g: [0, 1], h: 0, total: 1 });
eq('まるめる が 上でないと 3', guras(['socks_ball', 'tshirt_square']), { g: [3, 1], h: 0, total: 4 });
eq('ふたつおり が 下でないと 3', guras(['tshirt_square', 'jeans_half']), { g: [1, 3], h: 0, total: 4 });
eq('高さのぶん：4まいは 0、5まいは +1', [guras(['tshirt_square', 'tshirt_square', 'tshirt_square', 'tshirt_square']).h, guras(['tshirt_square', 'tshirt_square', 'tshirt_square', 'tshirt_square', 'tshirt_square']).h], [0, 1]);

// 変化の一覧（だれの効果で いくつ変わったか）
(function () {
  var c = T.stackCalc(['tshirt_roll', 'socks_ball', 'jeans_third']);
  eq('変化の一覧：まるめる は くるくる(+2) と みつおり(0になる) を受ける', c.items[1].changes, [{ from: 0, by: 'tshirt_roll', delta: 2 }, { from: 2, by: 'jeans_third', delta: 'zero' }]);
  eq('変化の一覧：手順2の結果（after）は 5、最後（gura）は 0', [c.items[1].after, c.items[1].gura], [5, 0]);
})();

// ---- 運ぶ ----
function carried(stack, flags) { var r = T.carryWith(stack, flags); return { delivered: r.delivered.length, fallen: r.fallen, where: r.log.filter(function (e) { return e.fell; }).map(function (e) { return e.name + ':' + e.drops.map(function (d) { return T.FOLD_BY_ID[d.fromFold].kind + '×' + d.items.length; }).join('+'); }) }; }
eq('合計9・ゆれが全部起きる：ねこでジーンズ、かいだんでタオル。4まい届く', carried(S9, [false, false, false]), { delivered: 4, fallen: ['jeans_half', 'towel_roll'], where: ['ねこ:jeans×1', 'かいだん:towel×1'] });
eq('合計9・ねこだけ ゆれなし：かいだんでジーンズ。5まい届く', carried(S9, [false, true, false]), { delivered: 5, fallen: ['jeans_half'], where: ['かいだん:jeans×1'] });
eq('合計9・全部 ゆれなし：6まい届く', carried(S9, [true, true, true]), { delivered: 6, fallen: [], where: [] });
var S4 = ['tshirt_square', 'socks_ball', 'tshirt_square', 'tshirt_square'];
eq('Tしかく > まるめる > Tしかく > Tしかく = 1,3,1,1（合計6）', guras(S4), { g: [1, 3, 1, 1], h: 0, total: 6 });
eq('合計6・ゆれが全部起きる：かいだんで まるめた くつしたから上の3まい。1まい届く', carried(S4, [false, false, false]), { delivered: 1, fallen: ['socks_ball', 'tshirt_square', 'tshirt_square'], where: ['かいだん:socks×3'] });
eq('合計6・ねこだけ ゆれなし：4まい届く', carried(S4, [false, true, false]), { delivered: 4, fallen: [], where: [] });
// 同じ数なら 上の方が落ちる／全部 0 なら いちばん上
eq('同じ数なら 上の方（1,1,1,1,1 +1 = 6。ゆれ6 で いちばん上の1枚）', carried(['tshirt_square', 'tshirt_square', 'tshirt_square', 'tshirt_square', 'tshirt_square'], [false, false, false]).fallen.length, 1);
eq('合計4以下なら かならず届く（ゆれ6 でも）', carried(['sheet_fold', 'jeans_third', 'tshirt_square', 'tshirt_square', 'socks_line'], [false, false, false]).delivered, 5);
(function () {
  // 全部 0 で 高さのぶんだけで超える：ジーンズふたつおり > よつおり > みつおり > よつおり > みつおり > よつおり > みつおり … 作りにくいので 7枚の 0 を作る
  var z = ['jeans_half', 'towel_quad', 'jeans_third', 'towel_quad', 'jeans_third', 'towel_quad', 'jeans_third', 'towel_quad', 'jeans_third', 'towel_quad', 'jeans_third'];
  var c = T.stackCalc(z);
  // しきい(1)：13+1 → 上の みつおり が落ちる → 上の よつおり は 0にされなくなり 2。合計 2+6=8。ねこ(3)：8+3=11 → よつおり(2)が落ちる → 全部0 +5 = 5。かいだん(6)：5+6=11 → 上の1枚 → 6+6=12 → もう1枚 → 3+6=9 OK
  eq('全部 0 の 11枚（高さ+7）：高さだけで超える時は いちばん上の1枚ずつ 落ちる（4枚）', [c.sum, c.height, carried(z, [false, false, false]).fallen], [0, 7, ['jeans_third', 'towel_quad', 'jeans_third', 'towel_quad']]);
})();
// 落ちたあと 計算し直して まだ超えていたら また落ちる（1回の出来事で 2回）
(function () {
  // Tくるくる > Tしかく(3) > Tくるくる > Tしかく(3) > Tくるくる > Tしかく(3) → 0,3,0,3,0,3 +2 = 11。しきい(1)で 12 > 10：上の Tしかく(3)が落ちる → 0,3,0,3,0 +1 = 7、+1 = 8 OK。
  var s = ['tshirt_roll', 'tshirt_square', 'tshirt_roll', 'tshirt_square', 'tshirt_roll', 'tshirt_square'];
  var r = T.carryWith(s, [false, false, false]);
  // かいだん(6)：7+6=13 → ぐら3 は 2枚（同じ数なら 上の方＝4段目）→ 4段目から上の 2枚が 1回で落ちる → 0,3,0 = 3、3+6=9 OK
  eq('合計11：しきいで 上の1枚、ねこは 7+3=10 で届く、かいだんで 4段目から上の2枚', r.log.map(function (e) { return e.name + ' ' + e.totalBefore + '+' + e.acc + (e.fell ? ' 落' + e.drops.map(function (d) { return d.items.length; }).join('/') : ''); }), ['しきい 11+1 落1', 'ねこ 7+3', 'かいだん 7+6 落2']);
})();
// 期待（8通り）
(function () {
  var e = T.carryExpect(S9);
  // ゆれ: 全部(0.343)→2枚、ねこだけなし(0.147)→1枚、しきいだけなし(0.147): 9+5=14→ジーンズ、残5+5=10 OK→1枚、かいだんだけなし(0.147): 9+3→ジーンズ落ち 5+3 OK →1枚
  // しきい・ねこなし(0.063): 9+3=12→1枚、しきい・かいだんなし(0.063): 9+2=11→1枚、ねこ・かいだんなし(0.063): 9+1 OK→0、全部なし(0.027)→0
  var want = 0.343 * 2 + 0.147 * 3 + 0.063 * 2;
  eq('落ちる枚数の期待（合計9の山）', Math.round(e.expected * 1000) / 1000, Math.round(want * 1000) / 1000);
  eq('合計4以下の山の期待は 0、かならず届く', T.carryExpect(['towel_quad', 'jeans_third']).pSafe, 1);
})();
// 乱数の順番：seed が同じなら 同じ結果
(function () {
  var a = T.runDay(0, [S9], T.makeRng(7)), b = T.runDay(0, [S9], T.makeRng(7));
  eq('同じ seed なら 同じ結果', a.delivered.length, b.delivered.length);
  eq('かごの中身と 山の中身が合う', T.sameItems(T.basketOf(0), [S9]), true);
})();
// 1日の計算：☆は 使わなかった往復、落ちた分は あしたのかごへ（たたみ方は ほどける）
(function () {
  var day = T.runDay(0, [S9], T.makeRng(3)); // 1日目 往復2・山1つ
  eq('1日目に 山1つなら ☆1', day.stars, 1);
  var carried = day.fallen.map(function (f) { return T.FOLD_BY_ID[f].kind; });
  eq('あしたのかご＝2日目の9まい＋きのう落ちた分（種類だけ。たたみ方は ほどける）', T.basketOf(1, carried).length, 9 + day.fallen.length);
  eq('2日目に 山2つなら ☆0', T.runDay(1, [['tshirt_square'], ['socks_line']], T.makeRng(3)).stars, 0);
  eq('3日目は 往復4：山2つなら ☆2', T.runDay(2, [['tshirt_square'], ['socks_line']], T.makeRng(3)).stars, 2);
  eq('合計4以下の山は どんな運でも 全部とどく', T.runDay(0, [['towel_quad', 'jeans_third']], T.makeRng(1)).delivered.length, 2);
})();

// 画面が使う 補助：積む前後の差（「3→0」の元）と、かごと山の中身の照合
(function () {
  var before = T.stackCalc(['towel_quad']), after = T.stackCalc(['towel_quad', 'jeans_third']);
  eq('diffCalc：よつおりの上に みつおり → 1段目が 2→0', T.diffCalc(before, after), [{ i: 0, from: 2, to: 0 }]);
  eq('diffCalc：変わらなければ 空', T.diffCalc(T.stackCalc(['tshirt_square']), T.stackCalc(['tshirt_square', 'socks_line'])), []);
  eq('sameItems：種類と枚数が合わないと false', T.sameItems(['tshirt', 'socks'], [['tshirt_square', 'tshirt_square']]), false);
  eq('fallIndex：同じ数なら 上の方（1,1,1 → 3段目）', T.fallIndex(T.stackCalc(['tshirt_square', 'tshirt_square', 'tshirt_square'])), 2);
})();

// 比べるための切り替え c（既定では入っていない。入れたら くるくる は いちばん上なら ぐら2）
eq('切り替え前：くるくる 1まいだけ = 0', guras(['tshirt_roll']).g, [0]);
eq('切り替え c を入れられる', T.applyVariant('c'), true);
eq('切り替え c：くるくる 1まいだけ = 2（いちばん上）', guras(['tshirt_roll']).g, [2]);
eq('切り替え c：しかく > くるくる = 1, 2', guras(['tshirt_square', 'tshirt_roll']).g, [1, 2]);
eq('切り替え c：くるくる > しかく = 0, 3（上でなければ 0。すぐ上 +2 はそのまま）', guras(['tshirt_roll', 'tshirt_square']).g, [0, 3]);
eq('切り替え c：文も変わる', T.FOLD_BY_ID.tshirt_roll.text, 'すぐ上の1まい ぐら+2。いちばん上なら ぐら2');
eq('切り替えは 二度 入れられない', T.applyVariant('c'), false);
console.log('\n' + (count - fails) + ' / ' + count + ' ok' + (fails ? '（NG ' + fails + '）' : ''));
process.exit(fails ? 1 : 0);
