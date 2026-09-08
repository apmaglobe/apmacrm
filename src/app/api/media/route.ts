import {NextRequest,NextResponse} from "next/server";
import {serverClient} from "@/lib/auth/server";
import {sameOrigin} from "@/lib/auth/origin";
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return new NextResponse(null,{status:403});
 if(Number(req.headers.get('content-length'))>1200000)return new NextResponse(null,{status:413});
 const db=await serverClient();const {data:{user}}=await db.auth.getUser();if(!user)return new NextResponse(null,{status:401});
 const form=await req.formData(),file=form.get('file'),org=String(form.get('org')??''),kind=form.get('kind');
 if(!(file instanceof File)||file.size>1048576||!['avatar','logo'].includes(String(kind)))return NextResponse.json({error:'PNG/JPEG/WebP faylı maksimum 1 MB olmalıdır.'},{status:400});
 const bytes=Buffer.from(await file.arrayBuffer());
 const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;
 if(!mime)return NextResponse.json({error:'Şəkil formatı qəbul edilmir.'},{status:400});
 const path=`${org}/${kind==='logo'?'logos/'+org:'avatars/'+user.id}/${crypto.randomUUID()}.${mime.split('/')[1]}`;
 const {error}=await db.storage.from('crm-private').upload(path,bytes,{contentType:mime,upsert:false});
 return NextResponse.json(error?{error:'Şəkil yüklənmədi. Səlahiyyəti və faylı yoxlayın.'}:{path},{status:error?403:200,headers:{'Cache-Control':'private, no-store'}});
}
export async function GET(req:NextRequest){
 const db=await serverClient();const org=req.nextUrl.searchParams.get('org'),member=req.nextUrl.searchParams.get('member');
 const {data:{user}}=await db.auth.getUser();if(!user)return new NextResponse(null,{status:401});
 let path:string|undefined;
 if(member){const {data}=await db.from('memberships').select('avatar_path').eq('organization_id',org).eq('id',member).single();path=data?.avatar_path;}
 else{const {data}=await db.from('organizations').select('logo_path').eq('id',org).single();path=data?.logo_path;}
 if(!path)return new NextResponse(null,{status:404});
 const {data,error}=await db.storage.from('crm-private').download(path);if(error||!data)return new NextResponse(null,{status:404});
 return new NextResponse(data,{headers:{'Content-Type':data.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
