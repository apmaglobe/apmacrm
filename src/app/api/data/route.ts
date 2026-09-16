import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/auth/server";
export const dynamic = "force-dynamic";
const tables: Record<string, string[]> = {
  crm: ["pipeline_stages"],
  todo: ["work_items", "deal_cards"],
  tasks: ["internal_tasks", "internal_task_assignments", "internal_task_updates"],
  marketing: ["marketing_plans", "marketing_plan_items", "deals"],
  map: ["customers", "customer_locations", "contacts", "import_jobs"],
  tools: ["tools", "tool_units", "tool_reservations"],
  finance: [
    "financial_documents",
    "payments",
    "payment_allocations",
    "financial_accounts",
  ],
  inbox: ["notifications", "conversations", "conversation_members", "messages"],
  overview: ["pipeline_stages"],
  portfolio: ["portfolio_items", "deal_cards"],
  drive: ["resource_links", "deal_cards"],
  subscriptions: [
    "service_contracts",
    "contract_revisions",
    "contract_periods",
  ],
  meetings: ["meetings", "meeting_participants"],
  users: [
    "memberships",
    "roles",
    "departments",
    "department_members",
    "service_catalog",
    "catalog_prices",
    "loss_reasons",
    "job_runs",
    "webhook_endpoints",
    "webhook_events",
    "pipeline_stages",
  ],
};
export async function GET(req: NextRequest) {
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const org = req.nextUrl.searchParams.get("org");
  const section = req.nextUrl.searchParams.get("module") ?? "crm";
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 120);
  const id = req.nextUrl.searchParams.get("id");
  if (!org || !tables[section])
    return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  const { data: member } = await db
    .from("memberships")
    .select("*")
    .eq("organization_id", org)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!member)
    return NextResponse.json({ error: "ACCESS_DENIED" }, { status: 403 });
  if (section === "tasks") {
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);
    const from = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
    let query = (db as any)
      .from("internal_tasks")
      .select("*")
      .eq("organization_id", org)
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .range(from, from + 199);
    if (q) query = query.ilike("title", "%" + q.replace(/[%_]/g, "") + "%");
    const taskResult = await query;
    if (taskResult.error) return NextResponse.json({ error: "TASKS_FAILED" }, { status: 400 });
    const ids = taskResult.data.map((task: { id: string }) => task.id);
    const [assignments, updates] = await Promise.all([
      ids.length ? (db as any).from("internal_task_assignments").select("*").eq("organization_id", org).in("task_id", ids) : { data: [], error: null },
      ids.length ? (db as any).from("internal_task_updates").select("*").eq("organization_id", org).in("task_id", ids).order("created_at", { ascending: false }) : { data: [], error: null },
    ]);
    if (assignments.error || updates.error) return NextResponse.json({ error: "TASK_DETAILS_FAILED" }, { status: 400 });
    return NextResponse.json({
      data: { internal_tasks: taskResult.data, internal_task_assignments: assignments.data, internal_task_updates: updates.data, memberships: (await db.from("memberships").select("*").eq("organization_id", org)).data ?? [], roles: (await db.from("roles").select("*").eq("organization_id", org)).data ?? [] },
      member,
      hasMore: taskResult.data.length === 200,
    }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (section === "marketing") {
    let plans = (db as any).from("marketing_plans").select("*").eq("organization_id", org).neq("status", "archived").order("updated_at", {ascending:false});
    if (q) plans=plans.ilike("title", "%"+q.replace(/[%_]/g, "")+"%");
    const planResult=await plans;
    if(planResult.error)return NextResponse.json({error:"MARKETING_PLANS_FAILED"},{status:400});
    const ids=planResult.data.map((plan:{id:string})=>plan.id);
    const dealIds=[...new Set(planResult.data.map((plan:{deal_id:string|null})=>plan.deal_id).filter((id:string|null):id is string=>!!id))];
    const customerIds=[...new Set(planResult.data.map((plan:{customer_id:string|null})=>plan.customer_id).filter((id:string|null):id is string=>!!id))];
    const [itemResult,dealsResult,membersResult,departmentsResult,customersResult]=await Promise.all([
      ids.length?(db as any).from("marketing_plan_items").select("*").eq("organization_id",org).in("plan_id",ids).eq("archived",false).order("due_at",{ascending:true,nullsFirst:false}):{data:[],error:null},
      dealIds.length?(db as any).from("deals").select("*").eq("organization_id",org).in("id",dealIds):{data:[],error:null},
      db.from("memberships").select("*").eq("organization_id",org),
      db.from("departments").select("*").eq("organization_id",org),
      customerIds.length?db.from("customers").select("*").eq("organization_id",org).in("id",customerIds):{data:[],error:null},
    ]);
    if(itemResult.error||dealsResult.error||membersResult.error||departmentsResult.error||customersResult.error) {
      console.error("MARKETING_DETAILS_FAILED", {plans:planResult.error?.message, items:itemResult.error?.message, deals:dealsResult.error?.message, members:membersResult.error?.message, departments:departmentsResult.error?.message, customers:customersResult.error?.message});
      return NextResponse.json({error:"MARKETING_DETAILS_FAILED"},{status:400});
    }
    return NextResponse.json({data:{marketing_plans:planResult.data,marketing_plan_items:itemResult.data,deals:dealsResult.data,memberships:membersResult.data,departments:departmentsResult.data,customers:customersResult.data},member,hasMore:false},{headers:{"Cache-Control":"private, no-store"}});
  }
  if (section === "map" && req.nextUrl.searchParams.get("all_locations") === "1") {
    const customers = await db
      .from("customers")
      .select("id,name")
      .eq("organization_id", org)
      .eq("archived", false)
      .order("name")
      .limit(2500);
    if (customers.error) return NextResponse.json({ error: "CUSTOMERS_FAILED" }, { status: 400 });
    const ids = customers.data.map((customer) => customer.id);
    const locations = ids.length
      ? await db.from("customer_locations").select("id,customer_id,name,address,latitude,longitude,version").eq("organization_id", org).eq("archived",false).in("customer_id", ids).not("latitude", "is", null).not("longitude", "is", null).limit(5000)
      : { data: [], error: null };
    if (locations.error) return NextResponse.json({ error: "LOCATIONS_FAILED" }, { status: 400 });
    return NextResponse.json({ customers: customers.data, locations: locations.data }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if(section==="users"&&req.nextUrl.searchParams.get("activity")) {
    const target=req.nextUrl.searchParams.get("activity");
    const memberResult=await db.from("memberships").select("id,user_id,name").eq("organization_id",org).eq("id",target).maybeSingle();
    if(!memberResult.data)return new NextResponse(null,{status:404});
    const offset=Number(req.nextUrl.searchParams.get("offset")??0);const start=Number.isSafeInteger(offset)&&offset>=0?offset:0;
    const [work,events]=await Promise.all([
      db.from("work_items").select("*").eq("organization_id",org).eq("assignee_id",target).eq("archived",false).order("due_at",{nullsFirst:false}).order("id").range(start,start+199),
      db.from("audit_events").select("id,deal_id,action,created_at,reason").eq("organization_id",org).eq("actor_id",memberResult.data.user_id).order("created_at",{ascending:false}).order("id").range(start,start+199)
    ]);
    if(work.error||events.error)return new NextResponse(null,{status:400});
    return NextResponse.json({works:work.data,events:events.data,hasMore:work.data.length===200||events.data.length===200},{headers:{"Cache-Control":"private, no-store"}});
  }
  if(req.nextUrl.searchParams.get("lookup")==="deals"){
    let query=db.from("deals").select("id,title,serial").eq("organization_id",org).eq("archived",false).order("created_at",{ascending:false}).limit(30);
    if(q)query=query.ilike("title","%"+q.replace(/[%_]/g,"")+"%");if(id)query=query.eq("id",id);
    const r=await query;if(r.error)return new NextResponse(null,{status:400});return NextResponse.json(r.data.map(d=>({id:d.id,name:(d.title||d.serial)+" · "+d.serial})),{headers:{"Cache-Control":"private, no-store"}});
  }
  if (req.nextUrl.searchParams.get("lookup") === "customers") {
    let query = db
      .from("customers")
      .select("id,name")
      .eq("organization_id", org)
      .eq("archived", false)
      .order("name")
      .limit(30);
    if (q) query = query.ilike("name", "%" + q.replace(/[%_]/g, "") + "%");
    if (id) query = query.eq("id", id);
    const result = await query;
    if (result.error)
      return NextResponse.json({ error: "LOOKUP_FAILED" }, { status: 400 });
    return NextResponse.json(result.data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (section === "crm" && req.nextUrl.searchParams.get("board") === "1") {
    let filters:Record<string,unknown>={},cursors:Record<string,unknown>={};
    try {filters=JSON.parse(req.nextUrl.searchParams.get("filters")??"{}");cursors=JSON.parse(req.nextUrl.searchParams.get("cursors")??"{}");}catch{return NextResponse.json({error:"INVALID_FILTER"},{status:400});}
    const result=await db.rpc("board_filtered",{org,which_pipeline:req.nextUrl.searchParams.get("pipeline")??"sales",search:q??"",filters,cursors});
    if (result.error)
      return NextResponse.json(
        { error: "BOARD_QUERY_FAILED" },
        { status: 400 },
      );
    const rows = result.data.rows as {customer_id?:string;customer_name?:string}[];
    const customerIds = [...new Set(rows.map(r=>r.customer_id).filter((v):v is string=>!!v))];
    if(customerIds.length){
      const customers=await db.from("customers").select("id,name").eq("organization_id",org).in("id",customerIds);
      if(customers.error) return NextResponse.json({error:"LOOKUP_FAILED"},{status:400});
      for(const row of rows) row.customer_name=customers.data?.find(c=>c.id===row.customer_id)?.name;
    }
    return NextResponse.json(result.data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  const selected =
    id && section === "crm"
      ? [
          "deals",
          "work_items",
          "work_prices",
          "deal_members",
          "deal_comments",
          "audit_events",
          "resource_links",
          "financial_documents",
          "payments",
          "payment_allocations",
        ]
      : tables[section];
  const data: Record<string, unknown> = {};
  const refs = [
    "memberships",
    "departments",
    "service_catalog",
    "loss_reasons",
    "customers",
    "roles",
    "department_members",
  ];
  const names = [...new Set([...selected, ...refs])];
  let selectedCustomers: { id: string }[] = [];
  if (section === "map") {
    let customersQuery = db
      .from("customers")
      .select("*", { count: "exact" })
      .eq("organization_id", org)
      .eq("archived", false)
      .order("name")
      .order("id");
    if (q)
      customersQuery = customersQuery.ilike(
        "name",
        "%" + q.replace(/[%_]/g, "") + "%",
      );
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);
    const from = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
    const customers = await customersQuery.range(from, from + 99);
    if (customers.error)
      return NextResponse.json({ error: "CUSTOMERS_FAILED" }, { status: 400 });
    data.customers = customers.data;
    data.customer_page = [{ count: customers.count ?? 0 }];
    selectedCustomers = customers.data ?? [];
  }
  let hasMore=false;
  const results = await Promise.all(
    names.map(async (table) => {
      if (section === "map" && table === "customers")
        return [table, data.customers] as const;
      if(["todo","tasks"].includes(section)&&table==="work_items"){
        const offset=Number(req.nextUrl.searchParams.get("offset")??0);const r=await db.rpc("todo_items",{org,scope:req.nextUrl.searchParams.get("scope")??"mine",search:q??"",skip_rows:Number.isSafeInteger(offset)&&offset>=0?offset:0});if(r.error)throw Error("TODO_FAILED");return [table,r.data] as const;
      }
      let query = db.from(table).select(table === "import_jobs" ? "id,organization_id,file_hash,mapping,status,cursor,errors,version,created_by,created_at,storage_path" : "*").eq("organization_id", org);
      if (
        section === "map" &&
        ["customer_locations", "contacts"].includes(table)
      ) {
        query = query.in(
          "customer_id",
          selectedCustomers.map((c) => c.id),
        );
        if (table === "customer_locations") query = query.eq("archived", false);
      }
      if (id && section === "crm") {
        if (table === "deals") query = query.eq("id", id);
        else if (
          [
            "work_items",
            "deal_members",
            "deal_comments",
            "audit_events",
            "resource_links",
            "financial_documents",
          ].includes(table)
        )
          query = query.eq("deal_id", id);
      }
      if (table === "messages") {
        if (!id) return [table, []] as const;
        query = query
          .eq("conversation_id", id)
          .order("created_at", { ascending: false });
      }
      if (table === "customers") {
        query = query.eq("archived", false).order("name");
        if (q && section === "map") query = query.ilike("name", "%" + q.replace(/[%_]/g, "") + "%");
      }
      if (["tools", "meetings", "conversations", "service_contracts"].includes(table)) query = query.eq("archived", false);
      if (table === "resource_links" && !(section === "crm" && id)) query = query.eq("archived", false);
      if (table === "deal_cards") {
        const pipeline = req.nextUrl.searchParams.get("pipeline") ?? "sales";
        query = query.eq("archived", false);
        if (section === "crm") query = query.eq("pipeline", pipeline);
        if (q) query = query.ilike("title", "%" + q.replace(/[%_]/g, "") + "%");
        const stage = req.nextUrl.searchParams.get("stage");
        if (stage) query = query.eq("display_stage", stage);
        const owner = req.nextUrl.searchParams.get("owner");
        if (owner) query = query.eq("accountable_id", owner);
        query = query.order("created_at", { ascending: false });
      }
      if (table === "work_items") {
        if (q && section === "todo")
          query = query.ilike("name", "%" + q.replace(/[%_]/g, "") + "%");
        if (!(section === "crm" && id)) query = query.eq("archived", false);
        if (
          section === "todo" &&
          req.nextUrl.searchParams.get("scope") !== "shared" &&
          !(member.is_admin && req.nextUrl.searchParams.get("scope") === "team")
        )
          query = query.eq("assignee_id", member.id);
        query = query.order("due_at", { ascending: true, nullsFirst: false });
      }
      const offset =
        section === "map" || !selected.includes(table)
          ? 0
          : Number(req.nextUrl.searchParams.get("offset") ?? 0);
      const limit =
        table === "customers" ? 100 : table === "deal_cards" ? 240 : 200;
      const searchColumn:Record<string,Record<string,string>>={tools:{tools:"name"},meetings:{meetings:"title"},drive:{resource_links:"title"},users:{memberships:"name"},subscriptions:{service_contracts:"title"},finance:{financial_documents:"counterparty",payments:"note"}};
      const column=searchColumn[section]?.[table];
      if(q&&column) query=query.ilike(column,"%"+q.replace(/[%_]/g,"")+"%");
      if(!["work_prices","deal_members","department_members","catalog_prices","meeting_participants","conversation_members","tool_units","pipeline_stages"].includes(table)) query=query.order("id");
      const result = await query.range(
        Number.isSafeInteger(offset) && offset >= 0 ? offset : 0,
        (Number.isSafeInteger(offset) && offset >= 0 ? offset : 0) + limit - 1,
      );
      if (result.error) throw new Error(result.error.message);
      if(selected.includes(table)&&result.data?.length===limit)hasMore=true;
      return [table, result.data] as const;
    }),
  );
  for (const [name, rows] of results) data[name] = rows;
  // Related records must follow the visible parent IDs, not an unrelated global first page.
  async function related(table:string,column:string,ids:string[]){
    const all:Record<string,unknown>[]=[];
    if(!ids.length)return all;
    for(let start=0;;start+=1000){const r=await db.from(table).select("*").eq("organization_id",org).in(column,ids).order(table==="work_prices"?"work_id":"id").range(start,start+999);if(r.error)throw Error("RELATED_RECORDS_FAILED");all.push(...r.data);if(r.data.length<1000)break;}return all;
  }
  const workRows=data.work_items as {id:string;deal_id:string}[]??[];
  if(section==="crm"&&id) data.work_prices=await related("work_prices","work_id",workRows.map(w=>w.id));
  if(["todo","portfolio","drive"].includes(section)){
    const parents=[...new Set([...workRows,...(data.portfolio_items as {deal_id:string}[]??[]),...(data.resource_links as {deal_id:string}[]??[])].map(r=>r.deal_id).filter(Boolean))];
    data.deal_cards=await related("deal_cards","id",parents);
  }
  if(section==="finance"||section==="crm"&&id){
    const documents=data.financial_documents as {id:string}[]??[];
    const payments=data.payments as {id:string}[]??[];
    const byDocument=await related("payment_allocations","document_id",documents.map(d=>d.id));
    const byPayment=section==="finance"?await related("payment_allocations","payment_id",payments.map(p=>p.id)):[];
    data.payment_allocations=[...new Map([...byDocument,...byPayment].map(a=>[a.id,a])).values()];
    const paymentIds=[...new Set(byDocument.map(a=>String(a.payment_id)))];
    const parentPayments=await related("payments","id",paymentIds);
    const reversals=await related("payments","reversed_payment_id",[...new Set([...paymentIds,...(section==="finance"?payments.map(p=>p.id):[])])]);
    data.payments=[...new Map([...(section==="finance"?payments:[]),...parentPayments,...reversals].map(p=>[p.id,p])).values()];
  }
  if (section !== "map") {
    const customerIds=[...new Set([...(data.deals as {customer_id:string}[]??[]),...(data.deal_cards as {customer_id:string}[]??[]),...(data.service_contracts as {customer_id:string}[]??[]),...(data.financial_documents as {customer_id:string}[]??[]),...(data.payments as {customer_id:string}[]??[])].map(r=>r.customer_id).filter(Boolean))];
    if(customerIds.length){
      const lookup=await db.from("customers").select("*").eq("organization_id",org).in("id",customerIds);
      if(lookup.error) return NextResponse.json({error:"LOOKUP_FAILED"},{status:400});
      data.customers=[...new Map([...(data.customers as {id:string}[]??[]),...(lookup.data??[])].map(c=>[c.id,c])).values()];
    }
  }
  if (["overview", "finance"].includes(section)) {
    const result = await db.rpc("workspace_stats", { org });
    if (result.error)
      return NextResponse.json({ error: "STATS_FAILED" }, { status: 400 });
    data.stats = [result.data];
  }
  if(section === "overview") {
    const result=await db.rpc("overview_report",{org,date_from:req.nextUrl.searchParams.get("from")||null,date_to:req.nextUrl.searchParams.get("to")||null});
    if(result.error) return NextResponse.json({error:"REPORT_FAILED"},{status:400});
    data.report=[result.data];
  }
  if (section === "portfolio") {
    const result = await db.rpc("monthly_portfolio", { org });
    if (result.error)
      return NextResponse.json({ error: "PORTFOLIO_FAILED" }, { status: 400 });
    data.monthly_portfolio = result.data;
  }
  const accountOptions = await db.rpc("account_options", { org });
  data.account_options = accountOptions.data ?? [];
  if (id && section === "crm") {
    const summary = await db.rpc("price_summary", { org, d: id });
    data.commercial = summary.data;
  }
  return NextResponse.json(
    { data, member,hasMore },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
