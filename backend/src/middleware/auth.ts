import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import { dataService } from '../services/dataService';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    isAdmin?: boolean;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip authentication in test environment
  if (process.env.NODE_ENV === 'test') {
    req.user = {
      uid: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      isAdmin: true, // Test user is admin by default
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

    // Save/update user in database
    const user = await dataService.upsertUser(
      decodedToken.uid,
      decodedToken.email || '',
      decodedToken.name,
      decodedToken.picture
    );

    // Attach user info to request
    req.user = {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      isAdmin: user.isAdmin,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
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
