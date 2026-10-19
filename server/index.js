import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import sharp from 'sharp';
import QRCode from 'qrcode';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {initDb,db,rows,oracledb} from './db.js';
import {hashPassword,verifyPassword,newToken,tokenHash} from './security.js';
import {registration,credentials,flightInput,bookingInput,airports,canConfirm} from './validation.js';
import {processNotifications} from './notifications.js';
const app=express();
const port=Number(process.env.PORT||3001);
const origin=process.env.APP_ORIGIN||'http://localhost:5173';
app.use(helmet());app.use(express.json({limit:'30kb'}));
app.use('/api',rateLimit({windowMs:60000,limit:150,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many requests. Try again in a minute.'}}));
app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!==origin)return res.status(403).json({error:'Origin rejected. Open the APP_ORIGIN URL in your browser.'});next();});
const authLimit=rateLimit({windowMs:15*60000,limit:30,message:{error:'Too many login attempts. Wait 15 minutes.'}});
const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};
const id=v=>z.coerce.number().int().positive().parse(v);
const publicUser=u=>({id:u.ID,name:u.NAME,email:u.EMAIL,phone:u.PHONE,role:u.ROLE});
const cookieOptions={httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:8*3600000};
async function session(req,res,u){const token=newToken();await db(c=>c.execute('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES(:t,:u,:e)',{t:tokenHash(token),u:u.ID,e:new Date(Date.now()+8*3600000)}));res.cookie('skybridge_session',token,cookieOptions);return publicUser(u);}
app.use('/api',async(req,res,next)=>{
 const raw=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('skybridge_session='))?.split('=')[1];
 if(raw&&/^[a-f0-9]{64}$/.test(raw)){
  req.sessionHash=tokenHash(raw);
  [req.user]=await db(c=>rows(c,`SELECT u.* FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=:t AND s.expires_at>SYS_EXTRACT_UTC(SYSTIMESTAMP)`,{t:req.sessionHash}));
 }next();
});
function auth(req,res,next){if(!req.user)return res.status(401).json({error:'Please sign in.'});next();}
function admin(req,res,next){if(req.user?.ROLE!=='ADMIN')return res.status(403).json({error:'Admin access required.'});next();}
app.get('/api/health',async(req,res)=>{await db(c=>rows(c,'SELECT 1 FROM dual'));res.json({ok:true,database:'Oracle'});});
app.get('/api/me',(req,res)=>res.json(req.user?publicUser(req.user):null));
app.post('/api/register',authLimit,async(req,res)=>{
 const v=registration.parse(req.body),hash=await hashPassword(v.password);
 const user=await db(async c=>{await c.execute('INSERT INTO app_users(name,email,phone,password_hash) VALUES(:n,:e,:p,:h)',{n:v.name,e:v.email,p:v.phone,h:hash});return (await rows(c,'SELECT * FROM app_users WHERE email=:e',{e:v.email}))[0];});
 res.status(201).json(await session(req,res,user));
});
app.post('/api/login',authLimit,async(req,res)=>{const v=credentials.parse(req.body);const [u]=await db(c=>rows(c,'SELECT * FROM app_users WHERE email=:e',{e:v.email}));if(!u||!await verifyPassword(v.password,u.PASSWORD_HASH))fail(401,'Incorrect email or password.');res.json(await session(req,res,u));});
app.post('/api/logout',async(req,res)=>{if(req.sessionHash)await db(c=>c.execute('DELETE FROM app_sessions WHERE token_hash=:t',{t:req.sessionHash}));res.clearCookie('skybridge_session',{path:'/'});res.json({ok:true});});
app.get('/api/meta',async(req,res)=>res.json({airports,airlines:await db(c=>rows(c,'SELECT * FROM airlines ORDER BY id'))}));
const flightSelect=`SELECT f.id,f.airline_id,a.name airline,f.flight_no,f.origin,f.destination,
 TO_CHAR(f.departure_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') departure_at,
 TO_CHAR(f.arrival_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') arrival_at,
 f.fare,f.capacity,f.booked,f.capacity-f.booked available,f.status FROM flights f JOIN airlines a ON a.id=f.airline_id`;
app.get('/api/flights',async(req,res)=>res.json(await db(c=>rows(c,flightSelect+" WHERE f.status='SCHEDULED' AND f.departure_at>SYS_EXTRACT_UTC(SYSTIMESTAMP) ORDER BY f.departure_at"))));
const bookingSelect=`SELECT b.id,b.reference,b.passenger_name,b.amount,b.status,b.review_note,b.user_id,b.flight_id,
 TO_CHAR(b.created_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') created_at,
 u.name customer_name,u.email,u.phone,a.name airline,f.flight_no,f.origin,f.destination,
 TO_CHAR(f.departure_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') departure_at,
 CASE WHEN p.booking_id IS NULL THEN 0 ELSE 1 END has_proof
 FROM bookings b JOIN app_users u ON u.id=b.user_id JOIN flights f ON f.id=b.flight_id JOIN airlines a ON a.id=f.airline_id LEFT JOIN payment_proofs p ON p.booking_id=b.id`;
