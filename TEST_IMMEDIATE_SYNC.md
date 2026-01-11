# 即時同期機能テストガイド

このドキュメントでは、ユーザー情報の即時同期機能をテストする方法を説明します。

## 前提条件

1. Firebase Admin SDK のサービスアカウントキーが必要です
2. Cloud Functions がデプロイされている必要があります

## セットアップ

### 1. サービスアカウントキーの取得

1. Firebase Console を開く
2. プロジェクト設定 → サービスアカウント
3. 「新しい秘密鍵の生成」をクリック
4. ダウンロードしたJSONファイルを `service-account-key.json` として保存

```bash
# lakiite-firebase-commons ディレクトリに配置
mv ~/Downloads/your-project-xxxxx.json ./service-account-key.json
```

⚠️ **重要**: `service-account-key.json` は `.gitignore` に追加されているか確認してください。

### 2. 依存関係のインストール

```bash
cd lakiite-firebase-commons
npm install
```

### 3. Cloud Functions のデプロイ

```bash
# Functions をデプロイ
firebase deploy --only functions

# 特定の関数のみデプロイする場合
firebase deploy --only functions:onUserUpdate
```

## テストの実行

### 自動テストスクリプトの実行

```bash
cd lakiite-firebase-commons
node tests/test-immediate-sync.js
```

このスクリプトは以下を自動で行います:

1. ✅ テストユーザーを作成
2. ✅ テストスケジュール、リアクション、コメントを作成
3. ✅ ユーザー情報（displayName, iconUrl）を更新
4. ✅ 即時同期の完了を待機（最大30秒）
5. ✅ 結果を検証
6. ✅ テストデータをクリーンアップ

### 期待される出力

成功時:
```
╔════════════════════════════════════════╗
║   即時同期機能テスト                   ║
╚════════════════════════════════════════╝

📝 テストユーザーを作成中...
✅ ユーザー作成完了: test-user-1234567890

📝 テストスケジュールを作成中...
✅ スケジュール、リアクション、コメント作成完了

🔄 ユーザー情報を更新中...
✅ ユーザー情報更新完了
⏳ 即時同期の完了を待機中（最大30秒）...

✅ 即時同期完了！（2.34秒）

🔍 結果を検証中...

📊 検証結果:
─────────────────────────────────────

【スケジュール】
  ownerDisplayName: 更新太郎
  ownerPhotoUrl: https://example.com/updated-icon.png
  ステータス: ✅ 成功

【リアクション】
  userDisplayName: 更新太郎
  userPhotoUrl: https://example.com/updated-icon.png
  ステータス: ✅ 成功

【コメント】
  userDisplayName: 更新太郎
  userPhotoUrl: https://example.com/updated-icon.png
  ステータス: ✅ 成功

【更新履歴】
  履歴件数: 2件
  - displayName: 初期太郎 → 更新太郎 (処理済み: true)
  - iconUrl: https://example.com/initial-icon.png → https://example.com/updated-icon.png (処理済み: true)

─────────────────────────────────────

🎉 すべてのテストが成功しました！

🧹 テストデータをクリーンアップ中...
✅ クリーンアップ完了

==================================================
テスト結果: 成功 ✅
```

## 手動テスト

自動テストスクリプトを使わずに手動でテストすることもできます。

### 1. Firebase Console でユーザーを作成

1. Firestore → `users` コレクション
2. ドキュメントを追加:
```json
{
  "displayName": "テスト太郎",
  "iconUrl": "https://example.com/test-icon.png",
  "searchId": "TEST1234",
  "shortBio": "テストユーザー"
}
```

### 2. スケジュールとインタラクションを作成

1. `schedules` コレクションにドキュメントを追加
2. そのスケジュールに `reactions` と `comments` サブコレクションを追加
3. 各ドキュメントに `userDisplayName` と `userPhotoUrl` を含める

### 3. ユーザー情報を更新

Firebase Console で `users` ドキュメントの `displayName` や `iconUrl` を変更

### 4. 結果を確認

数秒後に以下を確認:
- `schedules` の `ownerDisplayName` と `ownerPhotoUrl` が更新されているか
- `reactions` の `userDisplayName` と `userPhotoUrl` が更新されているか
- `comments` の `userDisplayName` と `userPhotoUrl` が更新されているか
- `user_update_history` に履歴が記録され、`isProcessed: true` になっているか

## トラブルシューティング

### テストがタイムアウトする

1. Cloud Functions のログを確認:
```bash
firebase functions:log --only onUserUpdate
```

2. Functions が正しくデプロイされているか確認:
```bash
firebase functions:list
```

3. Functions のエラーログを確認:
```bash
firebase functions:log --only onUserUpdate --limit 50
```

### 同期が失敗する

1. `admin_alerts` コレクションを確認:
```javascript
db.collection('admin_alerts')
  .where('type', '==', 'immediate_sync_failure')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get()
```

2. `user_update_history` の `errorMessage` フィールドを確認

### 権限エラー

Firestore のセキュリティルールを確認してください。テスト実行時は、サービスアカウントを使用しているため、通常は権限エラーは発生しません。

## パフォーマンス確認

テストスクリプトは同期完了までの時間を計測します。通常、以下の時間内に完了するはずです:

- **小規模データ** (リアクション/コメント < 10件): 1-3秒
- **中規模データ** (リアクション/コメント 10-100件): 3-10秒
- **大規模データ** (リアクション/コメント > 100件): 10-30秒

30秒を超える場合は、以下を確認してください:
- Functions のメモリ設定（現在: 512MiB）
- Functions のタイムアウト設定（現在: 300秒）
- データ量が想定を超えていないか

## 本番環境でのテスト

本番環境でテストする場合は、以下の点に注意してください:

1. **テストユーザーを明示的に作成**: 実際のユーザーデータに影響を与えないようにする
2. **テスト後のクリーンアップ**: テストデータを必ず削除する
3. **ピーク時間を避ける**: ユーザーが少ない時間帯にテストする
4. **段階的なテスト**: 少量のデータから始めて、徐々に増やす

## 継続的な監視

即時同期の動作を継続的に監視するには:

1. **Cloud Functions のログ**:
```bash
firebase functions:log --only onUserUpdate
```

2. **エラーアラート**:
```javascript
// admin_alerts コレクションを定期的に確認
db.collection('admin_alerts')
  .where('type', '==', 'immediate_sync_failure')
  .where('createdAt', '>', yesterday)
  .get()
```

3. **処理時間の監視**:
Cloud Functions のメトリクスで実行時間を確認

## まとめ

- ✅ 自動テストスクリプトで簡単にテスト可能
- ✅ 通常2-5秒で同期完了
- ✅ エラー時は `admin_alerts` に記録
- ✅ リトライ機能により高い信頼性

