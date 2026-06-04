// Auth redirect is handled client-side via RedirectIfAuthenticated component
// because tokens are stored in localStorage (not cookies).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}
