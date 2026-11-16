/* Summit app, part 6 of 6: Plan screen, then start the app (keep this file last) */
function setSeg(){$$('#seg button').forEach(b=>b.classList.toggle('on',b.dataset.v===planView))}
const pill=t=>t?`<span class="pill${t==='Rest'?' rest':''}">${esc(t)}</span>`:'';
function dayPlanHTML(t,note,label,isToday){
  const n=t.nutrition||{};
  const ex=(t.exercises||[]).map(x=>{const b=barKg(libItem(x.name)),tk=Number(x.target_kg);
    return `<li><div><b>${esc(x.name)}</b>${x.notes?`<span class="small muted">${esc(x.notes)}</span>`:''}</div><span class="exm">${esc(x.sets)} × ${esc(x.reps)}${tk>0?`<br><span class="small muted">${esc(x.target_kg)} kg${b?' incl. bar':''}</span>`:''}</span></li>`}).join('');
  const meals=(n.meals||[]).map(m=>`<li><div><b>${esc(m.time)}</b><span class="small">${esc(m.meal)}</span></div><span class="exm small muted">${esc(m.approx_kcal)} kcal${m.protein_g?`<br>${esc(m.protein_g)} g protein`:''}</span></li>`).join('');
  return `<div class="block"><p class="small muted">${label}</p>${pill(t.day_type)}<h2>${esc(t.focus)}</h2><p class="small muted">${t.duration_min?esc(t.duration_min)+' minutes. ':''}${t.warmup?'Warm-up: '+esc(t.warmup):''}</p><ul class="plist">${ex}</ul>${t.cardio?`<p class="small"><b>Cardio:</b> ${esc(t.cardio)}</p>`:''}${t.cooldown?`<p class="small"><b>Cool-down:</b> ${esc(t.cooldown)}</p>`:''}${isToday&&t.day_type!=='Rest'&&ex?'<button class="cta" id="startWo">Log this workout</button>':''}</div>
  <div class="block"><h3>Food</h3><div class="macros"><div><b class="num">${esc(n.calories)}</b><span>kcal</span></div><div><b class="num">${esc(n.protein_g)}</b><span>protein g</span></div><div><b class="num">${esc(n.carbs_g)}</b><span>carbs g</span></div><div><b class="num">${esc(n.fat_g)}</b><span>fat g</span></div></div><ul class="plist">${meals}</ul></div>
  <div class="block"><div class="two"><div><h3 style="color:${COL.water}">${esc(t.water_L)} L water</h3><p class="small muted">${esc(t.water_schedule)}</p></div><div><h3 style="color:${COL.sleep}">${esc(t.sleep_h)} h sleep</h3><p class="small muted">${esc(t.recovery_tips)}</p></div></div></div>
  ${note?`<div class="block coach"><h3>From your coach</h3><p>${esc(note)}</p></div>`:''}`;
}
function renderPlan(){
  const box=$('#planBox'),t=todayStr(),st=S.strategy;
  if(planView==='today'||planView==='tomorrow'){
    const d=planView==='today'?t:addDays(t,1),p=planFor(d);
    box.innerHTML=p?dayPlanHTML(p.tomorrow,p.coach_note,fmtLong(d),planView==='today')
      :`<div class="block"><h3>No plan for ${planView} yet</h3><p class="small muted">${planView==='today'?'Plans are made the evening before. Tap the button below to plan tomorrow.':'Log your day, then tap the button below. Your coach also makes one automatically every night.'}</p>${planView==='today'?`<p class="small" style="margin-top:10px">Next in your cycle: <b>${esc(sessionFor(t)||nextSession())}</b></p><button class="ghost" id="startWo">Log a workout</button>`:''}</div>`;
    const sw=$('#startWo');if(sw)sw.onclick=()=>sheetWorkout();
  }else if(planView==='week'){
    const wk=(st&&st.week)||[];
    box.innerHTML=wk.length?'<div class="block">'+wk.map(d=>`<div class="wkrow ${d.date===t?'now':''}"><div class="wkd"><b>${esc(String(d.day||'').slice(0,3))}</b><span class="small muted">${d.date?esc(fmtShort(d.date)):''}</span></div><div>${pill(d.day_type)}<b style="display:block">${esc(d.focus)}</b><p class="small muted">${esc(d.key_work)}</p><p class="small">${esc(d.calories)} kcal, ${esc(d.protein_g)} g protein</p></div></div>`).join('')+'</div>':'<div class="block"><p class="small muted">No week plan yet. Make your first plan below.</p></div>';
  }else{
    const m=(st&&st.month)||{},wkNo=st?Math.floor(Math.max(0,daysBetween(addDays(st.created.slice(0,10),1),t))/7)+1:0;
    box.innerHTML=m.weeks?`<div class="block coach"><p class="small muted">Chapter ${esc(S.profile.chapter_no||1)}</p><h2>${esc(m.title||'This chapter')}</h2><p class="small">${esc(m.goal)}</p></div>`+m.weeks.map(w=>`<div class="block" ${Number(w.week)===wkNo?'style="outline:2px solid var(--sun)"':''}><p class="small muted">Week ${esc(w.week)}${w.dates?', '+esc(w.dates):''}${Number(w.week)===wkNo?', you are here':''}</p><h3>${esc(w.phase)}</h3><p class="small">${esc(w.focus)}</p><p class="small muted">Intensity: ${esc(w.intensity)}<br>Targets: ${esc(w.targets)}</p></div>`).join(''):'<div class="block"><p class="small muted">No month plan yet. Make your first plan below.</p></div>';
  }
}
async function generate(full){
  if(!navigator.onLine)return toast('You are offline. Plans need a connection.');
  const msgs=['Reading your last 14 days','Checking your recovery','Picking your next session','Planning your meals','Setting your water target'];let i=0;
  planView='tomorrow';setSeg();
  $('#planBox').innerHTML=`<div class="block loading"><h3 id="ldMsg">${msgs[0]}</h3><p class="small muted">This takes up to a minute.</p><div class="shimmer"></div></div>`;
  const tm=setInterval(()=>{i=(i+1)%msgs.length;const el=$('#ldMsg');if(el)el.textContent=msgs[i]},2400);
  $('#genBtn').disabled=$('#rebuildBtn').disabled=true;
  try{await flush();const r=await api('generatePlan',{full});S.plan=r.plan;S.strategy=r.strategy;if(r.profile)S.profile=r.profile;save()}
  catch(e){toast(errMsg(e))}
  clearInterval(tm);$('#genBtn').disabled=$('#rebuildBtn').disabled=false;renderPlan();
}
init();
