"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TodoForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setTitle("");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="row" style={{ marginTop: 18 }}>
      <input
        type="text"
        placeholder="Add a todo…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
      />
      <button disabled={busy} onClick={add}>
        Add
      </button>
    </div>
  );
}
