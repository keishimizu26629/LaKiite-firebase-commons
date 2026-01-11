/**
 * 即時同期機能のテストスクリプト
 *
 * このスクリプトは、ユーザー情報の更新時に即座にリアクション/コメント/スケジュールが
 * 更新されることを確認します。
 *
 * 実行方法:
 * node tests/test-immediate-sync.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

// Firebase Admin の初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// テストデータ
const TEST_USER_ID = 'test-user-' + Date.now();
const TEST_SCHEDULE_ID = 'test-schedule-' + Date.now();

// 色付きログ出力
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// テスト用のユーザーを作成
async function createTestUser() {
  log('\n📝 テストユーザーを作成中...', colors.blue);

  await db.collection('users').doc(TEST_USER_ID).set({
    displayName: '初期太郎',
    iconUrl: 'https://example.com/initial-icon.png',
    searchId: 'TEST1234',
    shortBio: 'テストユーザー',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  log(`✅ ユーザー作成完了: ${TEST_USER_ID}`, colors.green);
}

// テスト用のスケジュールとリアクション/コメントを作成
async function createTestScheduleAndInteractions() {
  log('\n📝 テストスケジュールを作成中...', colors.blue);

  // スケジュール作成
  await db.collection('schedules').doc(TEST_SCHEDULE_ID).set({
    title: 'テストスケジュール',
    description: 'テスト用',
    startDateTime: new Date().toISOString(),
    endDateTime: new Date(Date.now() + 3600000).toISOString(),
    ownerId: TEST_USER_ID,
    ownerDisplayName: '初期太郎',
    ownerPhotoUrl: 'https://example.com/initial-icon.png',
    sharedLists: [],
    visibleTo: [TEST_USER_ID],
    reactionCount: 1,
    commentCount: 1,
    createdAt: new Date().toISOString(),
  });

  // リアクション作成
  await db.collection('schedules')
    .doc(TEST_SCHEDULE_ID)
    .collection('reactions')
    .doc(TEST_USER_ID)
    .set({
      userId: TEST_USER_ID,
      type: 'going',
      userDisplayName: '初期太郎',
      userPhotoUrl: 'https://example.com/initial-icon.png',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // コメント作成
  await db.collection('schedules')
    .doc(TEST_SCHEDULE_ID)
    .collection('comments')
    .doc('comment-1')
    .set({
      userId: TEST_USER_ID,
      content: 'テストコメント',
      userDisplayName: '初期太郎',
      userPhotoUrl: 'https://example.com/initial-icon.png',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isEdited: false,
    });

  log(`✅ スケジュール、リアクション、コメント作成完了`, colors.green);
}

// ユーザー情報を更新
async function updateUserProfile() {
  log('\n🔄 ユーザー情報を更新中...', colors.blue);

  await db.collection('users').doc(TEST_USER_ID).update({
    displayName: '更新太郎',
    iconUrl: 'https://example.com/updated-icon.png',
  });

  log('✅ ユーザー情報更新完了', colors.green);
  log('⏳ 即時同期の完了を待機中（最大30秒）...', colors.yellow);
}

// 更新が反映されるまで待機
async function waitForSync(maxWaitSeconds = 30) {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    // スケジュールの更新を確認
    const schedule = await db.collection('schedules').doc(TEST_SCHEDULE_ID).get();
    const scheduleData = schedule.data();

    // リアクションの更新を確認
    const reaction = await db.collection('schedules')
      .doc(TEST_SCHEDULE_ID)
      .collection('reactions')
      .doc(TEST_USER_ID)
      .get();
    const reactionData = reaction.data();

    // コメントの更新を確認
    const comment = await db.collection('schedules')
      .doc(TEST_SCHEDULE_ID)
      .collection('comments')
      .doc('comment-1')
      .get();
    const commentData = comment.data();

    // すべてが更新されているか確認
    const scheduleUpdated = scheduleData.ownerDisplayName === '更新太郎' &&
                           scheduleData.ownerPhotoUrl === 'https://example.com/updated-icon.png';
    const reactionUpdated = reactionData.userDisplayName === '更新太郎' &&
                           reactionData.userPhotoUrl === 'https://example.com/updated-icon.png';
    const commentUpdated = commentData.userDisplayName === '更新太郎' &&
                          commentData.userPhotoUrl === 'https://example.com/updated-icon.png';

    if (scheduleUpdated && reactionUpdated && commentUpdated) {
      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
      log(`\n✅ 即時同期完了！（${elapsedSeconds}秒）`, colors.green);
      return true;
    }

    // 1秒待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return false;
}

// 結果を検証
async function verifyResults() {
  log('\n🔍 結果を検証中...', colors.blue);

  // スケジュールを確認
  const schedule = await db.collection('schedules').doc(TEST_SCHEDULE_ID).get();
  const scheduleData = schedule.data();

  // リアクションを確認
  const reaction = await db.collection('schedules')
    .doc(TEST_SCHEDULE_ID)
    .collection('reactions')
    .doc(TEST_USER_ID)
    .get();
  const reactionData = reaction.data();

  // コメントを確認
  const comment = await db.collection('schedules')
    .doc(TEST_SCHEDULE_ID)
    .collection('comments')
    .doc('comment-1')
    .get();
  const commentData = comment.data();

  // 更新履歴を確認
  const history = await db.collection('user_update_history')
    .where('userId', '==', TEST_USER_ID)
    .get();

  log('\n📊 検証結果:', colors.blue);
  log('─────────────────────────────────────', colors.blue);

  // スケジュール検証
  log('\n【スケジュール】', colors.yellow);
  log(`  ownerDisplayName: ${scheduleData.ownerDisplayName}`);
  log(`  ownerPhotoUrl: ${scheduleData.ownerPhotoUrl}`);
  const scheduleOk = scheduleData.ownerDisplayName === '更新太郎' &&
                     scheduleData.ownerPhotoUrl === 'https://example.com/updated-icon.png';
  log(`  ステータス: ${scheduleOk ? '✅ 成功' : '❌ 失敗'}`, scheduleOk ? colors.green : colors.red);

  // リアクション検証
  log('\n【リアクション】', colors.yellow);
  log(`  userDisplayName: ${reactionData.userDisplayName}`);
  log(`  userPhotoUrl: ${reactionData.userPhotoUrl}`);
  const reactionOk = reactionData.userDisplayName === '更新太郎' &&
                     reactionData.userPhotoUrl === 'https://example.com/updated-icon.png';
  log(`  ステータス: ${reactionOk ? '✅ 成功' : '❌ 失敗'}`, reactionOk ? colors.green : colors.red);

  // コメント検証
  log('\n【コメント】', colors.yellow);
  log(`  userDisplayName: ${commentData.userDisplayName}`);
  log(`  userPhotoUrl: ${commentData.userPhotoUrl}`);
  const commentOk = commentData.userDisplayName === '更新太郎' &&
                    commentData.userPhotoUrl === 'https://example.com/updated-icon.png';
  log(`  ステータス: ${commentOk ? '✅ 成功' : '❌ 失敗'}`, commentOk ? colors.green : colors.red);

  // 更新履歴検証
  log('\n【更新履歴】', colors.yellow);
  log(`  履歴件数: ${history.size}件`);
  history.docs.forEach(doc => {
    const data = doc.data();
    log(`  - ${data.fieldName}: ${data.oldValue} → ${data.newValue} (処理済み: ${data.isProcessed})`);
  });

  log('\n─────────────────────────────────────', colors.blue);

  const allOk = scheduleOk && reactionOk && commentOk;
  if (allOk) {
    log('\n🎉 すべてのテストが成功しました！', colors.green);
  } else {
    log('\n❌ 一部のテストが失敗しました', colors.red);
  }

  return allOk;
}

// テストデータをクリーンアップ
async function cleanup() {
  log('\n🧹 テストデータをクリーンアップ中...', colors.blue);

  const batch = db.batch();

  // ユーザー削除
  batch.delete(db.collection('users').doc(TEST_USER_ID));

  // スケジュール削除
  batch.delete(db.collection('schedules').doc(TEST_SCHEDULE_ID));

  // リアクション削除
  batch.delete(
    db.collection('schedules')
      .doc(TEST_SCHEDULE_ID)
      .collection('reactions')
      .doc(TEST_USER_ID)
  );

  // コメント削除
  batch.delete(
    db.collection('schedules')
      .doc(TEST_SCHEDULE_ID)
      .collection('comments')
      .doc('comment-1')
  );

  await batch.commit();

  // 更新履歴削除
  const history = await db.collection('user_update_history')
    .where('userId', '==', TEST_USER_ID)
    .get();

  const historyBatch = db.batch();
  history.docs.forEach(doc => {
    historyBatch.delete(doc.ref);
  });
  await historyBatch.commit();

  log('✅ クリーンアップ完了', colors.green);
}

// メイン処理
async function main() {
  try {
    log('╔════════════════════════════════════════╗', colors.blue);
    log('║   即時同期機能テスト                   ║', colors.blue);
    log('╚════════════════════════════════════════╝', colors.blue);

    // 1. テストデータ作成
    await createTestUser();
    await createTestScheduleAndInteractions();

    // 2. ユーザー情報更新
    await updateUserProfile();

    // 3. 同期完了を待機
    const syncSuccess = await waitForSync(30);

    if (!syncSuccess) {
      log('\n⚠️  タイムアウト: 30秒以内に同期が完了しませんでした', colors.red);
      log('Cloud Functionsのログを確認してください', colors.yellow);
    }

    // 4. 結果検証
    const testSuccess = await verifyResults();

    // 5. クリーンアップ
    await cleanup();

    log('\n' + '='.repeat(50), colors.blue);
    if (testSuccess) {
      log('テスト結果: 成功 ✅', colors.green);
      process.exit(0);
    } else {
      log('テスト結果: 失敗 ❌', colors.red);
      process.exit(1);
    }

  } catch (error) {
    log(`\n❌ エラーが発生しました: ${error.message}`, colors.red);
    console.error(error);

    // エラー時もクリーンアップを試行
    try {
      await cleanup();
    } catch (cleanupError) {
      log('クリーンアップ中にエラーが発生しました', colors.red);
    }

    process.exit(1);
  }
}

// 実行
main();

