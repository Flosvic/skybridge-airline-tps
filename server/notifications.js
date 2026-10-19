import {db,rows} from './db.js';
let running=false;
async function send(channel,b){
 const message=`SkyBridge DEMO: Booking ${b.REFERENCE} confirmed. ${b.FLIGHT_NO} ${b.ORIGIN}-${b.DESTINATION}. Check My bookings for details. Not a real ticket.`;
 const mode=process.env.NOTIFICATION_MODE;
 if(mode==='demo') return {state:'SIMULATED',detail:'Demo mode: no external message sent'};
 if(mode!=='live') throw Error('NOTIFICATION_MODE must be demo or live');
 const request=async(url,options)=>{
  let response;
  try{response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});}catch{const e=Error('Network result uncertain; check provider before retry');e.uncertain=true;throw e;}
  if(!response.ok) {const e=Error('Provider HTTP '+response.status+'; check provider dashboard');e.uncertain=response.status>=500;throw e;}
  return response;
 };
 if(channel==='EMAIL'){
  if(!process.env.SENDGRID_API_KEY||!process.env.EMAIL_FROM) throw Error('Set SendGrid API key and verified EMAIL_FROM');
  await request('https://api.sendgrid.com/v3/mail/send',{method:'POST',headers:{Authorization:'Bearer '+process.env.SENDGRID_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({personalizations:[{to:[{email:b.EMAIL}]}],from:{email:process.env.EMAIL_FROM},subject:'SkyBridge demo booking confirmation',content:[{type:'text/plain',value:message}]})});
 }else if(process.env.SMS_PROVIDER==='twilio'){
  const sid=process.env.TWILIO_ACCOUNT_SID;
  if(!sid||!process.env.TWILIO_AUTH_TOKEN||!process.env.TWILIO_FROM) throw Error('Set Twilio SMS credentials');
  await request(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(sid+':'+process.env.TWILIO_AUTH_TOKEN).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({To:b.PHONE,From:process.env.TWILIO_FROM,Body:message})});
 }else if(process.env.SMS_PROVIDER==='semaphore'){
  if(!process.env.SEMAPHORE_API_KEY) throw Error('Set SEMAPHORE_API_KEY');
  const body=new URLSearchParams({apikey:process.env.SEMAPHORE_API_KEY,number:b.PHONE.replace('+',''),message});
  if(process.env.SEMAPHORE_SENDER_NAME)body.set('sendername',process.env.SEMAPHORE_SENDER_NAME);
  const response=await request('https://api.semaphore.co/api/v4/messages',{method:'POST',body});
  const data=await response.json();
  if(!Array.isArray(data)||!data[0]?.message_id||['failed','refunded'].includes(String(data[0]?.status).toLowerCase())) throw Error('Semaphore did not accept the SMS; check account balance and sender');
 }else throw Error('SMS_PROVIDER must be semaphore or twilio');
 return {state:'ACCEPTED',detail:'Accepted by provider; delivery is not verified'};
}
export async function processNotifications(){
 if(running)return;running=true;
 try{
 const jobs=await db(c=>rows(c,"SELECT id,booking_id,channel FROM notifications WHERE state='QUEUED' ORDER BY id FETCH FIRST 10 ROWS ONLY"));
 for(const job of jobs){
  const claimed=await db(c=>c.execute("UPDATE notifications SET state='PROCESSING',updated_at=SYS_EXTRACT_UTC(SYSTIMESTAMP) WHERE id=:id AND state='QUEUED'",{id:job.ID}));
  if(!claimed.rowsAffected)continue;
  let result;
  try{
   const [b]=await db(c=>rows(c,`SELECT b.reference,u.email,u.phone,f.flight_no,f.origin,f.destination FROM bookings b JOIN app_users u ON u.id=b.user_id JOIN flights f ON f.id=b.flight_id WHERE b.id=:id`,{id:job.BOOKING_ID}));
   result=await send(job.CHANNEL,b);
  }catch(e){result={state:e.uncertain?'UNKNOWN':'FAILED',detail:e.message.slice(0,250)};}
  await db(c=>c.execute('UPDATE notifications SET state=:s,detail=:d,updated_at=SYS_EXTRACT_UTC(SYSTIMESTAMP) WHERE id=:id',{s:result.state,d:result.detail,id:job.ID}));
 }
 }catch(e){console.error('Notification worker:',e.code||'Database unavailable');}finally{running=false;}
}
