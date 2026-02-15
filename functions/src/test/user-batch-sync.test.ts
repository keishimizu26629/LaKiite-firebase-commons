import { expect } from "chai";

describe("User Batch Sync", () => {
  describe("userDataSyncBatch", () => {
    it("should not be exported in immediate-sync mode", async () => {
      const mod = await import("../handlers/user/batch-sync");
      const exported = (mod as Record<string, unknown>).userDataSyncBatch;

      expect(exported).to.be.undefined;
    });
  });

  describe("processUserUpdates", () => {
    it("should be importable", async () => {
      const { processUserUpdates } = await import("../handlers/user/batch-sync");

      expect(processUserUpdates).to.not.be.undefined;
      expect(typeof processUserUpdates).to.equal("function");
    });
  });

  describe("getLatestUpdates", () => {
    it("should return latest updates for each field", async () => {
      const { getLatestUpdates } = await import("../handlers/user/batch-sync");

      const updates = [
        {
          id: "1",
          userId: "test",
          fieldName: "displayName",
          oldValue: "Old Name 1",
          newValue: "Name 1",
          updatedAt: new Date("2024-01-01"),
          isProcessed: false,
          retryCount: 0,
        },
        {
          id: "2",
          userId: "test",
          fieldName: "displayName",
          oldValue: "Name 1",
          newValue: "Name 2",
          updatedAt: new Date("2024-01-02"),
          isProcessed: false,
          retryCount: 0,
        },
        {
          id: "3",
          userId: "test",
          fieldName: "iconUrl",
          oldValue: "old.jpg",
          newValue: "https://example.com/icon.jpg",
          updatedAt: new Date("2024-01-01"),
          isProcessed: false,
          retryCount: 0,
        },
      ];

      const latest = getLatestUpdates(updates);

      expect(latest.displayName).to.equal("Name 2");
      expect(latest.iconUrl).to.equal("https://example.com/icon.jpg");
    });
  });
});
