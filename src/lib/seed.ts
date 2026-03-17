import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { getUserByEmail, createUser, updateUser, initializeDatabase } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function seedDatabase(): Promise<void> {
  await initializeDatabase();

  // Seed admin users if not exists
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "chu@kelihi.com,alex@kelihi.com")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

  for (const adminEmail of adminEmails) {
    const existing = await getUserByEmail(adminEmail);

    if (!existing) {
      let defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD;
      if (!defaultPassword) {
        defaultPassword = randomBytes(16).toString("base64url");
        logger.warn("ADMIN_DEFAULT_PASSWORD not set — generated random password for admin user", { email: adminEmail });
      }
      const passwordHash = await hash(defaultPassword, 12);
      await createUser(generateId(), adminEmail, adminEmail.split("@")[0], passwordHash, "admin");
      logger.info("admin user created", { email: adminEmail });
    } else if (existing.role !== "admin") {
      await updateUser(existing.id, { role: "admin" });
      logger.info("promoted existing user to admin", { email: adminEmail });
    }
  }
}
