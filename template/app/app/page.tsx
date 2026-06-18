import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { TodoForm } from "./todo-form";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const todos = await withUser(session.user.id, async (c) =>
    (await c.query(
      "select id, title, done from todos order by created_at desc",
    )).rows as { id: string; title: string; done: boolean }[],
  );

  return (
    <div className="shell">
      <div className="card">
        <h1>Your todos</h1>
        <p className="muted">
          Signed in as {session.user.email} — you only ever see your own rows (RLS).
        </p>

        <TodoForm />

        <ul className="todos">
          {todos.length === 0 && <li className="empty">No todos yet.</li>}
          {todos.map((t) => (
            <li key={t.id}>{t.title}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
