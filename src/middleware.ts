import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use Edge-compatible auth config (no Prisma/bcrypt)
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
