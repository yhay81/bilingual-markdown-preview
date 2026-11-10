# Markdown Translation Preview

[English](README.md)

Markdown を原文と訳文で左右に並べてプレビューする VS Code 拡張機能です。翻訳には、**GitHub Copilot** など VS Code の言語モデル、自分の API キー（BYOK）で使う **Claude Haiku 5.5**（`claude-haiku-5-5`）か **GPT-6 Luna**（`gpt-6-luna`）、または手元のコンピューターで動くモデルを使います。

![左に英語の文書、右にその日本語訳をブロックごとに並べたプレビュー](images/screenshot.png)

## 特長

- 見出し・段落・リスト項目・表のセル・引用をブロック単位で翻訳し、原文と訳文の高さを揃えて表示します。
- コードブロック、front matter、画像だけの段落、すでに訳文の言語で書かれた段落は翻訳せず、2 列にまたがって表示します。
- 設定でオンにすると、コードブロックのコメントも翻訳します。コメントを訳したコードを原文の横に並べます（送るのはコメントの文章だけです）。
- ツールバーで「原文」「並べて表示」「訳文」を切り替えられます。エディターとプレビューのスクロールは連動します。
- 画面に見えている部分から先に翻訳し、訳文は届いたそばから表示します。リクエストには直前の文章も添えるので、用語や文体がそろいます。
- インラインコード、URL、リンク先、HTML は記号（`⟦1⟧` など）に置き換えて翻訳に出し、訳文に元のまま戻します。記号が欠けた訳文は自動で訳し直し、それでも直らなければ行に警告を出します。
- 翻訳結果は手元にキャッシュします（最大 20,000 件）。編集しても内容が変わっていないブロックは訳し直しません。
- 訳文は手で直せます。直した訳文は保存され、機械翻訳に戻すこともできます。
- 訳文を `README.ja.md` のような Markdown ファイルとして保存できます。コード・リンク・記法は原文のまま残ります。
- 数式（`$…$`、`$$…$$`）を KaTeX で、Mermaid の図を描画します。`<details>` は原文と訳文をまとめて開閉できます。
- 日本語に訳すときは、です・ます調にそろえます（翻訳者への追加の指示で変えられます）。用語集で訳語を固定できます。用語集は設定のほか、チームで共有するファイルにも書けます。
- 文書ごとに、フロントマターで翻訳先の言語を指定できます。
- 使ったトークン数を表示し、決まった数に達したら翻訳を止めることもできます。
- 狭いパネルでは、訳文を原文の下に並べます。
- 表示は日本語・英語・簡体字中国語・韓国語に対応しています。

## 使い方

VS Code 1.101 以降と、次のいずれかが必要です: GitHub Copilot、Anthropic か OpenAI の API キー、Ollama や LM Studio などのローカルのサーバー。

1. Visual Studio Marketplace から **Markdown Translation Preview** をインストールします。
2. Markdown ファイルを開き、エディター右上の地球のアイコン（**対訳プレビューを横に開く**）を押します。エクスプローラーの右クリックメニューや、コマンドパレットの **Bilingual Markdown: 対訳プレビューを開く** からも開けます。
3. 初めて開くと API キーを求める表示が出ます。**API キーを設定** を押してキーを入力するか、GitHub Copilot を使うなら **プロバイダーを切り替え** を押して **VS Code Language Model** を選びます。
4. 翻訳が始まります。失敗した行は、その行の **再試行** で訳し直せます。

翻訳先は日本語です。ほかの言語に訳すときは、`bilingualMarkdown.targetLanguage` を `English` や `Simplified Chinese` などに変えます。文書ごとに、フロントマターで別の言語を指定することもできます。

```markdown
---
translate-to: French
---
```

## コマンド

