"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(mode: "in" | "up") {
    setBusy(true);
    setError("");
    const fn =
      mode === "up"
        ? authClient.signUp.email({ email, password, name: email.split("@")[0] })
        : authClient.signIn.email({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) return setError(error.message || "Failed");
    router.push("/app");
  }

  return (
    <div className="shell">
      <div className="card">
        <h1>Hold instance</h1>
        <p className="muted">Postgres + RLS + better-auth, all in-app.</p>

        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="row">
          <button disabled={busy} onClick={() => run("in")}>
            Sign in
          </button>
          <button className="ghost" disabled={busy} onClick={() => run("up")}>
            Create account
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
