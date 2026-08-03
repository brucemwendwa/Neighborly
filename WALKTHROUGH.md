# Presenting Jirani Hub

A guide for demoing and defending this project in front of a panel.

Everything here is a pointer into real code — nothing is aspirational. Read it
once the day before, and keep it open on a second screen during the demo.

---

## Contents

1. [The one-sentence pitch](#1-the-one-sentence-pitch)
2. [The five-minute demo script](#2-the-five-minute-demo-script)
3. [Follow one request all the way down](#3-follow-one-request-all-the-way-down)
4. [Six decisions worth defending](#4-six-decisions-worth-defending)
5. [Where things live](#5-where-things-live)
6. [Questions a panel actually asks](#6-questions-a-panel-actually-asks)
7. [If something breaks mid-demo](#7-if-something-breaks-mid-demo)

---

## 1. The one-sentence pitch

> Jirani Hub is a community services platform for gated estates: residents book
> vetted providers, browse verified housing, request moving help, share
> commutes and issue visitor gate passes — all scoped to the estate they live
> in.

If you get one more sentence, make it the *why*:

> The people who can help you already live near you. The platform's job is to
> make them findable, verifiable and payable.

**The numbers**, if asked: 15 tables, 88 REST endpoints across 16 blueprints,
18 client screens, 4 user roles.

---

## 2. The five-minute demo script

Start both servers first, and have the browser open on `localhost:5173`.

```bash
pipenv run python seed.py                      # reset to a known state
pipenv run flask --app main run --debug        # terminal 1
cd client && npm run dev                       # terminal 2
```

The sign-in page has one-click buttons for each demo role, so switching
accounts takes two clicks. Password for all of them: `Password123`.

| # | Do this | Say this |
|---|---|---|
| 1 | Land on `/` signed out | "Signed out you see the shop window — the catalogue and housing are public, because nobody signs up before seeing what is on offer." |
| 2 | Sign in as **amina@example.com** | "The same route now renders a dashboard. One request — `GET /api/dashboard` — fills every tile." |
| 3 | Services → open one → **Request booking** | "The booking is posted with just a service id. The customer and the estate come from the token, not the form — anything the client can name, the client can lie about." |
| 4 | Switch to **caleb@example.com** → Bookings → **Open job board** → Accept | "That job was unassigned, so it went on the board for approved providers in that estate. Accepting assigns the provider and moves the status in one request, so a job can never end up accepted by nobody." |
| 5 | Same booking → Start work → Mark complete | "Only the provider can advance a job. The customer can only ever cancel. That rule is a table in `booking_controller.py`, not scattered `if` statements." |
| 6 | Back as **amina** → open the booking → **Pay** → then leave a review | "Payment writes a row in a ledger, not a flag on the booking — a deposit, a retry and a refund each get their own row. And a review is only possible on a booking you were part of that reached completed." |
| 7 | Gate passes → issue one → switch to **gate@jiranihub.co.ke** → Gate desk → paste the code → Admit | "The code is minted server-side from `secrets.token_hex`. Only security can mark a pass used, and the resident gets a notification the moment their visitor is admitted." |
| 8 | Switch to **admin@jiranihub.co.ke** → Admin → Provider approvals → Approve Esther | "This is the trust model. A resident booking a stranger is relying on somebody having checked, so verification is admin-only and a provider cannot approve themselves." |

**Total: about five minutes.** If you are cut short, steps 3–6 are the ones
that show the whole architecture.

---

## 3. Follow one request all the way down

Panels love this question: *"walk me through what happens when a user clicks
that button."* Here is the booking flow, with the file to open at each step.

```
Browser: click "Request booking"
   │
   │  client/src/pages/ServiceDetail.jsx        the form and its submit handler
   ▼
   │  client/src/api/index.js                   bookings.create(payload)
   │  client/src/api/client.js                  attaches Authorization: Bearer …
   ▼
Vite dev proxy   /api/* -> localhost:5000       client/vite.config.js
   ▼
Flask
   │  1. controllers/__init__.py                which blueprint owns /api/bookings
   │  2. controllers/booking_controller.py      @jwt_required, then the rule
   │  3. controllers/utils.py                   body() validates, save() commits
   │  4. schemas/booking.py                     BookingCreateSchema — what is allowed in
   │  5. models/booking.py                      the row that gets written
   ▼
SQLite / PostgreSQL
   │
   │  schemas/booking.py                        BookingSchema — what goes out
   ▼
Browser: navigate to the new booking, render it
```

Four sentences that cover it:

1. **The page** collects the form and calls one function in `api/index.js` —
   components never build URLs or touch axios directly.
2. **The schema** decides what the request is allowed to contain. Notice what
   `BookingCreateSchema` does *not* accept: `user_id` and `estate_id`.
3. **The controller** is the business rule and nothing else — parsing,
   permissions and pagination are helpers in `controllers/utils.py`.
4. **The model** owns the data and the relationships; the response schema
   decides what is safe to send back.

---

## 4. Six decisions worth defending

Each of these is a "why did you do it that way?" waiting to happen.

### 1. The booking status machine is data, not code

`controllers/booking_controller.py`

```python
TRANSITIONS = {
    "pending":     {"accepted", "cancelled"},
    "accepted":    {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed":   set(),
    "cancelled":   set(),
}

WHO_MAY_SET = {
    "accepted":    ("provider", "admin"),
    "in_progress": ("provider", "admin"),
    "completed":   ("provider", "admin"),
    "cancelled":   ("customer", "provider", "admin"),
}
```

> "Two questions have to be answered on every status change — is this move
> legal, and is this person allowed to make it. Written as two tables, the
> whole rule fits on a screen and you can check it by reading. Written as
> nested `if`s spread through the controller, you cannot."

`completed` and `cancelled` are terminal on purpose: otherwise a provider could
quietly un-complete a job after being reviewed.

### 2. Money is `Numeric`, never `Float` — and crosses the wire as a string

`models/user_wallet.py`, `schemas/base.py`

> "Floating point cannot represent 0.1 exactly, so money stored as a float
> drifts by fractions of a cent, and those errors compound. The column is
> `Numeric(12, 2)`. Python's `Decimal` is not JSON-serialisable, so the API
> sends `"1500.00"` as a string rather than converting back to a float on the
> way out and reintroducing the same problem."

### 3. Payments are a ledger, not a status flag

`models/payment.py`, `controllers/payment_controller.py`

> "One booking has many payments — a deposit, a balance, a retry after a failed
> card, a refund. Each is its own immutable row. Collapsing them into a single
> 'paid' column destroys the audit trail, which is exactly what you need the
> moment a user disputes a charge."

`settle()` is the one function a real M-Pesa integration would replace; the
ledger around it is real.

### 4. Derived numbers are computed, not stored

`schemas/ride.py` (`seats_left`), `schemas/provider.py` (`rating`)

> "Seats remaining is derived from the seat bookings every time it is read, and
> a provider's rating is averaged from their reviews. A stored counter means
> two writes per action and a number that lies forever the first time one of
> them fails. If profiling ever showed it mattered, that is when you would add
> a cached column — not before."

### 5. Reviews are guarded by three rules the schema cannot express

`controllers/review_controller.py`

> "You must have been part of the booking, the booking must be completed, and
> one review per person per booking. The third is enforced twice — the
> controller checks it for a readable error, and a `UniqueConstraint` on
> `(booking_id, reviewer_id)` guarantees it even if two requests race."

That "validate in both places, for different reasons" answer applies to
ratings too: `validate.Range(min=1, max=5)` for the message, a `CheckConstraint`
for the guarantee.

### 6. Route guards are UX; the server is the security

`client/src/components/ProtectedRoute.jsx`, `controllers/utils.py`

> "`ProtectedRoute` only keeps links out of the way of people who cannot use
> them — anyone can edit localStorage. Every endpoint re-checks independently
> with `@jwt_required()` and `role_required()`, and the JWT's identity is
> re-read from the database on every request rather than trusted from the
> token's claims."

---

## 5. Where things live

Point at a file rather than describing it. This table is the map.

| "Show me…" | Open this |
|---|---|
| Every endpoint that exists | `controllers/__init__.py` |
| Authentication | `controllers/auth_controller.py` |
| The hardest business logic | `controllers/booking_controller.py` |
| Permissions, pagination, notifications | `controllers/utils.py` |
| What a request is allowed to contain | `schemas/<resource>.py` |
| The ERD, in comments | `models/__init__.py` |
| A tricky relationship (two FKs to one table) | `models/review.py` + `models/user.py` |
| A join table that became an entity | `models/ride_booking.py` |
| Error handling in one place | `main.py`, `register_error_handlers()` |
| Why extensions have their own module | `extensions.py` |
| Every API call the client makes | `client/src/api/index.js` |
| The loading / error / empty pattern | `client/src/hooks/useApi.js` |
| The design system | `client/src/index.css` |
| Demo data | `seed.py` |

**File-naming is consistent**, which is worth saying out loud: `models/booking.py`
→ `schemas/booking.py` → `controllers/booking_controller.py` → `/api/bookings`
→ `client/src/pages/Bookings.jsx`.

---

## 6. Questions a panel actually asks

**"Why Flask and not Django?"**
> Flask does nothing you did not write. For a project meant to demonstrate that
> we understand routing, validation, auth and the ORM, a framework that
> generates an admin panel and a serialiser for us would hide exactly the parts
> we are being marked on.

**"Why UUID primary keys instead of auto-increment integers?"**
> Three reasons: the client can generate an id before the row is inserted, the
> id does not leak how many rows the table holds, and ids never collide if data
> from two environments is merged. They are `String(36)` rather than a native
> UUID column so the same models run on both SQLite and Postgres.

**"How does authentication work?"**
> Register or log in and you get two tokens. The short-lived access token is
> sent on every request in the `Authorization` header; the long-lived refresh
> token only ever goes to `/api/auth/refresh`. Nothing is stored server-side —
> the signature is the proof. Passwords are bcrypt-hashed through a write-only
> property on the model, so the plaintext is never assigned to a column.

**"What happens if two people claim the last seat at the same time?"**
> The check and the insert happen in the same request against live data, and
> there is a `UniqueConstraint` on `(ride_id, passenger_id)` so one passenger
> cannot double-book. A genuinely simultaneous pair of requests for the last
> seat is a race a row-level lock would close — `SELECT … FOR UPDATE` on the
> ride — which is the honest answer, and it is why seats are derived rather
> than counted in a column.

**"Is this secure?"**
> The parts we control: passwords are bcrypt-hashed, tokens are signed, every
> endpoint re-checks the role server-side, ownership is checked per row, gate
> pass codes are unguessable, and the ORM parameterises every query so there is
> no string-built SQL. What is missing for production is in the README roadmap
> — rate limiting, a token denylist, and HTTPS termination.

**"Why is the catalogue public but bookings are not?"**
> The catalogue is the shop window; nobody signs up before seeing what is on
> offer. Everything that reads or writes personal data requires a token.

**"What was the hardest part?"**
> Deciding what belongs where. The booking rules are the clearest example: the
> schema validates the *shape* of the request, but whether `completed` is a
> legal move depends on the booking's current status and on who is asking, and
> a schema can see neither. That is why validation and business rules are
> separate layers.

**"What would you do next?"**
> An M-Pesa STK push in place of `settle()`, image uploads instead of URLs,
> WebSockets for the notification bell — it polls per navigation today — and a
> pytest suite against an in-memory SQLite app.

**"Did you test it?"**
> Every endpoint was exercised end to end, including the failure cases —
> wrong-role requests, illegal status transitions, double reviews, overbooked
> seats — and the client was driven through the full flow in a browser for all
> four roles. An automated pytest suite is the next thing on the list; today
> the verification is reproducible but manual.

---

## 7. If something breaks mid-demo

| Symptom | Fix |
|---|---|
| Page shows "unreachable" | Flask is not running, or is on the wrong port. `curl localhost:5000/api/health` |
| Everything 401s / bounces to login | Token expired or the database was reseeded. Sign in again. |
| Data looks wrong after experimenting | `pipenv run python seed.py` resets every table in about a second |
| A booking will not advance | That is the rule working — check who is signed in. Only the provider can start or complete a job. |
| Provider sees no open jobs | They must be **approved** and in the **same estate** as the customer. Approve them in Admin → Provider approvals. |
| The client will not start | `cd client && npm install`, then `npm run dev` |

Keep `curl http://localhost:5000/api/health` in your back pocket — if it
answers `{"status":"ok"}`, the backend and database are fine and the problem is
in the browser.
