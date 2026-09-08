/** Run by the account owner in a local terminal. Password is hidden, never saved or printed. */
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const target='clysniomfmmxwiozfizt',email='apmaglobe@gmail.com';
if(!process.stdin.isTTY)throw Error('Şifrə yalnız şəxsi interaktiv terminalda daxil edilməlidir.');
const connections=JSON.parse(readFileSync('.local/cloud-connection.json','utf8'));
const configured=Object.values(connections).find((x):x is {url:string;secret:string}=>!!x&&typeof x==='object'&&'url' in x&&String(x.url)===`https://${target}.supabase.co`);
if(!configured?.secret)throw Error('Production server açarı təhlükəsiz .local/cloud-connection.json konfiqurasiyasında yoxdur.');
async function hidden(label:string){process.stdout.write(label);process.stdin.setRawMode(true);process.stdin.resume();return new Promise<string>((resolve,reject)=>{let value='';function receive(chunk:Buffer){for(const ch of chunk.toString()){if(ch==='\u0003'){finish();reject(Error('Ləğv edildi'));return;}if(ch==='\r'||ch==='\n'){finish();resolve(value);return;}if(ch==='\u007f'){value=value.slice(0,-1);}else if(ch>=' ')value+=ch;}}function finish(){process.stdin.off('data',receive);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('data',receive);});}
const password=await hidden('Yeni admin şifrəsi (minimum 12 simvol, ekranda görünmür): ');
if(password.length<12)throw Error('Şifrə minimum 12 simvol olmalıdır.');
if(await hidden('Şifrəni təkrar daxil edin: ')!==password)throw Error('Şifrələr uyğun deyil.');
const db=createClient(configured.url,configured.secret,{auth:{persistSession:false,autoRefreshToken:false}});
const {error}=await db.auth.admin.createUser({email,password,email_confirm:true});
if(error)throw Error('Hesab yaradılmadı; mövcud hesabı və Supabase Auth vəziyyətini yoxlayın. Mövcud hesabın şifrəsi dəyişdirilmir.');
console.log('Auth hesabı yaradıldı. CRM giriş səhifəsində TOTP qurun, sonra «İlk admini aktivləşdir» düyməsini seçin. Şifrə fayla yazılmadı.');
