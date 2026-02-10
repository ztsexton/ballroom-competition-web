// Set NODE_ENV to test before tests run to prevent server from starting
process.env.NODE_ENV = 'test';
// Force JSON data store for unit tests (independent of .env / running Postgres)
process.env.DATA_STORE = 'json';
