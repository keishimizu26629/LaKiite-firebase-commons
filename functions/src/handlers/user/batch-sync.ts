import * as functions from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { syncUserProfileSnapshots } from "./profile-sync";

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

    // バッチ処理で表示用スナップショットを更新
    await syncUserProfileSnapshots(userId, latestUpdates);

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
