import * as admin from "firebase-admin";

// Firebase Admin SDKの初期化
admin.initializeApp();

// グループ関連のトリガーをエクスポート
export * from "./handlers/group/triggers";
