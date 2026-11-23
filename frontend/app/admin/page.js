"use client";

import { useAuth0 } from "@auth0/auth0-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const emptyRecord = { country: "", title: "", caseType: "", severity: "Medium" };

export default function AdminPage() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, user, getAccessTokenSilently } = useAuth0();
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyRecord);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  const claim = process.env.NEXT_PUBLIC_AUTH0_ROLE_CLAIM || "https://columbiatrc.example.com/roles";
  const roles = user?.[claim] || user?.roles || [];
  const isAdmin = Array.isArray(roles) ? roles.includes("admin") : roles === "admin";

  async function loadRecords() {
    const response = await fetch(`${API_URL}/records`);
    setRecords(await response.json());
  }

  useEffect(() => {
    loadRecords();
  }, []);

  async function adminRequest(path, options = {}) {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });
      const body = response.status === 204 ? true : await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(body?.error === "Access denied" ? "Access denied." : body?.error || "Request failed");
        return null;
      }
      setMessage("");
      return body;
    } catch (error) {
      setMessage(error.message || "Authentication request failed");
      return null;
    }
  }

  async function submitRecord(event) {
    event.preventDefault();
    if (!isAdmin) {
      setMessage("Access denied.");
      return;
    }
    const result = await adminRequest(editingId ? `/records/${editingId}` : "/records", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(form),
    });
    if (result) {
      setForm(emptyRecord);
      setEditingId(null);
      await loadRecords();
    }
  }

  function editRecord(record) {
    setEditingId(record.id);
    setForm({
      country: record.country,
      title: record.title,
      caseType: record.caseType,
      severity: record.severity,
    });
  }

  async function deleteRecord(id) {
    if (!isAdmin) {
      setMessage("Access denied.");
      return;
    }
    const result = await adminRequest(`/records/${id}`, { method: "DELETE" });
    if (result !== null) await loadRecords();
  }

  async function uploadPdf(recordId, file) {
    if (!isAdmin) {
      setMessage("Access denied.");
      return;
    }
    if (!file) return;
    const body = new FormData();
    body.append("pdf", file);
    const result = await adminRequest(`/records/${recordId}/document`, {
      method: "POST",
      body,
    });
    if (result) await loadRecords();
  }

  if (isLoading) return <main>Loading...</main>;

  return (
    <main>
      <nav>
        <h1>Admin</h1>
        <Link href="/">Public records</Link>
      </nav>

      {!isAuthenticated ? (
        <button onClick={() => loginWithRedirect()}>Log in</button>
      ) : (
        <>
          <p>Email: {user?.email}</p>
          <p>Role: {isAdmin ? "admin" : "public"}</p>
          <button
            onClick={() =>
              logout({ logoutParams: { returnTo: window.location.origin } })
            }
          >
            Log out
          </button>
        </>
      )}

      {message && <p className="error">{message}</p>}

      {isAuthenticated && !isAdmin && <p className="error">Access denied.</p>}

      {isAuthenticated && isAdmin && (
        <form className="card" onSubmit={submitRecord}>
          <h2>{editingId ? "Edit record" : "Add record"}</h2>
          <input
            required
            placeholder="Country"
            value={form.country}
            onChange={(event) => setForm({ ...form, country: event.target.value })}
          />
          <input
            required
            placeholder="Title"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <input
            required
            placeholder="Case type"
            value={form.caseType}
            onChange={(event) => setForm({ ...form, caseType: event.target.value })}
          />
          <select
            value={form.severity}
            onChange={(event) => setForm({ ...form, severity: event.target.value })}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
          <button type="submit">{editingId ? "Save" : "Add"}</button>
        </form>
      )}

      <table>
        <thead>
          <tr><th>Country</th><th>Title</th><th>Case Type</th><th>Severity</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.country}</td>
              <td>{record.title}</td>
              <td>{record.caseType}</td>
              <td>{record.severity}</td>
              <td>
                {isAuthenticated && isAdmin && (
                  <>
                    <button onClick={() => editRecord(record)}>Edit</button>{" "}
                    <button onClick={() => deleteRecord(record.id)}>Delete</button>{" "}
                    <input
                      type="file"
                      accept="application/pdf"
                      aria-label={`Upload PDF for ${record.title}`}
                      onChange={(event) => uploadPdf(record.id, event.target.files?.[0])}
                    />
                  </>
                )}
                {record.documentUrl && <a href={record.documentUrl}>PDF</a>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
