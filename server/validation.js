import {z} from 'zod';
export const airports=['MNL','CEB','DVO','ILO','PPS','TAG','CRK','KLO'];
export const credentials=z.object({email:z.email().max(254).transform(v=>v.toLowerCase()),password:z.string().min(10).max(128)});
export const registration=credentials.extend({name:z.string().trim().min(2).max(100),phone:z.string().regex(/^\+639\d{9}$/, 'Use +639 followed by 9 digits')});
export const flightInput=z.object({airline_id:z.coerce.number().int().positive(),flight_no:z.string().trim().regex(/^[A-Z0-9 -]{2,12}$/),origin:z.enum(airports),destination:z.enum(airports),departure_at:z.iso.datetime({offset:true}),arrival_at:z.iso.datetime({offset:true}),fare:z.coerce.number().positive().max(99999999),capacity:z.coerce.number().int().min(1).max(999),status:z.enum(['SCHEDULED','CANCELLED'])}).refine(v=>v.origin!==v.destination,{message:'Choose different airports'}).refine(v=>new Date(v.arrival_at)>new Date(v.departure_at),{message:'Arrival must be after departure'}).refine(v=>new Date(v.departure_at)>new Date(),{message:'Departure must be in the future'});
export const bookingInput=z.object({flight_id:z.coerce.number().int().positive(),passenger_name:z.string().trim().min(2).max(100)});
export function utcDate(v){return new Date(v);}
export function canConfirm(status,available,departure){return status==='PENDING_REVIEW'&&available>0&&new Date(departure)>new Date();}
