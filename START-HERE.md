# SkyBridge — Airline Ticketing Transaction Processing System

A complete source-code starter for your school project. The database is **Oracle**.

The project uses React for the website and Node.js/Express for the backend. You edit both in VS Code. You do not need PHP, Laravel, XAMPP, or MySQL for this version.

## What is included

- Customer registration and login; separate admin access.
- AirAsia, Cebu Pacific, and Philippine Airlines sample flights.
- Flight search by departure airport, destination, date, and airline.
- One-way booking for one passenger per booking, with a saved fare and reference.
- A dummy GCash-style module: demo QR, image upload, and admin review.
- My bookings page, payment status, proof viewing, and pending-booking cancellation.
- Admin dashboard, flight/schedule create/read/update/delete, payment approval/rejection, notification status, and retry.
- Twilio SendGrid email API, Semaphore SMS API, and optional Twilio SMS API.
- Oracle tables, sample data, validation tests, and a local Oracle check script.

The data is simulated. It does not connect to airline inventory or issue real tickets. The included QR is deliberately not a working GCash payment QR. No real payments are needed.

## 1. Install the software

Use Windows 10/11, 64-bit.

1. Install VS Code: https://code.visualstudio.com/
2. Install **Node.js 24 LTS**, Windows installer: https://nodejs.org/
   Keep the npm option enabled. Close and reopen VS Code after installation.
3. Install **Oracle Database Free for Windows**: https://www.oracle.com/database/free/get-started/
   Extract the installer before running setup. Follow Oracle's installer and remember the database administrator password you set.
4. Install **Oracle SQL Developer** if you do not already have it: https://www.oracle.com/database/sqldeveloper/technologies/download/
   Choose a Windows package with the JDK included when available.

Already using Oracle XE 21c? Keep it. Use `XEPDB1` instead of `FREEPDB1` below. If your school gave you an Oracle server, use its actual host, port, and service name instead. Do not install a second database unnecessarily. SQL Developer alone is only a client; it is not the database server.

Open VS Code → Terminal → New Terminal. Use PowerShell. Check:

```powershell
node --version
npm.cmd --version
```

Use `npm.cmd` throughout this guide to avoid the PowerShell npm.ps1 execution-policy error.

## 2. Extract and open the project

1. Download the supplied ZIP.
2. Right-click → Extract All.
3. Move the `skybridge` folder to a simple location, for example `C:\Projects\skybridge`.
4. In VS Code, choose File → Open Folder → `C:\Projects\skybridge`.
5. In the Explorer, you should see `package.json`, `server`, `client`, and `database`.
6. Open a PowerShell terminal. It should end with `\skybridge>`.

All source files are already supplied. You do not need to copy hundreds of lines manually. To edit a file, open the exact file in VS Code and save with Ctrl+S.

## 3. Connect to Oracle as SYSTEM

In SQL Developer:

1. Click the **+** button for a new connection.
2. Connection name: `Oracle Admin`.
3. Username: `system`.
4. Password: the administrator password you chose during Oracle installation.
5. Connection type: Basic.
6. Hostname: `localhost`.
7. Port: `1521`.
8. Choose **Service name**, not SID.
9. Service name: `FREEPDB1` for Oracle Free, or `XEPDB1` for Oracle XE 21c.
10. Click Test, then Connect when the status is successful.

This connection must be to the pluggable database, not the root `FREE`/`XE` service.

## 4. Create the project database user

In VS Code open `database/create-user.sql`. Replace the example password with your own password. Keep the double quotes around it.

Copy its contents into a SQL Developer worksheet under the SYSTEM connection. Run Script (F5):

```sql
CREATE USER skybridge IDENTIFIED BY "ChangeThisDatabasePassword123";
GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE TO skybridge;
ALTER USER skybridge QUOTA 100M ON USERS;
```

Use the password you actually chose in the next step. The example above is for local setup, not a secret to reuse publicly.

Create another SQL Developer connection:

- Name: `SkyBridge`
- Username: `skybridge`
- Password: your new project database password
- Host: `localhost`
- Port: `1521`
- Service name: `FREEPDB1` or `XEPDB1`

Click Test → Connect. Leave this connection available so you can inspect the tables later.

## 5. Configure the backend

In the VS Code terminal, from the main `skybridge` folder:

```powershell
Copy-Item server/.env.example server/.env
```

Open `server/.env`. Set these values:

