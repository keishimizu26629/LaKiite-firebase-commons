import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

// Firestoreの参照を取得
const db = admin.firestore();

// グループ作成時のトリガー
export const onGroupCreated = onDocumentCreated({
  document: "groups/{groupId}",
  region: "asia-northeast1"
}, async (event) => {
  const groupData = event.data?.data();
  const groupId = event.params.groupId;

  if (!groupData) {
    console.error("No group data found");
    return;
  }

  const creatorId = groupData.ownerId;

  try {
    // ユーザーのprivateコレクション内のgroupsフィールドを更新
    await db.collection("users")
      .doc(creatorId)
      .collection("private")
      .doc("profile")
      .update({
        groups: admin.firestore.FieldValue.arrayUnion(groupId)
      });

    console.log(`Successfully added group ${groupId} to user ${creatorId}"s groups list`);
  } catch (error) {
    console.error("Error updating user groups:", error);
  }
});
