# 英語→日本語翻訳におけるLLM品質の独立エビデンス(フロンティア/小型・オープンモデル、文書レベル・書式保持)— 2026年11月9日時点

凡例: 【人手】人手評価 / 【自動】自動指標(BLEU・chrF・COMET・MetricX・LLM-as-judge 等) / 【独立】開発元と独立した評価 / 【ベンダー】開発元または利害関係者による評価・主張 / 【2026年より前】2025年以前の結果。数値は原典の表記のまま。

## Q1. WMT25/WMT26 General MT の英→日人手評価は何を示しているか(WMT26 の結果は公開済みか)

### Takeaway
WMT26 の Findings は WMT 2026(2026年10月28–29日)の論文集で公開済み。英→日の人手評価(cESA)では、Gemini 3.1 Pro(90.3)、Gemini・GPT-5.5・DeepSeek-V4-Pro を使うエージェント型システム、14B の翻訳特化モデル Lumen(90.6)が首位クラスタを形成した。GPT 5.5(86.1)と Qingqiu-MT-9B(85.2)が次のクラスタ、Gemma 4 31B(80.5)と Gemma 4 4B(77.3)が中位で、Qwen 3.5 9B(57.4)が最下位だった。Claude は単体のベースラインに含まれていない。2025年の WMT25 では Claude-4(79.3)が Gemini-2.5-Pro(85.8)を下回っていた。

### Cited Findings

