const {
  setupTestEnvironment,
  teardownTestEnvironment,
  expectSuccess,
  expectFailure
} = require('./helpers');

describe('Schedules Collection Security Rules', () => {
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

  describe('読み取り権限', () => {
    test('スケジュールの所有者は自分のスケジュールを読み取れる', async () => {
      const mockData = {
        'schedules/schedule1': {
          title: 'Test Schedule',
          description: 'Test Description',
          startDateTime: new Date(),
          endDateTime: new Date(),
          ownerId: 'user1',
          sharedLists: [],
          visibleTo: [],
          ownerDisplayName: 'Test User',
          reactionCount: 0,
          commentCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user1' },
        mockData
      );

      const db = context.firestore();
      await expectSuccess(db.doc('schedules/schedule1').get());
    });

    test('visibleToに含まれるユーザーはスケジュールを読み取れる', async () => {
      const mockData = {
        'schedules/schedule1': {
          title: 'Test Schedule',
          description: 'Test Description',
          startDateTime: new Date(),
          endDateTime: new Date(),
          ownerId: 'user1',
          sharedLists: [],
          visibleTo: ['user2'],
          ownerDisplayName: 'Test User',
          reactionCount: 0,
          commentCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user2' },
        mockData
      );

      const db = context.firestore();
      await expectSuccess(db.doc('schedules/schedule1').get());
    });

    test('権限のないユーザーはスケジュールを読み取れない', async () => {
      const mockData = {
        'schedules/schedule1': {
          title: 'Test Schedule',
          description: 'Test Description',
          startDateTime: new Date(),
          endDateTime: new Date(),
          ownerId: 'user1',
          sharedLists: [],
          visibleTo: [],
          ownerDisplayName: 'Test User',
          reactionCount: 0,
          commentCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user3' },
        mockData
      );

      const db = context.firestore();
      await expectFailure(db.doc('schedules/schedule1').get());
    });
  });

  describe('書き込み権限', () => {
    test('認証済みユーザーはスケジュールを作成できる', async () => {
      const context = await setupTestEnvironment({ uid: 'user1' });
      const db = context.firestore();

      const scheduleData = {
        title: 'New Schedule',
        description: 'New Description',
        startDateTime: new Date(),
        endDateTime: new Date(),
        ownerId: 'user1',
        sharedLists: [],
        visibleTo: ['user1'],
        ownerDisplayName: 'Test User',
        reactionCount: 0,
        commentCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expectSuccess(db.doc('schedules/newSchedule').set(scheduleData));
    });

    test('他人のownerIdでスケジュールを作成できない', async () => {
      const context = await setupTestEnvironment({ uid: 'user1' });
      const db = context.firestore();

      const invalidScheduleData = {
        title: 'New Schedule',
        description: 'New Description',
        startDateTime: new Date(),
        endDateTime: new Date(),
        ownerId: 'user2', // 他人のID
        sharedLists: [],
        visibleTo: ['user1'],
        ownerDisplayName: 'Test User',
        reactionCount: 0,
        commentCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expectFailure(db.doc('schedules/newSchedule').set(invalidScheduleData));
    });

    test('スケジュールの所有者は自分のスケジュールを更新できる', async () => {
      const mockData = {
        'schedules/schedule1': {
          title: 'Test Schedule',
          description: 'Test Description',
          startDateTime: new Date(),
          endDateTime: new Date(),
          ownerId: 'user1',
          sharedLists: [],
          visibleTo: [],
          ownerDisplayName: 'Test User',
          reactionCount: 0,
          commentCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user1' },
        mockData
      );

      const db = context.firestore();
      await expectSuccess(
        db.doc('schedules/schedule1').update({
          title: 'Updated Schedule',
          updatedAt: new Date()
        })
      );
    });

    test('他人はスケジュールを更新できない', async () => {
      const mockData = {
        'schedules/schedule1': {
          title: 'Test Schedule',
          description: 'Test Description',
          startDateTime: new Date(),
          endDateTime: new Date(),
          ownerId: 'user1',
          sharedLists: [],
          visibleTo: [],
          ownerDisplayName: 'Test User',
          reactionCount: 0,
          commentCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user2' },
        mockData
      );

      const db = context.firestore();
      await expectFailure(
        db.doc('schedules/schedule1').update({
          title: 'Updated Schedule'
        })
      );
    });
  });

  describe('リアクション機能', () => {
    test('認証済みユーザーは自分のリアクションを作成できる', async () => {
      const mockData = {
        'schedules/schedule1': {
          title: 'Test Schedule',
          ownerId: 'user1',
          visibleTo: ['user2'],
          reactionCount: 0,
          commentCount: 0
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user2' },
        mockData
      );

      const db = context.firestore();
      await expectSuccess(
        db.doc('schedules/schedule1/reactions/user2').set({
          userId: 'user2',
          type: 'like',
          createdAt: new Date()
        })
      );
    });

    test('他人のユーザーIDでリアクションを作成できない', async () => {
      const mockData = {
        'schedules/schedule1': {
          title: 'Test Schedule',
          ownerId: 'user1',
          visibleTo: ['user2'],
          reactionCount: 0,
          commentCount: 0
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user2' },
        mockData
      );

      const db = context.firestore();
      await expectFailure(
        db.doc('schedules/schedule1/reactions/user3').set({
          userId: 'user3', // 他人のID
          type: 'like',
          createdAt: new Date()
        })
      );
    });
  });

  describe('コメント機能', () => {
    test('認証済みユーザーはコメントを作成できる', async () => {
      const mockData = {
        'schedules/schedule1': {
          title: 'Test Schedule',
          ownerId: 'user1',
          visibleTo: ['user2'],
          reactionCount: 0,
          commentCount: 0
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user2' },
        mockData
      );

      const db = context.firestore();
      await expectSuccess(
        db.collection('schedules/schedule1/comments').add({
          userId: 'user2',
          content: 'Great schedule!',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      );
    });

    test('コメントの作成者は自分のコメントを更新できる', async () => {
      const mockData = {
        'schedules/schedule1': {
          title: 'Test Schedule',
          ownerId: 'user1',
          visibleTo: ['user2'],
          reactionCount: 0,
          commentCount: 0
        },
        'schedules/schedule1/comments/comment1': {
          userId: 'user2',
          content: 'Original comment',
          createdAt: new Date(),
          updatedAt: new Date(),
          isEdited: false
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user2' },
        mockData
      );

      const db = context.firestore();
      await expectSuccess(
        db.doc('schedules/schedule1/comments/comment1').update({
          content: 'Updated comment',
          updatedAt: new Date(),
          isEdited: true
        })
      );
    });

    test('他人のコメントは更新できない', async () => {
      const mockData = {
        'schedules/schedule1': {
          title: 'Test Schedule',
          ownerId: 'user1',
          visibleTo: ['user2', 'user3'],
          reactionCount: 0,
          commentCount: 0
        },
        'schedules/schedule1/comments/comment1': {
          userId: 'user2',
          content: 'Original comment',
          createdAt: new Date(),
          updatedAt: new Date(),
          isEdited: false
        }
      };

      const context = await setupTestEnvironment(
        { uid: 'user3' },
        mockData
      );

      const db = context.firestore();
      await expectFailure(
        db.doc('schedules/schedule1/comments/comment1').update({
          content: 'Malicious update'
        })
      );
    });
  });
});
