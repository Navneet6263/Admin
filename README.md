# RequestHub — Admin Request System

## Quick Start

### 1. Database
Open SQL Server Management Studio → Run `database/setup.sql`
Then run `database/center_migration.sql` and `database/role_hq_center_migration.sql` (for existing DBs).

### 2. Backend
```bash
cd admin-backend
# Edit .env → set DB_PASSWORD
npm run dev
# ✅ SQL Server connected
# 🚀 Backend running on port 3001
```

### 3. Frontend
```bash
cd admin-frontend
bun install        # or: npm install
bun run dev        # or: npm run dev
# ▲ Running on http://localhost:3000
```

### URLs
- Home:         http://localhost:3000/
- HQ Admin:     http://localhost:3000/admin
- Center Admin: http://localhost:3000/center-admin
- Employee:     http://localhost:3000/employee
- Finance:      http://localhost:3000/finance
- Insights:     http://localhost:3000/insights
- Health:       http://localhost:3001/health

## API Endpoints

| Method | Route                               | Description           |
|--------|-------------------------------------|-----------------------|
| GET    | /api/admin/requests?status=pending  | Get requests by status|
| GET    | /api/admin/stats                    | Stats summary         |
| POST   | /api/admin/requests/:id/approve     | Approve request       |
| POST   | /api/admin/requests/:id/reject      | Reject request        |
| GET    | /api/employee/requests/:userId      | Get my requests       |
| POST   | /api/employee/requests              | Create new request    |
| GET    | /api/employee/notifications/:userId | Get notifications     |
| PATCH  | /api/employee/notifications/:id/read| Mark as read          |

### Enterprise workflow APIs

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/workflow/queue?page=1&page_size=25` | Policy-scoped approval queue |
| POST | `/api/workflow/requests/:id/approve` | Atomic approval, inventory issue and budget commitment |
| POST | `/api/workflow/requests/:id/queue` | Escalate to Super Admin |
| GET | `/api/payments` | Paginated internal payment queue |
| POST | `/api/payments/:requestId/update` | Record final vendor/payment details |
| POST | `/api/payments/:requestId/verify` | Finance verification and center spend posting |
| GET | `/api/notifications` | Paginated live notifications and reminders |
| GET/POST/PATCH | `/api/super-admin/policies` | Per-user, center and category capabilities |

## Routing and accounting rules

- `request_center_code` owns the approval action.
- `home_center_code` is the employee's permanent center.
- `charge_center_code` and `inventory_center_code` remain the home center.
- Approval limits come from `approval_policies`; over-limit requests are routed to the next eligible role.
- Approval commits estimated budget. Finance verification posts actual spend and releases the commitment.
- Payment details are internal and are not returned by employee request APIs.
- Payment reminders run every minute; configure the delay with `PAYMENT_REMINDER_MINUTES`.
- Startup migrations are idempotent and live in `admin-backend/src/migrations/workflow.ts`.

## Project Structure
```
Admin/
├── database/
│   └── setup.sql               ← Run this first
├── admin-backend/
│   ├── src/
│   │   ├── server.ts           ← Entry point
│   │   ├── db.ts               ← DB pool + cache
│   │   └── routes/
│   │       ├── admin.ts        ← Admin routes
│   │       └── employee.ts     ← Employee routes
│   ├── .env                    ← Set DB_PASSWORD here
│   └── package.json
└── admin-frontend/             ← TanStack Start + Vite + shadcn/ui
    └── src/
        ├── components/
        │   ├── DashboardLayout.tsx
        │   ├── RequestRow.tsx
        │   ├── RequestDetail.tsx
        │   ├── NewRequestDialog.tsx
        │   └── insights/
        │       └── PeopleInsights.tsx
        └── routes/
            ├── index.tsx       ← Home / landing
            ├── admin.tsx       ← Admin approval queue
            ├── employee.tsx    ← Employee workspace
            ├── finance.tsx     ← Finance console
            └── insights.tsx    ← Analytics & heatmap
```
