import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../api/client';
import { User } from '../../types';
import { Skeleton } from '../../components/Skeleton';

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
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Access Denied</h2>
          <p>You must be an admin to view this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <Skeleton className="h-8 w-56 mb-4" />
          <Skeleton className="h-4 w-72 mb-8" />
          <Skeleton variant="table" rows={5} cols={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h2>User Management</h2>
        <p className="mb-8 text-gray-500">
          Manage user roles and permissions
        </p>

        {error && (
          <div className="px-3 py-3 bg-red-100 text-red-700 rounded mb-4">
            {error}
          </div>
        )}

        {users.length === 0 ? (
          <p className="text-center text-gray-400">
            No users have signed in yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="p-3 text-left text-sm font-semibold text-gray-600">User</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-600">Email</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-600">Last Login</th>
                  <th className="p-3 text-center text-sm font-semibold text-gray-600">Admin</th>
                  <th className="p-3 text-center text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.uid} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {user.photoURL && (
                          <img
                            src={user.photoURL}
                            alt={user.displayName || user.email}
                            className="w-8 h-8 rounded-full"
                          />
                        )}
                        <span>{user.displayName || 'No name'}</span>
                      </div>
                    </td>
                    <td className="p-3">{user.email}</td>
                    <td className="p-3">
                      {new Date(user.lastLoginAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-center">
                      {user.isAdmin ? (
                        <span className="bg-primary-500 text-white px-2 py-1 rounded text-sm">
                          Admin
                        </span>
                      ) : (
                        <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-sm">
                          User
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {user.email === 'zsexton2011@gmail.com' ? (
                        <span className="text-gray-400 text-sm">
                          Primary Admin
                        </span>
                      ) : (
                        <button
                          onClick={() => toggleAdmin(user.uid, user.isAdmin)}
                          className={`px-4 py-2 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors ${
                            user.isAdmin
                              ? 'bg-danger-500 hover:bg-danger-600'
                              : 'bg-primary-500 hover:bg-primary-600'
                          }`}
                        >
                          {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;
