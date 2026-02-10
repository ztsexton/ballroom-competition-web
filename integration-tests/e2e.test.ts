import { GenericContainer, Network, Wait } from 'testcontainers';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('E2E Tests with Testcontainers', () => {
  let appContainer: StartedTestContainer;
  let postgresContainer: StartedTestContainer;
  let firebaseContainer: StartedTestContainer;
  let cypressContainer: StartedTestContainer;
  let network: StartedNetwork;

  const appAlias = 'app';
  const postgresAlias = 'postgres';
  const firebaseAlias = 'firebase';

  const TEST_USER_EMAIL = 'admin@test.com';
  const TEST_USER_PASSWORD = 'testpassword123';

  beforeAll(async () => {
    console.log('Creating Docker network...');
    network = await new Network().start();

    // 1. Start PostgreSQL with schema init
    console.log('Starting PostgreSQL...');
    const schemaPath = path.resolve(__dirname, '../backend/src/services/data/schema.sql');
    postgresContainer = await new GenericContainer('postgres:15-alpine')
      .withNetwork(network)
      .withNetworkAliases(postgresAlias)
      .withEnvironment({
        POSTGRES_USER: 'ballroom',
        POSTGRES_PASSWORD: 'ballroom',
        POSTGRES_DB: 'ballroom_scorer',
      })
      .withBindMounts([{
        source: schemaPath,
        target: '/docker-entrypoint-initdb.d/01-schema.sql',
        mode: 'ro',
      }])
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    console.log('PostgreSQL started');

    // 2. Start Firebase Auth Emulator
    console.log('Starting Firebase Auth Emulator...');
    firebaseContainer = await new GenericContainer('firebase-auth-emulator-test')
      .withNetwork(network)
      .withNetworkAliases(firebaseAlias)
      .withExposedPorts(9099)
      .withWaitStrategy(Wait.forLogMessage(/All emulators ready/))
      .start();
    const emulatorPort = firebaseContainer.getMappedPort(9099);
    console.log(`Firebase Auth Emulator started (host port: ${emulatorPort})`);

    // 3. Create test user in Firebase Auth Emulator
    console.log('Creating test user in emulator...');
    const emulatorUrl = `http://localhost:${emulatorPort}`;
    const createUserResponse = await fetch(
      `${emulatorUrl}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
          returnSecureToken: true,
        }),
      }
    );
    const userData = await createUserResponse.json();
    const testUserUid = userData.localId;
    console.log(`Test user created with UID: ${testUserUid}`);

    // 4. Start app container (connected to postgres + firebase emulator)
    console.log('Starting app container...');
    const databaseUrl = `postgresql://ballroom:ballroom@${postgresAlias}:5432/ballroom_scorer`;
    appContainer = await new GenericContainer('ballroom-scorer-test')
      .withNetwork(network)
      .withNetworkAliases(appAlias)
      .withExposedPorts(3001)
      .withEnvironment({
        NODE_ENV: 'production',
        PORT: '3001',
        USE_HTTPS: 'false',
        DATA_STORE: 'postgres',
        DATABASE_URL: databaseUrl,
        FIREBASE_AUTH_EMULATOR_HOST: `${firebaseAlias}:9099`,
        FIREBASE_PROJECT_ID: 'demo-test',
      })
      .withWaitStrategy(Wait.forHttp('/api/health', 3001).forStatusCode(200))
      .start();

    const appHost = appContainer.getHost();
    const appPort = appContainer.getMappedPort(3001);
    console.log(`App started at http://${appHost}:${appPort}`);

    // 5. Run database migrations
    const migrateResponse = await fetch(
      `http://${appHost}:${appPort}/api/database/migrate`,
      { method: 'POST' },
    );
    const migrateResult = await migrateResponse.json();
    console.log('Migration result:', migrateResult);

    // 6. Insert test user as admin in postgres
    const insertResult = await postgresContainer.exec([
      'psql', '-U', 'ballroom', '-d', 'ballroom_scorer', '-c',
      `INSERT INTO users (uid, email, display_name, is_admin, sign_in_methods, created_at, last_login_at)
       VALUES ('${testUserUid}', '${TEST_USER_EMAIL}', 'Test Admin', true, '["email"]', NOW()::text, NOW()::text)
       ON CONFLICT (uid) DO UPDATE SET is_admin = true;`,
    ]);
    console.log('Admin user inserted:', insertResult.output.trim());
  }, 300000); // 5 minute timeout for all container startup

  afterAll(async () => {
    const stops = [
      cypressContainer?.stop().catch(() => {}),
      appContainer?.stop().catch(() => {}),
      firebaseContainer?.stop().catch(() => {}),
      postgresContainer?.stop().catch(() => {}),
    ].filter(Boolean);
    await Promise.allSettled(stops);
    if (network) await network.stop();
    console.log('All containers stopped');
  });

  it('should pass Cypress smoke test', async () => {
    const e2eTestsPath = path.resolve(__dirname, '../e2e-tests');
    const appUrl = `http://${appAlias}:3001`;

    console.log(`Running Cypress smoke test against ${appUrl}`);

    cypressContainer = await new GenericContainer('cypress/included:13.6.0')
      .withNetwork(network)
      .withBindMounts([{
        source: e2eTestsPath,
        target: '/e2e',
        mode: 'rw',
      }])
      .withWorkingDir('/e2e')
      .withEnvironment({
        CYPRESS_baseUrl: appUrl,
        CYPRESS_TEST_USER_EMAIL: TEST_USER_EMAIL,
        CYPRESS_TEST_USER_PASSWORD: TEST_USER_PASSWORD,
      })
      .withCommand([
        '--spec', 'cypress/e2e/smoke.cy.ts',
        '--browser', 'chrome',
        '--config', 'video=false,screenshotOnRunFailure=true,downloadsFolder=/tmp/cypress-downloads,screenshotsFolder=/e2e/cypress/screenshots',
      ])
      .withStartupTimeout(120000)
      .start();

    const containerId = cypressContainer.getId();
    console.log(`Cypress container started: ${containerId.slice(0, 12)}`);

    // Stream logs in real-time
    const logsProcess = spawn('docker', ['logs', '-f', containerId], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    // Wait for container to exit
    const exitCode = await new Promise<number>((resolve, reject) => {
      const waitProcess = spawn('docker', ['wait', containerId]);
      let output = '';
      waitProcess.stdout.on('data', (chunk) => { output += chunk.toString(); });
      waitProcess.on('close', () => resolve(parseInt(output.trim(), 10)));
      waitProcess.on('error', reject);
    });

    logsProcess.kill();
    console.log(`\nCypress finished with exit code ${exitCode}`);

    if (exitCode !== 0) {
      throw new Error(`Cypress tests failed with exit code ${exitCode}`);
    }

    expect(exitCode).toBe(0);
  }, 600000); // 10 minute timeout
});
