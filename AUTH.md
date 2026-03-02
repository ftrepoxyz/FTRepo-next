# Authentication

FTRepo uses a session-based authentication system with user approval flow.

## How It Works

- **Sessions**: HTTP-only cookies (`ftrepo_session`) with 30-day expiry
- **Passwords**: Hashed with scrypt (Node.js `crypto` module, no external dependencies)
- **Middleware**: Cookie-presence check on all routes (Edge-compatible, no DB calls)
- **Route protection**: API routes wrapped with `withAuth()` / `withAdmin()` for DB-level auth

## First-User Setup

1. Navigate to the application — you'll be redirected to `/login`
2. Click "Register" to create the first account
3. The first user is automatically an **admin** and **approved**
4. All subsequent users require admin approval before they can log in

## User Approval Flow

1. New user registers at `/register`
2. They see a "pending approval" message
3. An admin goes to **Settings > Users** tab
4. Admin clicks the checkmark to approve the user
5. The user can now log in

## User Roles

| Role | Permissions |
|------|------------|
| `admin` | Full access + user management (approve, role change, delete) |
| `user` | Access to all dashboard features |

## Settings > Users Tab

Admins see a "Users" tab in Settings with:
- User list with role/status badges
- Approve/reject buttons
- Role toggle (admin/user)
- Delete user (with confirmation dialog)

Admins cannot demote themselves or delete their own account.

## CLI User Management

For Docker deployments, manage users via CLI:

```bash
# Create a user
docker exec -it <container> npx tsx scripts/manage-users.ts create <username> <password>

# Create an admin user
docker exec -it <container> npx tsx scripts/manage-users.ts create <username> <password> --admin

# List all users
docker exec -it <container> npx tsx scripts/manage-users.ts list

# Approve a pending user
docker exec -it <container> npx tsx scripts/manage-users.ts approve <username>

# Change user role
docker exec -it <container> npx tsx scripts/manage-users.ts set-role <username> admin

# Reset password
docker exec -it <container> npx tsx scripts/manage-users.ts reset-password <username> <new-password>

# Delete a user
docker exec -it <container> npx tsx scripts/manage-users.ts delete <username>
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/logout` | Public | Logout (clears session) |
| GET | `/api/auth/me` | Session | Current user info |
| GET | `/api/users` | Admin | List users |
| PUT | `/api/users` | Admin | Update user (approve, role) |
| DELETE | `/api/users?id=N` | Admin | Delete user |

## Session Cleanup

Expired sessions are automatically cleaned up when the cleanup action runs (Settings > Admin Actions > Run Cleanup, or via the worker's scheduled cleanup).
