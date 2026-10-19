-- Run as SYSTEM in the FREEPDB1 (or XEPDB1) service, NOT CDB$ROOT.
-- Change the password here AND in server/.env before running.
CREATE USER skybridge IDENTIFIED BY "123";
GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE TO skybridge;
ALTER USER skybridge QUOTA 100M ON USERS;
