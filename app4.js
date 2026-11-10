/* Summit app, part 4 of 4: monthly report, Me screen, app shell */
const prevMonth=ym=>{const [y,m]=ym.split('-').map(Number);const d=new Date(Date.UTC(y,m-2,15));return d.toISOString().slice(0,7)};
const monthName=ym=>{const [y,m]=ym.split('-').map(Number);return new Date(Date.UTC(y,m-1,15)).toLocaleDateString(undefined,{month:'long',timeZone:'UTC'})};
function reportMonths(){const t=todayStr(),thisM=t.endsWith('-01')?prevMonth(t.slice(0,7)):t.slice(0,7);return {thisM,prevM:prevMonth(thisM)}}
function monthStats(ym){
  const t=todayStr();let trained=0,logged=0,vol=0,waist=null;const water=[],sleep=[],weight=[];
  for(let d=ym+'-01';d.slice(0,7)===ym&&d<=t;d=addDays(d,1)){
    const s=dayStats(d);if(s.trained)trained++;if(s.any)logged++;if(s.water>0)water.push(s.water);if(s.sleep)sleep.push(s.sleep);if(s.weight)weight.push(s.weight);vol+=s.volume;
    const w=(byDate[d]||[]).filter(e=>e.type==='Measure'&&/waist/i.test(e.details)).pop();if(w)waist=Number(w.amount);
  }
  return {trained,logged,water:avg(water),sleep:avg(sleep),weight:avg(weight),vol,waist};
}
function equivalent(v){
  if(v<150)return '';
  const E=[[40000,'loaded trucks','a loaded truck'],[12000,'city buses','a city bus'],[5000,'elephants','an elephant'],[1200,'cars','a car'],[150,'motorbikes','a motorbike']];
  const [w,pl,sg]=E.find(e=>v>=e[0]),n=v/w;return n<1.5?sg:r1(n)+' '+pl;
}
function openReport(){
  const {thisM,prevM}=reportMonths(),a=monthStats(prevM),b=monthStats(thisM);
  const f=(v,u)=>v==null||(v===0&&u==='')?'–':(u===' kg lifted'?Math.round(v).toLocaleString()+' kg':r1(v)+u);
  const rows=[['Training sessions',a.trained,b.trained,'',1],['Days logged',a.logged,b.logged,'',1],['Water per day',a.water,b.water,' L',1],['Sleep per night',a.sleep,b.sleep,' h',1],['Average weight',a.weight,b.weight,' kg',0],['Waist',a.waist,b.waist,' cm',0],['Total lifted',a.vol,b.vol,' kg lifted',1]];
  const eq=equivalent(b.vol);
  openSheet(`<p class="small muted">${monthName(prevM)} compared with ${monthName(thisM)}</p><h2>${monthName(thisM)} report</h2>
    <div class="cmp"><span></span><span class="small muted h">${monthName(prevM)}</span><span class="small muted h">${monthName(thisM)}</span>
    ${rows.map(([l,x,y,u,up])=>`<span class="small">${l}</span><b>${f(x,u)}</b><b class="${up&&x!=null&&y!=null&&y>x?'pos':''}">${f(y,u)}</b>`).join('')}</div>
    ${eq?`<div class="block coach"><p>This month you lifted <b class="num">${Math.round(b.vol).toLocaleString()} kg</b> in total. That is about the weight of ${eq}.</p></div>`:''}
    <div id="photos"></div><button class="ghost" id="repClose">Close</button>`);
  $('#repClose').onclick=()=>closeSheet();
  const ph=S.entries.filter(e=>e.type==='Photo');
  if(!ph.length){$('#photos').innerHTML='<p class="small muted">Take a progress photo from the log. Next month you will see then and now side by side.</p>';return}
  const pics=ph.length>1?[ph[0],ph[ph.length-1]]:[ph[0]];
  $('#photos').innerHTML='<h3>Then and now</h3><div class="pics">'+pics.map((e,i)=>`<figure><img id="pic${i}" alt="Progress photo from ${fmtLong(e.date)}"><figcaption class="small muted">${fmtLong(e.date)}</figcaption></figure>`).join('')+'</div>';
  if(navigator.onLine)pics.forEach((e,i)=>api('getPhoto',{fileId:e.details}).then(r=>{const im=$('#pic'+i);if(im)im.src='data:image/jpeg;base64,'+r.base64}).catch(()=>{}));
}
function renderJourney(){
  const J=journey();
  $('#goalLine').textContent=J.ok?J.label+': '+fmtV(J.start)+' to '+fmtV(J.target)+' '+J.unit:'No summit set yet';
  $('#arrival').textContent=J.headline;$('#arrivalSub').textContent=J.sub;
  drawTrail(J);renderChapter();renderConsistency();drawTrend(J);renderWins();
  $('#reportBtn').textContent='Open '+monthName(reportMonths().thisM)+' report';
}
async function freshStart(){
  if(!navigator.onLine)return toast('Connect to the internet to start a new chapter.');
  try{S.profile=await api('freshStart');save();renderAll();toast('Chapter '+S.profile.chapter_no+' starts '+fmtLong(S.profile.chapter_start))}catch(e){toast(errMsg(e))}
}

