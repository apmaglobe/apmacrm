import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/auth/server";
import { serviceClient } from "@/lib/auth/service";
import { sameOrigin } from "@/lib/auth/origin";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return new NextResponse(null,{status:403});
  const db=await serverClient();
  const {data:{user}}=await db.auth.getUser();
  if (!user) return new NextResponse(null,{status:401});
  const body=await req.json().catch(()=>null);
  if (!body?.org || !body?.id) return new NextResponse(null,{status:400});
  const {data:job}=await db.from("export_jobs").select("id,status").eq("organization_id",body.org).eq("id",body.id).eq("user_id",user.id).single();
  if (!job) return new NextResponse(null,{status:403});
  // This awaited DB worker is only an accelerator. Cron resumes durable queued jobs even after the browser closes.
  if (job.status==="queued") await serviceClient().rpc("process_exports");
  const {data,error}=await db.from("export_jobs").select("id,status,last_error,expires_at,module,format").eq("id",job.id).single();
  return NextResponse.json(error?{error:"EXPORT_STATUS_FAILED"}:data,{status:error?400:200,headers:{"Cache-Control":"private, no-store"}});
}
export async function GET(req:NextRequest){
  const db=await serverClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user) return new NextResponse(null,{status:401});
  const org=req.nextUrl.searchParams.get("org");
  const {data,error}=await db.from("export_jobs").select("id,status,last_error,expires_at,module,format,created_at").eq("organization_id",org).eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);
  return NextResponse.json(error?{error:"EXPORT_STATUS_FAILED"}:data,{status:error?400:200,headers:{"Cache-Control":"private, no-store"}});
}
