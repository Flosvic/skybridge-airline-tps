# Validation report

## Passed in the authoring environment

- npm package installation, with a package-lock.json supplied for reproducible installs.
- React production build: `npm run build`.
- Backend JavaScript syntax check: `node --check server/index.js`.
- Five automated tests: valid flight/account inputs; invalid itineraries/fares/capacities; confirmation preconditions; password/phone validation; salted password hashing and verification.

## Not completed here

- Browser visual/interaction testing: the browser binary download failed. Responsive CSS is included, but visual testing is not claimed.
- Oracle integration: no running user Oracle instance was available. Run the supplied local Oracle check and acceptance checklist.
- Live SendGrid, Semaphore, or Twilio API sends: credentials and authorized recipient accounts were not supplied. No external messages were sent.
- End-to-end Windows setup and simultaneous last-seat approval: must be checked locally.

The tests do not establish that the whole system is error-free. Provider account settings, Oracle installation/version, and local network configuration still matter.