/* ===== Me screen ===== */
function renderMe(){
  const p=S.profile||{};
  const f=(n,l,type='text',extra='',def='')=>`<label for="f_${n}">${l}</label><input id="f_${n}" name="${n}" type="${type}" ${extra} value="${esc(p[n]||def)}">`;
  const sel=(n,l,opts)=>`<label for="f_${n}">${l}</label><select id="f_${n}" name="${n}">${opts.map(o=>{const [v,t]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(p[n]||'')===String(v)?'selected':''}>${esc(t)}</option>`}).join('')}</select>`;
  $('#meBox').innerHTML=`${!cfg.apiUrl?'<div class="block coach"><h2>Welcome to Summit</h2><p class="small">Connect your Google Sheet below to begin. The setup guide shows where to find both values.</p></div>':''}
  <form id="connForm" class="block"><h3>Google Sheet connection</h3>
    <label for="c_url">Web app URL</label><input id="c_url" name="apiUrl" type="url" value="${esc(cfg.apiUrl||'')}" placeholder="https://script.google.com/macros/s/.../exec" required>
    <label for="c_tok">App token</label><input id="c_tok" name="token" type="password" value="${esc(cfg.token||'')}" required>
    <button class="cta" type="submit">Connect</button><p class="small muted" id="syncInfo" style="margin-top:10px"></p></form>
  <form id="profForm" class="block"><h3>About you</h3>
    ${f('name','Name')}
    <div class="two">${f('age','Age','number','inputmode="numeric"')}${sel('sex','Sex',[['male','Male'],['female','Female']])}</div>
    <div class="two">${f('height','Height (cm)','number','inputmode="decimal"')}${f('weight','Current weight (kg)','number','inputmode="decimal" step="0.1"')}</div>
    ${f('body_fat','Body fat % (if you know it)','number','step="0.1"')}
    ${sel('objective','Main objective',['Build muscle','Lose fat','High energy all day','Get stronger','Improve endurance','General fitness'])}
    ${f('objective_details','What would make this a success for you?','text','placeholder="e.g. Fit into size 32 jeans by March"')}
    <div class="two">${sel('experience','Experience',[['beginner','Beginner'],['intermediate','Intermediate'],['advanced','Advanced']])}${f('days_per_week','Training days a week','number','min="1" max="7"','4')}</div>
    ${sel('activity','Activity outside workouts',[['sedentary','Mostly sitting'],['light','Lightly active'],['moderate','Moderately active'],['very','Very active']])}
    ${sel('equipment','Equipment',['Full gym','Home dumbbells','Bodyweight only'])}
    <div class="two">${sel('diet','Diet',['Non-vegetarian','Eggetarian','Vegetarian','Vegan'])}${f('cuisine','Usual cuisine','text','placeholder="e.g. North Indian"')}</div>
    ${f('injuries','Injuries or medical conditions')}
    <h3 style="margin-top:26px">Your summit</h3>
    ${sel('goal_metric','Measure progress by',[['weight','Bodyweight (kg)'],['waist','Waist (cm)'],['lift','A lift, estimated max (kg)'],['energy','Energy score (1 to 10)']])}
    <div id="exWrap">${f('goal_exercise','Which lift?','text','placeholder="e.g. Bench press"')}</div>
    <div class="two">${f('goal_start','Starting value','number','step="0.1"')}${f('goal_target','Target value','number','step="0.1"')}</div>
    ${f('goal_date','Target date (optional)','date')}
    <h3 style="margin-top:26px">Daily rhythm</h3>
    <div class="two">${f('wake_time','Usually wake at','time','','07:00')}${f('sleep_time','Usually sleep at','time','','23:00')}</div>
    ${f('water_target','Fixed water target in litres (optional)','number','step="0.1" placeholder="Leave blank and your coach sets it"')}
    <button class="cta" type="submit">Save profile</button></form>
  <div class="block"><h3>Water reminders</h3><p class="small muted">Arrive through the ntfy app when you fall behind pace, at most every two hours between your wake and sleep times.</p><button class="ghost" id="testNotif">Send a test reminder</button></div>`;
  $('#connForm').onsubmit=async e=>{e.preventDefault();const d=new FormData(e.target);cfg={apiUrl:String(d.get('apiUrl')).trim(),token:String(d.get('token')).trim()};LS.set('cfg',cfg);
    try{await api('bootstrap');toast('Connected to your Google Sheet');await refresh();renderMe()}catch(err){toast(errMsg(err))}};
  $('#profForm').onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());S.profile=Object.assign({},S.profile,data);save();queue('saveProfile',{profile:data});toast('Profile saved');refresh();renderToday()};
  const gm=$('#f_goal_metric'),tog=()=>{$('#exWrap').style.display=gm.value==='lift'?'':'none'};gm.onchange=tog;tog();
  $('#testNotif').onclick=async()=>{try{const r=await api('testNotification');toast(r==='sent'?'Test reminder sent. Check your phone.':r)}catch(err){toast(errMsg(err))}};
  setSync();
}

/* ===== Shell ===== */
let toastT;
function toast(msg,action,fn){
  const t=$('#toast');t.innerHTML=`<span>${esc(msg)}</span>${action?`<button>${esc(action)}</button>`:''}`;t.classList.add('on');
  if(action)t.querySelector('button').onclick=()=>{t.classList.remove('on');fn()};
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),action?5000:2600);
}
function show(s){
  cur=s;$$('.screen').forEach(x=>x.classList.toggle('on',x.id===s));
  $$('.tabs button').forEach(b=>{const on=b.dataset.s===s;b.classList.toggle('on',on);b.setAttribute('aria-current',on?'page':'false')});
  if(s==='journey')renderJourney();if(s==='me')renderMe();if(s==='plan')renderPlan();if(s==='today')renderToday();
  scrollTo(0,0);
}
function renderAll(){renderToday();renderPlan();if(cur==='journey')renderJourney();setSync()}
function maybeReport(){
  const t=todayStr();
  if(t.endsWith('-01')&&!LS.get('rep_'+t,false)&&S.entries.some(e=>e.date<t)){LS.set('rep_'+t,true);show('journey');openReport()}
}
function init(){
  indexEntries();
  $('#quick').innerHTML=QUICK.map(([k],i)=>`<button class="qbtn" data-i="${i}"><span aria-hidden="true">${ICON[k]}</span>${k}</button>`).join('');
  $$('#quick .qbtn').forEach(b=>b.onclick=()=>QUICK[b.dataset.i][1]());
  $$('.wbtns button').forEach(b=>b.onclick=()=>addEntry('Water',{amount:Number(b.dataset.w),unit:'L'}));
  $('#wUndo').onclick=()=>{const w=(byDate[todayStr()]||[]).filter(e=>e.type==='Water').pop();if(w)deleteEntry(w.id)};
  $$('.tabs button').forEach(b=>b.onclick=()=>show(b.dataset.s));
  $$('#seg button').forEach(b=>b.onclick=()=>{planView=b.dataset.v;setSeg();renderPlan()});
  $('#genBtn').onclick=()=>generate(false);$('#rebuildBtn').onclick=()=>generate(true);$('#reportBtn').onclick=openReport;
  show(cfg.apiUrl?'today':'me');
  refresh().then(maybeReport);
  addEventListener('online',refresh);addEventListener('offline',()=>setSync());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderAll();refresh()}});
  setInterval(()=>{if(!document.hidden&&cur==='today')renderToday()},60000);
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
}
init();
