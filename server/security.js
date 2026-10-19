import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');return salt+':'+(await derive(password,salt,64)).toString('hex');}
export async function verifyPassword(password,hash){const [salt,key]=hash.split(':');const check=await derive(password,salt,64);return timingSafeEqual(check,Buffer.from(key,'hex'));}
export const tokenHash=t=>createHash('sha256').update(t).digest('hex');
export const newToken=()=>randomBytes(32).toString('hex');
