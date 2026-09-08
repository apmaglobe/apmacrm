import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
if (!env.DATABASE_URL?.includes("127.0.0.1"))
  throw new Error("Tests require isolated local database");
const pool = new Pool({ connectionString: env.DATABASE_URL });
const orgA = randomUUID(),
  orgB = randomUUID(),
  admin = randomUUID(),
  member = randomUUID(),
  other = randomUUID(),
  bAdmin = randomUUID();
const actors = [admin, member, other, bAdmin];
let passed = 0;
async function as<T = Record<string, unknown>>(
  user: string,
  sql: string,
  args: unknown[] = [],
) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: user, role: "authenticated", aal: "aal2" }),
    ]);
    await c.query("set local role authenticated");
    const r = await c.query<T & Record<string, unknown>>(sql, args);
    await c.query("commit");
    return r.rows;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
async function check(label: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`PASS ${label}`);
}
async function reject(
  user: string,
  sql: string,
  args: unknown[],
  code: string,
) {
  await assert.rejects(as(user, sql, args), new RegExp(code));
}
async function command(
  user: string,
  op: string,
  payload: unknown,
  v = 1,
  id = randomUUID(),
) {
  const rows = await as<{
    result: { id: string; version: number; work_id: string };
  }>(user, "select public.crm_command($1,$2,$3,$4,$5) result", [
    orgA,
    op,
    payload,
    v,
    id,
  ]);
  return rows[0].result;
}
try {
  for (const id of actors)
    await pool.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [id, id + "@example.test"],
    );
  for (const [id, name] of [
    [orgA, "Test A"],
    [orgB, "Test B"],
  ]) {
    await pool.query(
      "insert into public.organizations(id,name,slug) values($1::uuid,$2,$1::text)",
      [id, name],
    );
    await pool.query("select private.initialize_org($1)", [id]);
  }
  const mA = randomUUID(),
    mM = randomUUID(),
    mO = randomUUID(),
    mB = randomUUID();
  for (const [id, user, org, adm] of [
    [mA, admin, orgA, true],
    [mM, member, orgA, false],
    [mO, other, orgA, false],
    [mB, bAdmin, orgB, true],
  ])
    await pool.query(
      "insert into public.memberships(id,organization_id,user_id,name,status,is_admin,overrides) values($1,$2,$3,'Test','active',$4,'{\"commercials.write\":\"allow\"}')",
      [id, org, user, adm],
    );
  const depts = (
    await pool.query(
      "select id from public.departments where organization_id=$1 order by name",
      [orgA],
    )
  ).rows;
  const customer = randomUUID();
  await pool.query(
    "insert into public.customers(id,organization_id,external_id,name) values($1,$2,'sample','Sintetik müştəri')",
    [customer, orgA],
  );
  await check("AC-01/61 tenant read isolation", async () => {
    assert.equal(
      (
        await as(
          bAdmin,
          "select * from public.customers where organization_id=$1",
          [orgA],
        )
      ).length,
      0,
    );
    assert.equal(
      (
        await as(
          member,
          "select * from public.customers where organization_id=$1",
          [orgA],
        )
      ).length,
      1,
    );
  });
  await check("AC-04 direct privilege escalation denied", async () => {
    await reject(
      member,
      "update public.memberships set is_admin=true where user_id=$1",
      [member],
      "permission denied",
    );
  });
  const rid = randomUUID();
  const payload = {
    customer_id: customer,
    works: [
      {
        name: "Dizayn",
        department_id: depts[0].id,
        assignee_id: mM,
        amount: null,
      },
    ],
  };
  let deal = await command(member, "deal.create", payload, 1, rid);
  await check("AC-07 business retry creates one deal", async () => {
    assert.equal(
      (await command(member, "deal.create", payload, 1, rid)).id,
      deal.id,
    );
  });
  await check(
    "AC-08 direct delivery without prices/deadlines denied",
    async () => {
      await assert.rejects(
        command(
          member,
          "deal.stage",
          { deal_id: deal.id, stage: "delivered" },
          deal.version,
        ),
        /CONFIRMATION_FIELDS_REQUIRED/,
      );
    },
  );
  await check("AC-34 unrelated member cannot edit", async () => {
    await assert.rejects(
      command(
        other,
        "deal.update",
        { deal_id: deal.id, title: "attack" },
        deal.version,
      ),
      /ACCESS_DENIED/,
    );
  });
  deal = await command(
    member,
    "deal.update",
    { deal_id: deal.id, due_at: "2026-12-10T14:00:00Z", reason: "Plan" },
    deal.version,
  );
  const work = (
    await pool.query("select id from public.work_items where deal_id=$1", [
      deal.id,
    ])
  ).rows[0].id;
  await check("AC-41 child deadline bounded", async () => {
    await assert.rejects(
      command(
        member,
        "work.save",
        {
          deal_id: deal.id,
          id: work,
          due_at: "2026-12-10T15:00:00Z",
          reason: "Plan",
        },
        deal.version,
      ),
      /CHILD_DEADLINE/,
    );
  });
  deal = await command(
    member,
    "work.save",
    {
      deal_id: deal.id,
      id: work,
      due_at: "2026-12-10T13:00:00Z",
      amount: 100000,
      reason: "Plan",
    },
    deal.version,
  );
  deal = await command(
    member,
    "deal.stage",
    { deal_id: deal.id, stage: "confirmed" },
    deal.version,
  );
  await check("AC-45 one charge on confirmed/delivered", async () => {
    deal = await command(
      member,
      "deal.stage",
      { deal_id: deal.id, stage: "delivered" },
      deal.version,
    );
    assert.equal(
      (
        await pool.query(
          "select count(*)::int n from public.financial_documents where deal_id=$1 and kind='charge'",
          [deal.id],
        )
      ).rows[0].n,
      1,
    );
  });
  await check("AC-40 delivered keeps work open", async () => {
    assert.equal(
      (
        await as(member, "select status from public.work_items where id=$1", [
          work,
        ])
      )[0].status,
      "todo",
    );
  });
  await check("AC-10 concurrent stale mutation conflicts", async () => {
    const results = await Promise.allSettled([
      command(
        member,
        "deal.update",
        { deal_id: deal.id, title: "A" },
        deal.version,
      ),
      command(
        member,
        "deal.update",
        { deal_id: deal.id, title: "B" },
        deal.version,
      ),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  });

  const fresh = (
    await pool.query("select version from public.deals where id=$1", [deal.id])
  ).rows[0].version;
  deal.version = fresh;
  const rpc = async (
    user: string,
    domain: string,
    op: string,
    payload: unknown,
    v = 1,
    id = randomUUID(),
  ) =>
    (
      await as<{ r: { id: string; version: number } }>(
        user,
        `select public.${domain}_command($1,$2,$3,$4,$5) r`,
        [orgA, op, payload, v, id],
      )
    )[0].r;
  const account = await rpc(admin, "finance", "account.save", {
    name: "Test bank",
    kind: "bank",
  });
  const charge = (
    await pool.query(
      "select id from public.financial_documents where deal_id=$1 and kind='charge'",
      [deal.id],
    )
  ).rows[0].id;
  let payId = "";
  await check("AC-24/25/44 creator payment and retry", async () => {
    const key = randomUUID();
    const input = {
      customer_id: customer,
      account_id: account.id,
      amount: 30000,
      payment_date: new Date().toISOString(),
      allocations: [{ document_id: charge, amount: 30000 }],
    };
    const a = await rpc(member, "finance", "payment.create", input, 1, key);
    payId = a.id;
    assert.equal(
      (await rpc(member, "finance", "payment.create", input, 1, key)).id,
      a.id,
    );
    assert.equal(
      (
        await pool.query(
          "select private.charge($1,$2)-private.paid($1,$2) balance",
          [orgA, deal.id],
        )
      ).rows[0].balance,
      "70000",
    );
  });
  await check(
    "AC-44 overall accountable does not gain payment rights",
    async () => {
      deal.version = (
        await pool.query("select version from public.deals where id=$1", [
          deal.id,
        ])
      ).rows[0].version;
      deal = await command(
        member,
        "deal.update",
        { deal_id: deal.id, accountable_id: mO },
        deal.version,
      );
      await assert.rejects(
        rpc(other, "finance", "payment.create", {
          customer_id: customer,
          account_id: account.id,
          amount: 100,
          payment_date: new Date().toISOString(),
          allocations: [{ document_id: charge, amount: 100 }],
        }),
        /SINGLE_ORDER_PAYMENT_ONLY/,
      );
    },
  );
  await check(
    "AC-66 paid price reduction requires admin reconciliation",
    async () => {
      await assert.rejects(
        command(
          member,
          "work.save",
          { deal_id: deal.id, id: work, amount: 10000, reason: "Reduction" },
          deal.version,
        ),
        /ADMIN_RECONCILIATION_REQUIRED/,
      );
      deal = await command(
        admin,
        "work.save",
        {
          deal_id: deal.id,
          id: work,
          amount: 10000,
          reason: "Reconcile",
          reconcile: true,
        },
        deal.version,
      );
      assert.equal(
        (await pool.query("select private.paid($1,$2) p", [orgA, deal.id]))
          .rows[0].p,
        "10000",
      );
      assert.equal(
        (
          await pool.query("select amount from public.payments where id=$1", [
            payId,
          ])
        ).rows[0].amount,
        "30000",
      );
    },
  );
  await check("AC-33 last admin protection", async () => {
    await assert.rejects(
      rpc(
        admin,
        "identity",
        "member.update",
        { id: mA, status: "suspended" },
        1,
      ),
      /LAST_ADMIN/,
    );
  });
  const camera = await rpc(admin, "operations", "tool.save", {
    name: "Camera",
    kind: "physical",
    capacity: 1,
  });
  await check("AC-22/69 concurrent physical reservation", async () => {
    const input = {
      tool_id: camera.id,
      unit_number: 1,
      starts_at: "2026-12-01T10:00:00Z",
      ends_at: "2026-12-01T11:00:00Z",
    };
    const res = await Promise.allSettled([
      rpc(member, "operations", "tool.reserve", input),
      rpc(other, "operations", "tool.reserve", input),
    ]);
    assert.equal(res.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(res.filter((x) => x.status === "rejected").length, 1);
  });
  const chat = await rpc(member, "operations", "conversation.create", {
    title: "Private",
    members: [mO],
  });
  const message = await rpc(member, "operations", "message.send", {
    conversation_id: chat.id,
    body: "Private body",
  });
  await check("AC-68 admin is not a private chat member", async () => {
    assert.equal(
      (
        await as(admin, "select * from public.messages where id=$1", [
          message.id,
        ])
      ).length,
      0,
    );
    assert.equal(
      (
        await as(other, "select * from public.messages where id=$1", [
          message.id,
        ])
      ).length,
      1,
    );
  });
  await check("AC-68 removed member loses access", async () => {
    await rpc(
      member,
      "operations",
      "conversation.member",
      { conversation_id: chat.id, member_id: mO, enabled: false },
      1,
    );
    assert.equal(
      (
        await as(other, "select * from public.messages where id=$1", [
          message.id,
        ])
      ).length,
      0,
    );
  });
  await check("AC-64 leap and short month anchoring", async () => {
    const r = (
      await pool.query(
        "select private.billing_date('2026-01-31',31) feb,private.billing_date('2026-02-28',31) mar,private.billing_date('2028-01-31',31) leap",
      )
    ).rows[0];
    assert.equal(new Date(r.feb).getDate(), 28);
    assert.equal(new Date(r.mar).getDate(), 31);
    assert.equal(new Date(r.leap).getDate(), 29);
  });
  const today = new Date(Date.now()+4*3600000).toISOString().slice(0, 10);
  const contract = await rpc(admin, "subscription", "contract.save", {
    customer_id: customer,
    title: "Monthly",
    billing_day: Number(today.slice(8)),
    first_payment_date: today,
    accountable_id: mA,
    works: [
      {
        name: "Monthly work",
        department_id: depts[0].id,
        assignee_id: mM,
        amount: 100001,
        due_offset_days: 1,
      },
    ],
  });
  await check("AC-26/48/63 recurring generation idempotency", async () => {
    await rpc(admin, "subscription", "contract.generate", { id: contract.id });
    await rpc(admin, "subscription", "contract.generate", { id: contract.id });
    const rows = (
      await pool.query(
        "select * from public.contract_periods where contract_id=$1",
        [contract.id],
      )
    ).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "ready", rows[0].last_error);
    assert.equal(
      (
        await pool.query(
          "select count(*)::int n from public.financial_documents where deal_id=$1 and kind='charge'",
          [rows[0].deal_id],
        )
      ).rows[0].n,
      1,
    );
  });
  await check('AC-55/56 odd-cent 50% threshold uses current stage',async()=>{
    const per=(await pool.query('select * from public.contract_periods where contract_id=$1',[contract.id])).rows[0];
    await pool.query("update public.contract_periods set period_start=period_start-1 where id=$1",[per.id]);
    const doc=(await pool.query("select id from public.financial_documents where deal_id=$1 and kind='charge'",[per.deal_id])).rows[0].id;
    const stage=async()=>(await as(admin,'select private.display_stage($1,$2) stage',[orgA,per.deal_id]))[0].stage;
    assert.equal(await stage(),'recurring_unpaid');
    await rpc(admin,'finance','payment.create',{customer_id:customer,account_id:account.id,amount:50000,payment_date:new Date().toISOString(),allocations:[{document_id:doc,amount:50000}]});
    assert.equal(await stage(),'recurring_unpaid');
    await rpc(admin,'finance','payment.create',{customer_id:customer,account_id:account.id,amount:1,payment_date:new Date().toISOString(),allocations:[{document_id:doc,amount:1}]});
    assert.equal(await stage(),'recurring_todo');
    const balance=(await pool.query('select private.charge($1,$2)-private.paid($1,$2) balance',[orgA,per.deal_id])).rows[0].balance;assert.equal(balance,'50000');
  });
  await check('AC-57/58/74 monthly done reason, no future days, reopen removes contribution',async()=>{
    const per=(await pool.query('select * from public.contract_periods where contract_id=$1',[contract.id])).rows[0];
    const v=async()=>(await pool.query('select version from public.deals where id=$1',[per.deal_id])).rows[0].version;
    await assert.rejects(command(admin,'deal.stage',{deal_id:per.deal_id,stage:'recurring_done',reason:' '},await v()),/OPEN_WORK_REASON_REQUIRED/);
    await command(admin,'deal.stage',{deal_id:per.deal_id,stage:'recurring_done',reason:'Müştəri ilə qəbul edilib'},await v());
    const summary=async()=>(await as<{p:{service_days:number}[]}>(admin,'select public.monthly_portfolio($1) p',[orgA]))[0].p;
    assert.equal((await summary())[0].service_days,2);
    await command(admin,'deal.stage',{deal_id:per.deal_id,stage:'recurring_doing',reason:'Yenidən baxış'},await v());assert.equal((await summary()).length,0);
    await command(admin,'deal.stage',{deal_id:per.deal_id,stage:'recurring_done',reason:'Yenidən təhvil'},await v());assert.equal((await summary())[0].service_days,2);
  });
  await check('AC-65 stop preserves charge, resume does not backfill gap',async()=>{
    const before=(await pool.query('select sum(f.amount) n from public.financial_documents f join public.contract_periods p on p.deal_id=f.deal_id where p.contract_id=$1',[contract.id])).rows[0].n;
    await rpc(admin,'subscription','contract.pause',{id:contract.id,reason:'Test fasiləsi'});
    await rpc(admin,'subscription','contract.generate',{id:contract.id},2);
    const after=(await pool.query('select sum(f.amount) n from public.financial_documents f join public.contract_periods p on p.deal_id=f.deal_id where p.contract_id=$1',[contract.id])).rows[0].n;assert.equal(before,after);
    await rpc(admin,'subscription','contract.resume',{id:contract.id,reason:'Test bərpası'},2);
    const c=(await pool.query('select * from public.service_contracts where id=$1',[contract.id])).rows[0];assert.equal(c.status,'active');assert.equal(c.service_last_day,null);assert.ok(new Date(c.next_period_start)>new Date(today));
  });
  await check('AC-67 parallel allocation cannot exceed payment or ignore version',async()=>{
    const doc=await rpc(admin,'finance','document.create',{kind:'opening_receivable',customer_id:customer,amount:100000,reason:'Migration opening'});
    const p=await rpc(admin,'finance','payment.create',{customer_id:customer,account_id:account.id,amount:100000,payment_date:new Date().toISOString(),allocations:[]});
    const rs=await Promise.allSettled([1,2].map(()=>rpc(admin,'finance','payment.allocate',{id:p.id,allocations:[{document_id:doc.id,amount:70000}]})));
    assert.equal(rs.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await pool.query('select sum(amount) n from public.payment_allocations where payment_id=$1',[p.id])).rows[0].n,'70000');
    await assert.rejects(rpc(admin,'finance','payment.refund',{payment_id:p.id,amount:30001,payment_date:new Date().toISOString(),reason:'test'},2),/REFUND_EXCEEDS_AVAILABLE/);
    await rpc(admin,'finance','payment.release',{payment_id:p.id,reason:'Release'},2);
    await rpc(admin,'finance','payment.refund',{payment_id:p.id,amount:100000,payment_date:new Date().toISOString(),reason:'Refund'},3);
    await assert.rejects(rpc(admin,'finance','payment.refund',{payment_id:p.id,amount:1,payment_date:new Date().toISOString(),reason:'Excess'},4),/REFUND_EXCEEDS_AVAILABLE/);
  });
  await check('AC-69 digital capacity two supports two checkouts',async()=>{
    const tool=await rpc(admin,'operations','tool.save',{name:'Digital2',kind:'digital',capacity:2});
    const reservation={tool_id:tool.id,starts_at:new Date(Date.now()-60000).toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),quantity:1};
    const r1=await rpc(member,'operations','tool.reserve',reservation);const r2=await rpc(other,'operations','tool.reserve',reservation);
    await assert.rejects(rpc(admin,'operations','tool.reserve',reservation),/TOOL_CAPACITY_CONFLICT/);
    await rpc(member,'operations','tool.checkout',{id:r1.id});await rpc(other,'operations','tool.checkout',{id:r2.id});
    await assert.rejects(rpc(other,'operations','tool.return',{id:r1.id},2),/ACCESS_DENIED/);
  });
  await check('AC-14/15/17 import 2500, replay and two branches',async()=>{
    const rows=Array.from({length:2500},(_,i)=>({external_id:'bulk-'+i,customer_name:'Əməkdaş Şirkət '+i,phone:i%2?'+994501234567':'0501234567',branch_name:'Filial',address:'Bakı',latitude:40.4,longitude:49.8}));
    const preview={file_hash:'bulk-'+orgA,mapping:{name:1},rows};
    const job=await rpc(admin,'import','import.preview',preview);let version=1;
    for(let i=0;i<13;i++){await rpc(admin,'import','import.apply',{id:job.id},version++);}
    assert.equal((await pool.query("select count(*)::int n from public.customers where organization_id=$1 and external_id like 'bulk-%'",[orgA])).rows[0].n,2500);
    assert.equal((await rpc(admin,'import','import.preview',preview)).id,job.id);
    const value=(await pool.query("select c.id,p.phone from public.customers c join public.contacts p on p.customer_id=c.id where c.organization_id=$1 and c.external_id='bulk-0'",[orgA])).rows[0];assert.equal(value.phone,'0501234567');
    const branch=await rpc(admin,'import','import.preview',{file_hash:'branch-'+orgA,mapping:{},rows:[{external_id:'bulk-0',customer_name:'Əməkdaş Şirkət 0',location_external_id:'second',branch_name:'İkinci',address:'Gəncə'}]});await rpc(admin,'import','import.apply',{id:branch.id});
    assert.equal((await pool.query('select count(*)::int n from public.customer_locations where customer_id=$1',[value.id])).rows[0].n,2);
    await rpc(admin,'import','import.rollback',{id:branch.id,reason:'Sınaq rollback'},2);
    assert.equal((await pool.query('select count(*)::int n from public.customer_locations where customer_id=$1',[value.id])).rows[0].n,1);
    await assert.rejects(rpc(admin,'import','import.rollback',{id:job.id,reason:'Subsequent change'},14),/ROLLBACK_SUBSEQUENT_CHANGE/);
  });
  await check('AC-02/71 invitation exact verified email and retry stays pending',async()=>{
    const token=(await as<{token:string}>(admin,'select public.invite_create($1,$2) token',[orgA,bAdmin+'@example.test']))[0].token;
    await assert.rejects(as(member,'select public.invite_accept($1,$2)',[token,'Wrong email']),/INVALID_INVITATION/);
    const mid=(await as<{m:string}>(bAdmin,'select public.invite_accept($1,$2) m',[token,'New member']))[0].m;
    assert.equal((await as<{m:string}>(bAdmin,'select public.invite_accept($1,$2) m',[token,'Retry']))[0].m,mid);
    assert.equal((await pool.query('select status from public.memberships where id=$1',[mid])).rows[0].status,'pending');
    assert.equal((await as(bAdmin,'select * from public.customers where organization_id=$1',[orgA])).length,0);
  });
  await check('AC-14 durable import continues after client stops',async()=>{
    const rows=Array.from({length:401},(_,i)=>({external_id:'worker-'+i,customer_name:'Fon import '+i}));
    const job=await rpc(admin,'import','import.preview',{file_hash:'worker-'+orgA,mapping:{},rows});
    await rpc(admin,'import','import.apply',{id:job.id});
    assert.equal((await pool.query('select cursor from public.import_jobs where id=$1',[job.id])).rows[0].cursor,200);
    await pool.query('select private.continue_imports()');await pool.query('select private.continue_imports()');
    const end=(await pool.query('select cursor,status from public.import_jobs where id=$1',[job.id])).rows[0];assert.equal(end.cursor,401);assert.equal(end.status,'done');
    await pool.query('select private.continue_imports()');assert.equal((await pool.query("select count(*)::int n from public.customers where organization_id=$1 and external_id like 'worker-%'",[orgA])).rows[0].n,401);
  });
  await check("AC-18/70 durable export owner, retry, fields, revocation and expiry", async()=>{
    await pool.query(`update public.memberships set overrides=overrides||'{"crm.export":"allow"}' where id=$1`,[mM]);
    const req=randomUUID(),payload={module:"crm",format:"xlsx",filters:{q:""}};
    const queued=await rpc(member,"export","create",payload,1,req);
    const again=await rpc(member,"export","create",payload,1,req);assert.equal(queued.id,again.id);
    await pool.query("select private.process_exports()");
    const read=()=>as(member,"select public.download_export($1,$2) result",[orgA,queued.id]);
    const first=JSON.stringify((await read())[0].result);assert.ok(first.includes("deal_cards"));
    const page=async(user=member,index=0,offset=0)=>(await as<{r:{rows:Record<string,unknown>[];table:string;next_offset:number|null}}>(user,"select public.export_page($1,$2,$3,$4) r",[orgA,queued.id,index,offset]))[0].r;
    await reject(member,"select * from private.export_chunks",[],"permission denied");
    const chunkCount=async()=>(await pool.query("select count(*)::int n from private.export_chunks where job_id=$1",[queued.id])).rows[0].n;
    const chunks=await chunkCount();assert.ok(chunks>0);
    await pool.query("select private.chunk_export(job_id,data) from private.export_artifacts where job_id=$1",[queued.id]);assert.equal(await chunkCount(),chunks);
    assert.equal((await page()).table,"deal_cards");assert.ok((await page()).rows.length<=500);
    await assert.rejects(page(bAdmin),/EXPORT_DENIED/);await assert.rejects(page(member,0,-1),/INVALID_EXPORT_PAGE/);

    await reject(other,"select public.download_export($1,$2)",[orgA,queued.id],"EXPORT_DENIED");
    await reject(bAdmin,"select public.download_export($1,$2)",[orgA,queued.id],"EXPORT_DENIED");
    await pool.query(`update public.memberships set overrides=overrides||'{"commercials.read":"deny"}' where id=$1`,[mM]);
    const hidden=(await read())[0].result as {tables:{table:string;rows:Record<string,unknown>[]}[]};
    assert.equal(hidden.tables.find(t=>t.table==="work_prices")!.rows.length,0);
    assert.ok((await page()).rows.every(r=>!("commercial" in r)));
    assert.equal((await page(member,2)).rows.length,0);
    assert.ok(hidden.tables.find(t=>t.table==="deal_cards")!.rows.every(r=>!("commercial" in r)));
    await pool.query(`update public.memberships set overrides=overrides||'{"crm.export":"deny"}' where id=$1`,[mM]);
    await reject(member,"select public.download_export($1,$2)",[orgA,queued.id],"EXPORT_DENIED");
    await assert.rejects(page(),/EXPORT_DENIED/);
    await pool.query("update public.export_jobs set expires_at=now()-interval '1 second' where id=$1",[queued.id]);
    await pool.query("select private.process_exports()");
    assert.equal((await pool.query("select count(*)::int n from private.export_artifacts where job_id=$1",[queued.id])).rows[0].n,0);assert.equal(await chunkCount(),0);
  });
  await check("paged export covers every source once and cleans private chunks",async()=>{
    const queued=await rpc(admin,"export","create",{module:"map",format:"csv",filters:{}},1,randomUUID());
    await pool.query("select private.process_exports()");
    const expected=Number((await pool.query("select count(*) n from public.customers where organization_id=$1 and not archived",[orgA])).rows[0].n);assert.ok(expected>500);
    const ids=new Set<string>();let offset=0;let count=0;
    for(;;){
      const result=(await as<{r:{rows:{id:string}[];next_offset:number|null;next_part:number|null}}>(admin,"select public.export_page($1,$2,0,$3) r",[orgA,queued.id,offset]))[0].r;
      assert.ok(result.rows.length<=500);assert.equal(result.next_part,null);
      for(const row of result.rows){assert.ok(!ids.has(row.id));ids.add(row.id);count++;}
      if(result.next_offset===null)break;assert.equal(result.next_offset,offset+500);offset=result.next_offset;
    }
    assert.equal(count,expected);
    await pool.query("update public.export_jobs set expires_at=now()-interval '1 second' where id=$1",[queued.id]);await pool.query("select private.process_exports()");
    assert.equal((await pool.query("select count(*)::int n from private.export_chunks where job_id=$1",[queued.id])).rows[0].n,0);
  });
  await check("AC-19 webhook management, encrypted keys, retry and immutable owner",async()=>{
    const dep=(await pool.query('select department_id from public.work_items where deal_id=$1 limit 1',[deal.id])).rows[0].department_id;
    await reject(member,'select public.identity_command($1,$2,$3,1,$4)',[orgA,'webhook.save',{name:'Ingress',department_id:dep,default_admin_id:mA},randomUUID()],'ADMIN_REQUIRED');
    const request=randomUUID(),input={name:'Ingress',department_id:dep,default_admin_id:mA};
    const created=await rpc(admin,'identity','webhook.save',input,1,request);
    const endpoint=created.id;
    const keys=(await pool.query('select private.webhook_signing_keys($1) keys',[endpoint])).rows[0].keys;
    assert.equal(keys.length,1);assert.equal(keys[0].length,64);
    const again=await rpc(admin,'identity','webhook.save',input,1,request);assert.equal(again.id,endpoint);
    await reject(member,'select public.webhook_signing_keys($1)',[endpoint],'permission denied');
    await reject(admin,'select * from vault.decrypted_secrets',[],'permission denied');
    const evt={external_event_id:'external-1',company_name:'Naməlum lead',message:'Nümunə'};
    const event=(await pool.query('select private.accept_webhook($1,$2,$3) id',[endpoint,evt,'hash-a'])).rows[0].id;
    await pool.query('select private.run_worker()');
    const lead=(await pool.query('select d.* from public.deals d join public.webhook_events e on e.deal_id=d.id where e.id=$1',[event])).rows[0];
    assert.equal(lead.created_by,null);assert.equal(lead.accountable_id,mA);assert.equal(lead.customer_id,null);
    await command(admin,'deal.update',{deal_id:lead.id,accountable_id:mO},lead.version);
    await pool.query('select private.accept_webhook($1,$2,$3)',[endpoint,evt,'hash-a']);await pool.query('select private.run_worker()');
    assert.equal((await pool.query('select accountable_id from public.deals where id=$1',[lead.id])).rows[0].accountable_id,mO);
    await assert.rejects(pool.query('select private.accept_webhook($1,$2,$3)',[endpoint,evt,'hash-b']),/PAYLOAD_CONFLICT/);
    await rpc(admin,'identity','webhook.rotate',{id:endpoint},1);
    assert.equal((await pool.query('select private.webhook_signing_keys($1) keys',[endpoint])).rows[0].keys.length,2);
  });
  await check("AC-04 profile editing cannot carry privilege fields",async()=>{
    const v=(await pool.query('select version from public.memberships where id=$1',[mM])).rows[0].version;
    await reject(member,'select public.identity_command($1,$2,$3,$4,$5)',[orgA,'profile.save',{name:'Yeni ad',is_admin:true},v,randomUUID()],'FIELD_DENIED');
    await rpc(member,'identity','profile.save',{name:'Yeni ad',skills:['Dizayn']},v);
    assert.equal((await pool.query('select is_admin from public.memberships where id=$1',[mM])).rows[0].is_admin,false);
  });
  await check("AC-01/06 filtered board uses object boundary and hides commercial snapshot",async()=>{
    const result=(await as(member,"select public.board_filtered($1,'sales','',$2,'{}') result",[orgA,{}]))[0].result as {rows:{id:string;commercial:unknown}[];counts:Record<string,number>};
    const visible=new Set((await as(member,'select id from public.deals where organization_id=$1',[orgA])).map(r=>r.id));
    assert.ok(result.rows.every(r=>visible.has(r.id)&&r.commercial===null));
    await reject(member,"select public.board_filtered($1,'sales','','{}','{}')",[orgB],'ACCESS_DENIED');
    const filter=(await as(member,"select public.board_filtered($1,'sales','',$2,'{}') result",[orgA,{department_id:randomUUID()}]))[0].result as {rows:unknown[]};assert.equal(filter.rows.length,0);
  });
  await check("AC-14 indexed import preview returns bounded exact matches",async()=>{
    const result=(await as(admin,"select public.import_command($1,'import.inspect',$2,1,$3) result",[orgA,{rows:[{customer_name:'Synthetic exact',external_id:'test-customer'}]},randomUUID()]))[0].result as {candidates:{index:number;matches:unknown[]}[]};
    assert.equal(result.candidates.length,1);assert.ok(result.candidates[0].matches.length<=20);
  });
  await check("AC-27 report separates cohort, current work and cash with tenant RLS",async()=>{
    const rows=await as(admin,"select public.overview_report($1,null,null) r",[orgA]);
    const report=rows[0].r as {leads:number;first_sales:number;department_sales:unknown[]};
    const expected=(await pool.query("select count(*)::int n from public.deals where organization_id=$1 and pipeline='sales' and not archived",[orgA])).rows[0].n;
    assert.equal(report.leads,expected);assert(Array.isArray(report.department_sales));
    const empty=(await as(admin,"select public.overview_report($1,'2090-01-01','2090-01-31') r",[orgA]))[0].r as {leads:number;first_sales:number;cash_period:number};
    assert.equal(empty.leads,0);assert.equal(empty.first_sales,0);assert.equal(empty.cash_period,0);
    await reject(bAdmin,"select public.overview_report($1,null,null)",[orgA],"ACCESS_DENIED");
    const restricted=(await as(member,"select public.overview_report($1,null,null) r",[orgA]))[0].r as Record<string,unknown>;
    assert.equal(restricted.cash_period,undefined);
  });
  await check("AC-09 mentions cannot grant access; quantity never multiplies price",async()=>{
    let row=await command(admin,"deal.create",{customer_id:customer,works:[{name:'Quantity',quantity:3,department_id:depts[0].id,assignee_id:mA,amount:10000}]});
    const price=await as(admin,"select public.price_summary($1,$2) p",[orgA,row.id]);assert.equal((price[0].p as {total:number}).total,10000);
    assert.equal(Number((await pool.query("select quantity from public.work_items where deal_id=$1",[row.id])).rows[0].quantity),3);
    await assert.rejects(()=>command(admin,"comment.add",{deal_id:row.id,body:'Blocked',mentions:[mB]},row.version),/MENTION_ACCESS_DENIED/);
    const request=randomUUID();row=await command(admin,"comment.add",{deal_id:row.id,body:'Allowed',mentions:[mA]},row.version,request);
    const c=(await pool.query("select mentions from public.deal_comments where deal_id=$1",[row.id])).rows;assert.equal(c.length,1);assert.deepEqual(c[0].mentions,[mA]);
    await assert.rejects(()=>command(admin,"work.save",{deal_id:row.id,id:(price[0].p as {id:string}).id,name:'Bad',quantity:0,department_id:depts[0].id,assignee_id:mA,amount:100},row.version),/check constraint/);
  });
  await check("AC-11/62 To Do scope excludes department-only orders and foreign team access",async()=>{
    const visible=await command(admin,"deal.create",{customer_id:customer,works:[{name:'Department-only task',department_id:depts[0].id,assignee_id:mA,amount:100}]});
    await pool.query('insert into public.department_members values($1,$2,$3) on conflict do nothing',[orgA,depts[0].id,mM]);
    assert.equal((await as(member,'select id from public.deals where id=$1',[visible.id])).length,1);
    const shared=await as(member,"select * from public.todo_items($1,'shared','Department-only',0)",[orgA]);assert.equal(shared.length,0);
    const mine=await as(member,"select * from public.todo_items($1,'mine','',0)",[orgA]);assert(mine.every(w=>w.assignee_id===mM));
    await reject(member,"select * from public.todo_items($1,'team','',0)",[orgA],"ACCESS_DENIED");
    await reject(bAdmin,"select * from public.todo_items($1,'mine','',0)",[orgA],"ACCESS_DENIED");
  });
  await check("AC-63 failed period plan repair is audited, atomic and idempotent",async()=>{
    const broken=await rpc(admin,'subscription','contract.save',{customer_id:customer,title:'Repair contract',billing_day:Number(today.slice(8)),first_payment_date:today,accountable_id:mA,works:[{name:'Repair work',department_id:depts[0].id,assignee_id:randomUUID(),amount:50000}]});
    await rpc(admin,'subscription','contract.generate',{id:broken.id});
    const failed=(await pool.query('select * from public.contract_periods where contract_id=$1',[broken.id])).rows[0];assert.equal(failed.status,'failed');assert.equal(failed.deal_id,null);
    const payload={id:failed.id,accountable_id:mA,reason:'Replace unavailable assignee',works:[{name:'Repair work',department_id:depts[0].id,assignee_id:mM,amount:50000}]};
    await assert.rejects(()=>rpc(member,'subscription','period.repair',payload,failed.attempts),/ADMIN_REQUIRED/);
    const id=randomUUID();const repaired=await rpc(admin,'subscription','period.repair',payload,failed.attempts,id);const retry=await rpc(admin,'subscription','period.repair',payload,failed.attempts,id);assert.deepEqual(repaired,retry);
    const ready=(await pool.query('select * from public.contract_periods where id=$1',[failed.id])).rows[0];assert.equal(ready.status,'ready');assert.deepEqual(ready.period_start,failed.period_start);assert.deepEqual(ready.period_end,failed.period_end);assert.notEqual(ready.revision_id,failed.revision_id);
    assert.equal((await pool.query("select count(*)::int n from public.audit_events where organization_id=$1 and action='period.repair'",[orgA])).rows[0].n,1);
    await assert.rejects(()=>rpc(admin,'subscription','period.repair',payload,ready.attempts),/FAILED_PERIOD_REQUIRED/);
  });
  await check("AC-01/71 bootstrap allowlist requires MFA and remains idempotent",async()=>{
    await reject(other,'select public.claim_bootstrap()',[],'BOOTSTRAP_NOT_AUTHORIZED');
    await pool.query('insert into private.bootstrap_admins(email,organization_name,slug) values($1,$2,$3)',[admin+'@example.test','Bootstrap synthetic','bootstrap-'+admin]);
    const weak=await pool.connect();try{await weak.query('begin');await weak.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:admin,role:'authenticated',aal:'aal1'})]);await weak.query('set local role authenticated');await assert.rejects(()=>weak.query('select public.claim_bootstrap()'),/VERIFIED_EMAIL_AND_MFA_REQUIRED/);}finally{await weak.query('rollback');weak.release();}
    const first=(await as(admin,'select public.claim_bootstrap() id'))[0].id;
    const retry=(await as(admin,'select public.claim_bootstrap() id'))[0].id;assert.equal(first,retry);
    const saved=(await pool.query('select is_admin,status from public.memberships where organization_id=$1 and user_id=$2',[first,admin])).rows;assert.equal(saved.length,1);assert.equal(saved[0].is_admin,true);assert.equal(saved[0].status,'active');
  });
  await check("AC-76 zero requires reason, NULL cannot confirm, and zero recurring needs no payment",async()=>{
    const planned={customer_id:customer,due_at:"2026-12-10T14:00:00Z",works:[{name:"Pulsuz sınaq",department_id:depts[0].id,assignee_id:mA,due_at:"2026-12-10T13:00:00Z",amount:0}]};
    let zero=await command(admin,"deal.create",planned);
    await assert.rejects(command(admin,"deal.stage",{deal_id:zero.id,stage:"confirmed"},zero.version),/ZERO_REASON_REQUIRED/);
    zero=await command(admin,"deal.update",{deal_id:zero.id,zero_reason:"Razılaşdırılmış pulsuz sınaq"},zero.version);
    zero=await command(admin,"deal.stage",{deal_id:zero.id,stage:"confirmed"},zero.version);
    assert.equal((await pool.query("select private.charge($1,$2) c",[orgA,zero.id])).rows[0].c,"0");
    const nullDeal=await command(admin,"deal.create",{...planned,works:[{...planned.works[0],amount:null}]});
    await assert.rejects(command(admin,"deal.stage",{deal_id:nullDeal.id,stage:"confirmed"},nullDeal.version),/CONFIRMATION_FIELDS_REQUIRED/);
    const free=await rpc(admin,"subscription","contract.save",{customer_id:customer,title:"Pulsuz aylıq",first_payment_date:today,billing_day:Number(today.slice(-2)),accountable_id:mA,zero_reason:"Pulsuz pilot",works:[{name:"Pilot iş",department_id:depts[0].id,assignee_id:mA,amount:0,due_offset_days:1}]});
    await rpc(admin,"subscription","contract.generate",{id:free.id});
    const period=(await pool.query("select * from public.contract_periods where contract_id=$1",[free.id])).rows[0];assert.equal(period.status,"ready",period.last_error);
    await pool.query("update public.contract_periods set period_start=period_start-1 where id=$1",[period.id]);
    assert.equal((await as(admin,"select private.display_stage($1,$2) s",[orgA,period.deal_id]))[0].s,"recurring_todo");
    assert.equal((await pool.query("select private.paid($1,$2) p",[orgA,period.deal_id])).rows[0].p,"0");
  });
  await check("manual member saga requires current admin/MFA, trusted Auth identity and idempotency",async()=>{
    const request=randomUUID(),payload={name:"Manual employee",email:randomUUID()+"@example.test",role_id:null,departments:[depts[0].id]};
    const prepare=async(user=admin,body=payload)=>(await as<{j:{id:string;auth_user_id:string}}>(user,"select public.prepare_member($1,$2,$3) j",[orgA,request,body]))[0].j;
    await assert.rejects(prepare(member),/ADMIN_REQUIRED/);await assert.rejects(prepare(bAdmin),/ADMIN_REQUIRED/);
    await assert.rejects(as(admin,"select public.prepare_member($1,$2,$3)",[orgA,request,{...payload,password:"must-never-store"}]),/INVALID_MEMBER_FIELDS/);
    await assert.rejects(prepare(admin,{...payload,departments:[randomUUID()]}),/INVALID_DEPARTMENT/);
    const j=await prepare();assert.deepEqual(await prepare(),j);
    const reopened=(await as<{j:{id:string}}>(admin,"select public.prepare_member($1,$2,$3) j",[orgA,randomUUID(),payload]))[0].j;assert.equal(reopened.id,j.id);
    await assert.rejects(prepare(admin,{...payload,name:"Changed"}),/IDEMPOTENCY_CONFLICT/);
    const complete=async()=>as<{r:{id:string}}>(admin,"select public.complete_member($1,$2) r",[orgA,j.id]);
    await assert.rejects(complete(),/AUTH_PROVISIONING_INCOMPLETE/);
    await pool.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",[j.auth_user_id,payload.email,{apma_provisioning_id:j.id}]);
    await assert.rejects(complete(),/AUTH_PROVISIONING_INCOMPLETE/);
    await pool.query("update auth.users set raw_app_meta_data=$2 where id=$1",[j.auth_user_id,{apma_provisioning_id:j.id}]);
    const done=(await complete())[0].r;assert.deepEqual((await complete())[0].r,done);
    assert.equal((await pool.query("select count(*)::int n from public.outbox_events where organization_id=$1 and topic='membership' and entity_id=$2",[orgA,done.id])).rows[0].n,1);
    const m=(await pool.query("select * from public.memberships where id=$1",[done.id])).rows[0];assert.equal(m.status,"active");assert.equal(m.is_admin,false);
    assert.equal((await as(j.auth_user_id,"select * from public.customers where organization_id=$1",[orgB])).length,0);
    assert.equal((await pool.query("select count(*)::int n from public.department_members where member_id=$1",[done.id])).rows[0].n,1);
    const persisted=(await pool.query("select payload from private.member_provisioning where id=$1",[j.id])).rows[0].payload;assert.equal('password' in persisted,false);
    await assert.rejects(as(admin,"select public.prepare_member($1,$2,$3)",[orgA,randomUUID(),payload]),/ACCOUNT_ALREADY_EXISTS/);
    const weak=await pool.connect();try{await weak.query('begin');await weak.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:admin,role:'authenticated',aal:'aal1'})]);await weak.query('set local role authenticated');await assert.rejects(()=>weak.query("select public.prepare_member($1,$2,$3)",[orgA,randomUUID(),payload]),/ADMIN_REQUIRED/);}finally{await weak.query('rollback');weak.release();}
  });
  await check("AC-05 commercial denial also protects API", async () => {
    await pool.query(
      'update public.memberships set overrides=overrides||\'{"commercials.read":"deny"}\' where id=$1',
      [mM],
    );
    assert.equal(
      (await as(member, "select * from public.work_prices")).length,
      0,
    );
    assert.equal(
      (
        await as(member, "select public.price_summary($1,$2) p", [
          orgA,
          deal.id,
        ])
      )[0].p,
      null,
    );
  });
  await check("AC-04 suspended current session loses access", async () => {
    await pool.query(
      "update public.memberships set status='suspended' where id=$1",
      [mM],
    );
    assert.equal(
      (await as(member, "select * from public.deals where id=$1", [deal.id]))
        .length,
      0,
    );
  });
  console.log(`${passed} database checks passed.`);
} finally {
  await pool.end();
}
