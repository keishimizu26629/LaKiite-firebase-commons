import * as functions from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

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
 * ユーザー削除時に関連データをクリーンアップ
 */
export const onUserDelete = functions.onDocumentDeleted(
  {
    document: "users/{userId}",
    region: "asia-northeast1",
  },
  async (event) => {
    try {
      const userId = event.params.userId;
      console.log(`ユーザー削除処理開始: ${userId}`);

      const batch = admin.firestore().batch();

      // 1. ユーザーのプライベートプロファイルを削除
      const privateProfileRef = admin
        .firestore()
        .doc(`users/${userId}/private/profile`);
      batch.delete(privateProfileRef);

      // 2. ユーザーが作成したスケジュールを削除
      const schedulesSnapshot = await admin
        .firestore()
        .collection("schedules")
        .where("ownerId", "==", userId)
        .get();

      schedulesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 3. ユーザーが作成したリストを削除
      const listsSnapshot = await admin
        .firestore()
        .collection("lists")
        .where("ownerId", "==", userId)
        .get();

      listsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 4. ユーザーが作成したグループを削除
      const groupsSnapshot = await admin
        .firestore()
        .collection("groups")
        .where("ownerId", "==", userId)
        .get();

      groupsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 5. ユーザーの友達リクエストを削除
      const friendRequestsSnapshot = await admin
        .firestore()
        .collection("friend_requests")
        .where("fromUserId", "==", userId)
        .get();

      friendRequestsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      const receivedRequestsSnapshot = await admin
        .firestore()
        .collection("friend_requests")
        .where("toUserId", "==", userId)
        .get();

      receivedRequestsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 6. ユーザーのリアクションを削除
      const reactionsSnapshot = await admin
        .firestore()
        .collection("reactions")
        .where("userId", "==", userId)
        .get();

      reactionsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 7. ユーザーの通知を削除
      const notificationsSnapshot = await admin
        .firestore()
        .collection("notifications")
        .where("userId", "==", userId)
        .get();

      notificationsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 8. ユーザー更新履歴を削除
      const historySnapshot = await admin
        .firestore()
        .collection("user_update_history")
        .where("userId", "==", userId)
        .get();

      historySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // バッチ処理を実行
      await batch.commit();

      console.log(`ユーザー削除処理完了: ${userId}`);
      console.log(`削除されたドキュメント数: ${
        1 + // private profile
        schedulesSnapshot.size +
        listsSnapshot.size +
        groupsSnapshot.size +
        friendRequestsSnapshot.size +
        receivedRequestsSnapshot.size +
        reactionsSnapshot.size +
        notificationsSnapshot.size +
        historySnapshot.size
      }`);

    } catch (error) {
      console.error(`ユーザー削除処理エラー (${event.params.userId}):`, error);
      // エラーが発生してもトリガーは失敗させない
      // アプリ側でのアカウント削除は既に完了しているため
    }
  }
);
