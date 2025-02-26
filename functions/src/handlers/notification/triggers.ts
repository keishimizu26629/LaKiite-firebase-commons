import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

// Firestoreの参照を取得
const db = admin.firestore();

interface Notification {
  type: "friend" | "groupInvitation" | "reaction" | "comment";
  sendUserId: string;
  receiveUserId: string;
  status: string;
  groupId?: string;
  relatedItemId?: string;
}

/**
 * 通知のステータスが更新された時の処理
 * - フレンド申請が承認された場合：両ユーザーの友達リストを更新
 * - グループ招待が承認された場合：ユーザーをグループに追加
 */
export const onNotificationStatusUpdate = onDocumentUpdated({
  document: "notifications/{notificationId}",
  region: "asia-northeast1"
}, async (event) => {
  const previousData = event.data?.before.data() as Notification | undefined;
  const newData = event.data?.after.data() as Notification | undefined;

  if (!previousData || !newData) {
    console.error("No notification data found");
    return;
  }

  // ステータスが"accepted"に変更された場合のみ処理を実行
  if (previousData.status !== "accepted" && newData.status === "accepted") {
    const { type, sendUserId, receiveUserId, groupId } = newData;

    try {
      switch (type) {
      case "friend":
        await handleFriendRequestAccepted(sendUserId, receiveUserId);
        break;
      case "groupInvitation":
        if (!groupId) {
          throw new Error("Group ID is required for group invitation");
        }
        await handleGroupInvitationAccepted(receiveUserId, groupId);
        break;
      default:
        console.error(`Unknown notification type: ${type}`);
      }
    } catch (error) {
      console.error(`Error handling ${type} notification:`, error);
    }
  }
});

/**
 * フレンド申請が承認された時の処理
 */
async function handleFriendRequestAccepted(sendUserId: string, receiveUserId: string) {
  const batch = db.batch();

  // sendUserIdのユーザーのfriends配列にreceiveUserIdを追加
  const sendUserRef = db.doc(`users/${sendUserId}/private/profile`);
  batch.update(sendUserRef, {
    friends: admin.firestore.FieldValue.arrayUnion(receiveUserId),
  });

  // receiveUserIdのユーザーのfriends配列にsendUserIdを追加
  const receiveUserRef = db.doc(`users/${receiveUserId}/private/profile`);
  batch.update(receiveUserRef, {
    friends: admin.firestore.FieldValue.arrayUnion(sendUserId),
  });

  // バッチ処理を実行
  await batch.commit();
  console.log(`Successfully updated friends list for users ${sendUserId} and ${receiveUserId}`);
}

/**
 * グループ招待が承認された時の処理
 */
async function handleGroupInvitationAccepted(userId: string, groupId: string) {
  const batch = db.batch();

  // グループのmemberIds配列にユーザーを追加
  const groupRef = db.doc(`groups/${groupId}`);
  batch.update(groupRef, {
    memberIds: admin.firestore.FieldValue.arrayUnion(userId),
  });

  // ユーザーのgroups配列にグループを追加
  const userRef = db.doc(`users/${userId}/private/profile`);
  batch.update(userRef, {
    groups: admin.firestore.FieldValue.arrayUnion(groupId),
  });

  // バッチ処理を実行
  await batch.commit();
  console.log(`Successfully added user ${userId} to group ${groupId}`);
}