```dotenv
PORT=3001
APP_ORIGIN=http://localhost:5173
NODE_ENV=development
DB_USER=skybridge
DB_PASSWORD=ChangeThisDatabasePassword123
DB_CONNECT_STRING=localhost:1521/FREEPDB1
ADMIN_NAME=SkyBridge Admin
ADMIN_EMAIL=admin@skybridge.test
ADMIN_PASSWORD=ChangeThisAdminPassword123!
NOTIFICATION_MODE=demo
SMS_PROVIDER=semaphore
```

- Replace `DB_PASSWORD` with the exact password used in Step 4.
- Replace `ADMIN_PASSWORD` with your own admin login password, at least 10 characters.
- If using XE 21c, change the connection to `localhost:1521/XEPDB1`.
- Keep the remaining provider fields in the file. They can be blank during demo testing.
- Save with Ctrl+S.
- The database password and website admin password are separate.
- Never put provider keys or database passwords in React files or a `VITE_` variable.

## 6. Install packages and create tables

From the main `skybridge` folder:

```powershell
npm.cmd ci
npm.cmd run setup-db
```

Expected message:

```text
Created tables, admin and 21 sample flights. Dates shown in the app use Philippine time.
```

The setup creates the tables, your admin account, the three airlines, and 21 sample flights over the next seven days. Run it **once**. It intentionally stops if the schema already exists; it will not erase your work.

Do not manually run `schema.sql` before `setup-db`; the setup script runs that file for you. Oracle DDL commits automatically. If the initial setup is interrupted halfway, inspect the tables with your instructor before resetting anything. Do not drop a user containing work you need.

## 7. Start the backend

In your first VS Code terminal:

```powershell
npm.cmd run server
```

Expected output includes:

```text
SkyBridge API: http://localhost:3001 | Oracle connected | notifications: demo
```

Keep this terminal running. Open http://localhost:3001/api/health in your browser. You should see:

```json
{"ok":true,"database":"Oracle"}
```

The backend root page may not exist until you build React. That is normal during development: the website runs on port 5173.

## 8. Start the frontend

Click the **+** in the VS Code terminal panel to open a second PowerShell terminal. Make sure it is also in the main `skybridge` folder.

```powershell
npm.cmd run client
```

Open **http://localhost:5173** in your browser. Use that exact address, even if Vite prints `127.0.0.1`. The allowed origin is configured as `localhost`.

Keep both terminals running. Ctrl+C stops the process in a terminal.

## 9. Try the full customer flow

1. Click Sign in → New here? Create an account.
2. Enter your name, your own email, a mobile number such as `+639171234567`, and a password of at least 10 characters.
3. The mobile field requires Philippine format: `+639` followed by nine digits.
4. Search for flights. Sample routes are Manila to Cebu, Davao, and Puerto Princesa.
5. Choose flight → enter the passenger name → Continue to demo payment.
6. Go to My bookings. You will see the reference and `AWAITING PAYMENT` status.
7. The demo QR contains text. It does not request a GCash transfer. Do not send money.
8. Create a simple sample image in Paint with the words `DEMO PAYMENT`, your booking reference, and the amount. Save it as PNG.
9. Upload that image. The status becomes `PENDING REVIEW`.
10. You can replace the proof or cancel the booking before approval.

Pending bookings do not reserve inventory. A seat is allocated only when an admin approves. If the last seat has already been allocated, the second approval is rejected. This choice is suitable for a dummy-payment project; a real payment system needs timed seat holds and refund handling.

## 10. Try the admin flow

Use an InPrivate/Incognito browser window to keep the customer session open separately.

1. Open http://localhost:5173.
2. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from Step 5.
3. Click Admin dashboard.
4. Open Flights → New schedule.
5. Choose an airline, flight number, airports, future departure/arrival, fare, and capacity.
6. Enter times in **Philippine time**. The backend stores UTC and the interface converts it back.
7. Save the schedule. It is immediately available to customers if its status is SCHEDULED.
8. Try Edit and Delete on a flight with no bookings. A flight with any booking history is protected from editing/deleting, so previous itineraries remain accurate.
9. Open Payments → View image to inspect the uploaded proof.
10. Click Approve, optionally enter a note, and click OK. Click Cancel in the note dialog to abort.
11. Return to the customer window and click Refresh. The booking is now CONFIRMED.
12. In the admin window, open Notifications, wait a few seconds, then Refresh.
13. In demo mode, email and SMS show `SIMULATED`. This means no external messages were sent.

