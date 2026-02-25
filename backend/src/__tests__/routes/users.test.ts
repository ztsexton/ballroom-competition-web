import request from 'supertest';
import app from '../../server';
import { dataService } from '../../services/dataService';

describe('Users API', () => {
  beforeEach(async () => {
    await dataService.resetAllData();
  });

  describe('GET /api/users', () => {
    it('should return empty array when no users exist', async () => {
      const res = await request(app).get('/api/users').expect(200);
      expect(res.body).toEqual([]);
    });

    it('should return all users', async () => {
      await dataService.upsertUser('uid1', 'user1@test.com', 'User One', undefined, 'google');
      await dataService.upsertUser('uid2', 'user2@test.com', 'User Two', undefined, 'email');

      const res = await request(app).get('/api/users').expect(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('PATCH /api/users/:uid/admin', () => {
    it('should update user admin status to true', async () => {
      await dataService.upsertUser('uid1', 'user1@test.com', 'User One', undefined, 'google');

      const res = await request(app)
        .patch('/api/users/uid1/admin')
        .send({ isAdmin: true })
        .expect(200);

      expect(res.body.isAdmin).toBe(true);
    });

    it('should update user admin status to false', async () => {
      await dataService.upsertUser('uid1', 'user1@test.com', 'User One', undefined, 'google');
      await dataService.updateUserAdmin('uid1', true);

      const res = await request(app)
        .patch('/api/users/uid1/admin')
        .send({ isAdmin: false })
        .expect(200);

      expect(res.body.isAdmin).toBe(false);
    });

    it('should return 400 when isAdmin is not a boolean', async () => {
      await dataService.upsertUser('uid1', 'user1@test.com', 'User One', undefined, 'google');

      await request(app)
        .patch('/api/users/uid1/admin')
        .send({ isAdmin: 'yes' })
        .expect(400);
    });

    it('should return 404 for non-existent user', async () => {
      await request(app)
        .patch('/api/users/nonexistent/admin')
        .send({ isAdmin: true })
        .expect(404);
    });
  });

  describe('GET /api/users/me', () => {
    it('should return current user info', async () => {
      // The test auth middleware sets uid to 'test-user-id'
      await dataService.upsertUser('test-user-id', 'test@example.com', 'Test User', undefined, 'google');

      const res = await request(app).get('/api/users/me').expect(200);
      expect(res.body.uid).toBe('test-user-id');
      expect(res.body.email).toBe('test@example.com');
    });

    it('should return 404 when user does not exist in DB', async () => {
      // test-user-id is set by auth middleware but not in DB
      await request(app).get('/api/users/me').expect(404);
    });
  });

  describe('PATCH /api/users/me', () => {
    it('should update user profile fields', async () => {
      await dataService.upsertUser('test-user-id', 'test@example.com', 'Test User', undefined, 'google');

      const res = await request(app)
        .patch('/api/users/me')
        .send({ firstName: 'John', lastName: 'Doe', phone: '555-1234' })
        .expect(200);

      expect(res.body.firstName).toBe('John');
      expect(res.body.lastName).toBe('Doe');
      expect(res.body.phone).toBe('555-1234');
    });

    it('should update location fields', async () => {
      await dataService.upsertUser('test-user-id', 'test@example.com', 'Test User', undefined, 'google');

      const res = await request(app)
        .patch('/api/users/me')
        .send({ city: 'New York', stateRegion: 'NY', country: 'US' })
        .expect(200);

      expect(res.body.city).toBe('New York');
      expect(res.body.stateRegion).toBe('NY');
      expect(res.body.country).toBe('US');
    });

    it('should return 400 when no fields are provided', async () => {
      await dataService.upsertUser('test-user-id', 'test@example.com', 'Test User', undefined, 'google');

      await request(app)
        .patch('/api/users/me')
        .send({})
        .expect(400);
    });

    it('should return 404 when user does not exist in DB', async () => {
      await request(app)
        .patch('/api/users/me')
        .send({ firstName: 'John' })
        .expect(404);
    });
  });
});
