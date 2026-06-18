import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withUser } from "@/lib/db";

/** List the caller's todos (RLS scopes the rows to them). */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const todos = await withUser(session.user.id, async (c) =>
    (await c.query(
      "select id, title, done, created_at from todos order by created_at desc",
    )).rows,
  );
  return NextResponse.json({ user: session.user.email, todos });
}

/** Create a todo. `owner` defaults to the caller via hold.current_user_id(). */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  const todo = await withUser(session.user.id, async (c) =>
    (await c.query("insert into todos(title) values ($1) returning id, title, done", [
      title.trim(),
    ])).rows[0],
  );
  return NextResponse.json(todo, { status: 201 });
}