Rejecting a proof closes that booking as REJECTED. To try again, create a new booking. Confirmed bookings cannot be cancelled in this starter; real cancellation/refund workflows are outside its scope.

## 11. Enable real email through Twilio SendGrid

You need a SendGrid account with sending access; account availability, trials, and limits depend on the provider. Do not assume a free plan is available.

1. Visit https://sendgrid.com/ and open your account dashboard.
2. Complete Sender Authentication. For classroom testing, verify a Single Sender email if your account permits it. Verify the email through the message sent to your inbox.
3. Create a restricted API key with **Mail Send** permission.
4. Save the key privately. Do not send it to ChatGPT or put it in screenshots.
5. In `server/.env`, set:

```dotenv
SENDGRID_API_KEY=YOUR_REAL_SENDGRID_API_KEY
EMAIL_FROM=your-verified-sender@example.com
```

Twilio SendGrid handles email. Twilio's separate Programmable Messaging service handles SMS. This project allows Semaphore SMS by default, or Twilio SMS as an alternative.

## 12. Enable real SMS through Semaphore

1. Visit https://semaphore.co/ and open your account dashboard.
2. Check account activation, SMS credit balance, and sender-name approval.
3. Copy the API key privately.
4. Use an active, registered sender name. Leaving the name blank only works if your account has a valid default sender.
5. In `server/.env`, set:

```dotenv
SMS_PROVIDER=semaphore
SEMAPHORE_API_KEY=YOUR_REAL_SEMAPHORE_KEY
SEMAPHORE_SENDER_NAME=YOUR_APPROVED_SENDER_NAME
```

“50 tokens” probably means SMS credits. The API key is the secret used to access the service; credits are the balance used to send SMS. Verify what your professor supplied. Long messages can use more than one SMS credit. This code does not assume or create 50 free credits.

## 13. Switch from demo to live notifications

After configuring email and your chosen SMS provider:

```dotenv
NOTIFICATION_MODE=live
```

Save `server/.env`, stop the backend with Ctrl+C, then restart:

```powershell
npm.cmd run server
```

Create and approve a **new** booking using your own recipient email and phone. Alternatively, in Notifications, Retry a SIMULATED record after checking the destination is your own. Live retries may spend credits.

Both email and SMS are attempted independently. If one fails, the booking stays confirmed and the failed channel can be retried after fixing its settings.

Notification meanings:

| Status | Meaning |
|---|---|
| QUEUED | Waiting for the background worker |
| PROCESSING | Request is being attempted |
| SIMULATED | Demo mode; nothing was sent |
| ACCEPTED | Provider accepted the request; delivery is not verified |
| FAILED | Request failed; inspect the note/provider account |
| UNKNOWN | Result uncertain, such as a timeout or interrupted send; check the provider before retrying |

Keep one backend process running. The worker checks the Oracle queue every three seconds. Delivery webhooks are not implemented. The provider dashboard is the source for final delivery status. Automatic retries after uncertain sends are deliberately avoided because they could duplicate messages.

## 14. Optional: use Twilio for SMS instead of Semaphore

Only do this if your professor wants Twilio SMS or you already have a suitable account.

1. Open https://www.twilio.com/console.
2. Obtain an SMS-capable sender and enable the destination country as required by your account.
3. Check trial recipient restrictions; trial accounts may require a verified destination.
4. Set the following in `server/.env`:

```dotenv
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=YOUR_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_AUTH_TOKEN
TWILIO_FROM=YOUR_SMS_CAPABLE_TWILIO_NUMBER
```

Restart the backend. `TWILIO_FROM` should be the actual sender authorized in your account, usually in `+` country-code format. The app uses only the SMS provider you select; it will not send the same confirmation through both SMS providers.

## 15. Verify your database and project

In SQL Developer, use the **SkyBridge** connection:

```sql
SELECT id, name, code FROM airlines;
SELECT id, flight_no, capacity, booked FROM flights;
SELECT reference, passenger_name, amount, status FROM bookings;
SELECT id, booking_id, channel, state, detail FROM notifications;
```

Run the included checks in a third terminal from the project root:

```powershell
npm.cmd test
npm.cmd run build
```

Optional Oracle check, once the database is configured:

