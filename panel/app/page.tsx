import { createProjectAction } from "./actions";

const API = process.env.HOLD_API_URL ?? "http://localhost:8787";

type Project = {
  name: string;
  database: string;
  role: string;
  created_at: string;
};

export const dynamic = "force-dynamic";

export default async function Home() {
  let projects: Project[] = [];
  let error: string | null = null;

  try {
    const res = await fetch(`${API}/v1/projects`, { cache: "no-store" });
    projects = await res.json();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <main>
      <h1 style={{ marginBottom: 0 }}>🛡️ Hold</h1>
      <p style={{ color: "#666", marginTop: 4 }}>
        Multi-tenant Postgres BaaS — control panel
      </p>

      <form
        action={createProjectAction}
        style={{ display: "flex", gap: 8, margin: "24px 0" }}
      >
        <input
          name="name"
          placeholder="project name (a-z, 0-9, _)"
          style={{ flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
        />
        <button
          type="submit"
          style={{
            padding: "8px 16px",
            border: 0,
            borderRadius: 6,
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Create project
        </button>
      </form>

      {error && (
        <p style={{ color: "crimson" }}>control-plane unreachable: {error}</p>
      )}

      <h2 style={{ fontSize: 16 }}>Projects ({projects.length})</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {projects.map((p) => (
          <li
            key={p.name}
            style={{
              padding: "10px 12px",
              border: "1px solid #eee",
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            <strong>{p.name}</strong> → <code>{p.database}</code>
            <br />
            <small style={{ color: "#888" }}>
              role {p.role} · {new Date(p.created_at).toLocaleString()}
            </small>
          </li>
        ))}
      </ul>
    </main>
  );
}
