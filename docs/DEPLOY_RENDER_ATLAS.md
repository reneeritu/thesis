# Deploy aura2 on **Render** (API) + **MongoDB Atlas**

This matches your `.env.example` and Zod schemas. After deploy, open:

- **Main guided site:** `https://<your-render-service>.onrender.com/`  
- **Technical demo:** `https://<your-render-service>.onrender.com/demo.html`

(same origin as the API — no CORS setup needed.)

---

## 1. MongoDB Atlas

1. Create a free **M0** cluster (any region).
2. **Database Access** → add a database user (username + password). Save the password.
3. **Network Access** → **Add IP Address** → **Allow access from anywhere** `0.0.0.0/0`  
   - Required because Render’s outbound IPs are not fixed on free/low tiers.
4. **Database** → **Connect** → Drivers → copy the **connection string**.  
   - Replace `<password>` with your user’s password (URL-encode special characters if needed).  
   - Replace `myFirstDatabase` with a DB name, e.g. `aura2`.

Example:

```text
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/aura2?retryWrites=true&w=majority
```

---

## 2. Secrets to generate (before Render)

**JWT_SECRET** — long random string (32+ characters). Example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**ENCRYPTION_KEY** — exactly **64 hex characters** (32 bytes) for AES-256. Example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Render — Web Service

1. **New** → **Web Service** → connect this Git repo (or deploy from your fork).
2. **Runtime:** Node **20 LTS** (repo includes `.nvmrc` with `20`). Avoid **Node 25** on Render if `sharp` fails to load — the app now lazy-loads `sharp`, but Node 20 is still the safest default.
3. **Build command** — must produce `dist/server.js`. Use either:

   ```bash
   npm install && npm run build
   ```

   Or, if you only run `npm install`, this repo’s **`postinstall`** script runs **`npm run build`** automatically so `dist/` exists. (If your Render build is **only** `npm install`, you still get a compile — as long as `postinstall` is not disabled.)

4. **Start command:**

   ```bash
   npm start
   ```

   (`npm start` runs `node dist/server.js`.)

5. **Health check path:** `/health`

### “Cannot find module …/dist/server.js”

Render ran **`npm install` only** and never **`npm run build`**, so TypeScript was not compiled. Fix: set the build command to **`npm install && npm run build`**, or **pull the latest repo** that includes **`postinstall`** so install triggers the build.

6. **Environment variables** (Render → **Environment** — required or the app exits on boot):

   | Key | Value | Notes |
   |-----|--------|--------|
   | `NODE_ENV` | `production` | Recommended; also triggers stricter rate limits on `/auth/*`. |
   | `PORT` | *(leave default)* | Render sets this automatically. |
   | **`MONGODB_URI`** | **Your Atlas URI** | **Required on Render.** If unset, the app tries `localhost` and **crashes**. |
   | **`JWT_SECRET`** | Long random string | **Required** (not the dev default). |
   | **`ENCRYPTION_KEY`** | **Exactly 64 hex chars** | **Required** for registration / seed encryption. |
   | `JWT_EXPIRES_IN` | `7d` | Optional; default in code is `7d`. |
   | `UPLOAD_DIR` | `uploads` | Optional. |
   | `MAX_FILE_SIZE_MB` | `10` | Optional. |

   **Symptom:** Build succeeds, then `npm start` exits immediately after dotenv — almost always **missing/wrong `MONGODB_URI`** or Atlas **Network Access** blocking Render (use `0.0.0.0/0` for demos).

7. **Plan note:** On Render’s free tier, the filesystem is **ephemeral**. Uploaded files under `uploads/` can disappear after a restart. Fine for a small demo; use persistent disk or S3-style storage later if you need retention.

### Build fails with missing `@types/*`, `typescript`, or `AuthRequest` has no `body` / `params`

Render often runs `npm install` with **`NODE_ENV=production`**, which **skips `devDependencies`**. This repo keeps **`typescript`** and **`@types/*`** in **`dependencies`** so `npm run build` works without extra settings.

If you still use an older fork, either **pull this fix** or set the build command to:

```bash
NPM_CONFIG_PRODUCTION=false npm install && npm run build
```

---

## 4. Smoke test after deploy

- Browser: `https://<your-service>.onrender.com/health` → JSON `{ "status": "ok", ... }`
- Browser: `https://<your-service>.onrender.com/demo.html` → run **Register → Space → Project → Trace**

Or from your laptop (PowerShell):

```powershell
$env:BASE_URL="https://<your-service>.onrender.com"
npx ts-node test-full.ts
```

---

## 5. Optional: custom domain

Render → your service → **Settings** → **Custom Domain**. Point DNS as Render instructs. Your demo URL becomes `https://api.yourdomain.com/demo.html` — put that same origin in any future static site if you split frontend later.

---

## Field names (Zod) used by `public/demo.html`

| Step | Endpoint | Body fields |
|------|-----------|-------------|
| Register | `POST /auth/register` | `alias` (3–30 chars, `a-z0-9_-`), `password` (8–128 chars) |
| Login | `POST /auth/login` | `alias`, `password` |
| Space | `POST /spaces` | `name`, optional `description`, optional `settings` (`projectAccess`, `vetoAuthority`, `votingThreshold`, `privacyDefault`, …) |
| Join | `POST /spaces/:id/join` | optional `inviteCode` if space is `invite_only` |
| Project | `POST /projects` | `title`, `spaceId`, optional `contributors[]` with `alias`, `role`, `isPrimary` |
| Trace | `POST /traces` | `projectId`, `activityType`, optional `description`, `duration`, `mode` (`micro` default), `otherDescription` if `activityType` is `other` |

Authorization header for protected routes: `Authorization: Bearer <token>`.
