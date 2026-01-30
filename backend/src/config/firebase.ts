import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// In production, you should use a service account key
// For now, we'll initialize with the project ID
const app = admin.initializeApp({
  projectId: 'ballroom-comp-manager',
});

export const auth = admin.auth(app);
export default app;
