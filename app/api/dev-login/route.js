import { NextResponse } from "next/server";

// Backs the "Administrator test account" button on the login page.
// Only ever responds outside production, so the credentials never
// reach a browser hitting the deployed app, and the button on the
// login page hides itself when this route has nothing to give it.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const email = process.env.ADMIN_TEST_EMAIL;
  const password = process.env.ADMIN_TEST_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }
  return NextResponse.json({ email, password });
}
