import { hash } from "bcryptjs";
import { getUserByEmail, createUser, initializeDatabase } from "@/lib/db";
import { generateId } from "@/lib/utils";

export async function seedDatabase(): Promise<void> {
  await initializeDatabase();

  // Seed admin user if not exists
  const adminEmail = process.env.ADMIN_EMAIL || "chu@kelihi.com";
  const existing = await getUserByEmail(adminEmail);

  if (!existing) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || "changeme123";
    const passwordHash = await hash(defaultPassword, 12);
    await createUser(generateId(), adminEmail, "Admin", passwordHash, "admin");
    console.log(`[seed] Admin user created: ${adminEmail}`);
  }
}
