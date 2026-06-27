// Placeholder landing while the React frontend is migrated in (later phase).
// The API (/api/*) is live now.
export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 20px" }}>
      <h1>ViaItinerary</h1>
      <p style={{ color: "#555" }}>
        Next.js port in progress. The API is running at <code>/api</code> (auth is
        live). The full React UI is being migrated in.
      </p>
      <ul style={{ color: "#555", fontSize: 14 }}>
        <li><code>POST /api/login</code></li>
        <li><code>GET /api/user</code></li>
        <li><code>POST /api/signup</code> · <code>POST /api/logout</code></li>
      </ul>
    </main>
  );
}
