/* Summit app, part 1 of 3: utilities, state, sync, data, logging */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>s==null?'':String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS={get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const daysBetween=(a,b)=>Math.round((new Date(b+'T12:00:00Z')-new Date(a+'T12:00:00Z'))/864e5);
const fmtLong=s=>new Date(s+'T12:00:00Z').toLocaleDateString(undefined,{day:'numeric',month:'long',timeZone:'UTC'});
const fmtShort=s=>new Date(s+'T12:00:00Z').toLocaleDateString(undefined,{day:'numeric',month:'short',timeZone:'UTC'});
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const r1=x=>Math.round(Number(x)*10)/10, r2=x=>Math.round(Number(x)*100)/100;
const fmtV=v=>v==null||isNaN(v)?'–':r1(v);
const norm=s=>String(s||'').toLowerCase().trim().replace(/\s+/g,' ');
const e1rm=(kg,reps)=>Number(kg)*(1+(Number(reps)||1)/30);
const hrs=t=>{const m=String(t||'').match(/(\d{1,2}):(\d{2})/);return m?Number(m[1])+Number(m[2])/60:null};
const COL={train:'#FFB547',fuel:'#6EE7A8',water:'#4FD8F0',sleep:'#B79CFF'};
const ICON={Meal:'🍽️',Water:'💧',Workout:'🏋️',Lift:'🏋️',Weight:'⚖️',Sleep:'😴',Energy:'⚡',Soreness:'🩹',Measure:'📏',Photo:'📸',Note:'📝'};
const METRICS={weight:{label:'Bodyweight',unit:'kg'},waist:{label:'Waist',unit:'cm'},lift:{label:'Estimated max',unit:'kg'},energy:{label:'Energy',unit:'/10'}};

/* ===== State ===== */
let cfg=LS.get('cfg',{});
let S=Object.assign({profile:{},entries:[],plan:null,todayPlan:null,strategy:null},LS.get('cache',{}));
let outbox=LS.get('outbox',[]);
let byDate={}, cur='today', planView='today', trendChart=null, sheetOpen=false;
function indexEntries(){byDate={};S.entries.forEach(e=>{(byDate[e.date]=byDate[e.date]||[]).push(e)})}
function save(){indexEntries();LS.set('cache',S)}

/* ===== Sync with Google Sheets ===== */
async function api(action,payload={}){
  if(!cfg.apiUrl){const e=new Error('Connect your Google Sheet in Me first.');e.api=true;throw e}
  const r=await fetch(cfg.apiUrl,{method:'POST',body:JSON.stringify({token:cfg.token,action,payload})});
  let j;try{j=await r.json()}catch(_){const e=new Error('The web app did not reply with data. Check it is deployed with access set to Anyone.');e.api=true;throw e}
  if(!j.ok){const e=new Error(j.error||'Something went wrong');e.api=true;throw e}
  return j.data;
}
const errMsg=e=>e&&e.api?e.message:'Could not reach your Google Sheet. Check your connection.';
function queue(op,payload){outbox.push({op,payload});LS.set('outbox',outbox);flush()}
let flushP=null;
function flush(){
  if(flushP)return flushP;
  if(!outbox.length||!cfg.apiUrl){setSync();return Promise.resolve()}
  flushP=(async()=>{
    setSync(true);
    while(outbox.length){
      const o=outbox[0];let ok=true;
      try{const res=await api(o.op,o.payload);if(o.op==='estimateMeal')applyEstimate(o.payload.id,res)}
      catch(e){if(!(e.api&&o.op==='estimateMeal')){ok=false;if(e.api)toast(e.message)}}
      if(!ok)break;
      if(outbox[0]===o){outbox.shift();LS.set('outbox',outbox)}
    }
  })().finally(()=>{flushP=null;setSync()});
  return flushP;
}
async function refresh(){
  if(!cfg.apiUrl)return;
  await flush();if(outbox.length)return;
  try{
    const d=await api('bootstrap');
    const pend=new Set();outbox.forEach(o=>{if(o.op==='addEntries')o.payload.entries.forEach(x=>pend.add(x.id))});
    const local=S.entries.filter(e=>pend.has(e.id)&&!d.entries.some(x=>x.id===e.id));
    S=Object.assign(S,d,{entries:d.entries.concat(local)});save();renderAll();
  }catch(e){setSync()}
}
function setSync(busy){
  let c='ok',t='All changes saved to Google Sheets';
  if(!cfg.apiUrl){c='off';t='Not connected yet'}
  else if(busy){c='wait';t='Saving…'}
  else if(outbox.length){c='wait';t=outbox.length+(outbox.length===1?' change':' changes')+' waiting for a connection'}
  else if(!navigator.onLine){c='off';t='Offline. Logging still works.'}
  const d=$('#syncDot');if(d){d.className='sync '+c;d.title=t;d.setAttribute('aria-label',t)}
  const si=$('#syncInfo');if(si)si.textContent=t;
}
function applyEstimate(id,est){const e=S.entries.find(x=>x.id===id);if(!e)return;e.data=Object.assign({},e.data,est);save();if(cur==='today')renderToday()}

/* ===== Data helpers ===== */
function dayStats(date){
  const list=byDate[date]||[];
  const s={water:0,weight:null,sleep:null,energy:[],soreness:null,minutes:0,lifts:[],meals:[],kcal:0,protein:0,volume:0,any:list.length>0};
  for(const e of list){
    const a=e.amount===''||e.amount==null?null:Number(e.amount),d=e.data||{};
    switch(e.type){
      case 'Water':s.water+=a||0;break;
      case 'Weight':if(a)s.weight=a;break;
      case 'Sleep':if(a!=null)s.sleep=(s.sleep||0)+a;break;
      case 'Energy':if(a!=null)s.energy.push(a);break;
      case 'Soreness':if(a!=null)s.soreness=Math.max(s.soreness||0,a);break;
      case 'Workout':s.minutes+=a||0;break;
      case 'Lift':s.lifts.push(e);s.volume+=(a||0)*(Number(d.sets)||1)*(Number(d.reps)||0);break;
      case 'Meal':s.meals.push(e);s.kcal+=Number(d.kcal)||0;s.protein+=Number(d.protein_g)||0;break;
    }
  }
  s.trained=s.minutes>0||s.lifts.length>0;
  return s;
}
function lastWeight(){for(let i=S.entries.length-1;i>=0;i--){const e=S.entries[i];if(e.type==='Weight'&&Number(e.amount))return Number(e.amount)}return null}
function planFor(date){return [S.plan,S.todayPlan].find(p=>p&&p.tomorrow&&p.tomorrow.date===date)||null}
function targets(){
  const p=S.profile||{},pl=planFor(todayStr()),tp=pl&&pl.tomorrow,n=(tp&&tp.nutrition)||{};
  const w=Number(lastWeight()||p.weight||70);
  return {water:Number(p.water_target)||Number(tp&&tp.water_L)||r1(w*0.035),protein:Number(n.protein_g)||Math.round(w*1.8),
    sleep:Number(tp&&tp.sleep_h)||8,minutes:Number(tp&&tp.duration_min)||45,exercises:((tp&&tp.exercises)||[]).filter(x=>x&&x.name),
    rest:!!(tp&&/rest|recovery/i.test(tp.focus||'')),tp};
}
function ringStatus(){
  const s=dayStats(todayStr()),t=targets();
  const planned=t.exercises.length,doneEx=new Set(s.lifts.map(e=>norm(e.details))).size;
  const train=t.rest?(s.any?1:0):Math.max(s.minutes/t.minutes,planned?doneEx/planned:0);
  return {train,fuel:s.protein/t.protein,water:s.water/t.water,sleep:(s.sleep||0)/t.sleep,s,t,doneEx,planned};
}
function waterPaceFrac(){
  const p=S.profile||{};const wake=hrs(p.wake_time)??7;let sl=hrs(p.sleep_time)??23;
  const n=new Date();let h=n.getHours()+n.getMinutes()/60;
  if(sl<=wake){sl+=24;if(h<wake)h+=24}
  return clamp((h-wake)/Math.max(1,sl-1-wake),0,1);
}
function consistency(n){
  const p=S.profile||{},t=todayStr(),start=p.journey_start||t;let days=0,trained=0,logged=0;
  for(let i=0;i<n;i++){const d=addDays(t,-i);if(d<start)break;const s=dayStats(d);if(i===0&&!s.any)continue;days++;if(s.trained)trained++;if(s.any)logged++}
  const exp=Math.max(1,Math.round((Number(p.days_per_week)||4)*Math.max(days,1)/7));
  const trainPct=Math.min(1,trained/exp),logPct=days?logged/days:0;
  return {days,trained,logged,exp,trainPct,score:days?Math.round((trainPct*.6+logPct*.4)*100):0};
}

/* ===== Logging ===== */
function addEntry(type,{details='',amount='',unit='',data={}}={}){
  const before=ringStatus();
  const e={id:uid(),ts:new Date().toISOString(),date:todayStr(),type,details,amount,unit,data};
  S.entries.push(e);save();
  queue('addEntries',{entries:[e]});
  if(type==='Meal'&&details)queue('estimateMeal',{id:e.id,details});
  if(navigator.vibrate)navigator.vibrate(12);
  renderToday();celebrate(before);
  return e;
}
function deleteEntry(id){
  const i=S.entries.findIndex(e=>e.id===id);if(i<0)return;
  const [e]=S.entries.splice(i,1);
  const qi=outbox.findIndex(o=>o.op==='addEntries'&&o.payload.entries.some(x=>x.id===id));
  if(qi>0){outbox.splice(qi,1);for(let k=outbox.length-1;k>=0;k--)if(outbox[k].op==='estimateMeal'&&outbox[k].payload.id===id)outbox.splice(k,1);LS.set('outbox',outbox)}
  else queue('deleteEntry',{id});
  save();renderToday();
  toast('Entry deleted','Undo',()=>{S.entries.push(e);S.entries.sort((a,b)=>a.ts<b.ts?-1:1);save();queue('addEntries',{entries:[e]});renderToday()});
}
function celebrate(before){
  const after=ringStatus(),names={train:'Training',fuel:'Protein',water:'Water',sleep:'Sleep'};
  const closed=Object.keys(names).filter(k=>before[k]<1&&after[k]>=1);
  if(!closed.length)return;
  const svg=$('#rings');svg.classList.remove('pop');void svg.getBoundingClientRect();svg.classList.add('pop');
  if(navigator.vibrate)navigator.vibrate([20,40,20]);
  const all=['train','fuel','water','sleep'].every(k=>after[k]>=1);
  toast(all?'All four rings closed. That is a complete day.':names[closed[0]]+' ring closed. Nice work.');
}
function entryText(e){
  const a=e.amount,d=e.data||{};
  switch(e.type){
    case 'Water':return r2(a)+' L water';
    case 'Meal':return e.details+(d.protein_g!=null?' (about '+Math.round(d.kcal)+' kcal, '+Math.round(d.protein_g)+' g protein)':'');
    case 'Lift':return e.details+', '+(d.sets||'?')+' × '+(d.reps||'?')+(a!==''&&a!=null?' at '+a+' kg':'');
    case 'Workout':return a+' min'+(e.details?', '+e.details:'');
    case 'Weight':return a+' kg';
    case 'Sleep':return a+' h sleep';
    case 'Energy':return 'Energy '+a+'/10';
    case 'Soreness':return 'Soreness '+a+'/10'+(e.details?', '+e.details:'');
    case 'Measure':return e.details+' '+a+' cm';
    case 'Photo':return 'Progress photo';
    default:return e.details;
  }
}
const pending=id=>outbox.some(o=>o.op==='addEntries'&&o.payload.entries.some(x=>x.id===id));
