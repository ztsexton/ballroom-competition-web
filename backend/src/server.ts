import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import peopleRoutes from './routes/people';
import couplesRoutes from './routes/couples';
import judgesRoutes from './routes/judges';
import eventsRoutes from './routes/events';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/people', peopleRoutes);
app.use('/api/couples', couplesRoutes);
app.use('/api/judges', judgesRoutes);
app.use('/api/events', eventsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

export default app;
