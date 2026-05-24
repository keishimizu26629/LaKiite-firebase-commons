const {
  setupTestEnvironment,
  teardownTestEnvironment,
  expectSuccess,
  expectFailure
} = require('./helpers');

describe('Notifications Collection Security Rules', () => {
  afterEach(async () => {
    try {
      await teardownTestEnvironment();
    } catch (error) {
      console.warn('Teardown warning:', error.message);
    }
  });

  afterAll(async () => {
    try {
      await teardownTestEnvironment();
    } catch (error) {
      console.warn('Final teardown warning:', error.message);
    }
  });

  describe('通知の作成', () => {
    test('フレンド申請通知を作成できる', async () => {
      const context = await setupTestEnvironment({ uid: 'user1' });
      const db = context.firestore();

      const friendNotification = {
        type: 'friend',
        sendUserId: 'user1',
        receiveUserId: 'user2',
        status: 'pending',
        createdAt: new Date(),
        isRead: false,
        rejectionCount: 0
      };

      await expectSuccess(
        db.collection('notifications').add(friendNotification)
      );
    });

    test('グループ招待通知を作成できる', async () => {
      const context = await setupTestEnvironment({ uid: 'user1' });
      const db = context.firestore();

      const groupInviteNotification = {
        type: 'groupInvitation',
        sendUserId: 'user1',
        receiveUserId: 'user2',
        status: 'pending',
        groupId: 'group123',
        createdAt: new Date(),
        isRead: false,
        rejectionCount: 0
      };

      await expectSuccess(
        db.collection('notifications').add(groupInviteNotification)
      );
    });

    test('リアクション通知を作成できる', async () => {
      const context = await setupTestEnvironment({ uid: 'user1' });
      const db = context.firestore();

      const reactionNotification = {
        type: 'reaction',
        sendUserId: 'user1',
        receiveUserId: 'user2',
        status: 'accepted',
        relatedItemId: 'schedule123',
        interactionId: 'reaction456',
        createdAt: new Date(),
        isRead: false,
        rejectionCount: 0
      };

      await expectSuccess(
        db.collection('notifications').add(reactionNotification)
      );
    });

    test('他人のsendUserIdで通知を作成できない', async () => {
      const context = await setupTestEnvironment({ uid: 'user1' });
      const db = context.firestore();

      const invalidNotification = {
        type: 'friend',
        sendUserId: 'user2', // 他人のID
        receiveUserId: 'user3',
        status: 'pending',
        createdAt: new Date(),
        isRead: false,
        rejectionCount: 0
      };

      await expectFailure(
        db.collection('notifications').add(invalidNotification)
      );
    });

    test('必須フィールドが不足している場合は作成できない', async () => {
      const context = await setupTestEnvironment({ uid: 'user1' });
      const db = context.firestore();

      const invalidNotification = {
        type: 'friend',
        sendUserId: 'user1',
        receiveUserId: 'user2'
        // status, createdAt, isRead, rejectionCountが不足
      };

      await expectFailure(
        db.collection('notifications').add(invalidNotification)
      );
    });

    test('グループ招待でgroupIdが不足している場合は作成できない', async () => {
      const context = await setupTestEnvironment({ uid: 'user1' });
      const db = context.firestore();

      const invalidGroupNotification = {
        type: 'groupInvitation',
        sendUserId: 'user1',
        receiveUserId: 'user2',
        status: 'pending',
        // groupIdが不足
        createdAt: new Date(),
        isRead: false,
        rejectionCount: 0
      };

      await expectFailure(
        db.collection('notifications').add(invalidGroupNotification)
      );
    });
  });

  describe('通知の読み取り', () => {
    test('送信者は自分が送った通知を読み取れる', async () => {
      const mockData = {
        'notifications/notif1': {
          type: 'friend',
          sendUserId: 'user1',
          receiveUserId: 'user2',
          status: 'pending',
          createdAt: new Date(),
          isRead: false,
          rejectionCount: 0
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user1' },
        mockData
      );

      const db = context.firestore();
      await expectSuccess(db.doc('notifications/notif1').get());
    });

    test('受信者は自分宛の通知を読み取れる', async () => {
      const mockData = {
        'notifications/notif1': {
          type: 'friend',
          sendUserId: 'user1',
          receiveUserId: 'user2',
          status: 'pending',
          createdAt: new Date(),
          isRead: false,
          rejectionCount: 0
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user2' },
        mockData
      );

      const db = context.firestore();
      await expectSuccess(db.doc('notifications/notif1').get());
    });

    test('関係のないユーザーは通知を読み取れない', async () => {
      const mockData = {
        'notifications/notif1': {
          type: 'friend',
          sendUserId: 'user1',
          receiveUserId: 'user2',
          status: 'pending',
          createdAt: new Date(),
          isRead: false,
          rejectionCount: 0
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user3' },
        mockData
      );

      const db = context.firestore();
      await expectFailure(db.doc('notifications/notif1').get());
    });

    test('receiveUserIdでフィルタリングしたクエリが許可される', async () => {
      const mockData = {
        'notifications/notif1': {
          type: 'friend',
          sendUserId: 'user1',
          receiveUserId: 'user2',
          status: 'pending',
          createdAt: new Date(),
          isRead: false,
          rejectionCount: 0
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user2' },
        mockData
      );

      const db = context.firestore();
      await expectSuccess(
        db.collection('notifications')
          .where('receiveUserId', '==', 'user2')
          .get()
      );
    });
  });

  describe('通知の更新', () => {
    test('受信者は通知を既読にできる', async () => {
      const mockData = {
        'notifications/notif1': {
          type: 'friend',
          sendUserId: 'user1',
          receiveUserId: 'user2',
          status: 'pending',
          createdAt: new Date(),
          isRead: false,
          rejectionCount: 0
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user2' },
        mockData
      );

      const db = context.firestore();
      await expectSuccess(
        db.doc('notifications/notif1').update({
          isRead: true,
          updatedAt: new Date()
        })
      );
    });

    test('送信者は通知のステータスを更新できる', async () => {
      const mockData = {
        'notifications/notif1': {
          type: 'friend',
          sendUserId: 'user1',
          receiveUserId: 'user2',
          status: 'pending',
          createdAt: new Date(),
          isRead: false,
          rejectionCount: 0
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user1' },
        mockData
      );

      const db = context.firestore();
      await expectSuccess(
        db.doc('notifications/notif1').update({
          status: 'accepted'
        })
      );
    });

    test('受信者は友達申請通知を期限切れとして既読にできる', async () => {
      const mockData = {
        'notifications/notif1': {
          type: 'friend',
          sendUserId: 'user1',
          receiveUserId: 'user2',
          status: 'pending',
          createdAt: new Date(),
          isRead: false,
          rejectionCount: 0
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user2' },
        mockData
      );

      const db = context.firestore();
      await expectSuccess(
        db.doc('notifications/notif1').update({
          status: 'expired',
          isRead: true,
          updatedAt: new Date()
        })
      );
    });

    test('関係のないユーザーは通知を更新できない', async () => {
      const mockData = {
        'notifications/notif1': {
          type: 'friend',
          sendUserId: 'user1',
          receiveUserId: 'user2',
          status: 'pending',
          createdAt: new Date(),
          isRead: false,
          rejectionCount: 0
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user3' },
        mockData
      );

      const db = context.firestore();
      await expectFailure(
        db.doc('notifications/notif1').update({
          isRead: true
        })
      );
    });

    test('sendUserIdやreceiveUserIdは変更できない', async () => {
      const mockData = {
        'notifications/notif1': {
          type: 'friend',
          sendUserId: 'user1',
          receiveUserId: 'user2',
          status: 'pending',
          createdAt: new Date(),
          isRead: false,
          rejectionCount: 0
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user1' },
        mockData
      );

      const db = context.firestore();
      await expectFailure(
        db.doc('notifications/notif1').update({
          sendUserId: 'user3' // 変更不可
        })
      );
    });
  });

  describe('管理者権限のテスト', () => {
    test('管理者以外はuser_update_historyを読み取れない', async () => {
      const mockData = {
        'user_update_history/history1': {
          userId: 'user1',
          action: 'profile_update',
          timestamp: new Date()
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user1' },
        mockData
      );

      const db = context.firestore();
      await expectFailure(db.doc('user_update_history/history1').get());
    });

    test('管理者以外はadmin_alertsを読み取れない', async () => {
      const mockData = {
        'admin_alerts/alert1': {
          type: 'security_violation',
          message: 'Suspicious activity detected',
          timestamp: new Date()
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user1' },
        mockData
      );

      const db = context.firestore();
      await expectFailure(db.doc('admin_alerts/alert1').get());
    });

    test('クライアントからuser_update_historyを作成できない', async () => {
      const context = await setupTestEnvironment({ uid: 'user1' });
      const db = context.firestore();

      const historyData = {
        userId: 'user1',
        action: 'profile_update',
        timestamp: new Date()
      };

      await expectFailure(
        db.collection('user_update_history').add(historyData)
      );
    });

    test('クライアントからadmin_alertsを作成できない', async () => {
      const context = await setupTestEnvironment({ uid: 'user1' });
      const db = context.firestore();

      const alertData = {
        type: 'security_violation',
        message: 'Suspicious activity detected',
        timestamp: new Date()
      };

      await expectFailure(
        db.collection('admin_alerts').add(alertData)
      );
    });
  });
});
