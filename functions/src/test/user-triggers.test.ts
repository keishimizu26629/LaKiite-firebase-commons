import { expect } from "chai";

describe("User Triggers", () => {
  describe("onUserUpdate", () => {
    it("should be importable", async () => {
      // トリガー関数がインポートできることを確認
      const { onUserUpdate } = await import("../handlers/user/triggers");

      expect(onUserUpdate).to.not.be.undefined;
      expect(typeof onUserUpdate).to.equal("function");
    });
  });
});
