# たたみやま（版1・最初の試作）

洗濯物を1枚ずつ、たたみ方を選んで山に積む。積んだ山をタンスまで運ぶのは見守るだけ。3日間で かごを空にする。
試作で確かめる問い：「たたみ方と積む順の噛み合い探しで、迷いと発見が出るか」

- rules.js … ルール（画面なしで動く計算だけ。ブラウザと Node で共用。たたみ方の定義・山の計算・運ぶ計算のログ・seed つき乱数）
- index.html / ui.js … 画面（表示と操作だけ。ビルドなし）
- bot.js … ボット（でたらめ・ふつう・コツ2つ・かしこい、参考のコツ3つ、日ごとの表、にせの選択の検査。`--variant c` で案C）
- tests.js … 札の文が文字どおりに動くかのテスト
- tools/check.js … ヘッドレス Chrome で 自動プレイ（?auto=1）を4つの大きさで回し、画面と計算のずれ・文字の重なり・ページのスクロールを数える（`--sizes 812x375,375x667` のように 大きさを足せる。スマホの横向きも対応）
- tools/screens.js … スクリーンショット（screenshots/）
- tools/frames.js … コマ送り画像（0.05秒ごとに10コマ）
- tools/exact.js … 小さい場面（1日目・2日目1山）の全部の並べ方を数える（約2分。`--day2k2` で 2日目2山も。約7分）
- tools/sample.js … 大きい場面の「かならず とどく」積み方の割合を 無作為抽出で数える（`--variant c` も可）
- tools/all.js … 上の確かめを まとめて順に回す（`--quick` で短く。約5分／短くて約2分）
- REPORT.md … この版の報告

動かす：`node tests.js`／`node bot.js [--runs 1000]`／`node serve.js` → http://localhost:8787/
比べるための切り替え：`?v=c`（REPORT 3. の案C：くるくる＝「すぐ上の1まい ぐら+2。いちばん上なら ぐら2」。画面の文も変わり、見出しに「案C」が出る。ボットは `node bot.js --variant c`）。既定は指示書のまま。
確認用の切り替え：`?auto=1`（自動で3日遊ぶ。必ず無音）`&bg=1`（タイマーで進める。この版は演出も全部 setTimeout で進むので、付けても付けなくても同じ）`&speed=10&mute=1&seed=N&reset=1&runs=3`

## Windows の PC に移してから 確かめる手順
1. REPORT.md の 0. の手順で C:\dev\tatamiyama に置き、`gh repo create` と Pages の設定をする。
2. `node tools/all.js --quick` で テスト・ボット・画面の検査・スクリーンショット・コマ送りが一度に回る（Playwright と Chromium が要る：`npm i -D playwright` のあと `npx playwright install chromium`）。
3. `node serve.js` → http://localhost:8787/ で遊ぶ。`?v=c` で案C。
