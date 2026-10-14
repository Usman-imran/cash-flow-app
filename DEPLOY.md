# Deploying: Supabase (database) + Render (backend)

## 1. Create the Supabase database

1. Sign in at https://supabase.com → **New project**. Pick a region close to you
   (e.g. Mumbai / `ap-south-1`) and set a **database password**. Save it; you need it below.
2. When the project is ready, click **Connect** (top of the dashboard) → **Connection String**.
3. Under **Session pooler**, copy the URI. It looks like:

   ```
   postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```

   Replace `[YOUR-PASSWORD]` with your password and add `?sslmode=require` to the end.
   If the password contains `@ : / ? # %`, URL-encode those characters (e.g. `@` → `%40`).

   Use the **Session pooler** string, not "Direct connection": the direct host is IPv6-only and
   Render (and most home networks) can't reach it.

## 2. Copy your existing local data into Supabase

Run from PowerShell on this PC, with the Session pooler URI from step 1:

```powershell
$env:SUPABASE_URL = "postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require"

& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -h localhost -p 5433 -U postgres -d cash_flow `
  --no-owner --no-privileges `
  -t persons -t cash_transactions -t cash_transaction_denominations -t cash_denominations `
  -f cash_flow_dump.sql

& "C:\Program Files\PostgreSQL\17\bin\psql.exe" $env:SUPABASE_URL -v ON_ERROR_STOP=1 -f cash_flow_dump.sql
```

This creates the tables and copies all salesmen, cash entries and denominations, including the
ID counters, so new salesman codes continue from where they are now.
Do this **before** the first Render deploy. If the backend starts first, it creates empty tables
and the import fails with "already exists". In that case, drop the four tables in Supabase's
SQL Editor and run the import again.

Skipping this step is fine if you want to start with an empty database: the backend creates the
tables itself on first start.

Delete `cash_flow_dump.sql` afterwards; it contains your data.

## 3. Deploy the backend on Render

1. Make sure the latest code (including `render.yaml`) is pushed to GitHub.
2. Sign in at https://render.com with GitHub → **New** → **Blueprint** → pick the
   `cash-flow-app` repo. Render reads `render.yaml` and sets up the `cash-flow-api` service.
3. It asks for two values:
   - `DATABASE_URL`: the Supabase Session pooler URI from step 1 (with `?sslmode=require`)
   - `CORS_ORIGINS`: where the frontend runs, comma-separated. While the frontend is still
     local, use `http://localhost:3000`. Add the real frontend URL later (Render →
     service → **Environment**).
4. Click **Apply**. After the build, the API is at `https://cash-flow-api-xxxx.onrender.com`.
   Check `https://<that-url>/api/health` and confirm it returns `{"status":"ok"}`.

## 4. Point the frontend at the deployed API

Create `.env.local` in the project root:

```
NEXT_PUBLIC_API_URL=https://cash-flow-api-xxxx.onrender.com
```

Restart `npm run dev`. If you deploy the frontend (e.g. on Vercel), set the same variable
there and add its URL to `CORS_ORIGINS` on Render.

## Good to know

- **Render free plan** sleeps after 15 minutes without requests. The next request takes ~1
  minute to wake it up.
- **Supabase free plan** pauses a project after about a week of no activity. Resume it from the
  dashboard.
- Python version on Render is pinned by `backend/.python-version`.
