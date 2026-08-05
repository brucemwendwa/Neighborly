# Marking guide — where each requirement lives

A map from the brief to the code, so nothing has to be hunted for.

## 2.1 Authentication & Authorization (JWT)

| Requirement | Where |
|---|---|
| Registration + login | `controllers/auth_controller.py` — `POST /api/auth/register`, `POST /api/auth/login` |
| Passwords hashed | `models/user.py` — bcrypt via a write-only `password` property; the column is `_password_hash`, so plaintext can never be assigned by accident |
| JWT issued on login | flask-jwt-extended; access + refresh tokens returned as `token` / `refresh_token` |
| Protected routes reject no/invalid token | `@jwt_required()` on every non-public handler → **401** |
| Role restriction | `controllers/utils.py` → `role_required("admin")`; a resident hitting an admin route gets **403** |
| Frontend stores + attaches token | `client/src/api/client.js` attaches `Authorization: Bearer …` to every call; `client/src/context/AuthContext.jsx` holds the session |

Four roles, not two: `resident`, `provider`, `security`, `admin`.

## 2.2 Relationships — all three

**One-to-one** (`uselist=False` + unique FK)
- `User` ↔ `UserWallet` — `models/user.py:42`
- `User` ↔ `ServiceProvider` — `models/user.py:47`
- `ServiceRequest` ↔ `Booking` — `models/service_request.py:91`

**One-to-many**
- `Estate` → `User`, `Booking`, `HouseListing`, `CommuteRide`
- `ServiceCategory` → `Service` → `Booking`
- `Booking` → `Payment`, `GatePass`, `Review`, `JobStatusEvent`

**Many-to-many, via association objects that carry extra data** — both directions are real, and the join row is worth reading on its own:

| Join | Connects | Extra attributes it carries |
|---|---|---|
| `RideBooking` (`models/ride_booking.py`) | `User` ↔ `CommuteRide` | `seats_claimed`, `status`, `created_at` |
| `JobQuote` (`models/job_quote.py`) | `ServiceRequest` ↔ `ServiceProvider` | `amount`, `message`, `eta_minutes`, `status` |

`JobQuote` also carries a `UniqueConstraint(request_id, provider_id)` — one bid per provider per request.

## 2.3 Pagination

`controllers/utils.py` → `paginate()` wraps `db.paginate()` (SQL-side `LIMIT/OFFSET`, never sliced in Python). Every list endpoint returns:

```json
{ "items": [...], "page": 1, "per_page": 20, "total": 57, "pages": 3, "total_pages": 3 }
```

Try: `GET /api/services?page=2&per_page=3`

## 2.4 Frontend — fetch + hooks

- **fetch, not axios** — `client/src/api/client.js` is a hand-rolled `fetch` wrapper. axios is not a dependency.
- **Custom hooks** — `client/src/hooks/useApi.js` exports `useApi` (read) and `useAction` (write); `useAuth`, `useTheme`, `useToast` in `client/src/context/`.
- **Three UI states** — `Results` in `client/src/components/ui.jsx` renders loading / error / empty / success in one place.
- **Full CRUD from the UI** — service requests are the clearest single example: create (`RequestNew.jsx`), read (`Requests.jsx`, `RequestDetail.jsx`), update (`PATCH` on the detail page), delete (withdraw). Listings, rides, bookings and the admin catalogue are also full CRUD.
- **Protected routes** — `client/src/components/ProtectedRoute.jsx` redirects to `/sign-in`, remembering where you were headed.

## 2.5 Deep querying

| Endpoint | What it does |
|---|---|
| `GET /api/dashboard/insights` | Three grouped queries: bookings→services→categories joined and summed with `HAVING`; providers→users→bookings ranked by `SUM`; residents→requests→quotes with `outerjoin` + `COUNT(DISTINCT …)` |
| `GET /api/dashboard/admin` | Platform-wide `func.count` / `func.sum` aggregates |
| `GET /api/reviews/summary` | `group_by(Review.rating)` histogram |
| `GET /api/gate-passes?estate_id=` | Relationship filter — `GatePass.host.has(estate_id=…)`, an EXISTS subquery with no join |
| `GET /api/requests` | `selectinload` + `joinedload` to avoid N+1 when each row reports its quote count and lowest bid |

## 2.6 Migrations & seeding

- Flask-Migrate. No `db.create_all()` anywhere in application code.
- Verified from empty: `flask db upgrade` builds all 19 tables from zero.
- `seed.py` fills **every** table, including both association tables with real rows — 3 job quotes across 2 requests, plus ride bookings with seats claimed.

## Serialization

marshmallow + marshmallow-sqlalchemy (`schemas/`). Recursion is controlled deliberately: `XxxSummarySchema` is the trimmed version embedded in other payloads, and `ServiceRequestListSchema` excludes `quotes`/`events` so a feed does not drag every bid and every history row with it.

## Demo path (3 minutes)

1. `/sign-in` → `amina@example.com` / `Password123`
2. **Services → Post a request** — fill it in, submit (CREATE)
3. Sign in as `caleb@example.com` → **Requests** → quote on it (the association object being written)
4. Back as Amina → accept the quote → lands on the booking it created
5. Sign in as `admin@jiranihub.co.ke` → **Global overview** → the three aggregate tables
6. Show a 401: call any `/api/bookings` without a token. Show a 403: call `/api/dashboard/insights` as a resident.
