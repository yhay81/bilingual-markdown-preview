# 汎用オープン小〜中規模LLMとオンデバイスAIランタイム：Apple Silicon Mac での英→日翻訳（2026年11月9日時点）

調査日: 2026-11-09。対象: 総パラメータ約1B〜35Bの汎用オープンモデル（MoE含む）、ローカル実行ランタイム、macOS/Windows の OS 標準オンデバイスAI、VS Code Webview（Electron）内のブラウザ内蔵AI。翻訳特化モデルとクラウドAPIは対象外。
表記: Swallow LLM Leaderboard の WMT20 スコアは BLEU を 0〜1 に正規化した値（0.285 = BLEU 28.5）。2026年より前の情報には「（2025年以前）」と明記する。

---

## Q1. 2026年11月時点で日本語に強いオープンモデル系列はどれか（1B〜35B級、MoE含む）

### Takeaway
2026年11月時点では、Google Gemma 4（2026-04-02公開、Apache 2.0、E2B/E4B/12B/26B-A4B/31B）と Alibaba Qwen3.5/3.6/3.8 系（Apache 2.0）の二大系列が日本語で最も強い。日本語英日翻訳では、公開評価の Swallow LLM Leaderboard で Gemma 4 がサイズ当たりで明確に優位。日本語特化の継続学習モデル（Qwen3 Swallow、GPT-OSS Swallow、LLM-jp-4、NVIDIA Nemotron Nano 9B v2 Japanese）は元モデルより翻訳が改善するが、Gemma 4 には届いていない。

### Cited Findings
**Google Gemma 4（2026年）**
- Gemma 4 は 2026-04-02 に公開。E2B、E4B、26B MoE、31B Dense の4サイズで、ライセンスは独自の Gemma Terms から Apache 2.0 に変更された — [9to5Google, 2026-04-02](https://9to5google.com/2026/04/02/google-gemma-4/)、[Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/)、[eWeek](https://www.eweek.com/news/google-gemma-4-apache-2-open-models/)
  - Swallow のデータ上の日付も 2026-04-02 — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)
