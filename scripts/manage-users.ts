import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case "create": {
      const [username, password] = args;
      const isAdmin = args.includes("--admin");
      if (!username || !password) {
        console.error("Usage: manage-users create <username> <password> [--admin]");
        process.exit(1);
      }
      const user = await prisma.user.create({
        data: {
          username,
          passwordHash: hashPassword(password),
          role: isAdmin ? "admin" : "user",
          approved: true,
        },
      });
      console.log(`Created user: ${user.username} (role: ${user.role}, approved: true)`);
      break;
    }

    case "list": {
      const users = await prisma.user.findMany({
        select: { id: true, username: true, role: true, approved: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      if (users.length === 0) {
        console.log("No users found.");
      } else {
        console.table(users.map((u) => ({
          ID: u.id,
          Username: u.username,
          Role: u.role,
          Approved: u.approved ? "Yes" : "No",
          Created: u.createdAt.toISOString(),
        })));
      }
      break;
    }

    case "approve": {
      const [username] = args;
      if (!username) {
        console.error("Usage: manage-users approve <username>");
        process.exit(1);
      }
      await prisma.user.update({
        where: { username },
        data: { approved: true },
      });
      console.log(`Approved user: ${username}`);
      break;
    }

    case "set-role": {
      const [username, role] = args;
      if (!username || !role || !["admin", "user"].includes(role)) {
        console.error("Usage: manage-users set-role <username> <admin|user>");
        process.exit(1);
      }
      await prisma.user.update({
        where: { username },
        data: { role },
      });
      console.log(`Set role for ${username}: ${role}`);
      break;
    }

    case "reset-password": {
      const [username, password] = args;
      if (!username || !password) {
        console.error("Usage: manage-users reset-password <username> <password>");
        process.exit(1);
      }
      await prisma.user.update({
        where: { username },
        data: { passwordHash: hashPassword(password) },
      });
      console.log(`Password reset for: ${username}`);
      break;
    }

    case "delete": {
      const [username] = args;
      if (!username) {
        console.error("Usage: manage-users delete <username>");
        process.exit(1);
      }
      await prisma.user.delete({ where: { username } });
      console.log(`Deleted user: ${username}`);
      break;
    }

    default:
      console.log(`FTRepo User Management CLI

Commands:
  create <username> <password> [--admin]  Create a new user
  list                                    List all users
  approve <username>                      Approve a pending user
  set-role <username> <admin|user>        Change user role
  reset-password <username> <password>    Reset user password
  delete <username>                       Delete a user

Docker usage:
  docker exec -it <container> npx tsx scripts/manage-users.ts <command>`);
      if (command) process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
