# クラウド LLM API と専用機械翻訳 API の比較（英→日 Markdown 翻訳、2026年11月時点）

（調査日: 2026-11-09。価格は特記なき限り USD、2026-11-09 に各ページから取得。2026年より前の情報には「2025年情報」等と明記。速度値は Artificial Analysis が 2026-11-09 時点で表示していた直近5日平均。）

## 1. OpenAI: 2026年11月時点のラインナップ・価格・速度・翻訳特化オファリング

### Takeaway
OpenAI API の現行世代は GPT-6 系（gpt-6-astra $10/$50、gpt-6.1-sol $2/$10、gpt-6.1-terra $1/$5、gpt-6-luna $0.10/$0.50 per 1M tokens）。翻訳プレビュー用途で現実的なのは reasoning を `none` にできる Luna と Terra で、テキスト翻訳専用モデルは存在しない（翻訳特化は音声の gpt-realtime-translate のみ）。

### Cited Findings
- 2026-11-09 時点の Standard 価格（per 1M tokens: 入力 / キャッシュ入力 / 出力）: gpt-6-astra $10.00 / $1.00 / $50.00、gpt-6.1-sol $2.00 / $0.10 / $10.00、gpt-6.1-terra $1.00 / $0.05 / $5.00、gpt-6-luna $0.10 / $0.01 / $0.50、gpt-6-sol $2.00 / $0.20 / $10.00 — [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)
- 旧世代も継続提供（2026-11-09 価格）: gpt-5.6-sol $4.00 / $0.40 / $20.00、gpt-5.6-terra $2.00 / $0.20 / $12.00、gpt-5.6-luna $0.20 / $0.02 / $1.20、gpt-5.5 $5.00 / $0.50 / $30.00、gpt-5.4-mini $0.75 / $0.075 / $4.50、gpt-5.4-nano $0.20 / $0.02 / $1.25、gpt-5-nano（2025年モデル）$0.05 / $0.005 / $0.40、gpt-4.1-mini（2025年モデル）$0.40 / $0.10 / $1.60 — [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)
- 上記の GPT-6 系価格は OpenRouter の Models API でも同値（gpt-6-luna $0.10/$0.50、gpt-6.1-terra $1/$5、gpt-6.1-sol $2/$10、gpt-6-astra $10/$50）で、OpenRouter 上の公開日は gpt-6-astra 2026-09-04、gpt-6-sol / gpt-6-luna 2026-09-22、gpt-6.1-sol 2026-09-29、gpt-6.1-terra 2026-10-26 — [OpenRouter Models API（2026-11-09取得）](https://openrouter.ai/api/v1/models)
- GPT-6.1 Sol は 2026-09-29 の DevDay で公開と報道（二次情報） — [techjacksolutions](https://techjacksolutions.com/?p=91537)；GPT-6.1 Terra は 2026-10-26 公開・$1/$5（二次情報） — [requesty](https://www.requesty.ai/blog/gpt-6-1-terra-pricing-api)
- Batch と Flex はいずれも Standard の50%（例: gpt-6-luna $0.05 / $0.005 / $0.25、gpt-6.1-terra $0.50 / $0.025 / $2.50、gpt-6.1-sol $1.00 / $0.05 / $5.00） — [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)
- 「Priority processing was renamed Fast mode on July 30, 2026」。Fast は概ね Standard の2倍（gpt-6-luna $0.20 / $0.02 / $1.00、gpt-6.1-terra $2.00 / $0.10 / $10.00）。さらに Ultrafast が gpt-6-astra（$60 / $6 / $300）と gpt-6.1-sol（$12 / $0.60 / $60）のみに設定 — [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)
- データレジデンシー（regional processing）エンドポイントは「models released on or after March 5, 2026」に10%上乗せ — [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)
- モデル説明（Models ページ）: Astra「Our most capable model for the most demanding work.」、Sol「Near-Astra performance for complex work at a lower cost.」、Terra「A fast, efficient model for visual reasoning, precise computer use, and clear, natural writing.」、Luna「Our most efficient model for focused, high-volume tasks.」。4モデルとも context 1.05M / 最大出力 128K — [OpenAI Models](https://developers.openai.com/api/docs/models)
- reasoning effort: Terra と Luna は `none, low, medium, high, xhigh, max`（=非推論モード可）、Astra と Sol は `low`〜`max` のみで `none` の記載なし — [OpenAI Models](https://developers.openai.com/api/docs/models)
- 翻訳特化: テキスト翻訳モデルは料金表に存在せず、gpt-realtime-translate（「Streaming speech-to-speech translation model」）が $0.034/分 — [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)；[OpenAI Models](https://developers.openai.com/api/docs/models)
- 速度（Artificial Analysis）: GPT-6 Luna（max reasoning）出力 102 tokens/s・TTFT 93.00 s — [Artificial Analysis: GPT-6 Luna](https://artificialanalysis.ai/models/gpt-6-luna)；Time to First Answer Token は GPT-6 Luna non-reasoning 1.16 s / low 2.50 s、GPT-6.1 Terra non-reasoning 1.64 s / low 2.20 s、GPT-6.1 Sol low 2.47 s / medium 4.39 s、GPT-6 Astra low 3.36 s — [Artificial Analysis Leaderboard](https://artificialanalysis.ai/leaderboards/models)
- Artificial Analysis Intelligence Index（汎用知能指標で翻訳品質ではない）: GPT-6 Astra (max) 57、GPT-6.1 Sol (max) 55、GPT-6.1 Terra (max) 51 / non-reasoning 31、GPT-6 Luna (max) 28 / non-reasoning 9 — [Artificial Analysis Leaderboard](https://artificialanalysis.ai/leaderboards/models)
- OpenRouter 経由の gpt-6-luna の提供元には OpenAI のほか Azure（global/US/EU）と Amazon Bedrock（global）が並ぶ — [OpenRouter endpoints: gpt-6-luna](https://openrouter.ai/api/v1/models/openai/gpt-6-luna/endpoints)

### Inferences
- 対話的プレビューでは gpt-6-luna（reasoning `none`）が OpenAI 内で最安・最短 TTFT。品質を一段上げるなら gpt-6.1-terra（`none`、価格10倍）。Sol / Astra は `none` がないため reasoning トークン分の遅延とコストが乗り、インタラクティブ用途には不向き。
- Luna の non-reasoning は Intelligence Index が 9 と低く、技術用語の扱いは自前評価で確認が必要（指標は翻訳品質を測っていない）。
- 長文の一括翻訳（バックグラウンド事前翻訳）には Batch / Flex の50%割引が使える。

### Gaps
- GPT-6 系の英→日翻訳品質に関する独立評価は見つからなかった。
- Artificial Analysis は non-reasoning 版の出力 tokens/s を表示しておらず、翻訳時（reasoning なし）の実効スループットは未確認。
- ストリーミング・Structured Outputs の GPT-6 系対応は今回公式ドキュメントで再確認していない（一般的には提供されている機能だが未検証として扱う）。
- 料金ページ上の「GPT-5.6 Sol promotional pricing（〜2026-11-30）」の具体的内容は確認できなかった。

## 2. Google: Gemini ラインナップ・価格・無料枠、Cloud Translation（NMT / Translation LLM / Adaptive）の価格と Markdown/HTML の扱い

### Takeaway
Gemini API は Gemini 4 Argon（旗艦、2026-12-01 から $2/$10 → $4/$20 に倍増）、Gemini 3.8 Flash（2027-01-01 から $0.75/$3.75 → $1.50/$7.50 に倍増）、Gemini 3.5 Flash-Lite（$0.30/$2.50）、Gemini 3.1 Flash-Lite（$0.25/$1.50）などで、無料枠は Flash 系にあるが入力が製品改善に使われる。Cloud Translation は NMT $20/100万文字、Translation LLM は入力・出力とも $10/100万文字で、HTML は `mime_type: text/html` で扱えるが Markdown のネイティブ対応は確認できない。

### Cited Findings
- Gemini API 有料 Standard 価格（per 1M tokens, 入力 / 出力 / context caching, 2026-11-09）: Gemini 4 Argon $2.00 / $10.00 / $0.10、Gemini 3.8 Flash $0.75 / $3.75 / $0.075、Gemini 3.6 Flash $0.75 / $3.75 / $0.075、Gemini 3.5 Flash-Lite $0.30 / $2.50 / $0.03、Gemini 3.1 Pro Preview $2.00 / $12.00（≤200k）、Gemini 3.1 Flash-Lite $0.25 / $1.50 / $0.025、Gemini 3 Flash Preview $0.50 / $3.00、Gemini 2.5 Flash-Lite（2025年モデル）$0.10 / $0.40 — [Gemini API Pricing](https://aistudio.google.com/docs/pricing)
- 値上げ予定（ページ原文）: Gemini 4 Argon 入力「$2.00 through November 30, 2026. $4.00 starting December 1, 2026.」出力 $10.00 → $20.00、Batch $1.00/$5.00 → $2.00/$10.00；Gemini 3.8 Flash 入力「$0.75 through December 31, 2026. $1.50 starting January 1, 2027.」出力 $3.75 → $7.50（3.6 Flash も同様） — [Gemini API Pricing](https://aistudio.google.com/docs/pricing)
- 出力単価は「Output price (including thinking tokens)」と明記され、思考トークンも出力として課金 — [Gemini API Pricing](https://aistudio.google.com/docs/pricing)
- Batch / Flex は概ね Standard の50%（例: 3.8 Flash $0.375 / $1.875、3.5 Flash-Lite $0.15 / $1.25、3.1 Flash-Lite $0.125 / $0.75）、Priority は1.8倍（3.8 Flash $1.35 / $6.75） — [Gemini API Pricing](https://aistudio.google.com/docs/pricing)
- Gemini 4 Argon は「Implicit caching only (explicit caching is not supported)」 — [Gemini API Pricing](https://aistudio.google.com/docs/pricing)
- Gemini 2.5 Pro / 2.5 Flash は deprecated で、2026-12-01 からそれぞれ Gemini 3.8 Flash / 3.5 Flash-Lite にルーティング — [Gemini API Pricing](https://aistudio.google.com/docs/pricing)
- 無料枠: 3.8 Flash・3.6 Flash（Standard と Priority）、3.5 Flash-Lite（Standard・Batch・Priority）、3.1 Flash-Lite、3 Flash Preview、2.5 系にあり、Gemini 4 Argon と 3.1 Pro Preview には無い。「Used to improve our products」は無料枠 Yes / 有料 No。ただし招待制の Contributor tier は有料側でも Yes — [Gemini API Pricing](https://aistudio.google.com/docs/pricing)
- 規約: 無料（Unpaid Services）では提出内容と生成結果を製品改善に使用し「human reviewers may read, annotate, and process your API input and output」、「Do not submit sensitive, confidential, or personal information to the Unpaid Services.」。有料（Paid Services）では prompts / responses を製品改善に使わず、「logs prompts and responses for a limited period of time, solely for detecting and preventing violations of the Prohibited Use Policy」。EEA・スイス・英国のユーザーに API クライアントを提供する場合は Paid Services のみ使用可 — [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
- Gemini 4 Argon は 2026-09-30 発表、当初はサイバー防御者向けに限定提供し段階的に拡大、出力上限 100万トークン（二次情報） — [Axios](https://axios.com/2026/09/30/google-gemini-4)；その後有料 API tier で開発者に提供（二次情報） — [The New Stack](https://thenewstack.io/gemini-4-argon-live/)；導入期間後 $4/$20 に値上げと報道 — [BetaNews](https://betanews.com/article/gemini-4-argon-cyber-defenders-fairwind/)
- OpenRouter では gemini-3.8-flash が $0.825 / $4.125（AI Studio 公式 $0.75 / $3.75 より10%高い）で、公式価格表に載っていない Gemini 3.7 Flash（$0.75/$3.75、2026-08-13）と Gemini 3.5 Flash（$1.50/$9.00、2026-05-19）も掲載 — [OpenRouter Models API](https://openrouter.ai/api/v1/models)；[Gemini API Pricing](https://aistudio.google.com/docs/pricing)
- 速度（Artificial Analysis）: Gemini 3.5 Flash-Lite（reasoning 版）出力 292 tokens/s・TTFT 4.07 s — [AA: Gemini 3.5 Flash-Lite](https://artificialanalysis.ai/models/gemini-3-5-flash-lite)；Gemini 3.8 Flash（high）112 tokens/s・TTFT 17.50 s — [AA: Gemini 3.8 Flash](https://artificialanalysis.ai/models/gemini-3-8-flash)；3.8 Flash（low）TTFT 3.79 s、Gemini 4 Argon（high）TTFT 37.84 s、Intelligence Index は Argon 50 / 3.8 Flash (high) 31 / 3.5 Flash-Lite 12 — [AA Leaderboard](https://artificialanalysis.ai/leaderboards/models)
- Structured output: `response_format`（`mime_type: application/json` + `schema`）で JSON Schema を指定、例は gemini-3.8-flash と gemini-4-argon。ストリーミング時は「The streamed chunks are valid partial JSON strings that can be concatenated to form the final JSON object.」 — [Gemini Structured output](https://aistudio.google.com/docs/structured-output)
- Cloud Translation 価格: NMT は月50万文字まで無料（毎月 $10 クレジット）、超過分 $20 / 100万文字（コミット割引で $18 / $16）、文書翻訳 $0.08/ページ、カスタムモデル $80 / 100万文字、LLM Adaptive translation 入力 $25 + 出力 $25 / 100万文字、LLM Text translation 入力 $10 + 出力 $10 / 100万文字。原文「If you use Translation LLM (LLM), then it is charged $10 per million characters input and $10 per million characters output, making it cost equivalent with NMT.」。課金文字数はコードポイント単位 — [Cloud Translation pricing](https://cloud.google.com/translate/pricing)
- Translation LLM: Gemini ベースで翻訳向けにファインチューニングされた LLM、モデルパス `projects/PROJECT_ID/locations/LOCATION/models/general/translation-llm`、Vertex AI と Cloud Translation Advanced で利用可、NMT より高レイテンシだが一般に高品質、`mime_type` は任意（既定 text/plain、text/html 対応）、few-shot の例文ペアを与えられる（adaptive）。同ページは「Gemini 2.0 Flash の約3倍速い」とする（比較対象は2025年世代モデル） — [Vertex AI: Translate text](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/translate/translate-text)
- Cloud Translation のデータ: 「text is held briefly in-memory in order to perform the translation」「Google does not use the content you send to train and improve our Google Translation features.」。Advanced API はリージョナルエンドポイントでデータ所在地を設定可能、それ以外はグローバル — [Cloud Translation data usage](https://docs.cloud.google.com/translate/data-usage)

### Inferences
- Markdown を Cloud Translation に通すなら、Markdown → HTML 変換（コードは `<pre><code>`）→ `mime_type: text/html` → 逆変換、が基本形になる。ただしコード要素が翻訳対象外になるかは未確認なので、コード・URL を事前にプレースホルダ化する方が安全。
- 1万語文書あたり NMT 約 $1.20、Translation LLM 約 $0.90（後述）で、Gemini Flash-Lite 系 LLM（$0.03〜0.05）より1桁以上高い。Cloud Translation の利点は「学習に使わない」明確な規約とリージョナル処理、用語集。
- 無料枠は入力が製品改善・人手レビューに使われるため、社内文書・非公開リポジトリには不適。OSS README の試用程度に限定すべき。
- Gemini 3.8 Flash は2027-01-01に、Gemini 4 Argon は2026-12-01に倍額になるため、拡張機能の既定モデル・コスト表示はこの改定を前提に設計する必要がある。
- 思考トークンが出力課金されるため、翻訳では thinking を最小化しないとコストと TTFT が膨らむ（3.8 Flash は high で TTFT 17.5 s、low で 3.79 s）。

### Gaps
- Cloud Translation（NMT / Translation LLM）が HTML 内の `<code>` や `translate="no"` を翻訳対象外にするかは未確認。
- Gemini 3.x Flash / Flash-Lite の thinking 無効化（minimal / 0）の可否とその TTFT は未確認。
- Gemini 3.x / 4 の英→日翻訳品質の独立評価は見つからなかった。
- Vertex AI の東京リージョンで Gemini 3.8 Flash / 4 Argon / Translation LLM が利用可能かは未確認。

## 3. Anthropic: Claude ラインナップと価格の検証、Haiku 5.5 / Sonnet 5.5 の翻訳品質・速度に関する独立レポート

### Takeaway
2026-11-09 時点の公式価格は事前情報と一致（Fable 5.1 $10/$50、Opus 5.5 $4/$20、Sonnet 5.5 $2/$10、Haiku 5.5 $0.10/$0.50（プロンプト10万トークン超は $0.50/$2.50）、Haiku 4.5 $1/$5、Batch 50%）。Claude 4.7 以降は新トークナイザで同じテキストのトークン数が約30%増える点がコスト試算上重要。Haiku 5.5 / Sonnet 5.5 の翻訳品質に関する独立評価は見つからず、速度は Artificial Analysis で Haiku 5.5 233 tokens/s、Sonnet 5.5 151 tokens/s（いずれも max reasoning）。

### Cited Findings
- 公式価格（per MTok: 入力 / 5分キャッシュ書込 / 1時間キャッシュ書込 / キャッシュヒット / 出力）: Claude Fable 5.1 $10 / $12.50 / $20 / $0.25 / $50、Claude Opus 5.5 $4 / $5 / $8 / $0.20 / $20、Claude Sonnet 5.5 $2 / $2.50 / $4 / $0.10 / $10、Claude Haiku 5.5（≤100,000 tokens）$0.10 / $0.125 / $0.20 / $0.01 / $0.50、Claude Haiku 5.5（>100,000 tokens）$0.50 / $0.625 / $1 / $0.05 / $2.50、Claude Haiku 4.5 $1 / $1.25 / $2 / $0.10 / $5 — [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- その他現行モデル: Claude Mythos 5.1（限定提供）$10/$50、Claude Opus 5 $5/$25、Claude Sonnet 5 $2/$10（導入価格がそのまま標準価格化し、2026-09-01 の $3/$15 への値上げは中止）、Claude Sonnet 4.6 $3/$15、Opus 4.8/4.7/4.6/4.5 $5/$25 — [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- キャッシュ倍率: 5分書込 1.25x、1時間書込 2x、ヒット 0.1x（Fable 5.1 / Mythos 5.1 は 0.025x、Opus 5.5 / Sonnet 5.5 は 0.05x）。Batch API とデータレジデンシー倍率と重ねがけ可 — [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Batch API は入出力とも50%引き（Haiku 5.5 は ≤100K で $0.05 / $0.25、>100K で $0.25 / $1.25） — [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Haiku 5.5 の価格段階はキャッシュ読み書きを含む全入力トークンでプロンプト長を判定し、リクエスト単位で適用 — [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- トークナイザ:「Claude 4.7 and later models and Claude Mythos Preview use a newer tokenizer … This tokenizer produces approximately 30% more tokens for the same text.」（増加率は内容次第） — [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Fast mode: Claude Opus 5.5 は $8 / $40（Claude API と Claude Models on Google Cloud (Anthropic managed)）、Batch とは併用不可 — [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Haiku 5.5 は 2026-10-07 公開、「the cheapest, fastest, and most capable small model」、Haiku 系で初めて effort 設定（Low〜Max）を持つ。顧客事例として Asana「over a 30% reduction in latency」、Box は Haiku 4.5 比「about half the latency」。発表文に多言語・翻訳・日本語性能への言及はなし — [Anthropic: Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)
- OpenRouter 上の公開日: Fable 5.1 2026-09-01、Opus 5.5 2026-09-22、Sonnet 5.5 2026-09-28、Haiku 5.5 2026-10-07、いずれも context 1M — [OpenRouter Models API](https://openrouter.ai/api/v1/models)
- 速度（Artificial Analysis）: Claude Haiku 5.5（max）出力 233 tokens/s・TTFT 187.65 s — [AA: Claude Haiku 5.5](https://artificialanalysis.ai/models/claude-haiku-5-5)；Claude Sonnet 5.5（max）出力 151 tokens/s・TTFT 307.65 s — [AA: Claude Sonnet 5.5](https://artificialanalysis.ai/models/claude-sonnet-5-5)；Time to First Answer Token は Haiku 5.5 low 6.93 s / medium 10.16 s、Sonnet 5.5 low 2.35 s / medium 4.21 s、Opus 5.5 low 6.38 s、Fable 5.1 low 6.90 s — [AA Leaderboard](https://artificialanalysis.ai/leaderboards/models)
- Intelligence Index（汎用）: Opus 5.5 (max) 59、Sonnet 5.5 (max) 55、Fable 5.1 (xhigh) 50、Haiku 5.5 (max) 36 / (low) 19 — [AA Leaderboard](https://artificialanalysis.ai/leaderboards/models)
- 翻訳品質の独立評価: ルーティング事業者 OrcaRouter の Haiku 5.5 vs Sakana Namazu 比較記事は、両者を決着させる共通ベンチマークはないとしている（二次情報・検索要約経由） — [OrcaRouter](https://www.orcarouter.ai/blog/claude-haiku-5-5-vs-sakana-namazu)
- Structured outputs は stable（GA）で claude-haiku-5-5 / claude-sonnet-5-5 / claude-opus-5-5 などが対応、ストリーミング可（JSON は受信後に結合して解析）、Batch で50%引き。`output_config.format` を変えるとプロンプトキャッシュが無効化 — [Claude Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- 提供面: Haiku 5.5 は Claude Platform のほか AWS、Google Cloud、Microsoft Azure で提供 — [Anthropic: Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)；OpenRouter 上の提供元は Anthropic、Amazon Bedrock、Google Vertex（global / europe）、Azure（global）、Claude Platform on AWS — [OpenRouter endpoints: claude-haiku-5.5](https://openrouter.ai/api/v1/models/anthropic/claude-haiku-5.5/endpoints)

### Inferences
- 1万語文書なら Haiku 5.5 で約 $0.014/文書（新トークナイザ1.3倍込み、後述）。全文を毎回コンテキストとして送ると長文では10万トークン境界を超え単価が5倍になるため、章単位チャンク化と「プロンプト10万トークン未満」の制御が必須。
- Sonnet 5.5 / Opus 5.5 はキャッシュヒットが 0.05x と安く、「文書全体（用語統一用の文脈）をキャッシュ＋各チャンクを翻訳」する構成と相性が良い（例: Sonnet 5.5 で 18.2k トークンの文書文脈を10チャンクで共有する場合、キャッシュなし入力 $0.364 → 5分キャッシュ書込1回＋ヒット9回で約 $0.062、約83%減。上記単価からの計算値）。
- AA の TTFT は reasoning 込みで、Haiku 5.5 low（6.93 s）が Sonnet 5.5 low（2.35 s）より遅い。翻訳では effort を最小にし、自前環境で TTFT を実測すべき。
- 構造化出力（セグメント ID → 訳文の JSON）を使えば Markdown の構造をアプリ側で保持し、テキストだけを訳させる設計がしやすい。

### Gaps
- Haiku 5.5 / Sonnet 5.5 の英→日翻訳品質に関する独立ベンチマーク・技術ブログは見つからなかった。
- Claude 5.5 系で thinking を完全に無効化した（non-reasoning）場合の TTFT・出力速度は AA に掲載がなく未確認。
- 新トークナイザでの日本語テキストのトークン増加率（約30%は全体平均の目安）は未公表。
- Bedrock / Vertex AI の東京リージョンで Claude 5.5 系が使えるかは未確認。

## 4. DeepL API: モデル、価格、Markdown の扱い、用語集・style rules・custom instructions、日本語品質の評判

### Takeaway
DeepL API は `model_type`（quality_optimized / prefer_quality_optimized / latency_optimized）を選べ、用語集（1リクエスト最大5個）、style rules、custom_instructions（最大10件×300文字）、翻訳メモリ、style profile とカスタマイズが充実。Markdown は文書翻訳 API（`/v2/document`）で2026-11-02に GA となり文字数どおり課金、テキスト API は XML/HTML のタグ処理（v2 が既定）のみ。料金は2026年に API Developer / API Growth へ再編されたとみられるが、公式価格ページは取得できず第三者情報で Growth $32.50/月（年払い $26/月相当）・100万文字込み・超過 $27.50/100万文字。

### Cited Findings
- `model_type` の選択肢は `quality_optimized`、`prefer_quality_optimized`、`latency_optimized`。レスポンスに `model_type_used` と `tag_handling_version` が返る — [DeepL API: Translate text](https://developers.deepl.com/api-reference/translate/request-translation)
- 2026-06-17: `latency_optimized` が全 Translate 機能・全言語ペアに対応（従来は一部機能との併用でエラー） — [DeepL Release notes](https://developers.deepl.com/docs/resources/roadmap-and-release-notes)
- タグ処理: `tag_handling` は `xml` / `html`、`tag_handling_version` は v1（将来非推奨）と v2（「Improved algorithm released in October 2025. This is the default.」）、`outline_detection` で XML 構造自動検出を制御 — [DeepL API: Translate text](https://developers.deepl.com/api-reference/translate/request-translation)；2025年Q4に XML/HTML のタグ処理アルゴリズムを全面改修（2025年情報） — [DeepL Release notes](https://developers.deepl.com/docs/resources/roadmap-and-release-notes)
- custom_instructions:「Up to 10 custom instructions can be specified, each with a maximum of 300 characters.」。`style_profile_id` は glossary / style_id / 翻訳メモリ / custom_instructions と併用不可 — [DeepL API: Translate text](https://developers.deepl.com/api-reference/translate/request-translation)
- カスタマイズ機能の更新: 2025年Q4 custom_instructions パラメータと style rules API 追加（2025年情報）、2026-03-26 style rule / custom instruction 管理エンドポイント追加、2026-04-09 翻訳メモリ API、2026-06-23 1リクエスト最大5用語集、2026-10-20 style profile（用語集・style rule・翻訳メモリを1 ID に束ねる）、2026-10-28 source_lang なしで用語集使用可、2026-11-03 言語バリアント別辞書 — [DeepL Release notes](https://developers.deepl.com/docs/resources/roadmap-and-release-notes)
- Markdown: 2026-09-29 に文書翻訳へ `md` / `markdown` をベータ追加、2026-11-02 に GA（「They are no longer marked beta.」）。テキスト翻訳での Markdown 対応はリリースノートに記載なし — [DeepL Release notes](https://developers.deepl.com/docs/resources/roadmap-and-release-notes)；文書翻訳 API の対応形式に「md / markdown - Markdown Document」 — [DeepL API: Document](https://developers.deepl.com/docs/api-reference/document)
- 文書翻訳の課金（2026-11-02）: docx / pdf 等の document-like 形式は「billed a minimum of 50,000 characters per document」、一方 .md / .markdown / .html / .txt / .json 等の text-like 形式は「billed for their exact character count」 — [DeepL Release notes](https://developers.deepl.com/docs/resources/roadmap-and-release-notes)
- プラン名: 2026-06-24 のリリースノートに「API Pro, API Developer, API Growth, and API Enterprise plans」と記載 — [DeepL Release notes](https://developers.deepl.com/docs/resources/roadmap-and-release-notes)
- 価格（第三者、2026-06-03 公開記事）: API Developer は月額なしで「1 million characters as one-time credit for testing」、API Growth は $32.50/月（欧州 €29.75）で月100万文字・上限月5,000万文字、超過は「$27.50 … for 1,000,000 extra characters」 — [SimpleLocalize](https://simplelocalize.io/blog/posts/ai-machine-translation-cost-comparison/)
- DeepL サポート記事（WebFetch は403、検索スニペット経由）: Growth は月払いで100万文字＋音声認識10時間、年払いで1,200万文字＋120時間、利用上限は月5,000万文字。Developer は通算100万文字でリセットなし — [DeepL Support](https://support.deepl.com/hc/articles/360021200939)
- AWS Marketplace の DeepL 掲載（検索スニペット経由）: Growth 年契約 $312（1,200万文字込み）、従量 $25/100万文字 — [AWS Marketplace: DeepL](https://aws.amazon.com/marketplace/pp/prodview-2fii5e2hmuneo)；旧 API Pro は $5.49/月＋$25/100万文字（G2、2026年1月更新、検索スニペット経由） — [G2: DeepL API pricing](https://www.g2.com/products/deepl-api/pricing)；旧 API Free / Pro は2026年7月に新規販売終了とする集計サイトもあるが未確認 — [usagepricing: DeepL](https://usagepricing.com/blueprint/deepl)
- データ: 「Texts are never stored」、学習利用は「without your consent」では行わない、SOC 2 Type II、BYOK 暗号化。サーバー所在地の記載なし — [DeepL Pro data security](https://www.deepl.com/en/pro-data-security)；Pro 加入者のデータは「never used to train DeepL's AI models」 — [DeepL Pro](https://www.deepl.com/en/pro-api)
- 日本語品質の評判: 2026年10月更新の国内ブログは DeepL Pro が敬語を最も忠実に再現すると主張するが、「Google Cloud Translation API v3.5」「Azure Translator v4.2」など実在が確認できない版名や Claude 3.5 Sonnet / GPT-4o 等の旧モデルを比較対象にしており、信頼性は低い — [jisaku.com](https://jisaku.com/posts/ai-translation-comparison-2026)

### Inferences
- VS Code 拡張での使い方は3択: (A) `.md` を文書翻訳 API に渡す（DeepL 側の Markdown パーサで構造保持、文字数どおり課金だが upload→poll→download の非同期で対話プレビューには遅い可能性）、(B) Markdown→HTML 化してテキスト API の `tag_handling=html`（コードは除外タグ化）、(C) 拡張側で Markdown を AST 分解し、見出し・段落・リスト・表セルのテキストだけを送って再構成（コード文字に課金されず、コード保持が確実）。インタラクティブ用途では (C) が最も制御しやすい。
- 1万語文書（約6万文字）で従量 $1.50〜1.65。Growth の月100万文字枠なら同規模文書約16本分が基本料に含まれる。LLM 系の安価モデル（$0.01〜0.05/文書）より高いが、用語集・翻訳メモリ・custom instructions による用語統一が強み。

### Gaps
- DeepL 公式の API 価格ページ（deepl.com）は動的描画・403 で取得できず、2026年11月時点の公式単価（特に円建て）は未確認。
- テキスト API でタグ文字が課金対象に含まれるかは未確認。
- quality_optimized / latency_optimized のレイテンシ実測値は見つからなかった。
- DeepL のデータ処理拠点（日本国内処理の有無）は未確認。
- 2026年の信頼できる英→日品質比較（DeepL vs 最新 LLM）は見つからなかった。

## 5. その他の選択肢: Azure AI Translator、Amazon Translate / Nova、Mistral、DeepSeek、Qwen、xAI、OpenRouter、国産 API（PLaMo翻訳・tsuzumi・Sakana）

### Takeaway
専用 MT では Azure Translator が 2026-06-06 GA の新 API で NMT と LLM（例: GPT-5.1 デプロイ）を選択可能、Amazon Translate は $15/100万文字。低価格 LLM では DeepSeek V4.1 Flash（ピーク $0.30/$1.20、オフピーク半額）、Qwen-MT Flash（$0.10〜0.16/$0.28〜0.49、ただし入力8K上限）が安い。国産では PLaMo翻訳が2026年10月に第3世代 PLaMo で大型更新し「原文10万文字あたり約14円」を主張するが、翻訳専用 API の公開は確認できない。

### Cited Findings
- Azure Translator: 最新 GA は `2026-06-06`（v3.0 から破壊的変更）。「Model choice (NMT or LLM). You can select standard NMT or an LLM deployment (for example, GPT-5.1)」、LLM 利用には Microsoft Foundry リソースが必要。Adaptive custom translation で最大5件の参照訳または adaptive dataset index を指定可、LLM 翻訳は tone（formal / informal / neutral）と gender 制御に対応 — [Microsoft Learn: Azure text translation](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/overview)
- Azure の制限と課金: Translate の配列は NMT で最大1,000要素・要素サイズ上限50,000、LLM で最大50要素・要素サイズ上限5,000（表に単位の明記なし、文字数と推定）。NMT はソース文字数課金、LLM は Azure OpenAI の入出力トークン単価で課金。エンドポイント選択で NMT の処理場所が決まる — [Microsoft Learn: Azure text translation](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/overview)
- Azure 価格ページは単価が動的表示で取得できず、静的に確認できたのは Custom Translation $40 / 100万文字、学習 $10 / 100万文字（上限 $300） — [Azure Translator pricing](https://azure.microsoft.com/en-us/pricing/details/translator/)；第三者記事（2026-06）は Microsoft Translator を $10 / 100万文字、月200万文字無料と記載 — [SimpleLocalize](https://simplelocalize.io/blog/posts/ai-machine-translation-cost-comparison/)
- Amazon Translate: 標準テキスト翻訳 $15.00 / 100万文字（12か月間 月200万文字無料）、リアルタイム文書翻訳（Text & HTML）$15.00、Docx $30.00、Active Custom Translation $60.00 / 100万文字 — [Amazon Translate pricing](https://aws.amazon.com/translate/pricing/)
- Amazon Nova（OpenRouter 価格、per 1M tokens）: Nova 2 Lite $0.30 / $2.50（2025-12 公開、2025年モデル）、Nova Premier $2.50 / $12.50（2025年モデル）、Nova Lite $0.06 / $0.24・Nova Micro $0.035 / $0.14（2024年モデル） — [OpenRouter Models API](https://openrouter.ai/api/v1/models)
- Mistral（OpenRouter 価格）: Mistral Large 4（2026-10-06）$0.70 / $2.10（キャッシュ $0.07）、Mistral Medium 3.5（2026-04-30）$1.50 / $7.50、Mistral Small 2603 $0.15 / $0.60 — [OpenRouter Models API](https://openrouter.ai/api/v1/models)；AA で Mistral Large 4 は Index 26（high）、TTFT 20.97 s（medium） — [AA Leaderboard](https://artificialanalysis.ai/leaderboards/models)
- DeepSeek（公式）: `deepseek-flash` は「now served by DeepSeek-V4.1-Flash-1017」、他に DeepSeek-V4-Pro-0813。context 1M・最大出力 384K、JSON Output・Tool Calls・Responses API・Anthropic API 互換。価格（per 1M、オフピーク / ピーク）: Flash はキャッシュヒット $0.003 / $0.006、ミス $0.15 / $0.30、出力 $0.60 / $1.20；V4-Pro はヒット $0.022 / $0.044、ミス $0.66 / $1.32、出力 $1.98 / $3.96。ピークは月〜金 01:00–04:00 と 06:00–10:00 UTC（中国の祝日除く） — [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing)
- OpenRouter は deepseek-v4.1-flash-1017 を入力 $0.006 / 出力 $0.50 と表示しており公式と不一致（公式を優先すべき） — [OpenRouter Models API](https://openrouter.ai/api/v1/models)；AA で DeepSeek V4.1 Flash 1017 non-reasoning の TTFT 1.32 s・Index 19 — [AA Leaderboard](https://artificialanalysis.ai/leaderboards/models)
- Qwen-MT（公式、ページ更新 2026-10-11）: qwen-mt-flash は入力 / 出力 per 1M で Singapore（International）$0.16 / $0.49、US（Virginia）と Germany（Frankfurt）（Global）$0.101 / $0.28、China（Beijing）$0.101 / $0.28。context 16,384、最大入力・出力 各8,192、92言語、terminology intervention・domain-specific adaptation・format preservation を謳う一方、structured outputs・context caching・batch は非対応、60 RPM — [Alibaba Cloud: qwen-mt-flash](https://www.alibabacloud.com/help/en/model-studio/qwen-mt-flash)
- qwen-mt-plus の価格は集計サイト間で不一致（International $2.46 / $7.37、China $0.259 / $0.775 など） — [modelcompare](https://modelcompare.dev/models/alibaba/mt-plus)
- Qwen 汎用（OpenRouter 価格）: Qwen3.8 Max (0902) $2.00 / $6.00、Qwen3.8 Flash $0.15 / $0.47、Qwen3.7 Flash $0.03 / $0.13、Qwen3.8 Max Prime $4.00 / $12.00 — [OpenRouter Models API](https://openrouter.ai/api/v1/models)
- xAI（OpenRouter 価格）: Grok 4.7（2026-09-21）$2.00 / $6.00（キャッシュ $0.50、batch $1.60 / $4.80）、Grok 4.3 $1.25 / $2.50（1M ctx）、Grok 4.20 $1.25 / $2.50（2M ctx） — [OpenRouter Models API](https://openrouter.ai/api/v1/models)；AA で Grok 4.7 low の TTFT 12.70 s — [AA Leaderboard](https://artificialanalysis.ai/leaderboards/models)
- 翻訳特化の他社モデル: Tencent HY-MT2（2026-08）1.8B $0.044 / $0.177、7B と 30B-A3B $0.074 / $0.295、context 8K — [OpenRouter Models API](https://openrouter.ai/api/v1/models)
- OpenRouter: 2026-11-09 時点で Models API に461モデル、多くに `:batch` 版あり — [OpenRouter Models API](https://openrouter.ai/api/v1/models)。手数料はクレジット購入時 5.5%（最低 $0.80）、Business は 8% — [OpenRouter pricing](https://openrouter.ai/pricing)；[OpenRouter Business](https://openrouter.ai/business)；ZDR エンドポイントへのルーティング指定が全プランで可能、Business は EU / US 域内ルーティング（いずれも検索要約経由・一部二次情報） — [developersdigest](https://www.developersdigest.tech/llm-gateways/openrouter)
- PLaMo翻訳（PFN）: 2026-10 に第3世代 PLaMo ベースの大型アップデート、対応言語を2言語→53言語に拡大。PFN は自社ベンチマークを含む評価で「Claude Fable 5.1」「GPT-6.1 Sol」「GPT-6 Astra」と「同等の日本語翻訳精度を実現した」と主張。コストは原文10万文字あたり約14円で海外フロンティアモデルや MT サービスの10分の1未満と主張。記事に API 提供・料金・データ取扱いの記載なし — [Impress Watch](https://www.watch.impress.co.jp/docs/news/2146531.html)
- 同アップデートについて ToolNavs は「PLaMo Translation には公開 API がなく、14円は同世代の PLaMo API 価格からの換算」と指摘（二次情報） — [ToolNavs](https://toolnavs.com/ja/article/2375-plamo-fan-yi-da-xing-geng-xin-shang-xian-5-3-zhong-yu-yan-yu-hui-yi-shi-shi-fan)
- PLaMo 汎用 API（PLaMo 3.0 Prime）は入力60円・出力250円 / 100万トークンと報じられている（検索要約経由、一次情報未確認） — [Impress Watch](https://www.watch.impress.co.jp/docs/news/2121535.html)；[窓の杜](https://forest.watch.impress.co.jp/docs/news/2122637.html)；開発者向けに上限付き無料 API プランがあるとの報告（詳細未確認） — [SmartScope](https://smartscope.blog/en/blog/plamo-3-1-prime-free-api-plan-conditions-2026/)
- PLaMo翻訳の初版（2025-05、2025年情報）はオンプレミス製品として発表、API 開発計画にも言及 — [PFN Press Release](https://www.preferred.jp/en/news/pr20250527)
- Sakana AI: 2026-08-21 に無料 Web サービス Sakana Translate（日・英・中の双方向）の翻訳モデルを新世代 Sakana Namazu に更新。Translate の公開 API はなく「API access」は将来の企業向けプラン。自社手法 TransEvalnia で 160件の日→英タスクを一対比較し、比較相手（名称非公開）すべてに50%超で勝ったと主張。入力は約5,000文字まで — [Sakana AI](https://sakana.ai/translate-update/)；Sakana Namazu 自体は API 提供（OpenRouter $0.95 / $4.00）、「Japanese-specialized reasoning model … based on Kimi K2.6」 — [OpenRouter Models API](https://openrouter.ai/api/v1/models)
- NTT tsuzumi 2: 料金は個別見積もりで非公開 — [aiagent-navi](https://aiagent-navi.com/generation-ai/tsuzumi-pricing-guide/)；Microsoft Azure 上で提供 — [NTT DATA](https://www.nttdata.com/jp/ja/lineup/tsuzumi)；[EnterpriseZine](https://enterprisezine.jp/news/detail/24316)。翻訳専用 API の情報は見つからず

### Inferences
- DeepSeek のピーク時間帯（01:00–04:00・06:00–10:00 UTC）は日本時間の平日 10:00–13:00・15:00–19:00 にあたり、日本の業務時間の大半はピーク料金（Flash で約 $0.027/文書）になる。
- Qwen-MT Flash は最安級だが最大入力8,192トークンのため、1万語文書は必ずチャンク分割が必要。構造化出力・キャッシュ・バッチ非対応で、拡張側の分割・再構成ロジックが前提。
- Azure の LLM 翻訳は要素サイズ上限5,000・最大50要素の制限があり、長文 Markdown は拡張側で分割が必要。料金は Azure OpenAI のトークン単価に依存するため、NMT の $10/100万文字との比較は採用モデル次第。
- 国内処理・国産モデルを重視する企業向けには PLaMo が候補だが、翻訳専用 API の有無・料金を PFN に直接確認する必要がある。
- OpenRouter は「1つの API キーで複数社を切り替えられる」利点がある一方、5.5% の手数料とプロバイダごとのデータポリシー差に注意（ZDR 指定ルーティングを使うべき）。

### Gaps
- Azure Translator NMT の2026年11月時点の公式単価（価格ページが動的描画）は未取得。
- Amazon Translate / Nova、Mistral、xAI、Qwen、DeepSeek の英→日技術文書翻訳品質に関する2026年の独立評価は見つからなかった。
- DeepSeek の推論・データ保存拠点は料金ページに記載がなく未確認。
- PLaMo翻訳の API 提供有無・単価・データ取扱い、tsuzumi 2 の翻訳用途での API 単価は未確認。
- OpenRouter の BYOK 手数料条件は情報源間で食い違いあり。

## 6. 機能比較（ストリーミング・構造化出力・プロンプトキャッシュ・バッチ）とデータ保持/学習利用・データレジデンシー

### Takeaway
米国系 LLM API（OpenAI / Anthropic / Gemini 有料枠）はいずれも API データを既定で学習に使わず、バッチ50%引きとプロンプトキャッシュを備える。ただし一次 API で「日本国内での推論」を選べるものは確認できず、OpenAI の日本レジデンシーは保存のみ（推論は国外）、Anthropic は `global` / `us` のみ。Gemini 無料枠は学習・人手レビュー対象なので社内文書には使えない。

### Cited Findings
- OpenAI のデータ: 「data sent to the OpenAI API is not used to train or improve OpenAI models」（オプトインしない限り）、不正利用監視ログは既定で最大30日、ZDR / Modified Abuse Monitoring は事前承認制、ZDR では `/v1/responses`・`/v1/chat/completions` の `store` が強制 false、`/v1/responses` は既定で30日保存 — [OpenAI: Your data](https://developers.openai.com/api/docs/guides/your-data)
- OpenAI のデータレジデンシー: 日本（`jp.api.openai.com`）は Regional storage = Yes、Regional processing = No、MAM/ZDR が必要。in-region 推論は US・EU・UAE のみで、非対応リージョンでは「may also process and temporarily store Customer Content outside of the Region」。2026-03-05 以降のモデルは10%上乗せ — [OpenAI: Your data](https://developers.openai.com/api/docs/guides/your-data)
- OpenAI の割引・キャッシュ: Batch / Flex 50%、キャッシュ入力単価（例 gpt-6-luna $0.01）、Fast（旧 Priority）約2倍 — [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)
- Anthropic のデータ:「Retained data is never used for model training without your express permission.」「Conversation content … is not retained by default; the exception is Covered Models, which require 30-day retention.」Covered Models は Fable 5.1 / Mythos 5.1 / Fable 5 / Mythos 5 で ZDR 不可。Batch は29日保持（ZDR 対象外）。プロンプトキャッシュは ZDR 対象で、KV キャッシュは TTL の間メモリ保持後削除 — [Claude: API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- Anthropic のデータレジデンシー: `inference_geo` は `"global"`（既定）と `"us"` のみ、workspace geo は `"us"` のみ。`us` 指定は1.1倍。Claude 4.6 以降が対象 — [Claude: Data residency](https://platform.claude.com/docs/en/manage-claude/data-residency)。Bedrock / Vertex の regional・multi-region エンドポイントはグローバル比10%増 — [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Anthropic の機能: Batch 50%、プロンプトキャッシュ（自動 / 明示ブレークポイント、5分・1時間） — [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)；Structured outputs GA・ストリーミング併用可・Batch 併用可 — [Claude Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- Gemini API: 無料枠は学習・人手レビュー対象、有料は改善に使わず不正検知目的で限定期間ログ — [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)；Batch / Flex 50%、Priority 1.8倍、context caching（Argon は implicit のみ） — [Gemini API Pricing](https://aistudio.google.com/docs/pricing)；JSON Schema 構造化出力とストリーミング（部分 JSON） — [Gemini Structured output](https://aistudio.google.com/docs/structured-output)
- Google Cloud Translation: テキストはメモリ上で短時間保持のみ・学習に不使用・Advanced API はリージョナルエンドポイント可 — [Cloud Translation data usage](https://docs.cloud.google.com/translate/data-usage)
- DeepL: テキスト非保存・同意なき学習なし・SOC 2 Type II・BYOK — [DeepL Pro data security](https://www.deepl.com/en/pro-data-security)。バッチ割引の記載なし（文書翻訳は非同期 API） — [DeepL Release notes](https://developers.deepl.com/docs/resources/roadmap-and-release-notes)
- Azure Translator: エンドポイント（global / geography / resource-specific）選択で NMT の処理場所が決まり、LLM は Foundry デプロイに依存 — [Microsoft Learn: Azure text translation](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/overview)
- DeepSeek: JSON Output・Tool Calls 対応、キャッシュヒット単価あり、バッチの代わりにオフピーク半額 — [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing)
- Qwen-MT Flash: structured outputs・context caching・batch 非対応、デプロイ地域は北京・シンガポール・フランクフルト・バージニア — [Alibaba Cloud: qwen-mt-flash](https://www.alibabacloud.com/help/en/model-studio/qwen-mt-flash)

### Inferences
- 要件「プライベート / オフラインモード」を厳密に満たすのはローカル推論（別担当）であり、クラウド側では「有料枠のみ」「ZDR / 非保持」「学習不使用」を設定で強制する UI が必要（例: Gemini 無料キーを検知して警告）。
- 日本企業でデータの国内処理が必須の場合、一次 API では要件を満たせない可能性が高く、Azure / Bedrock / Vertex の日本リージョン（未確認）か国産 API（PLaMo、tsuzumi）を検討することになる。
- 拡張機能の差分翻訳（編集箇所だけ再翻訳）は拡張側のセグメントキャッシュで実装し、LLM 側のプロンプトキャッシュは「システムプロンプト＋用語集＋文書文脈」の共有部分に使うのが効率的。

### Gaps
- Gemini API（AI Studio）の有料枠でのログ保持期間の具体的日数、および日本リージョン指定可否は未確認。
- Amazon Translate / Bedrock、Azure OpenAI の日本リージョンでの各最新モデル提供状況は未確認。
- DeepL・Google Cloud Translation のストリーミング対応は未確認（同期 API で一括返却が基本と推測）。
- OpenAI GPT-6 系の Structured Outputs / ストリーミング対応は今回再確認していない。

## 7. 10,000語の英語 Markdown 文書を翻訳する場合のコスト試算

### Takeaway
前提（入力14kトークン・出力19kトークン、原文6万文字）で、1文書あたり GPT-6 Luna・Claude Haiku 5.5・Qwen-MT Flash・DeepSeek V4.1 Flash は約 $0.007〜0.03、Gemini Flash-Lite 系は $0.03〜0.05、Sonnet 5.5 / GPT-6.1 Sol / Gemini 4 Argon は $0.22〜0.44、Opus 5.5 は約 $0.57、Fable 5.1 / GPT-6 Astra は $1.1〜1.4。専用 MT は Azure $0.60、Amazon $0.90、Google Translation LLM $0.90、Google NMT $1.20、DeepL $1.50〜1.65 と、安価 LLM より1〜2桁高い。

### Cited Findings
- 試算の前提（調査者の仮定）: 英語1万語の技術 Markdown ≒ 6万文字、本文 ≒ 13kトークン＋指示・用語集 1kトークン = 入力14kトークン、日本語出力 ≒ 19kトークン（18–20k の中央値）、reasoning トークンなし。Claude 4.7 以降は新トークナイザで約30%増とされるため入力18.2k・出力24.7kで計算 — [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)。Gemini は思考トークンも出力課金なので thinking を使うとその分増える — [Gemini API Pricing](https://aistudio.google.com/docs/pricing)
- LLM の1文書あたりコスト（2026-11-09 単価、標準 / Batch50%）:

| モデル | 単価 入力/出力 per 1M | 標準 | Batch | 出典 |
|---|---|---|---|---|
| gpt-6-luna | $0.10 / $0.50 | $0.011 | $0.005 | [OpenAI Pricing](https://developers.openai.com/api/docs/pricing) |
| gpt-5.4-nano | $0.20 / $1.25 | $0.027 | $0.013 | [OpenAI Pricing](https://developers.openai.com/api/docs/pricing) |
| gpt-5.4-mini | $0.75 / $4.50 | $0.096 | $0.048 | [OpenAI Pricing](https://developers.openai.com/api/docs/pricing) |
| gpt-6.1-terra | $1 / $5 | $0.109 | $0.055 | [OpenAI Pricing](https://developers.openai.com/api/docs/pricing) |
| gpt-6.1-sol | $2 / $10 | $0.218 | $0.109 | [OpenAI Pricing](https://developers.openai.com/api/docs/pricing) |
| gpt-6-astra | $10 / $50 | $1.090 | $0.545 | [OpenAI Pricing](https://developers.openai.com/api/docs/pricing) |
| Gemini 2.5 Flash-Lite（2025年モデル） | $0.10 / $0.40 | $0.009 | $0.005 | [Gemini Pricing](https://aistudio.google.com/docs/pricing) |
| Gemini 3.1 Flash-Lite | $0.25 / $1.50 | $0.032 | $0.016 | [Gemini Pricing](https://aistudio.google.com/docs/pricing) |
| Gemini 3.5 Flash-Lite | $0.30 / $2.50 | $0.052 | $0.026 | [Gemini Pricing](https://aistudio.google.com/docs/pricing) |
| Gemini 3.8 Flash（〜2026-12-31） | $0.75 / $3.75 | $0.082 | $0.041 | [Gemini Pricing](https://aistudio.google.com/docs/pricing) |
| Gemini 3.8 Flash（2027-01-01〜） | $1.50 / $7.50 | $0.164 | $0.082 | [Gemini Pricing](https://aistudio.google.com/docs/pricing) |
| Gemini 3.1 Pro Preview | $2 / $12 | $0.256 | $0.128 | [Gemini Pricing](https://aistudio.google.com/docs/pricing) |
| Gemini 4 Argon（〜2026-11-30） | $2 / $10 | $0.218 | $0.109 | [Gemini Pricing](https://aistudio.google.com/docs/pricing) |
| Gemini 4 Argon（2026-12-01〜） | $4 / $20 | $0.436 | $0.218 | [Gemini Pricing](https://aistudio.google.com/docs/pricing) |
| Claude Haiku 5.5（×1.3トークン） | $0.10 / $0.50 | $0.014 | $0.007 | [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Haiku 4.5（旧トークナイザ） | $1 / $5 | $0.109 | $0.055 | [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Sonnet 5.5（×1.3） | $2 / $10 | $0.283 | $0.142 | [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Opus 5.5（×1.3） | $4 / $20 | $0.567 | $0.283 | [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Fable 5.1（×1.3） | $10 / $50 | $1.417 | $0.709 | [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| DeepSeek V4.1 Flash（ピーク / オフピーク） | $0.30 / $1.20（半額） | $0.027 / $0.014 | — | [DeepSeek Pricing](https://api-docs.deepseek.com/quick_start/pricing) |
| DeepSeek V4 Pro（ピーク） | $1.32 / $3.96 | $0.094 | — | [DeepSeek Pricing](https://api-docs.deepseek.com/quick_start/pricing) |
| Qwen-MT Flash（Singapore / US・DE） | $0.16 / $0.49（$0.101 / $0.28） | $0.012（$0.007） | — | [Alibaba Cloud](https://www.alibabacloud.com/help/en/model-studio/qwen-mt-flash) |
| Qwen3.8 Flash（OpenRouter） | $0.15 / $0.47 | $0.011 | — | [OpenRouter](https://openrouter.ai/api/v1/models) |
| Mistral Large 4（OpenRouter） | $0.70 / $2.10 | $0.050 | — | [OpenRouter](https://openrouter.ai/api/v1/models) |
| Amazon Nova 2 Lite（OpenRouter、2025年モデル） | $0.30 / $2.50 | $0.052 | — | [OpenRouter](https://openrouter.ai/api/v1/models) |
| Sakana Namazu（OpenRouter） | $0.95 / $4.00 | $0.089 | — | [OpenRouter](https://openrouter.ai/api/v1/models) |
| Grok 4.7（OpenRouter） | $2 / $6 | $0.142 | — | [OpenRouter](https://openrouter.ai/api/v1/models) |

- 文字課金の MT（原文6万文字、出力課金があるものは日本語出力3万文字と仮定）: Azure / Microsoft Translator $10/100万文字 → $0.60 — [SimpleLocalize](https://simplelocalize.io/blog/posts/ai-machine-translation-cost-comparison/)；Amazon Translate $15 → $0.90 — [Amazon Translate pricing](https://aws.amazon.com/translate/pricing/)；Google NMT $20 → $1.20、Google Translation LLM（$10入力＋$10出力）→ $0.90、Google Adaptive（$25＋$25）→ $2.25 — [Cloud Translation pricing](https://cloud.google.com/translate/pricing)；DeepL 従量 $25 → $1.50 — [AWS Marketplace: DeepL](https://aws.amazon.com/marketplace/pp/prodview-2fii5e2hmuneo)、Growth 超過 $27.50 → $1.65 — [SimpleLocalize](https://simplelocalize.io/blog/posts/ai-machine-translation-cost-comparison/)
- PLaMo翻訳は PFN 主張の「原文10万文字あたり約14円」で換算すると約8.4円/文書（API 提供は未確認） — [Impress Watch](https://www.watch.impress.co.jp/docs/news/2146531.html)
- 無料枠: Google NMT は月50万文字（約8文書分）無料 — [Cloud Translation pricing](https://cloud.google.com/translate/pricing)；Amazon Translate は12か月間 月200万文字無料 — [Amazon Translate pricing](https://aws.amazon.com/translate/pricing/)；Gemini Flash 系無料枠はデータが製品改善に使われる — [Gemini API Pricing](https://aistudio.google.com/docs/pricing)

### Inferences
- 安価 LLM（Luna / Haiku 5.5 / Flash-Lite / DeepSeek Flash）は1文書 $0.01〜0.05 で、専用 MT（$0.60〜1.65）より20〜100倍安い。コスト面だけなら LLM 優位で、専用 MT を選ぶ理由は用語集・TM・データ規約・決定論的な挙動になる。
- reasoning を有効化すると出力トークンが数倍になりうるため、上表は下限値とみなすべき（特に Gemini は思考トークンが出力課金）。
- 対話プレビューで「表示中のセクションだけ翻訳 → 残りはバックグラウンド（Batch / Flex / オフピーク）」にすると、体感速度を保ちつつ全体コストを半減できる。
- コード・URL・フロントマターを送信前に除外すると、入力トークン（文字課金 MT では文字数）も削減できる。

### Gaps
- 実際の日本語出力トークン数はモデルのトークナイザごとに異なり（Gemini・DeepSeek・Qwen の日本語トークン効率は未調査）、上表の出力19kトークンは仮定。
- DeepL テキスト API でタグ文字が課金対象か不明なため、HTML 化した場合の DeepL コストは上振れの可能性あり。
- Azure LLM 翻訳の単価（Azure OpenAI 側の GPT-5.1 等のトークン単価）は未取得。

## 8. 速度（TTFT・出力トークン/秒）の横断比較

### Takeaway
Artificial Analysis の実測では、出力速度は Gemini 3.5 Flash-Lite 292 tokens/s、Claude Haiku 5.5 233 tokens/s、Claude Sonnet 5.5 151 tokens/s、Gemini 3.8 Flash 112 tokens/s、GPT-6 Luna 102 tokens/s（いずれも reasoning 版）。最初の回答トークンまでの時間は GPT-6 Luna non-reasoning 1.16 s、DeepSeek V4.1 Flash non-reasoning 1.32 s、GPT-6.1 Terra non-reasoning 1.64 s が最短クラス。1文書分（約19kトークン）を1本のストリームで出すと65〜190秒かかるため、分割・並列化が必須。

### Cited Findings
- 方法論: 出力速度は「Output tokens divided by total request time, including time to first token」で reasoning トークンを含む、reasoning モデルの TTFT は thinking 時間を含む、速度・レイテンシは各エンドポイントの直近5日平均で、ベンチマークは6時間ごとに実行 — [Artificial Analysis: Models](https://artificialanalysis.ai/models)
- 出力速度（tokens/s）: Gemini 3.5 Flash-Lite 292 — [AA](https://artificialanalysis.ai/models/gemini-3-5-flash-lite)；Claude Haiku 5.5（max）233 — [AA](https://artificialanalysis.ai/models/claude-haiku-5-5)；Claude Sonnet 5.5（max）151 — [AA](https://artificialanalysis.ai/models/claude-sonnet-5-5)；Gemini 3.8 Flash（high）112 — [AA](https://artificialanalysis.ai/models/gemini-3-8-flash)；GPT-6 Luna（max）102 — [AA](https://artificialanalysis.ai/models/gpt-6-luna)
- Time to First Answer Token（秒）: GPT-6 Luna non-reasoning 1.16 / low 2.50、DeepSeek V4.1 Flash 1017 non-reasoning 1.32、GPT-6.1 Terra non-reasoning 1.64 / low 2.20、Claude Sonnet 5.5 low 2.35、GPT-6.1 Sol low 2.47、GPT-6 Astra low 3.36、DeepSeek V4 Pro 0813 non-reasoning 3.42、Gemini 3.8 Flash low 3.79、Gemini 3.5 Flash-Lite 4.07、Qwen3.8 27B non-reasoning 5.30、Claude Opus 5.5 low 6.38、Claude Fable 5.1 low 6.90、Claude Haiku 5.5 low 6.93、Grok 4.7 low 12.70、Mistral Large 4 medium 20.97、Gemini 4 Argon high 37.84 — [AA Leaderboard](https://artificialanalysis.ai/leaderboards/models)
- 高速化オプション: OpenAI Fast（旧 Priority、約2倍価格）と Ultrafast（Astra / 6.1 Sol のみ） — [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)；Claude Opus 5.5 Fast mode $8 / $40 — [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)；Gemini Priority（1.8倍） — [Gemini API Pricing](https://aistudio.google.com/docs/pricing)；DeepL `latency_optimized` — [DeepL API: Translate text](https://developers.deepl.com/api-reference/translate/request-translation)
- Google の Translation LLM は NMT より高レイテンシ（ドキュメント記載） — [Vertex AI: Translate text](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/translate/translate-text)
- Haiku 5.5 のベンダー / 顧客主張: Anthropic の標準速度モデル中で最速、Asana は「up to 2.5x faster inference per agent turn」 — [Anthropic: Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)

### Inferences
- 19kトークンの日本語出力を単一ストリームで生成すると、292 tokens/s で約65秒、233 tokens/s で約82秒、151 tokens/s で約126秒、102 tokens/s で約186秒（上記速度からの計算）。バイリンガルプレビューでは「ビューポート内の見出し単位チャンクを優先・並列ストリーミング」が必須。
- 初回表示の速さ（TTFT）なら reasoning なしの GPT-6 Luna / GPT-6.1 Terra / DeepSeek V4.1 Flash、全体の書き出し速度なら Gemini 3.5 Flash-Lite / Claude Haiku 5.5 が有利。
- AA の値は reasoning 版中心で、翻訳用途（reasoning 最小）では TTFT がさらに短く、tokens/s は異なる可能性があるため、拡張機能の設定画面に実測ベンチ機能を持たせる価値がある。

### Gaps
- DeepL / Google NMT / Azure / Amazon Translate の2026年のレイテンシ実測値は見つからなかった。
- Claude 5.5 系・Gemini 3.x Flash 系の non-reasoning 版の出力速度は AA に掲載がなく未確認。
- 日本（東京）からのネットワーク往復を含む実測値は見つからなかった（AA の計測地点も未確認）。

## 9. ショートリスト: (a) 許容品質で最安、(b) 最高品質、(c) 最速のインタラクティブ体験

### Takeaway
(a) 最安: GPT-6 Luna（`none`）と Claude Haiku 5.5（低 effort）が約 $0.01/文書で双璧、次点 Gemini 3.1 / 3.5 Flash-Lite（有料枠）。(b) 最高品質: Claude Opus 5.5 / Sonnet 5.5、GPT-6.1 Sol / GPT-6 Astra、Gemini 4 Argon（いずれも翻訳品質は未検証で汎用指標ベース）、用語統一重視なら DeepL quality_optimized＋用語集。(c) 最速: TTFT は GPT-6 Luna non-reasoning（1.16 s）、出力速度は Gemini 3.5 Flash-Lite（292 tokens/s）と Claude Haiku 5.5（233 tokens/s）。

### Cited Findings
- 価格: gpt-6-luna $0.10 / $0.50、gpt-6.1-terra $1 / $5、gpt-6.1-sol $2 / $10、gpt-6-astra $10 / $50 — [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)；Claude Haiku 5.5 $0.10 / $0.50（≤100K）、Sonnet 5.5 $2 / $10、Opus 5.5 $4 / $20、Fable 5.1 $10 / $50 — [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)；Gemini 3.1 Flash-Lite $0.25 / $1.50、3.5 Flash-Lite $0.30 / $2.50、Gemini 4 Argon $2 / $10（12/1から $4 / $20） — [Gemini API Pricing](https://aistudio.google.com/docs/pricing)
- 汎用 Intelligence Index（翻訳品質ではない）: Opus 5.5 59、GPT-6 Astra 57、Sonnet 5.5 55、GPT-6.1 Sol 55、Gemini 4 Argon 50、Haiku 5.5 36 — [AA Leaderboard](https://artificialanalysis.ai/leaderboards/models)
- PFN は PLaMo翻訳が Claude Fable 5.1 / GPT-6.1 Sol / GPT-6 Astra と同等の日本語翻訳精度と主張（自社評価） — [Impress Watch](https://www.watch.impress.co.jp/docs/news/2146531.html)
- DeepL は用語集最大5個・custom_instructions・翻訳メモリ・style profile を備える — [DeepL Release notes](https://developers.deepl.com/docs/resources/roadmap-and-release-notes)；[DeepL API: Translate text](https://developers.deepl.com/api-reference/translate/request-translation)
- 速度: GPT-6 Luna non-reasoning TTFT 1.16 s、DeepSeek V4.1 Flash non-reasoning 1.32 s、GPT-6.1 Terra non-reasoning 1.64 s — [AA Leaderboard](https://artificialanalysis.ai/leaderboards/models)；Gemini 3.5 Flash-Lite 292 tokens/s — [AA](https://artificialanalysis.ai/models/gemini-3-5-flash-lite)；Claude Haiku 5.5 233 tokens/s — [AA](https://artificialanalysis.ai/models/claude-haiku-5-5)
- 構造化出力: Claude（Haiku / Sonnet / Opus 5.5）GA — [Claude Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)；Gemini は JSON Schema＋部分 JSON ストリーミング — [Gemini Structured output](https://aistudio.google.com/docs/structured-output)

### Inferences
- (a) 許容品質で最安: 第一候補 **GPT-6 Luna（reasoning `none`、約 $0.011/文書、Batch $0.005）** と **Claude Haiku 5.5（低 effort、約 $0.014/文書、構造化出力 GA、キャッシュヒット $0.01/M）**。次点 **Gemini 3.1 Flash-Lite（$0.032）/ 3.5 Flash-Lite（$0.052）**（必ず有料枠）。さらに安い DeepSeek V4.1 Flash（オフピーク $0.014）と Qwen-MT Flash（$0.007〜0.012）はデータ所在地・コンプライアンス、日本の業務時間＝ピーク料金、8K 入力上限などの制約から「オプション扱い」が妥当。
- (b) 最高品質: 実用上の推奨は **Claude Sonnet 5.5（約 $0.28/文書）または GPT-6.1 Sol（約 $0.22/文書）**、最上位は **Claude Opus 5.5（約 $0.57）/ GPT-6 Astra（約 $1.09）/ Claude Fable 5.1（約 $1.42）**、Gemini 4 Argon は12/1の倍額改定後 $0.44。用語統一・社内用語集が重要なら **DeepL（quality_optimized＋用語集＋custom_instructions、約 $1.5/文書）** を併用候補に。国産重視なら PLaMo翻訳（API 有無要確認）。いずれも英→日技術文書の独立評価がないため、自前の評価セット（見出し・表・インラインコード・リンクを含む実 README）での比較が前提。
- (c) 最速のインタラクティブ体験: 初回表示は **GPT-6 Luna non-reasoning（TTFT 1.16 s）**、品質とのバランスで **GPT-6.1 Terra `none`（1.64 s）**、全文の書き出し速度では **Gemini 3.5 Flash-Lite（292 tokens/s）/ Claude Haiku 5.5（233 tokens/s）**。お金で速度を買う選択肢として OpenAI Fast（約2倍価格）、Claude Opus 5.5 Fast mode（$8/$40）。いずれもビューポート優先のセクション並列ストリーミングと、拡張側セグメントキャッシュ（変更箇所のみ再翻訳）が体感速度を左右する。
- 実装上の既定構成案: 「既定 = 安価高速モデル（Luna / Haiku 5.5 / Flash-Lite）でプレビュー、ユーザー操作で高品質モデル（Sonnet 5.5 / GPT-6.1 Sol）に再翻訳、背景の全文翻訳は Batch / Flex」の2段構え。

### Gaps
- 3カテゴリとも英→日 Markdown 技術文書での品質の裏付けは汎用指標・ベンダー主張のみで、独立した翻訳ベンチマーク（別担当の WMT 等の調査結果と突き合わせが必要）は本調査範囲では得られなかった。
- 日本からのネットワーク遅延を含む実測 TTFT は未確認。
