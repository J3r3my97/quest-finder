import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { User } from "@/types";

// Mock user database - in production, this would be replaced with Prisma
const users: Array<User & { password: string }> = [];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user by email
        const user = users.find((u) => u.email === email);

        if (!user) {
          return null;
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});

// Helper function to register a new user
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<User | null> {
  // Check if user already exists
  const existingUser = users.find((u) => u.email === email);
  if (existingUser) {
    return null;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new user
  const newUser: User & { password: string } = {
    id: crypto.randomUUID(),
    email,
    name: name || null,
    password: hashedPassword,
    subscriptionTier: "FREE",
    createdAt: new Date(),
  };

  users.push(newUser);

  // Return user without password
  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

// Helper to get user by email (for checking existence)
export function getUserByEmail(email: string): User | null {
  const user = users.find((u) => u.email === email);
  if (!user) return null;
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}
