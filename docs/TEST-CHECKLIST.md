# Local acceptance checklist

Use your own email/phone and sample payment images. Start in demo mode.

| Test | Expected result |
|---|---|
| Register, sign out, sign in | Account works; password is not visible in database |
| Duplicate email | Rejected |
| Incorrect login | Rejected |
| Customer opens /api/admin/bookings | 403; no admin data |
| Customer B opens Customer A's proof URL | 404; image not shown |
| Search date, airport, airline | Matching results only |
| Create future schedule | Customer can see it |
| Edit unused schedule | Updates saved |
| Delete unused schedule | Removed |
| Edit/delete a schedule that has bookings | Rejected |
| Same origin/destination or negative fare | Rejected |
| Booking | Reference created, amount copied from Oracle fare |
| Upload valid PNG/JPEG | PENDING_REVIEW |
| Upload non-image or over 5 MB | Rejected |
| Cancel pending booking | CANCELLED |
| Approve without proof | Rejected |
| Approve proof | CONFIRMED, booked +1, two queue records |
| Approve same booking again | Rejected, seat count stays the same |
| Reject proof | REJECTED, booked count unchanged |
| Demo notifications | SIMULATED, no real messages |
| Live notifications with configured accounts | Provider accepts request; verify actual inbox/phone separately |
| One provider fails | Booking remains confirmed; other channel independently attempted |
| Restart after uncertain notification send | UNKNOWN; inspect provider before retry |

## Last-seat concurrency check

1. Create a future flight with capacity 1.
2. Make two separate bookings and upload proofs for both.
3. Use two separate admin browser sessions to approve the bookings almost at the same time.
4. Exactly one should become CONFIRMED. The other should receive a no-seat error and remain PENDING_REVIEW.
5. In Oracle, verify BOOKED = 1. Reject the other demo proof.

## Date/time check

Create a flight departing 9:00 AM Philippine time. Confirm that the customer list and booking page show 9:00 AM PHT. The database value should be 01:00 UTC. Check arrivals after midnight as well.

## Evidence

Capture screenshots only after a test actually passes. Do not label SIMULATED notifications as delivered. Hide API keys and real personal data in submissions.
