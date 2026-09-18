"use client";
import type {PanelProps} from '@/components/module-page';
import {money,salesStages,recurringStages,dateTime} from '@/lib/domain';
import {Sparkles,UserPlus,CheckCircle2,PackageCheck,TrendingUp,Briefcase,ClipboardCheck,AlertTriangle} from 'lucide-react';
type Report={leads:number;cohort_won:number;first_sales:number;delivered:number;completed_work:number;open_work:number;overdue_work:number;cash_period?:number;stages:{pipeline:string;stage:string;count:number}[];workload:{assignee_id:string;open:number;done:number;overdue:number}[];recurring:{periods:number;done:number;failed:number};department_sales?:{department_id:string;deals:number;amount:number|null}[]};
const salesIcons:[string,typeof UserPlus,string][]=[['Yeni lead',UserPlus,'teal'],['İlk təsdiqlənmiş satış',CheckCircle2,'blue'],['Cari təhvil verilmiş satış',PackageCheck,'violet'],['Lead kohortu konversiyası',TrendingUp,'amber']];
const workIcons:[string,typeof Briefcase,string][]=[['Açıq işlər',Briefcase,'blue'],['Bitmiş işlər',ClipboardCheck,'teal'],['Gecikmiş işlər',AlertTriangle,'rose']];
export function Overview({data,member,filters={},setFilters}:PanelProps){
 const r=data.report?.[0] as unknown as Report|undefined;if(!r)return <p>Hesabat yüklənir…</p>;
 const salesValues:Record<string,number|string>={'Yeni lead':r.leads,'İlk təsdiqlənmiş satış':r.first_sales,'Cari təhvil verilmiş satış':r.delivered,'Lead kohortu konversiyası':r.leads?`${(100*r.cohort_won/r.leads).toFixed(1)}%`:'—'};
 const workValues:Record<string,number>={'Açıq işlər':r.open_work,'Bitmiş işlər':r.completed_work,'Gecikmiş işlər':r.overdue_work};
 return <>
 <div className="overview-hero">
   <div><p className="overview-hero-eyebrow">Xoş gəldiniz</p><h2>{member?.name ?? 'Komanda üzvü'}</h2><p className="overview-hero-date">{dateTime(new Date().toISOString())}</p></div>
   <Sparkles className="overview-hero-icon" size={34}/>
 </div>
 <form className="section-toolbar" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setFilters?.({from:String(f.get('from')??''),to:String(f.get('to')??'')});}}><label>Tarixdən<input type="date" name="from" defaultValue={filters.from}/></label><label>Tarixədək<input type="date" name="to" defaultValue={filters.to}/></label><button className="primary">Hesabatı göstər</button></form>
 <h2>Seçilmiş dövrdə satış</h2><div className="stats-grid">{salesIcons.map(([label,Icon,tone])=><div className="stat overview-stat" key={label}><span className={"stat-icon "+tone}><Icon size={18}/></span><div><span>{label}</span><strong>{salesValues[label]}</strong></div></div>)}</div>
 <p className="helper">Lead yaranma, ilk satış təsdiq, təhvil isə təhvil tarixinə görədir. Konversiya bu dövrdə yaranan lead-lərin indiyədək ilk təsdiqi olan hissəsidir. Dövri qutular satış sayılmır. Tarix seçilməyibsə bütün tarix nəzərə alınır.</p>
 <section className="surface"><h2>Cari mərhələlər</h2><div className="card-grid">{[...salesStages,...recurringStages].filter(([code])=>code!=='recurring_unpaid').map(([code,label])=><div key={code}><span>{data.pipeline_stages?.find(s=>s.code===code)?.label??label}</span><strong> · {r.stages.find(s=>s.stage===code)?.count??0}</strong></div>)}</div><p className="helper">Saxlanmış icra mərhələləri göstərilir. Ödəniş xəbərdarlığı ayrıca icra mərhələsi deyil.</p></section>
 <h2>Cari iş yükü</h2><div className="stats-grid">{workIcons.map(([label,Icon,tone])=><div className="stat overview-stat" key={label}><span className={"stat-icon "+tone}><Icon size={18}/></span><div><span>{label}</span><strong>{workValues[label]}</strong></div></div>)}</div><section className="surface"><h2>Əməkdaş üzrə işlər</h2>{r.workload.map(w=><div className="work-row" key={w.assignee_id??'unassigned'}><span>{data.memberships?.find(m=>m.id===w.assignee_id)?.name??'Təyinat yoxdur'}</span><span>{w.open} açıq · {w.done} bitmiş · {w.overdue} gecikmiş</span></div>)}<p className="helper">Cari iş vəziyyəti tarix filtrindən asılı deyil; təhvil verilmiş qutuların açıq işləri də daxildir.</p></section>
 <section className="surface"><h2>Dövrdə başlayan aylıq xidmət</h2><p>{r.recurring.periods} dövr · {r.recurring.done} Bitdi · {r.recurring.failed} xəta</p></section>
 {r.department_sales&&<section className="surface"><h2>Departament üzrə satış məbləği</h2>{r.department_sales.map(d=><div className="work-row" key={d.department_id}><span>{data.departments?.find(x=>x.id===d.department_id)?.name} · {d.deals} qutu</span><strong>{money(d.amount)}</strong></div>)}<p className="helper">Bu dövrdə ilk təsdiqlənmiş satışların cari iş qiymətləri. Hər departamentə yalnız öz iş məbləği düşür; bu, daxil olmuş pul deyil.</p></section>}
 {r.cash_period!==undefined&&<section className="surface"><h2>Dövrdə xalis pul hərəkəti</h2><strong>{money(r.cash_period)}</strong><p>Faktiki payment_date üzrə daxilolma − çıxış; başlanğıc qalıq daxil deyil.</p><p>Cari alacaq: {money(data.stats?.[0]?.finance?.receivable)} · Cari borc: {money(data.stats?.[0]?.finance?.payable)}</p></section>}
 </>;
}
