import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { settingsApi } from '../../api/client';
import { SiteSettings } from '../../types';
import { Skeleton } from '../../components/Skeleton';

const SiteSettingsPage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    settingsApi.get()
      .then(res => setSettings(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const handleSave = async (field: keyof SiteSettings, value: number | undefined | null) => {
    try {
      const res = await settingsApi.update({ [field]: value } as Partial<SiteSettings>);
      setSettings(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
  };

  if (loading || authLoading) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <Skeleton variant="card" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Access Denied</h2>
          <p>Only site administrators can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Site Settings</h2>
        <p className="text-gray-500 mb-6">
          Global defaults for all competitions. Individual competitions can override these values.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-1">
            Default Max Judge Hours Without Break
          </label>
          <input
            type="number"
            min="0.5"
            max="24"
            step="0.5"
            value={settings.maxJudgeHoursWithoutBreak ?? ''}
            onChange={e => {
              const val = e.target.value ? parseFloat(e.target.value) : undefined;
              setSettings(prev => ({ ...prev, maxJudgeHoursWithoutBreak: val }));
            }}
            onBlur={e => {
              const val = e.target.value ? parseFloat(e.target.value) : null;
              handleSave('maxJudgeHoursWithoutBreak', val);
            }}
            placeholder="6"
            className="w-[120px] px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
          <small className="text-gray-500 text-sm mt-1 block">
            Judges working longer than this limit without a break will be flagged with a warning in the judge schedule view.
            Leave empty to use the default of 6 hours.
          </small>
          {saved && (
            <span className="text-green-600 text-sm ml-2">Saved</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SiteSettingsPage;
