import { GenericContainer, Wait } from 'testcontainers';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { StartedTestContainer } from 'testcontainers';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('E2E Tests with Testcontainers', () => {
  let container: StartedTestContainer;
  let baseUrl: string;

  beforeAll(async () => {
    console.log('Building and starting container for E2E tests...');

    // Build and start the container from the Dockerfile (in parent directory)
    container = await GenericContainer.fromDockerfile('../')
      .withBuildArgs({})
      .build('ballroom-scorer-e2e', { deleteOnExit: true })
      .then((image) =>
        image
          .withExposedPorts(3001)
          .withEnvironment({
            NODE_ENV: 'production',
            PORT: '3001',
            USE_HTTPS: 'false',
            DATA_STORE: 'json',
            // Disable auth for E2E testing
            DISABLE_AUTH: 'true',
          })
          .withWaitStrategy(Wait.forHttp('/api/health', 3001).forStatusCode(200))
          .start()
      );

    const host = container.getHost();
    const port = container.getMappedPort(3001);
    baseUrl = `http://${host}:${port}`;

    console.log(`Container started at ${baseUrl}`);
  }, 300000); // 5 minute timeout for building

  afterAll(async () => {
    if (container) {
      await container.stop();
      console.log('Container stopped');
    }
  });

  it('should pass all Cypress E2E tests', async () => {
    const e2eTestsPath = path.resolve(__dirname, '../e2e-tests');

    console.log(`Running Cypress tests against ${baseUrl}`);
    console.log(`E2E tests path: ${e2eTestsPath}`);
    console.log(`Current working directory: ${process.cwd()}`);

    // Verify the e2e-tests directory exists
    if (!fs.existsSync(e2eTestsPath)) {
      throw new Error(`E2E tests directory not found: ${e2eTestsPath}`);
    }

    // Verify cypress.config.ts exists
    const cypressConfig = path.join(e2eTestsPath, 'cypress.config.ts');
    if (!fs.existsSync(cypressConfig)) {
      throw new Error(`Cypress config not found: ${cypressConfig}`);
    }

    // Run Cypress using npx from the e2e-tests directory
    // This ensures we use the correct Cypress installation and config
    const cypressCommand = [
      'npx cypress run',
      '--browser chrome',
      '--headless',
      `--config baseUrl=${baseUrl},video=false,screenshotOnRunFailure=true`,
      `--env API_URL=${baseUrl},AUTH_DISABLED=true`,
    ].join(' ');

    console.log(`Running command: ${cypressCommand}`);

    try {
      const output = execSync(cypressCommand, {
        cwd: e2eTestsPath,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 600000, // 10 minute timeout
        env: {
          ...process.env,
          // Ensure we don't have any conflicting CI settings
          CI: 'true',
        },
      });

      console.log('\n=== Cypress Output ===');
      console.log(output);

      // If we get here, all tests passed
      expect(true).toBe(true);
    } catch (error) {
      // execSync throws if the command exits with non-zero status
      const execError = error as { stdout?: string; stderr?: string; status?: number };

      console.error('\n=== Cypress Failed ===');
      if (execError.stdout) {
        console.log('stdout:', execError.stdout);
      }
      if (execError.stderr) {
        console.error('stderr:', execError.stderr);
      }

      // Re-throw to fail the test
      throw new Error(`Cypress tests failed with exit code ${execError.status}`);
    }
  }, 600000); // 10 minute timeout for running all E2E tests
});