| コマンド | 内容 |
| --- | --- |
| Bilingual Markdown: 対訳プレビューを開く | 対訳プレビューを開きます。 |
| Bilingual Markdown: 対訳プレビューを横に開く | エディターの横に開きます。 |
| Bilingual Markdown: 再翻訳（キャッシュを使わない） | 表示中の文書をキャッシュを使わずに訳し直します。 |
| Bilingual Markdown: 訳文を Markdown として保存 | 訳文を Markdown ファイルとして保存します。プレビューのツールバーからも使えます。 |
| Bilingual Markdown: API キーを設定 | API キーを登録します。 |
| Bilingual Markdown: API キーを削除 | 登録した API キーを削除します。 |
| Bilingual Markdown: 翻訳プロバイダーを切り替え | Anthropic、OpenAI、VS Code の言語モデルを切り替えます。 |
| Bilingual Markdown: VS Code の言語モデルを選ぶ | 翻訳に使う VS Code の言語モデルを選びます。 |
| Bilingual Markdown: 翻訳キャッシュを消去 | 保存した翻訳結果を削除します。 |

## プロバイダーと料金

### GitHub Copilot など VS Code の言語モデル

`bilingualMarkdown.provider` を `vscode` にするか、**Bilingual Markdown: 翻訳プロバイダーを切り替え** で **VS Code Language Model** を選びます。API キーは要りません。GitHub Copilot などの拡張機能が VS Code に提供している言語モデルを使います。

- 初回は、この拡張機能がモデルを使ってよいか VS Code が確認します。断った場合は、アカウントメニューの「言語モデルへのアクセスを管理」から許可し直せます。
- 使えるモデルは **Bilingual Markdown: VS Code の言語モデルを選ぶ** で一覧できます。`bilingualMarkdown.vscode.model` が空欄なら、GitHub Copilot の最初のモデルを使います。
- リクエストは、チャットと同じく Copilot のプランの利用枠に数えられます。

### Anthropic と OpenAI

- 利用料金は、キーを発行したアカウントに請求されます。
- キーはパスワード入力欄から登録し、VS Code の Secret Storage（OS のキーチェーン）に保存します。`settings.json` には書きません。
- キーが拒否されたとき（認証エラーや権限不足）は翻訳を止め、プレビュー上でキーの再設定やプロバイダーの切り替えを案内します。
- この VS Code のセッションで使ったトークン数をツールバーに表示します。`bilingualMarkdown.tokenLimit` を設定すると、その数に達したところで翻訳を止め、**続ける** を押すまで待ちます。

### ローカルのモデル

OpenAI 互換の API を持つサーバーなら使えます。`bilingualMarkdown.provider` を `openai` にし、ユーザー設定で `bilingualMarkdown.openai.baseUrl` にサーバーの URL を、`bilingualMarkdown.openai.model` にそのサーバーのモデル名を指定します。手元のコンピューターのサーバーには API キーは要りません。

