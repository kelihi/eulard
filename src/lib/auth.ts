import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getUserByEmail, getUserById } from "@/lib/db";
import { logger } from "@/lib/logger";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) {
          logger.warn("login attempt with missing credentials");
          return null;
        }

        const user = await getUserByEmail(email);
        if (!user) {
          logger.warn("login attempt for unknown email", { path: "/api/auth", method: "POST" });
          return null;
        }

        const isValid = await compare(password, user.password_hash);
        if (!isValid) {
          logger.warn("login attempt with wrong password", { userId: user.id, path: "/api/auth", method: "POST" });
          return null;
        }

        logger.info("login success", { userId: user.id, path: "/api/auth", method: "POST" });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
});

// Helper to get the current user from an API route
export async function getRequiredUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const user = await getUserById(session.user.id);
  return user;
}

// Helper to check if user is admin
export async function requireAdmin() {
  const user = await getRequiredUser();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}
