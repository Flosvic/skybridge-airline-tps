# System notes for your presentation

## What makes this a Transaction Processing System?

The system records a customer's booking and payment proof. An admin reviews the proof. If approved, Oracle saves the confirmation, increases the flight's booked-seat count, and creates the email/SMS queue records in one database transaction. If a step fails, those changes are rolled back together.

## Main flow

Customer browser → React → Express API → Oracle.

After approval, the background worker reads Oracle notification records and calls SendGrid and the selected SMS provider. Provider keys stay on the server.

## Database tables

| Table | Purpose |
|---|---|
| APP_USERS | Customer/admin details and salted password hashes |
| APP_SESSIONS | Hashed login tokens and expiry |
| AIRLINES | The three seeded airline records |
| FLIGHTS | Airline, route, times, fare, capacity, status |
| BOOKINGS | Reference, passenger, saved fare, status, reviewer |
| PAYMENT_PROOFS | One private PNG image per booking, held as a BLOB |
| NOTIFICATIONS | One email and one SMS queue record per confirmed booking |

One user has many bookings. One airline has many flights. One flight has many bookings. One booking has zero or one payment proof and up to two notification records. Each booking represents one passenger and one seat. All monetary values use Oracle NUMBER(10,2), not a floating-point database type.

## States

AWAITING_PAYMENT → PENDING_REVIEW → CONFIRMED or REJECTED.

AWAITING_PAYMENT and PENDING_REVIEW can also become CANCELLED. Re-uploading a proof keeps PENDING_REVIEW. A rejected booking requires a new booking to try again.

## Important implementation choices

- No seat reservation before approval. Displayed availability counts confirmed seats only.
- Approval locks the booking and flight rows with SELECT FOR UPDATE, rechecks state and capacity, and commits the seat update and confirmation together. A second approval of the same booking is rejected.
- The fare is read from Oracle when booking; a browser-supplied price is not used.
- Existing bookings prevent schedule edits and deletion. This protects fares and itineraries from silent changes. Airline records are fixed seed data; CRUD is provided for flight schedules.
- Notification requests happen after the approval transaction commits. External API failure cannot roll back an already confirmed booking.
- Single-server worker claims each QUEUED record before sending. Interrupted sends become UNKNOWN at startup. No exactly-once delivery guarantee is claimed: provider acceptance and database state cannot be committed atomically.
- Status ACCEPTED is not delivery confirmation. Webhook signature verification and delivery receipts are not implemented.
- SQL values use bind parameters. API routes enforce owner/admin checks. Passwords use salted scrypt hashes. Sessions use random tokens in HTTP-only SameSite cookies, with only token hashes stored in Oracle.
- Mutating API calls require the configured browser Origin. Local development runs on loopback. Public deployment needs HTTPS, correct proxy configuration, secure cookies, and a separate deployment review.
- Uploaded images are decoded, resized, and re-encoded to PNG. Only owners and admins can read them. The images are not published as static files.
- API calls are rate-limited. Real-world accounts additionally need verified contact details, password reset, better abuse prevention, and account lifecycle features.
- Dates are stored as UTC timestamps. The form interprets input as UTC+8, and all displayed schedules use Asia/Manila.
- Demo payment approval checks the uploaded proof manually; it does not verify money with GCash.

## Scope limits

One-way journeys; one passenger per booking; no numbered seat selection, round trips, passenger groups, actual airline API, real payment processing, refund workflow, password recovery, delivery webhooks, or production hosting. Confirmed bookings cannot be cancelled in this starter. Historic pending bookings remain until the customer cancels or admin rejects; they do not hold seats. Run only one server process for the included notification worker.

## Official references

- Oracle driver installation / Thin mode: https://node-oracledb.readthedocs.io/en/stable/user_guide/installation.html
- Oracle SQL execution and bind parameters: https://node-oracledb.readthedocs.io/en/stable/user_guide/sql_execution.html
- Oracle Free downloads: https://www.oracle.com/database/free/get-started/
- Oracle XE connection names: https://www.oracle.com/database/technologies/appdev/xe/quickstart.html
- SendGrid Node/email setup: https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-nodejs
- Semaphore SMS API: https://www.semaphore.co/docs
- Semaphore credit information: https://www.semaphore.co/faq
- Twilio SMS messages: https://www.twilio.com/docs/messaging/api/message-resource

Provider account limits and approval requirements can change. Use your account dashboard to confirm access and credits.
