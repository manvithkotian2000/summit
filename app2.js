/* Summit app, part 2 of 3: Today screen, logging sheets, Plan screen */
function ringsSVG(st){
  return [['train',86],['fuel',66],['water',46],['sleep',26]].map(([k,r])=>{
    const C=2*Math.PI*r,f=clamp(st[k]||0,0,1);
    return `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${COL[k]}" stroke-opacity=".16" stroke-width="15"/>
    <circle class="arc" cx="100" cy="100" r="${r}" fill="none" stroke="${COL[k]}" stroke-width="15" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-f)}" transform="rotate(-90 100 100)"/>`;
  }).join('');
}
function bannerHTML(){
  const p=S.profile||{},t=todayStr();
  if(!cfg.apiUrl)return '<div class="banner"><h3>Finish setting up</h3><p class="small">Connect your Google Sheet in Me so your logs are saved and your coach can plan for you.</p></div>';
  if(!p.age)return '<div class="banner"><h3>Tell your coach about you</h3><p class="small">Add your details and your goal in Me. It takes two minutes.</p></div>';
  if(p.chapter_start&&p.chapter_start>t)return `<div class="banner cyan"><h3>Chapter ${esc(p.chapter_no)} begins ${fmtLong(p.chapter_start)}</h3><p class="small">Your records and totals carry over. Until then, keep logging as usual.</p></div>`;
  const started=p.journey_start&&p.journey_start<t;
  if(started&&!(byDate[addDays(t,-1)]||[]).length)return '<div class="banner cyan"><h3>Comeback day</h3><p class="small">Missing one day changes nothing about your progress. Today the short version counts as a full win.</p></div>';
  const c=consistency(7);
  if(started&&daysBetween(p.journey_start,t)>=7&&c.trainPct<.5)return `<div class="banner"><h3>A slower week happens to everyone</h3><p class="small">You still have every record you've set. Want a clean slate? Start a fresh chapter on Monday.</p><button class="ghost" id="freshBtn">Start chapter ${Number(p.chapter_no||1)+1} on Monday</button></div>`;
  return '';
}
function renderToday(){
  const st=ringStatus(),{s,t}=st,p=S.profile||{},h=new Date().getHours();
  $('#hello').textContent=(h<12?'Good morning':h<17?'Good afternoon':'Good evening')+(p.name?', '+String(p.name).split(' ')[0]:'');
  $('#dateLine').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
  $('#banner').innerHTML=bannerHTML();const fb=$('#freshBtn');if(fb)fb.onclick=freshStart;
  $('#rings').innerHTML=ringsSVG(st);
  const closed=['train','fuel','water','sleep'].filter(k=>st[k]>=1).length;
  const trainTxt=t.rest?'Rest day':st.planned?st.doneEx+' of '+st.planned+' exercises':s.minutes+' of '+t.minutes+' min';
  $('#ringLegend').innerHTML=`<p class="small muted">${closed===4?'All four rings closed':closed+' of 4 rings closed'}</p>`+
    [['train','Train',trainTxt],['fuel','Protein',Math.round(s.protein)+' of '+t.protein+' g'],['water','Water',r2(s.water)+' of '+t.water+' L'],['sleep','Sleep',(s.sleep??0)+' of '+t.sleep+' h']]
    .map(([k,l,v])=>`<div class="lg"><span><i style="background:${COL[k]}"></i>${l}</span><b>${v}</b></div>`).join('');
  const pace=waterPaceFrac(),exp=t.water*pace,behind=r2(exp-s.water);
  $('#wDrunk').textContent=r2(s.water);$('#wTarget').textContent=t.water;
  $('#wFill').style.width=(clamp(s.water/t.water,0,1)*100)+'%';
  $('#wPace').style.left='calc('+(pace*100)+'% - 1px)';
  $('#wMsg').textContent=s.water>=t.water?'Target reached. Drink to thirst from here.':behind>.15?behind+' L behind pace. One or two glasses now catches you up.':'On pace. '+r2(t.water-s.water)+' L to go today.';
  const list=(byDate[todayStr()]||[]).slice().reverse();
  $('#entryList').innerHTML=list.length?list.map(e=>`<div class="entry"><span class="ei" aria-hidden="true">${ICON[e.type]||'•'}</span><div class="et"><b>${esc(entryText(e))}</b><span class="small muted">${new Date(e.ts).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}${pending(e.id)?', waiting to sync':''}</span></div><button class="x" data-id="${e.id}" aria-label="Delete this entry">✕</button></div>`).join(''):'<p class="small muted">Nothing logged yet. A glass of water is a good start.</p>';
  $$('#entryList .x').forEach(b=>b.onclick=()=>deleteEntry(b.dataset.id));
  setSync();
}

