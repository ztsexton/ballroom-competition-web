import admin from 'firebase-admin';
import logger from '../utils/logger';

/**
 * Firebase Admin SDK initialization
 *
 * In production, credentials are provided via:
 * 1. GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON file
 * 2. FIREBASE_SERVICE_ACCOUNT env var containing the JSON as a string (for K8s secrets)
 * 3. Application Default Credentials (when running on GCP)
 *
 * In development, it falls back to projectId-only initialization which works with
 * `gcloud auth application-default login` or emulators.
 */

function initializeFirebase(): admin.app.App {
  // Already initialized (prevents re-initialization errors)
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'ballroom-comp-manager';

  // Option 1: Service account JSON passed as env var (best for K8s secrets)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
    } catch (e) {
      logger.error({ err: e }, 'Failed to parse FIREBASE_SERVICE_ACCOUNT');
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
    }
  }

  // Option 2: GOOGLE_APPLICATION_CREDENTIALS file path (set by environment)
  // firebase-admin will automatically use this if set
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  }

  // Option 3: Running on GCP (Cloud Run, GKE, etc.) - uses metadata server
  // Option 4: Development fallback - requires `gcloud auth application-default login`
  logger.warn('No Firebase credentials provided, using application default credentials');

  return admin.initializeApp({
    projectId,
  });
}

const app = initializeFirebase();
export const auth = admin.auth(app);
export default app;
