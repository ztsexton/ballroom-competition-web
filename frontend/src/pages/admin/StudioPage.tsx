import React, { useState, useEffect } from "react";
import axios from "axios";
import { studiosApi, mindbodyApi } from "../../api/client";
import { Studio } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Skeleton } from "../../components/Skeleton";
import { ConfirmDialog } from "../../components/ConfirmDialog";

const StudioPage: React.FC = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [confirmAction, setConfirmAction] = useState<{title: string; message: string; action: () => void} | null>(null);
  const [loading, setLoading] = useState(true);
  const [studioName, setStudioName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // MindBody connect state
  const [connectingStudioId, setConnectingStudioId] = useState<number | null>(null);
  const [mbSiteId, setMbSiteId] = useState("");
  const [mbUsername, setMbUsername] = useState("");
  const [mbPassword, setMbPassword] = useState("");
  const [mbError, setMbError] = useState<string | null>(null);
  const [mbSubmitting, setMbSubmitting] = useState(false);

  useEffect(() => {
    loadStudios();
  }, []);

  const loadStudios = async () => {
    try {
      const res = await studiosApi.getAll();
      setStudios(res.data);
    } catch {
      setError("Failed to load studios");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmitted(false);
    try {
      await studiosApi.create({ name: studioName, contactInfo: contactEmail });
      setSubmitted(true);
      setStudioName("");
      setContactEmail("");
      loadStudios();
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || "Failed to add studio" : "Failed to add studio");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: number, name: string) => {
    setConfirmAction({
      title: 'Delete Studio',
      message: `Delete studio "${name}"? This cannot be undone.`,
      action: async () => {
        try {
          await studiosApi.delete(id);
          loadStudios();
        } catch {
          showToast("Failed to delete studio", "error");
        }
      },
    });
  };

  const handleConnect = async (studioId: number) => {
    setMbError(null);
    setMbSubmitting(true);
    try {
      await mindbodyApi.connect(studioId, mbSiteId, mbUsername, mbPassword);
      setConnectingStudioId(null);
      setMbSiteId("");
      setMbUsername("");
      setMbPassword("");
      loadStudios();
    } catch (err: unknown) {
      setMbError(axios.isAxiosError(err) ? err.response?.data?.error || "Failed to connect to MindBody" : "Failed to connect to MindBody");
    } finally {
      setMbSubmitting(false);
    }
  };

  const handleDisconnect = (studioId: number) => {
    setConfirmAction({
      title: 'Disconnect MindBody',
      message: 'Disconnect this studio from MindBody?',
      action: async () => {
        try {
          await mindbodyApi.disconnect(studioId);
          loadStudios();
        } catch {
          showToast("Failed to disconnect from MindBody", "error");
        }
      },
    });
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage studios.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2>Studios</h2>
        </div>

        {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded text-sm mb-4">{error}</div>}

        {/* Create studio form */}
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 mb-6">
          <h3 className="mt-0">Add a Studio</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="mb-4">
                <label htmlFor="studioName" className="block text-sm font-medium text-gray-700 mb-1">Studio Name *</label>
                <input
                  id="studioName"
                  type="text"
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">Contact Email *</label>
                <input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? "Adding..." : "Add Studio"}
            </button>
          </form>
          {submitted && (
            <div className="mt-3 text-emerald-600 font-medium">
              Studio added successfully!
            </div>
          )}
        </div>

        {/* Studios list */}
        {studios.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            No studios yet. Create one above.
          </div>
        ) : (
          <div className="grid gap-4">
            {studios.map((studio) => (
              <div
                key={studio.id}
                className="border border-gray-200 rounded-lg p-5 bg-white"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="m-0 mb-1">{studio.name}</h3>
                    {studio.contactInfo && (
                      <p className="m-0 text-gray-500 text-sm">
                        {studio.contactInfo}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(studio.id, studio.name)}
                    className="px-3 py-1 bg-red-50 text-red-600 rounded border border-red-200 cursor-pointer text-xs font-medium transition-colors hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>

                {/* MindBody connection section */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  {studio.mindbodySiteId ? (
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.8rem] font-semibold bg-green-100 text-green-800">
                        MindBody Connected (Site: {studio.mindbodySiteId})
                      </span>
                      <button
                        onClick={() => handleDisconnect(studio.id)}
                        className="px-2 py-1 text-xs bg-transparent border border-gray-300 rounded text-gray-500 cursor-pointer transition-colors hover:bg-gray-100"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : connectingStudioId === studio.id ? (
                    <div className="bg-gray-50 rounded-md p-4">
                      <h4 className="m-0 mb-3 text-[0.9rem]">Connect to MindBody</h4>
                      {mbError && (
                        <div className="text-red-600 text-sm mb-3">{mbError}</div>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="mb-2">
                          <label className="block text-[0.8rem] font-medium text-gray-700 mb-1">Site ID</label>
                          <input
                            type="text"
                            value={mbSiteId}
                            onChange={(e) => setMbSiteId(e.target.value)}
                            placeholder="e.g. -99"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-[0.8rem] font-medium text-gray-700 mb-1">Staff Username</label>
                          <input
                            type="text"
                            value={mbUsername}
                            onChange={(e) => setMbUsername(e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-[0.8rem] font-medium text-gray-700 mb-1">Staff Password</label>
                          <input
                            type="password"
                            value={mbPassword}
                            onChange={(e) => setMbPassword(e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          className="px-3 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-[0.8rem] font-medium transition-colors hover:bg-primary-600 disabled:opacity-50"
                          disabled={mbSubmitting || !mbSiteId || !mbUsername || !mbPassword}
                          onClick={() => handleConnect(studio.id)}
                        >
                          {mbSubmitting ? "Connecting..." : "Connect"}
                        </button>
                        <button
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-[0.8rem] font-medium transition-colors hover:bg-gray-200"
                          onClick={() => {
                            setConnectingStudioId(null);
                            setMbError(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setConnectingStudioId(studio.id);
                        setMbSiteId("");
                        setMbUsername("");
                        setMbPassword("");
                        setMbError(null);
                      }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-[0.8rem] font-medium transition-colors hover:bg-gray-200"
                    >
                      Connect MindBody
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        variant="danger"
        confirmLabel="Confirm"
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default StudioPage;
