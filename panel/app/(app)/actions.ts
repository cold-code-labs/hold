"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE } from "../../lib/session";

const API = process.env.HOLD_API_URL || "http://localhost:8787";

export async function createProjectAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await fetch(`${API}/v1/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  revalidatePath("/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
