import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { themes, themeKeys } from '../../themes';
import { usersApi } from '../../api/client';

const ProfilePage = () => {
  const { user, currentUser, refreshUser } = useAuth();
  const { theme: currentTheme, setTheme } = useTheme();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    stateRegion: '',
    country: '',
    studioTeamName: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        phone: currentUser.phone || '',
        city: currentUser.city || '',
        stateRegion: currentUser.stateRegion || '',
        country: currentUser.country || '',
        studioTeamName: currentUser.studioTeamName || '',
      });
    }
  }, [currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await usersApi.updateProfile(formData);
      await refreshUser();
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[600px] mx-auto px-8 pb-12">
      <h2 className="text-xl font-bold text-gray-800 mb-6">My Profile</h2>

      {/* Read-only info */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <div className="flex items-center gap-4">
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt=""
              className="w-14 h-14 rounded-full"
            />
          )}
          <div>
            <div className="font-semibold text-gray-800">{user?.displayName || user?.email}</div>
            <div className="text-sm text-gray-500">{currentUser?.email}</div>
            {currentUser?.signInMethods && currentUser.signInMethods.length > 0 && (
              <div className="flex gap-1.5 mt-1.5">
                {currentUser.signInMethods.map(method => (
                  <span
                    key={method}
                    className="text-[0.7rem] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 capitalize"
                  >
                    {method}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Appearance</h3>
        <div className="grid grid-cols-2 gap-3">
          {themeKeys.map(key => {
            const t = themes[key];
            const selected = key === currentTheme;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTheme(key)}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                  selected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span
                  className="w-8 h-8 rounded-full shrink-0"
                  style={{ backgroundColor: t.swatch }}
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">{t.label}</span>
                  <span className="block text-xs text-gray-500">{t.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Editable form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">First Name</label>
              <input name="firstName" value={formData.firstName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Last Name</label>
              <input name="lastName" value={formData.lastName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Phone</label>
            <input name="phone" value={formData.phone} onChange={handleChange} type="tel" className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Studio / Team</label>
            <input name="studioTeamName" value={formData.studioTeamName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">City</label>
              <input name="city" value={formData.city} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">State / Region</label>
              <input name="stateRegion" value={formData.stateRegion} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Country</label>
            <input name="country" value={formData.country} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>

          {error && (
            <div className="mt-4 px-3 py-2 bg-red-100 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 px-3 py-2 bg-green-100 text-green-800 rounded text-sm">
              Profile saved.
            </div>
          )}

          <div className="mt-5">
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2 bg-primary-500 text-white border-none rounded cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;
