import * as admin from "firebase-admin";
import * as notificationService from "./notification-service";

// Firebase Admin SDKの初期化
admin.initializeApp();

// グループ関連のトリガーをエクスポート
export * from "./handlers/group/triggers";

// リスト関連のトリガーをエクスポート
export * from "./handlers/list/triggers";

// 通知関連のトリガーをエクスポート
export * from "./handlers/notification/triggers";

// スケジュール関連のトリガーをエクスポート
export * from "./handlers/schedule/triggers";

// ユーザー関連のトリガーをエクスポート
export * from "./handlers/user/triggers";
// export * from "./handlers/user/batch-sync"; // 即時同期により廃止
// export * from "./handlers/user/monitoring"; // 監視機能は不要
export * from "./handlers/user/manual-sync";

// 通知関連の関数をエクスポート
export const sendNotification = notificationService.sendNotification;
export const onNewFriendRequest = notificationService.onNewFriendRequest;
export const onNewGroupInvitation = notificationService.onNewGroupInvitation;
export const onNewReactionNotification = notificationService.onNewReactionNotification;
export const onNewCommentNotification = notificationService.onNewCommentNotification;
