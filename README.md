# Firestore Security Rules Testing

このプロジェクトでは、Firestore セキュリティルールの自動テストと回帰テストを実装しています。

## 🎯 目的

- セキュリティルールの動作を自動的に検証
- ルール変更時のデグレーション防止
- 継続的インテグレーション（CI）での自動テスト実行
- セキュリティルールのカバレッジ測定

## 🚀 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Firebase CLI のインストール

```bash
npm install -g firebase-tools
```

### 3. Firestore エミュレーターのセットアップ

```bash
firebase setup:emulators:firestore
```

## 🧪 テストの実行

### ローカルでのテスト実行

```bash
# エミュレーターを起動してテストを実行
npm run emulator:test

# または手動でエミュレーターを起動
npm run emulator:start

# 別のターミナルでテストを実行
npm test
```

### テストの監視モード

```bash
npm run test:watch
```

### カバレッジレポートの生成

```bash
npm run test:coverage
```

## 📁 プロジェクト構造

```
├── security_rules/
│   └── firestore/
│       ├── firestore.rules          # セキュリティルール
│       └── firestore.indexes.json   # インデックス設定
├── tests/
│   ├── helpers.js                   # テストヘルパー関数
│   ├── users.test.js               # ユーザーコレクションのテスト
│   ├── schedules.test.js           # スケジュールコレクションのテスト
│   └── notifications.test.js       # 通知コレクションのテスト
├── scripts/
│   └── test-runner.js              # テスト実行スクリプト
├── .github/
│   └── workflows/
│       └── firestore-rules-test.yml # GitHub Actionsワークフロー
├── package.json
└── README.md
```

## 🔧 テストの書き方

### 基本的なテスト構造

```javascript
const {
  setupTestEnvironment,
  teardownTestEnvironment,
  expectSuccess,
  expectFailure,
} = require("./helpers");

describe("Collection Security Rules", () => {
  afterEach(async () => {
    await teardownTestEnvironment();
  });

  test("認証済みユーザーはデータを読み取れる", async () => {
    const mockData = {
      "collection/doc1": { field: "value" },
    };

    const context = await setupTestEnvironment({ uid: "user1" }, mockData);

    const db = context.firestore();
    await expectSuccess(db.doc("collection/doc1").get());
  });

  test("未認証ユーザーはデータを読み取れない", async () => {
    const context = await setupTestEnvironment();
    const db = context.firestore();

    await expectFailure(db.doc("collection/doc1").get());
  });
});
```

### テストヘルパー関数

- `setupTestEnvironment(auth, data)`: テスト環境を初期化
- `teardownTestEnvironment()`: テスト環境をクリーンアップ
- `expectSuccess(promise)`: 操作が成功することを検証
- `expectFailure(promise)`: 操作が失敗することを検証

## 📊 カバレッジレポート

テスト実行後、以下のレポートが生成されます：

- **Jest Coverage**: `coverage/lcov-report/index.html`
- **Rules Coverage**: `coverage/rules-coverage.json`
- **Test Summary**: `coverage/test-summary.md`

### ルールカバレッジの確認

エミュレーター実行中に以下の URL で HTML レポートを確認できます：

```
http://localhost:8080/emulator/v1/projects/test-project:ruleCoverage.html
```

## 🔄 CI/CD 統合

### GitHub Actions

プロジェクトには GitHub Actions ワークフローが含まれており、以下の場合に自動実行されます：

- `main`または`develop`ブランチへのプッシュ
- セキュリティルールまたはテストファイルの変更を含むプルリクエスト

### ワークフローの内容

1. **テスト実行**: 複数の Node.js バージョンでテストを実行
2. **セキュリティチェック**: 危険なルールパターンを検出
3. **自動デプロイ**: main ブランチへのマージ時にルールをデプロイ

### 必要なシークレット

GitHub リポジトリに以下のシークレットを設定してください：

- `FIREBASE_TOKEN`: Firebase CLI トークン
- `FIREBASE_PROJECT_ID`: Firebase プロジェク ID

## 🛡️ セキュリティベストプラクティス

### 1. 認証の確認

すべてのルールで適切な認証チェックを行う：

```javascript
allow read, write: if request.auth != null;
```

### 2. 所有者チェック

ユーザーが自分のデータのみアクセスできるようにする：

```javascript
allow read, write: if request.auth.uid == userId;
```

### 3. データ検証

入力データの形式と内容を検証する：

```javascript
allow create: if request.resource.data.keys().hasAll(['name', 'email'])
  && request.resource.data.email is string
  && request.resource.data.email.matches('.*@.*');
```

### 4. 危険なパターンの回避

以下のパターンは避ける：

```javascript
// ❌ 危険: すべてのアクセスを許可
allow read, write: if true;

// ❌ 危険: 認証チェックなし
allow read, write;
```

## 🔍 トラブルシューティング

### よくある問題

1. **エミュレーターが起動しない**

   - Java がインストールされているか確認
   - ポート 8080 が使用されていないか確認

2. **テストが失敗する**

   - セキュリティルールの構文エラーを確認
   - テストデータの形式を確認

3. **カバレッジが低い**
   - 未テストのルールパスを特定
   - 追加のテストケースを作成

### デバッグ方法

```bash
# エミュレーターのログを確認
firebase emulators:start --only firestore --debug

# テストの詳細出力
npm test -- --verbose
```

## 📚 参考資料

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Rules Unit Testing](https://firebase.google.com/docs/rules/unit-tests)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)

## 🤝 コントリビューション

1. 新しい機能を追加する際は、対応するテストも作成してください
2. セキュリティルールを変更する前に、既存のテストが通ることを確認してください
3. プルリクエストを作成する前に、すべてのテストが成功することを確認してください

## 📝 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。
