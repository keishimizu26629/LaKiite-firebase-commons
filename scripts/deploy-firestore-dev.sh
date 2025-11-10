#!/bin/bash

# Firestore セキュリティルールとインデックスを dev 環境にデプロイするスクリプト

set -e

echo "🚀 Firestore セキュリティルールとインデックスを dev 環境にデプロイします..."
echo "プロジェクト: lakiite-flutter-app-dev"
echo ""

# Firebase CLI がインストールされているか確認
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI がインストールされていません"
    echo "インストール方法: npm install -g firebase-tools"
    exit 1
fi

# ログイン状態を確認
if ! firebase projects:list &> /dev/null; then
    echo "⚠️  Firebase にログインしていません"
    echo "ログインしてください: firebase login"
    exit 1
fi

# プロジェクトを確認
CURRENT_PROJECT=$(firebase use --quiet 2>/dev/null || echo "")
if [ "$CURRENT_PROJECT" != "lakiite-flutter-app-dev" ]; then
    echo "📌 プロジェクトを lakiite-flutter-app-dev に設定します..."
    firebase use lakiite-flutter-app-dev
fi

echo ""
echo "📋 デプロイ内容:"
echo "  - セキュリティルール: security_rules/firestore/firestore.rules"
echo "  - インデックス: security_rules/firestore/firestore.indexes.json"
echo ""

# 確認プロンプト
read -p "デプロイを続行しますか？ (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ デプロイがキャンセルされました"
    exit 1
fi

echo ""
echo "🔄 Firestore ルールとインデックスをデプロイ中..."
firebase deploy --only firestore

echo ""
echo "✅ デプロイが完了しました！"
echo ""
echo "📊 デプロイ後の確認:"
echo "  - Firebase Console: https://console.firebase.google.com/project/lakiite-flutter-app-dev/firestore"
echo "  - セキュリティルール: https://console.firebase.google.com/project/lakiite-flutter-app-dev/firestore/rules"
echo "  - インデックス: https://console.firebase.google.com/project/lakiite-flutter-app-dev/firestore/indexes"