#### WMT26(2026年10月公開)
- WMT26 General MT の Findings(Kocmi et al.、副題 "Contrastive Dynamic Human Evaluation at Scale")は公開済み。
  - 評価したのは46システムで、内訳は参加システム30と、LLM・商用翻訳16。
  - 人手評価プロトコルは contrastive Error Span Annotation(cESA)。
  - テストデータは HTML/JSON の構造を保った文書単位。
  - 形式(formality)と構造スタイルに関する文脈指示が新たに導入された。
  - [Source](https://aclanthology.org/2026.wmt-main.48/); [PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- 【人手・独立】英→日 cESA の最終順位。Docs はシステムごとに評価された文書数で、168〜192。

  | 順位 | システム(構成) | cESA | Docs |
  |---|---|---|---|
  | 1-4 | Lumen(constrained、Qwen3/Qwen3.5 14B+4B パイプライン) | 90.6 | 191 |
  | 1-4 | Wayfinder(Gemini 3.1 Pro/Gemini 3.5 Flash/GPT-5.5/Qwen 3.7 Max の候補を統合するエージェント) | 90.6 | 192 |
  | 1-4 | SCIR-TG-MT(DeepSeek-V4-Pro+エージェント) | 90.4 | 189 |
  | 1-4 | Gemini 3.1 Pro(主催者ベースライン) | 90.3 | 189 |
  | 5 | TRIVE(Gemini-3.5-Flash エージェント) | 88.3 | 185 |
  | 6-11 | HW-TSC | 86.2 | 181 |
  | 6-11 | GPT 5.5(主催者ベースライン) | 86.1 | 184 |
  | 6-11 | UvA-MT(GPT-5.4+Gemini-3.5-Flash) | 86.1 | 182 |
  | 6-11 | Human (postediting) | 86.0 | 187 |
  | 6-11 | Dubformer(Claude Sonnet 4.6/Claude Opus 4.8/Gemini 3.1 Pro) | 85.4 | 177 |
  | 6-11 | Qingqiu-MT-9B(constrained、Qwen3.5-9B) | 85.2 | 182 |
  | 12-15 | MakotoAI | 83.4 | 178 |
  | 12-16 | DeepSeek V4 Pro(主催者ベースライン) | 83.2 | 168 |
  | 12-16 | Cohere CAT+ | 83.2 | 171 |
  | 12-19 | SRPOL | 81.7 | 178 |
  | 13-18 | Command A+ | 81.4 | 177 |
  | 15-20 | RFMT | 81.2 | 185 |
  | 15-20 | Gemma 4 31B | 80.5 | 172 |
  | 17-21 | SalamandraTA | 80.2 | 168 |
  | 16-22 | PseudoRef | 79.6 | 171 |
  | 19-23 | GPT OSS 120B | 78.2 | 172 |
  | 20-23 | Tiny Aya Global | 77.7 | 177 |
  | 21-23 | Gemma 4 4B | 77.3 | 176 |
  | 24-25 | Mistral Medium 3.5 | 74.1 | 177 |
  | 24-25 | GPT OSS 20B | 72.4 | 188 |
  | 26-29 | Tower+ 9B | 69.9 | 174 |
  | 26-29 | GoogleTranslate | 69.4 | 189 |
  | 26-29 | Qwen 3.6 27B | 68.7 | 181 |
  | 26-29 | Ministral 3 14B | 68.6 | 172 |
  | 30 | GLM 4 9B | 65.0 | 178 |
  | 31 | Qwen 3.5 9B | 57.4 | 177 |

  出典: Findings 本文の英→日表、表6、付録B — [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- 英→日の評価者は Microsoft のアノテーター49名。対象言語ネイティブのバイリンガルで、プロ翻訳者や言語専門家として MT 評価の経験を持つ。1セグメントあたりの平均作業時間は36.5秒 — [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- LLM ベースラインの翻訳条件:
  - 統一パイプラインで、zero-shot の指示追従方式を使った。
  - 文書全体を1パスで翻訳した。
  - 主催者の公式プロンプトを使った。
  - [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- 公式プロンプト(付録 A.6):
  - ニュースと Fact-checking には次の2文が含まれる。
    - "Produce only the {TRG} translation, without any additional explanations or commentary."
    - "Maintain the HTML formatting of the original source text."
  - ソフトウェアドメインは JSON 形式。
    - JSON の値(ユーザー向け文言)だけを訳す。
    - キー、プレースホルダ({{count}} など)、その他の技術的内容は訳さない。
    - 出力は有効な JSON で、入力形式と一致させる。
  - [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- 英→日でドメイン別に最上位だったシステムの平均スコア:
  - Software 96.7
  - News 93.7
  - Speech 88.2
  - Social 87.2
  - 全体平均 91.4
  - [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- 言語対ごとの最高スコアの幅は、61(英→北サーミ語)から90(英→日、チェコ→ベトナム)。85–100 は "Very good"(ほぼ完全な意味の転移)の帯 — [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- constrained トラックの英→日順位:

  | 順位 | システム | cESA |
  |---|---|---|
  | 1 | Lumen | 90.6 |
  | 2 | Qingqiu-MT-9B | 85.2 |
  | 3-4 | RFMT | 81.2 |
  | 3-4 | SalamandraTA | 80.2 |
  | 5-6 | Tiny Aya Global | 77.7 |
  | 5-6 | Gemma 4 4B | 77.3 |
  | 7 | GPT OSS 20B | 72.4 |
  | 8-9 | Tower+ 9B | 69.9 |
  | 8-9 | Ministral 3 14B | 68.6 |
  | 10 | GLM 4 9B | 65.0 |
  | 11 | Qwen 3.5 9B | 57.4 |

  [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- 全言語対で首位クラスタに入った回数(23言語対中):
  - Wayfinder 17
  - Gemini 3.1 Pro 15
  - TRIVE 14
  - Lumen 13
  - 上位3システムはいずれも Gemini を使っている。
  - constrained トラックでは Lumen が20/23で首位クラスタに入り、次点は Qingqiu-MT-9B。
  - [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- 付録Bに記載された主要システムの構成 — [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf):
  - Wayfinder:
    - 4つの API システムの訳から文書単位の候補プールを作る。
    - DeepSeek-V4-Pro のランカーで順位付けする。
    - 匿名化した pick-or-rewrite エージェントが最終訳を選ぶか書き直す。
    - 保守的なポストチェックで欠陥を除く。
  - Lumen:
    - Qwen3-14B を主体に、CPT と SFT、オンライン選好最適化、教師モデルからの蒸留で学習した。
    - 推論時は構造認識型の推論と選択的修復で書式を保つ。
    - モデルは HF で "Lumen_wmt26" として公開されている。
  - Qingqiu-MT-9B:
    - Qwen3.5-9B に、2段階の SFT と GRPO による強化学習を行った。
    - 合成した指示データには用語集制約が含まれる。
  - Dubformer:
    - Web 文書は、マークアップをマスクしたセグメントに分解して翻訳する。
    - 別系統のモデルが各セグメントの幻覚などを検査し、却下されたものは再翻訳する。
- 【自動・参考】人手翻訳の下訳に使うモデルを選ぶための予備比較。
  - 条件: WMT25 の英語原文テスト、参照なし GEMBA-ESA、judge は GPT-5.4。
  - ja 列のスコア:
    - Gemma-4-31B-IT 89.3
    - Qwen3.5-397B-A17B 85.5
    - Command-A-Translate 77.1
    - DeepSeek-V4-Pro 74.6
    - TranslateGemma-27B 67.5
  - WMT26 の人手参照訳は、この上位2モデルの出力をポストエディットして作ってもよい方式。
  - [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- WMT26 のテストスイート(9件)は、英→日も日→英も対象にしていない。対象は en→is、en→ko、en→hi などで、英→日の現象別分析(用語、構造など)はない — [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- 参加システム MakotoAI の報告では、英→日の1文書で出力が切り詰められた。約900文字の原文に対し、出力は8文字だった。この欠陥は再生成で修正された — [Source](https://aclanthology.org/2026.wmt-main.74/)

#### WMT25(2025年、【2026年より前】)
- 【人手・独立】英→日 ESA の順位:

  | 順位 | システム | ESA |
  |---|---|---|
  | 1 | Human(単独で首位クラスタ) | 89.2 |
  | 2-4 | Gemini-2.5-Pro | 85.8 |
  | 2-6 | Algharb | 85.7 |
  | 2-5 | Mistral-Medium | 84.8 |
  | 3-6 | Wenyiil | 84.4 |
  | 5-6 | GPT-4.1 | 83.7 |
  | 7 | CommandA-WMT | 82.2 |
  | 8-12 | Shy-hunyuan-MT | 79.9 |
  | 8-13 | DeepSeek-V3 | 79.3 |
  | 8-13 | Claude-4 | 79.3 |
  | 8-13 | UvA-MT | 79.3 |
  | 8-14 | ONLINE-B | 78.0 |
  | 最下位(人手評価の対象内) | — | 67.8 |

  [Source](https://aclanthology.org/2025.wmt-1.22.pdf)
- 自動指標と人手評価の食い違い:
  - Findings は "Automatic scores are biased" と総括している。
  - Shy-hunyuan-MT は自動ランキングで1言語対を除くすべてで1位だった(英→日の AutoRank は 1.0)。
  - しかし人手評価ではトップ群を大きく下回った。
  - [Source](https://aclanthology.org/2025.wmt-1.22.pdf)
- 全言語対で、文書を一括翻訳できた割合。段落区切りを保てなかった場合、主催者は段落単位に分割して訳し直した。

  | モデル | 一括翻訳できた割合 |
  |---|---|
  | GPT-4.1 | 97.1% |
  | Gemini-2.5-Pro | 95.1% |
  | CommandA | 70.6% |
  | Llama-4-Maverick | 70.4% |
  | Claude-4 | 67.5% |
  | Qwen3-235B | 65.6% |
  | DeepSeek-V3 | 57.2% |
  | AyaExpanse-32B | 54.9% |
  | Mistral-Medium | 54.1% |
  | CommandR7B | 49.3% |
  | AyaExpanse-8B | 43.2% |
  | Qwen2.5-7B | 35.7% |
  | Mistral-7B | 35.1% |
  | Llama-3.1-8B | 27.1% |

  Findings は、文書を一度に訳せないことを現行 LLM の主要な限界の一つとし、原因をコンテキスト長と段落区切りの保持失敗に帰している — [Source](https://aclanthology.org/2025.wmt-1.22.pdf)

### Inferences
- 英→日は、フロンティアにとって高得点が出やすい言語対になった。最高90点は全言語対の最高値タイで、Software ドメインは96.7。品質差が出やすいのは Social/Speech と、構造保持や切り詰めといった欠陥。技術 Markdown は Software・News 寄りなので、上位モデル間の差はさらに小さいと予想される。
- 同じモデルでも、パイプラインで大きく変わる。DeepSeek V4 Pro は単体で83.2、エージェント化した SCIR-TG-MT では90.4(+7.2)だった。Gemini 3.1 Pro は単体で90.3、多モデル統合の Wayfinder で90.6(+0.3)。上位モデル単体はすでに天井近くにあり、中位モデルは検査・修復パイプラインで大きく伸びる。
- GPT 5.5 は Gemini 3.1 Pro より約4ポイント低く、別の有意クラスタに入る。2025年の WMT25 でも GPT-4.1 が Gemini-2.5-Pro を約2ポイント下回っていた。英→日で Gemini 系が GPT 系をわずかに上回る傾向は、2年続いている。
- Gemma 4 31B は、予備比較の GEMBA-ESA(GPT-5.4 judge)では ja が89.3で、オープンモデル中の首位だった。しかし本番の人手評価では80.5で、GPT 5.5 と約6ポイントの差がある。テストセットが異なるので厳密な比較ではないが、LLM-judge の参照なし評価は中位モデルを過大評価しうる。
- Gemma 4 4B(77.3)は GoogleTranslate(69.4)を上回った。ただし Google Translate が HTML 構造入りの文書でどう扱われたかは不明で、NMT サービス一般の評価として扱うべきではない。

### Gaps
- WMT26 には Claude 単体のベースラインがない。Claude 系の2026年時点の英→日人手評価は、Dubformer のような混成パイプライン経由の間接的なものしかない。
- 英→日の誤りの内訳(省略、付加、書式破損、用語不統一)を、言語対別・システム別に集計した表は Findings に見当たらなかった。
- constrained トラックの正式なパラメータ上限は、今回の資料からは確認していない。英→日の constrained 表には GPT OSS 20B(総パラメータ約21B)や RFMT(約18.8B)が含まれる。
- TranslateGemma、HY-MT2、PLaMo 3 Translate は WMT26 の英→日人手評価に単体で出ていない。英→日では、HY-MT2 と TranslateGemma は HW-TSC、SRPOL、PseudoRef などのアンサンブルの部品として使われただけで、モデル単体の寄与は分離できない — [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)

## Q2. WMT 以外の2025–2026年の英日評価(Swallow、Nejumi、学術論文、日本企業ブログ、翻訳アリーナ)は何を示しているか

### Takeaway
WMT 以外の英日比較は、ほぼすべてが自動指標か LLM 判定で、独立した人手評価は WMT に限られる。Swallow(BLEU)では Gemma 4 31B/E4B が GPT-5 とほぼ同水準だった。JP-TL-Bench(LLM 判定)では Gemini 3 系が最上位だが、judge が Gemini 系なので自己選好のリスクがある。日本語の人手選好型の翻訳アリーナは見つからなかった。

### Cited Findings
- Swallow LLM Leaderboard(事後学習済みモデル部門)の翻訳タスク:
  - 日英・英日翻訳(WMT20、ニュース記事、評価尺度は BLEU)が追加されたのは、2026-02-20 の更新履歴の項目。
  - 2026-05-08 に評価フレームワークが v202604 に更新され、推論型モデルの評価は確率的デコーディング(temperature=0.6)に変わった。
  - [Source](https://swallow-llm.github.io/leaderboard/about.ja.html)
- 【自動・独立】Swallow の英→日 BLEU(0–1尺度)。数値は公開データから抽出した。

  | モデル | 英→日 BLEU |
  |---|---|
  | Gemma 4 31B IT | .285 |
  | GPT-4o | .282 |
  | Gemma 4 26B-A4B IT | .280 |
  | GPT-4.1 | .278 |
  | o3 | .276 |
  | GPT-5 | .272 |
  | GPT-5.4 Thinking | .272 |
  | Qwen3.5-122B-A10B | .263 |
  | gpt-oss-120b | .262 |
  | Gemma 4 E4B IT | .261 |
  | Gemma 4 E2B IT | .256 |
  | Qwen3.5-27B | .252 |
  | Gemma 3 27B IT | .250 |
  | Llama 3.1 Swallow 8B Instruct v0.5 | .249 |
  | gpt-oss-20b | .234 |
  | Qwen3-Swallow-8B 系 | .222–.230 |
  | NVIDIA-Nemotron-Nano-9B-v2-Japanese | .207 |
  | Qwen3-8B | .202 |
  | Gemma 3 4B IT | .186 |
  | Qwen3.5-9B | .174 |
  | Qwen3.5-4B | .080 |
  | Qwen3.5-2B | .000 |

  取得したデータには、Claude と Gemini の WMT20 翻訳スコアは含まれていなかった — [Source](https://swallow-llm.github.io/leaderboard/index-post.ja.html)
- Nejumi LLM Leaderboard 4 には翻訳を含むカテゴリーがあるが、英→日翻訳のモデル別スコアは今回取得できなかった(Gaps 参照) — [Source](https://wandb.ai/llm-leaderboard/nejumi-leaderboard4/reports/Nejumi-LLM-Leaderboaed-4--VmlldzoxNDQyMzkxMA)
- JP-TL-Bench(Shisa.AI、arXiv、2026-01-01)の設計 — [Source](https://arxiv.org/html/2601.00223v1):
  - 日英双方向で、アンカー訳とのペア比較を LLM が判定する。
  - Bradley-Terry モデルで集計し、0–10 の LT スコアに正規化する。
  - judge は gemini-2.5-flash。
- 【自動・LLM判定】JP-TL-Bench の英→日 LT スコア — [Source](https://arxiv.org/html/2601.00223v1):

  | モデル | 英→日 LT |
  |---|---|
  | Gemini 3 Pro / Flash | 9.99 |
  | gemini-2.5-pro | 9.97 |
  | DeepSeek-V3.1 | 9.94 |
  | Qwen3-235B | 9.85 |
  | gemma-3-27b | 9.69 |
  | shisa-v2.1-qwen3-8b | 9.21 |
  | Qwen3-8B | 6.72 |
  | LFM2-2.6B | 5.07 |
  | TinySwallow-1.5B | 0.01 |

  Claude、GPT-5 系、PLaMo は比較対象に入っていない。
- 【人手・ベンダー(LSP)】Alconost のブログ(2026-05-01):
  - 日本語では Gemini が72.5(n=22)、Anthropic が71.2(n=23)。
  - 全言語の総合スコア(LE)は Gemini 67.8、Anthropic 58.9、GPT 57.6、DeepL 50.0。
  - 各スコアは1名の言語専門家によるもので、モデルのバージョンは明記されていない。
  - 同社は翻訳・ポストエディットのサービス事業者でもある。
  - [Source](https://alconost.com/en/blog/best-llm-for-translation-2026)
- PFN の評価指標の研究(言語処理学会 NLP2026、C8-1、2026年3月、査読なし)の設計 — [Source](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/C8-1.pdf):
  - 7つの LLM による全対比較で、10個の匿名システム(各50原文)の正解順位を作った。
  - その正解順位と各指標との Spearman 順位相関を測った。
- 【自動・独立系学術】上記研究の結果:
  - 高品質な参照訳を1つ使った場合の英→日:
    - chrF .789
    - BLEU .769
    - MetricX-24 .656
    - 参照なしの MetricX-24 は .500
  - 和→英:
    - chrF .655
    - MetricX-24 .638
    - BLEU .618
    - 参照なしは .412
  - LLM が生成した参照訳を1つだけ使うと、すべての指標で相関が大きく下がる。
  - [Source](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/C8-1.pdf)
- 同研究で、各 judge と基準モデル群の平均との一致度(英→日):
  - 基準モデル群に含まれる judge:
    - Claude Opus 4.5 .939
    - Gemini 3 Pro .930
    - GPT-5.1 .890
  - 公開モデルの judge:
    - DeepSeek V3.2 .843
    - Qwen3 235B .809
    - Kimi K2 .771
    - gpt-oss-120b .691
  - 前の3モデルは基準モデル群そのものの構成員なので、その数値には自己相関が含まれる。
  - [Source](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/C8-1.pdf)
- 【自動・独立】"Translation Analytics for Freelancers II"(arXiv、2026-05-29):
  - ローカル LLM を比較した研究。
  - 英→日 COMET-22 は、translategemma-27b 90.34、GPT-5.2 90.11、DeepL 91.01。
  - [Source](https://arxiv.org/html/2605.31452v1)
- WMT26 の評価指標共有タスク(2026年):
  - LLM-as-judge が、従来型の指標と教師あり学習型の指標をすべて上回った。
  - Gemma 4 は judge としてフロンティアモデルと競合した。
  - 参照なしの judge も競争力があった。
  - [Source](https://aclanthology.org/2026.wmt-main.49/)
- WMT25 の評価指標共有タスク(【2026年より前】):
  - システム単位では、大型 LLM の評価が強い。
  - セグメント単位では、参照ありの古典的指標(YiSi-1、chrF、BERTScore)が上位3クラスタを占めた。
  - エラースパン検出では、最良の自動評価器でも35%を超えることは稀だった。
  - [Source](https://www2.statmt.org/wmt25/pdf/2025.wmt-1.23.pdf)

### Inferences
- 英→日の自動指標による順位は、指標と judge によって大きく入れ替わる。代表例は TranslateGemma で、COMET-22 では GPT-5.2 と同等だが、GEMBA-ESA(GPT-5.4 judge)ではオープン候補中の最下位(67.5)だった。単一の自動指標でモデルを選ぶのは危険。
- Swallow の BLEU は、WMT20 のニュース文が対象で、テストデータの汚染リスクがある古い評価セット。参照1本の BLEU でもある。技術 Markdown の品質を代弁するものではない。ただし、小型モデル間の大まかな差を見る指標としては使える。たとえば Qwen3.5 の小型は英→日が弱く、Gemma 4 の小型は強い。この傾向は WMT26 の人手評価とも一致する。
- 英→日の参照ありの自動評価では、chrF のような文字 n-gram 指標がモデルベースの MetricX-24 と同等以上だった(PFN)。社内評価で参照訳を作れるなら、chrF は安価で十分な補助指標になる。

### Gaps
- Nejumi LB4 の翻訳スコアは、ページが動的に描画されるため本調査では数値を抽出できなかった。
- 2026年時点で、日本語の人手選好型の翻訳アリーナ(LMArena 型)は見つからなかった。
- 英→日について、日本企業の独立した比較ブログで定量的なもの(複数モデル、同一条件)は見つからなかった。PFN のように開発元が出すものはある。
- JP-TL-Bench の judge が Gemini 系である影響(Gemini を有利にするバイアス)を定量化した資料はない。

## Q3. 小型モデル(12B以下: TranslateGemma、Hunyuan-MT/HY-MT、PLaMo翻訳、Seed-X、小型 Qwen/Gemma)はフロンティアとどの程度差があるか

### Takeaway
同一条件の人手評価(WMT26 英→日、文書を丸ごと zero-shot で翻訳)で見ると、Gemini 3.1 Pro(90.3)との差は次のとおり。
- 汎用の小型モデル: Gemma 4 4B が−13.0、GPT OSS 20B が−17.9、Qwen 3.5 9B が−32.9。
- 翻訳特化のファインチューン: Qingqiu-MT-9B が−5.1、Lumen(14B)が+0.3。

ローカル用途で注目される TranslateGemma、HY-MT2、PLaMo 3 Translate には英→日の独立人手評価がない。ベンダーの自動指標と独立の自動指標は食い違っている。

### Cited Findings
- 【人手・独立】WMT26 英→日 cESA の、Gemini 3.1 Pro(90.3)との差。いずれも同じテストセットで、文書単位、zero-shot または参加者のパイプライン。

  | 区分 | システム | cESA | Gemini 3.1 Pro との差 |
  |---|---|---|---|
  | 翻訳特化(研究) | Lumen(14B+4B) | 90.6 | +0.3 |
  | クラウド | GPT 5.5 | 86.1 | −4.2 |
  | 翻訳特化(研究) | Qingqiu-MT-9B | 85.2 | −5.1 |
  | クラウド | DeepSeek V4 Pro | 83.2 | −7.1 |
  | オープン汎用 | Gemma 4 31B | 80.5 | −9.8 |
  | オープン汎用 | GPT OSS 120B | 78.2 | −12.1 |
  | 小型汎用 | Tiny Aya Global(3B) | 77.7 | −12.6 |
  | 小型汎用 | Gemma 4 4B | 77.3 | −13.0 |
  | 小型汎用 | GPT OSS 20B | 72.4 | −17.9 |
  | 翻訳特化 | Tower+ 9B | 69.9 | −20.4 |
  | オープン汎用 | Qwen 3.6 27B | 68.7 | −21.6 |
  | 小型汎用 | Ministral 3 14B | 68.6 | −21.7 |
  | 小型汎用 | GLM 4 9B | 65.0 | −25.3 |
  | 小型汎用 | Qwen 3.5 9B | 57.4 | −32.9 |

  [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- TranslateGemma のテクニカルレポート(2026年1月、【ベンダー】)— [Source](https://arxiv.org/pdf/2601.09012):
  - 【自動】WMT24++ の en→ja_JP における MetricX(低いほど良い):

    | サイズ | TranslateGemma | Gemma 3 |
    |---|---|---|
    | 27B | 3.53 | 4.11 |
    | 12B | 3.82 | 4.30 |
    | 4B | 4.44 | 5.09 |

  - 【人手】MQM は、ja→en で TranslateGemma 27B が13.4、Gemma 3 27B が11.6(低いほど良い)。つまり ja→en では悪化した。原因は固有名詞の誤訳とされている。
  - 人手評価の対象10言語対に、英→日は含まれていない。
- 【自動・独立】TranslateGemma について、独立した自動評価どうしが矛盾している。
  - COMET-22 では、translategemma-27b が90.34で、GPT-5.2(90.11)と同等 — [Freelancers II](https://arxiv.org/html/2605.31452v1)
  - WMT26 の予備比較(GEMBA-ESA、GPT-5.4 judge)の ja 列では、TranslateGemma-27B が67.5で、Gemma-4-31B-IT の89.3を大きく下回る — [WMT26 Findings](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- 【ベンダー】PLaMo 3 Translate(PFN)— [Source](https://huggingface.co/pfnet/plamo-3-translate-8b):
  - 重み公開: 2026年10月下旬
  - サイズ: 0.8B、2B、8B、31B
  - BF16 の自動指標:

    | サイズ | WMT24++ COMET-22(En→Ja) | PFTB(En↔Ja) | SaaS(En→Ja) |
    |---|---|---|---|
    | 31B | .8799 | .6244 | .5786 |
    | 8B | .8805 | .6119 | .5750 |
    | 2B | .8780 | .6061 | .5612 |
    | 0.8B | .8724 | .5862 | .5530 |

  - PFTB と SaaS は PFN の社内ベンチマーク。
  - モデルカードは、2B でも比較対象の翻訳特化 LLM(TranslateGemma、HY-MT2)をすべての指標で上回ると主張している。
- 【ベンダー】PLaMo 3 Translate の量子化による劣化(BF16 との差) — [Source](https://huggingface.co/pfnet/plamo-3-translate-8b):
  - 8B の MLX-4bit:
    - PFTB −.0017
    - SaaS +.0001
    - COMET-22 −.0009
  - GGUF Q2_K は一部の指標で劣化が大きい。たとえば 8B の PFTB は −.0130。
- 【ベンダー】PLaMo 3 Translate の機能(Markdown 翻訳に関係するもの):
  - 周辺文脈と用語集を入力できる。
  - 日本語出力を常体(plain)か敬体(polite)から選べる。
  - 学習時の最大長は、入力と出力の合計で32,768トークン。
  - [Source](https://huggingface.co/pfnet/plamo-3-translate-8b); [PFN blog](https://www.preferred.jp/en/blog/tech/plamo-3-translate-weight-release)
- 【ベンダー・報道】Impress Watch(2026-10-08)の報道:
  - PFN は、自社ベンチマークを含む評価で、「Claude Fable 5.1」「GPT-6.1 Sol」「GPT-6 Astra」などと同等の日本語翻訳精度だと主張している。
  - 第三者による検証は確認できない。
  - [Source](https://www.watch.impress.co.jp/docs/news/2146531.html)
- 【ベンダー】PFN の発表資料(2026-07-30)は、前世代の plamo-2-translate(8B)が日英・英日で TranslateGemma 27B を上回ったとしている — [Source](https://speakerdeck.com/pfn/20260730_pfn_llm_3_plamo-3-translate)
- 【ベンダー】Hy-MT2(Tencent、arXiv 2026年5月)の論文には、日本語に絞った結果も人手評価も見当たらなかった — [Source](https://arxiv.org/html/2605.22064)
- 【自動・ベンダー系列】IFMTBench(Tencent、2026-05-27)— [Source](https://arxiv.org/html/2605.28218):
  - 翻訳の指示追従を測るベンチマーク。
  - 総合スコアは Gemini 3.1 Pro 89.08、Hy-MT2 A3B 85.70。
  - 2B 未満のモデルは、複数の制約を同時に課す項目で崩れる。
- 【ベンダー・2026年より前】Seed-X(ByteDance、arXiv 2025年7月)— [Source](https://arxiv.org/abs/2507.13618v2):
  - 7B の翻訳特化モデル。
  - 大型モデルと同等という主張は開発元によるもの。
  - 日本語の内訳は確認できなかった。
- 【人手・独立・2026年より前】WMT25 の英→日で、Tencent 系の Shy-hunyuan-MT は人手評価79.9(8–12位)。Gemini-2.5-Pro(85.8)より約6ポイント低い — [Source](https://aclanthology.org/2025.wmt-1.22.pdf)
- 【自動・独立】小型モデルの BLEU(Swallow、英→日):
  - Gemma 4 E4B は .261、E2B は .256。GPT-5 は .272。
  - Qwen3.5-9B は .174、Qwen3.5-4B は .080。
  - [Source](https://swallow-llm.github.io/leaderboard/index-post.ja.html)
- 【自動・LLM判定】小型モデルの JP-TL-Bench スコア(英→日):
  - shisa-v2.1-qwen3-8b 9.21、Qwen3-8B 6.72、LFM2-2.6B 5.07。いずれも Gemini 3 Pro の9.99と比べた数値。
  - [Source](https://arxiv.org/html/2601.00223v1)
- WMT25 では、小型の汎用モデルほど文書を一括翻訳できない割合が高かった(【2026年より前】):
  - Qwen2.5-7B 35.7%
  - Llama-3.1-8B 27.1%
  - Gemini-2.5-Pro 95.1%(比較用)
  - [Source](https://aclanthology.org/2025.wmt-1.22.pdf)

### Inferences
- フロンティアとの差は、ベンチマークの種類によって見え方がまったく違う。
  - 人手・文書単位・zero-shot(WMT26): 汎用の小型モデルとの差は 13〜33 ポイントと大きい。
  - 文単位の自動指標(BLEU、COMET-22): 差はわずか。たとえば Swallow の BLEU では Gemma 4 E4B と GPT-5 の差は .011、PLaMo の COMET-22 は 0.8B から 31B までの範囲がわずか .0081。
  - COMET-22 は上位帯で飽和しており、文書レベルの崩れや書式の欠陥を捉えにくいと考えられる。
- 「小型でもフロンティア並み」という主張は、翻訳特化のファインチューン(Lumen、Qingqiu)についてだけ、人手評価で裏付けがある。汎用の小型モデルについては裏付けがない。
- PLaMo 3 Translate と TranslateGemma はこの仕組み(翻訳特化の学習)を製品化したものだが、英→日の独立人手評価はない。オフライン候補として有望だが、自前評価(Q7)で検証するのが前提。
- 小型 Qwen 系(Qwen3.5-9B/4B)は、英→日では避けるべき。この点は人手評価と BLEU の両方で一貫している。
- TranslateGemma の GEMBA-ESA の低さ(67.5)は、汎用の指示プロンプトで動かしたことが一因かもしれない。TranslateGemma は専用のプロンプト形式を想定している。ただしこれは推測で、確認はしていない。

### Gaps
- TranslateGemma、HY-MT2/HY-MT1.5、PLaMo 3 Translate、Seed-X について、英→日の独立人手評価(とくに文書単位・書式つき)は見つからなかった。
- Lumen_wmt26 と Qingqiu-MT-9B は、技術 Markdown のようなドメイン外で一般化するか、汎用指示に対して頑健かが未検証。
- IFMTBench が日本語を含むか、日本語の内訳があるかは確認できなかった。
- Apple Silicon で量子化(MLX-4bit など)した際の品質劣化について、独立した測定は見つからなかった。ベンダー(PFN)の表だけがある。

## Q4. 文書レベル・書式つきテキスト(Markdown 等)の失敗モード、チャンク/文脈戦略、プロンプト、社内評価向けの指標

### Takeaway
主な失敗モードは次の5つ。
- 出力全体がコードフェンスで囲まれる。
- 前置きや指示文がそのまま出力に混入する。
- 段落やタグ境界がずれる。
- 長い入力で省略・切り詰め・反復が起きる。
- 自動指標や LLM-judge が構造の破損を見逃す。

対策として効果があるのは次の4つ。
- マークアップやコードをマスクするか、AST で翻訳対象を限定する。
- 約2,000語(4Kトークン未満)程度に分割し、文脈と用語集を付けて訳す。
- 決定的な正規化で後処理する。
- 構造を機械的に検査する。

検証して再試行するループは、逆効果になる事例が報告されている。

### Cited Findings

#### 失敗モード
- WMT26 の参加システム MakotoAI の報告(2026)— [Source](https://aclanthology.org/2026.wmt-main.74/):
  - 生の出力では、JSON(ソフトウェア)ドメインの112文書が Markdown のコードフェンスで囲まれていた。
  - 2文書では、先頭に "Translate into X:" という指示行が残っていた。
  - 公式の整合チェックでは、HTML の <br>/<p> の組み替えで段落数がずれた不整合が7件出た。
  - 4,897文書中4件(0.08%)に内容の欠陥があった。英→日のほぼ全文の切り詰めがその1件。
- 同報告による、検証と再試行のループと決定的正規化の比較 — [Source](https://aclanthology.org/2026.wmt-main.74/):
  - 再試行層の動作:
    - JSON 以外の文書(14件)では、再試行層は一度も発動しなかった。
    - JSON の10文書すべてで再試行が発動し、3回とも失敗した。モデルが原文に合わせてフェンスを再び出力したため。
    - その結果、コストは3倍になり、フェンスも残った。
    - 独立した judge は、10件中9件で再試行しない版を選んだ。
  - 決定的正規化の効果:
    - 外側のフェンス1つと先頭の指示文エコーを除去するだけで、追加コストなしに目的を達成した。
    - 段落数のずれのうち6件は、訳文を原文の段落構造に流し直して修復した。その際、タグを除いた本文はバイト単位で同一のまま保った。
- 同報告によると、同じモデルを judge にした自己採点のバイアスは、モデル系統ごとに向きが違った。GPT-5.4 は自分の出力に厳しく、Gemma/Gemini は甘かった — [Source](https://aclanthology.org/2026.wmt-main.74/)
- OSS の README 翻訳研究(arXiv 2508.02497、ICSE-NIER '26、英→独。投稿は2025年)— [Source](https://arxiv.org/html/2508.02497):

  | 問題の種類 | Claude | ChatGPT |
  |---|---|---|
  | Markdown | 8% | 24% |
  | URL | 14% | 32% |
  | コード | 2% | 18% |

  GEMBA のスコアは94–96%と高く、こうした構造の問題を捉えられなかった。
- IFMTBench(2026-05、【ベンダー系列】)— [Source](https://arxiv.org/html/2605.28218):
  - 構造化フォーマット保持の遵守率は、単独の制約では0.94超だが、他の制約と組み合わせると0.55–0.72に下がる。
  - コード保持とレイアウトの制約は0.90超で、ほぼ飽和している。
- マラーティー語の文書翻訳の事例研究(arXiv、2026)によると、LLM の直接翻訳は言語的な品質は高い。しかし、書式の制約を明示的に強制しないと文書構造を保たない — [Source](https://arxiv.org/html/2606.28796v1)
- "Translation Analytics for Freelancers II" によると、ローカル LLM でも、余計な Markdown フェンスやリストの接頭辞は、自動除去を挟めば稀だった — [Source](https://arxiv.org/html/2605.31452v1)
- 日本語の開発者ブログでも、LLM に JSON を出力させるとコードフェンスで囲まれる問題と、その除去処理が報告されている — [Source](https://zenn.dev/lova_man/articles/a80256aa9370e3)

#### チャンク・文脈戦略
- 文書レベル LLM 翻訳の研究(arXiv 2605.13368、2026-05-13)— [Source](https://arxiv.org/html/2605.13368):
  - 入力が約4Kトークンを超えると、省略が増える。
  - 約2,048語のチャンクを推奨している。
  - 長さ比のガードレール [0.8, 1.2] を使っている。
  - 後段のリファイン処理は、主に流暢さ・文体・用語の改善に効く。
  - 原文を見ずに訳文だけを書き直すと、正確さが3.8ポイント下がる。
- Doc2FRC(arXiv、2026-09-11)は、文書をまるごと訳す Doc2Doc 方式で反復や品質劣化が起きることを示し、チャンク化を対策として挙げている — [Source](https://arxiv.org/abs/2609.12674)
- PLaMo 3 Translate のモデルカード — [Source](https://huggingface.co/pfnet/plamo-3-translate-8b):
  - 学習時の最大長(入出力の合計で32,768トークン)を超える文書は、分割するよう指示している。
  - 履歴(過去の原文と訳文のペア)を文脈として渡す場合、古いものから捨てて直近を残すよう推奨している。
- WMT26 の用語翻訳タスク — [Source](https://aclanthology.org/2026.wmt-main.51/):
  - 明示的な辞書を与えた文書レベルの翻訳は、ほぼ飽和している。
  - 難しいのは、辞書なしで正しい用語を特定することの方。
- WMT26 の上位システム、Lumen と Qingqiu-MT-9B は、学習データに用語集の制約や書式の指示を組み込んでいる — [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)

#### プロンプト・パイプライン設計
- WMT26 の公式プロンプトの要点 — [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf):
  - 訳文だけを出力させ、説明を付けさせない。
  - HTML の書式を維持させる。
  - JSON ではキーとプレースホルダを訳させず、有効な JSON を返させる。
- WMT26 の上位システムが使った工夫 — [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf):
  - Dubformer: マークアップをマスクしたセグメントで翻訳し、別系統のモデルで幻覚を検査する。
  - Wayfinder: 保守的なポストチェックを入れる。
  - Lumen: 構造認識型の推論と選択的修復を行う。
- FormatRL(NICT と SAP。arXiv 2512.05100 は IJCNLP-AACL 2025、日本語版は NLP2026 C9-8、2026年3月)— [Source](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/C9-8.pdf); [arXiv](https://arxiv.org/html/2512.05100v1):
  - 対象は SAP のソフトウェア文書(XML)の英→日翻訳。
  - 結果:

    | 手法 | XML-Match | Content-BLEU |
    |---|---|---|
    | Prompt | 67.37 | 36.60 |
    | SFT | 84.21 | 39.11 |
    | FormatRL(GRPO+TreeSim 報酬) | 88.42 | 39.30 |

  - テキストブロックを抽出し、文ごとに訳して組み立て直す方式(parse-and-assemble)は、インラインのマークアップの扱いに苦戦した。

#### 社内評価に使える指標
- WMT26 の評価指標タスクでは、LLM-as-judge が従来型と教師あり型の指標を上回った。Gemma 4 の judge も競合した — [Source](https://aclanthology.org/2026.wmt-main.49/)
- WMT25(【2026年より前】)では、セグメント単位で chrF などの参照あり指標が上位だった。エラースパン検出は難しかった — [Source](https://www2.statmt.org/wmt25/pdf/2025.wmt-1.23.pdf)
- PFN の研究では、英→日で高品質参照を使った chrF(.789)が MetricX-24(.656)を上回った — [Source](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/C8-1.pdf)
- MetricX-25(arXiv、2025年10月、【2026年より前】)は Gemma 3 系をバックボーンにした後継の指標 — [Source](https://arxiv.org/pdf/2510.24707)
- README 研究では、GEMBA のスコアが高くても構造の破損は検出されなかった — [Source](https://arxiv.org/html/2508.02497)

### Inferences
- Markdown 翻訳の品質は、まず構造の欠陥(フェンス、リンク、表、コード、切り詰め)で決まり、そのうえで訳文の品質が効く。構造の欠陥は judge では検出しにくいので、決定的なチェックを別に設ける必要がある。
- 構造を守る方法は2系統ある。
  - (a) コードやインライン要素をプレースホルダでマスクして、文書単位で訳す。
  - (b) AST からテキストノードだけを抜いて訳す。
  - (b) はインライン要素の語順を変えられないため、日本語の語順と相性が悪い(FormatRL の parse-and-assemble の苦戦)。
  - 実務上は、(a) でブロック単位の要素(フェンスコード、front matter、HTML ブロック)を保護し、インラインコードとリンクはプレースホルダ化して文中に残し、モデルに語順の自由を与えるのが妥当と考えられる。
- 再試行より、決定的な正規化と修復を優先すべき。ラッパーのフェンスや前置きを除去し、構造が一致しないチャンクだけ再生成する。とくに、原文自体にフェンスを含む Markdown では、「フェンスがあれば失敗」という検証は誤検知を起こす(MakotoAI の JSON の事例と同じ構図)。
- チャンクは見出しのセクション単位で、2,000語以下・4Kトークン未満を目安にする。前のチャンクの原文と訳文の一部、それに用語集を文脈として渡す。文書全体の一括翻訳は、上位のクラウドモデルなら可能(WMT26)。ただし小型モデルは、文書の一括翻訳で段落の保持に失敗しやすい(WMT25)。

### Gaps
- 英→日の Markdown 翻訳(見出し、表、コード、front matter、raw HTML)に特化した、公開ベンチマークや人手評価は見つからなかった。
- few-shot の例示が英→日の Markdown 翻訳品質に与える効果を、定量的に示した2026年の研究は見つからなかった。
- arXiv 2605.13368 の対象言語対と、[0.8, 1.2] の長さ比が英→日(文字数ベース)に当てはまるかは未確認。
- "LatentMD"(Markdown 境界の失敗)と "Not as Sweet by Another Name"(書式の頑健性)という関連研究は検索で見つかったが、本文を読んでいない。

## Q5. 日本語固有の論点(です・ます/だ・である、カタカナ化と英語表記の維持、和欧間スペース、本文中のコード識別子)

### Takeaway
業界標準の2つのスタイルガイドは、敬体と常体を混在させない点、長音を省略しない点(ユーザー)で一致している。一方、全角と半角の間のスペースでは正反対の方針を取る。JTF(2026年7月の第4.0版)は原則として入れない。Microsoft は原則として半角スペースを入れる。したがって、プロジェクトごとにどちらかを選び、プロンプトと lint で強制する設計が必要になる。

### Cited Findings
- JTF 日本語標準スタイルガイド(翻訳用)第4.0版(2026年7月25日)— [Source](https://www.jtf.jp/pdf/jtf_style_guide.pdf):
  - 文体:
    - 本文は敬体か常体のどちらかに統一し、混在させない。
    - 一般向けのマニュアルでは敬体が使われる。
    - 本文が敬体でも、見出しには常体や体言止めを使う。
    - 箇条書きは、ひとまとまりの中で文体を混在させない。
  - 表記:
    - カタカナ語の語尾の長音は省略しない(ユーザー、ユーザではない)。
    - カタカナ複合語の区切りは、全角中黒・半角スペース・区切りなしのいずれかに統一する。
  - スペース:
    - 「原則として、全角文字と半角文字の間にスペースを入れません」。
    - 演算子・単位と数値の間にも、実務翻訳では一般にスペースを入れない。
    - 和文中に欧文を引用する場合、欧文の単語間のスペースは維持する。
- Microsoft の日本語スタイルガイド(PDF、© 2022 表記、【2026年より前】)— [Source](https://download.microsoft.com/download/a/8/2/a822a118-18d4-4429-b857-1b65ab388315/jpn-jpn-StyleGuide.pdf):
  - スペース: 全角と半角の間には、原則として半角スペースを入れる。
  - 長音: 原語の語尾が -er/-or/-ar のときは長音を付ける。
  - カタカナ複合語: 英語の語の区切りに合わせて半角スペースで分ける(例: ダイアログ ボックス)。
  - 文体: 特に指示がなければ「ですます調」で訳す。
- スペースの方針は JTF と Microsoft で矛盾している(上記2件)— [JTF](https://www.jtf.jp/pdf/jtf_style_guide.pdf); contradicted by [Microsoft](https://download.microsoft.com/download/a/8/2/a822a118-18d4-4429-b857-1b65ab388315/jpn-jpn-StyleGuide.pdf)
- PLaMo 3 Translate は、日本語の出力を常体か敬体から選べる — [Source](https://huggingface.co/pfnet/plamo-3-translate-8b)
- WMT26 は、形式(formality)と構造スタイルに関する文脈指示をテストに導入した — [Source](https://aclanthology.org/2026.wmt-main.48/)
- 技術的な要素の扱い:
  - WMT26 のソフトウェアドメインは、キーやプレースホルダの非翻訳を要求している — [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
  - README 研究では、コードと URL の破損率がモデルによって2%から32%まで差があった — [Source](https://arxiv.org/html/2508.02497)

### Inferences
- 技術ドキュメントの拡張機能では、次をユーザーが設定できるようにし、システムプロンプトに明記するとよい。
  - 文体: 既定は敬体、見出しは体言止め。
  - 和欧間スペース: JTF 準拠(スペースなし)か Microsoft 準拠(スペースあり)かを選ぶ。
  - カタカナの長音: 付ける。
- インラインコード、API 名、CLI オプション、ファイル名、製品名は、英語のまま保持する(マスク対象)。一般語のカタカナ化と英語のままの表記の選択は、用語集で制御する。
- 敬体と常体の混在やスペースの不統一は、LLM-judge では減点されにくい。正規表現や textlint 系のルールで機械的に数える方が確実と考えられる。ただし、具体的な textlint のルールセットの適合性は未調査。

### Gaps
- LLM 翻訳の、敬体と常体の混在率や和欧間スペースの遵守率を、モデル別に測った定量研究は見つからなかった。
- 技術用語をカタカナにするか英語のまま残すかについて、読者の選好や品質への影響を測った2026年の研究は見つからなかった。
- Microsoft スタイルガイドの最新版の改訂日は確認できていない。取得した PDF の表記は © 2022。

## Q6. 総合(1): 英→日のモデル系統ティア別ランキング(根拠と確信度)

### Takeaway
2026年11月時点の証拠を合わせると、英→日の品質は次の順になる。
1. Gemini 3.x Pro 系と、それを中核にした多モデルのエージェント構成
2. GPT-5.5、DeepSeek V4 Pro
3. Gemma 4 31B などのオープンの大・中型
4. Gemma 4 の小型
5. 小型の Qwen 系

Claude、TranslateGemma、PLaMo 3 Translate、HY-MT2 には英→日の独立人手評価がない。そのため位置付けの確信度は低〜中にとどまる。

### Cited Findings
- WMT26 英→日の人手評価(cESA): Gemini 3.1 Pro 90.3、GPT 5.5 86.1、DeepSeek V4 Pro 83.2、Gemma 4 31B 80.5、GPT OSS 120B 78.2、Gemma 4 4B 77.3、GPT OSS 20B 72.4、Qwen 3.6 27B 68.7、Qwen 3.5 9B 57.4、Lumen 90.6、Qingqiu-MT-9B 85.2、Dubformer(Claude と Gemini の混成)85.4 — [Source](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
- WMT25 英→日の人手評価(【2026年より前】): Gemini-2.5-Pro 85.8、GPT-4.1 83.7、Claude-4 79.3、DeepSeek-V3 79.3 — [Source](https://aclanthology.org/2025.wmt-1.22.pdf)
- 日本語の人手評価(【ベンダー(LSP)】、小標本): Gemini 72.5、Anthropic 71.2 — [Source](https://alconost.com/en/blog/best-llm-for-translation-2026)
- Markdown 保持(英→独、【2025年投稿】): Markdown の問題は Claude 8%、ChatGPT 24% — [Source](https://arxiv.org/html/2508.02497)
- 小型モデルの自動指標:
  - Swallow BLEU: Gemma 4 E4B .261、GPT-5 .272、Qwen3.5-9B .174 — [Source](https://swallow-llm.github.io/leaderboard/index-post.ja.html)
  - TranslateGemma: COMET-22 は GPT-5.2 と同等だが、GEMBA-ESA は67.5 — [Freelancers II](https://arxiv.org/html/2605.31452v1); contradicted by [WMT26 Findings](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)
  - PLaMo 3 Translate: ベンダーの指標のみ — [Source](https://huggingface.co/pfnet/plamo-3-translate-8b)

### Inferences

#### ティア別ランキング(英→日、技術 Markdown 用途を想定)
確信度は次の3段階。
- 高: 2026年の独立人手評価で直接比較されたもの。
- 中: 人手評価が間接的なもの、または独立の自動指標が一貫しているもの。
- 低: ベンダー主張か、証拠が矛盾しているもの。

| ティア | モデル系統 | 根拠の要約 | 確信度 |
|---|---|---|---|
| S | Gemini 3.x Pro(3.1 Pro) | WMT26 で単体90.3、首位クラスタ。WMT25 でも人手翻訳を除く首位。IFMTBench でも Hy-MT2 を上回る(89.08 対 85.70) | 高 |
| S(参考) | 多モデル統合・エージェント型の構成(Wayfinder、SCIR-TG-MT、TRIVE) | WMT26 で88.3〜90.6。研究用の仕組みで、拡張機能にそのまま載せるのは現実的でない | 高(品質)/実用性は別問題 |
| A | GPT-5.5 | WMT26 で86.1。Gemini とは有意に別のクラスタ | 高 |
| A | DeepSeek V4 Pro | 単体で83.2。エージェント化すると90.4 | 中〜高 |
| A〜B | Claude(Sonnet/Opus 4.x 系) | 2026年の単体人手評価がない。2025年の Claude-4 は79.3(Gemini-2.5-Pro より−6.5)、文書の一括翻訳率は67.5%。2026年の LSP 小標本では Gemini とほぼ同点。Markdown 保持は最良(英→独)。judge としての日本語の一致度も最高水準 | 低〜中 |
| B | Gemma 4 31B(オープン) | 人手80.5。予備比較の GEMBA-ESA ではオープン首位(89.3)。Swallow BLEU 首位 | 中〜高 |
| B | GPT OSS 120B、Command A+ | 人手78.2、81.4 | 中 |
| A(研究) | 翻訳特化のファインチューン(Lumen 14B、Qingqiu-MT-9B) | 人手90.6、85.2。ドメイン外への一般化と実用性は未検証 | 品質は中〜高/実用性は低 |
| C | Gemma 4 小型(4B、E4B、E2B) | 4B は人手77.3。E4B/E2B は Swallow BLEU で GPT-5 に迫る | 中 |
| C?(要検証) | PLaMo 3 Translate(0.8B〜31B) | ベンダー指標のみ(COMET-22 .87〜.88、PFTB と SaaS で TranslateGemma と HY-MT2 を上回ると主張)。用語集、文脈、文体指定、MLX-4bit に対応 | 低〜中 |
| C?(要検証) | TranslateGemma(4B/12B/27B) | ベンダーの MetricX では Gemma 3 を改善。独立の COMET-22 は GPT-5.2 と同等。一方、GEMBA-ESA は67.5で、ja→en の人手評価では悪化 | 低〜中(矛盾あり) |
| C?(要検証) | HY-MT2 / Hunyuan-MT 系 | 英→日の独立評価なし。WMT25 の Shy-hunyuan-MT は人手79.9で、自動評価だけ過大だった | 低 |
| C?(要検証) | Seed-X 7B | 2025年のベンダー主張のみ。日本語の内訳は未確認 | 低 |
| D | GPT OSS 20B | 人手72.4 | 中〜高 |
| D | Qwen 3.6 27B、Ministral 3 14B、Tower+ 9B、GLM 4 9B | 人手65.0〜69.9 | 中〜高 |
| E(非推奨) | Qwen3.5-9B/4B などの小型 Qwen | 人手57.4(最下位)。BLEU .174、.080 | 高 |

- クラウドの第一候補は Gemini 3.x Pro(品質最優先)。コストやレイテンシーを重視する場合の Flash 系の英→日単体評価は WMT26 にない。TRIVE(Gemini-3.5-Flash のエージェント構成)の88.3が間接的な手がかりになる。
- オフラインの第一候補群は Gemma 4(4B/E4B)、PLaMo 3 Translate(2B/8B)、TranslateGemma(4B/12B)。人手評価の裏付けがあるのは Gemma 4 だけで、翻訳特化の2系統は自前評価(Q7)で検証する前提。
- 品質の差を詰めるには、モデル選びと同等以上にパイプラインが効く。構造の保護、チャンク化、用語集、決定的な修復がそれに当たる(DeepSeek V4 Pro が+7.2ポイント伸びた事例)。

### Gaps
- Claude、Gemini Flash 系、GPT-5.5 mini/nano 系、PLaMo 3 Translate、TranslateGemma、HY-MT2 について、同一条件の英→日人手評価がない。
- 日→英(副次的な方向)を同じ粒度で比べた2026年の人手評価は、WMT26 に日→英がないため得られていない。WMT26 にあるのは中→日。

## Q7. 総合(2): 開発者が自分の Markdown サンプルで回せる軽量評価法

### Takeaway
推奨は3段構成。
1. 構造の決定的チェック(合否のゲート)
2. 異なる系統の LLM-judge 2つによる、ブラインドのペア比較(順序入れ替えあり)
3. 少数の参照訳による chrF と、人手のスポットチェック

これを30〜50チャンク、半日〜1日で回す。単一の自動指標(COMET-22 や GEMBA の単独スコア)には頼らない。

### Cited Findings
- 構造の欠陥は judge では検出しにくい:
  - GEMBA のスコアが94–96%でも、Markdown、URL、コードの破損を見逃した — [Source](https://arxiv.org/html/2508.02497)
- 決定的チェックと正規化は有効で、再試行のループは逆効果になりうる:
  - フェンスの除去と段落の流し直しは、追加コストゼロで有効だった。
  - 再試行のループは、コストを3倍にして結果を悪化させた。
  - [Source](https://aclanthology.org/2026.wmt-main.74/)
- LLM-as-judge は最も信頼できる自動評価の一つ:
  - WMT26 では従来の指標を上回り、Gemma 4 の judge も競合した — [Source](https://aclanthology.org/2026.wmt-main.49/)
- judge には固有の偏りがある:
  - 同じモデルを judge にすると、自己採点のバイアスが系統ごとに違う向きに出る — [Source](https://aclanthology.org/2026.wmt-main.74/)
  - judge 同士の一致度は、gpt-oss-120b(.691)のように低いものもある — [Source](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/C8-1.pdf)
- 参照訳があれば、英→日では chrF が MetricX-24 と同等以上:
  - 参照の質が悪いと、相関は大きく下がる — [Source](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/C8-1.pdf)
- COMET-22 は上位帯で差が出にくい:
  - PLaMo 3 Translate の0.8B〜31B で .8724〜.8805 — [Source](https://huggingface.co/pfnet/plamo-3-translate-8b)
- 長い入力では省略が増える:
  - 約4Kトークン超で省略が増加。長さ比 [0.8, 1.2] のガードレール — [Source](https://arxiv.org/html/2605.13368)
- WMT26 の人手評価は、ESA 系の0–100スコアとエラースパン(重大度つき)で行われた — [Source](https://aclanthology.org/2026.wmt-main.48/)

### Inferences

#### 推奨する軽量評価法(英→日主体、日→英も同じ枠組み)
1. サンプルを作る(1〜2時間)
   - 自分のリポジトリの Markdown から、見出しのセクション単位で30〜50チャンクを層化して抽出する。1チャンクは200〜2,000語。
   - 次の要素を意図的に含める。
     - 表
     - 入れ子のリスト
     - フェンスコード(言語指定あり・なし)
     - インラインコードの多い段落
     - リンクと画像
     - front matter
     - raw HTML
     - 長い説明段落
   - 用語集(30〜100語)を作る。
   - そのうち10〜20チャンクには、高品質な参照訳を用意する。上位モデル2つの出力をバイリンガルが修正したもので構わない。
2. 翻訳条件を固定する
   - 全モデルに同じ前処理・プロンプト・後処理を使う。
   - 前処理:
     - フェンスコード、front matter、HTML ブロックは保護する(翻訳対象外)。
     - インラインコード、URL、プレースホルダは、ID つきのトークンにマスクする。
   - プロンプト:
     - WMT26 の公式プロンプトを手本に、訳文だけを出力させ、書式は維持させる。
     - 用語集と文体(敬体、見出しは体言止め、和欧間スペースの方針)を指定する。
     - 前のチャンクの訳文の一部を文脈として渡す。
   - 後処理(決定的正規化): 外側のフェンス、前置きや説明文、指示文のエコーを除去する。
3. ゲート(決定的な自動チェック。チャンク単位で合否を出す)
   - Markdown の AST(mdast や markdown-it など)を比べ、次がすべて一致するかを見る。
     - 見出しの数とレベルの列
     - リスト項目の数と入れ子
     - 表の行数と列数
     - フェンスコードの数と、中身のバイト単位の一致
     - インラインコードの集合
     - リンクの URL と画像のパス
     - front matter のキー
     - HTML タグの列
     - マスクトークン
   - 長さ比: 参照訳から英→日の文字数比の分布を求め、外れ値(切り詰め・省略・付加の疑い)を検出する。[0.8, 1.2] は単語数ベースの値なので、日本語ではそのまま使わない。
   - 英語が残った段落、指示文のエコー、反復ループを検出する。
   - 用語集の遵守率(指定の訳語が出現するか)を測る。
   - 日本語スタイル: 敬体と常体の混在、和欧間スペースの方針違反、長音の省略を、正規表現か textlint 系のルールで数える。
   - 判定基準の例: 正規化と修復を通した後の構造の合格率(例: 98%以上)を足切りにする。
4. 品質の相対比較(LLM-judge)
   - モデルA/Bの訳をブラインドで並べ、GEMBA-ESA/MQM 風に判定させる。出力はエラースパン(重大度つき)と0–100のスコア。
   - 左右を入れ替えて2回判定させる。
   - judge は、評価対象と異なる系統から2つ使う(例: クラウド系とローカルの Gemma 4 系)。
   - 評価対象と同じモデルは judge にしない。
   - 集計は勝率と平均スコアで行い、judge 間で不一致の項目を抽出する。
5. 参照ベースの補助指標
   - 参照訳がある10〜20チャンクで chrF を計算する。コードを除いた本文だけを対象にする。
   - MetricX-24/25 や COMET は参考値にとどめる(上位帯で差が出にくい)。
6. 人手スポットチェック(1〜2時間)
   - 対象は、judge 間で不一致の項目と、ランダムに選んだ約10%。
   - バイリンガルの開発者が ESA 風に評価する(0–100のスコアと、Critical/Major/Minor のエラー印)。
   - 特に見る点: 意味の誤り、省略、用語、文体。
7. 決定と継続運用
   - 構造の合格率でふるい、judge の勝率と人手評価で順位を付ける。
   - レイテンシー(最初のチャンクが出るまでの時間、総処理時間)とコストは別の軸で記録する。
   - このセットを回帰テストとして保存し、モデルやプロンプトを変えるたびに再実行する。
   - 日→英では、方向を逆にして同じ手順を回す。日→英は TranslateGemma の人手評価で固有名詞の劣化が報告されているので、固有名詞のチェックを追加する。

### Gaps
- 上記の手順(特に合格率98%の閾値、30〜50チャンクという規模)は、文献から組み立てた推奨。英→日の Markdown で妥当性を検証した研究はない。
- ローカルの judge(Gemma 4 など)が日本語の文体ミスや用語ミスをどこまで検出できるかは、英→日では確認できていない。WMT26 の評価指標タスクの言語対別の結果を本調査では精査していない。
- 英→日の文字数比の妥当な範囲(技術文書)を示した公開データは見つからなかった。自前の参照訳から較正する必要がある。
