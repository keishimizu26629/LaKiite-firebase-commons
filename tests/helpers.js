const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require('@firebase/rules-unit-testing');
const fs = require('fs');

let testEnv;

/**
 * エミュレーターの準備ができるまで待機する
 */
async function waitForEmulator(host = 'localhost', port = 8080, maxRetries = 30) {
  const http = require('http');

  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: host,
          port: port,
          path: '/',
          method: 'GET',
          timeout: 1000
        }, (res) => {
          res.on('data', () => {}); // データを消費
          res.on('end', () => resolve());
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
        req.end();
      });

      console.log(`✅ Firestoreエミュレーターに接続しました (${host}:${port})`);
      return;
    } catch (error) {
      if (i < 3) { // 最初の3回だけログ出力
        console.log(`⏳ エミュレーター接続待機中... (${i + 1}/${maxRetries})`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`Firestoreエミュレーターに接続できませんでした (${host}:${port})`);
}

/**
 * テスト環境を初期化する
 * @param {Object} auth - 認証情報
 * @param {Object} data - 初期データ
 * @returns {Promise<Object>} テスト環境
 */
async function setupTestEnvironment(auth = null, data = {}) {
  const projectId = `test-project-${Date.now()}`;

  // CI環境では127.0.0.1を使用（IPv6の問題を回避）
  const host = process.env.CI ? '127.0.0.1' : 'localhost';
  const port = 8080;

  // エミュレーターの準備ができるまで待機
  await waitForEmulator(host, port);

  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync('security_rules/firestore/firestore.rules', 'utf8'),
      host: host,
      port: port
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
    try {
      await testEnv.clearFirestore();
      await testEnv.cleanup();
    } catch (error) {
      // クリーンアップエラーは警告として処理
      if (!error.message.includes('already been cleaned up')) {
        console.warn('Cleanup warning:', error.message);
      }
    } finally {
      testEnv = null; // 参照をクリア
    }
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
