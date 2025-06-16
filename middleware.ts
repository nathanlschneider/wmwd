import { withErrorAware } from "@erroraware/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function middleware(req: NextRequest) {
  const { nextUrl } = req;
  if (nextUrl.pathname.startsWith("/logger") || nextUrl.pathname.startsWith("/bannedips")) {
    return NextResponse.next();
  }
  return NextResponse.next();
}

export default withErrorAware(middleware);
