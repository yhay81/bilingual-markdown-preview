# 英日Markdown翻訳拡張はGemma 4既定・Gemini清書で組む

2026年11月時点で、英→日翻訳の品質を独立した人手評価で裏づけられるのは前世代のモデルに限られる。その範囲で最も強い根拠を持つのは Gemini 系で、WMT26 では **Gemini 3.1 Pro が 90.3 を取り、人手ポストエディット（86.0）を上回った**。したがって拡張の構成としては、Apple Silicon 上のローカル既定を **Gemma 4**（16GB なら E4B、32GB なら 26B-A4B、64GB 以上なら 31B）とし、清書・高品質モードを **Gemini 3.1 Pro**（後継候補は Gemini 4 Argon）、対話的なクラウド既定を **Gemini 3.8 Flash（thinking low）** とすることを推奨する。ただし、現行の GPT-6.x、Gemini 4 / 3.8 Flash、Claude 5.5 系については英日翻訳の独立評価が見当たらない。クラウドの現行モデルに関する推奨は系統からの外挿にとどまり、確信度は低〜中である。ローカルで品質の上積みを狙う最有力候補は三つある。2026-11-05 に重みが公開された PLaMo 3 Translate と、WMT26 の constrained トラックで人手評価 85.2 と 90.6 を得た Qingqiu-MT-9B と Lumen である。ただし PLaMo 3 Translate には独立評価がまだなく、後の二つは Mac で動かした実績が確認できない。そのためこの三つは既定にせず、評価の候補として扱う。結果を左右する度合いは、モデル選びと同じくらいパイプラインの設計が大きい。DeepSeek V4 Pro はエージェント化によって 83.2 から 90.4 に伸びた。Markdown の崩れは、決定論的な正規化と検証で抑えられる。最終的な判断は、自分の文書から取った 30〜50 チャンクで行う半日程度の自前評価で下すべきである。

## 独立人手評価では2年連続でGemini系が英日トップに立った