```powershell
Set-Location server
node oracle-check.js
Set-Location ..
```

The Oracle check creates a temporary flight, checks the seat constraint and date binds, and rolls its test rows back. It does not prove every workflow or concurrent request case; follow `docs/TEST-CHECKLIST.md` too.

## 16. Files to edit in VS Code

| File | Purpose |
|---|---|
| `client/src/main.jsx` | All customer screens and admin dashboard |
| `client/src/style.css` | Layout, colours, responsive design |
| `client/vite.config.js` | Development proxy to backend |
| `server/index.js` | Express routes, booking transactions, admin actions |
| `server/db.js` | Oracle pool and transaction helper |
| `server/notifications.js` | Email/SMS providers and queue worker |
| `server/validation.js` | Input rules |
| `server/security.js` | Password hashing and session token hashing |
| `server/setup.js` | Creates schema and seeds initial records |
| `server/.env` | Your local secrets; never submit this file |
| `database/create-user.sql` | Oracle application user permissions |
| `database/schema.sql` | Oracle table definitions |
| `docs/SYSTEM-NOTES.md` | Architecture and transaction explanation |

## 17. Common errors and exact next checks

| Problem | What to do |
|---|---|
| `npm.ps1 cannot be loaded` | Use `npm.cmd`, as shown above. |
| `node` or `npm.cmd` not recognized | Install Node, then close and reopen VS Code. |
| ORA-01017 | Check DB_USER and DB_PASSWORD. Test the same login in SQL Developer. |
| ORA-65096 creating user | Connect SYSTEM to FREEPDB1/XEPDB1, not the root database service. |
| ORA-12514 / NJS-518 | Check service name and listener; verify your SQL Developer connection uses the same service. |
| ORA-12541 / connection refused | Start the Oracle database and listener Windows services; confirm port 1521. |
| ORA-00942 | Run setup-db using the intended project user and PDB. |
| ORA-01950 | SYSTEM must grant the project user a USERS tablespace quota as in Step 4. |
| NJS-116 / older password verifier | Ask the database admin to reset the application user's password with a supported verifier. Do not enable legacy authentication blindly. |
| Thin-mode compatibility error | This setup targets modern Oracle Free/XE 21c. Oracle 11g requires a different Thick-mode/client setup. |
| `Origin rejected` | Open http://localhost:5173; make APP_ORIGIN exactly match the browser origin. Restart the backend. |
| Frontend cannot connect | Start both terminals; verify http://localhost:3001/api/health. |
| Port 5173 already in use | Close the other frontend process. Vite intentionally does not silently switch ports. |
| Setup says tables exist | Do not rerun setup. Start the server with the existing database. |
| No flights | Clear date/airport filters. Seeded flights are only seven days after setup; create future schedules in admin. |
| Email fails | Check API permission, verified sender, account restrictions, and provider dashboard. |
| SMS fails | Check key, active sender, credit balance, recipient format, and provider dashboard. |
| Status remains SIMULATED | Set NOTIFICATION_MODE=live, configure providers, restart, then create/approve a new booking or retry the record. |
| Admin password changed in .env but login still uses old password | ADMIN_* fields only seed the initial account during setup; changing .env does not update an existing database user. |
| Proof upload rejected | Use JPEG/PNG, maximum 5 MB and 20 megapixels. HEIC and SVG are not supported. |

## 18. Save your school submission

Stop both servers before preparing your submission. Copy the project to a separate submission folder, then remove from that copy:

- `node_modules`
- `server/.env`
- `client/dist` if your professor wants source code only
- Any logs or real personal/payment images you added

Keep `.env.example`, all source code, SQL files, `package.json`, `package-lock.json`, and this guide. If you changed `create-user.sql` to contain a private password, replace it with an example before submitting. Zip the main `skybridge` folder.

Oracle data is stored in Oracle, not inside the project folder. The SQL schema and setup script allow a reviewer to recreate the demo database. If actual database records are required, ask your professor which Oracle export format to submit.

Suggested screenshots: customer home/search; created booking; payment proof submitted; admin flights CRUD; admin payment review; confirmed customer booking; email received; SMS received; Oracle tables. Hide keys, passwords, and unrelated personal details.

## Validation included with this delivery

See `docs/VALIDATION.md` for what was actually checked in the authoring environment. Your Windows installation, Oracle server, and provider accounts still need local verification. This is a classroom starter, not a production airline/payment system.
