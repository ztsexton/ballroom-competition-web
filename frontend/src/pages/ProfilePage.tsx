import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/client';

const ProfilePage = () => {
  const { user, currentUser, refreshUser } = useAuth();
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

  const inputStyle = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: '1px solid #cbd5e0',
    borderRadius: '4px',
    fontSize: '0.9rem',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600 as const,
    color: '#4a5568',
    marginBottom: '0.25rem',
  };

  return (
    <div className="container" style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '3rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>My Profile</h2>

      {/* Read-only info */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt=""
              style={{ width: 56, height: 56, borderRadius: '50%' }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{user?.displayName || user?.email}</div>
            <div style={{ fontSize: '0.875rem', color: '#718096' }}>{currentUser?.email}</div>
            {currentUser?.signInMethods && currentUser.signInMethods.length > 0 && (
              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
                {currentUser.signInMethods.map(method => (
                  <span
                    key={method}
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '9999px',
                      background: '#ebf4ff',
                      color: '#3182ce',
                      textTransform: 'capitalize',
                    }}
                  >
                    {method}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editable form */}
      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>First Name</label>
              <input name="firstName" value={formData.firstName} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input name="lastName" value={formData.lastName} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label style={labelStyle}>Phone</label>
            <input name="phone" value={formData.phone} onChange={handleChange} style={inputStyle} type="tel" />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label style={labelStyle}>Studio / Team</label>
            <input name="studioTeamName" value={formData.studioTeamName} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={labelStyle}>City</label>
              <input name="city" value={formData.city} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>State / Region</label>
              <input name="stateRegion" value={formData.stateRegion} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label style={labelStyle}>Country</label>
            <input name="country" value={formData.country} onChange={handleChange} style={inputStyle} />
          </div>

          {error && (
            <div style={{
              marginTop: '1rem',
              padding: '0.5rem 0.75rem',
              background: '#fed7d7',
              color: '#c53030',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              marginTop: '1rem',
              padding: '0.5rem 0.75rem',
              background: '#c6f6d5',
              color: '#276749',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}>
              Profile saved.
            </div>
          )}

          <div style={{ marginTop: '1.25rem' }}>
            <button
              type="submit"
              disabled={saving}
              className="btn"
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                fontSize: '0.9rem',
              }}
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