現時点で最も信頼できる証拠は、2026-10-28〜29 に開かれた WMT26 General MT である。評価対象は 46 システムで、テストデータは HTML/JSON 構造を含む文書単位のものだった。英→日の採点は、Microsoft のプロのバイリンガル評価者が新しいプロトコル cESA で行った。主催者が用意した LLM ベースラインは、公式プロンプトを使い、thinking を無効にした zero-shot で文書全体を一度に訳している（[WMT26 Findings](https://aclanthology.org/2026.wmt-main.48/)、[PDF](https://www2.statmt.org/wmt26/pdf/2026.wmt-1.48.pdf)）。英→日の主な結果を、Mac で使えるかどうかとあわせて次の表にまとめる。

| システム | cESA（英→日） | 種別 | Mac での実用性 |
|---|---|---|---|
| Lumen | 90.6 | 翻訳特化オープン（約14.8B、Apache-2.0） | BF16 のみ 29.5GB、64GB 機向け |
| Wayfinder | 90.6 | Gemini 3.1 Pro＋Gemini 3.5 Flash＋GPT-5.5＋Qwen 3.7 Max のエージェント | クラウドのみ |
| SCIR-TG-MT | 90.4 | DeepSeek-V4-Pro のエージェント | クラウドのみ |
| Gemini 3.1 Pro | 90.3 | 単体の LLM | クラウド（Preview） |
| GPT 5.5 | 86.1 | 単体の LLM | クラウド（前世代） |
| Human (postediting) | 86.0 | 人手 | — |
| Qingqiu-MT-9B | 85.2 | 翻訳特化オープン（Qwen3.5-9B 派生） | 実行実績は未確認 |
| DeepSeek V4 Pro | 83.2 | 単体の LLM | クラウド |
| Gemma 4 31B | 80.5 | 汎用オープン | Ollama で 19〜20GB |
| Gemma 4 4B | 77.3 | 汎用オープン | Ollama で 6.1GB（E4B と推定） |
| GoogleTranslate | 69.4 | 従来型の機械翻訳 | クラウド |
| Qwen 3.5 9B | 57.4 | 汎用オープン | 英日には不向き |

この表から読み取れることは四つある。第一に、**Gemini の優位は2年続いている**。WMT25 でも英→日は Gemini-2.5-Pro が 85.8 で、GPT-4.1 の 83.7 と Claude-4 の 79.3 を上回っていた（[WMT25 Findings](https://aclanthology.org/2025.wmt-1.22.pdf)）。WMT26 全体でも、トップクラスタに入った言語対の数の上位3システム（Wayfinder 17、Gemini 3.1 Pro 15、TRIVE 14）は、いずれも Gemini を土台にしている。一方、Claude は WMT26 に単体のベースラインがなく、Dubformer（Claude Sonnet 4.6 / Opus 4.8 / Gemini 3.1 Pro の組み合わせ、85.4）の一部として出てくるだけである。第二に、**最上位の品質は thinking なしで出ている**。この結果は、翻訳では推論量を最小にする設定で足りることを支持する。第三に、**パイプラインの効果がモデルの差に匹敵する**。DeepSeek V4 Pro は単体で 83.2 だが、エージェント化した SCIR-TG-MT では 90.4 になった。Qwen 3.5 9B（57.4）を翻訳向けに追加学習した Qingqiu-MT-9B は、27.8 ポイント上回っている。第四に、**自動指標は人手評価と食い違う**。主催者の予備比較（GEMBA-ESA）では、Gemma-4-31B が 89.3、TranslateGemma-27B が 67.5 だった。ところが人手評価での Gemma 4 31B は 80.5 にとどまる。また TranslateGemma-27B は、別研究の COMET-22 では GPT-5.2 と同等だった（90.34 対 90.11、[Freelancers II](https://arxiv.org/html/2605.31452v1)）。この不安定さが、後述する自前評価の設計を決める。なお、ドメイン別に見ると英→日の最高点は Software の 96.7 で、技術文書の Markdown は訳しやすい部類に入る。

## 評価された世代と現行世代はずれており、PLaMoの日付も二つある

いちばん大きな食い違いは世代のずれである。WMT26 で人手評価を受けたクラウドモデルは、GPT 5.5、Gemini 3.1 Pro、DeepSeek V4 Pro と、エージェントの部品として使われた Gemini 3.5 Flash や Claude 4.x 系だった。これに対し、2026-11-09 時点の現行モデルは次のとおりである。OpenAI は GPT-6 Astra（OpenRouter 掲載 2026-09-04）、GPT-6 Sol / Luna（09-22）、GPT-6.1 Sol（09-29）、GPT-6.1 Terra（10-26）である（[OpenRouter](https://openrouter.ai/api/v1/models)）。Google は 2026-09-30 発表の Gemini 4 Argon（[Axios](https://axios.com/2026/09/30/google-gemini-4)）と Gemini 3.8 Flash である（[Gemini Pricing](https://aistudio.google.com/docs/pricing)）。Anthropic は Fable 5.1、Opus 5.5、Sonnet 5.5 と、2026-10-07 公開の Haiku 5.5 である（[Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)、[Anthropic](https://www.anthropic.com/claude-haiku-5-5)）。**これら現行モデルの英日翻訳を独立に評価したものは見つからなかった**。OrcaRouter も、Haiku 5.5 と Sakana Namazu の間には共通のベンチマークがないと書いている（[OrcaRouter](https://www.orcarouter.ai/blog/claude-haiku-5-5-vs-sakana-namazu)）。Artificial Analysis の Intelligence Index（Opus 5.5 59、Astra 57、Sonnet 5.5 55 など）は汎用能力の指標で、翻訳品質は測っていない（[AA Leaderboard](https://artificialanalysis.ai/leaderboards/models)）。現行世代と日本語翻訳の品質を比べた主張は、PFN による自社比較しかない。PFN は、PLaMo翻訳の第3世代が Claude Fable 5.1、GPT-6.1 Sol、GPT-6 Astra と同等の精度だとしている（[Impress Watch](https://www.watch.impress.co.jp/docs/news/2146531.html)）。そこで本レポートでは、現行モデルを「未検証の後継」として扱う。自前評価には、人手評価の点数が分かっている Gemini 3.1 Pro を基準点として入れる。

PLaMo 3 Translate の時期については、二つの出来事が混同されている。「2026年10月」は、Web サービスの PLaMo翻訳が第3世代モデルに切り替わり、対応言語が 2 から 53 に増えた更新を指す。サービス側の告知では、切り替え日は 2026-10-07 である（[PLaMo翻訳 news](https://translate.preferredai.jp/news/20261007-1-plamo3-major-update/)）。一方、0.8B / 2B / 8B / 31B の**重みが公式の GGUF と MLX-4bit 付きで公開されたのは 2026-11-05** で、PFN のプレスリリースと複数の媒体がこの日付で一致している（[PFN](https://www.preferred.jp/ja/news/pr20261105)、[gihyo](https://gihyo.jp/article/2026/11/plamo-3-translate-open-weights)、[ITmedia](https://www.itmedia.co.jp/aiplus/article/2611/05/2000002900/)）。重みの公開を「10月下旬」とするノートもあるが、根拠は HF カードの読み取りだけで、ほかに裏づけがない（[HF](https://huggingface.co/pfnet/plamo-3-translate-8b)）。本レポートは 11-05 を採る。ここから言えるのは、**基準日の 11-09 の時点で、公開からまだ4日しか経っていない**ということである。独立の評価は、11-06 の Playto のテスト（AI 判定、本人たちも公式ベンチマークではないと明記）しかない。なお、PLaMo翻訳のサービスには公開 API がないため、拡張から使えるのは重みのほうに限られる（[ToolNavs](https://toolnavs.com/ja/article/2375-plamo-fan-yi-da-xing-geng-xin-shang-xian-5-3-zhong-yu-yan-yu-hui-yi-shi-shi-fan)）。

それ以外の食い違いと、本レポートでの扱いを次の表にまとめる。

| 論点 | 食い違い | 本レポートの扱い |
|---|---|---|
| Gemma 4 の小型版 | WMT26 は「Gemma 4 4B」と表記しているが、公式の名前は E2B / E4B（[HF](https://huggingface.co/google/gemma-4-26B-A4B-it)） | E4B と推定する（推測） |
| Lumen の規模 | WMT26 の一覧では「14B + 4B」、HF では約 14.77B（[HF](https://huggingface.co/ATH-MaaS/Lumen_wmt26)） | 公開された重みが評価されたシステムと同じかどうか分からないため、確信度を一段下げる |
| RFMT の規模 | HF では 15B、WMT26 では 18.795B（[HF](https://huggingface.co/tohoku-nlp/RFMT)） | 選定への影響は小さい |
| TranslateGemma の文脈長 | HF では入力 2K tokens、Ollama では 128K（[HF](https://huggingface.co/google/translategemma-12b-it)、[Ollama](https://ollama.com/library/translategemma)） | 2K を前提に分割する |
| 自動指標と人手評価 | Gemma 4 31B は GEMBA-ESA で 89.3、人手で 80.5。Qingqiu と HY-MT2-7B の優劣は、ベンチマークによって逆転する（IF-WMT25 en→ja では −16.4、IFMTBench では +6.7、[HF](https://huggingface.co/WPS-Qingqiu/Qingqiu-MT-9B)） | 人手評価を優先する |
| Qwen の評価 | 32GB の Mac では速度の面から Qwen3.5-35B-A3B を推す見方がある（Ollama MLX で 112〜134 tok/s、[Ollama](https://ollama.com/blog/mlx)）。一方、英日の人手評価では Qwen 3.6 27B が 68.7、Qwen 3.5 9B が 57.4 と下位で、Qwen3.5-35B-A3B も BLEU .250 にとどまる（[Swallow](https://swallow-llm.github.io/leaderboard/index-post.ja.html)） | 英日の既定には採らない |
| ローカルの主軸 | 品質面の証拠とローカル実行面の調査は Gemma 4 寄り、翻訳特化モデルの調査は PLaMo 3 Translate を1位に置く | 既定は Gemma 4 にし、PLaMo は最優先の評価候補にする |
| Apple Foundation Models | 文脈長は更新情報では 4,096、WWDC26 のサンプルのコメントでは 8192（[Apple](https://developer.apple.com/documentation/updates/foundationmodels)、[WWDC26](https://developer.apple.com/videos/play/wwdc2026/241/)） | 4,096 を前提にする |
| 価格改定 | Argon は 12/1 に $4/$20、3.8 Flash は 2027-01-01 に $1.50/$7.50 へ倍増する（[Gemini Pricing](https://aistudio.google.com/docs/pricing)） | コスト表に改定後の値を併記する |

## Apple Siliconのローカル既定はGemma 4、翻訳特化モデルは評価枠に置く

ローカル実行の土台はほぼ固まっている。Ollama は 0.40 から Apple Silicon で MLX を既定にした（二次情報、[jacar](https://jacar.es/?p=7672)）。MLX のプレビュー版の時点で、Qwen3.5-35B-A3B の生成速度は 58 tok/s から 112〜134 tok/s に上がっていた（[Ollama](https://ollama.com/blog/mlx)）。Ollama は `http://localhost:11434/v1/` で OpenAI 互換の API を出し（[Ollama docs](https://docs.ollama.com/api/openai-compatibility)）、LM Studio 0.4 も並列リクエストとヘッドレス実行に対応している（[LM Studio](https://lmstudio.ai/changelog/lmstudio-v0.4.0)）。そのため拡張側は、どちらも同じ OpenAI 互換バックエンドとして扱える。

既定を **Gemma 4** にする理由は三つある。一つ目は、人手評価の点数が分かっていること（31B が 80.5、「4B」が 77.3）。二つ目は、自動指標でも一貫して強いこと。Swallow の英→日 BLEU は 31B が .285、26B-A4B が .280、E4B が .261 で、GPT-5 の .272 と同水準である（[Swallow](https://swallow-llm.github.io/leaderboard/index-post.ja.html)）。三つ目は、Markdown のプレースホルダを守るのに必要な日本語の指示追従が高いこと。M-IFEval-Ja は 31B が .898、26B-A4B が .867 である（[Swallow data](https://swallow-llm.github.io/leaderboard/swallow_leaderboard_post_en.js)）。加えて、Apache 2.0 で配布でき、Ollama の公式タグがある（E4B の QAT 版が 6.1GB、26B-A4B が 16GB、31B が 19〜20GB、[Ollama tags](https://ollama.com/library/gemma4/tags)）。速度の制約はメモリ帯域で決まる。M4 16GB の機体で Gemma 4 12B QAT を動かした実測は 11.26 tok/s だった（[DevelopersIO](https://dev.classmethod.jp/en/articles/local-llm-guide-2026-summer/)）。これと llama.cpp の機種別ベンチマーク（[#4167](https://github.com/ggml-org/llama.cpp/discussions/4167)）から 3,000 語の文書にかかる時間を試算すると、E4B（M4 16GB）が 3.5〜5.5 分、26B-A4B（M4 Pro）が 1.5〜2 分、31B が 5〜6 分になる。26B-A4B は、実際に動くパラメータが 3.8B の MoE なので、32GB 機での品質と速度の釣り合いがいちばん良い。

**PLaMo 3 Translate** は、ローカル候補のなかで伸びしろが最も大きい。特徴は、53 言語に対応し、32,768 tokens まで扱え、用語集・文脈・常体/敬体をテンプレート引数として渡せることである（[PFN blog](https://www.preferred.jp/en/blog/tech/plamo-3-translate-weight-release)）。公式 CLI には MLX 実行、サーバーモード、MCP がそろっている（[plamo-translate-cli](https://github.com/pfnet/plamo-translate-cli)）。速度は 2B の MLX 4bit が M1 Max で 107〜170 tok/s（[PR#31](https://github.com/pfnet/plamo-translate-cli/pull/31)）、0.8B が 257〜352 tok/s（593MB、[HF](https://huggingface.co/sizumita/plamo-3-translate-0.8b-mlx-4bit-compact)）で、16GB 機での体感は Gemma 4 E4B より大幅に良いはずである。しかし品質の根拠は、ベンダーの COMET（31B .8799、8B .8805、2B .8780、[HF](https://huggingface.co/pfnet/plamo-3-translate-8b)）と Playto の AI 判定（英→日で 2B が 7.34、Hy-MT2 1.8B が 5.89、[Playto](https://playto.dev/blog/plamo-3-translate/)）だけで、確信度は低〜中にとどまる。実装上の制約も二つある。一つは、自由記述の指示を受け付けないことである。このため Markdown の保護はすべて拡張側のプレースホルダ置換に頼ることになる。もう一つはライセンスで、年商 10 億円以下なら登録のうえ商用無償だが、2024 年版の条文には「Built with PLaMo」の表示義務がある（[ScanCode](https://scancode-licensedb.aboutcode.org/plamo-cla-2024.html)）。

品質の上積みを狙う候補は、WMT26 で人手評価を受けた翻訳特化モデルの二つである。**Qingqiu-MT-9B**（85.2、Apache-2.0）は、自由記述の instruction 欄を持ち、temperature 0.3、thinking オフで使うことが推奨されている（[HF](https://huggingface.co/WPS-Qingqiu/Qingqiu-MT-9B)）。**Lumen**（90.6、Apache-2.0）は BF16 のみで 29.5GB あり、4096 tokens を「hard limit」としている（[HF](https://huggingface.co/ATH-MaaS/Lumen_wmt26)）。どちらも品質の確信度は高めだが、Ollama や LM Studio で動かした実績と Mac での速度が確認できない。このため、32GB 以上と 64GB 以上の機体で実験枠として扱う。Hy-MT2 1.8B（Apache-2.0、GGUF 1.13GB）は、`ollama run hf.co/tencent/Hy-MT2-1.8B-GGUF:Q4_K_M` で導入できる手軽さが利点である（[HF](https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF)）。Mac での試用では、コードブロックや HTML のプレースホルダは保持した。一方で、訳し漏れが出たり、実行のたびに訳語が揺れたりした（[lilting](https://lilting.ch/en/articles/hymt2-local-translation-30b-a3b)）。TranslateGemma は、入力が 2K tokens に限られ、GEMBA-ESA でも 67.5 だったので、優先度は低い。macOS 26 以降の Translation フレームワークは UI なしで呼び出せるが、言語パックを事前にインストールする必要があり、日本語の品質データもない（[Apple](https://developer.apple.com/documentation/translation/translationsession/init(installedsource:target:))）。完全オフラインの最終手段と位置づけるのが妥当である。

## クラウドは対話用にGemini 3.8 Flash、清書用にGemini 3.1 Proを置く

対話的なプレビュー翻訳の既定には、**Gemini 3.8 Flash を thinking low で**使うことを勧める。理由は系統にある。WMT26 で上位に入った TRIVE（Gemini-3.5-Flash のエージェント、88.3）と Wayfinder は、いずれも Flash 系を部品にしていた。性能面では、初回トークンまでの時間が low で 3.79 秒（high では 17.50 秒）、出力速度が 112 tok/s である（[AA](https://artificialanalysis.ai/models/gemini-3-8-flash)）。ただし 3.8 Flash そのものは評価されていないので、確信度は低〜中にとどまる。コスト重視の代替は三つある。Gemini 3.5 Flash-Lite は出力速度 292 tok/s（[AA](https://artificialanalysis.ai/models/gemini-3-5-flash-lite)）。GPT-6 Luna は reasoning none にでき、初回トークンまで 1.16 秒である。ただし Intelligence Index は 9 と低い（[AA](https://artificialanalysis.ai/models/gpt-6-luna)）。Claude Haiku 5.5 は、発表文で翻訳にも日本語にも触れていない（[Anthropic](https://www.anthropic.com/claude-haiku-5-5)）。Claude 系については、Markdown の保持が良かったという研究がある。README の英→独翻訳で、Markdown の崩れは Claude が 8%、ChatGPT が 24% だった（[arXiv](https://arxiv.org/html/2508.02497)）。一方で、WMT25 で文書を一度で訳し切れた割合は Claude-4 が 67.5% と低かった（[WMT25](https://aclanthology.org/2025.wmt-1.22.pdf)）。後者はチャンク分割で避けられるので、Claude は「構造保持を重視する場合の代替」として残す。

清書の既定は **Gemini 3.1 Pro**（$2/$12）とする。クラウドで入手できる単体の LLM のうち、英日の人手評価でトップクラスタ入りが確認できるのはこれだけで、確信度は高い。弱点は、Preview 版であるため提供終了のリスクがあることである。Gemini 2.5 Pro / Flash はすでに非推奨になり、12/1 から新しいモデルへ転送されることが決まっている（[Gemini Pricing](https://aistudio.google.com/docs/pricing)）。そのため、モデル ID は設定で差し替えられるようにしておく。後継の第一候補は Gemini 4 Argon だが、12/1 に $4/$20 へ値上がりし、high での初回トークンまでの時間が 37.84 秒と遅い（[AA Leaderboard](https://artificialanalysis.ai/leaderboards/models)）。GPT-6.1 Sol と Claude Sonnet 5.5（いずれも $2/$10）、Opus 5.5（$4/$20）も英日の独立評価がないため、確信度は低い（[OpenAI Pricing](https://developers.openai.com/api/docs/pricing)、[Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)）。1 万語の文書 1 本あたりのコストを試算すると、次の表になる。前提は入力 14k tokens、出力 19k tokens で、Claude は新しいトークナイザで約 3 割増える分を掛けている。

| モデル / API | 1 文書あたり | 備考 |
|---|---|---|
| GPT-6 Luna | $0.011 | Batch なら $0.005 |
| Claude Haiku 5.5 | $0.014 | 100K tokens 以下の料金 |
| Gemini 3.5 Flash-Lite | $0.052 | 最速クラス |
| Gemini 3.8 Flash | $0.082 | 2027-01 以降は $0.164 |
| GPT-6.1 Sol / Gemini 4 Argon | $0.218 | Argon は 12/1 以降 $0.436 |
| Gemini 3.1 Pro Preview | $0.256 | 人手評価 90.3 |
| Claude Sonnet 5.5 / Opus 5.5 | $0.283 / $0.567 | — |
| Google Translation LLM / DeepL | $0.90 / $1.50〜1.65 | 文字数課金 |

Flash 級以下の LLM は、従来型の翻訳 API より一桁以上安い。ただし出力速度から試算すると、19k tokens を一本のストリームで出すには 65〜186 秒かかる。そのため、チャンクに分けて並列に送る必要がある。データの扱いにも注意が要る。Gemini API の無料枠は製品改善と人手レビューに使われ、規約は機密情報を送らないよう求めている（[Gemini API Terms](https://ai.google.dev/gemini-api/terms)）。業務文書を扱うなら、有料枠が前提になる。もっと厳しいポリシーが求められる組織向けには、ほかの選択肢がある。DeepL はテキストを保存しない（[DeepL](https://www.deepl.com/en/pro-data-security)）。2026-11-02 に Markdown の文書翻訳が GA になり、`quality_optimized`、用語集、カスタム指示（300 字×10）を使える（[DeepL release notes](https://developers.deepl.com/docs/resources/roadmap-and-release-notes)、[DeepL API](https://developers.deepl.com/api-reference/translate/request-translation)）。Google の Translation LLM は、データを学習に使わない（[Google](https://docs.cloud.google.com/translate/data-usage)）。ただし、どちらも英日品質の根拠は自動指標に限られる（DeepL の COMET-22 は 91.01）。WMT26 の GoogleTranslate は 69.4 だったが、これが Translation LLM を指すかどうかは分からない。確信度は低い。

## 用途別の推奨と、半日で決着をつける評価手順

ここまでの検討を、用途と制約ごとの推奨にまとめる。確信度は次の三段階で付けた。高は、同じモデルが 2026 年の独立した人手評価で直接比較されている場合。中は、前世代・兄弟モデル・パイプライン経由の間接的な人手評価がある場合か、独立した自動指標が一貫している場合。低は、ベンダーの主張しかない場合か、証拠が互いに矛盾する場合である。

| 用途・制約 | 既定 | 代替 | 主な根拠 | 確信度 |
|---|---|---|---|---|
| ローカル・16GB・対話 | Gemma 4 E4B | PLaMo 3 Translate 2B（速度重視）、Hy-MT2 1.8B | 人手評価 77.3（E4B と推定）、BLEU .261／ベンダー評価と Playto | 中／低〜中 |
| ローカル・32GB・対話 | Gemma 4 26B-A4B | PLaMo 3 Translate 8B、Qingqiu-MT-9B（実験） | BLEU .280、M-IFEval-Ja .867／Qingqiu は人手評価 85.2 | 中（Qingqiu は品質面が高、実装面が低） |
| ローカル・64GB 以上・清書 | Gemma 4 31B | Lumen（実験） | 人手評価 80.5／Lumen は人手評価 90.6 だが公開重みとの同一性は不明 | 高／中 |
| 最小リソース・常駐 | PLaMo 3 Translate 0.8B | Apple Translation フレームワーク | 593MB で 257〜352 tok/s／品質データなし | 低 |
| クラウド・対話 | Gemini 3.8 Flash（thinking low） | Gemini 3.5 Flash-Lite、GPT-6 Luna（none）、Claude Haiku 5.5 | Flash 系を使ったエージェントが 88.3〜90.6。3.8 Flash 自体は未評価 | 低〜中／低 |
| クラウド・清書 | Gemini 3.1 Pro（Preview） | Gemini 4 Argon、Claude Sonnet / Opus 5.5、GPT-6.1 Sol | 人手評価 90.3／後継と他社モデルは未評価 | 高／低〜中 |
| 機密・規約重視 | DeepL（quality_optimized＋用語集） | Google Translation LLM、有料枠の LLM | データを保存しない、学習に使わない。品質の根拠は自動指標のみ | 低 |
| Copilot 契約者 | vscode.lm 経由で利用者が選ぶモデル | — | AI Credits を消費する。最も安いのは Luna と Haiku 5.5 | — |

実装の順序としては、まず OpenAI 互換の HTTP バックエンド（Ollama、LM Studio、OpenRouter、任意のエンドポイント）を作り、次に vscode.lm を載せるのがよい。vscode.lm には癖がある。使えるモデルが 0 件のことがあり、最初の `sendRequest` で同意ダイアログが出るのでユーザー操作から呼ぶ必要があり、system ロールもない（[vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts)、[LM API guide](https://code.visualstudio.com/api/extension-guides/ai/language-model)）。また Copilot は 2026-06-01 から AI Credits による従量課金になり、無料のモデルはない（[GitHub blog](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/)、[Copilot pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)）。パイプラインは、markdown-it の `token.map` でブロック単位に分割してプレビューの `data-line` と対応づけ（[markdownEngine.ts](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/src/markdownEngine.ts)）、インラインコード、URL、HTML を ⟦n⟧ のプレースホルダに置き換えたうえで、1〜2k tokens のバッチを temperature 0〜0.2 で送る形にする。バッチを小さくするのは、入力が約 4K tokens を超えると訳抜けが増えるという研究があるためである（[arXiv](https://arxiv.org/html/2605.13368)）。返ってきた出力は、検証の前にまず決定論的に正規化する。WMT26 の MakotoAI では、112 の文書がコードフェンスに包まれて返り、指示の復唱や、約 900 字が 8 字になる切り詰めも起きた。再試行はコストが 3 倍になったうえに直らず、正規化ならコストなしで直った（[MakotoAI](https://aclanthology.org/2026.wmt-main.74/)）。正規化の後で、プレースホルダとコードが原文と一致するかを検証し、失敗したら 1 回だけ再試行する。先行例の md-ja-preview も、インラインコードや URL が変わった出力を捨てている（[GitHub](https://github.com/YuuKamegai/md-ja-preview)）。

文体は設定項目にする。敬体か常体か、全角文字と半角文字の間を空けるかどうか（JTF は空けない、Microsoft は半角スペースを入れる）の二点である（[JTF](https://www.jtf.jp/pdf/jtf_style_guide.pdf)、[Microsoft](https://download.microsoft.com/download/a/8/2/a822a118-18d4-4429-b857-1b65ab388315/jpn-jpn-StyleGuide.pdf)）。

最終的な選定は、自前評価で確定させる。自分のリポジトリの文書から 30〜50 チャンクを選び、候補ごとにまず構造ゲート（コード、URL、プレースホルダの一致率 98% 以上）を通す。構造の検査は必ず決定論的に行う。GEMBA は README の翻訳に 94〜96% という高い点を付けながら、Markdown の崩れを見逃したからである（[arXiv](https://arxiv.org/html/2508.02497)）。品質は、系統の異なる 2 つの判定モデルに左右の並びを入れ替えて比較させる。WMT26 の評価指標タスクでは、LLM による判定が従来型の指標を上回っている（[WMT26 Metrics](https://aclanthology.org/2026.wmt-main.49/)）。あわせて、人手で作った参照訳を 10〜20 本用意して chrF を測る。PFN の研究では、英→日で高品質な参照訳を使った chrF の順位相関が .789 で、MetricX-24 の .656 を上回った。ただし参照訳を LLM に作らせると、相関は大きく下がる（[NLP2026 C8-1](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/C8-1.pdf)）。最後に約 1 割を人が読む。候補には必ず Gemini 3.1 Pro を基準点として入れる。現行モデルがこれに並ぶかどうかを見れば、世代のずれによる不確かさを自分の文書で埋められる。

## 結論

この分野では、証拠がすぐに古くなる。WMT26 の結果が出た 10 月末の時点で、評価されたクラウドモデルはすでに後継に置き換わっていた。Gemini の主要モデルは 12 月と 1 月に値上がりが控えている。PLaMo 3 Translate の重みは、基準日の時点で公開から 4 日しか経っていない。したがって、この拡張で最初にやるべきことは「最良のモデルを当てる」ことではない。モデルを安く差し替えられるバックエンドの抽象化と、差し替えるべきかどうかを半日で判断できる評価ハーネスを、最初から用意しておくことである。この二つがあれば、上の推奨表は固定した結論ではなく、検証の出発点になる。Ollama 上の Gemma 4 をメモリに応じて既定にし、クラウドは Gemini 3.8 Flash で対話、Gemini 3.1 Pro で清書という構成で出荷する。そのうえで、PLaMo 3 Translate 2B / 8B を最初の比較対象にすればよい。

次に見直すきっかけになるのは三つの出来事である。一つ目は、GPT-6.x、Gemini 4、Claude 5.5 系についての英日の独立人手評価。二つ目は、PLaMo 3 Translate の第三者評価。三つ目は、Qingqiu-MT-9B と Lumen の GGUF 版や MLX 版の登場である。特に三つ目が実現すれば、人手評価 85〜90 の品質が Mac のローカルで手に入り、クラウドの清書モードが要らなくなる可能性がある。逆に、Gemini 3.1 Pro の Preview が終了した場合は、清書モードの既定を Argon に移す前に、自前評価で 3.1 Pro の点数との差を必ず測るべきである。
