const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require('@firebase/rules-unit-testing');
const fs = require('fs');

let testEnv;

/**
 * テスト環境を初期化する
 * @param {Object} auth - 認証情報
 * @param {Object} data - 初期データ
 * @returns {Promise<Object>} テスト環境
 */
async function setupTestEnvironment(auth = null, data = {}) {
  const projectId = `test-project-${Date.now()}`;

  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync('security_rules/firestore/firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080
    }
  });

  // 初期データを設定（セキュリティルールを無効にして）
  if (Object.keys(data).length > 0) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      for (const [path, docData] of Object.entries(data)) {
        await db.doc(path).set(docData);
      }
    });
  }

  // 認証されたコンテキストまたは未認証のコンテキストを返す
  if (auth) {
    // uidをsubに変更
    const authToken = { sub: auth.uid, ...auth };
    delete authToken.uid; // 古いuidフィールドを削除
    return testEnv.authenticatedContext(authToken.sub, authToken);
  } else {
    return testEnv.unauthenticatedContext();
  }
}

/**
 * テスト環境をクリーンアップする
 */
async function teardownTestEnvironment() {
  if (testEnv) {
    await testEnv.clearFirestore();
    await testEnv.cleanup();
  }
}

/**
 * 操作が成功することをアサートする
 */
function expectSuccess(promise) {
  return assertSucceeds(promise);
}

/**
 * 操作が失敗することをアサートする
 */
function expectFailure(promise) {
  return assertFails(promise);
}

module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment,
  expectSuccess,
  expectFailure
};
