import * as admin from "firebase-admin";

/**
 * リストメンバー変更時に関連する予定の可視性を更新する
 * @param listId 変更されたリストのID
 * @param addedMembers 追加されたメンバーのIDリスト
 * @param removedMembers 削除されたメンバーのIDリスト
 */
export async function updateSchedulesVisibility(
  listId: string,
  addedMembers: string[],
  removedMembers: string[]
): Promise<void> {
  console.log(`Updating schedules visibility for list ${listId}`);
  console.log(`Added members: ${addedMembers.join(", ")}`);
  console.log(`Removed members: ${removedMembers.join(", ")}`);

  // 変更がない場合は早期リターン
  if (addedMembers.length === 0 && removedMembers.length === 0) {
    console.log("No member changes detected, skipping update");
    return;
  }

  const db = admin.firestore();

  try {
    // このリストを使用している全ての予定を取得
    const schedulesSnapshot = await db
      .collection("schedules")
      .where("sharedLists", "array-contains", listId)
      .get();

    console.log(`Found ${schedulesSnapshot.size} schedules using list ${listId}`);

    if (schedulesSnapshot.empty) {
      console.log("No schedules found for this list");
      return;
    }

    const batch = db.batch();
    let batchCount = 0;
    let updatedCount = 0;

    for (const scheduleDoc of schedulesSnapshot.docs) {
      const scheduleData = scheduleDoc.data();
      const currentVisibleToArray = (scheduleData.visibleTo || []) as string[];
      const currentVisibleTo = new Set<string>(currentVisibleToArray);
      const originalSize = currentVisibleTo.size;

      // 追加されたメンバーをvisibleToに追加
      addedMembers.forEach(memberId => {
        currentVisibleTo.add(memberId);
      });

      // 削除されたメンバーをvisibleToから削除（オーナーは除く）
      removedMembers.forEach(memberId => {
        if (memberId !== scheduleData.ownerId) {
          currentVisibleTo.delete(memberId);
        }
      });

      // 変更があった場合のみ更新
      const newVisibleTo = Array.from(currentVisibleTo);

      if (currentVisibleTo.size !== originalSize ||
          !arraysEqual(newVisibleTo.sort(), currentVisibleToArray.sort())) {

        batch.update(scheduleDoc.ref, {
          visibleTo: newVisibleTo,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batchCount++;
        updatedCount++;

        console.log(`Scheduled update for schedule ${scheduleDoc.id}: ${currentVisibleToArray.length} -> ${newVisibleTo.length} members`);

        // Firestoreのバッチ制限（500件）に達したら実行
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      }
    }

    // 残りのバッチを実行
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${batchCount} updates`);
    }

    console.log(`Successfully updated visibility for ${updatedCount} schedules in list ${listId}`);
  } catch (error) {
    console.error(`Error updating schedules visibility for list ${listId}:`, error);
    throw error;
  }
}

/**
 * 2つの配列が等しいかどうかを判定するヘルパー関数
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}