| サーバー | `bilingualMarkdown.openai.baseUrl` |
| --- | --- |
| [Ollama](https://ollama.com) | `http://localhost:11434/v1` |
| [LM Studio](https://lmstudio.ai) | `http://localhost:1234/v1` |
| llama.cpp（`llama-server`） | `http://localhost:8080/v1` |

小さなモデルは訳の精度が下がり、コードやリンクを表す記号を落とすことも増えます。その場合は行に警告が出ます。

## 設定

| 設定 | 既定値 | 内容 |
| --- | --- | --- |
| `bilingualMarkdown.provider` | `anthropic` | 翻訳に使うプロバイダー（`anthropic` / `openai` / VS Code の言語モデルを使う `vscode`）。 |
| `bilingualMarkdown.targetLanguage` | `Japanese` | 翻訳先の言語。翻訳者に伝えるように書きます（例: `English`、`Simplified Chinese`）。文書のフロントマターの `translate-to` がこれより優先されます。 |
| `bilingualMarkdown.anthropic.model` | `claude-haiku-5-5` | Anthropic のモデル ID。 |
| `bilingualMarkdown.openai.model` | `gpt-6-luna` | OpenAI のモデル ID。 |
| `bilingualMarkdown.openai.baseUrl` | （空欄） | OpenAI 互換 API のベース URL（社内ゲートウェイや[ローカルのサーバー](#ローカルのモデル)）。空欄なら `https://api.openai.com/v1` を使います。`https://` か、`localhost`・`127.0.0.1`・`[::1]` への `http://` だけが使えます。 |
| `bilingualMarkdown.vscode.model` | （空欄） | VS Code の言語モデルの ID またはファミリー。空欄なら GitHub Copilot の最初のモデルを使います。 |
| `bilingualMarkdown.reasoningEffort` | `none` | 回答の前にモデルが推論する量（`none` / `low` / `medium` / `high` / `default`）。翻訳には通常 `none` で足ります。 |
| `bilingualMarkdown.styleInstructions` | （空欄） | 翻訳者への追加の指示（例: `である調で書く`）。 |
| `bilingualMarkdown.glossary` | `{}` | 訳語を固定する用語集。`{ "pull request": "プルリクエスト" }` のように書きます。「[用語集ファイル](#用語集ファイル)」も見てください。 |
| `bilingualMarkdown.translateCodeComments` | `false` | コードブロックのコメントも翻訳します。詳しくは「[コードのコメントの翻訳](#コードのコメントの翻訳)」を見てください。 |
| `bilingualMarkdown.maxConcurrentRequests` | `3` | 同時に送る翻訳リクエストの上限（1〜8）。 |
| `bilingualMarkdown.batchCharacterLimit` | `4000` | 1 回のリクエストで送る原文のおおよその文字数（500〜20000）。 |
| `bilingualMarkdown.tokenLimit` | `0` | 1 回の VS Code のセッションでこの数のトークンを使ったら翻訳を止めます。`0` は無制限です。Anthropic と、api.openai.com の OpenAI で数えます。 |
| `bilingualMarkdown.syncScroll` | `true` | エディターとプレビューのスクロールを連動させます。 |

プロバイダー、モデル、ベース URL、推論の量、同時リクエスト数、1 回の文字数、トークンの上限はユーザー設定でだけ変えられます。ワークスペースの設定ファイルでは変わりません。

## 用語集ファイル

ワークスペースのルートの `.vscode/translation-glossary.json` に用語集を置くと、チームで共有できます。

```json
{
  "pull request": "プルリクエスト",
  "deploy": "デプロイ"
}
```

ファイルを変えるとプレビューが読み直します。ファイルと `bilingualMarkdown.glossary` の両方にある用語は、設定のほうが優先されます。

## 訳文の編集と保存

- 訳文にマウスを重ねて ✎ を押すと、訳文を直せます。**保存**（または Ctrl+Enter / Cmd+Enter）で確定し、Escape で取り消します。直した行には **編集済み** と表示され、**元に戻す** で機械翻訳に戻せます。直した訳文は手元に保存され、再翻訳しても、**翻訳キャッシュを消去** しても消えません。
- ツールバーの ⤓ か **Bilingual Markdown: 訳文を Markdown として保存** で、訳文を `README.ja.md` のような Markdown ファイルとして文書の隣に保存できます。コード・リンク・フロントマター・空行は原文のまま写し、手で直した訳文も反映します。まだ訳されていない部分は原文のまま保存し、その数をお知らせします。

## 数式・図・折りたたみ

- `$…$` と `$$…$$` の数式は、VS Code 標準の Markdown プレビューと同じく KaTeX で描画します。数式は翻訳に送りません。
- ```` ```mermaid ```` のコードブロックは図として描画します。図を描くライブラリは、図のある文書でだけ読み込みます。
- `<details>` は原文と訳文をまとめて開閉でき、`<summary>` の文章も翻訳します。

## コードのコメントの翻訳

`bilingualMarkdown.translateCodeComments` をオンにすると、コードブロックのコメントも翻訳します。コメントがあるコードブロックは、左に原文のコード、右にコメントを訳したコードを並べて表示します。

![英語のコメントが付いた JavaScript の関数と、コメントを日本語に訳した同じ関数を並べた表示](images/code-comments.png)

- 送るのはコメントの文章だけで、コードは送りません。文字列の中の `//` や `#` はコメントとして扱いません。
- 何行も続くコメントは 1 つの文章としてまとめて訳し、元のコメントの幅で折り返します。行末のコメントは 1 行のまま訳します。
- `eslint-disable`、`@ts-ignore`、`# noqa`、`//go:build` のような、ツールが読むコメントは訳しません。すでに訳文の言語で書かれたコメントも訳しません。
- 対象は、```` ```python ```` のように開始フェンスに言語名を書いたコードブロックです。対応している言語は次のとおりです。
  - `//` と `/* */`: JavaScript、TypeScript、C、C++、C#、Java、Kotlin、Scala、Swift、Dart、Go、Rust、PHP、Protocol Buffers、JSON（コメント付き）
  - `#`: Python、Ruby、Perl、R、Elixir、シェル（sh、bash、zsh など）、PowerShell、YAML、TOML、Dockerfile、Makefile、CMake、Terraform（HCL）、GraphQL、nginx
  - そのほか: CSS、SCSS、Less、SQL、Lua、Haskell、Clojure などの Lisp、INI、HTML、XML

## セキュリティとプライバシー

- 翻訳する文章は、選んだプロバイダーに送ります。送信先は `https://api.anthropic.com`、`https://api.openai.com/v1`、ユーザー設定の `bilingualMarkdown.openai.baseUrl`、または利用を許可した VS Code の言語モデルだけです。`ANTHROPIC_BASE_URL`、`OPENAI_BASE_URL`、`OPENAI_ORG_ID`、`OPENAI_PROJECT_ID` などの環境変数は使いません。
- コードブロック、front matter、インラインコード、数式、URL、リンク先、HTML は送りません。ただし `bilingualMarkdown.translateCodeComments` をオンにしたときは、コードブロックのコメントの文章を送ります。
- 制限モード（信頼していないワークスペース）では、翻訳先の言語・追加の指示・用語集・コメントの翻訳もユーザー設定の値だけを使います。用語集ファイルとフロントマターの `translate-to` も使いません。
- 利用状況のデータ（テレメトリー）は集めません。
- プレビューは厳格な Content Security Policy の下で表示し、Markdown 中の HTML は DOMPurify で無害化します。文書中のスクリプトやコマンド URI は実行しません。
- リンクは `http`、`https`、`mailto` をブラウザーなどの外部アプリで開き、相対パスは VS Code で開きます。それ以外のスキームは開きません。

## 既知の制限

- すでに訳文の言語で書かれた文章を見分けられるのは、日本語・中国語・韓国語・ロシア語・ウクライナ語・ギリシャ語・アラビア語・ヘブライ語・タイ語・ヒンディー語・英語・スペイン語・フランス語・ドイツ語・ポルトガル語・イタリア語です。はっきりその言語だとわかる場合だけ見分け、短い文や言語の混ざった文は翻訳に送ります。
- `<summary>` 以外の HTML ブロックの中の文章は翻訳しません。
- コメントの翻訳は、Python の docstring や文字列の中の文章を訳しません。インデントで書いたコードブロックや、言語名のないコードブロックのコメントも訳しません。

## 開発に参加する

不具合の報告やプルリクエストは [GitHub](https://github.com/yhay81/bilingual-markdown-preview/issues) で受け付けています。ビルドとテストの方法は [CONTRIBUTING.md](CONTRIBUTING.md)（英語）にあります。

## ライセンス

[MIT](LICENSE)。拡張機能に同梱しているサードパーティのライブラリのライセンスは、パッケージ内の `dist/ThirdPartyNotices.txt` にまとめています。
