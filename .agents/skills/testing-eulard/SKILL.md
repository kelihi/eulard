# Testing Eulard Locally

## Prerequisites
- PostgreSQL server installed and running
- Node.js + pnpm installed
- Repository cloned

## Local Setup

### 1. PostgreSQL Setup
```bash
# Install if needed
sudo apt-get install -y postgresql
sudo pg_ctlcluster 14 main start

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE eulard;"
sudo -u postgres psql -c "CREATE USER eulard_user WITH PASSWORD '<password>';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE eulard TO eulard_user;"
sudo -u postgres psql -d eulard -c "GRANT ALL ON SCHEMA public TO eulard_user;"
```

### 2. Environment Variables
Create `.env.local` in the repo root:
```
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=eulard
DB_USER=eulard_user
DB_PASSWORD=<password>
AUTH_SECRET=<random-string>
NEXTAUTH_URL=http://localhost:3000
```

Note: `ANTHROPIC_API_KEY` is only needed if testing actual AI chat features.

### 3. Start Dev Server
```bash
pnpm run dev
```
Server runs at http://localhost:3000

### 4. Initialize Database & Seed Admin User
The app does NOT auto-initialize the database on page load. You must hit the `/api/init` endpoint:
```bash
curl http://localhost:3000/api/init
```
This creates all tables and seeds the default admin user.

### 5. Default Admin Credentials
- Email: `${kelihi_dbt_cloud_username}` (configurable via `ADMIN_EMAIL` env var)
- Password: `changeme123` (configurable via `ADMIN_DEFAULT_PASSWORD` env var)

## Key URLs
- Login: http://localhost:3000/login
- Editor (main app): http://localhost:3000 (redirects after login)
- Admin Panel: http://localhost:3000/admin (admin role required)

## Testing Admin Panel Features
1. Login at `/login` with admin credentials
2. Navigate to `/admin`
3. The admin panel has sections: Invite New User, AI Configuration, Users list
4. AI Configuration section has: Model input, System Prompt editor (toggle), Save/Reset buttons

## Database Verification
To verify data directly:
```bash
PGPASSWORD=<password> psql -h 127.0.0.1 -U eulard_user -d eulard -c "SELECT * FROM app_settings;"
PGPASSWORD=<password> psql -h 127.0.0.1 -U eulard_user -d eulard -c "SELECT id, email, role FROM users;"
```

## Important Notes
- The app uses NextAuth v5 with credentials provider and bcryptjs for password hashing
- Database tables are created idempotently via `initializeDatabase()` which is called from `seedDatabase()` -> `/api/init`
- The `app_settings` table stores key-value pairs for AI config (system prompt, model)
- No CI is configured in the repo - rely on `pnpm run lint` (next lint) for checks
- First time running `next lint` may prompt to choose ESLint config - select "Strict" (default)

## Devin Secrets Needed
- No secrets required for basic local testing
- `ANTHROPIC_API_KEY` needed only if testing AI chat functionality
