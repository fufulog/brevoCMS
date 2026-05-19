import { EmailTemplateRepository } from '../src/repository.js';
import { EmailTemplateService } from '../src/service.js';
import { EmailTemplateController } from '../src/controller.js';
import { SQLClient, LocalMapping } from '../src/types.js';

// Setup basic assertion helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Brevo CMS SDK Unit Tests...\n');

  let testPassedCount = 0;
  let testFailedCount = 0;

  function runTest(name: string, testFn: () => void | Promise<void>) {
    try {
      const p = testFn();
      if (p instanceof Promise) {
        p.then(() => {
          console.log(`✅ PASSED: ${name}`);
          testPassedCount++;
        }).catch((err) => {
          console.error(`❌ FAILED: ${name}`);
          console.error(err);
          testFailedCount++;
        });
      } else {
        console.log(`✅ PASSED: ${name}`);
        testPassedCount++;
      }
    } catch (err) {
      console.error(`❌ FAILED: ${name}`);
      console.error(err);
      testFailedCount++;
    }
  }

  // 1. REPOSITORY TESTS (SQL PostgreSQL Dialect)
  runTest('Repository - PostgreSQL Queries', async () => {
    const executedQueries: { sql: string; params: any[] }[] = [];
    const mockPgClient: SQLClient = {
      query: async (sql: string, params: any[]) => {
        executedQueries.push({ sql, params });
        // return standard PG rows layout
        return {
          rows: [
            { id: 1, template_id: 100, event_name: 'test.event', is_active: true, updated_at: new Date() }
          ]
        };
      }
    };

    const repo = new EmailTemplateRepository({
      brevoApiKey: 'test-key',
      defaultSender: { email: 'test@example.com' },
      dbType: 'postgres',
      dbClient: mockPgClient
    });

    const mapping = await repo.getMappingByTemplateId(100);
    assert(mapping !== null, 'Should return parsed mapping');
    assert(mapping?.template_id === 100, 'Should match template id');
    assert(executedQueries.length === 1, 'Should execute 1 query');
    assert(executedQueries[0].sql.includes('$1'), 'PostgreSQL should use $1 placeholder');

    // Test upsert Postgres query
    await repo.upsertMapping(100, 'updated.event', false);
    assert(executedQueries.length === 2, 'Should execute another query');
    assert(executedQueries[1].sql.includes('ON CONFLICT (template_id)'), 'Postgres query should have ON CONFLICT');
  });

  // 2. REPOSITORY TESTS (SQL MySQL Dialect)
  runTest('Repository - MySQL Queries', async () => {
    const executedQueries: { sql: string; params: any[] }[] = [];
    const mockMySQLClient: SQLClient = {
      query: async (sql: string, params: any[]) => {
        executedQueries.push({ sql, params });
        // return MySQL row arrays
        return [
          [
            { id: 1, template_id: 200, event_name: 'mysql.event', is_active: true, updated_at: new Date() }
          ],
          {} // Fields meta
        ];
      }
    };

    const repo = new EmailTemplateRepository({
      brevoApiKey: 'test-key',
      defaultSender: { email: 'test@example.com' },
      dbType: 'mysql',
      dbClient: mockMySQLClient
    });

    const mapping = await repo.getMappingByTemplateId(200);
    assert(mapping !== null, 'Should return MySQL mapped record');
    assert(mapping?.template_id === 200, 'Should match template id');
    assert(executedQueries.length === 1, 'Should execute 1 query');
    assert(executedQueries[0].sql.includes('?'), 'MySQL should use ? placeholders');

    // Test upsert MySQL query
    await repo.upsertMapping(200, 'updated.event', true);
    assert(executedQueries.length === 2, 'Should execute upsert query');
    assert(executedQueries[1].sql.includes('ON DUPLICATE KEY UPDATE'), 'MySQL should use ON DUPLICATE KEY UPDATE');
  });

  // 3. REPOSITORY TESTS (Firestore)
  runTest('Repository - Firestore Collections', async () => {
    const firestoreDbState: Record<string, any> = {};
    let whereClauseCalled = false;

    const mockFirestoreClient = {
      collection: (collectionName: string) => {
        assert(collectionName === 'email_event_templates', 'Should default collection path');
        return {
          doc: (docId: string) => ({
            get: async () => ({
              exists: firestoreDbState[docId] !== undefined,
              data: () => firestoreDbState[docId],
            }),
            set: async (data: any, options: any) => {
              if (options?.merge && firestoreDbState[docId]) {
                firestoreDbState[docId] = { ...firestoreDbState[docId], ...data };
              } else {
                firestoreDbState[docId] = data;
              }
            }
          }),
          where: (field: string, op: string, val: any) => {
            whereClauseCalled = true;
            return {
              where: () => ({
                limit: () => ({
                  get: async () => ({
                    empty: false,
                    docs: [
                      {
                        data: () => ({
                          template_id: 300,
                          event_name: 'firestore.event',
                          is_active: true
                        })
                      }
                    ]
                  })
                })
              })
            };
          }
        };
      }
    };

    const repo = new EmailTemplateRepository({
      brevoApiKey: 'test-key',
      defaultSender: { email: 'test@example.com' },
      dbType: 'firestore',
      dbClient: mockFirestoreClient
    });

    // JIT Sync Mock
    await repo.insertJITMapping(300);
    const cached = await repo.getMappingByTemplateId(300);
    assert(cached !== null, 'Doc should be created JIT');
    assert(cached?.event_name === '', 'JIT mapping event_name should be empty');

    // Upsert and get
    await repo.upsertMapping(300, 'firestore.event', true);
    const updated = await repo.getMappingByTemplateId(300);
    assert(updated?.event_name === 'firestore.event', 'Updated event should match');
    assert(updated?.is_active === true, 'Updated active state should match');

    // Active event query
    const active = await repo.getActiveMappingByEvent('firestore.event');
    assert(active !== null, 'Active event record should match query');
    assert(whereClauseCalled === true, 'Should use firestore where filters');
  });

  // 4. SERVICE VALIDATION TESTS
  runTest('Service - Input Validations', async () => {
    const mockPgClient: SQLClient = { query: async () => ({ rows: [] }) };
    const service = new EmailTemplateService({
      brevoApiKey: 'dummy-key',
      defaultSender: { email: 'test@example.com', name: 'Tester' },
      dbType: 'postgres',
      dbClient: mockPgClient
    });

    // Test blank name constraint
    try {
      await service.updateTemplate(1, {
        templateName: '',
        subject: 'Sub',
        sender: { email: 'test@example.com' },
        htmlContent: '<html><body>Hello World!</body></html>',
        eventName: 'test',
        isActive: true
      });
      assert(false, 'Should throw error for blank name');
    } catch (e: any) {
      assert(e.message === 'Template name cannot be blank', 'Error message matches blank template validation');
    }

    // Test minimum HTML content length constraint (<= 10 chars)
    try {
      await service.updateTemplate(1, {
        templateName: 'Valid Name',
        subject: 'Sub',
        sender: { email: 'test@example.com' },
        htmlContent: '<html>',
        eventName: 'test',
        isActive: true
      });
      assert(false, 'Should throw error for short HTML body');
    } catch (e: any) {
      assert(e.message.includes('HTML content must be greater than 10 characters'), 'Error message matches HTML constraint');
    }
  });

  // Wait a small duration to let asynchronous assertions print out
  setTimeout(() => {
    console.log(`\n📊 Tests complete. Total Passed: ${testPassedCount}, Failed: ${testFailedCount}`);
    if (testFailedCount > 0) {
      process.exit(1);
    } else {
      console.log('🌟 All unit tests executed successfully without issues!');
      process.exit(0);
    }
  }, 100);
}

runTests().catch((err) => {
  console.error('Fatal crash during test execution:', err);
  process.exit(1);
});