/* ===== Bottom sheets ===== */
function openSheet(html){$('#sheetBody').innerHTML=html;$('#sheetWrap').classList.add('on');document.body.style.overflow='hidden';if(!sheetOpen){history.pushState({sheet:1},'');sheetOpen=true}}
function closeSheet(fromPop){if(!sheetOpen)return;sheetOpen=false;$('#sheetWrap').classList.remove('on');document.body.style.overflow='';if(fromPop!==true)history.back()}
addEventListener('popstate',()=>{if(sheetOpen)closeSheet(true)});
$('#sheetWrap').addEventListener('click',e=>{if(e.target.id==='sheetWrap')closeSheet()});

function sheetMeal(){
  const recent=[...new Set(S.entries.filter(e=>e.type==='Meal').slice(-40).reverse().map(e=>e.details))].slice(0,6);
  openSheet(`<h2>What did you eat or drink?</h2><p class="small muted">Rough quantities are enough. Your coach estimates protein and calories.</p>
    <textarea id="mealTxt" rows="3" aria-label="Meal" placeholder="2 rotis, a bowl of dal, paneer sabzi, a glass of buttermilk"></textarea>
    ${recent.length?'<p class="small muted" style="margin-top:12px">Tap to repeat a recent meal</p><div class="chips">'+recent.map(m=>`<button class="chip" data-m="${esc(m)}">${esc(m.length>40?m.slice(0,40)+'…':m)}</button>`).join('')+'</div>':''}
    <button class="cta" id="mealSave">Log meal</button>`);
  $$('#sheetBody [data-m]').forEach(b=>b.onclick=()=>{$('#mealTxt').value=b.dataset.m});
  $('#mealSave').onclick=()=>{const v=$('#mealTxt').value.trim();if(!v)return;addEntry('Meal',{details:v});closeSheet();toast('Meal logged. Estimating protein…')};
}
function sheetWorkout(){
  const t=targets(),today=todayStr();
  const done=new Set((byDate[today]||[]).filter(e=>e.type==='Lift').map(e=>norm(e.details)));
  const names=[...new Set(S.entries.filter(e=>e.type==='Lift').map(e=>e.details))];
  const lastKg=name=>{const l=S.entries.filter(e=>e.type==='Lift'&&norm(e.details)===norm(name)&&e.amount!=='').pop();return l?l.amount:''};
  const planned=t.exercises;
  openSheet(`<h2>Workout</h2>
    ${planned.length?`<p class="small muted">From today's plan. Check the weight, then tick each exercise off.</p><div id="plist">${planned.map((x,i)=>`<div class="exrow ${done.has(norm(x.name))?'done':''}" data-i="${i}"><div class="exname">${esc(x.name)}<span class="small muted">${esc(x.sets)} × ${esc(x.reps)}</span></div><input class="kg" type="number" inputmode="decimal" step="0.5" placeholder="kg" aria-label="Weight for ${esc(x.name)}" value="${esc(lastKg(x.name)||x.target_kg||'')}"><button class="tick" aria-label="Mark ${esc(x.name)} done">✓</button></div>`).join('')}</div>`:'<p class="small muted">No plan for today yet. Add what you did below.</p>'}
    <h3 style="margin-top:20px">Add an exercise</h3>
    <input id="exName" list="exList" placeholder="Exercise, e.g. Bench press" aria-label="Exercise name"><datalist id="exList">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
    <div class="row3"><input id="exSets" type="number" inputmode="numeric" placeholder="Sets" aria-label="Sets"><input id="exReps" type="number" inputmode="numeric" placeholder="Reps" aria-label="Reps"><input id="exKg" type="number" inputmode="decimal" step="0.5" placeholder="kg" aria-label="Weight in kg"></div>
    <button class="ghost" id="exAdd">Add exercise</button>
    <h3 style="margin-top:20px">Session time or cardio</h3>
    <div class="two"><input id="woTxt" placeholder="e.g. Brisk walk" aria-label="Activity"><input id="woMin" type="number" inputmode="numeric" placeholder="Minutes" aria-label="Minutes"></div>
    <button class="cta" id="woSave">Log minutes</button>`);
  $$('#plist .exrow').forEach(row=>{row.querySelector('.tick').onclick=()=>{
    if(row.classList.contains('done'))return;const x=planned[row.dataset.i];
    addEntry('Lift',{details:x.name,amount:row.querySelector('.kg').value,unit:'kg',data:{sets:Number(x.sets)||1,reps:parseInt(x.reps)||''}});row.classList.add('done')}});
  $('#exAdd').onclick=()=>{const n=$('#exName').value.trim();if(!n)return;
    addEntry('Lift',{details:n,amount:$('#exKg').value,unit:'kg',data:{sets:Number($('#exSets').value)||1,reps:Number($('#exReps').value)||''}});
    ['#exName','#exSets','#exReps','#exKg'].forEach(s=>$(s).value='');toast(n+' logged')};
  $('#woSave').onclick=()=>{const m=Number($('#woMin').value);if(!m)return;addEntry('Workout',{details:$('#woTxt').value.trim(),amount:m,unit:'min'});closeSheet();toast('Session logged')};
}
function sheetNumber(kind){
  const c={Weight:{t:'Morning weight',u:'kg',step:.1,start:lastWeight()||Number(S.profile.weight)||70,hint:'Weigh after waking and using the toilet, before eating.'},
           Sleep:{t:'Sleep last night',u:'hours',step:.5,start:7.5,hint:'Log a nap separately and it adds up.'}}[kind];
  openSheet(`<h2>${c.t}</h2><p class="small muted">${c.hint}</p><div class="stepper"><button type="button" id="nMinus" aria-label="Decrease">−</button><input id="nVal" type="number" inputmode="decimal" step="${c.step}" value="${c.start}" aria-label="${c.t}"><button type="button" id="nPlus" aria-label="Increase">+</button></div><p class="small muted" style="text-align:center">${c.u}</p><button class="cta" id="nSave">Log ${kind.toLowerCase()}</button>`);
  const inp=$('#nVal'),adj=d=>{inp.value=r1(Number(inp.value||0)+d)};
  $('#nMinus').onclick=()=>adj(-c.step);$('#nPlus').onclick=()=>adj(c.step);
  $('#nSave').onclick=()=>{const v=Number(inp.value);if(!v)return;addEntry(kind,{amount:v,unit:kind==='Weight'?'kg':'h'});closeSheet();toast(kind+' logged')};
}
function sheetScale(kind){
  const en=kind==='Energy';
  openSheet(`<h2>${en?'How is your energy right now?':'How sore are you?'}</h2><p class="small muted">${en?'1 is drained, 10 is buzzing.':'1 is barely, 10 is struggling to move.'}</p>
    ${en?'':'<label for="sWhere">Where (optional)</label><input id="sWhere" placeholder="e.g. legs, lower back">'}
    <div class="scale">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button data-n="${n}">${n}</button>`).join('')}</div>`);
  $$('#sheetBody .scale button').forEach(b=>b.onclick=()=>{addEntry(kind,{amount:Number(b.dataset.n),unit:'/10',details:en?'':$('#sWhere').value.trim()});closeSheet();toast(kind+' logged')});
}
function sheetMeasure(){
  openSheet(`<h2>Body measurement</h2><p class="small muted">Measure in the morning with the tape snug but not tight.</p>
    <label for="mPart">Where</label><select id="mPart"><option>Waist</option><option>Chest</option><option>Arm</option><option>Hips</option><option>Thigh</option></select>
    <label for="mVal">Centimetres</label><input id="mVal" type="number" inputmode="decimal" step="0.5"><button class="cta" id="mSave">Log measurement</button>`);
  $('#mSave').onclick=()=>{const v=Number($('#mVal').value);if(!v)return;addEntry('Measure',{details:$('#mPart').value,amount:v,unit:'cm'});closeSheet();toast('Measurement logged')};
}
function compress(file){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const k=Math.min(1,900/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);res(c.toDataURL('image/jpeg',.82).split(',')[1])};img.onerror=rej;img.src=URL.createObjectURL(file)})}
function sheetPhoto(){
  openSheet(`<h2>Progress photo</h2><p class="small muted">Same spot, same light, same pose each time. Photos go to a private folder in your Google Drive.</p>
    <label class="cta" style="color:#2A1A00">Take or choose a photo<input id="phIn" type="file" accept="image/*" capture="environment" hidden></label><p class="small" id="phMsg"></p>`);
  $('#phIn').onchange=async e=>{const f=e.target.files[0];if(!f)return;
    if(!navigator.onLine||!cfg.apiUrl){$('#phMsg').textContent='Photos need a connection to upload.';return}
    $('#phMsg').textContent='Uploading…';
    try{const b64=await compress(f);const r=await api('uploadPhoto',{base64:b64,date:todayStr()});addEntry('Photo',{details:r.fileId});closeSheet();toast('Photo saved to your Drive')}
    catch(err){$('#phMsg').textContent=errMsg(err)}};
}
function sheetNote(){
  openSheet(`<h2>Note</h2><p class="small muted">Stress, pain, mood, travel. Anything your coach should know.</p><textarea id="ntTxt" rows="3" aria-label="Note"></textarea><button class="cta" id="ntSave">Save note</button>`);
  $('#ntSave').onclick=()=>{const v=$('#ntTxt').value.trim();if(!v)return;addEntry('Note',{details:v});closeSheet();toast('Note saved')};
}
const QUICK=[['Meal',sheetMeal],['Workout',sheetWorkout],['Weight',()=>sheetNumber('Weight')],['Sleep',()=>sheetNumber('Sleep')],['Energy',()=>sheetScale('Energy')],['Soreness',()=>sheetScale('Soreness')],['Measure',sheetMeasure],['Photo',sheetPhoto],['Note',sheetNote]];

