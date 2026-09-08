"use client";
import {useState} from "react";
import {Modal} from "@/components/dialog";
import {Form,Field,Select} from "@/components/form";
import type {Item} from "@/lib/db/types";
export function AddMember({org,roles,departments,onClose,onCreated}:{org:string;roles:Item[];departments:Item[];onClose:()=>void;onCreated:()=>Promise<void>}){
 const [requestId]=useState(()=>crypto.randomUUID());
 return <Modal title="Əməkdaş əlavə et" onClose={onClose}><Form label="Əməkdaşı yarat" onSave={async f=>{
  const response=await fetch('/api/members',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({org,request_id:requestId,name:String(f.get('name')),email:String(f.get('email')),password:String(f.get('password')),role_id:f.get('role_id')||null,departments:f.getAll('departments')})});
  const result=await response.json();if(!response.ok)throw Error(result.error??'Əməkdaş əlavə edilmədi.');await onCreated();onClose();
 }}><p className="helper">Hesab dərhal aktiv olacaq. Email göndərilmir; giriş məlumatlarını əməkdaşa özünüz çatdırın.</p>
 <Field name="name" label="Əməkdaşın adı" required/><Field name="email" label="Əməkdaşın emaili" type="email" required/>
 <label>İlkin parol<input name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" required/><small>Minimum 10 simvol. Əməkdaş sonra giriş səhifəsindən parolunu dəyişə bilər.</small></label>
 <Select name="role_id" label="İlkin rol" options={roles} empty="Əsas giriş (rolsuz)"/>
 <fieldset><legend>Departamentlər</legend>{departments.map(d=><label className="check" key={d.id}><input type="checkbox" name="departments" value={d.id}/>{d.name}</label>)}</fieldset>
 </Form></Modal>;
}
