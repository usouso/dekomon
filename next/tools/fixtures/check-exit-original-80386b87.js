// Original exit block from usouso/dekomon 80386b87.
// Source blob: 6922aa7843be3a3136b2f64b44c654d2d94d4d57.
// Read as test data; not a runtime module.
  // 合格の条件：--inner0 の 大きさは 中のスクロール 0
  var fail = 0;
  INNER0.forEach(function (k) { if (!rows.some(function (r) { return r.size.w + 'x' + r.size.h === k; })) { console.log('判定 ' + k + '：調べていない → 不合格（--sizes に 入れる）'); fail++; } });
  rows.forEach(function (r) {
    var key = r.size.w + 'x' + r.size.h; if (INNER0.indexOf(key) < 0) return;
    var n = Object.keys(r.a.auto.innerScroll).reduce(function (a, k) { return a + r.a.auto.innerScroll[k]; }, 0);
    console.log('判定 ' + key + '：中のスクロール ' + n + ' → ' + (n === 0 ? '合格' : '不合格（' + fmtObj(r.a.auto.innerScroll) + '）'));
    if (n) fail++;
  });
  if (fail) process.exitCode = 1;
