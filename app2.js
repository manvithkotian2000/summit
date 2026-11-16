/* Summit app, part 2 of 6: Today screen and logging sheets */
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
  const trainTxt=t.rest?'Rest day':st.planned?st.doneEx+' of '+st.planned+' exercises':st.doneEx?st.doneEx+(st.doneEx===1?' exercise':' exercises'):s.minutes?s.minutes+' of '+t.minutes+' min':(sessionFor(todayStr())||'Workout')+' next';
  $('#ringLegend').innerHTML=`<p class="small muted">${closed===4?'All four rings closed':closed+' of 4 rings closed'}</p>`+
    [['train','Train',trainTxt],['fuel','Protein',Math.round(s.protein)+' of '+t.protein+' g'],['water','Water',r2(s.water)+' of '+t.water+' L'],['sleep','Sleep',(s.sleep??0)+' of '+t.sleep+' h']]
    .map(([k,l,v])=>`<div class="lg"><span><i style="background:${COL[k]}"></i>${l}</span><b>${v}</b></div>`).join('');
  const pace=waterPaceFrac(),exp=t.water*pace,behind=r2(exp-s.water);
  $('#wDrunk').textContent=r2(s.water);$('#wTarget').textContent=t.water;
  $('#wFill').style.width=(clamp(s.water/t.water,0,1)*100)+'%';
  $('#wPace').style.left='calc('+(pace*100)+'% - 1px)';
  $('#wMsg').textContent=s.water>=t.water?'Target reached. Drink to thirst from here.':behind>.15?behind+' L behind pace. One or two glasses now catches you up.':'On pace. '+r2(t.water-s.water)+' L to go today.';
  const list=(byDate[todayStr()]||[]).slice().sort((a,b)=>a.ts<b.ts?1:-1);
  $('#entryList').innerHTML=list.length?list.map(e=>`<div class="entry"><span class="ei" aria-hidden="true">${ICON[e.type]||'•'}</span><div class="et" data-id="${e.id}" role="button" tabindex="0"><b>${esc(entryText(e))}</b><span class="small muted">${new Date(e.ts).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}${pending(e.id)?', waiting to sync':''}</span></div><button class="x" data-id="${e.id}" aria-label="Delete this entry">✕</button></div>`).join(''):'<p class="small muted">Nothing logged yet. A glass of water is a good start.</p>';
  $$('#entryList .x').forEach(b=>b.onclick=()=>deleteEntry(b.dataset.id));
  $$('#entryList .et').forEach(el=>el.onclick=()=>openEntry(el.dataset.id));
  setSync();
}

/* ===== Bottom sheets ===== */
function openSheet(html){$('#sheetBody').innerHTML=html;$('#sheetWrap').classList.add('on');document.body.style.overflow='hidden';if(!sheetOpen){history.pushState({sheet:1},'');sheetOpen=true}}
function closeSheet(fromPop){if(!sheetOpen)return;sheetOpen=false;$('#sheetWrap').classList.remove('on');document.body.style.overflow='';if(fromPop!==true)history.back()}
addEventListener('popstate',()=>{if(sheetOpen)closeSheet(true)});
$('#sheetWrap').addEventListener('click',e=>{if(e.target.id==='sheetWrap')closeSheet()});
function whenHTML(time){const t=todayStr();return `<div class="when${time?' two':''}"><div><label for="wnDate">Date</label><input id="wnDate" type="date" max="${t}" value="${t}"></div>${time?`<div><label for="wnTime">Time</label><input id="wnTime" type="time" value="${nowHM()}"></div>`:''}</div>`}
function readWhen(){const d=$('#wnDate'),t=$('#wnTime');return {date:(d&&d.value)||todayStr(),time:(t&&t.value)||''}}

