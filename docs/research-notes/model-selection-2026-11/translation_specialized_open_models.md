# 翻訳特化オープンウェイトモデル（機械翻訳専用 LLM/SLM）の現状と EN→JA 技術 Markdown 翻訳への適性（2026-11-09 時点）

> 調査日: 2026-11-09。リリースとベンチマークにはすべて日付を付けた。2025年以前の情報には【2025年以前】と明記した。「ベンダー主張」と「独立評価（第三者）」は分けて記載した。汎用 LLM（Gemma 4、Qwen、gpt-oss、Gemini、GPT など）には、同じ出典の中で比較対象として出てくる場合にだけ触れた。

## Q1. 2026年11月時点で存在する翻訳特化オープンモデルと、どれが最新か（インベントリ）

### Takeaway
2026年に、EN↔JA を扱える翻訳特化オープンモデルが急増した。最新は PFN の「PLaMo 3 Translate」（2026-11-05 公開、0.8B/2B/8B/31B、53言語、公式 GGUF・MLX あり）。

ほかの主な2026年モデル:
- WMT26（2026年10月開催）の投稿モデルとして公開された Lumen（約14.8B）、Qingqiu-MT-9B、RFMT（EN→JA・ZH→JA 用）
- Tencent の Hy-MT2（2026-05-21、Apache-2.0）
- CyberAgent の CAT-Translate（2026年6月、EN↔JA 専用、MIT）
- Google の TranslateGemma（2026-01-15）

次の5点はいずれも確認できなかった。
- TranslateGemma の後継
- Seed-X、Tower、LFM の新しい翻訳モデル
- Qwen-MT のオープン化
- Meta Omnilingual MT の重み公開

### Cited Findings

**インベントリ（新しい順。2025年以前のものは【2025年以前】）**

