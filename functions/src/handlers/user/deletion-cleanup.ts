import * as admin from "firebase-admin";

/**
 * 退会済みユーザーとして画面に表示する匿名化後の表示名。
 */
export const retiredUserDisplayName = "退会済みユーザー";

interface NotificationSnapshot {
  type?: string;
  status?: string;
}

/**
 * コメント・リアクションに保存された投稿者スナップショットを匿名化する更新値を返す。
 */
export function buildRetiredUserProfileUpdate() {
  return {
    userDisplayName: retiredUserDisplayName,
    userPhotoUrl: null,
  };
}

/**
 * 削除ユーザーが送信者になっている通知を匿名化する更新値を返す。
 *
 * 未処理の友達申請は、承認できない状態として既読の期限切れ通知へ更新する。
 */
export function buildRetiredUserNotificationUpdate(
  notification: NotificationSnapshot
) {
  const updateData: Record<string, string | boolean> = {
    sendUserDisplayName: retiredUserDisplayName,
  };

  if (notification.type === "friend" && notification.status === "pending") {
    updateData.status = "expired";
    updateData.isRead = true;
  }

  return updateData;
}

/**
 * friends配列から退会済みユーザーIDだけを取り除く。
 */
export function removeRetiredUserId(friendIds: string[], retiredUserId: string) {
  return friendIds.filter((friendId) => friendId !== retiredUserId);
}

/**
 * ユーザー削除後も画面に残り得る参照を退会済みユーザー表示へ寄せる。
 *
 * 既存データの一括移行ではなく、削除イベントを起点に関連する表示スナップショットと
 * 友達関係をクリーンアップする。
 */
export async function cleanupRetiredUserReferences(userId: string) {
  await Promise.all([
    anonymizeCollectionGroup("reactions", userId),
    anonymizeCollectionGroup("comments", userId),
    anonymizeSentNotifications(userId),
    removeFromFriendLists(userId),
  ]);
}

async function anonymizeCollectionGroup(collectionId: string, userId: string) {
  const snapshot = await admin
    .firestore()
    .collectionGroup(collectionId)
    .where("userId", "==", userId)
    .get();

  await commitBatches(snapshot.docs, (batch, doc) => {
    batch.update(doc.ref, buildRetiredUserProfileUpdate());
  });
}

async function anonymizeSentNotifications(userId: string) {
  const snapshot = await admin
    .firestore()
    .collection("notifications")
    .where("sendUserId", "==", userId)
    .get();

  await commitBatches(snapshot.docs, (batch, doc) => {
    batch.update(doc.ref, buildRetiredUserNotificationUpdate(doc.data()));
  });
}

async function removeFromFriendLists(userId: string) {
  const snapshot = await admin
    .firestore()
    .collectionGroup("private")
    .where("friends", "array-contains", userId)
    .get();

  const profileDocs = snapshot.docs.filter((doc) => doc.id === "profile");
  await commitBatches(profileDocs, (batch, doc) => {
    batch.update(doc.ref, {
      friends: admin.firestore.FieldValue.arrayRemove(userId),
    });
  });
}

async function commitBatches<T>(
  docs: T[],
  apply: (batch: admin.firestore.WriteBatch, doc: T) => void
) {
  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = admin.firestore().batch();
  let operationCount = 0;

  docs.forEach((doc) => {
    apply(currentBatch, doc);
    operationCount++;

    if (operationCount >= 500) {
      batches.push(currentBatch);
      currentBatch = admin.firestore().batch();
      operationCount = 0;
    }
  });

  if (operationCount > 0) {
    batches.push(currentBatch);
  }

  await Promise.all(batches.map((batch) => batch.commit()));
}
