import React, { useState, useEffect } from "react";
import { studiosApi, mindbodyApi } from "../api/client";
import { Studio } from "../types";
import { useAuth } from "../context/AuthContext";

const StudioPage: React.FC = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [studios, setStudios] = useState<Studio[]>([]);
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
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to add studio");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete studio "${name}"? This cannot be undone.`)) return;
    try {
      await studiosApi.delete(id);
      loadStudios();
    } catch {
      setError("Failed to delete studio");
    }
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
    } catch (err: any) {
      setMbError(err?.response?.data?.error || "Failed to connect to MindBody");
    } finally {
      setMbSubmitting(false);
    }
  };

  const handleDisconnect = async (studioId: number) => {
    if (!confirm("Disconnect this studio from MindBody?")) return;
    try {
      await mindbodyApi.disconnect(studioId);
      loadStudios();
    } catch {
      setError("Failed to disconnect from MindBody");
    }
  };

  if (authLoading || loading) return <div className="loading">Loading...</div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage studios.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2>Studios</h2>
        </div>

        {error && <div className="error" style={{ marginBottom: "1rem" }}>{error}</div>}

        {/* Create studio form */}
        <div style={{
          background: "#f7fafc",
          border: "1px solid #cbd5e0",
          borderRadius: "8px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}>
          <h3 style={{ marginTop: 0 }}>Add a Studio</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label htmlFor="studioName">Studio Name *</label>
                <input
                  id="studioName"
                  type="text"
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="contactEmail">Contact Email *</label>
                <input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? "Adding..." : "Add Studio"}
            </button>
          </form>
          {submitted && (
            <div style={{ marginTop: "0.75rem", color: "#059669", fontWeight: 500 }}>
              Studio added successfully!
            </div>
          )}
        </div>

        {/* Studios list */}
        {studios.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#718096" }}>
            No studios yet. Create one above.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {studios.map((studio) => (
              <div
                key={studio.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "1.25rem",
                  background: "white",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h3 style={{ margin: "0 0 0.25rem 0" }}>{studio.name}</h3>
                    {studio.contactInfo && (
                      <p style={{ margin: 0, color: "#718096", fontSize: "0.875rem" }}>
                        {studio.contactInfo}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(studio.id, studio.name)}
                    className="btn btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem", background: "#fee", color: "#c00" }}
                  >
                    Delete
                  </button>
                </div>

                {/* MindBody connection section */}
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
                  {studio.mindbodySiteId ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "12px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        background: "#d1fae5",
                        color: "#065f46",
                      }}>
                        MindBody Connected (Site: {studio.mindbodySiteId})
                      </span>
                      <button
                        onClick={() => handleDisconnect(studio.id)}
                        style={{
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.75rem",
                          background: "none",
                          border: "1px solid #cbd5e0",
                          borderRadius: "4px",
                          color: "#718096",
                          cursor: "pointer",
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : connectingStudioId === studio.id ? (
                    <div style={{ background: "#f7fafc", borderRadius: "6px", padding: "1rem" }}>
                      <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem" }}>Connect to MindBody</h4>
                      {mbError && (
                        <div style={{ color: "#c00", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{mbError}</div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                        <div className="form-group">
                          <label style={{ fontSize: "0.8rem" }}>Site ID</label>
                          <input
                            type="text"
                            value={mbSiteId}
                            onChange={(e) => setMbSiteId(e.target.value)}
                            placeholder="e.g. -99"
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: "0.8rem" }}>Staff Username</label>
                          <input
                            type="text"
                            value={mbUsername}
                            onChange={(e) => setMbUsername(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: "0.8rem" }}>Staff Password</label>
                          <input
                            type="password"
                            value={mbPassword}
                            onChange={(e) => setMbPassword(e.target.value)}
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <button
                          className="btn"
                          style={{ fontSize: "0.8rem", padding: "0.375rem 0.75rem" }}
                          disabled={mbSubmitting || !mbSiteId || !mbUsername || !mbPassword}
                          onClick={() => handleConnect(studio.id)}
                        >
                          {mbSubmitting ? "Connecting..." : "Connect"}
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: "0.8rem", padding: "0.375rem 0.75rem" }}
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
                      className="btn btn-secondary"
                      style={{ fontSize: "0.8rem", padding: "0.375rem 0.75rem" }}
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
    </div>
  );
};

export default StudioPage;
