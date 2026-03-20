# aura2

Art Process Documentation Chain & dApp Backend.

A trust-based, non-financial system for documenting, attributing, and preserving
the artistic process.  See [docs/BACKEND.md](docs/BACKEND.md) for the full
specification and [BACKEND-REVIEW.md](BACKEND-REVIEW.md) for the loophole and
ambiguity review.

---

## Tech Stack

- **Runtime:** Node.js (>=18)
- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** MongoDB + Mongoose
- **Auth:** JWT + bcrypt + BIP-39 seed phrases
- **Validation:** Zod
- **File Upload:** Multer + Sharp
- **Chain:** Simulated in MongoDB (append-only, hash-linked blocks)

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env from the example
cp .env.example .env
# Then edit .env — at minimum set:
#   JWT_SECRET      (random string, 32+ chars)
#   ENCRYPTION_KEY  (64 hex chars = 32 bytes for AES-256)
#   MONGODB_URI     (your MongoDB connection string)

# 3. Start MongoDB (if local)
mongod

# 4. Run in development mode
npm run dev

# 5. Build for production
npm run build
npm start
```

### Generate an ENCRYPTION_KEY

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## API Endpoints

### Auth
| Method | Path             | Description                           |
|--------|------------------|---------------------------------------|
| POST   | `/auth/register` | Create account (alias + password)     |
| POST   | `/auth/login`    | Login (alias + password -> JWT)       |
| POST   | `/auth/recover`  | Reset password via seed phrase        |

### Nodes (profiles)
| Method | Path                          | Description                  |
|--------|-------------------------------|------------------------------|
| GET    | `/nodes/:alias`               | View profile                 |
| PATCH  | `/nodes/me`                   | Update own profile           |
| PUT    | `/nodes/me/trustees`          | Set social recovery trustees |
| POST   | `/nodes/me/block`             | Block a node                 |
| DELETE | `/nodes/me/block/:targetAlias`| Unblock a node               |

### Spaces
| Method | Path                    | Description                  |
|--------|-------------------------|------------------------------|
| POST   | `/spaces`               | Create a space               |
| GET    | `/spaces/:id`           | View space                   |
| POST   | `/spaces/:id/join`      | Join a space                 |
| POST   | `/spaces/:id/invite`    | Generate invite code (admin) |
| PATCH  | `/spaces/:id/settings`  | Update space settings (admin)|

### Projects (START contract)
| Method | Path                         | Description              |
|--------|------------------------------|--------------------------|
| POST   | `/projects`                  | Start a new project      |
| GET    | `/projects/:id`              | View project             |
| GET    | `/projects/space/:spaceId`   | List projects in a space |
| POST   | `/projects/:id/contributors` | Add a contributor        |

### Traces (TRACE contract)
| Method | Path                          | Description              |
|--------|-------------------------------|--------------------------|
| POST   | `/traces`                     | Log activity on a project|
| GET    | `/traces/project/:projectId`  | List traces for project  |
| GET    | `/traces/:id`                 | View single trace        |
| PATCH  | `/traces/:id/proxy-confirm`   | Confirm/dispute proxy log|

### Upload
| Method | Path      | Description                          |
|--------|-----------|--------------------------------------|
| POST   | `/upload` | Upload file (returns SHA-256 hash)   |

### Health
| Method | Path      | Description  |
|--------|-----------|--------------|
| GET    | `/health` | Health check |

---

## Project Structure

```
src/
  config/        Environment, DB connection, configurable chain defaults
  middleware/     Auth (JWT), Zod validation, error handler
  models/        Mongoose models (Block, Node, Space, Project, Trace, Media)
  schemas/       Zod request schemas
  services/      Chain (block creation), auth (BIP-39, JWT, bcrypt), media (Sharp)
  routes/        Express route handlers
  types/         Shared TypeScript interfaces
  utils/         Hashing, encryption, custom errors
  app.ts         Express app setup
  server.ts      Entry point
docs/
  BACKEND.md     Full specification
BACKEND-REVIEW.md  Loophole and ambiguity review
```

---

## Configurable Parameters

All ambiguities from the spec review are exposed as configurable values in
`src/config/defaults.ts`.  Key parameters:

| Parameter                      | Default | Spec Section             |
|--------------------------------|---------|--------------------------|
| `activeNodeThresholdDays`      | 30      | Phase transitions, decay |
| `socialRecoveryMajorityFraction` | 0.6   | Account recovery         |
| `reputationDecayPerMonth`      | 5       | Reputation system        |
| `reputationGraceMonths`        | 3       | Reputation system        |
| `proxyLogConfirmDays`          | 7       | Proxy logging            |
| `supermajorityThreshold`       | 0.7     | Governance               |
| `falseEmergencyFlagPenalty`    | 200     | Content & Safety         |
| `appealWindowDays`             | 7       | Moderation               |

See the full list in [`src/config/defaults.ts`](src/config/defaults.ts).
