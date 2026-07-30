# RequestHub — Admin Request System

## Quick Start

### 1. Database
Open SQL Server Management Studio → Run `database/setup.sql`

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
- Home:      http://localhost:3000/
- Admin:     http://localhost:3000/admin
- Employee:  http://localhost:3000/employee
- Finance:   http://localhost:3000/finance
- Insights:  http://localhost:3000/insights
- Health:    http://localhost:3001/health

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
        │   ├── MockData.ts     ← ⭐ Delete when backend is ready
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

## When Backend is Ready
1. Delete `admin-frontend/src/components/MockData.ts`
2. Replace `mockRequests` usage in routes with real `fetch()` calls to backend API
