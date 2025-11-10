# Firestore デプロイ手順

## 前提条件

1. Firebase CLI がインストールされていること
   ```bash
   npm install -g firebase-tools
   ```

2. Firebase にログインしていること
   ```bash
   firebase login
   ```

3. 適切な権限があること（プロジェクトへの書き込み権限）

## デプロイ方法

### 方法1: デプロイスクリプトを使用（推奨）

```bash
cd lakiite-firebase-commons
./scripts/deploy-firestore-dev.sh
```

### 方法2: Firebase CLI を直接使用

```bash
cd lakiite-firebase-commons

# プロジェクトを確認・設定
firebase use lakiite-flutter-app-dev

# Firestore ルールとインデックスをデプロイ
firebase deploy --only firestore
```

### 方法3: ルールとインデックスを個別にデプロイ

```bash
cd lakiite-firebase-commons

# セキュリティルールのみデプロイ
firebase deploy --only firestore:rules --project lakiite-flutter-app-dev

# インデックスのみデプロイ
firebase deploy --only firestore:indexes --project lakiite-flutter-app-dev
```

## デプロイ内容

- **セキュリティルール**: `security_rules/firestore/firestore.rules`
- **インデックス**: `security_rules/firestore/firestore.indexes.json`

## デプロイ後の確認

1. Firebase Console で確認
   - セキュリティルール: https://console.firebase.google.com/project/lakiite-flutter-app-dev/firestore/rules
   - インデックス: https://console.firebase.google.com/project/lakiite-flutter-app-dev/firestore/indexes

2. ローカルテストで動作確認
   ```bash
   npm run emulator:test
   ```

## 注意事項

- デプロイ前に必ずローカルエミュレーターでテストを実行してください
- インデックスの作成には時間がかかる場合があります（数分〜数時間）
- セキュリティルールは即座に反映されます

## トラブルシューティング

### 認証エラーが発生する場合

```bash
firebase login
firebase login --reauth
```

### 権限エラーが発生する場合

プロジェクトの所有者または編集者権限が必要です。Firebase Console で確認してください。

### インデックスが作成されない場合

Firebase Console でインデックスの状態を確認してください。エラーがある場合は、エラーメッセージに従って修正してください。
