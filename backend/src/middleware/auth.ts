import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import { dataService } from '../services/dataService';
import logger from '../utils/logger';
import { User } from '../types';

// Staging bypass: requires STAGING_MODE_ALLOWED=true env var to be set.
// The in-memory flag does not persist through restarts.
let stagingBypassEnabled = false;

export function isStagingAllowed(): boolean {
  return process.env.STAGING_MODE_ALLOWED === 'true';
}

export function isStagingBypass(): boolean {
  return isStagingAllowed() && stagingBypassEnabled;
}

export function setStagingBypass(enabled: boolean): void {
  if (!isStagingAllowed()) return; // silently ignore if not allowed
  stagingBypassEnabled = enabled;
}

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    isAdmin?: boolean;
  };
}

// In-memory user cache to avoid upsertUser on every request
const userCache = new Map<string, { user: User; fetchedAt: number }>();
const USER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedUser(uid: string): User | undefined {
  const entry = userCache.get(uid);
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > USER_CACHE_TTL_MS) {
    userCache.delete(uid);
    return undefined;
  }
  return entry.user;
}

export function clearUserCache(uid: string): void {
  userCache.delete(uid);
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip authentication in unit test environment (integration tests use the Firebase Auth Emulator)
  if (process.env.NODE_ENV === 'test') {
    req.user = {
      uid: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      isAdmin: true,
    };
    next();
    return;
  }

  // Staging auth bypass — auto-authenticate as site admin without Firebase
  if (stagingBypassEnabled) {
    req.user = {
      uid: 'staging-admin',
      email: 'staging@admin.local',
      name: 'Staging Admin',
      isAdmin: true,
    };
    next();
    return;
  }

  try {
    // Get token from Authorization header or query param (for SSE EventSource)
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : queryToken;

    if (!token) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

    // Verify the token with Firebase Admin
    const decodedToken = await auth.verifyIdToken(token);

    // Check cache first to avoid DB write on every request
    let user = getCachedUser(decodedToken.uid);

    if (!user) {
      // Cache miss: upsert and cache
      const providerMap: Record<string, string> = {
        'google.com': 'google',
        'password': 'email',
        'facebook.com': 'facebook',
      };
      const signInMethod = providerMap[decodedToken.firebase?.sign_in_provider]
        || decodedToken.firebase?.sign_in_provider || 'google';

      user = await dataService.upsertUser(
        decodedToken.uid,
        decodedToken.email || '',
        decodedToken.name,
        decodedToken.picture,
        signInMethod
      );
      userCache.set(decodedToken.uid, { user, fetchedAt: Date.now() });
    }

    // Attach user info to request
    req.user = {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      isAdmin: user.isAdmin,
    };

    next();
  } catch (error) {
    logger.error({ err: error }, 'Authentication error');
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized: No user' });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }

  next();
};

/**
 * Middleware: passes if user is a site admin OR a competition admin for any competition.
 * Use at route-mount level for competition-scoped routes.
 */
export const requireAnyAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized: No user' });
    return;
  }

  if (req.user.isAdmin) {
    next();
    return;
  }

  try {
    const competitionIds = await dataService.getCompetitionsByAdmin(req.user.uid);
    if (competitionIds.length > 0) {
      next();
      return;
    }
  } catch {
    // Table may not exist if migration hasn't run — fall through to deny
  }

  res.status(403).json({ error: 'Forbidden: Admin access required' });
};

/**
 * Helper: returns true if user is site admin OR competition admin for the given competition.
 * Sends 403 and returns false if denied.
 */
export const assertCompetitionAccess = async (
  req: AuthRequest,
  res: Response,
  competitionId: number
): Promise<boolean> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized: No user' });
    return false;
  }

  if (req.user.isAdmin) return true;

  try {
    const isAdmin = await dataService.isCompetitionAdmin(competitionId, req.user.uid);
    if (isAdmin) return true;
  } catch {
    // Table may not exist if migration hasn't run — fall through to deny
  }

  res.status(403).json({ error: 'Forbidden: You do not have access to this competition' });
  return false;
};
