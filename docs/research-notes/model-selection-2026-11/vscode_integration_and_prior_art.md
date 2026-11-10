# VS Code拡張からのLLM翻訳と対訳Markdownプレビュー：API・実装パターン・先行事例（2026年11月時点）

凡例: 調査日は2026-11-09。日付はVS Codeのバージョンとリリース日（または月）で示し、2026年より前の情報には【2025以前】を付けた。インストール数は2026-11-09にVisual Studio Marketplaceのgallery APIとOpen VSX APIで取得した値（Marketplace＝MP、Open VSX＝OVSX）。原文の直接引用は最小限にとどめ、内容は日本語で要約した。API名・設定名・拡張IDは原文のまま。

## Q1. vscode.lm（Language Model API）の現状：使えるモデル、同意フロー、課金とクォータ、レート制限、フォークとWeb、利用条件

### Takeaway
`vscode.lm` はStable APIとして使える。ただし返ってくるモデルは、その環境に入っているプロバイダ（Copilot Chat、Ollama公式拡張などのプロバイダ拡張）次第で、0件も正常系として扱う必要がある。初回の `sendRequest` で同意ダイアログが出るため、ユーザー操作を起点にしか呼べず、systemロールも無い。Copilotのモデルは2026年6月以降、トークン従量のAI Creditsで課金される。Cursor・VSCodium・Kiroなどのフォークではモデルが無い前提で考えるべきで、翻訳拡張の唯一のバックエンドにはできない。

### Cited Findings

#### 時期の基準
- VS CodeはStableリリースをv1.111（2026-03-09）から週次に切り替えた — [Thurrott](https://www.thurrott.com/dev/333528/visual-studio-code-moves-to-a-weekly-update-schedule); [DevClass](https://www.devclass.com/development/2026/03/12/microsoft-ships-vs-code-weekly-adds-autopilot-mode-so-ai-can-wreak-havoc-without-bothering-you/5208978); [@IT](https://atmarkit.itmedia.co.jp/ait/articles/2603/13/news023.html)
- 2026-11-09時点の最新Stableはv1.145（2026-11-04）、開発中のInsidersはv1.146 — [v1.145 release notes](https://code.visualstudio.com/updates/v1_145); [v1_146.md](https://github.com/microsoft/vscode-docs/blob/main/release-notes/v1_146.md)

#### Stable APIの仕様（microsoft/vscode mainブランチの vscode.d.ts）
- `lm.selectChatModels(selector)` が返すモデルは0件のことも複数件のこともある。モデルが1つも無いケースも拡張側で穏当に処理する必要があり、戻り値は空配列になり得ると明記されている。`lm.onDidChangeChatModels` が発火したらモデル一覧を再取得するよう求めている — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts)
- `LanguageModelChat.vendor` の値はモデルを寄与する拡張が決める。`copilot` は例の1つにすぎない — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts)
- `LanguageModelChat.sendRequest` は、拡張ごとに初回の呼び出しで同意ダイアログを出す。このためユーザー操作への応答としてのみ呼ぶべきとされる — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts)
  - 失敗時は `LanguageModelError` で区別する。`NoPermissions` は同意なし、`NotFound` はモデル消失、`Blocked` はクォータ超過。それ以外は `cause` を確認する。
