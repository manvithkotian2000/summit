/* Summit app, part 3 of 4: Journey screen (trail, chapter, consistency, trend, wins) */
function metricSeries(){
  const p=S.profile||{},m=p.goal_metric||'weight',map={};
  for(const e of S.entries){
    let v=null;
    if(m==='weight'&&e.type==='Weight')v=Number(e.amount);
    else if(m==='waist'&&e.type==='Measure'&&/waist/i.test(e.details))v=Number(e.amount);
    else if(m==='lift'&&e.type==='Lift'&&p.goal_exercise&&norm(e.details).includes(norm(p.goal_exercise))&&Number(e.amount)>0)v=e1rm(e.amount,e.data&&e.data.reps);
    else if(m==='energy'&&e.type==='Energy')v=Number(e.amount);
    if(v==null||isNaN(v)||(m!=='energy'&&!v))continue;
    (map[e.date]=map[e.date]||[]).push(v);
  }
  return Object.keys(map).sort().map(d=>({d,v:m==='lift'?Math.max(...map[d]):m==='energy'?avg(map[d]):map[d][map[d].length-1]}));
}
const smooth=ser=>ser.map(pt=>{const from=addDays(pt.d,-6);return {d:pt.d,v:avg(ser.filter(x=>x.d>=from&&x.d<=pt.d).map(x=>x.v))}});
function slope(pts){const x0=pts[0].d,xs=pts.map(p=>daysBetween(x0,p.d)),ys=pts.map(p=>p.v),mx=avg(xs),my=avg(ys);let n=0,d=0;xs.forEach((x,i)=>{n+=(x-mx)*(ys[i]-my);d+=(x-mx)**2});return d?n/d:0}
function journey(){
  const p=S.profile||{},m=METRICS[p.goal_metric]||METRICS.weight,ser=metricSeries(),sm=smooth(ser);
  const target=Number(p.goal_target),start=Number(p.goal_start)||(sm[0]&&sm[0].v);
  const J=Object.assign({},m,{ser,sm,start,target,ok:!!target&&!!start&&target!==start,frac:0});
  if(!J.ok){J.headline='Your journey starts here';J.sub='Add your summit in Me, then log for a few days.';return J}
  J.cur=sm.length?sm[sm.length-1].v:start;J.dir=Math.sign(target-start);
  J.frac=clamp((J.cur-start)/(target-start),0,1);J.reached=(target-J.cur)*J.dir<=0;
  const r=S.plan&&S.plan.projections&&S.plan.projections.goal_rate_per_week;
  J.rates=r&&Number(r.likely)?{slow:Math.abs(+r.slow||0)/7,likely:Math.abs(+r.likely)/7,fast:Math.abs(+r.fast||+r.likely)/7}:null;
  const recent=sm.filter(x=>x.d>=addDays(todayStr(),-28));
  let obs=null;if(recent.length>=8&&daysBetween(recent[0].d,recent[recent.length-1].d)>=14)obs=slope(recent);
  J.observed=obs!=null&&Math.sign(obs)===J.dir&&obs!==0;
  let perDay=J.observed?Math.abs(obs):J.rates&&J.rates.likely;
  if(perDay&&J.rates&&J.rates.fast)perDay=Math.min(perDay,J.rates.fast);
  if(J.reached){J.headline='You reached your summit';J.sub='Set your next one in Me. Your records stay with you.'}
  else if(perDay){
    J.eta=addDays(todayStr(),Math.ceil(Math.abs(target-J.cur)/perDay));J.headline='Arriving around '+fmtLong(J.eta);
    let sub=J.observed?'Based on your actual trend.':'Based on your plan. Your own trend takes over after two weeks of logging.';
    if(p.goal_date){const diff=daysBetween(p.goal_date,J.eta);sub+=diff<=0?' That is ahead of your target date.':' About '+Math.max(1,Math.round(diff/7))+' weeks past your target date. Steady weeks pull it closer.'}
    J.sub=sub;
  }else{J.headline='Your journey starts here';J.sub='Make your first plan and log for a few days to see your arrival date.'}
  return J;
}
function tlabel(q,t,cls){const right=q.x<170;return `<text x="${q.x+(right?14:-14)}" y="${q.y+4}" text-anchor="${right?'start':'end'}" class="tl ${cls}">${esc(t)}</text>`}
function drawTrail(J){
  const D='M50 432 C 190 444, 304 404, 272 346 S 58 300, 80 240 S 302 206, 262 146 S 108 102, 176 50';
  const ms=(S.strategy&&S.strategy.milestones)||[];
  $('#trail').innerHTML=`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A3170"/><stop offset="1" stop-color="#141A3A"/></linearGradient></defs>
    <rect width="340" height="460" fill="url(#sky)"/>
    <circle cx="262" cy="66" r="44" fill="#FFB547" opacity=".14"/><circle cx="262" cy="66" r="20" fill="#FFB547" opacity=".5"/>
    <path d="M0 250 L64 168 L118 214 L184 104 L248 186 L298 136 L340 172 L340 460 L0 460Z" fill="#1F2756" opacity=".75"/>
    <path d="M0 334 L58 286 L132 326 L208 254 L282 304 L340 276 L340 460 L0 460Z" fill="#19204D"/>
    <path d="${D}" fill="none" stroke="#A3ACE0" stroke-opacity=".4" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 11"/>
    <path id="trDone" d="${D}" fill="none" stroke="#FFB547" stroke-width="6" stroke-linecap="round"/>
    <g transform="translate(176 50)"><line x1="0" y1="0" x2="0" y2="-30" stroke="#F2F4FF" stroke-width="2"/><path d="M0 -30 L20 -24 L0 -18Z" fill="#FFB547"/></g>
    <g id="trMarks"></g>`;
  const path=$('#trDone'),L=path.getTotalLength(),pt=f=>path.getPointAtLength(L*clamp(f,0,1));
  path.style.strokeDasharray=L;path.style.strokeDashoffset=L*(1-(J.frac||0));
  let marks=tlabel(pt(0),J.ok?'Start, '+fmtV(J.start)+' '+J.unit:'Start','muted');
  if(J.ok){
    const e=pt(1);marks+=`<text x="${e.x+28}" y="${e.y-22}" class="tl strong">${fmtV(J.target)} ${esc(J.unit)}</text>`;
    ms.forEach(m=>{const f=(Number(m.value)-J.start)/(J.target-J.start);if(!(f>0&&f<1))return;const q=pt(f),hit=J.frac>=f;
      marks+=`<circle cx="${q.x}" cy="${q.y}" r="7" fill="${hit?'#FFB547':'#141A3A'}" stroke="#FFB547" stroke-width="2.5"/>`+tlabel(q,m.label||fmtV(m.value),hit?'':'muted')});
    const y=pt(J.frac);
    marks+=`<circle class="pulse" cx="${y.x}" cy="${y.y}" r="15" fill="#4FD8F0"/><circle cx="${y.x}" cy="${y.y}" r="9" fill="#4FD8F0" stroke="#141A3A" stroke-width="3"/>`+tlabel({x:y.x,y:y.y+22},'You, '+fmtV(J.cur)+' '+J.unit,'you');
  }
  $('#trMarks').innerHTML=marks;
}
function chapterInfo(){
  const p=S.profile||{},t=todayStr(),no=Number(p.chapter_no)||1,start=p.chapter_start||p.journey_start||t;
  const upcoming=start>t,end=addDays(start,27),dayNo=upcoming?0:daysBetween(start,t)+1;
  const exp=Math.round((Number(p.days_per_week)||4)*4);let trained=0;
  if(!upcoming)for(let d=start;d<=t&&d<=end;d=addDays(d,1))if(dayStats(d).trained)trained++;
  const setup=no===1?[!!p.age,!!(lastWeight()||p.goal_start),!!S.plan]:[];
  const setupDone=setup.filter(Boolean).length;
  return {no,start,end,dayNo,upcoming,exp,trained,setup:setup.length,setupDone,total:exp+setup.length,done:Math.min(exp,trained)+setupDone,title:(S.strategy&&S.strategy.month&&S.strategy.month.title)||''};
}
function renderChapter(){
  const c=chapterInfo(),pct=c.done/c.total,left=c.total-c.done,daysLeft=Math.max(0,daysBetween(todayStr(),c.end));
  const segs=[];for(let i=0;i<c.total;i++)segs.push(i<c.setup?(i<c.setupDone?'s':''):(i-c.setup<Math.min(c.exp,c.trained)?'d':''));
  const msg=c.upcoming?'Begins '+fmtLong(c.start)+'. Your records and totals carry over.'
    :pct<.5?c.done+' of '+c.total+' steps done'+(c.setupDone?', including '+c.setupDone+' setup steps':'')+'. '+daysLeft+' days left in this chapter.'
    :left>0?'Only '+left+(left===1?' session':' sessions')+' left to finish this chapter.':'Chapter complete. The next one starts soon.';
  $('#chapter').innerHTML=`<p class="small muted">Chapter ${c.no}${c.upcoming?'':', day '+c.dayNo+' of 28'}</p><h2>${esc(c.title||'Chapter '+c.no)}</h2><div class="segbar" aria-hidden="true">${segs.map(x=>`<i class="${x}"></i>`).join('')}</div><p class="small">${msg}</p>`;
}
function heatCells(){
  const t=todayStr(),start=(S.profile&&S.profile.journey_start)||t;
  const dow=(new Date(t+'T12:00:00Z').getUTCDay()+6)%7,first=addDays(t,-(dow+77));let out='',prevMissed=false;
  for(let i=0;i<84;i++){
    const d=addDays(first,i);let cls='';
    if(d>t||d<start)cls='f';
    else{const s=dayStats(d);cls=s.trained?'t':s.any?'l':'';if(s.any&&prevMissed)cls+=' c';prevMissed=!s.any&&d!==t}
    out+=`<i class="${cls}" title="${fmtShort(d)}"></i>`;
  }
  return out;
}
function renderConsistency(){
  const c=consistency(28),C=2*Math.PI*34;
  $('#consistency').innerHTML=`<div class="crow"><svg class="cring" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="34" fill="none" stroke="#2C3570" stroke-width="9"/><circle cx="42" cy="42" r="34" fill="none" stroke="#6EE7A8" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-c.score/100)}" transform="rotate(-90 42 42)"/><text x="42" y="49" text-anchor="middle" class="cnum">${c.score}%</text></svg>
    <div><h3>Consistency</h3>${c.days?`<p class="small">Trained ${c.trained} of ${c.exp} planned sessions</p><p class="small">Logged on ${c.logged} of the last ${c.days} days</p>`:'<p class="small">Log today and this starts filling.</p>'}<p class="small muted">A missed day only nudges this. It never resets.</p></div></div>
    <div class="heat" aria-label="Last 12 weeks">${heatCells()}</div>
    <div class="hkey small muted"><span><i style="background:var(--sun)"></i>Trained</span><span><i style="background:rgba(255,181,71,.32)"></i>Logged</span><span><i style="box-shadow:inset 0 0 0 2px var(--water)"></i>Comeback day</span></div>`;
}
function drawTrend(J){
  const note=$('#trendNote');
  if(trendChart){trendChart.destroy();trendChart=null}
  if(!window.Chart||!J.ok||J.ser.length<2){note.textContent=J.ok?'Your trend appears after two entries.':'Set your summit in Me to see your trend.';return}
  const t=todayStr(),L0=J.ser[0].d>addDays(t,-42)?J.ser[0].d:addDays(t,-42),labels=[];
  for(let d=L0;d<=addDays(t,28);d=addDays(d,1))labels.push(d);
  const mapR=Object.fromEntries(J.ser.map(x=>[x.d,x.v])),mapS=Object.fromEntries(J.sm.map(x=>[x.d,x.v]));
  const ch=chapterInfo();let A=ch.start>L0&&ch.start<=t?ch.start:L0;
  const aPt=J.sm.filter(x=>x.d<=A).pop()||J.sm[0];if(A<aPt.d)A=aPt.d;
  const band=k=>labels.map(d=>J.rates&&d>=A?aPt.v+J.dir*J.rates[k]*daysBetween(A,d):null);
  const ds=[];
  if(J.rates)ds.push({data:band('fast'),borderColor:'transparent',pointRadius:0,fill:false},{data:band('slow'),borderColor:'transparent',backgroundColor:'rgba(255,181,71,.16)',pointRadius:0,fill:'-1'});
  ds.push({data:labels.map(d=>mapS[d]??null),borderColor:'#4FD8F0',borderWidth:3,pointRadius:0,spanGaps:true,tension:.3},
          {data:labels.map(d=>mapR[d]??null),showLine:false,pointRadius:2.5,pointBackgroundColor:'rgba(242,244,255,.5)',borderColor:'transparent'});
  trendChart=new Chart($('#trendCanvas'),{type:'line',data:{labels,datasets:ds},options:{maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:i=>fmtShort(labels[i[0].dataIndex])}}},scales:{x:{ticks:{color:'#A3ACE0',maxTicksLimit:5,callback:v=>fmtShort(labels[v])},grid:{display:false}},y:{ticks:{color:'#A3ACE0'},grid:{color:'rgba(163,172,224,.12)'}}}}});
  const last=J.sm[J.sm.length-1],fi=labels.indexOf(last.d);
  if(J.rates&&fi>=0&&last.d>A){
    const f=band('fast')[fi],s=band('slow')[fi],lo=Math.min(f,s)-.05,hi=Math.max(f,s)+.05;
    const ahead=J.dir>0?last.v>hi:last.v<lo,behind=J.dir>0?last.v<lo:last.v>hi;
    note.textContent=ahead?'You are ahead of the fast edge. Make sure recovery keeps up.':behind?'Just outside the band right now. Your coach adjusts tomorrow\'s plan to bring you back in.':'The blue line is inside the band, which means you are on track.';
  }else note.textContent='Dots are single readings. The blue line is your 7-day average, which smooths out day-to-day noise.';
}
function liftRecords(){
  const g={};
  S.entries.forEach(e=>{if(e.type==='Lift'&&Number(e.amount)>0){const k=norm(e.details);(g[k]=g[k]||{name:e.details,list:[]}).list.push({d:e.date,v:e1rm(e.amount,e.data&&e.data.reps),kg:Number(e.amount),reps:e.data&&e.data.reps})}});
  return Object.values(g).map(x=>{x.list.sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);const fd=x.list[0].d,first=Math.max(...x.list.filter(y=>y.d===fd).map(y=>y.v)),best=x.list.reduce((a,b)=>b.v>a.v?b:a);
    return {name:x.name,pct:(best.v-first)/first,best,sessions:new Set(x.list.map(y=>y.d)).size}}).filter(x=>x.sessions>=2&&x.pct>.001).sort((a,b)=>b.pct-a.pct).slice(0,6);
}
function avgRange(kind,from,to){const v=[];for(let d=from;d<=to;d=addDays(d,1)){const s=dayStats(d);if(kind==='energy'&&s.energy.length)v.push(avg(s.energy));if(kind==='sleep'&&s.sleep)v.push(s.sleep)}return v.length?avg(v):null}
function renderWins(){
  const recs=liftRecords(),p=S.profile||{},t=todayStr(),start=p.journey_start||t;
  let html='<h3>Early wins</h3><p class="small muted">Strength and energy improve weeks before the mirror shows it.</p>';
  html+=recs.length?recs.map(r=>`<div class="rec"><b>${esc(r.name)}</b><span class="num pos">+${Math.round(r.pct*100)}%</span><span class="small muted" style="grid-column:1/-1">Best set ${r.best.kg} kg × ${esc(r.best.reps||'?')}, across ${r.sessions} sessions</span><div class="bar"><i style="width:${Math.min(100,r.pct*200)}%"></i></div></div>`).join('')
    :'<p class="small" style="margin-top:10px">Tick off exercises in the workout log. Your strength records show up here after the second session.</p>';
  if(daysBetween(start,t)>=13){
    const row=(l,x,y,u)=>x!=null&&y!=null?`<div class="rec"><b>${l}</b><span class="num ${y>=x?'pos':''}">${r1(x)} to ${r1(y)}${u}</span><span class="small muted" style="grid-column:1/-1">Your first week compared with this week</span></div>`:'';
    html+=row('Energy',avgRange('energy',start,addDays(start,6)),avgRange('energy',addDays(t,-6),t),'/10')+row('Sleep',avgRange('sleep',start,addDays(start,6)),avgRange('sleep',addDays(t,-6),t),' h');
  }
  $('#wins').innerHTML=html;
}
