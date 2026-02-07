import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'https://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    video: false,
    screenshotOnRunFailure: true,
    // Ignore SSL certificate errors for local development
    chromeWebSecurity: false,
    experimentalModifyObstructiveThirdPartyCode: true,
  },
  env: {
    // Test user credentials (admin user)
    TEST_USER_EMAIL: 'test@example.com',
    API_URL: 'https://localhost:3001',
  },
});
