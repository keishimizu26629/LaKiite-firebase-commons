import * as functions from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

export interface UserUpdateData {
  id: string;
  userId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  updatedAt: admin.firestore.Timestamp | Date;
  isProcessed: boolean;
  retryCount: number;
}

/**
 * 夜間バッチ処理：ユーザー情報の同期
 */
export const userDataSyncBatch = functions.onSchedule(
  {
    schedule: "0 2 * * *", // 毎日午前2時
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    memory: "1GiB",
    timeoutSeconds: 540, // 9分
  },
  async () => {
    try {
      console.log("ユーザーデータ同期バッチ処理開始");

      // 未処理の更新履歴を取得
      const pendingSnapshot = await admin
        .firestore()
        .collection("user_update_history")
        .where("isProcessed", "==", false)
        .where("retryCount", "<", 3)
        .limit(500)
        .get();

      if (pendingSnapshot.empty) {
        console.log("処理対象の更新履歴がありません");
        return;
      }

      console.log(`処理開始: ${pendingSnapshot.size}件の更新履歴`);

      // ユーザーIDごとにグループ化
      const updatesByUser = new Map<string, UserUpdateData[]>();
      pendingSnapshot.docs.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as UserUpdateData;
        const userId = data.userId;

        if (!updatesByUser.has(userId)) {
          updatesByUser.set(userId, []);
        }
        updatesByUser.get(userId)!.push(data);
      });

      // 各ユーザーの更新を並列処理
      const promises = Array.from(updatesByUser.entries()).map(
        ([userId, updates]) => processUserUpdates(userId, updates)
      );

      const results = await Promise.allSettled(promises);

      // 結果の集計
      let successCount = 0;
      let errorCount = 0;
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          errorCount++;
          console.error("ユーザー処理エラー:", result.reason);
        }
      });

      console.log(`ユーザーデータ同期バッチ処理完了: 成功=${successCount}, エラー=${errorCount}`);
    } catch (error) {
      console.error("バッチ処理エラー:", error);
      throw error;
    }
  }
);

/**
 * 特定ユーザーの更新処理
 */
