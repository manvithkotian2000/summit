/* Summit app, part 5 of 6: workout logger (per-set kg and reps) and History */
let W=null, H={view:'workouts',ex:'',days:21};

function sheetWorkout(date,focus){
  date=date||todayStr();
  W={date,day:sessionFor(date),open:null,extra:[],items:[]};
  const names=[...new Set((S.library||[]).map(l=>l.name).concat(S.entries.filter(e=>e.type==='Lift').map(e=>e.details)))].sort();
  openSheet(`<h2>Workout</h2>
    <div class="two"><div><label for="wDate">Date</label><input id="wDate" type="date" max="${todayStr()}" value="${date}"></div>
    <div><label for="wDay">Session</label><select id="wDay">${CYCLE.map(c=>`<option value="${c}">${c}</option>`).join('')}<option value="">Other</option></select></div></div>
    <p class="small muted" style="margin-top:10px">Tap an exercise, enter kg and reps for each set, then save.</p>
    <div id="wList"></div>
    <h3 style="margin-top:20px">Add another exercise</h3>
    <div class="addex"><input id="exName" list="exList" placeholder="Exercise name" aria-label="Exercise name"><button class="ghost" id="exAdd">Add</button></div>
    <datalist id="exList">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
    <h3 style="margin-top:20px">Session time or cardio</h3>
    <div class="two"><input id="woTxt" placeholder="e.g. Jump rope" aria-label="Activity"><input id="woMin" type="number" inputmode="numeric" placeholder="Minutes" aria-label="Minutes"></div>
    <button class="ghost" id="woSave">Log minutes</button>
    <button class="cta" id="wDone">Done</button>`);
  $('#wDay').value=W.day;
  $('#wDate').onchange=e=>{W.date=e.target.value||todayStr();W.day=sessionFor(W.date);$('#wDay').value=W.day;W.open=null;W.extra=[];wRender()};
  $('#wDay').onchange=e=>{W.day=e.target.value;W.open=null;wRender()};
  $('#exAdd').onclick=()=>{const n=$('#exName').value.trim();if(!n)return;$('#exName').value='';W.extra.push(n);wOpen(n)};
  $('#woSave').onclick=()=>{const m=Number($('#woMin').value);if(!m)return;addEntry('Workout',{details:$('#woTxt').value.trim(),amount:m,unit:'min',date:W.date});$('#woTxt').value='';$('#woMin').value='';toast('Minutes logged'+forTxt(W.date))};
  $('#wDone').onclick=()=>closeSheet();
  if(focus)wOpen(focus);else wRender();
}
function wOpen(name){wRender();const i=W.items.findIndex(x=>norm(x.name)===norm(name));W.open=i>=0?i:null;wRender()}
const wLogged=n=>(byDate[W.date]||[]).find(e=>e.type==='Lift'&&norm(e.details)===norm(n));
function wItems(){
  const p=planFor(W.date),tp=p&&p.tomorrow,usePlan=tp&&W.day&&tp.day_type===W.day&&(tp.exercises||[]).length;
  const fromLib=l=>({name:l.name,sets:Number(l.sets)||3,reps:String(l.reps||''),target:l.start_kg===''||l.start_kg==null?'':r1(Number(l.start_kg)+barKg(l)),cue:l.cues||'',bar:barKg(l),group:l.group||''});
  let items=usePlan?tp.exercises.filter(x=>x&&x.name).map(x=>{const l=libItem(x.name),tk=parseFloat(x.target_kg);
      return {name:x.name,sets:Number(x.sets)||3,reps:String(x.reps||''),target:isNaN(tk)?'':tk,cue:x.notes||(l&&l.cues)||'',bar:barKg(l),group:l?l.group:''}})
    :(S.library||[]).filter(l=>W.day&&l.day===W.day).map(fromLib);
  const seen=new Set(items.map(i=>norm(i.name)));
  (byDate[W.date]||[]).filter(e=>e.type==='Lift').map(e=>e.details).concat(W.extra).forEach(n=>{
    if(seen.has(norm(n)))return;seen.add(norm(n));const l=libItem(n);
    items.push(l?Object.assign(fromLib(l),{name:n}):{name:n,sets:3,reps:'',target:'',cue:'',bar:0,group:''});
  });
  return items;
}
const setRow=(n,r)=>`<div class="setrow"><span class="num">${n}</span><input class="skg" type="number" inputmode="decimal" step="0.5" placeholder="kg" value="${esc(r.kg)}" aria-label="Set ${n} kg"><input class="srp" type="number" inputmode="numeric" placeholder="reps" value="${esc(r.reps)}" aria-label="Set ${n} reps"><button class="x" aria-label="Remove set">✕</button></div>`;
function wSetsHTML(x,e){
  const last=lastLift(x.name,W.date),ls=last?liftSets(last):[];
  const rows=e?liftSets(e):Array.from({length:Math.max(1,x.sets||ls.length||3)},(_,k)=>({kg:ls[k]?ls[k].kg:x.target,reps:ls[k]?ls[k].reps:(parseInt(x.reps)||'')}));
  const hints=[x.cue,last?'Last time ('+fmtShort(last.date)+'): '+setsText(ls):'',x.target!==''?'Target: '+x.sets+' × '+x.reps+' at '+x.target+' kg':'',x.bar?'Bar is '+x.bar+' kg. Enter the total.':''].filter(Boolean);
  return `<div class="exbody">${hints.map(h=>`<p class="small muted">${esc(h)}</p>`).join('')}
    <div class="sethead small muted"><span>Set</span><span>kg</span><span>Reps</span><span></span></div>
    <div class="sets">${rows.map((r,k)=>setRow(k+1,r)).join('')}</div>
    <div class="two"><button class="ghost" data-act="add">+ Set</button><button class="cta" data-act="save">${e?'Update':'Save'}</button></div>
    ${e?'<button class="link" data-act="del" style="margin-top:8px">Delete this exercise</button>':''}</div>`;
}
function wRender(){
  const items=wItems();W.items=items;
  $('#wList').innerHTML=items.length?items.map((x,i)=>{const e=wLogged(x.name),open=W.open===i;
    const sub=e?setsText(liftSets(e)):x.sets+' × '+x.reps+(x.target!==''&&x.target>0?' · '+x.target+' kg':'');
    return `<div class="excard${e?' done':''}${open?' open':''}"><button class="exhead" data-i="${i}"><span><b>${esc(x.name)}</b><span class="small muted">${esc(sub)}</span></span><i aria-hidden="true">${e?'✓':open?'–':'+'}</i></button>${open?wSetsHTML(x,e):''}</div>`}).join('')
    :'<p class="small muted" style="margin-top:10px">Pick a session, or add an exercise below.</p>';
  $$('#wList .exhead').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.i);W.open=W.open===i?null:i;wRender()});
  const card=$('#wList .excard.open');if(!card)return;
  const x=items[W.open],e=wLogged(x.name),sets=card.querySelector('.sets');
  const renum=()=>[...sets.children].forEach((r,k)=>{r.querySelector('.num').textContent=k+1});
  const bindX=row=>{row.querySelector('.x').onclick=()=>{if(sets.children.length>1){row.remove();renum()}}};
  [...sets.children].forEach(bindX);
  card.querySelector('[data-act=add]').onclick=()=>{const lr=sets.lastElementChild;sets.insertAdjacentHTML('beforeend',setRow(sets.children.length+1,{kg:lr?lr.querySelector('.skg').value:'',reps:lr?lr.querySelector('.srp').value:''}));bindX(sets.lastElementChild)};
  card.querySelector('[data-act=save]').onclick=()=>{
    const list=[...sets.children].map(r=>({kg:Number(r.querySelector('.skg').value)||0,reps:Number(r.querySelector('.srp').value)||0})).filter(s=>s.reps>0);
    if(!list.length)return toast('Add reps for at least one set');
    const {amount,data}=liftData(list,W.day,x.group);
    if(e)editEntry(Object.assign({},e,{amount,data:Object.assign({},e.data,data)}));
    else addEntry('Lift',{details:x.name,amount,unit:'kg',data,date:W.date});
    toast(x.name+' saved'+forTxt(W.date));
    const nx=items.findIndex((y,k)=>k>W.open&&!wLogged(y.name));W.open=nx>=0?nx:null;wRender();
  };
  const del=card.querySelector('[data-act=del]');if(del)del.onclick=()=>{W.open=null;deleteEntry(e.id);wRender()};
  card.scrollIntoView({block:'nearest',behavior:'smooth'});
}

