import { GenericContainer } from 'testcontainers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function cleanupCypressArtifacts() {
  const e2eTestsPath = path.resolve(__dirname, '../e2e-tests');
  const dirsToClean = ['cypress/downloads', 'cypress/screenshots'];

  let needsContainerCleanup = false;
  for (const dir of dirsToClean) {
    const fullPath = path.resolve(e2eTestsPath, dir);
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } catch {
      needsContainerCleanup = true;
    }
  }

  if (needsContainerCleanup) {
    try {
      const container = await new GenericContainer('alpine:latest')
        .withBindMounts([{ source: e2eTestsPath, target: '/e2e', mode: 'rw' }])
        .withEntrypoint(['/bin/sh'])
        .withCommand(['-c', 'rm -rf /e2e/cypress/downloads /e2e/cypress/screenshots; sleep infinity'])
        .withStartupTimeout(10000)
        .start();
      await container.stop();
    } catch {
      console.warn('Warning: Could not clean up root-owned Cypress artifacts');
    }
  }
}

export async function setup() {
  await cleanupCypressArtifacts();

  const repoRoot = path.resolve(__dirname, '..');
  const emulatorDir = path.resolve(__dirname, 'firebase-emulator');

  // Build Firebase Auth Emulator image
  console.log('Building Firebase Auth Emulator image...');
  await GenericContainer
    .fromDockerfile(emulatorDir)
    .build('firebase-auth-emulator-test', { deleteOnExit: false });
  console.log('Firebase Auth Emulator image built');

  // Build app image with emulator support baked into the frontend
  console.log('Building app Docker image...');
  await GenericContainer.fromDockerfile(repoRoot)
    .withBuildArgs({
      VITE_FIREBASE_AUTH_EMULATOR_HOST: 'http://firebase:9099',
      VITE_FIREBASE_API_KEY: 'fake-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-test',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-test.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:fake',
    })
    .build('ballroom-scorer-test', { deleteOnExit: false });
  console.log('App Docker image built');
}

export async function teardown() {
  await cleanupCypressArtifacts();
}
