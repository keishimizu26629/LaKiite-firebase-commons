import * as admin from "firebase-admin";

export const retiredUserDisplayName = "退会済みユーザー";

interface NotificationSnapshot {
  type?: string;
  status?: string;
}

export function buildRetiredUserProfileUpdate() {
  return {
    userDisplayName: retiredUserDisplayName,
    userPhotoUrl: null,
  };
}

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

export function removeRetiredUserId(friendIds: string[], retiredUserId: string) {
  return friendIds.filter((friendId) => friendId !== retiredUserId);
}

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
