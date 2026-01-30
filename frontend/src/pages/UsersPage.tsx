import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/client';
import { User } from '../types';

const UsersPage = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await usersApi.getAll();
      setUsers(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdmin = async (uid: string, currentAdminStatus: boolean) => {
    try {
      setError(null);
      await usersApi.updateAdmin(uid, !currentAdminStatus);
      await loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user');
      console.error('Error updating user:', err);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to view this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <div className="card">
        <h2>User Management</h2>
        <p style={{ marginBottom: '2rem', color: '#718096' }}>
          Manage user roles and permissions
        </p>

        {error && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: '#fed7d7',
            color: '#c53030',
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {users.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#a0aec0' }}>
            No users have signed in yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>User</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Last Login</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Admin</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.uid} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {user.photoURL && (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || user.email}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%'
                          }}
                        />
                      )}
                      <span>{user.displayName || 'No name'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem' }}>{user.email}</td>
                  <td style={{ padding: '0.75rem' }}>
                    {new Date(user.lastLoginAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    {user.isAdmin ? (
                      <span style={{
                        backgroundColor: '#667eea',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.875rem'
                      }}>
                        Admin
                      </span>
                    ) : (
                      <span style={{
                        backgroundColor: '#e2e8f0',
                        color: '#4a5568',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.875rem'
                      }}>
                        User
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    {user.email === 'zsexton2011@gmail.com' ? (
                      <span style={{ color: '#a0aec0', fontSize: '0.875rem' }}>
                        Primary Admin
                      </span>
                    ) : (
                      <button
                        onClick={() => toggleAdmin(user.uid, user.isAdmin)}
                        className="btn"
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          backgroundColor: user.isAdmin ? '#e53e3e' : '#667eea'
                        }}
                      >
                        {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UsersPage;
