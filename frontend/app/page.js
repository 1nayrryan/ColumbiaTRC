"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function PublicPage() {
  const [records, setRecords] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("");
  const [severity, setSeverity] = useState("");

  async function loadRecords() {
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (country) params.set("country", country);
    if (severity) params.set("severity", severity);
    const response = await fetch(`${API_URL}/records?${params}`);
    setRecords(await response.json());
  }

  useEffect(() => {
    loadRecords();
  }, []);

  function downloadCsv() {
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (country) params.set("country", country);
    if (severity) params.set("severity", severity);
    window.open(`${API_URL}/records/csv?${params}`, "_blank");
  }

  return (
    <main>
      <nav>
        <h1>TRC Records</h1>
        <Link href="/admin">Admin</Link>
      </nav>

      <section>
        <input
          aria-label="Keyword"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Keyword"
        />
        <input
          aria-label="Country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          placeholder="Country"
        />
        <select
          aria-label="Severity"
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
        >
          <option value="">All severities</option>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
        <button onClick={loadRecords}>Search</button>
        <button onClick={downloadCsv}>Download CSV</button>
      </section>

      <table>
        <thead>
          <tr><th>Country</th><th>Title</th><th>Case Type</th><th>Severity</th><th>PDF</th></tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.country}</td>
              <td>{record.title}</td>
              <td>{record.caseType}</td>
              <td>{record.severity}</td>
              <td>{record.documentUrl ? <a href={record.documentUrl}>View</a> : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
