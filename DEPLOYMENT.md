# Deploy Life Link

## 1. Deploy the backend on Render

Create a Render **Web Service** from this repository with:

- Root Directory: `backend`
- Runtime: `Node`
- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Add these Render environment variables:

```text
NODE_ENV=production
JWT_SECRET=<long-random-secret>
DOCTOR_VERIFICATION_CODE=<private-doctor-code>
ADMIN_REVIEW_KEY=<long-random-admin-key>
CORS_ORIGINS=https://your-project.vercel.app
```

The backend requires Node.js 22.13 or newer because it uses `node:sqlite`.

### Database Configuration

#### Option A: PostgreSQL with Neon.tech (Recommended for Production)
Add this Render environment variable pointing to your cloud PostgreSQL database:

```text
DATABASE_URL=postgresql://neondb_owner:<password>@<host>/neondb?sslmode=require
```
With PostgreSQL, all patient, doctor, and document data is persistently hosted in the cloud with multi-container write-safety and zero disk fees.

#### Option B: Local SQLite with Persistent Disk (Fallback)
If `DATABASE_URL` is omitted, the backend falls back to local SQLite:

```text
DATABASE_PATH=/var/data/lifelink.db
```
Attach a Render persistent disk mounted at `/var/data`.

After deployment, confirm:

```text
https://life-link-zjyg.onrender.com/api/health
```

## 2. Deploy the frontend on Vercel

Import the same repository and configure:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Add this Vercel environment variable for Production, Preview, and Development as needed:

```text
VITE_API_URL=https://life-link-zjyg.onrender.com
```

Deploy the frontend, then copy its final URL into the Render `CORS_ORIGINS` variable. Multiple allowed frontend URLs can be comma-separated.

The included `frontend/vercel.json` sends React Router page requests to `index.html`, so refreshing routes such as `/dashboard` does not return a 404.
