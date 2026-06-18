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

### SQLite storage

Render's default filesystem is temporary. For durable patient and doctor data, attach a persistent disk and set:

```text
DATABASE_PATH=/var/data/lifelink.db
```

Use `/var/data` as the disk mount path. Without a persistent disk, the deployed app is suitable only for demos because database changes can be lost.

After deployment, confirm:

```text
https://your-backend.onrender.com/api/health
```

## 2. Deploy the frontend on Vercel

Import the same repository and configure:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Add this Vercel environment variable for Production, Preview, and Development as needed:

```text
VITE_API_URL=https://your-backend.onrender.com
```

Deploy the frontend, then copy its final URL into the Render `CORS_ORIGINS` variable. Multiple allowed frontend URLs can be comma-separated.

The included `frontend/vercel.json` sends React Router page requests to `index.html`, so refreshing routes such as `/dashboard` does not return a 404.
