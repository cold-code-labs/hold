"use server";

import { revalidatePath } from "next/cache";

const API = process.env.HOLD_API_URL ?? "http://localhost:8787";

export async function createProjectAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await fetch(`${API}/v1/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  revalidatePath("/");
}