/* ===== History screen ===== */
function renderHistory(){
  const box=$('#histBox');if(!box)return;
  $$('#hSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===H.view));
  if(H.view==='exercise')return renderExHistory(box);
  const f=H.view==='workouts'?e=>e.type==='Lift'||e.type==='Workout':H.view==='meals'?e=>e.type==='Meal':()=>true;
  const days=Object.keys(byDate).filter(d=>byDate[d].some(f)).sort().reverse();
  if(!days.length){box.innerHTML='<div class="block"><p class="small muted">Nothing here yet. Log from Today, or add a past entry above.</p></div>';return}
  box.innerHTML=days.slice(0,H.days).map(d=>dayCard(d,byDate[d].filter(f).sort((a,b)=>a.ts<b.ts?-1:1))).join('')+(days.length>H.days?'<button class="ghost" id="hMore">Show older days</button>':'');
  $$('#histBox [data-id]').forEach(el=>el.onclick=()=>openEntry(el.dataset.id));
  const m=$('#hMore');if(m)m.onclick=()=>{H.days+=21;renderHistory()};
}
function dayCard(d,list){
  const lifts=list.filter(e=>e.type==='Lift'),meals=list.filter(e=>e.type==='Meal');
  const sess=[...new Set(lifts.map(e=>e.data&&e.data.day).filter(Boolean))].join(', ');
  const vol=lifts.reduce((a,e)=>a+volOf(liftSets(e)),0);
  const kcal=meals.reduce((a,e)=>a+(Number(e.data&&e.data.kcal)||0),0),prot=meals.reduce((a,e)=>a+(Number(e.data&&e.data.protein_g)||0),0);
  const meta=[sess,lifts.length?lifts.length+(lifts.length===1?' exercise':' exercises'):'',vol?Math.round(vol).toLocaleString()+' kg lifted':'',kcal?Math.round(kcal)+' kcal, '+Math.round(prot)+' g protein':''].filter(Boolean).join(' · ');
  return `<div class="block hday"><h3>${fmtDay(d)}</h3>${meta?`<p class="small muted">${esc(meta)}</p>`:''}${list.map(e=>`<button class="hrow" data-id="${e.id}"><span aria-hidden="true">${ICON[e.type]||'•'}</span><span>${esc(entryText(e))}</span></button>`).join('')}</div>`;
}
function spark(pts){
  if(pts.length<2)return '';
  const w=300,h=70,xs=pts.map(p=>daysBetween(pts[0].d,p.d)),mx=Math.max(1,xs[xs.length-1]),vs=pts.map(p=>p.v),lo=Math.min(...vs),sp=(Math.max(...vs)-lo)||1;
  const P=pts.map((p,i)=>[(xs[i]/mx*(w-12)+6).toFixed(1),(h-6-(p.v-lo)/sp*(h-12)).toFixed(1)]);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${P.map(q=>q.join(',')).join(' ')}" fill="none" stroke="#FFB547" stroke-width="2.5" stroke-linejoin="round"/>${P.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="2.5" fill="#FFB547"/>`).join('')}</svg>`;
}
function renderExHistory(box){
  const m={};S.entries.forEach(e=>{if(e.type==='Lift'){const k=norm(e.details);if(!m[k]||e.date>m[k].last)m[k]={name:e.details,last:e.date}}});
  const names=Object.values(m).sort((a,b)=>a.last<b.last?1:-1);
  if(!names.length){box.innerHTML='<div class="block"><p class="small muted">No exercises logged yet. Import your WhatsApp history in Me, or log a workout.</p></div>';return}
  if(!H.ex||!m[norm(H.ex)])H.ex=names[0].name;
  const ses=S.entries.filter(e=>e.type==='Lift'&&norm(e.details)===norm(H.ex)).sort((a,b)=>a.date<b.date?-1:1);
  const pts=ses.map(e=>({d:e.date,v:bestE1rm(liftSets(e))})).filter(p=>p.v>0);
  const best=pts.length?pts.reduce((a,b)=>b.v>a.v?b:a):null;
  box.innerHTML=`<div class="block"><label for="hEx" style="margin-top:0">Exercise</label><select id="hEx">${names.map(n=>`<option value="${esc(n.name)}" ${n.name===H.ex?'selected':''}>${esc(n.name)}</option>`).join('')}</select>
    <p class="small" style="margin-top:12px">${ses.length} sessions${best?` · best estimated max <b class="num">${r1(best.v)} kg</b> on ${fmtYear(best.d)}`:''}</p>${spark(pts)}</div>
    <div class="block"><p class="small muted">kg × reps for each set. Tap a session to edit it.</p>${ses.slice().reverse().map(e=>{const l=liftSets(e),v=volOf(l);
      return `<button class="hrow" data-id="${e.id}"><span class="small muted hdate">${fmtDay(e.date)}</span><span>${esc(setsText(l))}${v?`<span class="small muted"> · ${Math.round(v).toLocaleString()} kg</span>`:''}</span></button>`}).join('')}</div>`;
  $('#hEx').onchange=ev=>{H.ex=ev.target.value;renderHistory()};
  $$('#histBox [data-id]').forEach(el=>el.onclick=()=>openEntry(el.dataset.id));
}