| モデル | 開発元 | 公開日 | サイズ | 言語（日本語） | ライセンス | ローカル向け形式 | 出典 |
|---|---|---|---|---|---|---|---|
| PLaMo 3 Translate | Preferred Networks | 2026-11-05 | 0.8B / 2B / 8B（カード表記は 9B）/ 31B | 53言語（HF 上は簡体字・繁体字中国語を1つに数えて52。ja を含む） | PLaMo Community License | 公式 GGUF・MLX-4bit・FP8・W4A16・W4AFP8・NVFP4 | [PFN tech blog](https://www.preferred.jp/en/blog/tech/plamo-3-translate-weight-release), [HF 8B](https://huggingface.co/pfnet/plamo-3-translate-8b) |
| Lumen（Lumen_wmt26） | ATH-MaaS（HF org） | 2026（WMT26 投稿。Proceedings は 2026-10-28〜29） | 約14.77B dense（Qwen3-14B 構成、40層）。WMT26 の参加システム一覧では「14B + 4B」 | WMT26 の23方向（en→ja を含む） | Apache-2.0 | BF16 safetensors 1ファイル（約29.5GB）のみ記載 | [HF Lumen_wmt26](https://huggingface.co/ATH-MaaS/Lumen_wmt26), [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf) |
| Qingqiu-MT-9B | WPS-Qingqiu | 2026（WMT26 投稿） | 9B（Qwen3.5-9B ベース、BF16） | 20言語（ja を含む） | Apache-2.0 | safetensors（量子化版2件、形式の記載なし） | [HF Qingqiu-MT-9B](https://huggingface.co/WPS-Qingqiu/Qingqiu-MT-9B) |
| RFMT | tohoku-nlp（東北大・理研・フューチャー・Machine Learning Solutions） | 2026（HF コレクション更新 9/28） | HF の表示は 15B（BF16）。WMT26 一覧の「18.795B total」と食い違う | EN→JA と ZH→JA のみ | Apache-2.0 | BF16 | [HF RFMT](https://huggingface.co/tohoku-nlp/RFMT), [rfmt-wmt2026.github.io](https://rfmt-wmt2026.github.io/), [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf) |
| CAT-Translate | CyberAgent | 2026-06（arXiv 投稿 2026-06-19） | 0.8B / 1.4B / 3.3B（3.3b-beta）/ 7B | 日英双方向のみ | MIT | HF safetensors（GGUF はコミュニティ版） | [arXiv 2606.21413](https://arxiv.org/abs/2606.21413), [HF 7B](https://huggingface.co/cyberagent/CAT-Translate-7b) |
| Hy-MT2 | Tencent Hunyuan | 2026-05-21 | 1.8B / 7B / 30B-A3B（MoE） | 33言語（カード内で 33/36/38 と表記が揺れる。ja を含む） | Apache-2.0 | 公式 GGUF（全3サイズ。1.8B は 2bit・1.25bit 版もある）・FP8 | [HF Hy-MT2-7B](https://huggingface.co/tencent/Hy-MT2-7B), [HF collection](https://huggingface.co/collections/tencent/hy-mt2) |
| Hy-MT1.5-1.8B-1.25bit | Tencent Hunyuan | 2026-04-29（X 投稿） | 1.8B（約440MB） | 33言語 | 未確認 | 1.25bit | [Tencent Hunyuan on X](https://x.com/TencentHunyuan/status/2049487799850840334) |
| TranslateGemma | Google | 2026-01-15 | 4B / 12B / 27B（Gemma 3 ベース） | 55言語（ja を含む） | Gemma Terms of Use | Ollama 公式タグあり。GGUF・MLX はコミュニティ版 | [Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/translategemma/), [HF 12B](https://huggingface.co/google/translategemma-12b-it), [ITmedia 2026-01-16](https://www.itmedia.co.jp/aiplus/articles/2601/16/news073.html) |
| Omnilingual MT（OMT-LLaMA 1B/3B/8B、OMT-NLLB） | Meta | 2026-03-17 発表 | 1B / 3B / 8B ほか | 1,600言語 | 重み未公開（後述） | — | [arXiv 2603.16309](https://arxiv.org/html/2603.16309v3), [Slator](https://slator.com/meta-1600-languages-ai-translation/), [Meta AI](https://ai.meta.com/research/publications/omnilingual-mt-machine-translation-for-1600-languages/) |
| HY-MT1.5【2025年以前】 | Tencent | 2025-12-30 | 1.8B / 7B | 33言語＋5方言（ja を含む） | Tencent HY Community License（EU・英国・韓国を除外） | 公式 GGUF・FP8・GPTQ-Int4 | [GitHub HY-MT](https://github.com/Tencent-Hunyuan/HY-MT), [License.txt](https://raw.githubusercontent.com/Tencent-Hunyuan/HY-MT/main/License.txt) |
| Hunyuan-MT-7B / Hunyuan-MT-Chimera-7B【2025年以前】 | Tencent | 2025-09-01 | 7B | 本調査では未確認 | 本文未確認 | — | [GitHub HY-MT](https://github.com/Tencent-Hunyuan/HY-MT) |
| LFM2-350M-ENJP-MT【2025年以前】 | Liquid AI | 2025-09（Liquid Nanos） | 350M（HF の表示は 0.4B） | 英日双方向のみ | LFM Open License v1.0 | GGUF・MLX（8bit）・ONNX | [HF](https://huggingface.co/LiquidAI/LFM2-350M-ENJP-MT), [Liquid Docs](https://docs.liquid.ai/lfm/models/lfm2-350m-enjp-mt), [SiliconANGLE 2025-09-25](https://siliconangle.com/2025/09/25/liquid-ai-debuts-extremely-small-high-performance-foundation-models-device-processing/) |
| Command A Translate【2025年以前】 | Cohere Labs | 2025-08 版（コレクション更新 2025-11-06） | 111B | 23言語（ja を含む） | CC-BY-NC 4.0 | 量子化版3件 | [HF](https://huggingface.co/CohereLabs/command-a-translate-08-2025) |
| Seed-X（Instruct / PPO / RM、7B）【2025年以前】 | ByteDance Seed | 2025-07（論文 2025-07-18） | 7B（HF の表示は 8B、Mistral 系） | 28言語（ja を含む） | OpenMDW（MIT とする記事もあり、食い違う） | 公式 GPTQ-Int8 / AWQ-Int4 | [HF Seed-X-PPO-7B](https://huggingface.co/ByteDance-Seed/Seed-X-PPO-7B); MIT とする記事は [Communeify](https://www.communeify.com/en/blog/bytedance-seed-x-7b-model-challenges-gpt4-translation/) |
| Tower+【2025年以前】 | Unbabel | 2025-06（arXiv 2506.17080） | 2B / 9B / 72B | 9B は ja を含む（カードは「22 languages」と書くが、列挙は26言語） | CC-BY-NC 4.0（本文）。ヘッダは cc-by-nc-sa-4.0 で食い違う | — | [HF Tower-Plus-9B](https://huggingface.co/Unbabel/Tower-Plus-9B), [arXiv 2506.17080](https://arxiv.org/abs/2506.17080) |
| Marco-MT-Algharb【2025年以前】 | Alibaba International（AIDC-AI）Marco チーム | 2025（WMT25 投稿） | 15B（Qwen3-14B ベース） | 13方向（en→ja を含む） | Apache-2.0 | — | [HF](https://huggingface.co/AIDC-AI/Marco-MT-Algharb) |
| NLLB-200【2025年以前】 | Meta | 2022 | 600M 蒸留版ほか | 200言語 | CC-BY-NC 4.0 | — | [HF](https://huggingface.co/facebook/nllb-200-distilled-600M) |

**各モデルの補足（日付付き）**
- **PLaMo 3 Translate**（2026-11-05）
  - ベースは、PFN と NICT の共同研究で作った事前学習モデル「PLaMo 3 NICT」。
  - 31B は SFT の後に DPO で仕上げた。8B 以下は 31B を教師とする蒸留で作った（DistiLLM-2 と AMiD がベース）。
  - SFT データは約 33.9B＋3.4B＝37.3B tokens。データの合成と判定には Gemma 4 31B IT を使った。
  - 出典 — [PFN tech blog](https://www.preferred.jp/en/blog/tech/plamo-3-translate-weight-release)
- PLaMo 3 Translate は、PFN の翻訳サービス PLaMo翻訳 向けに開発されたモデル群。 — [PFN press release 2026-11-05](https://www.preferred.jp/en/news/pr20261105), [PFN プレスリリース（日本語）](https://www.preferred.jp/ja/news/pr20261105)。国内でも報道された。 — [gihyo.jp](https://gihyo.jp/article/2026/11/plamo-3-translate-open-weights), [マイナビ](https://news.mynavi.jp/article/20261105-5263362/), [ITmedia](https://www.itmedia.co.jp/aiplus/article/2611/05/2000002900/), [PLaMo翻訳 お知らせ](https://translate.preferredai.jp/news/20261105-2-plamo3-translate-open-weight/)
- PLaMo翻訳サービスは 2026-10-07 に第3世代ベースのモデルへ切り替わり、対応言語が2言語から53言語に増えた。 — [PLaMo翻訳 お知らせ 2026-10-07](https://translate.preferredai.jp/news/20261007-1-plamo3-major-update/)
- **Hy-MT2**（2026-05-21）
  - カードのニュース欄によれば、Hy-MT2-1.8B / 7B / 30B-A3B とベンチマーク IFMTBench を Hugging Face と ModelScope で公開した。 — [HF Hy-MT2-7B](https://huggingface.co/tencent/Hy-MT2-7B), [Tencent Cloud techpedia](https://www.tencentcloud.com/techpedia/144776?lang=en), [PC Watch](https://pc.watch.impress.co.jp/docs/news/2110885.html)
  - 技術報告は arXiv 2605.22064（v1 が 2026-05-21、v2 が 2026-05-25、著者13名）。 — [arXiv](https://arxiv.org/abs/2605.22064)
  - HF コレクションの更新日（年の表記なし）は、30B-A3B が 7/21、30B-A3B-GGUF が 7/23、1.8B-GGUF が 9/8、1.8B の 1.25bit 版が 6/11。公開後も更新が続いている。 — [HF collection](https://huggingface.co/collections/tencent/hy-mt2)
- **CAT-Translate**（arXiv 投稿 2026-06-19）
  - 著者は Yuu Jinnai の単著。合成対訳コーパスを使い、2段階の SFT の後に Multi-Objective GRPO で学習した。 — [arXiv 2606.21413](https://arxiv.org/abs/2606.21413)
  - ベースについて、論文は Sarashina 2.2 系と説明している。7B のカードは「CyberAgent の社内モデル」ベースと書いている。 — [arXiv HTML](https://arxiv.org/html/2606.21413), [HF 7B](https://huggingface.co/cyberagent/CAT-Translate-7b)
- **Lumen**（WMT26 Appendix B.13）
  - 指示付き翻訳（文体・用語・構造化出力の要件）に特化している。
  - 4段階のパイプライン:
    1. 継続事前学習（CPT）と SFT
    2. LLM 判定を使ったオンライン選好最適化
    3. より大きな教師から Qwen3-14B 学生への on-policy 蒸留
    4. 構造を考慮した推論と後処理
  - 指示追従と品質を1〜5で採点する LLM 判定で、全体平均は 4.60。
  - 出典 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- `ATH-MaaS/Qwen-MT-Lumen` は Qwen チーム公式の Qwen-MT ではなく、WMT26 投稿モデルとして説明されている。 — [HF Qwen-MT-Lumen](https://huggingface.co/ATH-MaaS/Qwen-MT-Lumen)
- **Qingqiu-MT-9B**（WMT26 Appendix B.16）
  - 指示追従型の多言語翻訳モデル。20言語をサポートし、WMT26 の公式23言語対のうち22をカバーする。
  - 「指示の生成」と「翻訳の生成」を別の LLM ステップに分けた合成パイプラインで、多様な翻訳要件・ドメイン・文書長・用語集制約をカバーした。
  - 学習は2段階の全パラメータ SFT の後に GRPO。
  - 出典 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- **RFMT**（WMT26 Appendix B.18）
  - Marco-MT-Algharb を、より自然な日本語を出すよう追加学習したモデル。
  - 文脈付き日本語容認性データセット CAJALA（Context-Aware JApanese Linguistic Acceptability）を作り、逆翻訳した対訳で DPO を行った。
  - 前後の文脈から訳文の一部を復元する穴埋め翻訳（FIM）も学習した。
  - 推論は MBR デコードの後、低品質な区間だけを FIM で後編集する。
  - 出典 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf), [HF RFMT](https://huggingface.co/tohoku-nlp/RFMT)
- **TranslateGemma**: 2026-01-15 に、Gemma 3 ベースの 4B/12B/27B として発表された。技術報告は 2026-01-13 付。 — [Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/translategemma/), [InfoQ 2026-01](https://www.infoq.com/news/2026/01/google-translategemma-models/)
- TranslateGemma の後継（Gemma 4 ベース版など）は、検索では見つからなかった。Gemma 4 自体は、2026-04-02 に Apache 2.0 で公開された汎用モデル。 — [Wikipedia: Gemma](https://en.wikipedia.org/wiki/Gemma_(language_model))。Gemma Terms of Use のページにも、Gemma 4 は別ライセンスだと注記がある。 — [Gemma Terms](https://ai.google.dev/gemma/terms)
- Liquid AI が2026年に出した日本語向けモデルは、汎用の LFM2.5-1.2B-JP-202606 と音声の LFM2.5-Audio-1.5B-JP（2026-06 ごろ告知）だけ。翻訳専用の新モデルは見当たらなかった。 — [HF LFM2.5-1.2B-JP-202606](https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP-202606), [Liquid AI on X](https://x.com/liquidai/status/2063095523318415744)
- Seed-X の HF コレクションの最終更新は2025年7〜8月で、2026年版は見つからなかった。 — [HF Seed-X collection](https://huggingface.co/collections/ByteDance-Seed/seed-x-6878753f2858bc17afa78543)
- Tower 系の2026年リリースも見つからず、最新は Tower+（2025年6月）。 — [arXiv 2506.17080](https://arxiv.org/abs/2506.17080)
- Qwen-MT（Qwen3-MT、2025年7月）は API 製品。Hugging Face 上にあるのはデモ用の Space だけ。 — [Qwen on X](https://x.com/Alibaba_Qwen/status/1948406830688018471), [HF post](https://huggingface.co/posts/AdinaY/225572236442446), [machinetranslate.org](https://machinetranslate.org/qwen-mt)
- **Meta Omnilingual MT**（2026-03-17）
  - 構成は OMT-LLaMA（LLaMA 3 ベース、1B/3B/8B）と OMT-NLLB（OmniSONAR ベースのエンコーダ・デコーダ）。 — [Slator](https://slator.com/meta-1600-languages-ai-translation/), [arXiv](https://arxiv.org/html/2603.16309v3)
  - 著者とみられる Hacker News のコメントによれば、重みは公開されておらず、公開できたのは評価データの一部だけ（2026年3月時点）。 — [HN（ミラー）](https://hn.jakechampion.name/item/47421749)
- **PLaMo 2 Translate**【2025年以前】は旧世代。WMT25 では PLaMo-2-translate ベースの KIKIS が EN→JA に参加した。 — [WMT25 Findings](https://aclanthology.org/2025.wmt-1.22)。plamo-translate-cli では `--model` で PLaMo 2 Translate も指定できる。 — [plamo-translate-cli](https://github.com/pfnet/plamo-translate-cli)

### Inferences
- EN→JA に絞ると、2026年の主な候補は次のとおり。TranslateGemma は Gemma 3 ベースなので、汎用の Gemma 4 が出た今は相対的に旧世代。
  - PLaMo 3 Translate（日本語重視、最新）
  - Hy-MT2（多言語、寛容なライセンス）
  - CAT-Translate（日英専用、小型）
  - WMT26 の研究系モデル（Lumen、Qingqiu、RFMT）
- 世代交代が起きている。
  - 旧世代は、固定テンプレートで文を訳すだけのモデル（NLLB、Seed-X、TranslateGemma、LFM2-ENJP）。
  - 新世代は、用語集・文体・文脈・構造保持といった指示を受けられるモデル（Hy-MT2、PLaMo 3 Translate、Qingqiu、Lumen、RFMT）。
  - Markdown 翻訳では新世代のほうが扱いやすい。
- Lumen のプロンプト形式（`Human:`/`Assistant:`、"Please translate the following text into …"）は Marco-MT-Algharb と同じ形をしている。同じ系譜のモデルである可能性がある（推測）。
- PLaMo 3 Translate は公開から4日しか経っておらず、第三者による検証はまだ少ない（Q2 参照）。

### Gaps
- Ollama 公式ライブラリに PLaMo 3 Translate、Hy-MT2、CAT-Translate のエントリがあるかは確認できなかった（確認できたのは TranslateGemma だけ）。
- Hy-MT1.5-1.8B-1.25bit と Hunyuan-MT-7B のライセンス本文は確認していない。Hunyuan-MT-7B の対応言語数も未確認。
- Meta OMT の重みの公開状況は、2026年3月以降の更新を確認できていない。
- Seed-X の後継の有無は、検索結果と HF コレクションの範囲でしか確認していない（ByteDance Seed の公式サイトは未確認）。
- Lumen と Qingqiu-MT-9B の正確な公開日は分からない（カードに記載がない）。
- RFMT のパラメータ数は、HF の表示（15B）と WMT26 の一覧（18.795B total）で食い違っており、理由は分からない。

## Q2. EN↔JA の品質：独立評価とベンダー主張の区別

### Takeaway
第三者評価で EN→JA の最上位にいる翻訳特化オープンモデルは、WMT26（2026年10月）の Lumen（約14.8B）。人手評価 cESA で 90.6 を取り、Gemini 3.1 Pro（90.3）と同じトップクラスタに入った。これに Qingqiu-MT-9B（85.2）と RFMT（81.2）が続く。

PLaMo 3 Translate、Hy-MT2、CAT-Translate、TranslateGemma は、WMT26 では単体で評価されていない。これらの EN→JA での優位性の根拠は、ベンダー自身の評価と、小規模な第三者テストに限られる。第三者テストの例は、ゲーム向け翻訳ツール Playto の比較（13言語対×各40行）で、PLaMo 3 Translate 2B が Hy-MT2 1.8B を上回った。

TranslateGemma-27B は、WMT26 主催者の予備比較（English→Japanese、GEMBA-ESA）で 67.5 にとどまった。汎用の Gemma-4-31B-IT（89.3）を大きく下回る。

### Cited Findings

**独立評価（第三者）**
- **WMT26 General MT の概要**（Proceedings pp. 880–930、2026-10-28〜29、EMNLP 2026 と併催）
  - English→Japanese と Simplified Chinese→Japanese を含む23言語対で実施。
  - 46システムを評価した（参加30、主催者が加えた LLM・翻訳サービス16）。
  - 人手評価には新しいプロトコル cESA（contrastive Error Span Annotation）を使った。
  - テストセットは HTML/JSON 構造を含む完全な文書単位で、文体や構造を指定する文脈付き指示も入っている。
  - constrained トラックは 20B 以下のオープンウェイトモデルが対象。
  - 主催者の LLM ベースラインは、文書全体を1回で zero-shot 翻訳した（thinking モードは無効）。
  - 出典 — [WMT26 Findings (ACL Anthology)](https://aclanthology.org/2026.wmt-main.48/), [PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- WMT26 の English→Japanese の人手評価は、Microsoft の評価者（訳出先言語のネイティブでバイリンガル。プロ翻訳者または言語専門家）が担当した（Table 9）。 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- WMT26 English→Japanese、全システムの順位（§6.2、cESA、有意差クラスタ付き、抜粋）。出典 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)

| 順位クラスタ | システム | スコア | 備考 |
|---|---|---|---|
| 1–4 | Lumen | 90.6 | 翻訳特化オープン（constrained） |
| 1–4 | Wayfinder | 90.6 | Gemini ベース |
| 1–4 | SCIR-TG-MT | 90.4 | |
| 1–4 | Gemini 3.1 Pro | 90.3 | 汎用・商用（ベースライン） |
| 5 | TRIVE | 88.3 | Gemini ベース |
| 6–11 | HW-TSC / GPT 5.5 / UvA-MT / Human (postediting) / Dubformer | 86.2 / 86.1 / 86.1 / 86.0 / 85.4 | HW-TSC はパイプライン内で HY-MT2 を使用 |
| 6–11 | Qingqiu-MT-9B | 85.2 | 翻訳特化オープン（constrained） |
| 12–15 | MakotoAI | 83.4 | 商用 LLM 6種の振り分け |
| 12–16 | DeepSeek V4 Pro / Cohere CAT+ | 83.2 / 83.2 | |
| 13–18 | Command A+ | 81.4 | |
| 15–20 | RFMT | 81.2 | 翻訳特化オープン（constrained） |
| 15–20 | Gemma 4 31B | 80.5 | 汎用オープン（ベースライン） |
| 17–21 | SalamandraTA | 80.2 | |
| 20–23 / 21–23 | Tiny Aya Global / Gemma 4 4B | 77.7 / 77.3 | |
| 24–25 | GPT OSS 20B | 72.4 | |
| 26–29 | Tower+ 9B | 69.9 | 翻訳特化オープン【2025年モデル】 |
| 26–29 | GoogleTranslate / Qwen 3.6 27b / Ministral 3 14B | 69.4 / 68.7 / 68.6 | |
| 31 | Qwen 3.5 9b | 57.4 | Qingqiu のベースモデル |

- WMT26 English→Japanese の constrained トラックだけの順位（§6.3）。出典 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)

| 順位 | システム | スコア |
|---|---|---|
| 1 | Lumen | 90.6 |
| 2 | Qingqiu-MT-9B | 85.2 |
| 3–4 | RFMT / SalamandraTA | 81.2 / 80.2 |
| 5–6 | Tiny Aya Global / Gemma 4 4B | 77.7 / 77.3 |
| 7 | GPT OSS 20B | 72.4 |
| 8–9 | Tower+ 9B / Ministral 3 14B | 69.9 / 68.6 |
| 10 | GLM 4 9B | 65.0 |
| 11 | Qwen 3.5 9b | 57.4 |

- WMT26 の Simplified Chinese→Japanese。出典 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
  - 全システムでは Human (postediting) が 79.6 で1位。Qingqiu-MT-9B と Lumen は 73.7（5〜11位）、RFMT は 65.8。
  - constrained トラックでは Qingqiu と Lumen が 73.7 で1〜2位、TransCore が 71.4、RFMT が 65.8。
- WMT26 の総括。出典 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
  - Lumen は constrained トラックで、23言語対のうち20でトップクラスタに入った。2位は Qingqiu-MT-9B。
  - 全体では、トップクラスタに入った言語対の数で Wayfinder（17）が最多。以下 Gemini 3.1 Pro（15）、TRIVE（14）、Lumen（13）の順。
  - 上位3つは Gemini ベース。
  - ドメイン別では software のスコアが最も高かった（72〜100、15言語対で 90 超）。
- WMT26 主催者の予備比較（Table 3）。WMT25 の英語原文テストデータを、GPT-5.4 を判定者とする参照なしの GEMBA-ESA で採点した。出典 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)

| モデル | English→Japanese | 12言語平均 |
|---|---|---|
| Gemma-4-31B-IT | 89.3 | 80.3 |
| Qwen3.5-397B-A17B | 85.5 | 82.9 |
| Command-A-Translate | 77.1 | 69.9 |
| DeepSeek-V4-Pro | 74.6 | 68.9 |
| TranslateGemma-27B | 67.5 | 67.1 |

- WMT26 では TranslateGemma と HY-MT は単体では出場していない。他チームのアンサンブルやパイプラインの部品として使われただけ（例: HW-TSC が HY-MT2、Krosny が en-be で TranslateGemma 12B）。 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- **WMT25**【2025年以前】の English→Japanese 人手評価（表に載っている参加システムは Algharb、Shy-hunyuan-MT、KIKIS、Systran、NTTSU、Laniqo）。 — [WMT25 Findings](https://aclanthology.org/2025.wmt-1.22)

| システム | スコア |
|---|---|
| Human | 89.2 |
| Algharb（Marco-MT-Algharb） | 85.7 |
| Shy-hunyuan-MT（Hunyuan-MT 系） | 79.9 |
| KIKIS（PLaMo-2-translate ベース） | 76.2 |
| Systran | 75.6 |
| NTTSU | 73.3 |
| Laniqo | 67.8 |

- WMT25【2025年以前】の注意点。出典 — [WMT25 Findings](https://aclanthology.org/2025.wmt-1.22)
  - Shy-hunyuan-MT は、自動評価では1言語対を除いてすべて1位だったが、人手評価ではかなり低かった。
  - 主催者は、XCOMET-XXL と GEMBA（DeepSeek V3）を報酬にした GRPO で学習したことが原因の可能性を指摘している。
  - それでも constrained の中では最良で（11言語対で勝利）、Algharb が2位（6言語対で勝利）だった。
- **Playto**（ゲーム向け翻訳ツール。記事「PLaMo 3 Translate for games: test results and how to use it for free」、2026-11-06 公開、2026-11-09 更新）。出典 — [Playto blog](https://playto.dev/blog/plamo-3-translate/)
  - 条件: 13言語対×各40行。2つの AI 採点者が、正確さ・流暢さ・自然さ・用語の観点から盲検で8点満点で採点した。
  - 結果（PLaMo 3 Translate 2B 対 Hy-MT2 1.8B）:

| 方向 | PLaMo 3 Translate 2B | Hy-MT2 1.8B |
|---|---|---|
| EN→JA | 7.34 | 5.89 |
| JA→EN | 7.31 | 6.09 |
| 13言語対の平均 | 6.46 | 5.83 |
| EN→Spanish | 5.88 | 6.19 |
| EN→Russian | 5.67 | 5.81 |

  - EN→Spanish と EN→Russian では Hy-MT2 が上回った。
  - Playto の既定モデルは Hy-MT2 1.8B。Gemma 4 E2B は欧州言語だけで試した。
  - 著者自身が "our own tests, not official benchmarks" と注記している。
- はちみつブログ（2026-10-15、MacBook Air M2 16GB、LM Studio）で24件の翻訳を比較した結果。 — [はちみつブログ](https://hunny-hachimitsu.hatenablog.com/entry/2026/10/15/220801)
  - TranslateGemma 12B: 主な問題は比較関係の取り違え。
  - Gemma 4 12B: 英単語が日本語の補足付きで残った。
  - Qwen3.5 9B: 1文の欠落と図表参照の取り違えがあった。
- lilting.ch（2026-05-26）で Hy-MT2 1.8B Q4_K_M を M1 Max で試した結果。 — [lilting.ch](https://lilting.ch/en/articles/hymt2-local-translation-30b-a3b)
  - JA→EN のニュースで「運転を見合わせた」を "traffic delays" と訳した（"suspended service" のほうが正確）。
  - JSON の "welcome back" の日本語訳が硬かった。

**ベンダー主張（自社評価）**
- **PLaMo 3 Translate**（PFN、2026-11-05）
  - PFN は "Even the smallest 0.8B model outperforms existing translation-specialized LLMs" と主張している。比較対象には30倍以上大きいモデルも含まれる。英語と他言語の間では、2B ですでに比較対象をすべて上回ったとしている。
  - 比較対象は TranslateGemma、Hy-MT2、PLaMo 2 Translate 8B。 — [PFN tech blog](https://www.preferred.jp/en/blog/tech/plamo-3-translate-weight-release)
  - gihyo は、比較対象に TranslateGemma 27B と Hy-MT2 30B-A3B が入っていると報じた。 — [gihyo.jp 2026-11](https://gihyo.jp/article/2026/11/plamo-3-translate-open-weights)
- PLaMo 3 Translate 8B（BF16）のカードに載っているスコア。 — [HF 8B](https://huggingface.co/pfnet/plamo-3-translate-8b)
  - PFTB（En↔Ja、charsim）0.6119
  - SaaS（En→Ja、charsim）0.5750
  - WMT24++ COMET-22（En→Ja）0.8805
  - FLORES+ chrF++（Ja↔多言語14言語）37.45、（En↔多言語）56.22
- PFN は WMT24++ の参照訳の品質に疑問を示している。社内ベンチマークとして次の2つも使っている。 — [PFN tech blog](https://www.preferred.jp/en/blog/tech/plamo-3-translate-weight-release)
  - PFTB: 日英の多ドメイン評価
  - SaaS: HTML を含む実際のリクエスト形式での英→日評価
- 31B の DPO の勝率（Gemini 3.1 Pro が判定）。 — [PFN tech blog](https://www.preferred.jp/en/blog/tech/plamo-3-translate-weight-release)

| 比較 | EN→JA | JA→EN |
|---|---|---|
| DPO R1 対 SFT | 57% | 59% |
| DPO R2 対 R1 | 53% | 57% |

- **Hy-MT2**（2026-05）。 — [HF Hy-MT2-7B](https://huggingface.co/tencent/Hy-MT2-7B), [arXiv 2605.22064](https://arxiv.org/abs/2605.22064)
  - 7B と 30B-A3B が fast-thinking モードの DeepSeek-V4-Pro と Kimi K2.6 を上回り、1.8B が Microsoft や Doubao の翻訳 API を全体で上回ると主張している。
  - 結果は画像だけで示され、EN→JA の数値は本文にない。
- **Qingqiu-MT-9B** のカードにある、GLM-5 を判定者にしたペア比較（Qingqiu の勝率 / 敗率 / 差。引き分けは分母に含む）。 — [HF Qingqiu-MT-9B](https://huggingface.co/WPS-Qingqiu/Qingqiu-MT-9B)

| ベンチマーク・方向 | 対 Qwen3.5-9B | 対 HY-MT2-7B | 対 Gemma4-12B | 対 DeepSeek-v4-flash |
|---|---|---|---|---|
| IF-WMT25 en→ja | 83.5 / 13.4 / +70.1 | 39.3 / 55.7 / −16.4 | 31.5 / 52.2 / −20.7 | 29.9 / 55.9 / −26.0 |
| IFMTBench en→ja | 64.3 / 21.4 / +42.9 | 40.0 / 33.3 / +6.7 | 53.3 / 26.7 / +26.6 | 28.6 / 35.7 / −7.1 |
| IFMTBench ja→en | 50.0 / 8.3 / +41.7 | 16.7 / 33.3 / −16.6 | 33.3 / 25.0 / +8.3 | 8.3 / 33.3 / −25.0 |

- **TranslateGemma**（2026-01）のスコア。EN→JA 単独の数値はカードにない。 — [HF 12B](https://huggingface.co/google/translategemma-12b-it)

| サイズ | WMT24++（55言語）MetricX（低いほど良い） | WMT24++ COMET | WMT25 MQM（低いほど良い） |
|---|---|---|---|
| 4B | 5.32 | 81.6 | — |
| 12B | 3.60 | 83.5 | 7.94 |
| 27B | 3.09 | 84.4 | 5.86 |

  - 12B（MetricX 3.60）がベースの Gemma 3 27B（4.04）を上回ったという報道もある。 — [the-decoder](https://the-decoder.com/googles-new-open-translategemma-models-bring-translation-for-55-languages-to-laptops-and-phones/)
- **CAT-Translate**（CyberAgent、2026-06）の BLEU（7B のカードに掲載）。 — [HF CAT-Translate-7b](https://huggingface.co/cyberagent/CAT-Translate-7b)
  - 評価セットは実務系のもの: BSD、Court Interpreter、JMedBench、PFMT、WAT 2025 特許。WMT などの一般的なデータセットより "less overoptimized" という理由で選んだ。
  - カードは、各サイズが "within their respective sizes" で最良だと主張している。

| モデル | 全体平均 | JA→EN | EN→JA |
|---|---|---|---|
| CAT-Translate-7B | 37.68 | 41.06 | 34.31 |
| CAT-Translate-3.3B | 36.16 | 37.51 | 34.80 |
| CAT-Translate-1.4B | 33.73 | 33.26 | 34.19 |
| CAT-Translate-0.8B | 30.42 | 29.71 | 30.68 |
| TranslateGemma-12b-it | 32.24 | 35.81 | 28.68 |
| Tower-Plus-9B | 32.41 | 36.84 | 27.99 |
| TranslateGemma-4b-it | 28.09 | 29.41 | 26.76 |
| PLaMo-2-translate | 25.24 | 25.92 | 24.57 |
| LFM2-350M-ENJP-MT | 24.95 | 24.91 | 25.00 |
| HY-MT1.5-7B | 10.56 | 13.46 | 7.67 |

- **LFM2-350M-ENJP-MT**【2025年以前】: 10倍以上大きいモデルと同等と主張しているが、具体的なスコアは示していない。 — [HF](https://huggingface.co/LiquidAI/LFM2-350M-ENJP-MT)
- **Seed-X**【2025年以前】: 人手評価と自動評価（FLORES-200、WMT-25、公開チャレンジセット）で、Gemini-2.5、Claude-3.5、GPT-4 と同等以上だと主張している。 — [HF Seed-X-PPO-7B](https://huggingface.co/ByteDance-Seed/Seed-X-PPO-7B)
- **Tower+**【2025年以前】: 9B が24言語対の XCOMET-XXL で 84.38、72B が IFEval で 89.02（Unbabel 側の発表と論文による自己申告）。 — [arXiv 2506.17080](https://arxiv.org/abs/2506.17080), [MarkTechPost 2025-06-27](https://www.marktechpost.com/2025/06/27/unbabel-introduces-tower-a-unified-framework-for-high-fidelity-translation-and-instruction-following-in-multilingual-llms/)

### Inferences
- 独立評価で強さが確認できた翻訳特化オープンモデルは、Lumen、Qingqiu、RFMT と、2025年の Algharb。いずれも 9〜15B 級で、Mac では 16〜32GB 以上のメモリが前提になる。
- 9B 級でも翻訳特化の効果は大きい。WMT26 の EN→JA で、Qwen3.5-9B を翻訳向けに追加学習した Qingqiu-MT-9B は 85.2 だった。ベースの Qwen 3.5 9b は 57.4。
- TranslateGemma-27B の低評価（67.5）には、2K tokens の入力上限（Q4）がある中で文書単位のテストを訳したことが響いている可能性がある（推測）。いずれにしても、文書をまとめて訳す用途で TranslateGemma を選ぶ根拠は弱い。
- CAT-Translate の比較表で HY-MT1.5-7B の EN→JA が 7.67 と極端に低いのは、プロンプトや出力形式が合っていなかったことによる失敗の可能性がある（推測）。モデル本来の性能と見なすべきではない。
- WMT25 では自動評価と人手評価が食い違った例（Shy-hunyuan-MT）がある。COMET、MetricX、XCOMET だけで示されたベンダー主張（Hy-MT2、TranslateGemma など）は割り引いて読む必要がある。
- PLaMo 3 Translate の主張は、社内の charsim、COMET-22、chrF++、LLM 判定に基づく。第三者評価は Playto のゲーム向けの短文テストに限られ、技術文書や Markdown での独立評価はまだない。

### Gaps
- PLaMo 3 Translate、Hy-MT2、CAT-Translate、TranslateGemma、LFM2-ENJP の EN→JA を、同じ条件で人手評価した第三者の結果は見つからなかった。
- 技術文書（README や設計メモ）の EN→JA でこれらのモデルを比べた評価も見つからなかった。
- TranslateGemma と Hy-MT2 の言語別（EN→JA）スコアは、技術報告の本文を取得できず確認していない。
- WMT26 の EN→JA について、ドメイン別（software など）のスコアの内訳は抜き出せなかった。

## Q3. ライセンス：商用利用、閾値、地域除外、VS Code 拡張での配布可否

### Takeaway
配布しやすいのは、Apache-2.0 の Hy-MT2、Lumen、Qingqiu-MT-9B、RFMT、Marco-MT-Algharb と、MIT の CAT-Translate。

ほかのモデルの条件:
- HY-MT1.5（と旧 Hunyuan-MT 系）: Tencent HY Community License が EU・英国・韓国を適用地域から除外しているので、世界に配布する拡張には向かない。Hy-MT2 は Apache-2.0 になり、この問題はなくなった。
- PLaMo 3 Translate: 売上10億円以下なら商用でも無償だが、事前登録が必要。2024年版の規約本文には「Built with PLaMo」表示の義務もある。
- LFM2-350M-ENJP-MT: 年商1,000万ドルの閾値がある。
- Command A Translate、Tower+、NLLB: 非商用（CC-BY-NC）。

### Cited Findings
- Hy-MT2-7B の LICENSE.txt は、「Copyright (C) 2026 Tencent」を冠した標準の Apache License 2.0 本文。地域除外、MAU 閾値、AUP はない。 — [Hy-MT2-7B LICENSE.txt](https://huggingface.co/tencent/Hy-MT2-7B/blob/main/LICENSE.txt)。1.8B-GGUF のタグも apache-2.0。 — [HF Hy-MT2-1.8B-GGUF](https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF)
- Tencent HY Community License（HY-MT1.5、2025-12-30）【2025年以前】の要点。出典 — [HY-MT License.txt](https://raw.githubusercontent.com/Tencent-Hunyuan/HY-MT/main/License.txt)
  - 適用地域は全世界から "excluding the territory of the European Union, United Kingdom and South Korea"。除外地域では契約自体が適用されない。
  - MAU が1億を超える場合は、Tencent に許諾を申請する必要がある。
  - 再配布するときは契約書の写しを渡し、改変ファイルに改変した旨を表示し、"Tencent HY is licensed under the Tencent HY Community License Agreement" と書いた Notice ファイルを付ける（Hosted Service 経由以外で配布する場合）。
  - 出力などを使って他の AI モデルを改良することは禁止（§5(b)）。
  - AUP には20項目の禁止用途がある（軍事利用など）。
- PLaMo Community License（PLaMo 3 Translate）。出典 — [HF 8B](https://huggingface.co/pfnet/plamo-3-translate-8b), [PFN press release](https://www.preferred.jp/en/news/pr20261105)
  - 個人・非商用・学術の利用は登録不要で無償。
  - 商用利用は、利用者と関連会社の直近事業年度の売上（収入）が10億円以下なら無償。PFN の商用利用登録フォームから登録すれば、提出した時点から使える。
  - 10億円を超える場合は別途契約が必要。
  - プレスリリースには閾値の表現についての訂正注記があり、「以下」の扱いの書き方が揺れている。
- PLaMo Community License の再配布条件。2024年版本文の ScanCode ミラーに基づくもので、PLaMo 3 に適用される現行版と同じかは確認していない。出典 — [ScanCode: plamo-cla-2024](https://scancode-licensedb.aboutcode.org/plamo-cla-2024.html)
  - 第三者に提供するときは契約書の写しを渡し、受け取った側にも遵守させる。
  - 関連する Web サイト、UI、ブログ、製品ページ、製品ドキュメントに「Built with PLaMo」と明示する。
  - モデル素材を使って作った AI モデルの名前には「PLaMo」を入れる。
  - 出力は、モデルの出力だと明示すれば公開できる。
  - 出力で学習したモデルは派生モデルとして扱われる。
- Gemma Terms of Use（最終更新 2026-04-01、TranslateGemma に適用）。出典 — [Gemma Terms](https://ai.google.dev/gemma/terms)
  - Prohibited Use Policy と本契約を守ることを条件に、利用・複製・改変・配布を許諾している。
  - 配布するときは次の義務がある。
    - §3.2 の利用制限を、拘束力のある条項として後続の利用者との契約に入れ、利用者に通知する。
    - 契約書の写しを渡す。
    - 改変したファイルにその旨を表示する。
    - Hosted Service 経由以外で配布するなら、"Gemma is provided under and subject to the Gemma Terms of Use found at ai.google.dev/gemma/terms" と書いた Notice ファイルを付ける。
  - 規約違反の場合、Google は "reserves the right to restrict (remotely or otherwise) usage" としている。
  - Google は出力に対する権利を主張しない。
  - TranslateGemma は付録の対象モデル一覧に載っている。
- TranslateGemma の HF ページは gated で、Google の利用規約に同意しないとファイルにアクセスできない。 — [HF 12B](https://huggingface.co/google/translategemma-12b-it)
- LFM Open License v1.0（LFM2-350M-ENJP-MT）。出典 — [Liquid LFM License](https://www.liquid.ai/lfm-license), [Liquid Docs: model license](https://docs.liquid.ai/lfm/help/model-license)
  - Apache 2.0 がベースだが、年商が閾値を超える法人の商用利用は許諾の対象外。
  - 閾値の書き方が食い違っており、ちょうど1,000万ドルの扱いがはっきりしない。
    - 本文: "$10,000,000 or more"
    - FAQ: "exceeds $10 million"
  - 非営利団体の研究目的の利用には閾値がない。
  - 改変したモデルにも閾値が適用される。
- CAT-Translate は 0.8B、1.4B、3.3b-beta、7B のどのカードでも MIT ライセンス。 — [HF 7B](https://huggingface.co/cyberagent/CAT-Translate-7b), [HF 0.8B](https://huggingface.co/cyberagent/CAT-Translate-0.8b), [HF 1.4B](https://huggingface.co/cyberagent/CAT-Translate-1.4b), [HF 3.3b-beta](https://huggingface.co/cyberagent/CAT-Translate-3.3b-beta)
- 以下はいずれも Apache-2.0。
  - Qingqiu-MT-9B（"Built on Qwen3.5-9B by Alibaba Cloud"）。 — [HF](https://huggingface.co/WPS-Qingqiu/Qingqiu-MT-9B)
  - Lumen_wmt26。 — [HF](https://huggingface.co/ATH-MaaS/Lumen_wmt26)
  - RFMT。 — [HF](https://huggingface.co/tohoku-nlp/RFMT)
  - Marco-MT-Algharb。 — [HF](https://huggingface.co/AIDC-AI/Marco-MT-Algharb)
- Seed-X は OpenMDW ライセンス（条文は本調査では未確認）。 — [HF Seed-X-PPO-7B](https://huggingface.co/ByteDance-Seed/Seed-X-PPO-7B)
- Command A Translate は CC-BY-NC 4.0 と Cohere Labs の AUP の対象。商用利用には Cohere の営業への問い合わせが必要で、HF では同意しないとアクセスできない（gated）。 — [HF](https://huggingface.co/CohereLabs/command-a-translate-08-2025)
- Tower-Plus-9B は、本文では CC-BY-NC-4.0、ヘッダでは cc-by-nc-sa-4.0 と書かれていて食い違う。 — [HF](https://huggingface.co/Unbabel/Tower-Plus-9B)
- NLLB-200 は CC-BY-NC 4.0。カードは "a research model" と位置づけ、本番での運用向けには公開していないとしている。 — [HF](https://huggingface.co/facebook/nllb-200-distilled-600M)
- plamo-translate-cli 自体は Apache-2.0 で、モデルには別途 PLaMo Community License が適用される。 — [GitHub](https://github.com/pfnet/plamo-translate-cli)

### Inferences
VS Code 拡張での扱いを配布形態ごとに整理すると、次のようになる（推論。法務確認が必要）。

| ライセンス | (a) ユーザーに入手方法を案内（拡張は重みを配布しない） | (b) 拡張が初回に HF または Ollama から自動ダウンロード | (c) VSIX に同梱、または自前サーバーで再配布 |
|---|---|---|---|
| Apache-2.0 / MIT（Hy-MT2、CAT-Translate、Qingqiu、Lumen、RFMT、Algharb） | 可 | 可 | 可（LICENSE と NOTICE を残す） |
| Gemma ToU（TranslateGemma） | 可 | 可。ただし HF は gated なので、ユーザーの HF トークンと規約への同意が要る。Ollama 経由なら gate はないが、規約は適用される | 可能だが、§3.2 の制限の継承と Notice の同梱が必要。サイズ（3.3GB 以上）からも現実的でない |
| PLaMo Community License | 可。拡張の UI やドキュメントに「Built with PLaMo」とライセンスの案内を出し、商用ユーザーには登録と売上10億円の閾値を知らせる | 可。ただし、利用者が商用登録したかや閾値を超えていないかを拡張側では確認できないので、明示的なオプトインと同意画面を用意したい | 契約書の写しを添付し、受け取った側に遵守させる義務が生じる。避けるのが無難 |
| LFM Open License v1.0 | 可。年商1,000万ドル以上の法人ユーザーは対象外だと明示する | (a) と同じ | (a) と同じ（Apache 由来の義務に加えて閾値の条件） |
| Tencent HY Community（HY-MT1.5、Hunyuan-MT） | 世界向けの拡張では、EU・英国・韓国のユーザーが許諾の対象外になる | (a) と同じ。地域の判定も難しい | 不適 |
| CC-BY-NC（Command A Translate、Tower+、NLLB） | 既定モデルには不適。ユーザーが自分で持ち込むモデルとしてのみ扱う | 不適 | 不適 |

- ライセンスの面で既定モデル（自動ダウンロード）に向くのは、商用でも無条件に使える Hy-MT2 と CAT-Translate。
- PLaMo 3 Translate は品質と速度では最有力（Q2、Q5）。ただしオプトインの選択肢として出し、同意画面と「Built with PLaMo」表示を付けるのが安全。
- Hy-MT2 が Apache-2.0 で出た今、HY-MT1.5 を選ぶ理由はほとんどない。

### Gaps
- PLaMo 3 Translate に適用される PLaMo Community License の現行版本文は確認していない（再配布・表示・命名の条項が2024年版から変わっていないか）。
- 拡張が自動ダウンロードする場合、PFN への商用登録が誰の義務になるか（拡張の作者か、各エンドユーザーか）は条文から判断できなかった。PFN への確認が必要。
- 次のライセンス本文は確認していない。
  - OpenMDW（Seed-X）の条文
  - Hy-MT2 の 30B-A3B と 1.8B（GGUF 以外）の LICENSE ファイル（確認したのは 7B と 1.8B-GGUF だけ）
  - Hunyuan-MT-7B と Hy-MT1.5-1.8B-1.25bit のライセンス

## Q4. 実用面：ランタイム、プロンプト形式、コンテキスト長、Markdown・長文での挙動

### Takeaway
Mac で扱いやすいのは次の4つ。

| モデル | 強み | 制約 |
|---|---|---|
| PLaMo 3 Translate | 公式の GGUF と MLX-4bit がある。32K tokens まで扱える。用語集・文脈・常体/敬体をチャットテンプレートの引数で指定できる | 自由記述の指示は受け付けない |
| Hy-MT2 | 公式 GGUF があり、Ollama で動く。用語・文体・区切り記号・構造化データの保持に専用テンプレートがある | 公式の MLX 版がない |
| TranslateGemma | Ollama 公式タグがある | 入力は 2K tokens まで。テンプレートが固定 |
| LFM2-ENJP | GGUF・MLX・ONNX がある | 短〜中程度の長さの単発翻訳向け |

Markdown の保持を明示的にうたっているモデルはない。拡張側でブロック単位に分割し、コード・インラインコード・URL を退避し、構造を検証する前提で設計すべき。

### Cited Findings

**ランタイムと配布形式**
- **PLaMo 3 Translate**
  - 形式ごとの対応ランタイム（Ollama と LM Studio には言及がない）: — [PFN tech blog](https://www.preferred.jp/en/blog/tech/plamo-3-translate-weight-release), [HF 8B](https://huggingface.co/pfnet/plamo-3-translate-8b)
    - BF16: Transformers と vLLM
    - FP8・W4A16・W4AFP8・NVFP4: vLLM
    - GGUF: llama.cpp
    - MLX-4bit: mlx-lm（Apple silicon）
  - 8B の量子化による精度低下は、GGUF Q2_K が最も大きい（PFTB −0.0130、FLORES+ Ja↔多言語 −0.91）。それ以外の形式は BF16 とほぼ同じ。 — [HF 8B](https://huggingface.co/pfnet/plamo-3-translate-8b)
  - 公式 CLI の plamo-translate-cli（Apache-2.0）: — [plamo-translate-cli](https://github.com/pfnet/plamo-translate-cli)
    - インストールは `pip install plamo-translate`（Python 3.10〜3.14）。
    - Apple Silicon（macOS 14 以降）では MLX、Linux と Intel Mac では llama.cpp を使う。Windows は WSL 経由のみ。
    - 対話モード、パイプモード、サーバーモードがあり、MCP サーバーとしても使える（README の例は Claude Desktop）。
    - llama.cpp ではドラフトモデルによる投機的デコードができる。既定モデルは 2B。
    - このページには、ファイル翻訳、Markdown の扱い、用語集、常体/敬体についての記載がない。
- **Hy-MT2**
  - 1.8B の公式 GGUF のサイズは Q4_K_M 1.13GB、Q6_K 1.47GB、Q8_0 1.91GB。 — [HF Hy-MT2-1.8B-GGUF](https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF)
  - `ollama run hf.co/tencent/Hy-MT2-1.8B-GGUF:Q4_K_M` で動く。llama.cpp の `-hf` 指定や Docker Model Runner も使え、LM Studio と Jan へのワンクリックリンクもある。 — [HF Hy-MT2-1.8B-GGUF](https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF)
  - GGUF のカードには "This gguf depends on our STQ kernel, which is released at PR #22836." とある。 — [HF Hy-MT2-1.8B-GGUF](https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF)
  - 実地テスト（2026-05-26）の結果: — [lilting.ch](https://lilting.ch/en/articles/hymt2-local-translation-30b-a3b)
    - 1.8B の Q4_K_M は、標準の llama.cpp（b8990、Metal）で動いた。
    - 1.25bit 版は標準ビルドでは読み込めなかった。STQ1_0 カーネルか AngelSlim のフォークが必要。
    - 30B-A3B（`HYV3ForCausalLM`）は、当時 llama.cpp が対応していなかった。
  - Transformers 5.6.0 以上が必要。vLLM と SGLang に対応している。公式の MLX 版はない。 — [HF Hy-MT2-7B](https://huggingface.co/tencent/Hy-MT2-7B), [HF collection](https://huggingface.co/collections/tencent/hy-mt2)
- **TranslateGemma**
  - Ollama の公式タグは `translategemma:4b` 3.3GB、`:12b` 8.1GB、`:27b` 17GB。 — [Ollama](https://ollama.com/library/translategemma)
    - ページ上の表示は 2.9M downloads。
    - 「13 models」と書かれているが、表示されているタグは4つだけ。
    - 入力はテキストと画像。
  - LM Studio で翻訳サーバーとして使う手順が公開されている（2026-04-13）。 — [きしだのHatena](https://nowokay.hatenablog.com/entry/2026/04/13/053426)
  - MLX ベースの macOS 翻訳アプリもある。 — [Mac-Lite-Translator_TranslateGemma](https://github.com/Jingyuan-Zheng/Mac-Lite-Translator_TranslateGemma)
  - HF には量子化版が36件ある。vLLM、SGLang、Docker Model Runner、Vertex にも対応している。 — [HF 12B](https://huggingface.co/google/translategemma-12b-it)
- **CAT-Translate**
  - 公式は safetensors だけ。7B のカードからリンクされた量子化版の一覧には4件あるが、形式は書かれていない。 — [HF 7B](https://huggingface.co/cyberagent/CAT-Translate-7b)
  - コミュニティ製の CLI（MIT）があり、7B の i1-Q4_K_M GGUF（約4.6GB）を Apple Silicon の Metal で動かせる。サーバーモードと Web UI もある。 — [cat-translate-cli](https://github.com/Shuichi346/cat-translate-cli)
- **LFM2-350M-ENJP-MT**【2025年以前】: HF の重み、GGUF、MLX（8bit）、ONNX がある。Transformers 5.2.0 以上、llama.cpp、LEAP に対応している。 — [Liquid Docs](https://docs.liquid.ai/lfm/models/lfm2-350m-enjp-mt)
- **Seed-X**【2025年以前】: 公式の量子化は GPTQ-Int8 と AWQ-Int4。作者は非公式の量子化版を使わないよう勧めている。ビーム幅4のビームサーチを推奨し、vLLM 0.8.0 での例を示している。 — [HF Seed-X-PPO-7B](https://huggingface.co/ByteDance-Seed/Seed-X-PPO-7B)
- **Lumen_wmt26**: BF16 の1ファイル（約29.5GB）だけで、GGUF と MLX の記載はない。 — [HF](https://huggingface.co/ATH-MaaS/Lumen_wmt26)
- **Command A Translate**【2025年以前】: 111B。量子化版3件は llama.cpp、Ollama、LM Studio で動く。 — [HF](https://huggingface.co/CohereLabs/command-a-translate-08-2025)

**プロンプト形式とコンテキスト長**
- **PLaMo 3 Translate** — [HF 8B](https://huggingface.co/pfnet/plamo-3-translate-8b)
  - 独自の PFML3 形式を使う。
    - `<|plamo:bos|>` で始め、次の順に並べてから生成させる。
      1. `<|plamo:tag|>dataset<|plamo:msg|>translation`
      2. `<|plamo:tag|>input<|plamo:msg|>` と原文
      3. `<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>ja<|plamo:msg|>`
    - 原文の言語の指定は任意。
    - 用語集は `<|plamo:tag|>glossary` に `<|plamo:index|>原語<|plamo:item|>訳語` の形で渡す。文脈は `<|plamo:tag|>context<|plamo:msg|>` で渡す。
    - 文体は `form=plain|polite` で指定する（日本語に訳すときだけ有効）。
    - 停止トークンは `<|plamo:tag|>` と `<|plamo:bos|>`。
  - Transformers では `apply_chat_template()` の引数 `target_lang`（必須）、`source_lang`、`context`、`glossary`（{source, target} のリスト）、`form` で指定する。
    - オプションはシステムメッセージや原文に混ぜず、これらの引数で渡すよう指示されている。
    - 過去のターンは user と assistant を交互に並べて渡す。
  - 学習時の最大長は、入力と出力の合計で 32,768 tokens。これを超えるなら分割する。履歴もこの上限に含まれる。
  - カードの例は greedy decoding、最大出力 512 tokens、vLLM の `--max-model-len 16384`。
- **Hy-MT2** — [HF Hy-MT2-7B](https://huggingface.co/tencent/Hy-MT2-7B)
  - 基本の指示は "Translate the following text into {target_lang}."（訳文だけを出力させる）。
  - 用途別のテンプレートがある: 用語参照（"Reference the following translations:"）、文体、個人化、区切り記号の保持、構造化データ（JSON/XML）、背景文脈。
  - 構造化データ用のテンプレートには "You MUST preserve the original {format_type} data structure, nesting, hierarchy, and indentation exactly as they are." という規則がある。
  - 既定のシステムプロンプトはない。
  - 推奨値は、1.8B と 7B が temperature 0.7、top_p 0.6、top_k 20、repetition_penalty 1.05、max_tokens 4096。30B-A3B は top_p 1.0、top_k −1、repetition_penalty 1.0。
  - コンテキスト長は書かれていない。
  - Zenn の試用メモには、翻訳の指示は中国語で書くとある。英語の README の例とは食い違う。 — [Zenn kun432](https://zenn.dev/kun432/scraps/527e198418845c)
- **HY-MT1.5**【2025年以前】 — [GitHub HY-MT](https://github.com/Tencent-Hunyuan/HY-MT)
  - ZH↔XX は中国語、XX↔XX は英語で指示する（"Translate the following segment into {target_language}, without additional explanation."）。
  - 書式付きの翻訳では、`<sn>` タグ付きの原文を `<source>` で囲み、出力を `<target>` で受け取る。
- **TranslateGemma** — [HF 12B](https://huggingface.co/google/translategemma-12b-it)
  - user メッセージは1件で、content は "exactly one entry" のリスト（`type`、`source_lang_code`、`target_lang_code`、`text`）。
  - ロールは User と Assistant だけ。それ以外のプロンプト形式は "not officially supported"。
  - 入力は "Total input context of 2K tokens"。
  - Ollama 版のテンプレートは "You are a professional {SOURCE_LANG} ({SOURCE_CODE}) to {TARGET_LANG} ({TARGET_CODE}) translator..." で始まり、空行2つの後に原文を続ける。Ollama のページはコンテキストを 128K と表示しており、HF の 2K と食い違う。 — [Ollama](https://ollama.com/library/translategemma)
- **LFM2-350M-ENJP-MT**【2025年以前】
  - システムプロンプト "Translate to Japanese." または "Translate to English." が必須。ないと "cannot work as intended"。
  - 単発（single-turn）専用。
  - 推奨値は temperature 0.5、top_p 1.0、min_p 0.1、repetition_penalty 1.05。
  - 出典 — [HF](https://huggingface.co/LiquidAI/LFM2-350M-ENJP-MT)
  - コンテキストは 32K tokens だが、短〜中程度の長さの文に最適化されている。 — [Liquid Docs](https://docs.liquid.ai/lfm/models/lfm2-350m-enjp-mt)
- **CAT-Translate**
  - user メッセージに "Translate the following {src_lang} text into {tgt_lang}.\n\n{src_text}" を送る。
  - 7B だけ、チャットテンプレートが他のサイズと違う。
  - コンテキスト長は書かれていない。
  - 出典 — [HF 7B](https://huggingface.co/cyberagent/CAT-Translate-7b)
  - コミュニティ CLI の既定は、コンテキスト 4096、最大出力 2048。 — [cat-translate-cli](https://github.com/Shuichi346/cat-translate-cli)
- **Qingqiu-MT-9B**
  - テンプレートは "Translate the following {src_lang} text into {tgt_lang}. Strictly follow the instruction below. Output only the translation." の後に `instruction:` と `text:` を続ける。
  - 言語は略号でなく英語名で書き、本文の段落は空行で区切る。
  - 推奨値は temperature 0.3、top_p 0.9、top_k 20、repetition_penalty 1.05、`enable_thinking=False`。transformers 5.2.0 以上が必要。
  - 出典 — [HF](https://huggingface.co/WPS-Qingqiu/Qingqiu-MT-9B)
- **Lumen_wmt26**
  - `Human:`/`Assistant:` 形式で、"Please translate the following text into {tgt_lang}:" の後に `#guidelines` と `#src_text` を続ける。
  - コンテキストは 4096 tokens で、カードは "a hard limit rather than a soft recommendation" としている。
  - 出典 — [HF](https://huggingface.co/ATH-MaaS/Lumen_wmt26)
- **RFMT**
  - チャットテンプレートの引数で domain、style、glossary を指定できる。
  - FIM 用のトークン（`<|fim_prefix|>`、`<|fim_suffix|>`、`<|fim_middle|>`）と `generation_prefix` 引数もある。
  - Transformers 5.5.4 と vLLM 0.19.1 で動作確認されている。
  - 出典 — [HF](https://huggingface.co/tohoku-nlp/RFMT)
- **Marco-MT-Algharb**【2025年以前】
  - プロンプトは `Human: Please translate the following text into {target_language}: \n{source_text}<|im_end|>\nAssistant:`。
  - 最高品質を出すには、temperature 1 で100件サンプリングし、Unbabel/wmt22-cometkiwi-da で選び直す MBR を推奨している。
  - 出典 — [HF](https://huggingface.co/AIDC-AI/Marco-MT-Algharb)
- **Seed-X**【2025年以前】: チャットテンプレートはなく、プロンプトの末尾に `<ja>` などの言語タグを付けることが必須とされる。マルチターンは避けるよう指示されている。 — [HF](https://huggingface.co/ByteDance-Seed/Seed-X-PPO-7B)
- その他のコンテキスト長:
  - Command A Translate: 入力 8K・出力 8K。 — [HF](https://huggingface.co/CohereLabs/command-a-translate-08-2025)
  - Tower-Plus-9B: 8192 tokens。 — [HF](https://huggingface.co/Unbabel/Tower-Plus-9B)
  - NLLB-200: 最大 512 tokens で、1文単位の翻訳向け。 — [HF](https://huggingface.co/facebook/nllb-200-distilled-600M)

**Markdown・書式・長文での挙動**
- **Hy-MT2 1.8B を Mac で試した結果**（2026-05-26、temperature 0.7）。出典 — [lilting.ch](https://lilting.ch/en/articles/hymt2-local-translation-30b-a3b)
  - Markdown: コードブロックは保たれた。ただし "listening" が英語のまま残り、動詞の訳が実行ごとに揺れた。
  - HTML: タグ、属性、class 名が保たれ、訳されたのは表示テキストだけだった。
  - JSON: キーと `{{username}}` が保たれた。
  - 用語集: 指定した訳語がそのまま出力された。
  - SRT: 番号とタイムコードは保たれたが、プロンプトの中の指示見出しまで日本語に訳された。
- **PLaMo 3 Translate** — [PFN tech blog](https://www.preferred.jp/en/blog/tech/plamo-3-translate-weight-release)
  - 社内の SaaS ベンチマーク（EN→JA）は、HTML を含む実際のリクエスト形式での評価で、`<code>` や `<a href>` などのタグを保ったまま Web ページを訳せるかを見ている。Markdown への言及はない。
  - 学習データには「File translation」も含まれるが、長さの上限は書かれていない。
- **LFM2-350M-ENJP-MT**【2025年以前】: 改善の余地がある点として、極端に長い文脈、技術・専門用語（医療・法律・エンジニアリング）、新しい固有名詞、ドメイン固有の用語を挙げている。 — [HF](https://huggingface.co/LiquidAI/LFM2-350M-ENJP-MT)
- **Lumen の推論パイプライン**（Markdown への言及はない）。出典 — [HF Lumen_wmt26](https://huggingface.co/ATH-MaaS/Lumen_wmt26)
  - 入力を HTML、JSON、プレーンテキストに分類する。
  - HTML はテキストノードと属性（alt、title、placeholder、aria-label）、JSON は文字列値を個別に訳してから、構造を組み立て直す。
  - プレーンテキストは文単位で分割する。
  - 空の出力、長さの外れ値、繰り返しループ、原文のコピーを検出して再生成する。
- **WMT26 の指示**: software ドメインでは JSON キーとプレースホルダを保つことが求められ、プロンプトには "Maintain the HTML formatting of the original source text." や、入力と同じ形式の有効な JSON を出すよう求める文が入っている。 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- **WMT26 の MakotoAI**（商用 LLM 6種を言語対ごとに振り分ける unconstrained システム。Appendix B.14）。出典 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
  - 構造化出力（JSON・HTML）の修復は、モデルによる再試行ではなく、小さな決定的な正規化処理で行った。
  - 実データでのアブレーションでは、事後に検証して再試行させる指示は、正常な文書では効果がなく、JSON 文書ではかえって悪化させた。決定的な処理でコードフェンスや前置きを取り除けば、推論コストなしで狙った効果が得られた。
  - 構造チェックができる 1,914 文書はすべて整合した。欠陥のあった4文書（途中で切れた3件、繰り返しループ1件）は再生成した。
- **既存の VS Code 拡張 md-ja-preview**（MIT）。出典 — [md-ja-preview](https://github.com/YuuKamegai/md-ja-preview)
  - ローカルの Ollama が既定で、既定モデルは翻訳特化ではない `qwen3.5:9b-q4_K_M`。推論過程が出力に漏れるため、thinking は既定でオフ。
  - ブロック単位で上から順に、1つずつ訳す。
  - コードフェンス、水平線、生の HTML は訳さない。
  - 1,500文字を超えるリストは項目ごとに分ける。
  - インラインコードやリンクの URL が変わった訳は採用しない。
  - モデル名と原文をキーにキャッシュし、保存時には変更されたブロックだけを訳し直す。
  - タイムアウトはブロックあたり120秒。クラウドのバックエンドはオプトインのみ。
- Markdown 翻訳ツール md-translator は、コードブロック、LaTeX、FrontMatter、リンクをプレースホルダに置き換えてから翻訳する。 — [md-translator](https://github.com/rockbenben/md-translator)
- Qiita の記事では、Ollama を使うアプリで ``` や ~~~ のブロックをモデルに送らない設計にしている。 — [Qiita](https://qiita.com/Common_/items/008e06fe55939231c68e)

### Inferences
- 用語集・文脈・文体を正式なパラメータとして受け取れるモデルと、受け取れないモデルがある。
  - 受け取れる: PLaMo 3 Translate（テンプレート引数）、Hy-MT2（専用テンプレート）、RFMT（テンプレート引数）、Qingqiu（自由記述の instruction 欄）。
  - 受け取れない: TranslateGemma、LFM2-ENJP、Seed-X は追加の指示を受ける設計ではないので、「マークアップを保持せよ」のような指示が効く保証はない。
- PLaMo 3 Translate は、オプションをシステムプロンプトや原文に入れないよう求めている。自然言語で「Markdown を保て」と指示するやり方は取れないので、拡張側で AST 分割とプレースホルダ退避を行って Markdown を守る必要がある。
- TranslateGemma（2K tokens）や Lumen（4096 tokens）の上限は、README をブロック単位に分ける設計なら大きな問題にならない。ただし文書全体の文脈（用語の一貫性）は失われる。この点では、32K tokens まで扱えて文脈と用語集を渡せる PLaMo 3 Translate が有利。
- Hy-MT2 は推奨 temperature が 0.7 で、同じ原文でも訳が揺れることが実測で確認されている。プレビューの安定性とキャッシュの一貫性を重視するなら、温度を下げるか、キャッシュを必須にすることを検討すべき（推論）。
- Hy-MT2 の SRT テストで指示見出しまで訳されたのは、指示と本文を同じ入力に混ぜたためと考えられる（推論）。拡張では、指示は公式テンプレートの決まった位置にだけ入れ、本文にはプレースホルダ化した Markdown の断片だけを渡すのが安全。
- MakotoAI の報告からも、構造の保持は「モデルに再試行させる」より「決定的な前後処理（退避・正規化・検証）」に任せるほうが効果的と考えられる。

### Gaps
- 表、脚注、front matter、生の HTML を含む Markdown で、どのモデルかを体系的にテストした公開評価は見つからなかった。
- PLaMo 3 Translate、CAT-Translate、Qingqiu を Ollama や LM Studio で動かした実績（チャットテンプレートの互換性を含む）は確認できなかった。
- Hy-MT2、CAT-Translate、Qingqiu、Seed-X のコンテキスト長は公称値が書かれていない（Hy-MT2 は推奨 max_tokens の 4096 だけ）。
- TranslateGemma に 2K tokens を超える入力を与えたときの品質低下は、数値で示されていない。
- Hy-MT2 30B-A3B の GGUF（7/23 更新）が今の llama.cpp で動くかは確認していない。

## Q5. Apple Silicon 上の速度とメモリ

### Takeaway
報告されている Mac での実測値では、PLaMo 3 Translate が最も速い。

| モデル | 機種・ランタイム | 速度 | メモリ・サイズ |
|---|---|---|---|
| PLaMo 3 Translate 2B | M1 Max、MLX 4bit | 107〜170 tok/s | 読み込み時 約2.6GB |
| PLaMo 3 Translate 2B | M1 Max、llama.cpp | 111〜141 tok/s | Q4_K_M 1.81GB |
| PLaMo 3 Translate 0.8B | M2 Pro、コミュニティ版 MLX 4bit | 257〜352 tok/s | ピーク 約0.6GB |
| Hy-MT2 1.8B（Q4_K_M） | M1 Max、llama.cpp | 56〜60 tok/s（短文の EN→JA は 370ms） | 約1.1GB |

TranslateGemma は、Mac Studio で1ページあたり 12B が約66秒、27B が約122秒かかった。MacBook Air（16GB）では、汎用の 9〜12B モデルより遅かった。

### Cited Findings
- **PLaMo 3 Translate 2B**（M1 Max）
  - MLX 4bit: 融合した Metal カーネルを使うと 170 tok/s、標準の MLX 演算では 107 tok/s。BF16 では 55 tok/s。 — [plamo-translate-cli PR #31](https://github.com/pfnet/plamo-translate-cli/pull/31)
  - llama.cpp のデコード速度（英語のテスト用入力）。 — [plamo-translate-cli](https://github.com/pfnet/plamo-translate-cli)

| GGUF | ドラフト | 速度 |
|---|---|---|
| Q4_K_M | なし | 111 tok/s |
| Q4_K_M | 0.8B Q4_0 | 132 tok/s |
| Q4_0 | なし | 134 tok/s |
| Q4_0 | 0.8B Q4_0 | 141 tok/s |

  - MLX の既定モデルは読み込み時に 4bit に量子化され（元の重みは 5.76GB）、読み込み中に約2.6GB を使う。llama.cpp の既定は Q4_K_M の GGUF（1.81GB）。 — [plamo-translate-cli](https://github.com/pfnet/plamo-translate-cli)
- **PLaMo 3 Translate 0.8B**（コミュニティ版 MLX 4bit、Mac mini M2 Pro 32GB）: デコードは 257〜352 tok/s。MLX が管理するピークメモリは 593MB（重み 501MB＋KV と作業領域 約90MB）、Python プロセス全体の RSS は 1.12GB。 — [HF sizumita/plamo-3-translate-0.8b-mlx-4bit-compact](https://huggingface.co/sizumita/plamo-3-translate-0.8b-mlx-4bit-compact)
- **PLaMo 3 Translate 8B / 31B**: MLX 4bit 版のサイズは 8B が約6.1GB、31B が約18.7GB（macOS アプリ SelectTranslate の issue での記載）。 — [SelectTranslate issue #24](https://github.com/hiroaki-dev/SelectTranslate/issues/24)
- **参考（Mac 以外）**: RTX 4070 Ti と llama.cpp での1行あたりの中央値は、PLaMo 0.8B 70ms、Hy-MT2 1.8B 135ms、PLaMo 2B 160ms、PLaMo 8B 337ms。 — [Playto](https://playto.dev/blog/plamo-3-translate/)
- **Hy-MT2 1.8B Q4_K_M**（1.08GB）の実測（2026-05-26）。MacBook Pro M1 Max 64GB、llama.cpp build 8990（Metal）、ctx 4096（KV 256MB）。 — [lilting.ch](https://lilting.ch/en/articles/hymt2-local-translation-30b-a3b)

| ケース | 遅延 | 速度 |
|---|---|---|
| EN→JA 短文 | 370ms | 59.5 tok/s |
| JA→EN ニュース | 590ms | 56.1 tok/s |
| JSON の UI 文字列 | 1.9s | 56.1 tok/s |
| SRT 3ブロック | 5.4s | 57.4 tok/s |
| 用語集指定（キャッシュが温まった後） | 220ms | 139 tok/s |

- **Hy-MT2 1.8B の 1.25bit 版**: ベンダーの説明では約440MB で、推論が約1.5倍速い。 — [HF Hy-MT2-7B](https://huggingface.co/tencent/Hy-MT2-7B)。ただし 2026-05-26 時点では、標準の llama.cpp で読み込めなかった。 — [lilting.ch](https://lilting.ch/en/articles/hymt2-local-translation-30b-a3b)
- **Hy-MT2 30B-A3B**: Zenn の試用で約60GB の VRAM を使い、FP8 版は動かなかった。 — [Zenn kun432](https://zenn.dev/kun432/scraps/527e198418845c)
- **TranslateGemma**
  - Mac Studio と Ollama で PDF を翻訳した例（2026-04-14）: 1ページあたり 12B が約66秒、27B が約122秒。Qwen3 8B と比べて 12B が約3.2倍、27B が約1.8倍速かった。筆者は、翻訳特化モデルが訳文だけを出力するためと説明している。 — [Zenn qsrh](https://zenn.dev/qsrh/articles/arq-pdf-translate-20260414)
  - MacBook Air M2 16GB と LM Studio で24件を翻訳した例（2026-10-15）: TranslateGemma 12B が約5分35秒、Gemma 4 12B QAT が約4分34秒、Qwen3.5 9B MLX 4bit が約3分。 — [はちみつブログ](https://hunny-hachimitsu.hatenablog.com/entry/2026/10/15/220801)
  - Ollama 版のサイズは 4B 3.3GB、12B 8.1GB、27B 17GB。 — [Ollama](https://ollama.com/library/translategemma)
- **CAT-Translate 7B**: i1-Q4_K_M は約4.6GB。速度とメモリの実測値は見つからなかった。 — [cat-translate-cli](https://github.com/Shuichi346/cat-translate-cli)

### Inferences
- 対話的なプレビュー（段落ごとに数百ms〜1秒程度）を目標にすると、メモリ量ごとの現実的な選択は次のとおり。
  - 8〜16GB の Mac: PLaMo 3 Translate 0.8B/2B（MLX 4bit）か Hy-MT2 1.8B（Q4_K_M）。
  - 16GB 以上（品質重視モード）: PLaMo 3 Translate 8B（約6GB）か Hy-MT2 7B。
  - 32GB 以上: Qingqiu-MT-9B や Lumen（量子化が必要）。
- ここに挙げた数値は、計測者、チップ、ランタイムがすべて違うので、厳密な比較には使えない。たとえば Hy-MT2 1.8B の約57 tok/s と PLaMo 2B の 111 tok/s（どちらも M1 Max の llama.cpp）の差には、設定の違いも影響している可能性がある。
- TranslateGemma については、「汎用 LLM より出力が短いので速い」という報告と「MacBook Air では汎用モデルより遅い」という報告の両方がある。モデルサイズ（12B）が効いていると考えられ、Mac で低遅延を狙うなら 4B に限られる（推論）。

### Gaps
- M3/M4 世代の Mac で、これらのモデルを同じ条件でベンチマークした結果は見つからなかった。
- 次のモデルは、Mac での tok/s が見つからなかった: PLaMo 3 Translate 8B/31B、Hy-MT2 7B、CAT-Translate、LFM2-ENJP、Qingqiu、Lumen。
- プロンプト処理（prefill）の速度と最初のトークンが出るまでの時間は、Hy-MT2 の遅延値を除いてほとんど報告がない。

## Q6. ランク付きショートリスト：「Mac 上でのローカル EN→JA 技術 Markdown 翻訳」

### Takeaway
推奨順位は次のとおり。

| 順位 | モデル | 推奨サイズ |
|---|---|---|
| 1 | PLaMo 3 Translate | 標準 2B（品質モードは 8B、速度モードは 0.8B） |
| 2 | Hy-MT2 | 1.8B / 7B |
| 3 | CAT-Translate | 1.4B / 3.3B |
| 4 | TranslateGemma | 4B / 12B |
| 5 | Qingqiu-MT-9B / Lumen | メモリの大きい Mac 向けの実験枠 |

配布ライセンスの扱いやすさを最優先するなら、1位と2位を入れ替える。つまり Hy-MT2 を既定にし、PLaMo 3 Translate はオプトインにする。どのモデルを選んでも、Markdown の構造は拡張側の分割・退避・検証で守る必要がある。

### Cited Findings
- **PLaMo 3 Translate**
  - 2026-11-05 公開、53言語。公式の GGUF と MLX-4bit があり、32,768 tokens まで扱える。用語集、文脈、敬体/常体を指定できる。 — [PFN tech blog](https://www.preferred.jp/en/blog/tech/plamo-3-translate-weight-release), [HF 8B](https://huggingface.co/pfnet/plamo-3-translate-8b)
  - 2B は M1 Max で 107〜170 tok/s。 — [PR #31](https://github.com/pfnet/plamo-translate-cli/pull/31)
  - 第三者のゲーム向けテストでは、EN→JA が 2B 7.34 に対し Hy-MT2 1.8B は 5.89。 — [Playto](https://playto.dev/blog/plamo-3-translate/)
  - ライセンスは、売上10億円以下なら商用でも無償（登録制）。 — [HF 8B](https://huggingface.co/pfnet/plamo-3-translate-8b)
- **Hy-MT2**
  - Apache-2.0。 — [LICENSE.txt](https://huggingface.co/tencent/Hy-MT2-7B/blob/main/LICENSE.txt)
  - 公式 GGUF と Ollama（hf.co 経由）で動く。 — [HF 1.8B-GGUF](https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF)
  - Mac での試用で、コードブロック、HTML、JSON のプレースホルダが保たれた。 — [lilting.ch](https://lilting.ch/en/articles/hymt2-local-translation-30b-a3b)
  - Playto は既定モデルに Hy-MT2 1.8B を採用している。 — [Playto](https://playto.dev/blog/plamo-3-translate/)
- **CAT-Translate**: MIT ライセンスで日英専用。実務系ベンチマークでの EN→JA の BLEU は 1.4B が 34.19、3.3B が 34.80 で、TranslateGemma-12b の 28.68 を上回る（ベンダー評価）。 — [HF 7B](https://huggingface.co/cyberagent/CAT-Translate-7b)
- **TranslateGemma**
  - Ollama の公式タグがある。入力は 2K tokens までで、テンプレートは固定。 — [Ollama](https://ollama.com/library/translategemma), [HF 12B](https://huggingface.co/google/translategemma-12b-it)
  - WMT26 の予備比較では、English→Japanese が 67.5（27B）。 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- **Lumen と Qingqiu-MT-9B**: WMT26 の EN→JA 人手評価で、それぞれ 90.6（トップクラスタ）と 85.2。どちらも Apache-2.0。 — [WMT26 Findings PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf), [HF Lumen](https://huggingface.co/ATH-MaaS/Lumen_wmt26), [HF Qingqiu](https://huggingface.co/WPS-Qingqiu/Qingqiu-MT-9B)

### Inferences
**ランク付きショートリスト**（2026-11-09 時点の推奨。Q1〜Q5 の出典に基づく総合判断）

1. **PLaMo 3 Translate**（標準は 2B、品質モードは 8B、超低遅延なら 0.8B）
   - 理由:
     - 日本語を主眼に置く開発元による、最新のモデル（2026-11-05）。
     - Apple Silicon 向けの MLX-4bit と GGUF が公式に提供されている。Mac での実測も最速（2B で 107〜170 tok/s、0.8B で 257〜352 tok/s）。
     - 32K tokens のコンテキストに文脈と用語集を渡せるので、技術用語の一貫性を保ちやすい。
     - 敬体と常体を選べる。
     - 社内ベンチマークに HTML タグを保持できるかの評価が入っている。
     - 第三者テストの EN→JA で Hy-MT2 1.8B を上回った。
     - 公式 CLI にサーバーモードと MCP があり、拡張から呼び出しやすい。
   - 注意点:
     - ライセンスの条件として、売上10億円の閾値と商用登録がある。2024年版の規約では「Built with PLaMo」表示も必要。
     - 公開されたばかりで、技術文書や Markdown での独立評価はない。
     - 自由記述の指示は使えない。
     - Ollama と LM Studio で動くかは確認できていない。
2. **Hy-MT2**（標準は 1.8B、品質モードは 7B）
   - 理由:
     - Apache-2.0 なので、自動ダウンロードも同梱も問題ない。HY-MT1.5 にあった EU・英国・韓国の除外もない。
     - 公式 GGUF があり、Ollama（hf.co 経由）と LM Studio で動く。
     - 用語、文体、区切り記号、構造化データの保持に専用のテンプレートがある。
     - Mac での実測で、コードブロック、HTML、JSON のプレースホルダが保たれた。1.8B は約1.1GB と軽い。
     - 製品での採用例がある（Playto の既定モデル）。
     - 競合する Qingqiu のペア比較でも、IF-WMT25 の en→ja では HY-MT2-7B が Qingqiu-MT-9B に勝ち越している（IFMTBench の en→ja では逆）。
   - 注意点:
     - 第三者テストでは、EN→JA が PLaMo 2B に劣る。
     - 英単語が訳されずに残る、推奨 temperature 0.7 で訳が揺れる、指示文まで訳してしまう、という挙動が報告されている。
     - 1.25bit 版と 30B-A3B は、5月時点では標準の llama.cpp で動かなかった。
     - 公式の MLX 版がない。
3. **CAT-Translate**（1.4B / 3.3B。品質重視なら 7B）
   - 理由:
     - MIT ライセンス。
     - EN↔JA 専用で、ベンダーの BLEU では実務系の評価（会話、法廷通訳、医療、特許など）で TranslateGemma-12B、Tower+ 9B、PLaMo 2、LFM2-ENJP を上回る。
     - Apple Silicon で使えるコミュニティ CLI がある。
   - 注意点:
     - 独立評価がない。
     - 書式の保持とコンテキスト長について記載がない。
     - 量子化版はコミュニティ製だけ。
     - 評価指標が BLEU だけ。
4. **TranslateGemma**（4B。12B は 16GB 以上の Mac で）
   - 理由:
     - 導入が最も簡単（Ollama の公式タグ、LM Studio、MLX アプリでの実績）。
     - Gemma Terms は商用利用を認めている。
     - 55言語に対応し、JA→EN にもそのまま使える。
   - 注意点:
     - 入力は 2K tokens まで。
     - テンプレートが固定で、用語集や追加の指示に公式には対応していない。
     - WMT26 の予備比較で、汎用の Gemma 4 31B に大差で負けた（English→Japanese で 67.5 対 89.3）。
     - MacBook Air では汎用モデルより遅いという報告がある。
     - Gemma 3 ベースの旧世代。
5. **Qingqiu-MT-9B / Lumen（14.8B）**（32GB 以上の Mac で、品質を最優先する実験枠）
   - 理由:
     - Apache-2.0。
     - WMT26 の EN→JA 人手評価で、翻訳特化オープンモデルの最上位（Lumen はトップクラスタ）。
     - 指示に従うことと書式を保つことを前提に学習されている。
   - 注意点:
     - コンペに投稿された研究モデルで、公式の GGUF と MLX がない。
     - Lumen は 4096 tokens が上限で、構造の保持は外部のパイプラインに頼っている。
     - どちらもメモリの負荷が大きい。

**補欠**: LFM2-350M-ENJP-MT。超軽量で、GGUF・MLX・ONNX があり、32K tokens を扱えるので、すぐに下訳がほしいときや性能の低いマシンの代替には使える。ただし、技術用語と新しい固有名詞に弱いことをベンダー自身が認めており、ライセンスには年商1,000万ドルの閾値がある。

**非推奨**:
- HY-MT1.5 / Hunyuan-MT: 地域を除外するライセンス。Hy-MT2 で代替できる。
- Command A Translate / Tower+ / NLLB: 非商用ライセンス。さらに、それぞれ次の欠点がある。
  - Command A Translate: 111B で、一般的な Mac には大きすぎる。
  - Tower+ 9B: WMT26 の EN→JA で 69.9 と下位。
  - NLLB: 512 tokens までの文単位翻訳。
- Seed-X: チャットテンプレートがなく、作者は非公式の量子化版を勧めていない。2025年から更新もない。
- Qwen-MT: API でしか使えない。
- Meta OMT: 重みが公開されていない。

**設計上の前提（全候補に共通）**
md-ja-preview や md-translator と同じく、拡張側で次の処理を行う。
- Markdown をブロック単位に分ける。
- コードフェンス、インラインコード、URL、front matter、生の HTML をプレースホルダに退避する。
- 訳文の構造を決定的に検証する。壊れていれば採用しないか、再試行する。
- 原文のハッシュとモデル名をキーにしてキャッシュする。

翻訳特化モデルは、「指示で Markdown を守らせる」より「訳すべき本文だけを渡す」使い方のほうが安定する。根拠は次の3点。
- Hy-MT2 で指示文が訳文に混入した。
- TranslateGemma はテンプレートが固定されている。
- PLaMo 3 は、引数で渡す以外の指示を受け付けない。

MakotoAI の報告（決定的な後処理のほうが再試行より有効だった）も、この考え方を裏づける。

### Gaps
- 技術 Markdown（README や設計メモ）の EN→JA で、上位候補（PLaMo 3 Translate 2B/8B、Hy-MT2 1.8B/7B、CAT-Translate 3.3B、TranslateGemma 4B/12B）を直接比べた公開評価はない。実際のプロジェクトの文書で、プレースホルダの保持率、訳抜け、用語の一貫性、遅延を自分でベンチマークすることが望ましい。
- PLaMo Community License のもとで、公開されている VS Code 拡張がモデルを自動ダウンロードする場合、誰が登録義務を負うのか、表示要件をどう運用するのかは確認できていない。PFN への確認が必要。
- PLaMo 3 Translate、CAT-Translate、Qingqiu を一般向け VS Code 拡張の既定として Ollama から呼べるかは確認できていない。