function sheetMeal(mode){
  mode=mode==='pack'?'pack':'home';
  const meals=S.entries.filter(e=>e.type==='Meal').slice(-80).reverse();
  const home=[...new Set(meals.filter(e=>!(e.data&&e.data.pack)).map(e=>e.details))].slice(0,6);
  const seen=new Set(),packs=[];
  meals.forEach(e=>{const p=e.data&&e.data.pack;if(!p)return;const k=norm(p.brand+'|'+p.product+'|'+p.size);if(!seen.has(k)&&packs.length<6){seen.add(k);packs.push(p)}});
  const chips=(arr,lab)=>arr.length?`<p class="small muted" style="margin-top:12px">Tap to repeat</p><div class="chips">${arr.map((x,i)=>`<button class="chip" data-c="${i}">${esc(lab(x))}</button>`).join('')}</div>`:'';
  openSheet(`<h2>What did you eat or drink?</h2>
    <div class="seg mini" id="mSeg"><button data-m="home" class="${mode==='home'?'on':''}">Home or outside food</button><button data-m="pack" class="${mode==='pack'?'on':''}">Packaged snack</button></div>
    ${mode==='home'?`<p class="small muted">Rough quantities are enough. Your coach estimates calories and protein.</p>
    <textarea id="mealTxt" rows="3" aria-label="Meal" placeholder="2 rotis, a bowl of dal, paneer sabzi, a glass of buttermilk"></textarea>${chips(home,m=>m.length>40?m.slice(0,40)+'…':m)}`
    :`<p class="small muted">Your coach looks up the nutrition label and scales it to the pack size.</p>
    <label for="pkBrand">Brand</label><input id="pkBrand" placeholder="e.g. Lay's">
    <label for="pkProd">Product</label><input id="pkProd" placeholder="e.g. India's Magic Masala chips">
    <div class="two"><div><label for="pkSize">Pack size</label><input id="pkSize" placeholder="e.g. 50 g"></div><div><label for="pkCount">How many packs</label><input id="pkCount" type="number" inputmode="decimal" step="0.5" min="0.5" value="1"></div></div>${chips(packs,p=>p.brand+' '+p.product+(p.size?', '+p.size:''))}`}
    ${whenHTML(true)}
    <button class="cta" id="mealSave">Log ${mode==='home'?'meal':'snack'}</button>`);
  $$('#mSeg button').forEach(b=>b.onclick=()=>{if(b.dataset.m!==mode)sheetMeal(b.dataset.m)});
  $$('#sheetBody [data-c]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.c);
    if(mode==='home')$('#mealTxt').value=home[i];else{const p=packs[i];$('#pkBrand').value=p.brand;$('#pkProd').value=p.product;$('#pkSize').value=p.size||''}});
  $('#mealSave').onclick=()=>{
    const w=readWhen();let details,data={};
    if(mode==='home'){details=$('#mealTxt').value.trim();if(!details)return}
    else{
      const brand=$('#pkBrand').value.trim(),product=$('#pkProd').value.trim(),count=Number($('#pkCount').value)||1;let size=$('#pkSize').value.trim();
      if(!brand||!product)return toast('Add the brand and the product name');
      if(/^\d+(\.\d+)?$/.test(size))size+=' g';
      details=packText(brand,product,size,count);data={pack:{brand,product,size,count}};
    }
    addEntry('Meal',{details,data,date:w.date,time:w.time});closeSheet();toast((mode==='home'?'Meal':'Snack')+' logged'+forTxt(w.date)+'. Estimating nutrition…');
  };
}
function sheetNumber(kind){
  const c={Weight:{t:'Morning weight',u:'kg',step:.1,start:lastWeight()||Number(S.profile.weight)||70,hint:'Weigh after waking and using the toilet, before eating.'},
           Sleep:{t:'Sleep last night',u:'hours',step:.5,start:7.5,hint:'Log a nap separately and it adds up.'}}[kind];
  openSheet(`<h2>${c.t}</h2><p class="small muted">${c.hint}</p><div class="stepper"><button type="button" id="nMinus" aria-label="Decrease">−</button><input id="nVal" type="number" inputmode="decimal" step="${c.step}" value="${c.start}" aria-label="${c.t}"><button type="button" id="nPlus" aria-label="Increase">+</button></div><p class="small muted" style="text-align:center">${c.u}</p>${whenHTML(false)}<button class="cta" id="nSave">Log ${kind.toLowerCase()}</button>`);
  const inp=$('#nVal'),adj=d=>{inp.value=r1(Number(inp.value||0)+d)};
  $('#nMinus').onclick=()=>adj(-c.step);$('#nPlus').onclick=()=>adj(c.step);
  $('#nSave').onclick=()=>{const v=Number(inp.value);if(!v)return;const w=readWhen();addEntry(kind,{amount:v,unit:kind==='Weight'?'kg':'h',date:w.date});closeSheet();toast(kind+' logged'+forTxt(w.date))};
}
function sheetScale(kind){
  const en=kind==='Energy';
  openSheet(`<h2>${en?'How is your energy right now?':'How sore are you?'}</h2><p class="small muted">${en?'1 is drained, 10 is buzzing.':'1 is barely, 10 is struggling to move.'}</p>
    ${en?'':'<label for="sWhere">Where (optional)</label><input id="sWhere" placeholder="e.g. legs, lower back">'}
    ${whenHTML(false)}
    <div class="scale">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button data-n="${n}">${n}</button>`).join('')}</div>`);
  $$('#sheetBody .scale button').forEach(b=>b.onclick=()=>{const w=readWhen();addEntry(kind,{amount:Number(b.dataset.n),unit:'/10',details:en?'':$('#sWhere').value.trim(),date:w.date});closeSheet();toast(kind+' logged'+forTxt(w.date))});
}
function sheetMeasure(){
  openSheet(`<h2>Body measurement</h2><p class="small muted">Measure in the morning with the tape snug but not tight.</p>
    <label for="mPart">Where</label><select id="mPart"><option>Waist</option><option>Chest</option><option>Arm</option><option>Hips</option><option>Thigh</option></select>
    <label for="mVal">Centimetres</label><input id="mVal" type="number" inputmode="decimal" step="0.5">${whenHTML(false)}<button class="cta" id="mSave">Log measurement</button>`);
  $('#mSave').onclick=()=>{const v=Number($('#mVal').value);if(!v)return;const w=readWhen();addEntry('Measure',{details:$('#mPart').value,amount:v,unit:'cm',date:w.date});closeSheet();toast('Measurement logged'+forTxt(w.date))};
}
function compress(file){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const k=Math.min(1,900/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);res(c.toDataURL('image/jpeg',.82).split(',')[1])};img.onerror=rej;img.src=URL.createObjectURL(file)})}
function sheetPhoto(){
  openSheet(`<h2>Progress photo</h2><p class="small muted">Same spot, same light, same pose each time. Photos go to a private folder in your Google Drive.</p>${whenHTML(false)}
    <label class="cta" style="color:#2A1A00">Take or choose a photo<input id="phIn" type="file" accept="image/*" capture="environment" hidden></label><p class="small" id="phMsg"></p>`);
  $('#phIn').onchange=async e=>{const f=e.target.files[0];if(!f)return;
    if(!navigator.onLine||!cfg.apiUrl){$('#phMsg').textContent='Photos need a connection to upload.';return}
    $('#phMsg').textContent='Uploading…';const w=readWhen();
    try{const b64=await compress(f);const r=await api('uploadPhoto',{base64:b64,date:w.date});addEntry('Photo',{details:r.fileId,date:w.date});closeSheet();toast('Photo saved to your Drive')}
    catch(err){$('#phMsg').textContent=errMsg(err)}};
}
function sheetNote(){
  openSheet(`<h2>Note</h2><p class="small muted">Stress, pain, mood, travel. Anything your coach should know.</p><textarea id="ntTxt" rows="3" aria-label="Note"></textarea>${whenHTML(false)}<button class="cta" id="ntSave">Save note</button>`);
  $('#ntSave').onclick=()=>{const v=$('#ntTxt').value.trim();if(!v)return;const w=readWhen();addEntry('Note',{details:v,date:w.date});closeSheet();toast('Note saved'+forTxt(w.date))};
}

/* ===== Editing an entry ===== */
function openEntry(id){const e=S.entries.find(x=>x.id===id);if(!e)return;if(e.type==='Lift')return sheetWorkout(e.date,e.details);sheetEdit(e)}
const itemsHTML=items=>'<h3 style="margin-top:18px">Breakdown</h3><ul class="plist">'+items.map(i=>`<li><div><b>${esc(i.item)}</b><span class="small muted">${esc([i.brand,i.qty].filter(Boolean).join(', '))}${i.source==='label'?' · from the label':''}</span></div><span class="exm small">${Math.round(i.kcal||0)} kcal<br>${r1(i.protein_g||0)} g protein</span></li>`).join('')+'</ul>';
function sheetEdit(e){
  const num={Water:['Litres',0.05],Weight:['kg',0.1],Sleep:['Hours',0.5],Energy:['1 to 10',1],Soreness:['1 to 10',1],Measure:['cm',0.5],Workout:['Minutes',1]}[e.type];
  const txtLabel={Meal:'What you ate',Note:'Note',Soreness:'Where',Measure:'Body part',Workout:'Activity'}[e.type];
  openSheet(`<h2>Edit ${e.type.toLowerCase()}</h2><p class="small muted">${esc(entryText(e))}</p>
    ${txtLabel?`<label for="edTxt">${txtLabel}</label><textarea id="edTxt" rows="${e.type==='Meal'||e.type==='Note'?3:1}">${esc(e.details)}</textarea>`:''}
    ${num?`<label for="edAmt">${num[0]}</label><input id="edAmt" type="number" inputmode="decimal" step="${num[1]}" value="${esc(e.amount)}">`:''}
    <label for="edDate">Date</label><input id="edDate" type="date" max="${todayStr()}" value="${e.date}">
    ${e.type==='Meal'&&e.data&&Array.isArray(e.data.items)?itemsHTML(e.data.items):''}
    <button class="cta" id="edSave">Save changes</button><button class="ghost" id="edDel">Delete entry</button>`);
  $('#edSave').onclick=()=>{
    const n=Object.assign({},e,{data:Object.assign({},e.data)});
    if(txtLabel){const v=$('#edTxt').value.trim();if(e.type==='Meal'&&!v)return;if(e.type==='Meal'&&v!==e.details)n.data={};n.details=v}
    if(num){const a=$('#edAmt').value;n.amount=a===''?'':Number(a)}
    const d=$('#edDate').value||e.date;
    if(d!==e.date){n.date=d;const t=new Date(e.ts);n.ts=mkTs(d,String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'))}
    editEntry(n);closeSheet();toast('Changes saved');
  };
  $('#edDel').onclick=()=>{closeSheet();deleteEntry(e.id)};
}
const QUICK=[['Meal',()=>sheetMeal()],['Workout',()=>sheetWorkout()],['Weight',()=>sheetNumber('Weight')],['Sleep',()=>sheetNumber('Sleep')],['Energy',()=>sheetScale('Energy')],['Soreness',()=>sheetScale('Soreness')],['Measure',sheetMeasure],['Photo',sheetPhoto],['Note',sheetNote]];
