import { expect } from "chai";

describe("User Deletion Cleanup", () => {
  describe("buildRetiredUserProfileUpdate", () => {
    it("should anonymize display name and remove photo url", async () => {
      const { buildRetiredUserProfileUpdate } = await import(
        "../handlers/user/deletion-cleanup"
      );

      expect(buildRetiredUserProfileUpdate()).to.deep.equal({
        userDisplayName: "退会済みユーザー",
        userPhotoUrl: null,
      });
    });
  });

  describe("buildRetiredUserNotificationUpdate", () => {
    it("should anonymize sender display name and expire pending friend requests", async () => {
      const { buildRetiredUserNotificationUpdate } = await import(
        "../handlers/user/deletion-cleanup"
      );

      expect(
        buildRetiredUserNotificationUpdate({
          type: "friend",
          status: "pending",
        })
      ).to.deep.equal({
        sendUserDisplayName: "退会済みユーザー",
        status: "expired",
        isRead: true,
      });
    });

    it("should only anonymize non-pending notifications", async () => {
      const { buildRetiredUserNotificationUpdate } = await import(
        "../handlers/user/deletion-cleanup"
      );

      expect(
        buildRetiredUserNotificationUpdate({
          type: "comment",
          status: "accepted",
        })
      ).to.deep.equal({
        sendUserDisplayName: "退会済みユーザー",
      });
    });
  });

  describe("removeRetiredUserId", () => {
    it("should remove retired user id from friend ids", async () => {
      const { removeRetiredUserId } = await import(
        "../handlers/user/deletion-cleanup"
      );

      expect(
        removeRetiredUserId(["user-1", "deleted-user", "user-2"], "deleted-user")
      ).to.deep.equal(["user-1", "user-2"]);
    });
  });
});
