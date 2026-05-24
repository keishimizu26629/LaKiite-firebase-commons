import * as functions from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { cleanupRetiredUserReferences } from "./deletion-cleanup";

/**
 * ユーザー情報更新時に履歴を記録
 */
export const onUserUpdate = functions.onDocumentUpdated(
  {
    document: "users/{userId}",
    region: "asia-northeast1",
  },
  async (event) => {
    try {
      const userId = event.params.userId;
      const before = event.data?.before.data();
      const after = event.data?.after.data();

      if (!before || !after) {
        console.log("データが存在しません");
        return;
      }

      const batch = admin.firestore().batch();
      const now = admin.firestore.FieldValue.serverTimestamp();
      let hasChanges = false;

      // 表示名の変更を検出
      if (before.displayName !== after.displayName) {
        const historyRef = admin
          .firestore()
          .collection("user_update_history")
          .doc();
        batch.set(historyRef, {
          userId,
          fieldName: "displayName",
          oldValue: before.displayName || "",
          newValue: after.displayName || "",
          updatedAt: now,
          isProcessed: false,
          retryCount: 0,
        });
        hasChanges = true;
        console.log(`表示名変更を検出: ${before.displayName} → ${after.displayName}`);
      }

      // アイコンURLの変更を検出
      if (before.iconUrl !== after.iconUrl) {
        const historyRef = admin
          .firestore()
          .collection("user_update_history")
          .doc();
        batch.set(historyRef, {
          userId,
          fieldName: "iconUrl",
          oldValue: before.iconUrl || "",
          newValue: after.iconUrl || "",
          updatedAt: now,
          isProcessed: false,
          retryCount: 0,
        });
        hasChanges = true;
        console.log(`アイコンURL変更を検出: ${before.iconUrl} → ${after.iconUrl}`);
      }

      if (hasChanges) {
        await batch.commit();
        console.log(`ユーザー更新履歴を記録: ${userId}`);
      } else {
        console.log(`関連フィールドの変更なし: ${userId}`);
      }
    } catch (error) {
      console.error("ユーザー更新履歴記録エラー:", error);
      // エラーが発生してもトリガーは失敗させない
    }
  }
);

/**
 * ユーザー削除時に、画面に残る参照を退会済みユーザーとして扱える状態へ更新する。
 *
 * コメント・リアクション・通知に残る表示用スナップショットを匿名化し、
 * 他ユーザーのfriends配列から削除済みユーザーIDを取り除く。
 */
export const onUserDeleted = functions.onDocumentDeleted(
  {
    document: "users/{userId}",
    region: "asia-northeast1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (event) => {
    try {
      const userId = event.params.userId;
      await cleanupRetiredUserReferences(userId);
      console.log(`退会済みユーザー参照のクリーンアップ完了: ${userId}`);
    } catch (error) {
      console.error("退会済みユーザー参照のクリーンアップエラー:", error);
      throw error;
    }
  }
);
