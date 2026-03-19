import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { createHash } from "crypto";
import { getUserByEmail, getUserById, createUser, updateUser, getApiKeyByHash, touchApiKeyLastUsed } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const rawEmail = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!rawEmail || !password) {
          logger.warn("login attempt with missing credentials");
          return null;
        }

        const email = rawEmail.toLowerCase().trim();
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
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        // Enforce domain restriction
        const allowedDomains = (process.env.AUTH_GOOGLE_ALLOWED_DOMAINS || "").split(",").map(d => d.trim()).filter(Boolean);
        if (allowedDomains.length > 0) {
          const domain = email.split("@")[1];
          if (!allowedDomains.includes(domain)) {
            logger.warn("google login rejected: domain not allowed", { email, domain });
            return false;
          }
        }

        // Upsert user on first Google login
        const existing = await getUserByEmail(email);
        if (!existing) {
          // Auto-create user with a placeholder password hash (Google-only user)
          const name = user.name || email.split("@")[0];
          await createUser(generateId(), email, name, "GOOGLE_OAUTH_USER", "user");
          logger.info("auto-created user via Google OAuth", { email });
        } else if (existing.name !== user.name && user.name) {
          // Update name if changed in Google profile
          await updateUser(existing.id, { name: user.name });
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        // For credentials login, user object has our DB fields
        if (account?.provider === "credentials") {
          token.id = user.id;
          token.role = (user as { role?: string }).role ?? "user";
        }
      }

      // For Google OAuth, resolve DB user by email
      if (account?.provider === "google" && user?.email) {
        const dbUser = await getUserByEmail(user.email.toLowerCase().trim());
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
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

// Dual-mode auth: API key (Bearer token) or session cookie
export async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer eul_")) {
    const rawKey = authHeader.slice(7);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const apiKey = await getApiKeyByHash(keyHash);
    if (!apiKey) {
      return null;
    }
    // Fire-and-forget last_used_at update
    touchApiKeyLastUsed(apiKey.id).catch(() => {});
    return getUserById(apiKey.userId);
  }
  return getRequiredUser();
}

// Dual-mode admin check
export async function requireAdminFromRequest(request: Request) {
  const user = await authenticateRequest(request);
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}