export async function processUserUpdates(userId: string, updates: UserUpdateData[]) {
  try {
    console.log(`ユーザー ${userId} の処理開始: ${updates.length}件の更新`);

    // 最新の更新情報を取得
    const latestUpdates = getLatestUpdates(updates);

    if (Object.keys(latestUpdates).length === 0) {
      console.log(`ユーザー ${userId}: 更新対象なし`);
      await markAsProcessed(updates);
      return;
    }

    console.log(`ユーザー ${userId} の最新更新:`, latestUpdates);

    // バッチ処理でリアクション・コメント・通知・スケジュールを更新
    await Promise.all([
      updateReactions(userId, latestUpdates),
      updateComments(userId, latestUpdates),
      updateNotifications(userId, latestUpdates),
      updateSchedules(userId, latestUpdates),
    ]);

    // 処理完了をマーク
    await markAsProcessed(updates);

    console.log(`ユーザー ${userId} の更新処理完了`);
  } catch (error) {
    console.error(`ユーザー ${userId} の更新処理エラー:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await incrementRetryCount(updates, errorMessage);
    throw error;
  }
}

/**
 * リアクションデータの更新
 */
async function updateReactions(
  userId: string,
  latestUpdates: Record<string, string>
) {
  const reactionQuery = await admin
    .firestore()
    .collectionGroup("reactions")
    .where("userId", "==", userId)
    .get();

  if (reactionQuery.empty) {
    console.log(`ユーザー ${userId}: 更新対象のリアクションなし`);
    return;
  }

  console.log(`ユーザー ${userId}: ${reactionQuery.size}件のリアクションを更新`);

  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = admin.firestore().batch();
  let operationCount = 0;

  reactionQuery.docs.forEach((doc) => {
    const updateData: Record<string, string> = {};

    if (latestUpdates.displayName) {
      updateData.userDisplayName = latestUpdates.displayName;
    }
    if (latestUpdates.iconUrl) {
      updateData.userPhotoUrl = latestUpdates.iconUrl;
    }

    if (Object.keys(updateData).length > 0) {
      currentBatch.update(doc.ref, updateData);
      operationCount++;

      // Firestoreのバッチ制限（500操作）に達したら新しいバッチを作成
      if (operationCount >= 500) {
        batches.push(currentBatch);
        currentBatch = admin.firestore().batch();
        operationCount = 0;
      }
    }
  });

  if (operationCount > 0) {
    batches.push(currentBatch);
  }

  // 全バッチを並列実行
  await Promise.all(batches.map((batch) => batch.commit()));
  console.log(`${userId} のリアクション ${reactionQuery.size} 件を更新完了`);
}

/**
 * コメントデータの更新
 */
async function updateComments(
  userId: string,
  latestUpdates: Record<string, string>
) {
  const commentQuery = await admin
    .firestore()
    .collectionGroup("comments")
    .where("userId", "==", userId)
    .get();

  if (commentQuery.empty) {
    console.log(`ユーザー ${userId}: 更新対象のコメントなし`);
    return;
  }

  console.log(`ユーザー ${userId}: ${commentQuery.size}件のコメントを更新`);

  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = admin.firestore().batch();
  let operationCount = 0;

  commentQuery.docs.forEach((doc) => {
    const updateData: Record<string, string> = {};

    if (latestUpdates.displayName) {
      updateData.userDisplayName = latestUpdates.displayName;
    }
    if (latestUpdates.iconUrl) {
      updateData.userPhotoUrl = latestUpdates.iconUrl;
    }

    if (Object.keys(updateData).length > 0) {
      currentBatch.update(doc.ref, updateData);
      operationCount++;

      if (operationCount >= 500) {
        batches.push(currentBatch);
        currentBatch = admin.firestore().batch();
        operationCount = 0;
      }
    }
  });

  if (operationCount > 0) {
    batches.push(currentBatch);
  }

  await Promise.all(batches.map((batch) => batch.commit()));
  console.log(`${userId} のコメント ${commentQuery.size} 件を更新完了`);
}

/**
 * 通知データの更新
 */
async function updateNotifications(
  userId: string,
  latestUpdates: Record<string, string>
) {
  // 送信者としての通知を更新
  const sendNotificationsQuery = await admin
    .firestore()
    .collection("notifications")
    .where("sendUserId", "==", userId)
    .get();

  // 受信者としての通知を更新
  const receiveNotificationsQuery = await admin
    .firestore()
    .collection("notifications")
    .where("receiveUserId", "==", userId)
    .get();

  // 重複を除去（同じ通知が送信者と受信者の両方のクエリに含まれる可能性がある）
  const notificationMap = new Map<string, admin.firestore.QueryDocumentSnapshot>();
  sendNotificationsQuery.docs.forEach((doc) => {
    notificationMap.set(doc.id, doc);
  });
  receiveNotificationsQuery.docs.forEach((doc) => {
    notificationMap.set(doc.id, doc);
  });
  const allNotifications = Array.from(notificationMap.values());

  if (allNotifications.length === 0) {
    console.log(`ユーザー ${userId}: 更新対象の通知なし`);
    return;
  }

  console.log(`ユーザー ${userId}: ${allNotifications.length}件の通知を更新`);

  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = admin.firestore().batch();
  let operationCount = 0;

  allNotifications.forEach((doc) => {
    const data = doc.data();
    const updateData: Record<string, string> = {};

    // 送信者の場合
    if (data.sendUserId === userId) {
      if (latestUpdates.displayName) {
        updateData.sendUserDisplayName = latestUpdates.displayName;
      }
      // 通知には sendUserPhotoUrl フィールドがないため、iconUrl の更新はスキップ
    }

    // 受信者の場合
    if (data.receiveUserId === userId) {
      if (latestUpdates.displayName) {
        updateData.receiveUserDisplayName = latestUpdates.displayName;
      }
      // 通知には receiveUserPhotoUrl フィールドがないため、iconUrl の更新はスキップ
    }

    if (Object.keys(updateData).length > 0) {
      currentBatch.update(doc.ref, updateData);
      operationCount++;

      if (operationCount >= 500) {
        batches.push(currentBatch);
        currentBatch = admin.firestore().batch();
        operationCount = 0;
      }
    }
  });

  if (operationCount > 0) {
    batches.push(currentBatch);
  }

  await Promise.all(batches.map((batch) => batch.commit()));
  console.log(`${userId} の通知 ${allNotifications.length} 件を更新完了`);
}

/**
 * スケジュールデータの更新
 */
async function updateSchedules(
  userId: string,
  latestUpdates: Record<string, string>
) {
  const scheduleQuery = await admin
    .firestore()
    .collection("schedules")
    .where("ownerId", "==", userId)
    .get();

  if (scheduleQuery.empty) {
    console.log(`ユーザー ${userId}: 更新対象のスケジュールなし`);
    return;
  }

  console.log(`ユーザー ${userId}: ${scheduleQuery.size}件のスケジュールを更新`);

  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = admin.firestore().batch();
  let operationCount = 0;

  scheduleQuery.docs.forEach((doc) => {
    const updateData: Record<string, string> = {};

    if (latestUpdates.displayName) {
      updateData.ownerDisplayName = latestUpdates.displayName;
    }
    if (latestUpdates.iconUrl) {
      updateData.ownerPhotoUrl = latestUpdates.iconUrl;
    }

    if (Object.keys(updateData).length > 0) {
      currentBatch.update(doc.ref, updateData);
      operationCount++;

      if (operationCount >= 500) {
        batches.push(currentBatch);
        currentBatch = admin.firestore().batch();
        operationCount = 0;
      }
    }
  });

  if (operationCount > 0) {
    batches.push(currentBatch);
  }

  await Promise.all(batches.map((batch) => batch.commit()));
  console.log(`${userId} のスケジュール ${scheduleQuery.size} 件を更新完了`);
}

/**
 * 最新の更新情報を取得
 */
export function getLatestUpdates(updates: UserUpdateData[]): Record<string, string> {
  const latest: Record<string, Date | string> = {};

  updates.forEach((update) => {
    const updateTime = update.updatedAt instanceof admin.firestore.Timestamp
      ? update.updatedAt.toDate()
      : update.updatedAt;
    const fieldDateKey = update.fieldName + "_date";

    if (
      !latest[update.fieldName] ||
      updateTime > (latest[fieldDateKey] as Date)
    ) {
      latest[update.fieldName] = update.newValue;
      latest[fieldDateKey] = updateTime;
    }
  });

  // 日付フィールドを削除
  Object.keys(latest).forEach((key) => {
    if (key.endsWith("_date")) {
      delete latest[key];
    }
  });

  return latest as Record<string, string>;
}

/**
 * 処理完了をマーク
 */
async function markAsProcessed(updates: UserUpdateData[]) {
  const batch = admin.firestore().batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  updates.forEach((update) => {
    const ref = admin
      .firestore()
      .collection("user_update_history")
      .doc(update.id);
    batch.update(ref, {
      isProcessed: true,
      processedAt: now,
    });
  });

  await batch.commit();
  console.log(`${updates.length}件の履歴を処理済みにマーク`);
}

/**
 * リトライカウントを増加
 */
async function incrementRetryCount(updates: UserUpdateData[], errorMessage: string) {
  const batch = admin.firestore().batch();

  updates.forEach((update) => {
    const ref = admin
      .firestore()
      .collection("user_update_history")
      .doc(update.id);
    batch.update(ref, {
      retryCount: admin.firestore.FieldValue.increment(1),
      errorMessage: errorMessage.substring(0, 500), // エラーメッセージを制限
    });
  });

  await batch.commit();
  console.log(`${updates.length}件の履歴のリトライカウントを増加`);
}
