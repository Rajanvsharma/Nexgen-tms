# NexGen TMS — Setup Guide

## Prerequisites
- Node.js 18+
- Docker Desktop (for PostgreSQL)
- npm 9+

---

## 1. Install Dependencies

```bash
# From project root
npm install
cd backend && npm install
cd ../frontend && npm install
```

---

## 2. Start PostgreSQL

```bash
# From project root
docker-compose up -d
```

PostgreSQL will be available at `localhost:5432`
- User: `nexgen`
- Password: `nexgen_pass`
- Database: `nexgen_tms`

---

## 3. Run Database Migration & Seed

```bash
cd backend
npx prisma migrate dev --name init
npx prisma db seed
```

This creates all tables and seeds the default admin user:
- **Email**: admin@nexgentms.com
- **Password**: Admin@1234

---

## 4. Start Backend

```bash
cd backend
npm run dev
# API running at http://localhost:4000
```

---

## 5. Start Frontend

```bash
cd frontend
npm run dev
# App running at http://localhost:3000
```

---

## Default Admin Credentials

| Field    | Value                  |
|----------|------------------------|
| Email    | admin@nexgentms.com    |
| Password | Admin@1234             |
| Role     | ADMIN                  |

---

## Project Structure

```
NexGen_TMS/
├── backend/            Node.js + Express + Prisma API (port 4000)
│   ├── prisma/         Database schema + seed
│   └── src/            Controllers, middleware, routes, services
├── frontend/           Next.js 14 App Router (port 3000)
│   ├── app/            Pages (auth + dashboard routes)
│   ├── components/     UI components + layout
│   ├── hooks/          Auth hooks
│   ├── lib/            API client (Axios + interceptor)
│   └── store/          Zustand auth store
└── docker-compose.yml  PostgreSQL service
```

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth/login | No | Login |
| POST | /api/auth/refresh | Cookie | Refresh access token |
| POST | /api/auth/logout | Yes | Logout |
| GET | /api/auth/me | Yes | Get current user |
| GET | /api/users | ADMIN | List all users |
| POST | /api/users | ADMIN | Create user |
| PUT | /api/users/:id | ADMIN | Update user |
| DELETE | /api/users/:id | ADMIN | Delete user |
| GET | /api/customers | Yes | List customers |
| POST | /api/customers | Yes | Create customer |
| PUT | /api/customers/:id | Yes | Update customer |
| GET | /api/carriers | Yes | List carriers |
| POST | /api/carriers | Yes | Create carrier |
| PUT | /api/carriers/:id | Yes | Update carrier |
| POST | /api/carriers/:id/lanes | Yes | Add lane history |
| GET | /api/quotes | Yes | List quotes |
| POST | /api/quotes | Yes | Create quote |
| PATCH | /api/quotes/:id/status | Yes | Approve/reject quote |
| POST | /api/quotes/:id/convert | Yes | Convert quote to load |
| GET | /api/loads | Yes | List loads |
| GET | /api/loads/check-duplicate | Yes | Duplicate detection |
| POST | /api/loads | Yes | Create load |
| PUT | /api/loads/:id | Yes | Update load (incl. driver) |
| POST | /api/loads/:id/dispatch | Yes | Dispatch to carrier |
| GET | /api/announcements | Yes | Get announcements |
| POST | /api/announcements | ADMIN/ACCOUNTING/COMPLIANCE | Post announcement |
| PATCH | /api/announcements/:id/read | Yes | Mark as read |
| GET | /api/accounting/invoices | ADMIN/ACCOUNTING | List invoices |
| POST | /api/accounting/invoices | ADMIN/ACCOUNTING | Create invoice |
| PATCH | /api/accounting/invoices/:id/status | ADMIN/ACCOUNTING | Update invoice status |
| GET | /api/accounting/payments | ADMIN/ACCOUNTING | List carrier payments |
| POST | /api/accounting/payments | ADMIN/ACCOUNTING | Create payment |
| PATCH | /api/accounting/payments/:id/status | ADMIN/ACCOUNTING | Update payment status |
| GET | /api/stats | Yes | Role-aware dashboard stats |
| GET | /api/notes | Yes | Get notes (by loadId/carrierId/customerId) |
| POST | /api/notes | Yes | Add note |
| DELETE | /api/notes/:id | Yes | Delete note |
| GET | /api/reports/revenue | ADMIN/ACCOUNTING | Monthly revenue/cost |
| GET | /api/reports/loads-by-status | ADMIN/ACCOUNTING | Load status breakdown |
| GET | /api/reports/top-carriers | ADMIN/ACCOUNTING | Top carriers by load count |
| GET | /api/reports/top-customers | ADMIN/ACCOUNTING | Top customers by revenue |
| GET | /api/reports/equipment-mix | ADMIN/ACCOUNTING | Equipment type breakdown |
| GET | /api/reports/aging | ADMIN/ACCOUNTING | Aging report (overdue invoices) |
| GET | /api/scorecard | Yes | Carrier scorecards |
| POST | /api/scorecard/performance | Yes | Record load performance |
| POST | /api/scorecard/tonu | Yes | Record TONU |
| GET | /api/documents | Yes | Document history |
| GET | /api/documents/loads/:id/rate-confirmation | Yes | Generate Rate Confirmation PDF |
| GET | /api/documents/loads/:id/bol | Yes | Generate Bill of Lading PDF |
| GET | /api/loadboard/:id/postings | Yes | Get load board postings |
| POST | /api/loadboard/:id/post | Yes | Post load to boards |
| DELETE | /api/loadboard/:id/posting | Yes | Remove posting |
| GET | /api/email/config | Yes | Get IMAP config |
| POST | /api/email/config | Yes | Save IMAP config |
| POST | /api/email/poll | Yes | Poll mailbox now |
| GET | /api/email/logs | Yes | Email log history |
| POST | /api/email/logs/:id/quote | Yes | Create quote from email |
| PATCH | /api/email/logs/:id/skip | Yes | Skip email log |
| GET | /api/ocr | Yes | OCR upload history |
| POST | /api/ocr/upload | Yes | Upload & parse document |
| POST | /api/ocr/:id/quote | Yes | Create quote from OCR |

---

## Frontend Pages

| Route | Description | Roles |
|-------|-------------|-------|
| / | Redirects to /dashboard | All |
| /login | Login page | Public |
| /dashboard | KPI stats + announcements | All |
| /quotes | Quotation management | All |
| /loads | Load management + dispatch + driver | All |
| /carriers | Carrier database | All |
| /customers | Customer accounts | All |
| /loadboard | Post loads to DAT/Truckstop/BulkLoads | All |
| /ocr | AI/OCR document upload & parsing | All |
| /email | IMAP email inbox & quote creation | All |
| /documents | Generate Rate Confirmations & BOLs | All |
| /scorecard | Carrier performance scorecard | All |
| /accounting | Invoices, payments, aging report | ADMIN/ACCOUNTING |
| /reports | KPI charts and analytics | ADMIN/ACCOUNTING |
| /compliance | Carrier compliance alerts | ADMIN/COMPLIANCE |
| /announcements | Company announcements | All |
| /users | User management | ADMIN |
| /customer-portal | Customer-facing portal | Public |
| /carrier-portal | Carrier-facing portal | Public |
