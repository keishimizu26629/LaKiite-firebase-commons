import { expect } from "chai";

describe("List Triggers", () => {
  describe("onListMemberUpdate", () => {
    it("should be importable", async () => {
      // トリガー関数がインポートできることを確認
      const { onListMemberUpdate } = await import("../handlers/list/triggers");

      expect(onListMemberUpdate).to.not.be.undefined;
      expect(typeof onListMemberUpdate).to.equal("function");
    });
  });
});
