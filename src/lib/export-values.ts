const monetary=new Set(['amount','total','opening_amount','receivable','payable','cash_net','cash_balance','total_amount','total_cents','amount_cents']);
/** DB integer qəpik becomes AZN only at the download boundary. */
export function exportValue(value:unknown,key=''):unknown{
 if(typeof value==='number'&&monetary.has(key))return value/100;
 if(Array.isArray(value))return value.map(v=>exportValue(v));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,exportValue(v,k)]));
 return value;
}
