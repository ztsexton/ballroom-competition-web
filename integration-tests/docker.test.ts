import { GenericContainer, Wait } from 'testcontainers';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { StartedTestContainer } from 'testcontainers';

describe('Docker Container Integration', () => {
  let container: StartedTestContainer;
  let baseUrl: string;

  beforeAll(async () => {
    // Use pre-built image from globalSetup (no slow fromDockerfile build)
    container = await new GenericContainer('ballroom-scorer-test')
      .withExposedPorts(3001)
      .withEnvironment({
        NODE_ENV: 'production',
        PORT: '3001',
        USE_HTTPS: 'false',
        DATA_STORE: 'json',
      })
      .withWaitStrategy(Wait.forHttp('/api/health', 3001).forStatusCode(200))
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(3001);
    baseUrl = `http://${host}:${port}`;

    console.log(`Container started at ${baseUrl}`);
  }, 120000); // 2 minute timeout (image already built)

  afterAll(async () => {
    if (container) {
      await container.stop();
      console.log('Container stopped');
    }
  });

  it('should respond to health check endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('timestamp');
  });

  it('should serve the frontend UI', async () => {
    const response = await fetch(baseUrl);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<div id="root">');
  });

  it('should serve static assets', async () => {
    // First get the index.html to find asset references
    const indexResponse = await fetch(baseUrl);
    const html = await indexResponse.text();

    // Check that we can load the main JS bundle (Vite outputs with hash)
    const jsMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
    if (jsMatch) {
      const jsResponse = await fetch(`${baseUrl}${jsMatch[1]}`);
      expect(jsResponse.status).toBe(200);
      expect(jsResponse.headers.get('content-type')).toContain('javascript');
    }
  });

  it('should handle SPA routing (return index.html for unknown routes)', async () => {
    const response = await fetch(`${baseUrl}/some/frontend/route`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('<div id="root">');
  });

  it('should not serve index.html for API routes', async () => {
    const response = await fetch(`${baseUrl}/api/nonexistent`);

    // API routes should return JSON errors, not index.html
    const contentType = response.headers.get('content-type') || '';
    expect(contentType).not.toContain('text/html');
    // Will be 401 (auth required) since it hits auth middleware
    expect(response.status).toBe(401);
  });
});
