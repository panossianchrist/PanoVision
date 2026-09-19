import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const { getStore } = await import("../lib/server/store");
const { passwordHash } = await import("../lib/server/http");
const [username, role = "admin"] = process.argv.slice(2);
const password = process.env.PANO_ADMIN_PASSWORD || "";
delete process.env.PANO_ADMIN_PASSWORD;
if (
  !username ||
  !/^[a-z0-9._-]{3,100}$/.test(username) ||
  !["admin", "reviewer"].includes(role) ||
  password.length < 16 ||
  password.length > 256
) {
  console.error(
    "Usage: npm run admin:create -- username [admin|reviewer]. Set PANO_ADMIN_PASSWORD to a unique password of 16-256 characters; do not pass it as a command argument.",
  );
  process.exitCode = 1;
} else {
  const store = getStore();
  try {
    if (store.admin(username)) throw new Error("exists");
    const id = store.addAdmin(
      username,
      passwordHash(password),
      role as "admin" | "reviewer",
    );
    store.audit(
      null,
      null,
      id,
      "admin_provisioned",
      null,
      null,
      "Account provisioned from trusted server CLI",
    );
    console.info(
      `Created ${role} account: ${username}. Sign in at /admin/login.`,
    );
  } catch {
    console.error(
      "Account could not be created. Check for an existing username and verify database access.",
    );
    process.exitCode = 1;
  } finally {
    store.close();
  }
}
