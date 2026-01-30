import React, { useState } from "react";
import { studiosApi } from "../api/client";
import { useAuth } from "../context/AuthContext";

const StudioPage: React.FC = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [studioName, setStudioName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmitted(false);
    try {
      await studiosApi.create({
        name: studioName,
        contactInfo: contactEmail,
      });
      setSubmitted(true);
      setStudioName("");
      setContactEmail("");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to add studio");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="loading">Loading...</div>;
  }

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
    <div style={{ maxWidth: 400, margin: "2rem auto" }}>
      <h2>Add a Studio</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="studioName">Studio Name</label>
          <input
            id="studioName"
            type="text"
            value={studioName}
            onChange={e => setStudioName(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="contactEmail">Contact Email</label>
          <input
            id="contactEmail"
            type="email"
            value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>
        <button type="submit" style={{ padding: "8px 16px" }} disabled={submitting}>
          {submitting ? "Adding..." : "Add Studio"}
        </button>
      </form>
      {submitted && (
        <div style={{ marginTop: "1rem", color: "green" }}>
          Studio added successfully!
        </div>
      )}
      {error && (
        <div style={{ marginTop: "1rem", color: "red" }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default StudioPage;