app.get('/api/bookings',auth,async(req,res)=>res.json(await db(c=>rows(c,bookingSelect+' WHERE b.user_id=:u ORDER BY b.id DESC',{u:req.user.ID}))));
app.post('/api/bookings',auth,async(req,res)=>{
 const v=bookingInput.parse(req.body);
 const b=await db(async c=>{
  const [f]=await rows(c,'SELECT * FROM flights WHERE id=:id FOR UPDATE',{id:v.flight_id});
  if(!f||f.STATUS!=='SCHEDULED'||f.DEPARTURE_AT<=new Date())fail(409,'Flight is unavailable.');
  if(f.BOOKED>=f.CAPACITY)fail(409,'Flight is sold out.');
  const ref='SB-'+randomBytes(6).toString('hex').toUpperCase();
  await c.execute('INSERT INTO bookings(reference,user_id,flight_id,passenger_name,amount) VALUES(:r,:u,:f,:n,:a)',{r:ref,u:req.user.ID,f:f.ID,n:v.passenger_name,a:f.FARE});
  return (await rows(c,bookingSelect+' WHERE b.reference=:r',{r:ref}))[0];
 });res.status(201).json(b);
});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0}});
app.post('/api/bookings/:id/proof',auth,upload.single('proof'),async(req,res)=>{
 if(!req.file)fail(400,'Choose a PNG or JPEG image, up to 5 MB.');
 let image;
 try{const decoder=sharp(req.file.buffer,{limitInputPixels:20000000});const meta=await decoder.metadata();if(!['png','jpeg'].includes(meta.format))fail(400,'Use a PNG or JPEG image.');image=await decoder.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).png().toBuffer();}catch{fail(400,'Invalid image. Use a PNG/JPEG up to 5 MB and 20 megapixels.');}
 await db(async c=>{
  const [b]=await rows(c,'SELECT * FROM bookings WHERE id=:id AND user_id=:u FOR UPDATE',{id:id(req.params.id),u:req.user.ID});
  if(!b)fail(404,'Booking not found.');if(!['AWAITING_PAYMENT','PENDING_REVIEW'].includes(b.STATUS))fail(409,'This booking cannot accept payment proof.');
  await c.execute('DELETE FROM payment_proofs WHERE booking_id=:id',{id:b.ID});
  await c.execute('INSERT INTO payment_proofs(booking_id,image_data) VALUES(:id,:img)',{id:b.ID,img:{val:image,type:oracledb.BLOB}});
  await c.execute("UPDATE bookings SET status='PENDING_REVIEW' WHERE id=:id",{id:b.ID});
 });res.json({ok:true});
});
app.get('/api/bookings/:id/proof',auth,async(req,res)=>{
 const [b]=await db(c=>rows(c,'SELECT p.image_data,b.user_id FROM payment_proofs p JOIN bookings b ON b.id=p.booking_id WHERE b.id=:id',{id:id(req.params.id)}));
 if(!b||(b.USER_ID!==req.user.ID&&req.user.ROLE!=='ADMIN'))fail(404,'Proof not found.');res.type('png').send(b.IMAGE_DATA);
});
app.post('/api/bookings/:id/cancel',auth,async(req,res)=>{await db(async c=>{const result=await c.execute("UPDATE bookings SET status='CANCELLED' WHERE id=:id AND user_id=:u AND status IN ('AWAITING_PAYMENT','PENDING_REVIEW')",{id:id(req.params.id),u:req.user.ID});if(!result.rowsAffected)fail(409,'Only your pending bookings can be cancelled.');});res.json({ok:true});});
app.get('/api/demo-qr',async(req,res)=>res.type('png').send(await QRCode.toBuffer('SKYBRIDGE SCHOOL DEMO - NOT A PAYMENT QR - DO NOT TRANSFER MONEY',{width:240,margin:2})));
app.get('/api/admin/flights',auth,admin,async(req,res)=>res.json(await db(c=>rows(c,flightSelect+' ORDER BY f.departure_at DESC'))));
function flightBinds(v){return {a:v.airline_id,n:v.flight_no,o:v.origin,d:v.destination,dep:new Date(v.departure_at),arr:new Date(v.arrival_at),fare:v.fare,cap:v.capacity,s:v.status};}
app.post('/api/admin/flights',auth,admin,async(req,res)=>{const v=flightInput.parse(req.body);await db(c=>c.execute('INSERT INTO flights(airline_id,flight_no,origin,destination,departure_at,arrival_at,fare,capacity,status) VALUES(:a,:n,:o,:d,:dep,:arr,:fare,:cap,:s)',flightBinds(v)));res.status(201).json({ok:true});});
app.put('/api/admin/flights/:id',auth,admin,async(req,res)=>{
 const v=flightInput.parse(req.body),fid=id(req.params.id);
 await db(async c=>{
  const [f]=await rows(c,'SELECT id FROM flights WHERE id=:id FOR UPDATE',{id:fid});if(!f)fail(404,'Flight not found.');
  const [count]=await rows(c,'SELECT COUNT(*) total FROM bookings WHERE flight_id=:id',{id:fid});
  if(count.TOTAL)fail(409,'This flight has bookings. To protect existing itineraries, edits are disabled. Create a new schedule instead.');
  await c.execute('UPDATE flights SET airline_id=:a,flight_no=:n,origin=:o,destination=:d,departure_at=:dep,arrival_at=:arr,fare=:fare,capacity=:cap,status=:s WHERE id=:id',{...flightBinds(v),id:fid});
 });res.json({ok:true});
});
app.delete('/api/admin/flights/:id',auth,admin,async(req,res)=>{await db(async c=>{const r=await c.execute('DELETE FROM flights WHERE id=:id',{id:id(req.params.id)});if(!r.rowsAffected)fail(404,'Flight not found.');});res.json({ok:true});});
app.get('/api/admin/bookings',auth,admin,async(req,res)=>res.json(await db(c=>rows(c,bookingSelect+' ORDER BY b.id DESC'))));
app.post('/api/admin/bookings/:id/review',auth,admin,async(req,res)=>{
 const v=z.object({decision:z.enum(['approve','reject']),note:z.string().trim().max(500).default('')}).parse(req.body);
 await db(async c=>{
  const [b]=await rows(c,'SELECT * FROM bookings WHERE id=:id FOR UPDATE',{id:id(req.params.id)});if(!b)fail(404,'Booking not found.');
  if(b.STATUS!=='PENDING_REVIEW')fail(409,'This booking is not pending review.');
  const [proof]=await rows(c,'SELECT booking_id FROM payment_proofs WHERE booking_id=:id',{id:b.ID});if(!proof)fail(409,'Payment proof is required.');
  if(v.decision==='approve'){
   const [f]=await rows(c,'SELECT * FROM flights WHERE id=:id FOR UPDATE',{id:b.FLIGHT_ID});
   if(f.STATUS!=='SCHEDULED'||!canConfirm(b.STATUS,f.CAPACITY-f.BOOKED,f.DEPARTURE_AT))fail(409,'No seats available, or the flight has departed. Reject this demo payment instead.');
   await c.execute('UPDATE flights SET booked=booked+1 WHERE id=:id',{id:f.ID});
   for(const channel of ['EMAIL','SMS'])await c.execute('INSERT INTO notifications(booking_id,channel) VALUES(:id,:ch)',{id:b.ID,ch:channel});
  }
  await c.execute('UPDATE bookings SET status=:s,reviewed_by=:u,reviewed_at=SYS_EXTRACT_UTC(SYSTIMESTAMP),review_note=:n WHERE id=:id',{s:v.decision==='approve'?'CONFIRMED':'REJECTED',u:req.user.ID,n:v.note||null,id:b.ID});
 });res.json({ok:true});
});
app.get('/api/admin/notifications',auth,admin,async(req,res)=>res.json(await db(c=>rows(c,'SELECT n.id,b.reference,n.channel,n.state,n.detail FROM notifications n JOIN bookings b ON b.id=n.booking_id ORDER BY n.id DESC'))));
app.post('/api/admin/notifications/:id/retry',auth,admin,async(req,res)=>{await db(async c=>{const r=await c.execute("UPDATE notifications SET state='QUEUED',detail=NULL WHERE id=:id AND state IN ('FAILED','SIMULATED','UNKNOWN')",{id:id(req.params.id)});if(!r.rowsAffected)fail(409,'This notification cannot be retried.');});res.json({ok:true});});
app.use('/api',(req,res)=>res.status(404).json({error:'API route not found'}));
app.use(express.static(fileURLToPath(new URL('../client/dist',import.meta.url))));
app.get('/{*path}',(req,res)=>res.sendFile(fileURLToPath(new URL('../client/dist/index.html',import.meta.url))));
app.use((e,req,res,next)=>{
 if(e instanceof z.ZodError)return res.status(400).json({error:e.issues.map(v=>v.message).join('; ')});
 if(e.code==='LIMIT_FILE_SIZE')return res.status(400).json({error:'Image must be 5 MB or smaller.'});
 if(e instanceof multer.MulterError)return res.status(400).json({error:'Upload one image in the proof field.'});
 if(e.errorNum===1)return res.status(409).json({error:'Email or flight schedule already exists.'});
 if([2291,2292].includes(e.errorNum))return res.status(409).json({error:'Related records prevent this change. Flights with bookings cannot be deleted.'});
 console.error('Request error:',e.code||e.status||'Unexpected failure');
 res.status(e.status||500).json({error:e.status?e.message:'Server error. Check the backend terminal and Oracle connection.'});
});
await initDb();
// Single server process: interrupted external sends must be checked before retry.
await db(c=>c.execute("UPDATE notifications SET state='UNKNOWN',detail='Server restarted during send. Check provider before retry.' WHERE state='PROCESSING'"));
const timer=setInterval(processNotifications,3000);
const server=app.listen(port,'127.0.0.1',()=>console.log(`SkyBridge API: http://localhost:${port} | Oracle connected | notifications: ${process.env.NOTIFICATION_MODE}`));
process.on('SIGINT',()=>{clearInterval(timer);server.close(async()=>{await oracledb.getPool().close(10);process.exit(0);});});