/* ===== Plan screen ===== */
function setSeg(){$$('#seg button').forEach(b=>b.classList.toggle('on',b.dataset.v===planView))}
function dayPlanHTML(t,note,label){
  const n=t.nutrition||{};
  const ex=(t.exercises||[]).map(x=>`<li><div><b>${esc(x.name)}</b>${x.notes?`<span class="small muted">${esc(x.notes)}</span>`:''}</div><span class="exm">${esc(x.sets)} × ${esc(x.reps)}${x.target_kg?`<br><span class="small muted">${esc(x.target_kg)} kg</span>`:''}</span></li>`).join('');
  const meals=(n.meals||[]).map(m=>`<li><div><b>${esc(m.time)}</b><span class="small">${esc(m.meal)}</span></div><span class="exm small muted">${esc(m.approx_kcal)} kcal${m.protein_g?`<br>${esc(m.protein_g)} g protein`:''}</span></li>`).join('');
  return `<div class="block"><p class="small muted">${label}</p><h2>${esc(t.focus)}</h2><p class="small muted">${t.duration_min?esc(t.duration_min)+' minutes. ':''}Warm-up: ${esc(t.warmup)}</p><ul class="plist">${ex}</ul>${t.cardio?`<p class="small"><b>Cardio:</b> ${esc(t.cardio)}</p>`:''}${t.cooldown?`<p class="small"><b>Cool-down:</b> ${esc(t.cooldown)}</p>`:''}</div>
  <div class="block"><h3>Food</h3><div class="macros"><div><b class="num">${esc(n.calories)}</b><span>kcal</span></div><div><b class="num">${esc(n.protein_g)}</b><span>protein g</span></div><div><b class="num">${esc(n.carbs_g)}</b><span>carbs g</span></div><div><b class="num">${esc(n.fat_g)}</b><span>fat g</span></div></div><ul class="plist">${meals}</ul></div>
  <div class="block"><div class="two"><div><h3 style="color:${COL.water}">${esc(t.water_L)} L water</h3><p class="small muted">${esc(t.water_schedule)}</p></div><div><h3 style="color:${COL.sleep}">${esc(t.sleep_h)} h sleep</h3><p class="small muted">${esc(t.recovery_tips)}</p></div></div></div>
  ${note?`<div class="block coach"><h3>From your coach</h3><p>${esc(note)}</p></div>`:''}`;
}
function renderPlan(){
  const box=$('#planBox'),t=todayStr(),st=S.strategy;
  if(planView==='today'||planView==='tomorrow'){
    const d=planView==='today'?t:addDays(t,1),p=planFor(d);
    box.innerHTML=p?dayPlanHTML(p.tomorrow,p.coach_note,fmtLong(d)):`<div class="block"><h3>No plan for ${planView} yet</h3><p class="small muted">${planView==='today'?'Plans are made the evening before. Tap the button below to plan tomorrow.':'Log your day, then tap the button below. Your coach also makes one automatically every night.'}</p></div>`;
  }else if(planView==='week'){
    const wk=(st&&st.week)||[];
    box.innerHTML=wk.length?'<div class="block">'+wk.map(d=>`<div class="wkrow ${d.date===t?'now':''}"><div class="wkd"><b>${esc(String(d.day||'').slice(0,3))}</b><span class="small muted">${d.date?esc(fmtShort(d.date)):''}</span></div><div><b>${esc(d.focus)}</b><p class="small muted">${esc(d.key_work)}</p><p class="small">${esc(d.calories)} kcal, ${esc(d.protein_g)} g protein</p></div></div>`).join('')+'</div>':'<div class="block"><p class="small muted">No week plan yet. Make your first plan below.</p></div>';
  }else{
    const m=(st&&st.month)||{},wkNo=st?Math.floor(Math.max(0,daysBetween(addDays(st.created.slice(0,10),1),t))/7)+1:0;
    box.innerHTML=m.weeks?`<div class="block coach"><p class="small muted">Chapter ${esc(S.profile.chapter_no||1)}</p><h2>${esc(m.title||'This chapter')}</h2><p class="small">${esc(m.goal)}</p></div>`+m.weeks.map(w=>`<div class="block" ${Number(w.week)===wkNo?'style="outline:2px solid var(--sun)"':''}><p class="small muted">Week ${esc(w.week)}${w.dates?', '+esc(w.dates):''}${Number(w.week)===wkNo?', you are here':''}</p><h3>${esc(w.phase)}</h3><p class="small">${esc(w.focus)}</p><p class="small muted">Intensity: ${esc(w.intensity)}<br>Targets: ${esc(w.targets)}</p></div>`).join(''):'<div class="block"><p class="small muted">No month plan yet. Make your first plan below.</p></div>';
  }
}
async function generate(full){
  if(!navigator.onLine)return toast('You are offline. Plans need a connection.');
  const msgs=['Reading your last 14 days','Checking your recovery','Balancing muscle groups','Planning your meals','Setting your water target'];let i=0;
  planView='tomorrow';setSeg();
  $('#planBox').innerHTML=`<div class="block loading"><h3 id="ldMsg">${msgs[0]}</h3><p class="small muted">This takes up to a minute.</p><div class="shimmer"></div></div>`;
  const tm=setInterval(()=>{i=(i+1)%msgs.length;const el=$('#ldMsg');if(el)el.textContent=msgs[i]},2400);
  $('#genBtn').disabled=$('#rebuildBtn').disabled=true;
  try{await flush();const r=await api('generatePlan',{full});S.plan=r.plan;S.strategy=r.strategy;if(r.profile)S.profile=r.profile;save()}
  catch(e){toast(errMsg(e))}
  clearInterval(tm);$('#genBtn').disabled=$('#rebuildBtn').disabled=false;renderPlan();
}
