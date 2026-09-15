// Auth redirect is handled client-side via RedirectIfAuthenticated component
// because tokens are stored in localStorage (not cookies).
import { NextResponse } from "next/server";

export function proxy() {
  return NextResponse.next();
}
