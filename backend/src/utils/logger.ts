import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // In test environment, silence logs unless explicitly enabled
  enabled: process.env.NODE_ENV !== 'test' || process.env.LOG_ENABLED === 'true',
});

export default logger;