- `context.languageModelAccessInformation.canSendRequest(chat)` は同意UIを出さない。保存済みの許可状態だけを `boolean | undefined` で返す — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts)
- `LanguageModelChatRequestOptions` は `justification`、`modelOptions`、`tools`、`toolMode` を持つ。`justification` はモデルへのアクセスが必要な理由を人間向けに説明する文字列。トークン数は `LanguageModelChat.countTokens` で見積もれる — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts)
- 公式ガイド（DateApproved 11/4/2026）が示す制約 — [Language Model API guide](https://code.visualstudio.com/api/extension-guides/ai/language-model)
  - 現時点でsystemメッセージには非対応。
  - 同意は認証ダイアログとして実装されている。
  - `selectChatModels` もコマンドなどユーザー起点の処理の中で呼ぶよう推奨している。
  - 結合テストでこのAPIを使ってはならない。
- 同じガイドは、モデルファミリーの例に `gpt-4o`、`gpt-4o-mini`、`o1`、`o1-mini`、`claude-3.5-sonnet` を、GPT-4oの上限に64Kを挙げたままである。2026年のGitHub料金表のモデル一覧（GPT-6 Luna、Claude Haiku 5.5など）と一致せず、ドキュメントが陳腐化している — [Language Model API guide](https://code.visualstudio.com/api/extension-guides/ai/language-model); contradicted by [GitHub Docs: Models and pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)
- レート制限について、ガイドは拡張にレート制限を意識した責任ある利用を求めている。VS Codeは、各拡張のモデル利用状況とリクエスト数、それがクォータに与える影響をユーザーに見せる、としている。具体的な制限値は示していない — [Language Model API guide](https://code.visualstudio.com/api/extension-guides/ai/language-model)

#### 提案（proposed）API：未確定のため公開拡張では使えない
- 提案APIは変更される可能性があり、Insiders版でしか使えない。公式文書には "should not be used in published extensions" とある。Marketplaceには公開できないが、VSIXで配り `--enable-proposed-api` 付きで起動する使い方はできる — [Using Proposed API](https://code.visualstudio.com/api/advanced-topics/using-proposed-api)
- `languageModelSystem`: `LanguageModelChatMessageRole.System`（=3）を追加する（issue #206265） — [vscode.proposed.languageModelSystem.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.languageModelSystem.d.ts)
- `languageModelRateLimit`: `LanguageModelError.RateLimited(message?, retryAfter?)` を追加する。`retryAfter` の単位はミリ秒（issue #340039） — [vscode.proposed.languageModelRateLimit.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.languageModelRateLimit.d.ts)
- `languageModelPricing`: モデル情報に `pricing` を追加する。中身は `inputCost`、`outputCost`、`cacheCost`（100万トークン当たりのAI credits）と価格カテゴリ — [vscode.proposed.languageModelPricing.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.languageModelPricing.d.ts)
- `languageModelProxy`: `lm.isModelProxyAvailable` と `lm.getModelProxy()` で、CopilotのモデルをHTTPプロキシ `{uri, key}` として受け取れる — [vscode.proposed.languageModelProxy.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.languageModelProxy.d.ts)
  - 使えないのは次の場合。Copilot Chatが未インストール、または起動・認証が終わっていない。ユーザーが未ログイン、または対象外のSKU。
- `languageModelCapabilities`: `supportsToolCalling`、`supportsImageToText`、`apiType`（ChatCompletions、Responses、Messages）を追加する — [vscode.proposed.languageModelCapabilities.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.languageModelCapabilities.d.ts)
- 2026年のリリースノートでAPIのfinalizeが明記されたのは2件だけ。Portable modeの検出（v1.110）とTimeline API（v1.145）で、上記のLM系の提案はいずれも未確定のまま（ローカルに取得したv1.95〜v1.146のリリースノートを全文検索して確認） — [v1.110](https://code.visualstudio.com/updates/v1_110); [v1.145](https://code.visualstudio.com/updates/v1_145)

#### 取得できるモデル（2026年）
- Copilot Chat拡張（`GitHub.copilot-chat`）はMP 79,193,392インストール。表示上の最新版はv0.48.1（最終更新2026-05-15） — [Marketplace](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)
- BYOKの仕組み — [VS Code docs: Language models](https://code.visualstudio.com/docs/agent-customization/language-models)
  - 組み込みプロバイダはAzure、Anthropic、Gemini、OpenAIなど。
  - Custom Endpointプロバイダは、非推奨になったOpenAI Compatibleプロバイダの後継。Chat Completions、Responses、Messagesの各形式に対応する。
  - BYOKのモデルはGitHubへのサインインもCopilotプランも無しで動く。
  - BYOKが使われるのはチャットとユーティリティタスクに限られる。
  - Business/Enterpriseの管理者は、ポリシー「Bring Your Own Language Model Key in VS Code」でBYOKを無効にできる。
  - プロバイダ拡張は `@tag:language-models` で検索できる。
  - 組み込みOllamaプロバイダは非推奨。
- v1.122（2026-05-28）でBYOKがGitHubサインイン不要になり、エアギャップ環境や制限のある環境でもチャット・ツール・MCPを使えるようになった — [v1.122](https://code.visualstudio.com/updates/v1_122)
  - 追加できるプロバイダはAnthropic、Azure、Gemini、OpenAI、Ollama、OpenRouter、カスタムエンドポイント。
  - インライン補完とNESは引き続きサインインが必要。BYOKが動かすのはチャット、ツール、MCPだけ。
- v1.127（2026-07-01）で組み込みOllamaプロバイダが非推奨になった。Ollamaの公式VS Code拡張が推奨の経路になった — [v1.127](https://code.visualstudio.com/updates/v1_127)
- vscode.d.tsの説明では、`LanguageModelChatProvider` が提供するモデルはチャットビューからも使え、他の拡張が `LanguageModelChat` として取得して使うこともできる — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts)
- Tetrate（2026-08-12）は、Custom Endpointとして設定したモデルは `vscode.lm` でモデルを選ぶ他の拡張には提供されないと書いている。公式ドキュメントには、この点の肯定も否定も見当たらない — [Tetrate blog](https://tetrate.io/blog/tetrate-model-provider-vscode-extension); [VS Code docs: Language models](https://code.visualstudio.com/docs/agent-customization/language-models)
- 実験的なオンデバイスモデルの要件と特徴 — [VS Code docs: Language models](https://code.visualstudio.com/docs/agent-customization/language-models)
  - Copilotが管理し、GitHubへのサインインが必要。
  - VRAM 96GB以上のNVIDIA GPUと、llama.cpp b11658以降が必要。
  - モデルはMAI Code 1.1 Flash。消費は0 creditsと表示される。
- Autoモデル選択にはEfficiency、Balance、Intelligenceの段階がある — [VS Code docs: Language models](https://code.visualstudio.com/docs/agent-customization/language-models)
- BYOKを使うと、組み込みモデルに課される標準のレート制限や制約を回避できる、との説明がある — [VS Code docs: Language models concepts](https://code.visualstudio.com/docs/agents/concepts/language-models)
- v1.104（2025年8月版）【2025以前】の時点では、プロバイダAPIで提供されるモデルを使えるのは個人向けCopilotプランのユーザーだけ、と注記されていた — [v1.104](https://code.visualstudio.com/updates/v1_104)
  - その後、2026-04-22にGitHub changelogが「BYOK in VS Code now available」と告知した（本文は未取得）。2026年のドキュメントはBusiness/Enterprise向けの管理ポリシーを載せている — [GitHub changelog 2026-04-22](https://github.blog/changelog/2026-04-22-bring-your-own-language-model-key-in-vs-code-now-available/); [VS Code docs](https://code.visualstudio.com/docs/agent-customization/language-models)
- v1.102（2025年6月版）【2025以前】で、Copilot Chatが提供するモデルにどの拡張がアクセスできるかを、ユーザーが「Manage Language Model Access...」から管理できるようになった — [v1.102](https://code.visualstudio.com/updates/v1_102)
- 既知の不具合の例: Foundry Localのカスタムモデルが、`selectChatModels` では取得できるのにモデルピッカーには出ない（#296786） — [microsoft/vscode#296786](https://github.com/microsoft/vscode/issues/296786)

#### 課金とクォータ（2026年6月以降）
- GitHubは2026-06-01から、Copilotの利用でGitHub AI Creditsを消費する方式に移行した — [GitHub blog 2026-04-27](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/)
  - 各プランに含まれるクレジット: Pro（$10）は$10分、Pro+（$39）は$39分、Business（$19/ユーザー）は$19分、Enterprise（$39/ユーザー）は$39分。
  - コード補完とNext Edit Suggestionsはクレジットを消費しない。
  - フォールバックの仕組みは廃止された。
- v1.122のリリースノートによれば、インタラクションごとにAI creditsを消費する。消費量は使ったモデルと、入力・出力・キャッシュのトークンコストで決まる — [v1.122](https://code.visualstudio.com/updates/v1_122)
- 1 AI credit = 0.01 USD。料金表にコストゼロのモデルは無い。最安はGPT-6 LunaとClaude Haiku 5.5で、100万トークン当たり入力$0.10、出力$0.50 — [GitHub Docs: Models and pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)
- 個人プランの詳細 — [GitHub Docs: Individual billing](https://docs.github.com/en/copilot/concepts/billing-and-usage/individuals/billing)
  - Proは1,500 credits（基本1,000＋flex 500）、Pro+は7,000、Max（$100）は20,000。
  - Freeは月2,000回のコード補完を含む。FreeとStudentが使えるモデルは自動モデル選択だけ。
  - クレジットは翌月に繰り越せない。
  - VS Codeの最低バージョンとして1.120が挙がっている。
- 年額契約のPro/Pro+ユーザーは、旧来のリクエスト課金のまま続けられる — [GitHub Docs: What changed](https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/what-changed-with-billing)
- 旧課金での「リクエスト」の定義には、拡張を通じた支援も含まれていた — [GitHub Docs: Copilot requests (legacy)](https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/copilot-requests)
- コミュニティFAQによると、2026-06-16時点で全プランが従量課金になっている — [GitHub Community #197089](https://github.com/orgs/community/discussions/197089)
- AI creditsの消費率はモデルによって異なり、処理したトークン量に応じて決まる — [VS Code docs: Language models concepts](https://code.visualstudio.com/docs/agents/concepts/language-models)

#### 利用条件
- LM APIガイドがMarketplace公開について述べている点 — [Language Model API guide](https://code.visualstudio.com/api/extension-guides/ai/language-model)
  - 公開前にMicrosoftのAIツールとプラクティスのガイドラインを読むこと。
  - 公開した時点で、GitHub Copilot extensibilityのAcceptable Development and Use Policyに従うことになる。
  - AI以外の機能も持つ拡張は、Copilotへのハードな `extensionDependencies` を付けないこと。
- 同ポリシーの主な内容 — [GitHub Copilot extensibility acceptable development and use policy](https://docs.github.com/en/early-access/copilot/github-copilot-extensibility-platform-partnership-plugin-acceptable-development-and-use-policy)
  - 利用許諾の目的は、相互運用性の開発・デモ・テスト・サポートに限られる。
  - ユーザーに生成AIのコンテンツとやり取りしていることを通知する。
  - 通知と同意なしに個人データを扱わない。
  - プラットフォームで取得したデータのスクレイピング、データベース構築、コピー作成をしない。
  - 広告に利用しない。
  - アクセスは打ち切られることがある。
  - 「チャット用途に限る」という明示的な条項は見当たらない。

#### フォークとWeb
- Cursor
  - フォーラムでCursorのスタッフが、拡張API経由でモデルを公開していないと回答している。スレッドは約2年前のもの【2025以前】 — [Cursor forum #44585](https://forum.cursor.com/t/vscode-language-model-api-support/44585); [Cursor forum #26563](https://forum.cursor.com/t/vscode-lm-api-in-vscode-extensions/26563)
  - 一方、Tech Insider（2026-09-26）はCursorでも動くと主張するが、根拠は示していない。同記事は `selectChatModels({})` へのフォールバックと、エディタごとの検証を勧めている。上のフォーラム回答と対立する — [Tech Insider](https://tech-insider.org/vscode-extension-language-model-api-cursor-tutorial-2026/)
- VSCodiumはCopilotを同梱しない方針を続けている — [linuxcompatible.org](https://www.linuxcompatible.org/story/vscodium-114317232-fixes-dropdowns-but-doubles-down-on-dropping-copilot); [VSCodium discussion #1487](https://github.com/VSCodium/vscodium/discussions/1487)
  - Open VSXには、Code OSSやVSCodium向けをうたうプロバイダ拡張もある（例: omnicopilot） — [Open VSX: omnicopilot](https://open-vsx.org/extension/diegosouzapw/omnicopilot)
- Antigravityが `vscode.lm` でモデルを公開している証拠は見つからなかった — [Roo-Code#10305](https://github.com/RooCodeInc/Roo-Code/issues/10305)
- WindsurfとCursorの互換性については、2025年11月の二次資料による評価しか無い【2025以前】 — [glama.ai (Mimir research doc)](https://glama.ai/mcp/servers/@orneryd/Mimir/blob/01c0203d447ab4f6e04aa15d0c830d92bd4f2749/docs/research/VSCODE_CHAT_PARTICIPANT_CURSOR_WINDSURF.md)
- Kiroについては一次資料が無い。比較記事に、KiroはAmazon Bedrockを使うという記述があるだけ — [mcp.directory](https://mcp.directory/blog/cursor-vs-windsurf-vs-antigravity-vs-kiro-2026)
- VS Code for the Web
  - Copilot ChatのWeb対応を求めるissueがある（2025年2月）【2025以前】 — [vscode-copilot-release#3904](https://github.com/microsoft/vscode-copilot-release/issues/3904)
  - 2026年に利用可能になったとする第三者の記事があるが、未検証 — [vscodemobile.com](https://vscodemobile.com/news/github-copilot-chat-visual-studio-code)
  - Web Worker拡張ホストはESMに対応していない（v1.100時点）【2025以前】 — [v1.100](https://code.visualstudio.com/updates/v1_100)

### Inferences
- `vscode.lm` は「0件が正常系」の追加アダプタとして実装し、単独のバックエンドにはしない。フォーク、未ログイン、Freeプラン、BYOKだけの環境では空になり得る。
- 同意ダイアログがあるため、保存時の自動翻訳のような裏での実行は `canSendRequest()` が `true` のときだけに限る。未同意のときは「翻訳」ボタンなど、ユーザーの明示的な操作を求める。
- systemロールが無いので、指示と用語集は先頭のUserメッセージに入れる。System roleの提案APIは公開拡張では使えない。
- Copilot経由で長文を翻訳すると、ユーザーのAI creditsを消費する可能性が高い。公式の明言は無いが、根拠は3つある。2026年の課金がトークン従量であること、ゼロコストのモデルが無いこと、旧定義に拡張経由の利用が含まれていたこと。このため、送信前の `countTokens` による見積もり、キャッシュ、安価なモデルの選択、使用量の表示が必要になる。
- ポリシーの「取得データのコピー作成の禁止」は、Copilotのモデル出力を永続的に翻訳キャッシュとして保存することと衝突し得る（法的な解釈は未確認）。Copilot由来のキャッシュはローカルに限定してユーザーが消せるようにし、UIにAI生成である旨を表示するのが安全。
- Apple Siliconで `vscode.lm` 経由のオフライン翻訳をする場合、公式のオンデバイス機能（NVIDIAが必須）は使えない。BYOK、Ollama公式拡張、LM Studioのサードパーティ製プロバイダ拡張が前提になる。
- Free/Studentは自動選択しか使えないので、`family` を指定したselectorでは空になる恐れがある。`{vendor:'copilot'}`、`{}` と段階的に条件を緩めるフォールバックを用意する。

### Gaps
- サードパーティ拡張の `vscode.lm` 呼び出しがAI creditsを消費するのかについて、公式の明言が無い。2026年の課金ドキュメントには記載が無く、旧課金の定義からの類推しかできない。
- Free/Studentプランで `selectChatModels` が何を返すか（自動選択のみの制約がAPIにどう現れるか）。
- 組み込みBYOK（OpenRouter、Anthropicなど）やCustom Endpointのモデルが、他の拡張の `selectChatModels` に現れるか。Tetrateは否定している。DeepWikiのvscode-copilot-chat解説ページは、検索スニペット上ではBYOKのvendor（anthropic、openaiなど）を選べるかのように示唆していたが、429エラーで本文を確認できなかった。公式の記述は無い。
- 拡張からの利用に対する具体的なレート制限値（公開情報なし）。
- Cursor、Windsurf、Kiro、Antigravityの2026年時点の挙動。vscode.devで `vscode.lm` が使えるか。いずれも一次資料が見つからなかった。
- Copilot Chat拡張のMarketplace上の最終更新が2026-05-15で止まっている理由（未調査）。
- 2026-04-22のGitHub changelog（BYOKの一般提供）の本文と、対象プランの詳細。

## Q2. Language Model Chat Provider API：確定時期、Ollama・LM Studio・OpenRouterのプロバイダに頼れるか、既存のプロバイダ拡張

### Takeaway
`LanguageModelChatProvider` はv1.104（2025年8月版）で確定した。2026年11月時点でMarketplaceの `language-models` タグには419の拡張がある。

各プロバイダの状況:
- **Ollama:** 公式拡張がある（vendor `ollama-models`、VS Code 1.127以上が必要）。
- **LM Studio:** 公式拡張は無く、サードパーティ製（vendor `lmstudio`）が最大。
- **OpenRouter:** v1.122以降は組み込みのBYOKプロバイダになったが、他の拡張から見えるかは確認できていない。

翻訳拡張は「入っていれば `vscode.lm` 経由で使う」程度にとどめるべきで、同じサーバーへHTTPで直接つなぐ経路を必ず持つべきである。

### Cited Findings
- v1.104（2025年8月版）【2025以前】で `LanguageModelChatProviders` APIが確定した。拡張がクラウドやローカルのモデルを寄与できるようになり、例としてAI Toolkit、Cerebras、Hugging Faceが挙がっている。この時点では「個人プラン限定」の注記があった — [v1.104](https://code.visualstudio.com/updates/v1_104); [@code on X](https://x.com/code/status/1966638511269794238)
- v1.103（2025年7月版）【2025以前】でプロバイダAPIが改訂された — [v1.103](https://code.visualstudio.com/updates/v1_103)
- APIの形 — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts); [Language Model Chat Provider guide](https://code.visualstudio.com/api/extension-guides/ai/language-model-chat-provider)
  - 登録は `lm.registerLanguageModelChatProvider(vendor, provider)`。vendorはグローバルに一意である必要がある（例: `copilot`、`openai`）。
  - 実装するメソッドは `provideLanguageModelChatInformation(options: {silent}, token)`、`provideLanguageModelChatResponse(model, messages, options, progress, token)`、`provideTokenCount`。イベント `onDidChangeLanguageModelChatInformation` は任意。
  - package.jsonの `contributes.languageModelChatProviders` で宣言する。項目は `vendor`、`displayName`、任意の `managementCommand`。
- 組織の管理者はBYOKポリシーを無効にできる — [Language Model Chat Provider guide](https://code.visualstudio.com/api/extension-guides/ai/language-model-chat-provider)
- v1.105（2025年9月版）【2025以前】のリリースノートに、vsceによる `language-models` タグの扱いが記載されている — [v1.105](https://code.visualstudio.com/updates/v1_105)
- v1.109（2026年1月版）で、提案API「Chat Model Provider Configuration」が入った。プロバイダが設定スキーマを宣言し、設定UIはVS Code側が用意する。`managementCommand` の置き換えを想定している — [v1.109](https://code.visualstudio.com/updates/v1_109)
- 提案API `chatProvider` の主な項目 — [vscode.proposed.chatProvider.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.chatProvider.d.ts)
  - `requestInitiator`: どの拡張がモデルに要求を出したか。
  - `requiresAuthorization`: 他の拡張がこのプロバイダのモデルを使うとき、ユーザーの承認フローを挟む。
  - `isBYOK`、`configurationSchema`、`maxContextWindowTokens`。
  - `isDefault` と `isUserSelectable` は、確定の対象外と注記されている。
- 2026-11-09時点でMarketplaceの `language-models` タグには419拡張がある — [Marketplace: tag language-models](https://marketplace.visualstudio.com/search?term=tag%3Alanguage-models&target=VSCode)

  | 拡張 | MPインストール数 |
  |---|---|
  | GitHub.copilot-chat | 79,193,392 |
  | Foundry Toolkit（ms-windows-ai-studio.windows-ai-studio） | 1,571,918 |
  | Vizards.deepseek-v4-for-copilot | 446,430 |
  | Ollama.ollama | 355,802 |
  | johnny-zhao.oai-compatible-copilot | 124,844 |
  | HuggingFace.huggingface-vscode-chat | 56,735 |
  | AndrewButson.github-copilot-llm-gateway | 53,783 |
  | DanLambiase.lmstudio-copilot-provider | 50,938 |
  | omnicopilot | 45,727 |
  | opilot | 43,991 |
  | NVIDIA NIM | 43,430 |
  | LiteLLM | 18,360 |
  | Unify | 11,782 |
  | Claude model provider | 10,362 |
  | Cerebras | 6,902 |
  | NullSetIndustriesのLM Studioプロバイダ | 6,032 |

- Ollama公式拡張（`Ollama.ollama`） — [Marketplace: Ollama](https://marketplace.visualstudio.com/items?itemName=Ollama.ollama); [ollama/ollama-vscode](https://github.com/ollama/ollama-vscode)
  - 2026-06-22に公開。最新はv0.0.14（2026-10-22）。
  - vendorは `ollama-models`、`engines` は `^1.127.0`。
  - READMEは、1.127より前のVS Codeではプロバイダへの要求のキャンセルが確実には効かないと説明している。
  - 既定のエンドポイントは `http://127.0.0.1:11434`。ローカルモデルはサインイン不要で、クラウドモデルには `ollama signin` が必要。
- 2026年3月のOllama統合の要件（`ollama launch vscode`、Ollama 0.18.3以上、VS Code 1.113以上、Copilot Chat 0.41.0以上）は、二次資料でしか確認できていない — [insights.marvin-42.com](https://insights.marvin-42.com/articles/ollama-models-arrive-in-vs-codes-github-copilot-chat-picker)
- v1.127（2026-07-01）で組み込みOllamaプロバイダが非推奨になり、公式拡張への移行が案内された — [v1.127](https://code.visualstudio.com/updates/v1_127)
- LM Studio: 公式のVS Codeプロバイダ拡張は見つからなかった。最大はサードパーティ製の `DanLambiase.lmstudio-copilot-provider`（vendor `lmstudio`、v1.30.9、2026-11-02更新） — [Marketplace: LM Studio provider](https://marketplace.visualstudio.com/items?itemName=DanLambiase.lmstudio-copilot-provider)
- OpenRouter: v1.122で組み込みBYOKプロバイダの1つとして挙げられている。公式のOpenRouterプロバイダ拡張は見つからなかった — [v1.122](https://code.visualstudio.com/updates/v1_122)
- v1.128（2026-07-08）では、Custom EndpointでのtemperatureやTop-pの指定など、BYOKが改善された — [v1.128](https://code.visualstudio.com/updates/v1_128)

### Inferences
- 翻訳拡張はモデルを使う側として、vendor（`copilot`、`ollama-models`、`lmstudio` など）を決め打ちしない。`selectChatModels()` の結果をそのままユーザーに選ばせ、`onDidChangeChatModels` で一覧を更新する設計がよい。
- Ollama公式拡張を経由する場合、キャンセルを確実に効かせるにはVS Code 1.127以上が前提になる。
- Custom Endpointで設定したモデル（OpenRouterや自前サーバー）が他の拡張に公開されない可能性があるので、OpenAI互換のHTTP直結アダプタは必須。
- 翻訳拡張自身が `LanguageModelChatProvider` を実装する必要は無い。翻訳はチャット機能ではないため。
- `requiresAuthorization` が確定すると、翻訳拡張を初めて使うときに、プロバイダ拡張側の承認フローが1段加わる可能性がある。

### Gaps
- 組み込みBYOKプロバイダのvendor IDと、他の拡張からの見え方（Q1と同じ未解決点）。
- Copilot以外のvendor（プロバイダ拡張）のモデルを使うときにも同意ダイアログが出るか、課金がどう扱われるか。
- LM Studio公式のVS Code統合があるかどうか（見つからなかった）。

## Q3. vscode.lm以外の直接呼び出し：公式SDK、OpenAI互換エンドポイント、Vercel AI SDK、バンドル、SecretStorage、プロキシ、キャンセル

### Takeaway
最も依存が少なく、対応範囲も広いのは、グローバル `fetch` でOpenAI互換のHTTP（Chat Completionsのストリーミング）を直接呼ぶ層である。対象はOllama（`http://localhost:11434/v1/`）、LM Studio（`http://localhost:1234/v1`）、OpenRouterなど。拡張ホストはv1.101以降Node 22で動き、v1.100以降ESMにも対応している。このため、ESM専用でNode 22が必須のAI SDK 7（2026年6月）、`openai` 7.x、`@google/genai` 3.xも使える。ただし、esbuildで1ファイルにまとめるのが無難。APIキーは `SecretStorage` に置き、プロキシはv1.96以降の `fetch` のプロキシ対応に任せ、キャンセルは `CancellationToken` から `AbortController` へ橋渡しする。

### Cited Findings

#### 実行環境
- v1.100（2025年4月版）【2025以前】で、Node拡張ホストがESMの拡張（`"type": "module"`）に対応した。Web Worker拡張ホストは未対応 — [v1.100](https://code.visualstudio.com/updates/v1_100)
- v1.101（2025年5月版）【2025以前】で拡張ホストがNode 22になった（Electron 35、Node 22.15.1） — [v1.101](https://code.visualstudio.com/updates/v1_101)
- v1.103（2025年7月版）【2025以前】でElectron 37、Node 22.17.0になった — [v1.103](https://code.visualstudio.com/updates/v1_103)
- バンドル手順のガイドにあるesbuildスクリプトの例では、`external: ['vscode']` を指定している — [Bundling Extensions](https://code.visualstudio.com/api/working-with-extensions/bundling-extension)

#### SDKと互換エンドポイント
- npmの最新版（2026-11-09時点）

  | パッケージ | バージョン | 備考 | 出典 |
  |---|---|---|---|
  | `ai` | 7.0.166 | Node 22以上、ESM | [npm: ai](https://registry.npmjs.org/ai/latest) |
  | `@ai-sdk/openai-compatible` | 3.0.87 | | [npm](https://registry.npmjs.org/@ai-sdk/openai-compatible/latest) |
  | `@ai-sdk/openai` | 4.0.111 | | [npm](https://registry.npmjs.org/@ai-sdk/openai/latest) |
  | `@ai-sdk/anthropic` | 4.0.99 | | [npm](https://registry.npmjs.org/@ai-sdk/anthropic/latest) |
  | `@anthropic-ai/sdk` | 1.6.0 | CJS | [npm](https://registry.npmjs.org/@anthropic-ai/sdk/latest) |
  | `openai` | 7.53.0 | Node 22以上 | [npm](https://registry.npmjs.org/openai/latest) |
  | `@google/genai` | 3.0.0 | ESM、Node 22以上 | [npm](https://registry.npmjs.org/@google/genai/latest) |
  | `ollama` | 0.6.4 | | [npm](https://registry.npmjs.org/ollama/latest) |
  | `markdown-it` | 15.0.3 | | [npm](https://registry.npmjs.org/markdown-it/latest) |

- AI SDK 7（2026-06-25）の主な変更 — [Vercel changelog: AI SDK 7](https://vercel.com/changelog/ai-sdk-7)
  - Node 22以上が必須。ESMでのimportが必須で、CommonJSの `require()` は使えない。
  - テレメトリは `@ai-sdk/otel` に分離された。
  - 改名: `system` は `instructions` に、`onFinish` は `onEnd` に、`fullStream` は `stream` に。
  - finishチャンクが来る前に終わったストリームはエラーとして扱う。
  - タイムアウト用のオブジェクトと `TimeoutError` が入った。
  - 移行用のcodemod `npx @ai-sdk/codemod v7` がある。
- 一つ前のAI SDK 6は2025-12-22に出た【2025以前】 — [Vercel blog: AI SDK 6](https://vercel.com/blog/ai-sdk-6)
- OllamaのOpenAI互換API — [Ollama docs: OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)
  - ベースURLは `http://localhost:11434/v1/`。
  - エンドポイントは `/v1/chat/completions`、`/v1/completions`、`/v1/responses`（v0.13.3以降）、`/v1/models`、`/v1/embeddings`。
  - クライアント側はAPIキーの値を要求するが、Ollamaはそれを無視する。
  - OpenAI APIにはコンテキスト長を指定する手段が無いので、Modelfileの `num_ctx` などで設定する。
  - クラウドは `https://ollama.com/v1` と `OLLAMA_API_KEY` で使う。
- LM StudioのOpenAI互換API — [LM Studio docs: OpenAI compatibility](https://lmstudio.ai/docs/developer/openai-compat)
  - ベースURLは `http://localhost:1234/v1`。
  - エンドポイントは `/v1/models`、`/v1/responses`、`/v1/chat/completions`、`/v1/embeddings`、`/v1/completions`。
  - ドキュメントのナビゲーションには、Anthropic Messages互換のエンドポイントも載っている。

#### 秘密情報、ネットワーク、キャンセル、保存先
- `SecretStorage`（`context.secrets`）は秘密情報を暗号化して保存する。実装はプラットフォームごとに異なり、マシン間では同期されない。APIは `get`、`store`、`delete`、`keys` と `onDidChange` — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts)
- v1.96（2024年11月版）【2025以前】で、グローバル `fetch` がプロキシに対応した（設定 `http.fetchAdditionalSupport`）。`https` モジュールが従来から対応していたのと同様 — [v1.96](https://code.visualstudio.com/updates/v1_96)
  - 一方、ネットワーク設定のドキュメントには、拡張はまだVS Code本体と同等のプロキシ対応の恩恵を受けられない、という記述が残っている（issue #12588）。リリースノートと矛盾している — [Network Connections in VS Code](https://code.visualstudio.com/docs/setup/network)
- `http.fetchAdditionalSupport` と `http.systemCertificates` を無効にしたら、別の拡張の起動時のハングが解消した、という報告がある — [Seqera community](https://community.seqera.io/t/code-nextflow-extension-stuck-on-initializing-nextflow-language-server-fixed-by-disabling-fetchadditionalsupport-systemcertificates/2519)
- `sendRequest` もプロバイダの各メソッドも `CancellationToken` を受け取る — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts)
- Ollama公式拡張のREADMEは、1.127より前ではキャンセルが確実でないと明記している — [ollama/ollama-vscode](https://github.com/ollama/ollama-vscode)
- `ExtensionContext.globalStorageUri` は、拡張がグローバルな状態を置けるディレクトリ。存在が保証されるのは親ディレクトリだけで、作成は拡張側の責任。キーと値の組なら `globalState` を使うよう案内されている — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts)
- 既存拡張の実装例
  - `adullboy.vscode-ai-translation`: OpenAI互換のストリーミングをWebviewに表示し、APIキーはSecretStorageに保存 — [Marketplace](https://marketplace.visualstudio.com/items?itemName=adullboy.vscode-ai-translation); [GitHub](https://github.com/angrytoro/vscode-plugin-ai-translation)
  - `zzgosh.marklingo`: SecretStorage — [Marketplace](https://marketplace.visualstudio.com/items?itemName=zzgosh.marklingo)
  - Markdown Twin View: SecretStorage — [Marketplace](https://marketplace.visualstudio.com/items?itemName=yukiidayo.markdown-twin)
  - Read Markdown Translator: APIキーはOSのキーチェーン — [Marketplace](https://marketplace.visualstudio.com/items?itemName=VladimirTroyanenko.kiro-md-translator-plugin)
- `languageModelProxy` は、CopilotのモデルをOpenAI互換のURLとキーとして渡す提案APIだが、提案APIのため公開拡張では使えない — [vscode.proposed.languageModelProxy.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.languageModelProxy.d.ts); [Using Proposed API](https://code.visualstudio.com/api/advanced-topics/using-proposed-api)

### Inferences
- 第一候補は、依存を最小限にした自前実装。グローバル `fetch` でOpenAI Chat Completions（`stream: true` のSSE）を直接呼べば、Ollama、LM Studio、OpenRouter、vLLMなどを1つの実装でまかなえる。v1.96以降のプロキシ対応も受けられる。
- 複数のクラウドのネイティブ機能（Anthropic/Geminiの固有機能など）が必要になったら、AI SDK 7を追加する。ESM専用なので、`"type":"module"` の拡張にするか（Node拡張ホスト専用になり、Web拡張では使えない）、esbuildで依存ごとバンドルする。
- Node 22を前提とするSDK（`ai` 7.x、`openai` 7.x、`@google/genai` 3.x）を使うなら、`engines.vscode` の下限は `^1.101` 以上にする。
- `CancellationToken.onCancellationRequested` を `AbortController.abort()` につなぎ、編集で再翻訳するときに古いリクエストを止める。kian-zhの拡張の「古いリクエストのキャンセル」と同じ考え方。
- OllamaをOpenAI互換で呼ぶ場合、コンテキスト長は既定値のままになる。長いブロックをまとめて送るときは上限を小さく取るか、Modelfileで `num_ctx` を設定するようユーザーに案内する。

### Gaps
- 2026年時点で、拡張の `fetch` が実際にどこまでプロキシに対応しているか。リリースノートとネットワーク設定のドキュメントが矛盾していて、実機で確認していない。
- AI SDK 7（ESM専用）をesbuildでCJS出力にバンドルしたときに動くか（未検証）。AI SDK、`openai` 7.x、`@google/genai` 3.xがグローバル `fetch`（つまりプロキシ対応）を使うかも未確認。
- LM StudioのAnthropic互換エンドポイントの仕様。ナビゲーションの表示しか確認していない。
- Web拡張（vscode.dev）からlocalhostのOllamaやLM Studioへつなげるか（CORSなど、未調査）。

## Q4. Markdownプレビューの実装方法：組み込みプレビューの拡張点、独自Webview、CustomTextEditorProvider、TextDocumentContentProvider、スクロール同期、Mermaid/KaTeX、テーマ、CSP

### Takeaway
組み込みプレビューは、markdown-itの各ブロックtokenに `data-line`（0始まりのソース行）とクラス `code-line` を付け、その値を補間してスクロールを同期している。拡張は `markdown.markdownItPlugins`、`previewStyles`、`previewScripts` で中身を差し込める。ただし、訳文を非同期で反映するには内部コマンド `markdown.api.reloadPlugins` に頼るしかなく、プレビュー側のスクリプトから拡張へ戻る経路も文書化されていない。

対訳ビューの本命は独自のWebviewである。同じ `data-line` の考え方に、ブロック単位のグリッド表示を組み合わせる。Mermaid（v1.121で組み込み化）とKaTeX（組み込みの `markdown-math` は `@vscode/markdown-it-katex` を使用）は自前で同梱し、厳格なCSPと `--vscode-*` のテーマ変数で見た目を整える構成になる。

### Cited Findings

#### 組み込みプレビューの内部（ソースマップとスクロール同期）
- `markdownEngine.ts` のソースマップ処理 — [markdownEngine.ts](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/src/markdownEngine.ts)
  - core rulerの `source_map_data_attribute` が、`token.map` を持つinline以外のtokenに `data-line`（値は `token.map[0]`）、クラス `code-line`、`dir="auto"` を付ける。
  - `html_block` のレンダラはattrsを反映しないため、別にマーカーを挿入している。
  - プラグインは次の順に適用される: 寄与された `markdownItPlugins`、front matter、画像・fence・リンクのレンダラ、見出しID、ソースマップ（最後）。
- `scroll-sync.ts` の同期アルゴリズム — [scroll-sync.ts](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/preview-src/scroll-sync.ts)
  - クラス `code-line` を持つ要素を集める。
  - エディタからプレビューへ: あるソース行に対して前後の要素（previousとnext）を求め、行番号の比率で要素の位置を線形補間してスクロールする。複数行にまたがるコードブロックは `endLine` を使い、要素の中を比例スクロールする。
  - プレビューからエディタへ: `getEditorLineNumberForPageOffset` が同じ考え方で補間する。
- 設定 `markdown.preview.scrollPreviewWithEditor` と `markdown.preview.scrollEditorWithPreview` は、どちらも既定で `true`。`markdown.preview.frontMatter` の既定は `table` — [markdown-language-features package.json](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/package.json)
- markdown-itの `Token.map` は `[line_begin, line_end]` 形式のソースマップ — [markdown-it token.mjs](https://cdn.jsdelivr.net/npm/markdown-it/lib/token.mjs); [markdown-it](https://github.com/markdown-it/markdown-it)
- v1.108（2025年12月版）【2025以前】で、非表示の要素がスクロール同期の対象から外れた — [v1.108](https://code.visualstudio.com/updates/v1_108)
- v1.114（2026-04-01）、v1.118（2026-04-29）、v1.119（2026-05-06）でも、プレビューのスクロールまわりが修正された — [v1.114](https://code.visualstudio.com/updates/v1_114); [v1.118](https://code.visualstudio.com/updates/v1_118); [v1.119](https://code.visualstudio.com/updates/v1_119)
- 内部コマンドが2つある。どちらもMarkdown拡張ガイドには載っていない — [renderDocument.ts](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/src/commands/renderDocument.ts); [reloadPlugins.ts](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/src/commands/reloadPlugins.ts); [Markdown Extension guide](https://code.visualstudio.com/api/extension-guides/markdown-extension)
  - `markdown.api.render`: 文書を組み込みエンジンでHTMLにして返す。
  - `markdown.api.reloadPlugins`: プラグインを読み直し、キャッシュを消し、全プレビューを再描画する。

#### 組み込みプレビューへの寄与点
- Markdown拡張ガイドが定める寄与点 — [Markdown Extension guide](https://code.visualstudio.com/api/extension-guides/markdown-extension)
  - `markdown.previewStyles`: 組み込みのスタイルの後、ユーザー設定 `markdown.styles` の前に追加される。
  - `markdown.markdownItPlugins: true`: `activate` で `extendMarkdownIt(md)` を返すと、markdown-itを拡張できる。拡張は、プレビューが初めて表示されたときに遅延して起動される。
  - `markdown.previewScripts`: 非同期で読み込まれ、内容が変わるたびに読み込み直される。
  - 実験的な `markdown.codeBlockEditorProviders` は、プレビューではなく新しいMarkdownエディタ向け。信頼済みワークスペースが必要で、`@vscode/web-editors` を使う。
- 組み込みの数式表示は、built-in拡張 `markdown-math` が担う — [markdown-math package.json](https://github.com/microsoft/vscode/blob/main/extensions/markdown-math/package.json)
  - `markdown.markdownItPlugins` と `markdown.previewStyles` で寄与し、`@vscode/markdown-it-katex`（^1.1.2）を使う。
  - 設定は `markdown.math.enabled`（既定 `true`）と `markdown.math.macros`。
- v1.121（2026-05-20） — [v1.121](https://code.visualstudio.com/updates/v1_121)
  - Matt BiernerのMarkdown Preview Mermaid Supportが、built-in拡張 `Mermaid Markdown Features` として取り込まれた。プレビュー、ノートブック、チャットで使え、パンとズームもできる。
  - `markdown.preview.frontMatter`（`table`、`codeBlock`、`hide`）が追加され、front matterは既定で表として表示されるようになった。
- v1.120（2026-05-13）で、diffビューでのMarkdownプレビューが入った（Preview扱い）。`workbench.diffEditorAssociations` で `*.md` を `vscode.markdown.preview.editor` に関連付ける — [v1.120](https://code.visualstudio.com/updates/v1_120)
  - 同じ版で提案API `customEditorDiffs` も入った。`resolveCustomEditorSideBySideDiff(documents, webviewPanels, token)` は左右2つのWebviewに描画し、レイアウトとスクロール同期をVS Code側が調整する。
  - v1.146時点でも提案APIのままなので、公開拡張では使えない — [vscode-dts（proposed一覧）](https://github.com/microsoft/vscode/tree/main/src/vscode-dts); [Using Proposed API](https://code.visualstudio.com/api/advanced-topics/using-proposed-api)
- v1.131（2026-07-29）でハイブリッドMarkdownエディタ（Experimental）が入った — [v1.131](https://code.visualstudio.com/updates/v1_131); [v1.132](https://code.visualstudio.com/updates/v1_132); [v1.137](https://code.visualstudio.com/updates/v1_137); [v1.142](https://code.visualstudio.com/updates/v1_142)
  - v1.132でdiff、v1.137でGitHubリンク、v1.142（2026-10-14）で画像の貼り付け、リネーム、アウトラインに対応した。
- v1.104（2025年8月版）【2025以前】で、数式の描画が既定で有効になった。ただし対象はチャットのみ — [v1.104](https://code.visualstudio.com/updates/v1_104)

#### 独自Webview、カスタムエディタ、仮想ドキュメント
- Webviewガイドのセキュリティとテーマの要点 — [Webview API guide](https://code.visualstudio.com/api/extension-guides/webview)
  - CSPの例は、`default-src 'none'` を基本に、img、script、styleの読み込み元を `webview.cspSource` に限定する。
  - ローカルのリソースは `asWebviewUri` で読み込み、`localResourceRoots` で範囲を絞る。ただし `localResourceRoots` だけでは完全な防御にならない。
  - bodyには `vscode-light` や `vscode-dark` のクラスが付き、`--vscode-editor-foreground`、`--vscode-editor-font-family` などのCSS変数が使える。
  - 状態は `getState` と `setState` で保持できる。
  - 機能は最小限にし、サニタイズだけに頼らない。
- CVE-2026-54702（2026-10-14公開）: Markdown Preview Enhancedの0.8.30未満は、プレビューWebviewから届いたメッセージのcommandとargsを検証せずに `vscode.commands.executeCommand` に渡していた。Webview内でJavaScriptを実行できれば、ファイルの変更、コードの実行、URLを開く、といった特権コマンドを呼べた。0.8.30で修正済み — [OSV: CVE-2026-54702](https://osv.dev/vulnerability/CVE-2026-54702); [GHSA-83c6-hcjv-pvmg](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/security/advisories/GHSA-83c6-hcjv-pvmg)
- `CustomTextEditorProvider` は、`TextDocument` をデータモデルにするテキスト系カスタムエディタ。undoやバックアップはVS Codeに任せられるが、WebviewとTextDocumentの同期は拡張の責任になる — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts); [Custom Editor API guide](https://code.visualstudio.com/api/extension-guides/custom-editors)
- `TextDocumentContentProvider` は、URIスキームごとに登録する読み取り専用の仮想ドキュメント — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts); [Virtual Documents guide](https://code.visualstudio.com/api/extension-guides/virtual-documents)

#### 既存拡張のプレビュー方式（READMEの記載による）
- `ah-kevin.md-immersive-translate`: 組み込みプレビューを使う — [Marketplace](https://marketplace.visualstudio.com/items?itemName=ah-kevin.md-immersive-translate); [GitHub](https://github.com/ah-kevin/Markdown-Translator)
  - 拡張ホスト側でmarkdown-itを使ってブロックを集める。
  - `markdownItPlugins` で訳文のDOMを差し込み、バッチが終わるたびに `markdown.api.reloadPlugins` を呼んで段階的に描画する。
  - `webview-panel:` URIを解決している。
- `yxm1122.markdown-bilingual-sync`: トップレベルの意味ブロック単位で扱う。表示はside-by-side、上下に並べるstacked、本当に画面を分けるtrue splitの3種類で、ブロック単位でスクロールを同期する — [Marketplace](https://marketplace.visualstudio.com/items?itemName=yxm1122.markdown-bilingual-sync); [GitHub](https://github.com/yxm1122/Markdown-Bilingual-Sync)
- Read Markdown Translator（`VladimirTroyanenko.kiro-md-translator-plugin`）: `*.md` を既定で開くカスタムエディタ `kiro-md-translator.preview`。2カラムの対訳表示で、段落単位でスクロールを同期する — [Marketplace](https://marketplace.visualstudio.com/items?itemName=VladimirTroyanenko.kiro-md-translator-plugin); [GitHub](https://github.com/non4me/kiro-md-translator-plugin)
- `foxnz/md-bilingual-preview`: 1つのブロックをCSS Gridの1行に割り当てる。段落の位置が自然に揃うので、スクロール同期は要らないと説明している — [README](https://raw.githubusercontent.com/foxnz/md-bilingual-preview/main/README.md)
- `harryplusplus.bilingual-markdown-preview`: Webviewで原文と訳文を並べる。スケルトンUI、デバウンス、キャッシュを持つ — [Marketplace](https://marketplace.visualstudio.com/items?itemName=harryplusplus.bilingual-markdown-preview)
- `liujie2288.immersive-translate-vscode`: エディタ上でDecoration APIを使って訳文を表示する — [Marketplace](https://marketplace.visualstudio.com/items?itemName=liujie2288.immersive-translate-vscode)
- `czm233.vscode-side-translate`: 横に編集可能なプレビューを出す。逆翻訳と、原文の置き換えができる — [Marketplace](https://marketplace.visualstudio.com/items?itemName=czm233.vscode-side-translate)

### Inferences
- 推奨構成
  - 独自の `WebviewPanel` に、markdown-it 15で自前描画する。`.md` を「対訳で開く」入口が欲しければ、`CustomTextEditorProvider` を任意で追加する。
  - トップレベルのブロックに `data-line` と `data-seg` を付け、原文と訳文をブロック単位でグリッドの同じ行に並べる。こうすれば並びは構造的にずれない（foxnz方式）。
  - VS Codeの補間アルゴリズムを移植するのは、左右2ペインのモードだけでよい。
- エディタから対訳ビューへの同期は、エディタの可視範囲の変化（`window.onDidChangeTextEditorVisibleRanges` など）から先頭行をWebviewへ送り、Webview側で `data-line` を補間して実現できる（VS Codeと同じ方式）。
- 組み込みプレビューに差し込む方式（ah-kevin方式）は「軽量モード」として有力。Mermaid、KaTeX、front matterの表示、テーマ、既存のスクロール同期をそのまま使える。ただし弱点が2つある。
  - 非同期の訳文反映が内部コマンド `markdown.api.reloadPlugins` 頼みになる。
  - プレビュー側から拡張へ戻る経路が文書化されていないので、ブロックごとの「再翻訳」ボタンなどの操作を作りにくい。
- 差し込み方式では、寄与したプラグインがソースマップより先に動く。訳文用のtokenに `map` を付けなければ `data-line` は付かないので、スクロール同期を乱さずに済む（`markdownEngine.ts` の適用順からの推論）。
- 独自Webviewでは、Mermaid（npm `mermaid`）とKaTeX（`@vscode/markdown-it-katex` または `katex`）を同梱し、CSPは `cspSource` とnonceで組む。Webviewから拡張へのメッセージは、種類と引数をallowlistで検証する（CVE-2026-54702の教訓）。
- `TextDocumentContentProvider` で訳文のMarkdownを仮想ドキュメントとして出し、組み込みプレビューで開く方式もある。ただし原文と訳文の対応が失われるので、対訳表示ではなく「訳文だけのプレビュー」やエクスポート向き。
- `customEditorDiffs`（2つのWebviewのスクロール同期をVS Codeが調整する）は対訳ビューにぴったりだが、提案APIなので公開できない。確定するか見守る。

### Gaps
- `markdown.previewScripts` から、寄与した拡張へメッセージを送る公式の手段があるか（ドキュメントに記載が無い）。
- 独自Webviewの厳格なCSPのもとで、MermaidやKaTeXを動かすのに必要な緩和（インラインstyleなど）。未検証。
- built-inの `Mermaid Markdown Features` を独自Webviewから再利用できるか。
- ハイブリッドMarkdownエディタ（v1.131以降）に拡張ポイントがあるか（未調査）。
- ハイコントラストテーマ用のbodyクラスなど、Webviewガイドの該当箇所（今回は確認していない）。

## Q5. 先行事例：MarketplaceとOpen VSXのMarkdown翻訳拡張、VS Code以外のUX

### Takeaway
Markdownを翻訳・対訳表示する拡張は2026年に急に増えたが、ほとんどが数十〜数千インストールの小規模なものである。数十万規模はcomment-translate（MP約72万）だけで、それもMarkdown翻訳は副機能にすぎない。

既存拡張の分布:
- 翻訳エンジンとして `vscode.lm` を使うのはbreaking-brakeだけ。
- ローカルLLM（Ollama）に対応するものは少数。
- スクロール同期やブロック整列つきの対訳ビューは、yxm1122、Read Markdown Translator、foxnzくらい。
- 非公式の無料Web翻訳エンドポイントに頼るものが多い。

UXの手本はImmersive Translate型（段落の直下に訳文を出す、または左右に対訳を並べる）である。

### Cited Findings

#### Markdown翻訳・対訳プレビュー系（2026-11-09時点、READMEの記載による）
- `intellsmi.comment-translate` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=intellsmi.comment-translate); [Open VSX](https://open-vsx.org/extension/intellsmi/comment-translate); [GitHub](https://github.com/intellism/vscode-comment-translate)
  - 規模: MP 721,614（v3.1.0、2026-03-04）、OVSX 35,301（v3.0.0）。
  - 主機能はコメントの翻訳。Markdownの翻訳プレビュー、没入型のコメント翻訳もある。
  - `@translate` チャット参加者を持つ。Copilotによる翻訳はチャット欄でのみ使え、コメントには使えない。
  - 翻訳ソースは `translates` 寄与でプラグインとして追加できる（deepl-translate、openrouter-translateなど）。
- `yxw007.vscode-translate-next`（Translate Pro） — [Marketplace](https://marketplace.visualstudio.com/items?itemName=yxw007.vscode-translate-next)
  - 規模: MP 9,314（v1.13.0、2026-11-08）。
  - Markdownプレビューの没入型翻訳を持つ。
  - エンジン: Google、DeepL、Azure、Amazon、Baidu、Tencent、OpenAI。
- `liujie2288.immersive-translate-vscode` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=liujie2288.immersive-translate-vscode)
  - 規模: MP 1,428（v0.0.1、2026-02-10）。
  - Decoration APIで訳文を表示する。
  - エンジン: Google、DeepL、Baidu。3層のキャッシュを持つ。リポジトリは記載なし。
- `carrotj.mdcarrot` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=carrotj.mdcarrot); [Open VSX](https://open-vsx.org/extension/carrotj/mdcarrot)
  - 規模: MP 715、OVSX 10,287（v1.5.1、2025-12-17）【2025以前】。
  - 画面分割で表示する。繁体字中国語向け。
  - エンジン: Google、Azure、Amazon。キャッシュは永続化される。ブラウザ版もある。
- `adullboy.vscode-ai-translation` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=adullboy.vscode-ai-translation); [GitHub](https://github.com/angrytoro/vscode-plugin-ai-translation)
  - 規模: MP 681（v0.2.0、2026-03-28）。
  - OpenAI互換APIのストリーミングをWebviewに表示する。APIキーはSecretStorageに保存。
- `breaking-brake.markdown-ai-translator` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=breaking-brake.markdown-ai-translator); [GitHub](https://github.com/breaking-brake/markdown-ai-translator); contradicted by [GitHub blog](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/); [Models and pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)
  - 規模: MP 669（v0.3.2、2026-03-16）。
  - `vscode.lm`（Copilot）を使い、ストリーミングで表示する。
  - `chunkSize`（5000）で分割し、24時間キャッシュする。
  - 既定値は `modelId` が `copilot-fast`、訳先が日本語。
  - READMEの課金の説明は2026年6月のAI Credits移行と食い違う。READMEはFreeを月50リクエスト、Proの `copilot-fast`（GPT-4o mini）を倍率0x（実質無料）と説明している。一方GitHubによれば、フォールバックは廃止され、料金表にゼロコストのモデルも無い。
- `iyulab.vscode-translate-panel` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=iyulab.vscode-translate-panel)
  - 規模: MP 483（v1.1.0、2026-05-10）。
  - エンジン: Google（非公式）またはGemini。保存時または入力時に更新する。
- `ah-kevin.md-immersive-translate` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=ah-kevin.md-immersive-translate); [GitHub](https://github.com/ah-kevin/Markdown-Translator)
  - 規模: MP 364（v1.0.4、2026-09-22、初公開2026-05-18）。Open VSXには無い。
  - 組み込みプレビューに差し込む方式（Q4参照）。
  - エンジン: googleWeb（モバイル版の `/m` エンドポイント）とdeeplFree（Web版のJSON-RPC）。
  - キャッシュはURI単位でメモリ上のみ。
- `harryplusplus.bilingual-markdown-preview` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=harryplusplus.bilingual-markdown-preview)
  - 規模: MP 323（v1.2.0、2026-01-26）。`engines` は ^1.108.1。
  - Webviewで原文と訳文を並べる。Google翻訳の無料APIを使う。
  - 既定の訳先は韓国語（ko）。
- `czm233.vscode-side-translate` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=czm233.vscode-side-translate)
  - 規模: MP 231（v0.0.8、2026-06-05）。
  - プロバイダ: fastest（BingとDeepL Freeを同時に投げて速い方を採用）、deepl、google、bing。
- `Gulai.md-translate-ai` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=Gulai.md-translate-ai); [GitHub](https://github.com/gulai22/VSCodeTranslate)
  - 規模: MP 176（v0.1.6、2026-05-07）。
  - 訳文は `xxx_zh.md` に書き出し、ハッシュをキーにしたキャッシュ `xxx.translate.json` を持つ。
  - 空行で分割し、URLはプレースホルダに置き換え、約3,000字ずつバッチ送信する。`TextEditor.edit()` で順次反映する。
  - OpenAI互換のプリセットが21種類（ollama、openrouterを含む）。
- `zzgosh.marklingo` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=zzgosh.marklingo); [Open VSX](https://open-vsx.org/extension/zzgosh/marklingo); [GitHub](https://github.com/zzgosh/marklingo)
  - 規模: MP 95、OVSX 6,122（v0.1.1、2026-08-16）。
  - `*_<language>_mdt.md` に書き出す。差分キャッシュと使用量ダッシュボードを持つ。
  - プロバイダ: OpenRouter、OpenAI、DeepSeek、Moonshot、GLM、MiMo、カスタム。
  - APIキーはSecretStorage。フォルダ単位で一括翻訳できる。
- Read Markdown Translator（`VladimirTroyanenko.kiro-md-translator-plugin`） — [Marketplace](https://marketplace.visualstudio.com/items?itemName=VladimirTroyanenko.kiro-md-translator-plugin); [Open VSX](https://open-vsx.org/extension/VladimirTroyanenko/kiro-md-translator-plugin); [GitHub](https://github.com/non4me/kiro-md-translator-plugin)
  - 規模: MP 67、OVSX 6,852（v0.8.0、2026-07-27）。
  - カスタムエディタで2カラムの対訳を表示し、段落単位でスクロールを同期する。
  - プロバイダ: DeepL、Google、Ollama、カスタム。AIアシスタント機能のプロバイダの選択肢に `vscode-copilot` がある。
  - 用語集の語、コード、インラインコード、URLは送信しない。
  - 永続的な翻訳メモリと50件のLRUキャッシュを持つ。APIキーはOSのキーチェーンに保存。
- Markdown Twin View（`yukiidayo.markdown-twin`） — [Marketplace](https://marketplace.visualstudio.com/items?itemName=yukiidayo.markdown-twin); [GitHub](https://github.com/yuki-net/vscode-markdown-twin)
  - 規模: MP 57（v1.2.1、2026-11-06）。
  - エンジン: Azure、Google Cloud、DeepL、Papago。
  - 表示は「訳文のみ」「対訳」「訳文のソース」の3種類。
  - APIキーはSecretStorage。オフラインで使えるのはセッション内のキャッシュだけ。UIは日・英・韓・中。
- `yxm1122.markdown-bilingual-sync` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=yxm1122.markdown-bilingual-sync); [GitHub](https://github.com/yxm1122/Markdown-Bilingual-Sync)
  - 規模: MP 4（v0.17.0、2026-11-01、初公開2026-10-24）。`engines` は ^1.95。
  - ロック、ブリーフ、階層化した用語集を持つ。
  - 保護すべき構文を翻訳後に復元し、プロンプトをそのまま返したような出力は棄却する。
  - トークン予算に合わせてバッチを組み、同時実行数を全体で共有する。
  - プロバイダ: openai、http、mock。Language Model Toolsを5つ提供する。
- `kian-zh.claude-markdown-translator` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=kian-zh.claude-markdown-translator); [Open VSX](https://open-vsx.org/extension/kian-zh/claude-markdown-translator); [GitHub](https://github.com/kian-zh/markdown-translator)
  - 規模: MP 16、OVSX 4,558（v0.1.2、2026-07-26）。
  - ローカルのClaude Code CLIを1文書につき1回呼ぶ（Haiku、低effort、`--safe-mode`、ツール無効）。
  - 結果をストリーミングで描画する。保護すべきMarkdownを検証し、コード・URL・タグを復元し、失敗したら1回だけ再試行する。
  - 古くなったリクエストはキャンセルする。キャッシュはセッション内のみ。
- `hejian991.immersive-translate-vscode-plugin` — [Marketplace](https://marketplace.visualstudio.com/items?itemName=hejian991.immersive-translate-vscode-plugin); [Open VSX](https://open-vsx.org/extension/hejian991/immersive-translate-vscode-plugin)
  - 規模: MP 63、OVSX 4,685（v0.1.2、2026-09-19）。
  - エンジン: Google、Bing、OpenAI、Gemini、DeepSeek。インライン表示とスライド表示がある。
- `hiyeshu.md-translator-zh` — [Open VSX](https://open-vsx.org/extension/hiyeshu/md-translator-zh)
  - 規模: OVSX 5,810（Open VSXのみ、v1.0.22、2026-04-28）。
  - プレビューとMarkdownの2画面で表示し、差分だけを翻訳する。Cursorを意識した外観。
  - プロバイダ: free（Google Web＋MyMemory）、Volcengine、OpenAI互換LLM（既定はGLM）。
- `foxnz/md-bilingual-preview` — [README](https://raw.githubusercontent.com/foxnz/md-bilingual-preview/main/README.md)
  - GitHubでのみ公開（v0.5.0）。
  - ブロックごとにCSS Gridの1行を割り当てる。
  - キャッシュキーは「モデル｜目標言語｜ブロック内容のSHA1」で、メモリ上のみ。
  - コード、front matter、HTMLブロックは送信しない。インデントによるコードブロックは保護されない。
  - インラインの書式は、プレースホルダではなくプロンプトでの指示で守らせる。
  - 読み取り専用で、OpenAI互換APIを使う。

#### 周辺の事例
- `iahhai.ipynb-translator`: MP 3,481。Jupyterノートブックの翻訳。OpenAI互換、翻訳メモリ、RAG、用語集 — [Marketplace](https://marketplace.visualstudio.com/items?itemName=iahhai.ipynb-translator)
- `m-cube.doc-translate`: MP 229。Anthropic、OpenAI、Gemini、Azureに対応し、同時実行数の上限 `maxConcurrentRequests` を設定できる — [Marketplace](https://marketplace.visualstudio.com/items?itemName=m-cube.doc-translate)
- `techfetch-dev.project-translator`: MP 246、OVSX 9,524 — [Marketplace](https://marketplace.visualstudio.com/items?itemName=techfetch-dev.project-translator); [Open VSX](https://open-vsx.org/extension/techfetch-dev/project-translator)
- `HikaruEgashira.vscode-translate-agent`: MP 142。Copilotのチャット参加者（2024年12月）【2025以前】 — [Marketplace](https://marketplace.visualstudio.com/items?itemName=HikaruEgashira.vscode-translate-agent)
- `chuanyunux.pararead`: MP 113。PDFを文単位で対訳表示する（2026-09-30） — [Marketplace](https://marketplace.visualstudio.com/items?itemName=chuanyunux.pararead)
- `markdown-translate.markdown-translate`: MP 4,675。2019年から更新されていない【2025以前】 — [Marketplace](https://marketplace.visualstudio.com/items?itemName=markdown-translate.markdown-translate)
- 翻訳の補助ツールとして参照できるCLI `smikitky/chatgpt-md-translator` は、Markdownを本格的には構文解析しないと明言している（詳細はQ6） — [GitHub](https://github.com/smikitky/chatgpt-md-translator)

#### VS Code以外のUX
- Immersive Translate（ブラウザ拡張） — [Immersive Translate docs](https://immersivetranslate.com/en/docs/); [PDF translate](https://immersivetranslate.com/en/f-pdf-translate/); [Firefox Add-ons](https://addons.mozilla.org/ja/firefox/addon/immersive-translate-beta)
  - 段落を最小単位として翻訳する。ホバー翻訳では訳文を段落のすぐ下に表示する。訳文の表示スタイルは複数から選べる。
  - PDFではレイアウトを保ったまま左右に対訳を並べる。翻訳エンジン（OpenAI、DeepL、Geminiなど）を選べ、対訳を書き出せる。
- 似たオープンソースの対訳ブラウザ拡張としてkiss-translatorがある — [fishjar/kiss-translator](https://github.com/fishjar/kiss-translator)

### Inferences
- 市場はまだ未成熟で、上位を占める決定版が無い。新しい拡張は次の点で差別化できる。
  - `vscode.lm`、BYOK、ローカルを1つの拡張で扱える。
  - 構造の保証（検証と再試行）。
  - 永続キャッシュ。
  - 日本語を既定にした設定。
- Open VSXのダウンロード数は、無名の拡張でも4,000〜6,000程度に集まる傾向がある（mdcarrot、marklingo、Read Markdown Translator、kian-zh、hejian991、hiyeshuなど）。Marketplaceのインストール数とは比べられない。
- 中国語や韓国語向けの拡張が多い（訳先の既定がzhやko）。日本語を既定にしているのはbreaking-brake、日本語UIを持つのはMarkdown Twinくらいである。
- UXの手本はImmersive Translateの「段落の直下に訳文」と「左右に対訳」の2つ。対訳ビューに、この2つを切り替えるトグルを付けるのが自然である。

### Gaps
- 評価はREADMEの記載によるもので、実際にインストールして試してはいない。スクロール同期の品質、構造保持の実際の効果、キャッシュの挙動は確認できていない。
- アクティブユーザー数、評価（星）、レビューは集めていない。インストール数だけでは採用の度合いを測れない。
- 日本語の対訳Markdownプレビュー拡張を紹介する記事（Qiita、Zennなど）は、該当するものが見つからなかった。

## Q6. LLMでMarkdownを堅牢に翻訳する技法：AST分割と行マップ、マスキング、用語集、翻訳メモリとキャッシュ、差分再翻訳、ストリーミング、front matterと表、同時実行の制御

### Takeaway
先行事例とドキュメントから導けるベストプラクティスは、次の一連の手順である。
1. ASTでブロックに分割し、行マップを保持する。markdown-itなら `token.map`（0始まり）、unist/mdastなら `position`（1始まり）。
2. コード、URL、HTML、front matterは、そもそも送らないか、プレースホルダで隠す。
3. 用語集はそのバッチに出てくる語だけをプロンプトに入れる。
4. 「バックエンド｜モデル｜プロンプト版｜用語集｜言語｜ブロック本文」のハッシュをキーに永続キャッシュし、変わったブロックだけを訳し直す。
5. ブロック単位でストリーミング表示する。
6. 同時実行数を制限し、Retry-Afterに従う。
7. 出力の構造を検証し、失敗したら再試行する。

### Cited Findings
- markdown-itの `Token.map` は `[line_begin, line_end]` 形式のソースマップ — [markdown-it token.mjs](https://cdn.jsdelivr.net/npm/markdown-it/lib/token.mjs)
- VS Codeの組み込みプレビューは、`token.map[0]` を `data-line` に入れて、エディタとプレビューの対応付けに使っている — [markdownEngine.ts](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/src/markdownEngine.ts)
- unistの `position` は、`line` と `column` が1始まり、`offset` が0始まり — [syntax-tree/unist](https://github.com/syntax-tree/unist)
- markdown-itの最新版は15.0.3 — [npm](https://registry.npmjs.org/markdown-it/latest)
- `smikitky/chatgpt-md-translator` の手法 — [chatgpt-md-translator](https://github.com/smikitky/chatgpt-md-translator)
  - 文書を断片（`FRAGMENT_TOKEN_SIZE`、既定2048）に分けて並列に翻訳する。
  - `CODE_BLOCK_PRESERVATION_LINES`（既定5行）を超える長いコードブロックはダミー文字列に置き換え、短いものは文脈として残す。
  - temperatureは0.1。API呼び出しの間隔を設定できる。
  - 本格的なMarkdownの構文解析はしないと明記している。
  - 断片が小さすぎると訳語の一貫性が落ちる、という注意がある。
- `Gulai.md-translate-ai`: 空行で分割する。URLはプレースホルダに置き換える。約3,000字ずつバッチにする。ハッシュをキーにした `translate.json` で差分だけを訳す。結果は `TextEditor.edit()` で順次書き込む — [Marketplace](https://marketplace.visualstudio.com/items?itemName=Gulai.md-translate-ai); [GitHub](https://github.com/gulai22/VSCodeTranslate)
- `foxnz/md-bilingual-preview`: キャッシュキーは「モデル｜目標言語｜ブロック内容のSHA1」（メモリ上のみ）。コード、front matter、HTMLブロックは送らない。インデントによるコードブロックは保護されない。インラインの書式はプロンプトの指示で守らせる — [README](https://raw.githubusercontent.com/foxnz/md-bilingual-preview/main/README.md)
- `yxm1122.markdown-bilingual-sync`: 次の仕組みを持つ — [GitHub](https://github.com/yxm1122/Markdown-Bilingual-Sync)
  - トップレベルの意味ブロックに分割する。
  - 保護すべき構文を翻訳後に復元する。
  - プロンプトをそのまま返したような出力を棄却する。
  - トークン予算に合わせてバッチを組み、同時実行数を全体で共有する。
  - 用語集を階層化し、ロックやブリーフを付けられる。
- `kian-zh.claude-markdown-translator`: 保護すべきMarkdownを検証し、コード・URL・タグを復元する。失敗したら1回だけ再試行し、古くなったリクエストはキャンセルする — [GitHub](https://github.com/kian-zh/markdown-translator)
- Read Markdown Translator: 用語集の語、コード、インラインコード、URLは送信しない。永続的な翻訳メモリと50件のLRUキャッシュを持つ — [GitHub](https://github.com/non4me/kiro-md-translator-plugin)
- `breaking-brake.markdown-ai-translator`: `chunkSize` 5000で分割し、ストリーミングで表示し、24時間キャッシュする — [GitHub](https://github.com/breaking-brake/markdown-ai-translator)
- `m-cube.doc-translate`: 同時実行数の上限 `maxConcurrentRequests` を設定できる — [Marketplace](https://marketplace.visualstudio.com/items?itemName=m-cube.doc-translate)
- `iahhai.ipynb-translator`: 翻訳メモリ、RAG、用語集を持つ — [Marketplace](https://marketplace.visualstudio.com/items?itemName=iahhai.ipynb-translator)
- OllamaのOpenAI互換APIではコンテキスト長を指定できない — [Ollama docs](https://docs.ollama.com/api/openai-compatibility)
- 提案API `LanguageModelError.RateLimited` は `retryAfter`（ミリ秒）を持つ（未確定） — [vscode.proposed.languageModelRateLimit.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.languageModelRateLimit.d.ts)
- AI SDK 7は、finishチャンクの前に終わったストリームをエラーとして扱う。出力が途中で切れたかどうかの判定に使える — [Vercel changelog: AI SDK 7](https://vercel.com/changelog/ai-sdk-7)
- v1.121以降、VS Codeはfront matterを既定で表として表示する（`markdown.preview.frontMatter`） — [v1.121](https://code.visualstudio.com/updates/v1_121)

### Inferences
推奨パイプライン（先行事例を組み合わせた設計案）:
1. **分割（segment）**
   - markdown-it 15の `md.parse()` で得たトップレベルのブロック（heading、paragraph、list item、blockquote、table、fence、code_block、html_block、hr、front matter）を、`map` 付きのSegmentにまとめる。Segmentは `{id, kind, startLine, endLine, source, hash}`。
   - VS Codeのプレビューと同じ0始まりの行番号を使う。remark/mdastを使うなら、1始まりから0始まりへ変換する。
   - リストは、トップレベルの項目単位まで細かく分けると、キャッシュの効率が上がる。
2. **分類**: 次のものは翻訳しない。fence、インデントによるコードブロック（foxnzが漏らしている）、html_block（またはテキストノードだけ訳す）、数式ブロック、リンク参照定義、hr。front matterはYAMLとして解析し、許可したキー（`title`、`description` など）だけを訳す。
3. **マスキング**: 翻訳対象のブロックの中でも、モデルに訳させてはいけない部分を `⟦0⟧` のようなトークンに置き換える。
   - 置き換える対象: インラインコード、リンクとimageのURL（リンクテキストは訳す）、autolink、インラインHTMLタグ、脚注の参照、インライン数式、HTMLエンティティ。
   - 検証: プレースホルダが過不足なく、それぞれちょうど1回ずつ現れていること。
4. **表**: セルのテキストだけをJSON配列で送って組み直すと、列数が保証される。表全体をそのまま送る場合も、列数と区切り行を検証する。
5. **見出しのアンカー**: VS Codeは見出しテキストからIDを生成する（`markdownEngine.ts` の見出しIDの処理）。見出しを訳すとslugが変わり、文書内の `#anchor` リンクが切れる。対訳ビューでは原文のslugをIDとして保持する。
6. **用語集**: そのバッチに現れる語だけを「原語→訳語」と「訳さない語」（製品名、API名）として先頭のUserメッセージに入れる。`vscode.lm` にはsystemロールが無いため。用語集はユーザー、ワークスペース、ファイルの3層で扱う（yxm1122と同じ）。
7. **キャッシュと翻訳メモリ**
   - キーは `sha256(backendId|modelId|promptVersion|glossaryHash|srcLang|tgtLang|maskedSegmentText)`。
   - 保存先は `globalStorageUri` の下のJSONLやSQLite。チームで共有したい場合は、ワークスペース内のサイドカー（Gulai方式の `*.translate.json`）にも書き出せるようにする。
   - メモリ上にはLRUを置く（Read Markdown Translatorと同じ）。
8. **差分の再翻訳**
   - 編集されたら500〜1000msのデバウンスの後に分割し直し、ハッシュが変わったブロックだけを訳す。
   - 消えたブロックへの進行中のリクエストは、`CancellationTokenSource` で中止する。
9. **バッチとストリーミング**
   - バッチは1〜2kトークン程度にする。小さすぎると訳語の一貫性が落ちる、というchatgpt-md-translatorの注意を踏まえ、文書のタイトルと直前の見出しを文脈として添える。
   - 出力は `<seg id="12">…</seg>` のような区切りで返させ、ストリームを順次パースしてブロックごとにWebviewへ送る。
10. **同時実行とレート制限**
    - バックエンドごとにセマフォを置く。目安はローカル1〜2、クラウド4〜8。
    - HTTPの `Retry-After` を守り、指数バックオフで再試行する。
    - `vscode.lm` の `Blocked` を受けたら即座に止め、ユーザーに知らせる。
11. **検証とフォールバック**
    - 訳文をmarkdown-itで解析し直して、次を確かめる: ブロックの種類、見出しのレベル、リスト項目の数、表の列数、プレースホルダの集合。プロンプトをそのまま返していないこと（yxm1122と同じ）も確かめる。
    - 失敗したら、バッチを小さくして1回だけ再試行する（kian-zhと同じ）。それでも駄目なら原文を表示し、警告マークを付ける。
12. **生成パラメータ**: temperatureは0〜0.2の低い値にする（chatgpt-md-translatorは0.1）。

### Gaps
- プレースホルダの形式（`⟦n⟧`、XML風のタグ、`{{n}}` など）が、2026年のモデルでどれだけ壊れにくいかを比べた一次資料は見つからなかった。モデルの品質は別の調査者の担当範囲。
- Ollamaの並列実行の設定（同時に処理できるリクエスト数）と、Apple Siliconでの最適な同時実行数は未確認（ローカル実行環境の調査の範囲）。
- front matterの値を翻訳すべきかどうか（静的サイトジェネレーターとの互換性）についての一次資料は無い。

## Q7. 推奨プロバイダ抽象化設計と既存拡張のギャップ

### Takeaway
最初に実装するバックエンドは次の2つ。
1. **OpenAI互換のHTTPアダプタ:** ローカルのOllamaやLM Studioで完全オフラインのモードを実現でき、OpenRouterなどのクラウドも同じコードで使える。フォークやOpen VSXでも動く。
2. **vscode.lmアダプタ:** CopilotやOllama公式拡張などのプロバイダ拡張を使っている人に、設定なしで翻訳を提供できる。

AnthropicやGeminiのネイティブアダプタとDeepL APIは第2段階に回す。既存の拡張には、次の条件をすべて満たすものが無い:
- `vscode.lm`、BYOK、ローカルを1つの抽象で扱える。
- 構造を保証する（検証と再試行）。
- 永続キャッシュで差分だけを訳し直す。
- ブロックが揃った対訳ビューとスクロール同期を持つ。
- 日本語を既定にしている。
- Open VSXとフォークに対応している。

### Cited Findings

#### 設計の根拠（再掲）
- `selectChatModels` は空配列を返し得る。`sendRequest` は初回に同意ダイアログを出し、ユーザー操作を起点に呼ぶ必要がある。同意済みかどうかは `canSendRequest` で確かめられる — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts)
- `vscode.lm` にはsystemメッセージが無い — [Language Model API guide](https://code.visualstudio.com/api/extension-guides/ai/language-model)
- 提案APIはMarketplaceで公開する拡張には使えない — [Using Proposed API](https://code.visualstudio.com/api/advanced-topics/using-proposed-api)
- 2026年6月からCopilotはAI Creditsの従量課金になり、ゼロコストのモデルは無い — [GitHub blog](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/); [Models and pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)
- OllamaとLM StudioはOpenAI互換のエンドポイントを持つ（`localhost:11434/v1`、`localhost:1234/v1`） — [Ollama docs](https://docs.ollama.com/api/openai-compatibility); [LM Studio docs](https://lmstudio.ai/docs/developer/openai-compat)
- Ollama公式のプロバイダ拡張（vendor `ollama-models`）はVS Code 1.127以上が必要 — [ollama/ollama-vscode](https://github.com/ollama/ollama-vscode)
- Custom Endpointのモデルは他の拡張に提供されない、という記述がある — [Tetrate](https://tetrate.io/blog/tetrate-model-provider-vscode-extension)
- 拡張ホストはNode 22（v1.101以降）で、ESMに対応している（v1.100以降） — [v1.101](https://code.visualstudio.com/updates/v1_101); [v1.100](https://code.visualstudio.com/updates/v1_100)
- APIキーの保存には `SecretStorage` が使える — [vscode.d.ts](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts)
- `fetch` のプロキシ対応（v1.96）があるが、ドキュメント間に矛盾がある — [v1.96](https://code.visualstudio.com/updates/v1_96); [Network docs](https://code.visualstudio.com/docs/setup/network)
- Copilot extensibilityのポリシーは、生成AIのコンテンツであることの通知を求め、取得データのコピー作成を禁じている — [Policy](https://docs.github.com/en/early-access/copilot/github-copilot-extensibility-platform-partnership-plugin-acceptable-development-and-use-policy)
- Webviewのメッセージを検証しなかったことによる脆弱性の実例がある（Markdown Preview Enhanced、CVE-2026-54702） — [OSV](https://osv.dev/vulnerability/CVE-2026-54702)

#### 既存拡張の現状（READMEの記載による観察）
- 翻訳エンジンとして `vscode.lm` を使うのはbreaking-brakeだけで、ローカルやBYOKの直結には対応していない — [breaking-brake](https://github.com/breaking-brake/markdown-ai-translator)
  - Read Markdown TranslatorはOllamaやカスタムAPIに対応しているが、`vscode-copilot` を選べるのはAIアシスタント機能のプロバイダとしてだけ — [Read Markdown Translator](https://github.com/non4me/kiro-md-translator-plugin)
- 非公式の無料Webエンドポイントに頼る拡張が多い — [ah-kevin](https://github.com/ah-kevin/Markdown-Translator); [harryplusplus](https://marketplace.visualstudio.com/items?itemName=harryplusplus.bilingual-markdown-preview); [czm233](https://marketplace.visualstudio.com/items?itemName=czm233.vscode-side-translate); [iyulab](https://marketplace.visualstudio.com/items?itemName=iyulab.vscode-translate-panel); [hiyeshu](https://open-vsx.org/extension/hiyeshu/md-translator-zh)
  - 例: googleWebの `/m`、deeplFreeのJSON-RPC、Google翻訳の無料API、DeepL Free、MyMemory。
- キャッシュがメモリ上やセッション内だけの拡張がある — [ah-kevin](https://github.com/ah-kevin/Markdown-Translator); [foxnz](https://raw.githubusercontent.com/foxnz/md-bilingual-preview/main/README.md); [Markdown Twin](https://marketplace.visualstudio.com/items?itemName=yukiidayo.markdown-twin); [kian-zh](https://github.com/kian-zh/markdown-translator); [breaking-brake](https://github.com/breaking-brake/markdown-ai-translator)
  - 例: ah-kevin、foxnz、Markdown Twin、kian-zh。breaking-brakeは24時間。
  - 永続化しているのはGulai、marklingo、Read Markdown Translator、mdcarrotなどに限られる。
- スクロール同期やブロック整列を明示しているのは、yxm1122、Read Markdown Translator、foxnz — [yxm1122](https://github.com/yxm1122/Markdown-Bilingual-Sync); [Read Markdown Translator](https://github.com/non4me/kiro-md-translator-plugin); [foxnz](https://raw.githubusercontent.com/foxnz/md-bilingual-preview/main/README.md)
- 出力の構造を検証して再試行することを明記しているのは、yxm1122とkian-zh — [yxm1122](https://github.com/yxm1122/Markdown-Bilingual-Sync); [kian-zh](https://github.com/kian-zh/markdown-translator)
- 構造の保護が粗い例がある — [foxnz](https://raw.githubusercontent.com/foxnz/md-bilingual-preview/main/README.md); [Gulai](https://github.com/gulai22/VSCodeTranslate); [chatgpt-md-translator](https://github.com/smikitky/chatgpt-md-translator)
  - foxnz: インデントによるコードブロックを保護しない。インラインの書式はプロンプト任せ。
  - Gulai: 空行で分割するだけ。
  - chatgpt-md-translator: 本格的な構文解析をしない。
- 課金の前提が古い（breaking-brakeの「0x乗数」の説明） — [breaking-brake](https://github.com/breaking-brake/markdown-ai-translator); [GitHub Docs](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)
- ah-kevinはOpen VSXに無い — [Marketplace](https://marketplace.visualstudio.com/items?itemName=ah-kevin.md-immersive-translate)
- 規模が数十万を超えるのはcomment-translateだけで、それもMarkdown翻訳は副機能 — [Marketplace](https://marketplace.visualstudio.com/items?itemName=intellsmi.comment-translate)

### Inferences

#### 推奨する抽象インターフェース（設計案）
```ts
interface TranslationBackend {
  readonly id: 'openai-compatible' | 'vscode-lm' | 'anthropic' | 'gemini' | 'deepl';
  readonly capabilities: {
    streaming: boolean;          // ストリーミング可
    systemPrompt: boolean;       // vscode-lm は false
    local: boolean;              // localhost のみ（オフラインモード判定）
    needsUserGesture: boolean;   // vscode-lm の初回同意
    defaultConcurrency: number;  // ローカル 1〜2、クラウド 4〜8
  };
  listModels(token: vscode.CancellationToken): Promise<ModelInfo[]>; // 空配列も正常系
  translate(batch: SegmentBatch, opts: TranslateOptions,
            token: vscode.CancellationToken): AsyncIterable<SegmentDelta>;
  countTokens?(text: string, model: ModelInfo): Promise<number>;
}
```
バックエンドの外側に、共通の層を置く。Q6の推奨パイプラインに対応する。
- Segmenter: markdown-it 15と `token.map` による分割。
- Protector: マスキングと復元。
- GlossaryInjector: 用語集の注入。
- Batcher: トークン予算によるバッチ化。
- Limiter: 同時実行の制御。Retry-After、バックオフ、`CancellationToken` から `AbortController` への橋渡しを担う。
- Validator: 構造の検証と再試行。
- TranslationCache: `globalStorageUri` に置き、オプションでサイドカーにも書き出す。
- PreviewBridge: ブロック単位でWebviewへ反映する。

#### バックエンドの優先順位とその理由
1. **OpenAI互換のHTTP（最初に実装）**
   - プリセット: Ollama（`http://127.0.0.1:11434/v1`）、LM Studio（`http://localhost:1234/v1`）、OpenRouter、カスタム。1つの実装で、ローカル（Apple Siliconで完全オフライン）とクラウドの両方をまかなえる。
   - 同意ダイアログもAI Creditsの消費も無く、自動翻訳を自由に実装できる。
   - フォーク、VSCodium、KiroなどOpen VSX経由の配布先でも、そのまま動く。
   - APIキーは `SecretStorage` に置き、ローカルではダミーのキーにする（OllamaはAPIキーを無視する）。
   - 「オフラインモード」では、宛先を `localhost` と `127.0.0.1` に限定する。
2. **vscode.lm（最初の段階で同時に入れる）**
   - Copilotを契約している人と、Ollama公式拡張やLM Studioのプロバイダ拡張を入れている人に、設定なしで翻訳を提供できる。
   - 実装上の注意:
     - 翻訳はユーザーの明示的な操作から始め、自動翻訳は `canSendRequest() === true` のときだけにする。
     - 指示は先頭のUserメッセージに入れる。
     - `justification` を指定する。
     - `NoPermissions`、`Blocked`、`NotFound` をUIで出し分ける。
     - AI Creditsを消費する可能性があることと、AI生成であることを表示する。
     - モデルが0件のときは、OpenAI互換アダプタに誘導する。
     - Copilotにハードな依存を付けない（ガイドの推奨どおり）。
3. **Anthropic、Geminiのネイティブアダプタ（第2段階）**
   - 各社固有の機能（プロンプトキャッシュなど。料金と効果は別の調査者の担当範囲）を使いたい人向け。
   - 実装は公式SDKか、AI SDK 7（ESM専用、Node 22以上）で書き、esbuildでまとめる。
4. **DeepL APIの公式エンドポイント（第2段階、任意）**
   - LLMではない機械翻訳を選べるようにする。
   - 非公式の無料Webエンドポイント（googleWebやdeeplFreeのJSON-RPC）は、公開配布では避ける。利用規約と安定性のリスクがあるため（推論）。

#### プレビューの構成
- **既定:** 独自のWebviewに、ブロックを揃えたグリッドを描く。原文と訳文を左右に並べるか、Immersive Translate風に上下に重ねるかを切り替えられるようにする。
  - スクロール同期は `data-line` の補間で行う（VS Codeの `scroll-sync.ts` を移植）。
  - MermaidとKaTeXは同梱し、CSPは `cspSource` とnonceで組む。テーマは `--vscode-*` の変数に合わせる。
  - メッセージはallowlistで検証する。
- **任意の軽量モード:** `markdown.markdownItPlugins` で組み込みプレビューに訳文を差し込む（ah-kevin方式）。v1.121以降の組み込みMermaid、front matterの表、KaTeXをそのまま使える。ただし内部コマンド `markdown.api.reloadPlugins` に依存するので、実験的な機能として扱う。
- **書き出し:** `TextDocumentContentProvider` で訳文だけの仮想ドキュメントを提供するか、`*.ja.md` として保存する。
- **将来:** `customEditorDiffs` が確定すれば、左右2つのWebviewのスクロール同期をVS Codeに任せられる。

#### engines と配布
- `engines.vscode` は、Node 22を前提とするSDKを使うなら `^1.101` 以上にする。Ollama公式拡張経由のキャンセルを確実にしたいなら1.127以上を推奨する。
- フォークのベースバージョンが古い可能性を考えると、下限は低めにして、機能ごとに実行時に判定するのが無難。
- MarketplaceとOpen VSXの両方に公開する。Open VSXのダウンロード数はMarketplaceと比べられない点に注意する。

#### 既存拡張のギャップ一覧（新しい拡張が埋めるべき点）
1. `vscode.lm`、BYOK、ローカル（Ollama、LM Studio）を1つの抽象で切り替えられる拡張が無い。
2. 永続的な翻訳メモリで、変わったブロックだけを訳し直す仕組みと、構造の検証・再試行を両立している拡張が少ない。
3. ブロックを揃えた対訳ビュー、双方向のスクロール同期、ブロック単位の再翻訳を、すべて持つ拡張が少ない。
4. 表、front matter、生のHTML、インデントによるコードブロック、見出しのアンカーを保護する範囲が狭い。
5. 公開配布に向かない非公式の無料エンドポイントに頼っている。
6. 日本語を既定にし、技術文書向けの用語集（API名などを訳さない語）を用意した拡張がほとんど無い。
7. 2026年のプラットフォームの変化に追いついていない。例: AI Creditsの課金、v1.121の組み込みMermaid、`markdown.preview.frontMatter`、Ollama公式のプロバイダ拡張、BYOKのサインイン不要化。
8. Open VSXやフォークへの対応がばらばら。
9. 使用量（トークンやクレジット）の見積もりと表示があるのは、marklingoのダッシュボードくらいしか無い。

### Gaps
- Cursor、Windsurf、Kiro、Antigravityの2026年時点のVS Codeのベースバージョンと、`vscode.lm` の挙動。`engines` の下限を決めるのに必要だが、一次資料が無い。
- `vscode.lm` を経由した翻訳がAI Creditsを消費するか、Copilotのモデル出力を永続的にキャッシュしてよいか。ポリシーの解釈について、公式の明言が無い。
- Microsoftの「AI tools and practices guidelines」本文（LMガイドが参照を求めているもの）を確認していない。
- 非公式のGoogleやDeepLのWebエンドポイントの利用規約上の扱い（今回は推論のみ）。
- 上記の設計を実装して計測した結果（レイテンシ、キャッシュヒット率、検証の失敗率）は無い。どれも先行事例のREADMEとドキュメントからの推論である。
