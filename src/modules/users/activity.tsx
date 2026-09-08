"use client";
import {useInfiniteQuery} from '@tanstack/react-query';
import {Modal} from '@/components/dialog';
import type {Item} from '@/lib/db/types';
import {dateTime} from '@/lib/domain';
export function Activity({org,member,onClose}:{org:string;member:Item;onClose:()=>void}){
 const q=useInfiniteQuery({queryKey:['workspace',org,'activity',member.id],initialPageParam:0,queryFn:async({pageParam})=>{const r=await fetch(`/api/data?org=${org}&module=users&activity=${member.id}&offset=${pageParam*200}`);if(!r.ok)throw Error('Fəaliyyət yüklənmədi.');return r.json() as Promise<{works:Item[];events:Item[];hasMore:boolean}>;},getNextPageParam:(last,pages)=>last.hasMore?pages.length:undefined});
 return <Modal title={member.name+' · İş fəaliyyəti'} onClose={onClose}><p>{member.skills?.join(' · ')} · {member.status}</p><p className="helper">Yalnız baxmaq hüququnuz olan iş və hadisələr göstərilir.</p>{q.isError&&<p role="alert">{q.error.message}</p>}<h3>İşlər və tarix planı</h3>{q.data?.pages.flatMap(p=>p.works).map(w=><div className="work-row" key={w.id}><a href={`/workspace/crm?org=${org}&deal=${w.deal_id}`}>{w.name}</a><span>{w.status} · {dateTime(w.due_at)}</span></div>)}<h3>Əməliyyat tarixçəsi</h3>{q.data?.pages.flatMap(p=>p.events).map(e=><div key={e.id}><strong>{e.action}</strong><p>{e.reason} · {dateTime(e.created_at)}</p></div>)}{q.hasNextPage&&<button onClick={()=>q.fetchNextPage()} disabled={q.isFetchingNextPage}>Daha çox fəaliyyət</button>}</Modal>;
}