- 2026-06-03 に 5番目のサイズ「Gemma 4 12B Unified」（encoder-free マルチモーダル）が追加された — [Gemma releases ページ](https://ai.google.dev/gemma/docs/releases)、[窓の杜](https://forest.watch.impress.co.jp/docs/news/2114296.html)
- Hugging Face のモデルカード（2026-11-09取得）に記載のパラメータ数は次のとおり。E2B は 5.1B（埋め込み込み、実効 2.3B）、E4B は 8B（実効 4.5B）、12B Unified は 11.95B、26B A4B は 25.2B（アクティブ 3.8B）、31B Dense は 30.7B。コンテキスト長は小型が 128K、中型以上が 256K。言語は「Out-of-the-box support for 35+ languages, pre-trained on 140+ languages」— [HF: google/gemma-4-26B-A4B-it](https://huggingface.co/google/gemma-4-26B-A4B-it)
- 同カードの MMMLU（多言語MMLU）は 31B 88.4%、26B A4B 86.3%、12B Unified 83.4%、E4B 76.6%、E2B 67.4%（参考: Gemma 3 27B（no think）70.7%）— [HF: google/gemma-4-26B-A4B-it](https://huggingface.co/google/gemma-4-26B-A4B-it)

**Alibaba Qwen3.5 / Qwen3.6 / Qwen3.8（2026年）**
- Qwen3.5 Small（0.8B/2B/4B/9B、Dense、画像入力対応）は 2026-03-02 に公開。Artificial Analysis は 9B と 4B を、それぞれのサイズ帯で最も知能スコアが高く、10B 未満の他モデルをすべて上回ると評価した（検索結果の要約による） — [Artificial Analysis, 2026-03-05](https://artificialanalysis.ai/articles/qwen3-5-small-models)、[Qwen 公式 GitHub README（2026-03-02 の項）](https://github.com/QwenLM/Qwen3.8)
- Qwen3.5 の中型（27B、35B-A3B、122B-A10B）は、公式 GitHub README によれば 2026-02-24 公開（「Qwen3.5-122B-A10B, Qwen3.5-35B-A3B, and Qwen3.5-27B are released」）。報道も 35B-A3B（総35B、アクティブ3B）を 2026-02-24 としている。2026-02-16 は Qwen3.5 シリーズ初回（397B-A17B）の公開日で、Swallow のデータは中型3モデルにもこの 2026-02-16 を記載している — [Qwen 公式 GitHub README（2026-11-09 取得）](https://github.com/QwenLM/Qwen3.8)、[NYU Shanghai RITS（Qwen 3.5 Medium Series）](https://rits.shanghai.nyu.edu/ai/qwen-3-5-medium-series-frontier-ai-that-fits-on-your-gpu/)、[Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)
- Qwen3.5-9B モデルカード（2026-11-09取得）の記載: Apache-2.0、「Expanded support to 201 languages and dialects」、ネイティブ 262,144 トークン（YaRN で 1,010,000 まで拡張可）、thinking は既定でオン。無効化は `chat_template_kwargs: {"enable_thinking": False}` で行い、Qwen3 の `/think` `/nothink` ソフトスイッチは公式には非対応 — [HF: Qwen/Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B)
- Qwen3.6: 35B-A3B は 2026-04-16、27B は 2026-04-22 に Hugging Face/ModelScope で公開（公式 GitHub README の記載。二次情報 noze.it は 35B-A3B を 4月17日としている） — [Qwen 公式 GitHub README](https://github.com/QwenLM/Qwen3.8)、[noze.it](https://www.noze.it/en/insights/qwen-3-6/)
  - 旧リポジトリ github.com/QwenLM/Qwen3.6 は、2026-11-09 時点で QwenLM/Qwen3.8 にリダイレクトされる（本調査環境で確認）。同じ README に Qwen3.5〜3.8 の公開履歴が載っている — [Qwen 公式 GitHub README](https://github.com/QwenLM/Qwen3.8)
- Qwen3.6-35B-A3B カードの記載: 総35B・アクティブ3B、262,144 トークン（最大 1,010,000）、Apache-2.0、thinking 既定オン、「Qwen3.6 does not officially support the soft switch of Qwen3」— [HF: Qwen/Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B)
- Qwen3.8-27B（ネイティブマルチモーダルの Dense 27B）は 2026-08-14 に Apache 2.0 でオープンウェイト公開。ネイティブ約262K トークン（YaRN で1M）、thinking 既定オン。巨大な Qwen3.8-2.4T-A95B は、公式 README 上はその2日前の 2026-08-12 に公開 — [The Decoder, 2026-08-14](https://the-decoder.com/alibabas-qwen-team-releases-qwen-3-8-models-with-open-weights-under-the-apache-2-0-license/)、[eWeek](https://www.eweek.com/news/alibaba-qwen3-8-27b-license-apac-china/)、[Qwen 公式 GitHub README](https://github.com/QwenLM/Qwen3.8)
  - Qwen3.8 の小型（≦10B）や 35B-A3B 相当は見つからなかった。Qwen3.7 は API 専用の「Qwen3.7-Plus」が比較対象として言及されるのみ — [The Decoder](https://the-decoder.com/alibabas-qwen-team-releases-qwen-3-8-models-with-open-weights-under-the-apache-2-0-license/)

**OpenAI gpt-oss（2025年以前）と後継**
- gpt-oss-20b / gpt-oss-120b は 2025-08-05 公開（2025年以前）。Apache 2.0 — [TechCrunch, 2025-08-05](https://www.techcrunch.com/2025/08/05/openai-launches-two-open-ai-reasoning-models)
- 総パラメータとアクティブパラメータは、gpt-oss-20b が 22B（3.6B）、gpt-oss-120b が 120B（5.1B）（Swallow の記載）— [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)
- 2026年に OpenAI が新しいオープンウェイトモデルを出したという情報は、検索では見つからなかった（Gaps 参照）— [検索結果: TechCrunch 等は2025年のリリースのみ](https://www.techcrunch.com/2025/08/05/openai-launches-two-open-ai-reasoning-models)

**日本発・日本語強化モデル（2026年）**
- Qwen3 Swallow（8B、30B-A3B、32B、推論型、Apache 2.0）と GPT-OSS Swallow（20B、120B）は、2026-02-20 に東京科学大学・産総研が公開 — [Swallow: Qwen3 Swallow, 2026-02-20](https://swallow-llm.github.io/qwen3-swallow.en)、[GIGAZINE, 2026-02-24](https://gigazine.net/news/20260224-gptoss-qwen3-swallow-japanese-ai/)
- Qwen3.5 や Gemma 4 をベースにした Swallow の新モデルは、2026-11-09 時点の検索では見つからなかった — [Swallow LLM Leaderboard 変更履歴](https://swallow-llm.github.io/leaderboard/about.en.html)
- LLM-jp-4（NII）は 2026-04-03 に公開。8B は Dense（約8.6B、Llama 2 アーキテクチャ）、32B-A3B は Qwen3 MoE アーキテクチャで128エキスパート中8アクティブ、約3.8B アクティブ。最大約65,000トークン、学習コーパスは約12兆トークン。Japanese MT-Bench（GPT-5.4 判定）は 8B が 7.54、32B-A3B が 7.82（比較対象は GPT-4o 7.29、gpt-oss-20b 7.33、Qwen3-8B 7.14） — [NII ニュースリリース, 2026-04-03](https://www.nii.ac.jp/en/news/release/2026/0403.html)
  - 二次情報によれば、その後 2026年8月に LLM-jp-4 33B、9月に LLM-jp-4-VL 9B と LLM-jp-4.1 が出たとされる（一次情報は未確認）— [AI Revolution（解説記事）](https://ai-revolution.co.jp/media/llm-jp-4-33b/)
- NVIDIA-Nemotron-Nano-9B-v2-Japanese（8.9B、2026-02-17）は Swallow に掲載されている — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)
  - 二次情報では、Nejumi Leaderboard 4 の10B未満クラスで1位とされる — [lilting.ch, 2026-04-08（2026-05-20更新）](https://lilting.ch/en/articles/japanese-llm-options-compared)
- SB Intuitions Sarashina2.2（0.5B/1B/3B、2025-03-07、2025年以前）は Swallow に掲載されているが、2026年の新しいオープンモデルは確認できなかった — [Swallow 変更履歴/モデル一覧](https://swallow-llm.github.io/leaderboard/about.en.html)、[codenote（解説）](https://codenote.net/ja/posts/japanese-local-llm-development-case-studies/)
- PFN の PLaMo 3 NICT 2B/8B/31B は Base モデルのみ（2025-11-14、2025年以前）。二次情報では PLaMo 2.2 Prime 31B（2026-01）が「PLaMo Community」ライセンスとされる — [Swallow 変更履歴](https://swallow-llm.github.io/leaderboard/about.en.html)、[codenote（解説）](https://codenote.net/ja/posts/japanese-local-llm-development-case-studies/)
- ELYZA: ELYZA-Shortcut-1.0-Qwen-32B と ELYZA-Thinking-1.0-Qwen-32B（2025-05-01、2025年以前）が Swallow に掲載。二次情報では 2026年1月に ELYZA-LLM-Diffusion が公開されたとされる — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)、[codenote](https://codenote.net/ja/posts/japanese-local-llm-development-case-studies/)
- Sakana AI の TinySwallow-1.5B（2025-01-30、2025年以前）は、Swallow では事前学習モデル枠にのみ掲載されている — [Swallow 変更履歴/モデル一覧](https://swallow-llm.github.io/leaderboard/about.en.html)
- NTT tsuzumi 2 は 2025-10-20 に提供開始（2025年以前）。2026-05-19 にアップデート版を NTT グループ各社経由で順次提供すると発表された。オープンウェイト公開の情報は見つからなかった — [@IT, 2025-10-23](https://atmarkit.itmedia.co.jp/ait/spv/2510/23/news048.html)、[NTT ニュースリリース, 2026-05-19（PDF）](https://group.ntt/jp/newsrelease/2026/05/19/pdf/260519aa.pdf)
- Liquid AI: 日本語特化の LFM2.5-1.2B-JP の 2026年6月版（LFM2.5-1.2B-JP-202606）。LFM3（約1.7B〜2B級、日本語を含む16言語）も公開された — [Liquid AI 関連報道（2026-06-05）](https://aeo.washinmura.jp/ai/liquid-ai%E6%A0%AA%E5%BC%8F%E4%BC%9A%E7%A4%BE/en/news/2026-06-05-liquid-ai-%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%81%A7%E6%9C%80%E9%AB%98%E6%B0%B4%E6%BA%96%E3%81%AE%E6%80%A7%E8%83%BD%E3%82%92%E6%8C%81%E3%81%A4%E5%B0%8F%E8%A6%8F%E6%A8%A1%E8%A8%80%E8%AA%9E%E3%83%A2%E3%83%87%E3%83%AB%E3%81%A8%E9%9F%B3%E5%A3%B0%E3%83%A2%E3%83%87%E3%83%AB%E3%82%92%E5%85%AC)、[Liquid AI: LFM3](https://www.liquid.ai/ja/blog/lfm3)
  - Ollama は v0.40.12（10月27日）で LFM3 に対応した — [Ollama releases](https://github.com/ollama/ollama/releases)

**Mistral / Microsoft Phi / Meta Llama**
- Mistral の Ministral 3（3B/8B/14B）は 2025-12-02 公開（2025年以前）。各サイズに base/instruct/reasoning があり、画像理解対応、Apache 2.0、40以上の言語 — [Mistral AI: Introducing Mistral 3](https://mistral.ai/news/mistral-3)
  - LM Studio のモデルページは対応言語に日本語を挙げている — [LM Studio: Ministral](https://www.lmstudio.ai/models/ministral)
- Mistral Large 4（2026年10月）は大型モデルで、本スコープ外。オープンウェイト化の日付は情報源によって食い違う — [Best LLMs of October 2026（二次）](https://futureagi.com/blog/best-llms-october-2026/)
- Microsoft Phi: Phi-5 の発表は確認できなかった。2026年3月の Phi-4-reasoning-vision-15B 以外に、2026年の新しい Phi は見つからなかった — [NYU Shanghai RITS（Phi-4-reasoning-vision-15B）](https://rits.shanghai.nyu.edu/ai/microsoft-releases-phi-4-reasoning-vision-15b-small-model-big-vision/)
- Meta: 2026年のオープンウェイト公開は情報源の間で矛盾している。Llama 5（600B 超の MoE）が2026年4月に公開されたとする記事と、Llama 5 は存在せず Meta の最上位オープンモデルは今も Llama 4 Maverick だとする記事がある。小型では 30B の Muse Glimmer がオープンウェイトで出たとする記事もあるが、いずれも低品質な二次情報 — [mer.vin](https://mer.vin/news/muse-glimmer-30b-is-metas-first-open-weight-model-since-llama-4/)、[andrew.ooo（2026年6月）](https://andrew.ooo/answers/meta-llama-closing-muse-spark-pivot-vs-open-source-june-2026/)
- Llama 4 Scout（109B、アクティブ17B、2025-04-04、2025年以前）は総パラメータが本スコープを超える — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)

### Inferences
- 「日本語に強い汎用小〜中型」の主役は 2026年11月時点で Gemma 4 系と Qwen3.5/3.6/3.8 系。英日翻訳の公開評価（Q2）は Gemma 4 の優位を示す。Qwen 系は技術用語や推論での評価が高いが、翻訳の公開データは Qwen3.5 までしかない。
- 日本語継続事前学習（Swallow）はベースモデルの英日翻訳を改善する（Q2 の数値）。ただし Swallow 化された最新ベースは Qwen3 と gpt-oss で、2026年4月以降の Gemma 4 / Qwen3.6 / 3.8 ベースのものはまだ出ていない。
- 国産スクラッチ系（LLM-jp-4、PLaMo、Sarashina）は、ライセンスやデータの透明性に利点がある。ただし英日翻訳品質と小型での実用性では、Gemma 4 / Qwen 系を上回る公開エビデンスはない。

### Gaps
- Qwen3.6（27B/35B-A3B）、Qwen3.8-27B、Gemma 4 12B Unified の日本語翻訳ベンチマーク（Swallow/Nejumi の WMT や COMET）は見つからなかった。Swallow の最終更新は 2026-05-08 で、これらは未掲載。
- OpenAI の2026年の新しいオープンウェイトモデル、Meta の2026年の小型オープンモデル、Phi の2026年新世代については、一次情報を確認できなかった。
- Sarashina・PLaMo・ELYZA の2026年オープンモデルについて、一次情報（公式リリースやモデルカード）にはたどり着けなかった。tsuzumi 2 の重み公開の有無も公式資料で確認できなかった。
- 検索ツールの要約に、Gemma 4 系の初回公開を 2026-03-31 とする記述があったが、出典を特定できなかった。9to5Google、Google blog、Swallow データはいずれも 2026-04-02。

---

## Q2. 英日翻訳品質のエビデンス（Swallow / Nejumi / ベンダー値 / コミュニティ）

### Takeaway
最も直接的な公開エビデンスは Swallow LLM Leaderboard v2 の WMT20 en-ja（BLEU、ゼロショット CoT プロンプト、2026-02-20 追加、2026-05-08 更新）。オープンモデルでは Gemma 4 31B（0.285）と 26B-A4B（0.280）が首位で、GPT-5.4 Thinking（0.272）や GPT-5（0.272）を上回る。小型でも Gemma 4 E4B（0.261）と E2B（0.256）が Qwen3.5-27B（0.252）や gpt-oss-20b（0.234）より高い。Nejumi Leaderboard 4 は翻訳サブスコアを取得できなかった。

### Cited Findings
**Swallow LLM Leaderboard v2（東京科学大学ほか）の評価設定**
- 2026-02-20 に、事後学習モデル向けベンチマークへ「Japanese-English and English-Japanese translation (WMT20)」が追加された — [Swallow LLM Leaderboard: About/Change log](https://swallow-llm.github.io/leaderboard/about.en.html)
- 2026-05-08 の更新内容:
  - 評価基盤を swallow-evaluation-instruct v202604 に更新した。
  - 推論モデルは確率的デコード（temperature 0.6、top-p 0.95）、非推論モデルは greedy で評価する。
  - GPT-5.4、Qwen 3.5、Gemma 4、llm-jp-4 を追加した。
  - M-IFEval-Ja を平均スコアに算入した。
  - [Swallow LLM Leaderboard: Change log](https://swallow-llm.github.io/leaderboard/about.en.html)
- WMT20 タスクの定義: 指標は「BLEU」（field `wmt20_en_ja_bleu`）、入力は「zero-shot, chain-of-thought prompt」、題材はニュース記事 — [Swallow データ（g_tasks）](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)

**Swallow v2 の WMT20 スコア（2026-11-09 取得）**
- 下表の値はすべて Swallow のデータファイルから抽出した。列は WMT20 en-ja / ja-en / 日本語平均（Ja avg）/ Japanese MT-Bench 平均 / M-IFEval-Ja、括弧内は総パラメータ（アクティブ）と Swallow 上の日付 — [Swallow LLM Leaderboard v2 データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)、[一覧ページ](https://swallow-llm.github.io/leaderboard/index-post.en.html)

  | モデル（Swallow 上の日付） | en-ja | ja-en | Ja avg | Ja MTB | M-IFEval-Ja |
  |---|---|---|---|---|---|
  | Gemma 4 31B IT（2026-04-02） | **0.285** | 0.260 | 0.675 | 0.815 | 0.898 |
  | Gemma 4 26B-A4B IT（2026-04-02） | **0.280** | 0.261 | 0.646 | 0.806 | 0.867 |
  | GPT-5.4 Thinking（参考、2026-03-05） | 0.272 | 0.249 | 0.717 | 0.844 | 0.881 |
  | Qwen3.5-122B-A10B（2026-02-16、スコープ外の参考） | 0.263 | 0.247 | 0.640 | 0.778 | 0.774 |
  | gpt-oss-120b（2025-08-05、参考） | 0.262 | 0.208 | 0.566 | 0.757 | 0.735 |
  | Gemma 4 E4B IT（2026-04-02） | **0.261** | 0.228 | 0.484 | 0.758 | 0.637 |
  | Gemma 4 E2B IT（2026-04-02） | **0.256** | 0.227 | 0.431 | 0.726 | 0.646 |
  | Qwen3.5-27B（2026-02-16） | 0.252 | 0.241 | 0.621 | 0.784 | 0.735 |
  | Qwen3.5-35B-A3B（36B/3B、2026-02-16） | 0.250 | 0.239 | 0.604 | 0.760 | 0.659 |
  | Gemma 3 27B IT（2025-03-12、2025年以前） | 0.250 | 0.238 | 0.437 | 0.691 | 0.597 |
  | GPT-OSS-Swallow-20B-RL-v0.1（2026-02-20） | 0.248 | 0.210 | 0.568 | 0.726 | 0.673 |
  | Qwen3-Swallow-32B-RL-v0.2（2026-02-20） | 0.247 | 0.215 | 0.555 | 0.753 | 0.659 |
  | ELYZA-Shortcut-1.0-Qwen-32B（2025-05-01） | 0.245 | 0.228 | 0.443 | 0.675 | 0.633 |
  | Qwen3-Swallow-30B-A3B-RL-v0.2（2026-02-20） | 0.239 | 0.209 | 0.546 | 0.741 | 0.602 |
  | llm-jp-4-32b-a3b-thinking（2026-04-03） | 0.235 | 0.190 | 0.471 | 0.726 | 0.668 |
  | gpt-oss-20b（22B/3.6B、2025-08-05） | 0.234 | 0.205 | 0.521 | 0.716 | 0.726 |
  | Qwen3-14B（2025-04-29） | 0.228 | 0.219 | 0.524 | 0.712 | 0.611 |
  | llm-jp-4-8b-thinking（2026-04-03） | 0.227 | 0.189 | 0.448 | 0.706 | 0.677 |
  | Gemma 3 12B IT（2025-03-12） | 0.225 | 0.229 | 0.405 | 0.659 | 0.619 |
  | Qwen3-Swallow-8B-RL-v0.2（2026-02-20） | 0.222 | 0.201 | 0.510 | 0.710 | 0.566 |
  | NVIDIA-Nemotron-Nano-9B-v2-Japanese（2026-02-17） | 0.207 | 0.196 | 0.503 | 0.689 | 0.637 |
  | Qwen3-8B（2025-04-29） | 0.202 | 0.201 | 0.491 | 0.689 | 0.611 |
  | Llama 3.1 8B Instruct（2024-07-23） | 0.187 | 0.194 | 0.279 | 0.446 | 0.381 |
  | Gemma 3 4B IT（2025-03-12） | 0.186 | 0.189 | 0.292 | 0.572 | 0.473 |
  | Qwen3-30B-A3B（2025-04-29） | 0.177 | 0.215 | 0.522 | 0.722 | 0.664 |
  | Qwen3.5-9B（2026-03-02） | 0.174 | 0.209 | 0.534 | 0.707 | 0.518 |
  | Qwen3.5-4B（2026-03-02） | 0.080 | 0.147 | 0.456 | 0.618 | 0.456 |
  | Sarashina2.2 3B Instruct v0.1（2025-03-07） | 0.002 | 0.160 | 0.260 | 0.562 | 0.288 |
  | Qwen3.5-2B / 0.8B（2026-03-02） | 0.000 | ≒0 | 0.172 / 0.128 | 0.391 / 0.248 | 0.332 / 0.261 |

- 表の日付は Swallow データ上の値。Qwen3.5 中型（27B / 35B-A3B / 122B-A10B）の公式公開日は 2026-02-24 — [Qwen 公式 GitHub README](https://github.com/QwenLM/Qwen3.8)
- 表の値は 2026-11-09 に Swallow のデータファイルから再抽出し、全行を照合済み。
- 同データでは、Swallow の継続学習によって英日 BLEU が上がっている。Qwen3-30B-A3B 0.177 → Qwen3-Swallow-30B-A3B-RL 0.239、Qwen3-8B 0.202 → Qwen3-Swallow-8B-SFT 0.228、gpt-oss-20b 0.234 → GPT-OSS-Swallow-20B-RL 0.248 — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)
- データ上、Gemma 4 26B-A4B の params/active_params はどちらも「27」と記録されている。モデルカード上は総 25.2B・アクティブ 3.8B — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)、[HF: gemma-4-26B-A4B-it](https://huggingface.co/google/gemma-4-26B-A4B-it)

**ベンダー公表値**
- Qwen3.5 の WMT24++（55言語平均、XCOMET-XXL）は 9B が 72.6、4B が 66.6。MMMLU は 9B 81.2 / 4B 76.1、MMLU-ProX（29言語）は 9B 76.3 / 4B 71.5 — [HF: Qwen/Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B)
- Gemma 4 のモデルカードに WMT24++ の記載はなく、多言語指標は MMMLU（上記 Q1）のみ — [HF: google/gemma-4-26B-A4B-it](https://huggingface.co/google/gemma-4-26B-A4B-it)
- Qwen3.6-35B-A3B のカードに多言語・翻訳ベンチマーク（WMT24++、MMMLU など）の記載はない — [HF: Qwen/Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B)
- LLM-jp-4 の NII 発表に翻訳タスクの結果は含まれない（MT-Bench と llm-jp-eval のみ）— [NII, 2026-04-03](https://www.nii.ac.jp/en/news/release/2026/0403.html)

**Nejumi LLM Leaderboard（W&B Japan）**
- Nejumi Leaderboard 4 のレポートページは「Last updated: October 2, 2026」。表データはテキストとして取得できなかった — [Nejumi LLM Leaderboard 4（W&B → forge.coreweave.com にリダイレクト）](https://wandb.ai/llm-leaderboard/nejumi-leaderboard4/reports/Nejumi-LLM-Leaderboaed-4--VmlldzoxNDQyMzkxMA)
- 検索結果の抜粋では、評価カテゴリに「GLP_翻訳」「AVG_jaster_0shot/2shots」が含まれていることを確認した（数値は未取得）— [Nejumi LLM Leaderboard 4](https://wandb.ai/llm-leaderboard/nejumi-leaderboard4/reports/Nejumi-LLM-Leaderboaed-4--VmlldzoxNDQyMzkxMA)
- Classmethod（2026-07-24）は、Nejumi Leaderboard 4（2026年7月版）を引用して次のように書いている（いずれも総合スコアで、翻訳サブスコアはない）— [DevelopersIO, 2026-07-24](https://dev.classmethod.jp/en/articles/local-llm-guide-2026-summer/)
  - Gemma 4 31B は「31B is 3rd among open models (0.8077)」
  - Qwen3.6/3.5 27B クラスは「exceeds 0.80」
- 二次情報: Nejumi 4 の10B以下クラスでは Qwen3.5 の最高スコアが 0.711、Nemotron Nano 9B JP が「#1 in sub-10B」とされる（スコア記載なし）— [lilting.ch](https://lilting.ch/en/articles/japanese-llm-options-compared)

**コミュニティ実測**
- Zenn（2026-05-23）の検証環境は Mac mini M4 Pro 48GB + Ollama。作者は gemma4:26b-mlx を会話用、qwen3.6:35b-a3b-nvfp4 をタスク処理用の候補に選んだ。gemma4:26b-mlx は e4b-mlx より「応答品質も明確に上」としている。翻訳タスクの評価はない — [Zenn: Mac mini M4 Pro 48GBでローカルLLM比較, 2026-05-23](https://zenn.dev/rscstd/articles/3e71a66e276873)
- 日本語の比較記事には「専門文書の分析はQwen・スピード重視の日常業務はGemma」という使い分けの見解がある。ただし編集部の見解で、実測ではない — [aiagent-navi（Gemma 4比較）](https://aiagent-navi.com/generation-ai/gemma-4-model-comparison/)
- 2026年の英日翻訳に特化した、Mac ローカルでの公開比較（Gemma 4 vs Qwen3.5/3.6 の翻訳品質）は検索では見つからなかった — [検索結果の要約元: codersera ほか](https://codersera.com/blog/gemma-4-vs-qwen-3-5-comparison-2026/)

### Inferences
- WMT20 BLEU はニュース文での表層一致指標にすぎず、0.01 程度の差はノイズの範囲と見るべき。それでも、Gemma 4 E2B/E4B（実効 2.3B/4.5B）が Qwen3.5-27B と同等以上という傾向ははっきりしており、「メモリ当たりの英日品質」では Gemma 4 系が最有力と言える。
- Qwen3.5-9B（0.174）や 4B（0.080）の低さは、ベンダーの WMT24++（9B 72.6）と食い違う。Swallow は推論オンかつ CoT プロンプトで評価しており、推論出力の混入や指示追従の失敗による過小評価の可能性がある。拡張機能では thinking をオフにした実測で再評価する必要がある。
- Sarashina2.2 3B（0.002）や llm-jp-3.1（0.007）は、翻訳能力の欠如というより出力形式の失敗を示すと考えられる。いずれにせよ、ゼロショットで素直に訳文だけを返す用途には不向き。
- Markdown 構造の保持には指示追従力が効くはずで、その代理指標として M-IFEval-Ja を見ると、Gemma 4 31B（0.898）、26B-A4B（0.867）、Qwen3.5-27B（0.735）、gpt-oss-20b（0.726）が高い。

### Gaps
- Nejumi Leaderboard 4 の翻訳サブスコア（GLP_翻訳）の具体値と、評価データセットや指標（COMET か BLEU か）は取得できなかった（W&B レポートが動的描画のため）。
- 技術文書（README など Markdown）の英日翻訳に特化した公開評価は見つからなかった。WMT20 はニュースドメイン。
- Qwen3.6 / Qwen3.8-27B / Gemma 4 12B の英日翻訳の定量評価は見つからなかった。

---

## Q3. ライセンス（商用利用・再配布）

### Takeaway
主要候補（Gemma 4、Qwen3.5/3.6/3.8、gpt-oss、Ministral 3、Qwen3 Swallow）はいずれも Apache 2.0 で、商用利用も再配布も可能。Gemma は Gemma 4 で独自規約から Apache 2.0 に移ったため、Gemma 3 以前と条件が異なる。国産・その他モデルには独自ライセンスのものがあり、要確認。

### Cited Findings
- Gemma 4 は Apache 2.0。それ以前の Gemma 規約には利用禁止シナリオやアクセス停止権があった — [eWeek](https://www.eweek.com/news/google-gemma-4-apache-2-open-models/)、[9to5Google, 2026-04-02](https://9to5google.com/2026/04/02/google-gemma-4/)
- Qwen3.5（例: 9B）は Apache-2.0 — [HF: Qwen/Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B)
- Qwen3.6-35B-A3B は Apache-2.0 — [HF: Qwen/Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B)
  - 現行の公式 GitHub README（2026-11-09 取得）は、ライセンスについて「Please find the license file released with the model weights on Hugging Face Hub or ModelScope」とだけ記している。モデルごとにカードで確認する必要がある — [Qwen 公式 GitHub README](https://github.com/QwenLM/Qwen3.8)
- Qwen3.8-27B は Apache 2.0（2026-08-14）。eWeek は、より上位の Max モデル側にはライセンス上の制限が加わったと報じている — [The Decoder](https://the-decoder.com/alibabas-qwen-team-releases-qwen-3-8-models-with-open-weights-under-the-apache-2-0-license/)、[eWeek](https://www.eweek.com/news/alibaba-qwen3-8-27b-license-apac-china/)
- gpt-oss-20b/120b は Apache 2.0（2025-08-05、2025年以前）— [TechCrunch](https://www.techcrunch.com/2025/08/05/openai-launches-two-open-ai-reasoning-models)
- Ministral 3 は Apache 2.0（2025-12-02、2025年以前）— [Mistral AI](https://mistral.ai/news/mistral-3)
- Qwen3 Swallow は Apache 2.0（2026-02-20）— [Swallow: Qwen3 Swallow](https://swallow-llm.github.io/qwen3-swallow.en)
- LLM-jp-4 について、NII の発表文は「open-source license」とだけ記している。二次情報は Apache 2.0 としている — [NII, 2026-04-03](https://www.nii.ac.jp/en/news/release/2026/0403.html)、[AI Revolution](https://ai-revolution.co.jp/media/llm-jp-4-33b/)、[lilting.ch](https://lilting.ch/en/articles/japanese-llm-options-compared)
- その他のライセンス（いずれも二次情報）— [lilting.ch](https://lilting.ch/en/articles/japanese-llm-options-compared)、[codenote](https://codenote.net/ja/posts/japanese-local-llm-development-case-studies/)
  - NVIDIA-Nemotron-Nano-9B-v2-Japanese: 「NVIDIA Open Model」ライセンス
  - LFM2.5-1.2B-JP: 「LFM Open License」
  - PLaMo 2.2 Prime: 「PLaMo Community」ライセンス
  - Sarashina2 系: MIT

### Inferences
- VS Code 拡張がモデルを同梱せず、ユーザーに Ollama や LM Studio で取得させる構成なら、再配布の論点は小さい。拡張にウェイトを同梱・自動ダウンロードする場合は、Apache 2.0 系（Gemma 4 / Qwen / gpt-oss / Ministral 3）が扱いやすい。
- NVIDIA Open Model License、LFM Open License、PLaMo Community License には、売上規模や用途の条件が付く可能性がある。採用前に原文を確認すべき。

### Gaps
- GPT-OSS Swallow、LLM-jp-4、Nemotron Nano 9B v2 Japanese、LFM2.5/LFM3、PLaMo 2.2 Prime、Sarashina2.2 のライセンス原文（商用条件）は一次情報で確認できなかった。
- Phi 系の2026年モデルのライセンスも未確認。

---

## Q4. ローカル実行ランタイム（Ollama / LM Studio / llama.cpp / MLX-LM 等）と速度・所要時間

### Takeaway
2026年11月時点の Mac では、Ollama（0.40 以降、対応アーキテクチャは MLX が既定）と LM Studio（0.4 系、MLX エンジンと headless の llmster）が、非専門家にも扱える OpenAI 互換ローカルサーバーの二強。llama.cpp の llama-server は JSON スキーマ制約や並列スロットに強い上級者向け。mlx_lm.server は開発用途。

速度は、MoE（Qwen3.5/3.6-35B-A3B、Gemma 4 26B-A4B）が「大モデル品質 × 小モデル速度」を実現している。MLX 化した Ollama では Qwen3.5-35B-A3B で decode 112〜134 tok/s の公表値がある。3,000語の Markdown（出力約6,000トークンと仮定）は、ハイエンドの MoE なら約1分、16GB の M4 + 12B dense なら約10分が目安。

### Cited Findings
**Ollama**
- 2026-03-30: Ollama 0.19 で、Apple Silicon 上の MLX ベース実行がプレビュー導入された。
  - 公表値（Qwen3.5-35B-A3B）: 0.18（Q4_K_M）の prefill 1154 / decode 58 tok/s に対し、0.19（NVFP4）は 1810 / 112 tok/s、int4 では 1851 / 134 tok/s。
  - プレビューは「a Mac with more than 32GB of unified memory」を要件とした。
  - M5 / M5 Pro / M5 Max の GPU Neural Accelerators を活用する。
  - [Ollama blog: MLX, 2026-03-30](https://ollama.com/blog/mlx)
  - 二次情報は、この比較を M5 クラスでの 58→112 tok/s としている — [levelup.gitconnected（二次）](https://levelup.gitconnected.com/ollama-mlx-nearly-doubles-llm-speed-on-your-mac-58-to-112-tok-s-and-your-old-models-get-none-of-fd1a9ec531fb)
- 2026-06-11: MLX エンジンが更新された。NVFP4 は更新後のエンジンで q4_K_M より約20%速く、エンジン全体でも「up to 20% faster」。例として `gemma4:12b-mlx` を使用し、デモ機は MacBook Pro M5 Max — [Ollama blog: MLX performance, 2026-06-11](https://ollama.com/blog/mlx-performance)
- 2026-09-25: Ollama 0.40 で、対応アーキテクチャ（qwen3.8、gemma4、qwen3.6、qwen3.5 ほか）は Apple Silicon 上で MLX が既定になった。Linux/Windows は llama.cpp が既定のまま。`ollama ps` の RUNNER 列で実行エンジンを確認できる — [jacar.es, 2026-10-21（11-02更新、二次）](https://jacar.es/?p=7672)
- 最新版は v0.40.15（11月3日）。v0.40.12（10月27日）で「Faster prompt processing on Apple silicon for Gemma 4」と MLX/llama.cpp の更新、v0.40.14 で「OpenAI-compatible endpoints no longer override a model's packaged sampler defaults」の修正が入った — [Ollama GitHub releases](https://github.com/ollama/ollama/releases)
- OpenAI 互換 API — [Ollama docs: OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)
  - エンドポイント: `/v1/chat/completions`、`/v1/responses`（stateless のみ）、`/v1/completions`、`/v1/models`、`/v1/embeddings`
  - ストリーミング対応。`response_format`（JSON mode）対応
  - base URL は `http://localhost:11434/v1/`
- モデルのダウンロードサイズ（Ollama ライブラリ、2026-11-09取得）
  - gemma4: e2b 4.3〜7.5GB（qat 4.3GB）、e4b 6.1〜9.5GB（qat 6.1GB、q4_K_M 6.6GB、mlx 9.5GB）、12b 7.2〜8.0GB（qat 7.2GB）、26b-a4b 16〜19GB（nvfp4 16GB、q4_K_M 18GB、mlx 18GB）、31b 19〜20GB — [Ollama: gemma4 tags](https://ollama.com/library/gemma4/tags)
  - qwen3.5: 4b 3.3〜4.0GB、9b 6.6〜7.6GB、27b 16〜20GB、35b-a3b 20〜22GB（int4 20GB、nvfp4 22GB）、122b-a10b 81GB — [Ollama: qwen3.5 tags](https://ollama.com/library/qwen3.5/tags)

**LM Studio**
- LM Studio 0.4.0（2026-01-28）で次の機能が入った — [LM Studio 0.4.0 changelog, 2026-01-28](https://lmstudio.ai/changelog/lmstudio-v0.4.0)、[LM Studio blog 0.4.0](https://lmstudio.ai/blog/0.4.0)
  - 並列リクエスト
  - GUI なしで動く headless デーモン「llmster」（`lms daemon up`）
  - 新しい stateful REST API
  - macOS で `lms runtime update mlx` による MLX ランタイム更新
- 0.4.2（2026-02-06）で、MLX エンジンにも continuous batching（mlx-engine 1.0.0）が入った — [LM Studio 0.4.2, 2026-02-06](https://lmstudio.ai/changelog/lmstudio-v0.4.2)
- 0.4.22（2026-08-28）は確認できた最新の 0.4.x — [LM Studio 0.4.22](https://www.lmstudio.ai/changelog/lmstudio/lmstudio-v0.4.22)
- OpenAI 互換エンドポイント（例は `http://localhost:1234/v1`）— [LM Studio docs: OpenAI compat](https://lmstudio.ai/docs/developer/openai-compat)
  - `GET /v1/models`、`POST /v1/responses`、`POST /v1/chat/completions`、`POST /v1/embeddings`、`POST /v1/completions`（ほかに `/v1/decisions`）
- Structured Output: `response_format` に `"type": "json_schema"` を指定する。GGUF は llama.cpp の grammar、MLX は Outlines で実装される。「Not all models are capable of structured output, particularly LLMs below 7B parameters」— [LM Studio docs: Structured Output](https://lmstudio.ai/docs/developer/openai-compat/structured-output)

**llama.cpp（llama-server）／MLX-LM**
- llama-server（README、2026-11-09取得）の機能 — [llama.cpp tools/server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
  - 「OpenAI API compatible chat completions, responses, and embeddings routes」と Anthropic Messages 互換
  - SSE ストリーミング
  - 「Schema-constrained JSON response format」（`json_schema`、`grammar`）
  - 「Parallel decoding with multi-user support」と「Continuous batching」
  - `--models-dir` によるルーター（複数モデル）モード
  - 既定のリッスン先は README 上 `127.0.0.1:9931`（従来の既定値と異なる可能性があり、要確認）
- mlx_lm.server — [mlx-lm SERVER.md](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/SERVER.md)
  - 「intended to be similar to the OpenAI chat API」で、`/v1/chat/completions` と `/v1/models` を持つ
  - `stream` 対応、既定ポートは 8080
  - 「not recommended for production as it only implements basic security checks」
  - JSON スキーマ機能の記載はない

**速度の実測・公表値**
- llama.cpp の Apple Silicon ベンチ（Llama 2 7B、Q4_0、tg128 = 生成 tok/s、pp512 = プロンプト処理 tok/s）。スレッドは 2023-11-22 開始で、2026-08-25 に M5 以降向けの手順が更新された。新旧の行は直接比較できない旨の注記あり — [llama.cpp Discussion #4167](https://github.com/ggml-org/llama.cpp/discussions/4167)

  | チップ（帯域） | tg128 | pp512 |
  |---|---|---|
  | M1（68GB/s） | 14.2 | 108〜118 |
  | M2（100GB/s） | 21.7 | 146〜180 |
  | M3（100GB/s） | 21.3 | 187 |
  | M4（120GB/s、10コアGPU） | 24.1 | 221 |
  | M4 Pro（273GB/s） | 49.6〜50.7 | 364〜440 |
  | M4 Max（410〜546GB/s） | 70.0〜83.1 | 714〜886 |
  | M5 Pro（307GB/s） | 66.3〜67.6 | 1340〜1621 |
  | M5 Max（614GB/s、40コア） | 119.9 | 3220 |
  | M5 Ultra（1228GB/s） | 179.1 | 4945 |

  - M5（10コア）は Q4_0 の値がなく、Q8_0 の tg が 31.9
- Apple ML Research（2025-11-19、2025年以前）。MacBook Pro M5 24GB と M4 を、`mlx_lm.generate`、4096 トークンのプロンプトで比較した — [Apple ML Research: Exploring LLMs with MLX and the Neural Accelerators in the M5 GPU, 2025-11-19](https://machinelearning.apple.com/research/exploring-llms-mlx-m5)
  - M5 の M4 に対する生成速度の向上は 1.19〜1.27倍、TTFT の短縮は最大約4倍
  - M5 で dense 14B の TTFT は「under 10 seconds」、30B MoE は 3秒未満
  - メモリ使用量: Qwen3-8B 4bit 5.61GB、Qwen3-14B 4bit 9.16GB、gpt-oss-20b MXFP4 12.08GB、Qwen3-30B-A3B 4bit 17.31GB
- DevelopersIO（2026-07-24）の Mac mini M4 16GB 実測: Gemma 4 12B QAT（Ollama）11.26 tok/s、Nemotron 9B（LM Studio）9.29 tok/s — [DevelopersIO, 2026-07-24](https://dev.classmethod.jp/en/articles/local-llm-guide-2026-summer/)
- Zenn（2026-05-23、Mac mini M4 Pro 48GB、Ollama）の `ollama ps` 上の概算メモリ: gemma4:e4b-mlx 約9GB、gemma4:26b-mlx 約18GB、qwen3.6:35b-a3b-nvfp4 約21GB、qwen3.6:35b-a3b-q4_K_M 約26GB（32k コンテキスト）。q4_K_M は nvfp4 より遅く重いため不採用 — [Zenn, 2026-05-23](https://zenn.dev/rscstd/articles/3e71a66e276873)

### Inferences
**エンドユーザーにとっての導入しやすさ**
- Ollama と LM Studio はインストーラー配布で、モデル取得もワンコマンドまたは GUI で済む。拡張側は `http://localhost:11434/v1` や `http://localhost:1234/v1` を OpenAI SDK（Node の `openai` パッケージで baseURL を差し替え）や `fetch` + SSE で叩くだけで実装できる。
- 両者を自動検出し、`/v1/models` でモデル一覧を取る作りが現実的。llama.cpp や MLX-LM は上級者向けのオプション扱いが妥当。
- Markdown の構造保持には、AST で段落・見出し・表セルなどの翻訳対象テキストだけを抜き出し、コードやインラインコードはプレースホルダで保護する方式が考えられる。その場合、セグメント配列を JSON スキーマで返させるとよい。LM Studio（GGUF/MLX）と llama-server は JSON スキーマ制約を明示的にサポートしている。Ollama の OpenAI 互換面で確認できたのは JSON mode まで。

**3,000語の技術 Markdown の所要時間（推定）**
- 前提: 入力は英語約1.3トークン/語に Markdown 記法とコードを加えて約4,000〜5,000トークン、出力は日本語訳とそのまま再出力するコードで約5,000〜8,000（中央値6,000）トークン。いずれも出典のない仮定。
- llama.cpp 表から見ると、7B Q4_0（約3.8GB）の実効生成速度は帯域上限（帯域 ÷ 重みバイト数）の約0.6倍（M4 Max 546GB/s で 83 tok/s）。これを各モデルのアクティブ重みに当てはめた概算は次のとおり。
  - M4 16GB + Gemma 4 E4B（Q4）: 生成は約20〜35 tok/s と推定。prefill（約220 tok/s 級）に約20〜25秒、生成に約3〜5分、合計約3.5〜5.5分。
  - M4 16GB + Gemma 4 12B QAT: 実測 11.26 tok/s を使うと、生成だけで約9分、合計約10分。対話的プレビューには遅い。
  - M4 Pro（273GB/s）+ Gemma 4 26B-A4B / Qwen3.6-35B-A3B（アクティブ約3〜4B、4bit）: 生成は約50〜70 tok/s と推定。合計約1.5〜2分。
  - M5 Max 級 + Qwen3.5-35B-A3B（Ollama MLX）: 公表値 112〜134 tok/s なら生成は約45〜55秒、prefill は約3秒（1810 tok/s）。
  - M4 Max / M5 Max + Gemma 4 31B dense（約19〜20GB）: 帯域上限 約29〜32 tok/s × 0.6 で約17〜20 tok/s。生成に約5〜6分かかり、品質優先のバッチモード向け。
- 対話的プレビューの実装上の工夫:
  - 表示中セクションから優先して訳し、ストリーミングで逐次表示する。
  - 段落ハッシュでキャッシュし、差分だけ再翻訳する。
  - 並列リクエスト（LM Studio の continuous batching、llama-server の `-np`）でスループットを稼ぐ。
  - thinking を必ずオフにする（Qwen3.5/3.6 は `enable_thinking: False`）。推論トークンが出ると所要時間が数倍になる。

### Gaps
- Gemma 4 E4B / 26B-A4B / 31B と Qwen3.6 / 3.8 について、各 M チップでの tok/s の体系的な実測（同一条件）は見つからなかった。上の値は概算。
- Ollama MLX プレビューの「>32GB」要件が 0.40 の既定化以降も残っているかは未確認（jacar.es もメモリ要件は未記載）。
- Ollama の OpenAI 互換 `response_format` で `json_schema` を厳密にサポートしているかは、ドキュメント上確認できなかった。
- llama-server の既定ポートが 9931 に変わった経緯は未確認（README の記載のみ）。
- 日本語出力のトークン効率（Gemma 4 や Qwen3.5 のトークナイザで日本語1文字当たり何トークンか）の出典は見つからなかった。

---

## Q5. macOS の OS レベル オンデバイス選択肢（Translation framework / Foundation Models）と Windows 相当機能

### Takeaway
Apple Translation framework は、macOS 26 以降なら `TranslationSession(installedSource:target:)` で UI なしにセッションを作れる。そのため VS Code 拡張から起動する小さな Swift CLI ヘルパーで、完全オフラインの英日翻訳が可能。ただし言語モデルが事前にインストールされている必要があり、日本語品質の定量評価は見つからなかった。

Apple Foundation Models（macOS 26 以降、macOS 27 で新モデル）は日本語に対応する。ただしオンデバイスのコンテキストが 4,096 トークン（macOS 27 の WWDC26 サンプルでは 8192）と小さく、ガードレールもあるため、長文の技術文書を翻訳する主力には向かない。Windows では Phi Silica（Copilot+ PC）と Foundry Local（OpenAI 互換）が相当する。

### Cited Findings
**Apple Translation framework**
- Translation framework はアプリ内テキスト翻訳のフレームワークで、iOS 17.4 以降・macOS 14.4 以降で利用できる（検索結果の要約）— [Apple Developer: Translation](https://developer.apple.com/documentation/translation)
- `init(installedSource:target:)` の提供は iOS 26.0 以降 / macOS 26.0 以降 — [Apple Developer: init(installedSource:target:)](https://developer.apple.com/documentation/translation/translationsession/init(installedsource:target:))
  - 説明は「Creates a translation session to translate between a given source and target language already installed on device.」
  - 未インストール時は「If one or both of the languages aren't installed on the device already, attempting to translate will throw errors.」
  - ダウンロード許可を得るには SwiftUI の `translationTask` が提供するセッションを使う必要がある
  - このイニシャライザで作ったセッションなら「you don't need a `.translationTask()`」
- オープンソースの Swift CLI「translate」（MIT）— [GitHub: Arthur-Ficial/translate](https://github.com/Arthur-Ficial/translate)
  - 要件は「macOS 26 Tahoe or newer」と Apple silicon
  - `--install <pair>` で言語ペアを準備・ダウンロード、`--installed` で一覧表示
  - モデル未インストールで `--no-install` を指定すると終了コード 4
  - `--to ja` の例を掲載
  - 性能値は実測ではなく「reference targets」（コールドスタート200ms未満など）
- 開発者ブログの報告: Swift CLI 化では `TranslationSession.init` が macOS 26 限定のため、Package.swift のプラットフォームを合わせる必要があった。また Task を待たずに終了すると何も出力されないという落とし穴があった — [Abdul Rahman Sibahi: translation-cli](https://blog.ar-ms.me/thoughts/translation-cli)
- Rust バインディング translation-rs も、手動のセッション構築は macOS 26 以降だとしている — [docs.rs: translation-rs 0.3.2](https://docs.rs/crate/translation-rs/0.3.2)
- 品質については、端末のストレージと計算資源の制約からクラウドより精度が下がりうるという一般的な指摘のみ（日本語の実測なし）— [Kodeco: Meet the Translation API](https://www.kodeco.com/ios/paths/apple-ai-models/49307459-translation-framework/01-meet-the-translation-api/01)

**Apple Foundation Models framework**
- 2026年2月（OS 26.4）の更新 — [Apple Developer: Foundation Models updates](https://developer.apple.com/documentation/updates/foundationmodels)
  - 指示追従とツール呼び出しを改善したオンデバイスモデルに更新
  - 「Reduce the possibility of blocking benign content with improved guardrails」
  - `tokenCount(for:)` と `contextSize` プロパティを追加
  - `#Playground` は「4,096 tokens in the available context window」の使用量を表示
- 2026年3月に「Foundation Models SDK for Python」、2026年6月に iOS 27 / macOS 27 向けの新オンデバイスモデル、`LanguageModel` プロトコル（サーバーモデルやオンデバイスの任意モデルを利用可）、`PrivateCloudComputeLanguageModel`、画像入力、`MLXLanguageModel` などが加わった — [Apple Developer: Foundation Models updates](https://developer.apple.com/documentation/updates/foundationmodels)
- WWDC26 セッション 241（2026年6月）— [WWDC26: What's new in the Foundation Models framework](https://developer.apple.com/videos/play/wwdc2026/241/)
  - 新オンデバイスモデルは「rebuilt from the ground up」
  - コード例のコメントは `contextSize` = `// 8192`
  - PCC モデルは「32,000 token context window」と推論機能を持ち、「PCC is available with no cloud API costs to developers who have less than 2 million first time downloads」
  - ガードレールは 26.4 で偽陽性を削減し、iOS 27 でさらに改善
  - 「In macOS 27, the models are coming to the command line」（`fm` CLI）
  - フレームワーク自体をオープンソース化
- オンデバイスのコンテキスト長については、二次情報（DEV Community: 8,192、WWDC Q&A 要約: 4,096）で食い違う — [DEV Community](https://dev.to/hariharanjagan/whats-new-in-apples-foundation-models-framework-at-wwdc-2026-5227)、[WWDC26 Q&A 要約](https://antongubarenko.substack.com/p/wwdc26-coding-intelligence-machine)
- 言語対応 — [Apple Developer: Supporting languages and locales with Foundation Models](https://developer.apple.com/documentation/foundationmodels/supporting-languages-and-locales-with-foundation-models)
  - オンデバイスモデルは「understands and generates text in any language that Apple Intelligence supports」
  - `supportsLocale(_:)` / `supportedLanguages` で確認し、非対応言語では `LanguageModelError.unsupportedLanguageOrLocale` が発生する
  - Instructions に「The person's locale is …」や「You MUST respond in …」を書くことが推奨されている
- Apple Intelligence の対応言語に日本語が含まれる（iOS 27 / macOS 27 の枠組みで記載）。Mac の要件は M1 以降、ストレージは最大8GB（M3 以降かつ12GB以上のメモリでは最大14GB）。ページの公開日は 2026-11-05 — [Apple Support: How to get Apple Intelligence](https://support.apple.com/en-us/121115)
- ガードレール `permissiveContentTransformations`（macOS 26.0 以降）— [Apple Developer: permissiveContentTransformations](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel/guardrails/permissivecontenttransformations)
  - 「lets the model handle potentially unsafe content, such as summarizing a news article」
  - String 生成では `guardrailViolation` を投げない
  - ただし「the model may still sometimes refuse」
  - String 以外（Generable）の生成では default と同じ挙動
- macOS 27（Golden Gate）は 2026-09-14（米国時間）に配信、日本では 9月15日。Intel Mac は対象外 — [ギズモード・ジャパン](https://www.gizmodo.jp/article/ios-27_siri-ai_release_date/)、[gori.me](https://gori.me/?p=170174)
- Python 向け SDK が 2026年3月に公開された — [GitHub: apple/python-apple-fm-sdk](https://github.com/apple/python-apple-fm-sdk)

**Windows の相当機能**
- Microsoft Learn（ms.date 2026-08-05）の整理 — [Microsoft Learn: Choose your Windows AI solution](https://learn.microsoft.com/en-us/windows/ai/windows-ai-comparison)
  - Windows AI APIs（Phi Silica ほか）は「Most APIs require a Copilot+ PC」。Phi Silica は対応する NVIDIA/AMD GPU を積んだ非 Copilot+ PC でも利用できる
  - Foundry Local は「20+ open-source LLMs and speech models via an OpenAI-compatible API. Any Windows hardware.」
  - Copilot+ PC の要件は NPU 40+ TOPS とメモリ 16GB 以上
  - 推奨されるフォールバック順は Windows AI APIs → Foundry Local → クラウド
- Foundry Local が macOS でも動作するという記述があるが、二次情報で、現行の対応状況は未確認 — [Microsoft Foundry on Windows（検索結果）](https://developer.microsoft.com/windows/ai/)、[InfoWorld](https://www.infoworld.com/article/3992509/the-windows-ai-platform-takes-shape.html)

### Inferences
**Translation framework**
- `init(installedSource:target:)` は UI なしで使えるため、Node.js 拡張から `child_process.spawn` で起動する Swift CLI（stdin/stdout で JSON をやりとり）として実装できる見込みが高い。
- 言語パックが未インストールだとエラーになるため、拡張は事前にチェックし、「システム設定で英語・日本語の翻訳言語をダウンロードしてください」と案内するか、UI 付きヘルパーで `translationTask` 経由のダウンロードを促す必要がある。
  - Arthur-Ficial/translate の `--install` が UI なしでダウンロードできるとする記述は、Apple 文書（ダウンロード許可には translationTask が必要）と一見食い違う。要検証。
- 文単位の NMT で、Markdown を認識しない。AST でテキストノードだけを渡し、インラインコードやリンクはプレースホルダで保護する前処理が必須。用語集による制御もできない。
- 翻訳専用の小型モデルなので LLM より高速と推測されるが、実測は見つからなかった。macOS 26 以降が要件なので、macOS 15 以前のユーザーには使えない。

**Foundation Models**
- 4,096 トークン（macOS 26.x）では入力と出力が同じ枠を共有するため、1回あたり英文1,500トークン程度に分割する必要がある。macOS 27 で 8192 になったとしても長文には分割が必須。
- 日本語には対応しているが、翻訳品質の公開評価がない。ガードレールによる拒否もありうる（permissiveContentTransformations でも拒否はありうる）。
- オンデバイスでの位置づけは「短い UI 文字列や見出しの補助翻訳」程度が無難。macOS 27 の `fm` CLI があれば Swift ヘルパーなしで呼べる可能性があるが、仕様は未確認。
- PCC モデル（32K、推論あり）はクラウド処理になるため、完全オフラインの要件には合わない。

**Windows**
- クロスプラットフォーム配布では、Windows は Foundry Local（OpenAI 互換）か Ollama / LM Studio に寄せるのが、Mac 側と同じクライアント実装を共有できて合理的。Phi Silica は Copilot+ PC に限られ、日本語対応も未確認なので主力にはしにくい。

### Gaps
- Apple Translation framework の英日翻訳品質（BLEU/COMET、技術文書での誤訳傾向）と速度の実測は見つからなかった。
- CLI から言語モデルを UI なしでダウンロードする公式手段の有無も未確認。
- Foundation Models のオンデバイスモデルのパラメータ数（2026年版）、macOS 27 での正式なコンテキスト長、日本語翻訳品質、`fm` CLI の仕様は未確認。
- Phi Silica の日本語対応、Foundry Local の macOS 対応状況（2026年11月時点）、Windows に OS 標準の翻訳 API があるかは確認できなかった。

---

## Q6. VS Code Webview（Electron）でブラウザ内蔵の翻訳/AI API は使えるか

### Takeaway
2026年11月時点では「使えない（少なくとも公式にサポートされた手段はない）」と判断する。Chrome の Translator API は Chrome デスクトップ向けで、モデルの配布基盤は Chrome 側にある。Electron が文書化しているのは Prompt API（LanguageModel）をアプリ側で登録したローカルモデルに中継する実験的な仕組みだけで、Translator API には触れていない。VS Code 本体はこの仕組みを使っていない（ローカル調査）。

### Cited Findings
- Chrome の Translator API は「Use the Translator API in Chrome to translate text with AI models provided in the browser」。Chrome デスクトップで動作し、モバイルでは動かない。埋め込み iframe ではパーミッションポリシー（`allow="translator"`）による明示的な許可が必要 — [Chrome for Developers: Translator API](https://developer.chrome.com/docs/ai/translator-api)、[Chrome: Built-in AI overview](https://developer.chrome.com/docs/ai/built-in)
- Electron の Local AI Handler（実験的）— [Electron docs: Local AI handler（tutorial）](https://electronjs.org/docs/latest/tutorial/local-ai-handler)、[Electron API: localAIHandler](https://electronjs.org/docs/latest/api/local-ai-handler)
  - 「supports Chromium's experimental Prompt API by sending its calls to a local model in a utility process」
  - 利用には `AIPromptAPI` Blink 機能の有効化、`ses.registerLocalAIHandler()`、ユーティリティプロセスでの `localAIHandler.setPromptAPIHandler()` 実装が必要
  - 「This API is experimental. It may change or be removed in future Electron releases.」
  - Translator や Summarizer の記載はない
- `@electron/llm` は、node-llama-cpp で GGUF をユーティリティプロセスに読み込み、`window.electronAi` を注入する実験的パッケージ。「Before using this package in a production app, be aware that you might have to migrate to something else!」とある — [GitHub: electron/llm](https://github.com/electron/llm)
- ローカル調査（本調査環境、2026-11-09、URL なし。インストール済みアプリのファイルを読み取り専用で確認した）:
  - VS Code 1.145.2（product.json の date は 2026-11-06T04:28:13Z）は Electron Framework 43.8.3 を同梱している
  - VS Code の `out/` 配下で `enableBlinkFeatures` は `"HighlightAPI"` のみが見つかり、`registerLocalAIHandler` の呼び出しは見つからなかった
  - Electron Framework バイナリには Blink の機能名らしき文字列 `TranslationAPI`、`AIPromptAPI`、`LanguageDetectionAPI`、`AISummarizationAPI` が存在する一方、`registerLocalAIHandler` / `setPromptAPIHandler` の文字列は0件だった
- Electron 側で Translator API を有効化・中継する公式手段や GitHub Issue は、検索では見つからなかった — [検索結果の範囲: Chrome/Edge の Translator API 文書のみ](https://learn.microsoft.com/id-id/microsoft-edge/web-platform/translator-api)

### Inferences
- VS Code の Webview は Electron 内の iframe サンドボックスで、拡張側は Electron の session や BrowserWindow 設定を制御できない。そのため Prompt API の Electron ハンドラも、Translator API の Chrome 由来モデル配布も利用できないと考えるのが妥当。
  - Blink の機能名の文字列が残っていても、ブラウザ側のモデル供給がなければ `availability()` が使える状態にはならないと推測される。
- 拡張で「ブラウザ内蔵 AI」に頼る設計は避け、ローカルサーバー（Ollama / LM Studio）か OS API ヘルパー（Swift CLI）を拡張ホスト（Node.js）側から呼ぶ構成にすべき。

### Gaps
- VS Code Webview 内で `'Translator' in self` や `LanguageModel.availability()` を実際に評価した結果は取得していない（実機検証は未実施）。
- Electron で localAIHandler が導入されたバージョンは文書に履歴表がなく、特定できなかった。VS Code 同梱の Electron 43.8.3 に含まれるかも未確定。

---

## Q7. Mac メモリ別ショートリスト（2026-11-09 時点、英→日 Markdown 翻訳用、ランキングと理由）

### Takeaway
16GB は Gemma 4 E4B が第一候補（品質と速度の均衡が最良）、32GB は Gemma 4 26B-A4B（MoE、英日 BLEU 0.280、高速）、64GB 以上は Gemma 4 31B（品質最優先、英日 BLEU 0.285）と、高速な Qwen3.5/3.6-35B-A3B の併用を推奨する。完全オフラインで追加ダウンロードを避けたい場合の代替は、macOS 26 以降の Apple Translation framework（Swift CLI ヘルパー）。

### Cited Findings
**16GB クラス**
1. Gemma 4 E4B（Q4/QAT 6.1〜6.6GB、MLX 9.5GB）: Swallow の英日 0.261、日英 0.228、Ja MT-Bench 0.758、Apache 2.0 — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)、[Ollama gemma4 tags](https://ollama.com/library/gemma4/tags)、[eWeek](https://www.eweek.com/news/google-gemma-4-apache-2-open-models/)
2. Gemma 4 12B Unified（2026-06-03、QAT 7.2GB）: MMMLU 83.4（E4B 76.6）。M4 16GB 実測 11.26 tok/s。Swallow には未掲載 — [HF カード](https://huggingface.co/google/gemma-4-26B-A4B-it)、[Ollama tags](https://ollama.com/library/gemma4/tags)、[DevelopersIO, 2026-07-24](https://dev.classmethod.jp/en/articles/local-llm-guide-2026-summer/)
3. Gemma 4 E2B（QAT 4.3GB）: 英日 0.256。速度優先の下書きモード用、または 8GB 機向け — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)、[Ollama tags](https://ollama.com/library/gemma4/tags)
- 次点の比較材料 — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)、[Apple ML Research](https://machinelearning.apple.com/research/exploring-llms-mlx-m5)、[Ollama qwen3.5 tags](https://ollama.com/library/qwen3.5/tags)
  - gpt-oss-20b（MXFP4 実測 12.08GB）: 英日 0.234
  - GPT-OSS-Swallow-20B-RL: 英日 0.248
  - Qwen3.5-9B（Q4 6.6GB）: 英日 0.174

**32GB クラス**
1. Gemma 4 26B-A4B（総25.2B、アクティブ3.8B、NVFP4 16GB / Q4_K_M 18GB / MLX 18GB）: 英日 0.280、日英 0.261、M-IFEval-Ja 0.867 — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)、[HF カード](https://huggingface.co/google/gemma-4-26B-A4B-it)、[Ollama tags](https://ollama.com/library/gemma4/tags)
2. Qwen3.6-35B-A3B または Qwen3.5-35B-A3B（NVFP4 約21〜22GB）: 3.5 は英日 0.250、日英 0.239。Ollama MLX の公表値は decode 112〜134 tok/s。thinking のオフが必須 — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)、[Ollama blog: MLX](https://ollama.com/blog/mlx)、[Zenn, 2026-05-23](https://zenn.dev/rscstd/articles/3e71a66e276873)、[HF: Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B)
3. GPT-OSS-Swallow-20B-RL（約12GB級）: 日本語強化版 gpt-oss で、英日 0.248 — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)

**64GB 以上**
1. Gemma 4 31B（Q4 19〜20GB）: 英日 0.285 で Swallow 全体首位（GPT-5.4 Thinking は 0.272）。M-IFEval-Ja 0.898 — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)、[Ollama tags](https://ollama.com/library/gemma4/tags)
2. Qwen3.5-27B / Qwen3.6-27B / Qwen3.8-27B（Q4 16〜20GB）: 3.5-27B は英日 0.252、日英 0.241。3.8-27B は 2026-08-14 公開の最新版で翻訳評価は未掲載 — [Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)、[The Decoder](https://the-decoder.com/alibabas-qwen-team-releases-qwen-3-8-models-with-open-weights-under-the-apache-2-0-license/)
3. Gemma 4 26B-A4B の 8bit（q8_0 28GB）: 品質と速度の両立 — [Ollama tags](https://ollama.com/library/gemma4/tags)
- 参考（128GB 級）: Qwen3.5-122B-A10B（Q4 81GB）は英日 0.263 — [Ollama qwen3.5 tags](https://ollama.com/library/qwen3.5/tags)、[Swallow データ](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)

**OS 標準のフォールバック（全メモリ帯）**
- Apple Translation framework（macOS 26 以降、言語パックの事前インストールが必要）— [Apple Developer](https://developer.apple.com/documentation/translation/translationsession/init(installedsource:target:))

### Inferences
**選定理由**
- 16GB で E4B を1位にするのは、macOS と VS Code の常駐分を差し引いても余裕があり、英日 BLEU で Qwen3.5-27B 並みの値を示しているため。
  - 12B は品質向上が見込めるが、M4 無印では約11 tok/s で、3,000語に約10分かかる。そのため「高品質モード」とする。
- 32GB で 26B-A4B を1位にするのは、アクティブ3.8B の MoE で速度が出やすく、英日 BLEU と指示追従（M-IFEval-Ja）がどちらも高いため。
  - 35B-A3B 系は速度で勝る可能性があるが、22GB 前後のモデルを 32GB 機で動かすと余裕が小さい。また Ollama の MLX プレビューは当初 32GB 超を要件としていた。
- 64GB 以上で 31B dense を1位にするのは翻訳品質が最高だから。ただし dense のため生成は 20 tok/s 前後と推定され、対話的プレビューには 26B-A4B や 35B-A3B を併用し、31B は「清書・一括翻訳」用に回す二段構えが現実的。

**運用上の推奨**
- 既定モデルは Gemma 4 系（16GB は E4B、32GB は 26B-A4B）、技術用語の比較検証用に Qwen 系を設定で切り替え可能にする。
- 用語集（glossary）はシステムプロンプトに差し込む。thinking はオフにし、温度は低めにする。
- Markdown は AST でセグメント化し、JSON スキーマで訳文の配列を返させる。
- 段落ハッシュでキャッシュし、表示範囲を優先して訳す。

### Gaps
- 上記ランキングは主に WMT20（ニュース）の BLEU と一般的な日本語ベンチに基づく。技術 Markdown（コード混在、表、リンク）での構造保持率や用語の正確さの公開比較はなく、拡張の開発時に自前評価（例: 実 README 50本での COMET やフォーマット崩れ率）が必要。
- Gemma 4 12B、Qwen3.6、Qwen3.8 の英日翻訳スコアが未公開のため、これらの順位は暫定。
