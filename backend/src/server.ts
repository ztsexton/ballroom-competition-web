// dotenv is loaded via --require flag in dev script (must load before imports for DATA_STORE)
// In production, env vars are injected by the orchestrator
import express from 'express';
import logger from './utils/logger';
import https from 'https';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { authenticate, requireAdmin } from './middleware/auth';
import competitionsRoutes from './routes/competitions';
import studiosRoutes from './routes/studios';
import organizationsRoutes from './routes/organizations';
import peopleRoutes from './routes/people';
import couplesRoutes from './routes/couples';
import judgesRoutes from './routes/judges';
import eventsRoutes from './routes/events';
import schedulesRoutes from './routes/schedules';
import invoicesRoutes from './routes/invoices';
import mindbodyRoutes from './routes/mindbody';
import usersRoutes from './routes/users';
import judgingRoutes from './routes/judging';
import participantRoutes from './routes/participant';
import scrutineerRoutes from './routes/scrutineer';
import publicRoutes from './routes/public';
import databaseRoutes from './routes/database';

const app = express();
const PORT = process.env.PORT || 3001;
// HTTPS: only enabled if explicitly set to 'true', or if not set and not in production
const USE_HTTPS = process.env.USE_HTTPS === 'true' || (process.env.USE_HTTPS === undefined && process.env.NODE_ENV !== 'production');

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://apis.google.com", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
      frameSrc: ["'self'", "https://accounts.google.com", "https://*.firebaseapp.com"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "https://*.firebaseapp.com"],
      imgSrc: ["'self'", "data:", "https://*.googleusercontent.com", "https://*.google.com"],
    },
  },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));
app.use(cors());
app.use(express.json());

// Request logging (dev only)
if (process.env.NODE_ENV !== 'test') {
  app.use('/api', (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info({
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        ms: Date.now() - start,
      }, 'API request');
    });
    next();
  });
}

// Health check (no auth required)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database routes (no auth - needed for initial migration before users exist)
app.use('/api/database', databaseRoutes);

// Public routes (no auth required)
app.use('/api/public', publicRoutes);

// Apply authentication middleware to all API routes
app.use('/api', authenticate);

// Protected routes (all users can access)
app.use('/api/users', usersRoutes);
app.use('/api/judging', judgingRoutes);
app.use('/api/participant', participantRoutes);

// Competition-scoped routes (site admin OR competition admin — access checks inside handlers)
app.use('/api/competitions', competitionsRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/couples', couplesRoutes);
app.use('/api/judges', judgesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/scrutineer', scrutineerRoutes);

// Site-admin-only routes
app.use('/api/studios', requireAdmin, studiosRoutes);
app.use('/api/organizations', requireAdmin, organizationsRoutes);
app.use('/api/mindbody', requireAdmin, mindbodyRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '../public');
  app.use(express.static(publicPath));

  // SPA fallback - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    // Don't serve index.html for API routes - let them 404
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  if (USE_HTTPS) {
    const httpsOptions = {
      key: fs.readFileSync(path.join(__dirname, '../../.cert/localhost+2-key.pem')),
      cert: fs.readFileSync(path.join(__dirname, '../../.cert/localhost+2.pem')),
    };

    https.createServer(httpsOptions, app).listen(PORT, () => {
      logger.info({ port: PORT, https: true }, 'Backend server started');
    });
  } else {
    app.listen(PORT, () => {
      logger.info({ port: PORT, https: false }, 'Backend server started');
    });
  }
}

export default app;
