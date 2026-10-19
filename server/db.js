import 'dotenv/config';
import oracledb from 'oracledb';
// Oracle TIMESTAMP columns hold UTC; the UI converts explicitly to Philippine time.
process.env.TZ = 'UTC';
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsBuffer = [oracledb.BLOB];
export async function initDb() {
 await oracledb.createPool({user:process.env.DB_USER,password:process.env.DB_PASSWORD,connectString:process.env.DB_CONNECT_STRING,poolMin:1,poolMax:8,poolIncrement:1});
}
export async function db(fn) {
 const c=await oracledb.getConnection();
 try { const result=await fn(c); await c.commit(); return result; }
 catch(e){await c.rollback();throw e;} finally{await c.close();}
}
export async function rows(c,sql,binds={}) {return (await c.execute(sql,binds)).rows;}
export {oracledb};
