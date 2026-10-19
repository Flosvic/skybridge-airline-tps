import {readFile} from 'node:fs/promises';
import {initDb,db,rows,oracledb} from './db.js';
import {hashPassword} from './security.js';
if(!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length<10) throw Error('Set ADMIN_PASSWORD in server/.env (10+ characters)');
await initDb();
try {
 const existing=await db(c=>rows(c,"SELECT table_name FROM user_tables WHERE table_name IN ('APP_USERS','FLIGHTS','BOOKINGS')"));
 if(existing.length) throw Error('Tables already exist. Setup stopped without deleting anything. Use your existing database; do not rerun setup.');
 const sql=await readFile(new URL('../database/schema.sql',import.meta.url),'utf8');
 await db(async c=>{for(const statement of sql.split(';').map(v=>v.trim()).filter(Boolean)) await c.execute(statement);});
 await db(async c=>{
 await c.execute("INSERT INTO app_users(name,email,phone,password_hash,role) VALUES(:n,:e,:p,:h,'ADMIN')",{n:process.env.ADMIN_NAME||'Admin',e:process.env.ADMIN_EMAIL.toLowerCase(),p:'+639000000000',h:await hashPassword(process.env.ADMIN_PASSWORD)});
 for(const [name,code] of [['AirAsia','Z2'],['Cebu Pacific','5J'],['Philippine Airlines','PR']]) await c.execute('INSERT INTO airlines(name,code) VALUES(:n,:c)',{n:name,c:code});
 const airlines=await rows(c,'SELECT id,code FROM airlines ORDER BY id');
 for(let day=1;day<=7;day++) for(let i=0;i<3;i++) {
 const dep=new Date();dep.setUTCDate(dep.getUTCDate()+day);dep.setUTCHours(1+i*3,0,0,0);
 await c.execute(`INSERT INTO flights(airline_id,flight_no,origin,destination,departure_at,arrival_at,fare,capacity) VALUES(:a,:f,'MNL',:d,:dep,:arr,:fare,180)`,{a:airlines[i].ID,f:airlines[i].CODE+' '+(120+i),d:['CEB','DVO','PPS'][i],dep,arr:new Date(dep.getTime()+90*60000),fare:[1899,2499,2199][i]});
 }
 });
 console.log('Created tables, admin and 21 sample flights. Dates shown in the app use Philippine time.');
}finally{await oracledb.getPool().close(0);}
