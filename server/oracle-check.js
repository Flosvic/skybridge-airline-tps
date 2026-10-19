// Optional integration check. Uses your configured Oracle database and rolls back test rows.
import {initDb,oracledb,rows} from './db.js';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
await initDb();
const c=await oracledb.getConnection();
try{
 const [a]=await rows(c,'SELECT id FROM airlines FETCH FIRST 1 ROW ONLY');
 const flightNo='T'+randomBytes(4).toString('hex').toUpperCase();
 const dep=new Date(Date.now()+2*86400000),arr=new Date(dep.getTime()+3600000);
 await c.execute("INSERT INTO flights(airline_id,flight_no,origin,destination,departure_at,arrival_at,fare,capacity) VALUES(:a,:n,'MNL','CEB',:d,:r,100,1)",{a:a.ID,n:flightNo,d:dep,r:arr});
 const [f]=await rows(c,'SELECT * FROM flights WHERE flight_no=:n FOR UPDATE',{n:flightNo});
 assert.equal(f.CAPACITY,1);assert.equal(f.BOOKED,0);
 await c.execute('UPDATE flights SET booked=booked+1 WHERE id=:id AND booked<capacity',{id:f.ID});
 const second=await c.execute('UPDATE flights SET booked=booked+1 WHERE id=:id AND booked<capacity',{id:f.ID});
 assert.equal(second.rowsAffected,0);
 await assert.rejects(()=>c.execute('UPDATE flights SET booked=2 WHERE id=:id',{id:f.ID}));
 console.log('PASS: Oracle connection, identity columns, date binds, row locks, and capacity constraints. Test rows rolled back.');
}finally{await c.rollback();await c.close();await oracledb.getPool().close(0);}
