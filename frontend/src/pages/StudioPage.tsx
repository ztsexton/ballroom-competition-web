import React, { useState } from "react";
import { studiosApi } from "../api/client";

const StudioPage: React.FC = () => {
  const [studioName, setStudioName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
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
      setLoading(false);
    }
  };

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
        <button type="submit" style={{ padding: "8px 16px" }} disabled={loading}>
          {loading ? "Adding..." : "Add Studio"}
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
