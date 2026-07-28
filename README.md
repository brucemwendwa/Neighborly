# Jirani Hub

**A community services platform for gated estates.**

Residents book trusted service providers, browse verified housing, request
moving help, share commutes, and issue gate passes to visitors — all scoped to
the estate they live in.

*Jirani* is Swahili for **neighbour**. That is the whole premise: the people who
can help you already live near you. The platform's job is to make them findable,
verifiable and payable.

---

## Contents

1. [What the platform does](#1-what-the-platform-does)
2. [Tech stack](#2-tech-stack)
3. [Project structure](#3-project-structure)
4. [Getting started](#4-getting-started)
5. [The data model](#5-the-data-model)
6. [How the models are wired](#6-how-the-models-are-wired)
7. [Architecture](#7-architecture)
8. [Adding a feature, end to end](#8-adding-a-feature-end-to-end)
9. [Working with migrations](#9-working-with-migrations)
10. [Conventions](#10-conventions)
11. [Roadmap](#11-roadmap)

---

## 1. What the platform does

Six product pillars, all built on one estate + user foundation:

| Pillar | What a resident does | Core tables |
|---|---|---|
| **Services** | Books a plumber, cleaner or electrician | `services`, `bookings`, `service_providers` |
| **Housing** | Browses verified vacant units in the estate | `house_listings` |
| **Moving** | Requests a truck, loaders and packers as one job | `move_requests` |
| **Commute** | Offers or claims a seat in a neighbour's car | `commute_rides`, `ride_bookings` |
| **Security** | Issues a QR gate pass for an expected visitor | `gate_passes` |
| **Money** | Pays for a booking, holds a wallet balance | `payments`, `user_wallets` |

### Four roles

Set on `users.role`:

| Role | Can |
|---|---|
| `resident` | Book services, list houses, offer rides, issue gate passes |
| `provider` | Everything a resident can, plus accept jobs. Owns a `service_providers` profile |
| `security` | Scan and validate gate passes at the gate |
| `admin` | Verify providers and listings, manage the service catalogue |

### A booking, end to end

1. A resident picks a service and submits a booking → `status='pending'`,
   `provider_id` is still `NULL`.
2. A verified provider accepts → `status='accepted'`, `provider_id` set.
3. The resident issues a gate pass so security can admit them.
4. Work happens → `status='in_progress'` → `status='completed'`.
5. Payment is captured → a `payments` row with `status='success'`.
6. Both parties review each other → two `reviews` rows on the same booking.

---

## 2. Tech stack

### Backend

| Package | Role | Why |
|---|---|---|
| **Flask 3** | Web framework | Small and explicit. Nothing happens that you did not write, which makes it a good framework to *learn* on. |
| **Flask-SQLAlchemy 3** | ORM | Models are Python classes; relationships are declared, not inferred. The ERD stays readable in code. |
| **Flask-Migrate** (Alembic) | Schema migrations | Versioned, reviewable schema changes. The alternative — `create_all()` — cannot evolve a table without dropping data. |
| **Flask-JWT-Extended** | Auth | Stateless tokens, so there is no session store to run. |
| **Flask-Bcrypt** | Password hashing | Deliberately slow, which is the point: it makes brute-forcing a stolen database expensive. |
| **Marshmallow** | Validation + serialization | Request/response shapes declared as schemas, which double as API documentation. |
| **Flask-CORS** | Cross-origin | Lets the Vite dev server on `:5173` call the API on `:5000`. |
| **psycopg2** | Postgres driver | For when you move off SQLite. |

### Frontend

| Package | Role |
|---|---|
| **React 19** | UI |
| **Vite** | Dev server and bundler |
| **React Router 7** | Client-side routing |
| **Axios** | HTTP, with one configured instance carrying the auth header |

### Why SQLite by default

The app runs with **zero database setup** — no server to install, no user to
create, no connection string to get right. That removes the most common reason a
new teammate cannot get the project running on day one.

Every model is written to run unchanged on both SQLite and Postgres: primary
keys are `String(36)` rather than a native `UUID` type, and `house_listings.images`
is `JSON` rather than a Postgres `ARRAY`. Point `DATABASE_URL` at Postgres and
everything works as-is.

---

## 3. Project structure

```
Neighborly/
│
├── client/                  React + Vite front end
│   ├── src/
│   │   ├── api/client.js        Configured axios instance (auth + errors)
│   │   ├── components/
│   │   │   ├── Layout.jsx        App shell: header, nav, <Outlet/>, footer
│   │   │   └── ProtectedRoute.jsx  Route guard by auth state and role
│   │   ├── context/AuthContext.jsx  Signed-in user, login/register/logout
│   │   ├── pages/                One file per screen
│   │   ├── App.jsx               Route table
│   │   ├── main.jsx              React entry point
│   │   └── index.css             Design tokens + shell styles
│   └── vite.config.js            Dev proxy: /api -> localhost:5000
│
├── controllers/             ⬜ EMPTY — route handlers (blueprints) go here
├── schemas/                 ⬜ EMPTY — Marshmallow schemas go here
│
├── models/                  ✅ 15 SQLAlchemy models from the ERD
│   ├── __init__.py              Registry + the ERD map, in comments
│   ├── base.py                  UUID/timestamp mixins
│   ├── estate.py   user.py   user_wallet.py   service_provider.py
│   ├── service_category.py      service.py
│   ├── booking.py  payment.py
│   ├── house_listing.py  move_request.py
│   ├── commute_ride.py   ride_booking.py
│   └── gate_pass.py  review.py  notification.py
│
├── migrations/              Alembic. Generated — edit versions/, not env.py
│   └── versions/
│       └── 30c1297b48a6_*.py    Initial schema, all 15 tables
│
├── extensions.py            Extension instances (db, migrate, jwt, bcrypt, cors)
├── config.py                Config classes selected by FLASK_ENV
├── main.py                  Application factory + entry point
│
├── Pipfile / Pipfile.lock   Python dependencies (pipenv)
├── .env.example             Every environment variable, documented
├── .gitignore
└── README.md
```

**`controllers/` and `schemas/` are intentionally empty.** They are the two
folders you fill as you build each feature. [Section 8](#8-adding-a-feature-end-to-end)
walks through filling them.

---

## 4. Getting started

### Prerequisites

- Python 3.11+ (built and tested on 3.14)
- `pipenv` — `pip install --user pipenv`
- Node.js 18+ (for the client)

### Backend

```bash
# 1. Install dependencies into a virtualenv
pipenv install

# 2. Copy the environment template
cp .env.example .env

# 3. Create the database (SQLite — no server needed)
pipenv run flask --app main db upgrade

# 4. Run
pipenv run flask --app main run --debug
```

The API is now on **http://localhost:5000**. Confirm it:

```bash
curl http://localhost:5000/api/health
# {"database":"connected","status":"ok"}
```

### Frontend

```bash
cd client
npm install
npm run dev
```

The client is on **http://localhost:5173**. Its home page displays the backend
status — if it reads `API ok · DB connected`, the full chain (browser → Vite
proxy → Flask → database) is working.

### Switching to PostgreSQL

```bash
createdb neighborly
# in .env:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/neighborly

pipenv run flask --app main db upgrade
```

No code changes needed.

### Command reference

| Command | Does |
|---|---|
| `pipenv install` | Install dependencies |
| `pipenv shell` | Activate the virtualenv (then drop the `pipenv run` prefix) |
| `pipenv run flask --app main run --debug` | Run the API with auto-reload |
| `pipenv run flask --app main shell` | REPL with `db` and every model preloaded |
| `pipenv run flask --app main db migrate -m "msg"` | Generate a migration from model changes |
| `pipenv run flask --app main db upgrade` | Apply pending migrations |
| `pipenv run flask --app main db downgrade` | Roll back one migration |
| `pipenv run flask --app main db history` | List all migrations |
| `cd client && npm run dev` | Vite dev server with hot reload |
| `cd client && npm run build` | Production bundle into `client/dist/` |

---

## 5. The data model

15 tables, straight from the ERD.

### Identity and place

| Table | Holds | Notes |
|---|---|---|
| `estates` | Gated communities | The tenant boundary — nearly everything is scoped to an estate |
| `users` | Every human | `role` decides capability; `email` and `phone` are unique and indexed |
| `user_wallets` | Balance per user | **One-to-one** with users |
| `service_providers` | Professional profile | **One-to-one** with users. `is_verified` ≠ `is_approved` |

### Catalogue and transactions

| Table | Holds | Notes |
|---|---|---|
| `service_categories` | Top-level groupings | "Home Repair", "Cleaning", "Moving" |
| `services` | Bookable offerings | Belongs to one category. `base_price` is indicative only |
| `bookings` | **The hub** | Points at customer, provider, service and estate |
| `payments` | Money movement | Many per booking — deposit, balance, retry and refund each get a row |

### Feature verticals

| Table | Holds | Notes |
|---|---|---|
| `house_listings` | Rental units | `images` is a JSON array of URLs |
| `move_requests` | House-moving jobs | Separate from bookings: own pickup/dropoff lifecycle |
| `commute_rides` | Carpool trips offered | Owned by the driver |
| `ride_bookings` | Seats claimed on a ride | A join table that carries its own columns |
| `gate_passes` | Visitor QR codes | Optionally linked to the booking explaining the visit |
| `reviews` | Post-booking feedback | **Two** foreign keys into `users` |
| `notifications` | In-app messages | `type` drives the client's icon and deep link |

### Schema decisions worth understanding

These come up in code review, so they are worth being able to defend.

**UUID string primary keys.** Every table uses `String(36)` holding a UUID
rather than an auto-incrementing integer. The client can generate an ID before
inserting; the ID does not leak how many rows the table holds; and IDs never
collide if data from two environments is merged. `String(36)` rather than a
native `UUID` column keeps the same models running on SQLite and Postgres.

**`Numeric(12, 2)` for all money, never `Float`.** Floating point cannot
represent `0.1` exactly. Money stored as a float drifts by fractions of a cent,
and across thousands of transactions those errors compound into real
discrepancies. `Numeric` is exact decimal arithmetic.

**Enums for status columns.** `bookings.status` is an `Enum`, not a free string,
so a typo like `'complete'` is rejected by the database rather than silently
creating a fourth state nobody handles. Each model re-exports its allowed values
(`BOOKING_STATUSES`, `USER_ROLES`) so schemas and controllers reuse one
definition instead of duplicating the list.

**Passwords are write-only.** `User.password` is a property that raises on read
and hashes on write:

```python
user.password = "secret123"       # hashed with bcrypt, stored
user.check_password("secret123")  # True
user.password                     # AttributeError: password is write-only
```

The column is `_password_hash`, so a plaintext password cannot be assigned to it
by accident, and serialising the model can never leak a hash.

**Constraints live in the database, not just in Python.** A rating outside 1–5,
a duplicate email, a second wallet for one user, a replayed
`transaction_ref` — each is rejected by the database itself. Validation in a
controller can be bypassed by a script, a shell session or a bug. A
`CheckConstraint` cannot.

---

## 6. How the models are wired

This is the section to walk the team through slowly. The map lives in
[`models/__init__.py`](models/__init__.py).

### Reading a SQLAlchemy relationship

```python
# In booking.py — one booking has many payments
payments = db.relationship("Payment", back_populates="booking")

# In payment.py — each payment belongs to one booking
booking = db.relationship("Booking", back_populates="payments")
```

Both halves describe **the same foreign key** (`payments.booking_id`) from
opposite ends. The foreign key column always lives on the "many" side.

### Why `back_populates` and not `backref`

`backref` creates the reverse attribute invisibly — you would have `booking.payments`
existing without any mention of it in `booking.py`. That is convenient to write
and miserable to read: nothing tells a newcomer the attribute is there.

`back_populates` requires both sides to be declared explicitly. Every
relationship is greppable from either file, and the two declarations must agree
or SQLAlchemy raises at startup.

### One-to-one needs two things

```python
# user.py
wallet = db.relationship("UserWallet", back_populates="user", uselist=False)

# user_wallet.py
user_id = db.Column(..., db.ForeignKey("users.user_id"), unique=True)
```

`uselist=False` changes what **Python** hands you — one object instead of a
list. `unique=True` on the foreign key is what stops the **database** accepting a
second wallet. You need both: without the constraint, a bug could insert two
wallets and SQLAlchemy would silently return whichever it found first.

### The double foreign key on `reviews`

`reviews` points at `users` twice — `reviewer_id` and `reviewee_id`. SQLAlchemy
cannot guess which column a relationship means, so **every** relationship on both
sides must say so explicitly:

```python
# review.py
reviewer = db.relationship("User", back_populates="reviews_written",
                           foreign_keys=[reviewer_id])
reviewee = db.relationship("User", back_populates="reviews_received",
                           foreign_keys=[reviewee_id])

# user.py — strings, because Review is not imported here
reviews_written  = db.relationship("Review", back_populates="reviewer",
                                   foreign_keys="Review.reviewer_id")
reviews_received = db.relationship("Review", back_populates="reviewee",
                                   foreign_keys="Review.reviewee_id")
```

Omit `foreign_keys` and you get `AmbiguousForeignKeysError` at mapper
configuration time. **This is the single most common mistake when wiring these
models.**

### Why `ride_bookings` is a model, not a plain association table

A bare many-to-many is enough when the join stores only two IDs. But claiming a
seat also records `seats_booked`, `amount` and `status` — so the join has become
an entity with its own lifecycle, and it gets a model file.

The convenience shortcut is layered on top as a **read-only** view:

```python
# commute_ride.py
passengers = db.relationship("User", secondary="ride_bookings", viewonly=True,
                             back_populates="rides_joined")
```

`ride.passengers` gives you `User` objects directly. It is `viewonly=True` on
purpose: appending to that list would create a `RideBooking` with no seat count
and no amount. Claiming a seat must go through `RideBooking` explicitly.

### Verifying the wiring

Misconfigured relationships fail at *mapper configuration* time, not import
time — so a plain `import models` may pass while the app still breaks. Force it:

```bash
pipenv run flask --app main shell
```

```python
>>> from sqlalchemy.orm import configure_mappers
>>> configure_mappers()          # raises here if anything is wrong
>>> len(db.metadata.tables)      # 15
```

### The relationship map

```
Estate 1──∞ User 1──1 UserWallet
  │            1──1 ServiceProvider
  │            1──∞ Booking, Payment, HouseListing, MoveRequest,
  │                 CommuteRide (as driver), RideBooking (as passenger),
  │                 GatePass, Notification,
  │                 Review (as reviewer AND as reviewee)
  │
  ├──∞ Booking ──1 Service ──1 ServiceCategory
  │       │      └──1 ServiceProvider
  │       ├──∞ Payment
  │       ├──∞ GatePass
  │       └──∞ Review
  │
  ├──∞ HouseListing
  └──∞ CommuteRide 1──∞ RideBooking ∞──1 User (passenger)
```

---

## 7. Architecture

### The request path

```
Browser
   │  axios (client/src/api/client.js) — attaches the JWT
   ▼
Vite dev proxy   /api/* -> localhost:5000
   ▼
Flask
   │  1. CORS, JWT verification              extensions
   │  2. controllers/  ⬜   blueprint routes, HTTP concerns
   │  3. schemas/      ⬜   validate input, serialise output
   │  4. models/       ✅   business data + relationships
   ▼
Database (SQLite or PostgreSQL)
```

### The application factory

`main.py` does not create an app at import time. `create_app()` builds and
returns one:

```python
def create_app(config_name=None):
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))
    register_extensions(app)
    register_blueprints(app)
    register_error_handlers(app)
    return app
```

This buys three things: a different configuration per environment, tests that
spin up a fresh app against an in-memory database, and no side effects on
import.

### Why `extensions.py` exists

`models/user.py` needs `db`. `main.py` needs both `db` and the models. If `db`
were defined in `main.py`, you would get a circular import:

```
main.py  ->  models/user.py  ->  main.py   ✗
```

Putting the extension instances in their own module — one that imports nothing
from the application — breaks the cycle:

```
extensions.py  <-  models/user.py  <-  main.py   ✓
```

The instances are created without an app and bound later with
`db.init_app(app)`.

### Why validation is separate from controllers

A controller that opens with thirty lines of `if not data.get("email"): return
400` is a controller nobody can read. Pushing validation into a Marshmallow
schema means the controller can assume its input is already valid and get
straight to the actual work. The schema then doubles as documentation of the
request shape.

### Error handling is centralised

`register_error_handlers()` in `main.py` converts exceptions into consistent
JSON — `ValidationError` → `400` with field-level detail, `IntegrityError` →
`409` with a rollback, anything unexpected → `500`. Controllers raise; they do
not each write their own error responses.

---

## 8. Adding a feature, end to end

Four steps, the same every time. Here it is for gate passes.

### Step 1 — the schema (`schemas/gate_pass_schema.py`)

```python
from marshmallow import Schema, fields, validate
from models import GATE_PASS_STATUSES


class GatePassCreateSchema(Schema):
    """Validates the incoming request body."""
    visitor_name  = fields.Str(required=True, validate=validate.Length(min=2, max=120))
    visitor_phone = fields.Str(required=True, validate=validate.Length(min=10, max=20))
    purpose       = fields.Str(load_default=None)
    entry_date    = fields.DateTime(required=True)
    booking_id    = fields.Str(load_default=None)


class GatePassSchema(Schema):
    """Shapes the outgoing response."""
    gate_pass_id  = fields.Str(dump_only=True)
    visitor_name  = fields.Str()
    visitor_phone = fields.Str()
    purpose       = fields.Str()
    entry_date    = fields.DateTime()
    exit_date     = fields.DateTime()
    qr_code       = fields.Str()
    status        = fields.Str(validate=validate.OneOf(GATE_PASS_STATUSES))
    created_at    = fields.DateTime(dump_only=True)
```

### Step 2 — the controller (`controllers/gate_pass_controller.py`)

```python
import uuid

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models import GatePass
from schemas.gate_pass_schema import GatePassCreateSchema, GatePassSchema

gate_pass_bp = Blueprint("gate_passes", __name__)

create_schema = GatePassCreateSchema()
one_schema    = GatePassSchema()
many_schema   = GatePassSchema(many=True)


@gate_pass_bp.post("/")
@jwt_required()
def create_gate_pass():
    # Raises ValidationError -> the central handler turns it into a 400.
    data = create_schema.load(request.get_json())

    gate_pass = GatePass(
        **data,
        user_id=get_jwt_identity(),
        qr_code=str(uuid.uuid4()),
    )
    db.session.add(gate_pass)
    db.session.commit()

    return jsonify(one_schema.dump(gate_pass)), 201


@gate_pass_bp.get("/mine")
@jwt_required()
def list_my_gate_passes():
    passes = (
        GatePass.query
        .filter_by(user_id=get_jwt_identity())
        .order_by(GatePass.entry_date.desc())
        .all()
    )
    return jsonify(many_schema.dump(passes))
```

### Step 3 — register the blueprint (`main.py`)

```python
def register_blueprints(app):
    from controllers.gate_pass_controller import gate_pass_bp
    app.register_blueprint(gate_pass_bp, url_prefix="/api/gate-passes")
```

### Step 4 — the client page (`client/src/pages/GatePasses.jsx`)

```jsx
import { useEffect, useState } from 'react'
import api from '../api/client'

export default function GatePasses() {
  const [passes, setPasses] = useState([])

  useEffect(() => {
    api.get('/gate-passes/mine').then(({ data }) => setPasses(data))
  }, [])

  return (
    <section>
      <h1>My gate passes</h1>
      {passes.map((p) => (
        <article key={p.gate_pass_id} className="card">
          <h2>{p.visitor_name}</h2>
          <p>{p.status}</p>
        </article>
      ))}
    </section>
  )
}
```

Then add the route in [`client/src/App.jsx`](client/src/App.jsx):

```jsx
<Route path="gate-passes" element={
  <ProtectedRoute><GatePasses /></ProtectedRoute>
} />
```

### Suggested build order

Build in dependency order, so each feature stands on something that already works:

1. **Auth** — register, login, `@jwt_required()`. Everything else needs `get_jwt_identity()`.
2. **Estates and users** — an admin creates estates; residents join one.
3. **Service catalogue** — categories and services, seeded by an admin.
4. **Bookings** — the core flow, and the largest single piece.
5. **Payments** — attach to bookings once bookings work.
6. Then the verticals in any order: **housing**, **moving**, **commute**,
   **gate passes**, **reviews**, **notifications**.

---

## 9. Working with migrations

Whenever you change a model:

```bash
pipenv run flask --app main db migrate -m "Add cancellation_reason to bookings"
pipenv run flask --app main db upgrade
```

**Always read the generated file before applying it.** Alembic's autogenerate is
good, not infallible — it regularly misses renamed columns (seeing a drop plus an
add, which loses the data) and server-side defaults. The file lands in
`migrations/versions/`.

| Command | Does |
|---|---|
| `db migrate -m "msg"` | Generate a migration by diffing models against the database |
| `db upgrade` | Apply everything pending |
| `db downgrade` | Roll back one revision |
| `db current` | Show the applied revision |
| `db history` | List all revisions |

Migrations are **committed to git**. They are part of the codebase: everyone's
database must move through the same sequence of changes, in the same order.

If the SQLite database gets into a state you cannot untangle while developing,
delete `neighborly.db` and run `db upgrade` again. Never do this once real data
exists — that is exactly what migrations are for.

> `render_as_batch=True` is set in `main.py`. SQLite cannot `ALTER TABLE` the way
> Postgres can, so Alembic rebuilds the table instead. It is harmless on
> Postgres, and without it most schema changes fail on SQLite.

---

## 10. Conventions

**Naming**

| Thing | Style | Example |
|---|---|---|
| Table names | plural snake_case | `house_listings` |
| Columns | snake_case | `total_amount` |
| Model classes | singular PascalCase | `HouseListing` |
| Model files | singular snake_case | `models/house_listing.py` |
| Controllers | `<noun>_controller.py` | `controllers/booking_controller.py` |
| Schemas | `<noun>_schema.py` | `schemas/booking_schema.py` |
| API routes | plural nouns | `/api/gate-passes` |

**API routes carry no verbs.** The HTTP method is the verb: `POST /api/bookings`,
not `POST /api/create-booking`.

**One `db` instance.** Everything imports it from `extensions.py`. A second
`SQLAlchemy()` would have its own metadata, and half your models would be
invisible to migrations.

**Import models in `models/__init__.py`.** Alembic only generates migrations for
tables it has seen. A model nobody imports gets no table — silently, with no
error.

**Never call `axios` directly in a component.** Import the configured instance
from `api/client.js`, so the base URL, auth header and error handling stay in one
place.

**Route guards are UX, not security.** `ProtectedRoute` improves the experience;
it protects nothing. Anyone can edit localStorage. The server must enforce every
rule independently with `@jwt_required()` and its own role checks.

---

## 11. Roadmap

This repository is the scaffold. Still to build:

- [ ] Auth controller: register, login, refresh, `@role_required` decorator
- [ ] Marshmallow schemas for all 15 resources
- [ ] Controllers/blueprints for all 15 resources
- [ ] Seed script: estates, service categories, demo users
- [ ] File uploads for profile pictures and listing images
- [ ] M-Pesa STK push for payments
- [ ] QR generation and a scanner view for security
- [ ] Real-time notifications (WebSockets or polling)
- [ ] Test suite (pytest + an in-memory SQLite app)

### Before production

- Set `FLASK_ENV=production`. `ProductionConfig` refuses to start unless
  `SECRET_KEY`, `JWT_SECRET_KEY` and `DATABASE_URL` are all set, so the
  development fallbacks can never ship by accident.
- Move to PostgreSQL. SQLite has no real concurrent-write story.
- Serve via `gunicorn "main:create_app()"` behind a reverse proxy — the Flask
  development server is single-threaded and not built for production traffic.
- Restrict `CLIENT_URL` to the real front-end origin.
