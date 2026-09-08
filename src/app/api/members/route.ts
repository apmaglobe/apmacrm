import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin } from "@/lib/auth/origin";
import { serverClient } from "@/lib/auth/server";
import { serviceClient } from "@/lib/auth/service";
export const dynamic = "force-dynamic";
const input=z.object({org:z.uuid(),request_id:z.uuid(),name:z.string().trim().min(1).max(120),email:z.email().max(254).transform(s=>s.toLowerCase().trim()),password:z.string().min(10).max(128),role_id:z.uuid().nullable(),departments:z.array(z.uuid()).max(30).transform(a=>[...new Set(a)].sort())}).strict();
const messages:Record<string,string>={ACCOUNT_ALREADY_EXISTS:"Bu email ilə hesab artıq var. Mövcud hesabın parolu dəyişdirilmir; dəvət keçidindən istifadə edin.",IDEMPOTENCY_CONFLICT:"Bu əməliyyat artıq başqa məlumatla başlayıb. Pəncərəni bağlayıb yenidən açın.",ADMIN_REQUIRED:"Aktiv admin girişi və TOTP təsdiqi tələb olunur.",INVALID_ROLE:"Rol bu agentliyə aid deyil.",INVALID_DEPARTMENT:"Departament bu agentliyə aid deyil.",MEMBER_RATE_LIMIT:"Bir saatlıq əlavə etmə limitinə çatılıb."};
function reject(code:string,status=400){return NextResponse.json({error:messages[code]??"Əməkdaş əlavə edilə bilmədi. Məlumatları yoxlayıb eyni formada yenidən sınayın.",code},{status,headers:{"Cache-Control":"private, no-store"}});}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return reject("ORIGIN_DENIED",403);
 // Do not persist or log a request body containing the initial password.
 if(Number(req.headers.get("content-length"))>8192)return reject("BODY_LIMIT",413);
 let body:unknown=null;
 if(req.body){const reader=req.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return reject("BODY_LIMIT",413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}body=JSON.parse(new TextDecoder().decode(bytes));}catch{return reject("INVALID_BODY",400);}finally{reader.releaseLock();}
 }
 const parsed=input.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:"Ad, email, minimum 10 simvolluq parol və düzgün departament seçin."},{status:400});
 const {org,request_id,password,...payload}=parsed.data;
 const db=await serverClient();const {data:{user}}=await db.auth.getUser();if(!user)return reject("AUTH_REQUIRED",401);
 const prepared=await db.rpc("prepare_member",{org,request_id,payload});
 if(prepared.error)return reject(prepared.error.message,prepared.error.code==="42501"?403:409);
 const job=prepared.data as {id:string;auth_user_id:string;completed:boolean;member_id?:string};
 if(job.completed)return NextResponse.json({id:job.member_id,completed:true},{headers:{"Cache-Control":"private, no-store"}});
 const service=serviceClient();
 // A retry must never overwrite an existing password or attach an unrelated Auth identity.
 let existing=await service.auth.admin.getUserById(job.auth_user_id);
 if(!existing.data.user){
  const created=await service.auth.admin.createUser({id:job.auth_user_id,email:payload.email,password,email_confirm:true,app_metadata:{apma_provisioning_id:job.id},user_metadata:{name:payload.name}});
  if(created.error){
   existing=await service.auth.admin.getUserById(job.auth_user_id);
   if(!existing.data.user)return reject(created.error.code==="email_exists"?"ACCOUNT_ALREADY_EXISTS":"AUTH_CREATE_FAILED",409);
  }else existing=created;
 }
 if(existing.data.user?.app_metadata.apma_provisioning_id!==job.id||existing.data.user.email?.toLowerCase()!==payload.email)return reject("AUTH_IDENTITY_CONFLICT",409);
 const completed=await db.rpc("complete_member",{org,job:job.id});
 if(completed.error)return reject(completed.error.message,completed.error.code==="42501"?403:409);
 return NextResponse.json(completed.data,{headers:{"Cache-Control":"private, no-store"}});
}
