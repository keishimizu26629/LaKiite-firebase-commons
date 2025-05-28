#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Firestoreエミュレーターを起動する
 */
function startEmulator() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Firestoreエミュレーターを起動中...');

    const emulator = spawn('firebase', ['emulators:start', '--only', 'firestore'], {
      stdio: 'pipe'
    });

    let started = false;

    emulator.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);

      if (output.includes('All emulators started') && !started) {
        started = true;
        console.log('✅ エミュレーターが起動しました');
        resolve(emulator);
      }
    });

    emulator.stderr.on('data', (data) => {
      console.error(`エミュレーターエラー: ${data}`);
    });

    emulator.on('close', (code) => {
      if (code !== 0 && !started) {
        reject(new Error(`エミュレーターが終了しました (code: ${code})`));
      }
    });

    // タイムアウト設定
    setTimeout(() => {
      if (!started) {
        emulator.kill();
        reject(new Error('エミュレーターの起動がタイムアウトしました'));
      }
    }, 30000);
  });
}

/**
 * テストを実行する
 */
function runTests() {
  return new Promise((resolve, reject) => {
    console.log('🧪 テストを実行中...');

    const jest = spawn('npx', ['jest', '--verbose', '--coverage'], {
      stdio: 'inherit'
    });

    jest.on('close', (code) => {
      if (code === 0) {
        console.log('✅ すべてのテストが成功しました');
        resolve();
      } else {
        reject(new Error(`テストが失敗しました (code: ${code})`));
      }
    });
  });
}

/**
 * カバレッジレポートを生成する
 */
async function generateCoverageReport() {
  console.log('📊 カバレッジレポートを生成中...');

  try {
    // ルールカバレッジレポートを取得
    const response = await fetch('http://localhost:8080/emulator/v1/projects/test-project:ruleCoverage');
    const coverageData = await response.json();

    // レポートをファイルに保存
    const reportPath = path.join(__dirname, '../coverage/rules-coverage.json');
    fs.writeFileSync(reportPath, JSON.stringify(coverageData, null, 2));

    console.log(`✅ ルールカバレッジレポートを保存しました: ${reportPath}`);

    // HTMLレポートのURLを表示
    console.log('🌐 HTMLカバレッジレポート: http://localhost:8080/emulator/v1/projects/test-project:ruleCoverage.html');

  } catch (error) {
    console.warn('⚠️ ルールカバレッジレポートの生成に失敗しました:', error.message);
  }
}

/**
 * テスト結果のサマリーを生成する
 */
function generateTestSummary() {
  console.log('📋 テストサマリーを生成中...');

  const summaryPath = path.join(__dirname, '../coverage/test-summary.md');
  const timestamp = new Date().toISOString();

  const summary = `# Firestore Security Rules テスト結果

## 実行日時
${timestamp}

## テスト概要
- **Users Collection**: ユーザー情報の読み取り・書き込み権限
- **Schedules Collection**: スケジュールのアクセス制御
- **Notifications Collection**: 通知システムのセキュリティ
- **Admin Collections**: 管理者専用コレクションの保護

## カバレッジ
- Jest Coverage: \`coverage/lcov-report/index.html\`
- Rules Coverage: \`coverage/rules-coverage.json\`

## 次のステップ
1. 失敗したテストがある場合は、セキュリティルールを確認してください
2. カバレッジが低い場合は、追加のテストケースを作成してください
3. 新しい機能を追加する際は、対応するテストも追加してください

## 自動化
このテストスイートはCI/CDパイプラインに組み込むことができます：

\`\`\`bash
npm run emulator:test
\`\`\`
`;

  fs.writeFileSync(summaryPath, summary);
  console.log(`✅ テストサマリーを保存しました: ${summaryPath}`);
}

/**
 * メイン実行関数
 */
async function main() {
  let emulator;

  try {
    // エミュレーターを起動
    emulator = await startEmulator();

    // 少し待機してからテスト実行
    await new Promise(resolve => setTimeout(resolve, 2000));

    // テストを実行
    await runTests();

    // カバレッジレポートを生成
    await generateCoverageReport();

    // テストサマリーを生成
    generateTestSummary();

    console.log('🎉 すべての処理が完了しました！');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  } finally {
    // エミュレーターを停止
    if (emulator) {
      console.log('🛑 エミュレーターを停止中...');
      emulator.kill();
    }
  }
}

// スクリプトが直接実行された場合のみmainを実行
if (require.main === module) {
  main();
}

module.exports = {
  startEmulator,
  runTests,
  generateCoverageReport,
  generateTestSummary
};
