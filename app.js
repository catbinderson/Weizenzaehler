(()=>{
  const KEY='hefeweizen-counter.v1';
  const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n||0);
  const pad=n=>String(n).padStart(2,'0');
  const isoDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const today=()=>isoDate(new Date());
  const fmtDate=s=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${s}T12:00:00`));
  const safeParse=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}};
  const initial={
    current:{date:today(),paidCount:0,freeCount:0},
    prices:[{from:'2026-08-08',price:4.40}],
    days:[{id:'seed-2026-08-08',date:'2026-08-08',paidCount:2,freeCount:1,count:3,unitPrice:4.40,total:8.80,closedAt:'2026-08-08T21:00:00.000Z'}]
  };
  let state=safeParse()||structuredClone(initial);
  if(!Array.isArray(state.prices)||!state.prices.length)state.prices=initial.prices.slice();
  if(!Array.isArray(state.days))state.days=[];
  if(!state.current)state.current={date:today(),paidCount:0,freeCount:0};
  function normalize(){
    state.prices=state.prices.map(x=>({from:String(x.from),price:Number(x.price)})).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.from)&&Number.isFinite(x.price)&&x.price>0).sort((a,b)=>a.from.localeCompare(b.from));
    const map=new Map();for(const p of state.prices)map.set(p.from,p);state.prices=[...map.values()].sort((a,b)=>a.from.localeCompare(b.from));
    if(!state.prices.length)state.prices=initial.prices.slice();
    state.days=state.days.map(r=>{
      const paid=Number.isFinite(Number(r.paidCount))?Number(r.paidCount):Number(r.count||0);
      const free=Number(r.freeCount||0);
      return {id:String(r.id||`${Date.now()}-${Math.random().toString(36).slice(2,8)}`),date:String(r.date||''),paidCount:Math.max(0,Math.floor(paid)),freeCount:Math.max(0,Math.floor(free)),count:Math.max(0,Math.floor(paid+free)),unitPrice:Number(r.unitPrice||0),total:Number(r.total||0),closedAt:String(r.closedAt||'')};
    }).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(r.unitPrice)&&r.unitPrice>0&&Number.isFinite(r.total)&&r.total>=0);
    const seed=state.days.find(r=>r.id==='seed-2026-08-08');if(seed&&seed.date==='2026-08-08'&&seed.paidCount===2&&seed.freeCount===0&&seed.total===8.80){seed.freeCount=1;seed.count=3}
    if(!state.current)state.current={date:today(),paidCount:0,freeCount:0};
    if(!Number.isFinite(Number(state.current.paidCount)))state.current.paidCount=Number(state.current.count||0);
    state.current.paidCount=Math.max(0,Math.floor(Number(state.current.paidCount)||0));
    state.current.freeCount=Math.max(0,Math.floor(Number(state.current.freeCount)||0));
    delete state.current.count;
    if(state.current.date!==today()){
      const paid=state.current.paidCount,free=state.current.freeCount,count=paid+free,date=state.current.date;
      const alreadyInHistory=state.days.some(r=>r.date===date&&r.paidCount===paid&&r.freeCount===free&&r.count===count);
      if(count&&!alreadyInHistory){
        const unitPrice=priceFor(date),total=Number((paid*unitPrice).toFixed(2));
        state.days.push({id:`auto-${date}`,date,paidCount:paid,freeCount:free,count,unitPrice,total,closedAt:new Date().toISOString()});
      }
      state.current={date:today(),paidCount:0,freeCount:0};
    }
  }
  function save(){normalize();localStorage.setItem(KEY,JSON.stringify(state))}
  function priceFor(date){let value=state.prices[0]?.price||4.40;for(const p of state.prices){if(p.from<=date)value=p.price;else break}return Number(value)}
  function currentTotalCount(){return state.current.paidCount+state.current.freeCount}
  function totalForCurrent(){return state.current.paidCount*priceFor(state.current.date)}
  function rowsWithCurrent(){
    const rows=[...state.days],paid=state.current.paidCount,free=state.current.freeCount,count=paid+free;
    if(count){const unitPrice=priceFor(state.current.date);rows.push({id:'current',date:state.current.date,paidCount:paid,freeCount:free,count,unitPrice,total:Number((paid*unitPrice).toFixed(2)),closedAt:new Date().toISOString(),current:true})}
    return rows;
  }
  const $=s=>document.querySelector(s);
  function mondayOf(d){const x=new Date(d);const day=x.getDay()||7;x.setHours(0,0,0,0);x.setDate(x.getDate()-day+1);return x}
  function monthStart(d){return new Date(d.getFullYear(),d.getMonth(),1)}
  function yearStart(d){return new Date(d.getFullYear(),0,1)}
  function inRange(row,start,end){const d=new Date(`${row.date}T12:00:00`);return d>=start&&d<=end}
  function aggregate(rows){
    const paid=rows.reduce((s,r)=>s+Number(r.paidCount||0),0),free=rows.reduce((s,r)=>s+Number(r.freeCount||0),0),cost=rows.reduce((s,r)=>s+Number(r.total||0),0),by=new Map();
    for(const r of rows){const p=Number(r.unitPrice||0),k=p.toFixed(2);if(!by.has(k))by.set(k,{price:p,count:0,total:0});const b=by.get(k);b.count+=Number(r.paidCount||0);b.total+=Number(r.total||0)}
    return {beer:paid+free,paid,free,cost,breakdown:[...by.values()].sort((a,b)=>a.price-b.price)};
  }
  function renderStat(prefix,data){$(`#${prefix}Beer`).textContent=data.beer;$(`#${prefix}Paid`).textContent=`${data.paid} bezahlt`;$(`#${prefix}Free`).textContent=`${data.free} kostenlos`;$(`#${prefix}Cost`).textContent=euro(data.cost)}
  function breakdownHtml(data){const paid=data.breakdown.length?data.breakdown.map(x=>`<div>${x.count} bezahlt × ${euro(x.price)} = ${euro(x.total)}</div>`).join(''):'';return `<div class="breakdown">${paid}<div class="free-line">${data.free} kostenlos · ${euro(0)}</div></div>`}
  function periodHtml(data,label){return `<div class="period-main"><div><small>${label}</small><strong>${data.beer} Bier</strong></div><strong>${euro(data.cost)}</strong></div><div class="period-split"><span>${data.paid} bezahlt</span><span>${data.free} kostenlos</span></div>${breakdownHtml(data)}`}
  function isoWeekString(d=new Date()){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const ys=new Date(Date.UTC(x.getUTCFullYear(),0,1));const week=Math.ceil((((x-ys)/86400000)+1)/7);return `${x.getUTCFullYear()}-W${pad(week)}`}
  function weekRange(value){const [y,w]=value.split('-W').map(Number);const jan4=new Date(y,0,4),first=mondayOf(jan4),start=new Date(first);start.setDate(first.getDate()+(w-1)*7);const end=new Date(start);end.setDate(start.getDate()+6);end.setHours(23,59,59,999);return [start,end]}
  function monthRange(value){const [y,m]=value.split('-').map(Number);return [new Date(y,m-1,1),new Date(y,m,0,23,59,59,999)]}
  function render(){
    normalize();save();const p=priceFor(state.current.date),all=currentTotalCount();
    $('#todayDate').textContent=fmtDate(state.current.date);$('#count').textContent=all;$('#paidToday').textContent=state.current.paidCount;$('#freeToday').textContent=state.current.freeCount;$('#runningTotal').textContent=euro(totalForCurrent());$('#currentPrice').textContent=`Aktueller Preis: ${euro(p)}`;
    $('#minusBtn').disabled=state.current.paidCount<=0;$('#minusFreeBtn').disabled=state.current.freeCount<=0;
    const now=new Date(),todayEnd=new Date();todayEnd.setHours(23,59,59,999),rows=rowsWithCurrent();
    renderStat('wtd',aggregate(rows.filter(r=>inRange(r,mondayOf(now),todayEnd))));renderStat('mtd',aggregate(rows.filter(r=>inRange(r,monthStart(now),todayEnd))));renderStat('ytd',aggregate(rows.filter(r=>inRange(r,yearStart(now),todayEnd))));
    const w=$('#weekSelect').value||isoWeekString(now);$('#weekSelect').value=w;const [ws,we]=weekRange(w);$('#weekResult').innerHTML=periodHtml(aggregate(rows.filter(r=>inRange(r,ws,we))),`KW ${Number(w.split('W')[1])}`);
    const mv=$('#monthSelect').value||`${now.getFullYear()}-${pad(now.getMonth()+1)}`;$('#monthSelect').value=mv;const [ms,me]=monthRange(mv);$('#monthResult').innerHTML=periodHtml(aggregate(rows.filter(r=>inRange(r,ms,me))),new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(ms));
    const history=[...rows].sort((a,b)=>(b.date).localeCompare(a.date));$('#history').innerHTML=history.length?history.map(r=>`<div class="history-row"><div><strong>${fmtDate(r.date)}${r.current?' · heute':''}</strong><small>${r.count} Bier · ${r.paidCount} bezahlt · ${r.freeCount} kostenlos</small><small>${r.paidCount} × ${euro(r.unitPrice)}</small></div><div class="amount">${euro(r.total)}</div></div>`).join(''):'<div class="history-empty">Noch keine Einträge gespeichert.</div>';
    $('#priceHistory').innerHTML=[...state.prices].reverse().map((x,i)=>`<div class="price-row"><span>ab ${new Intl.DateTimeFormat('de-DE').format(new Date(`${x.from}T12:00:00`))}${i===0?' · aktuell':''}</span><b>${euro(x.price)}</b></div>`).join('');$('#priceInput').value=p.toFixed(2);$('#priceFrom').value=today();
  }
  function setBackupStatus(text,ok=true){const el=$('#backupStatus');if(!el)return;el.textContent=text;el.classList.toggle('ok',ok);el.classList.toggle('error',!ok)}
  function validImport(data){return data&&typeof data==='object'&&Array.isArray(data.prices)&&Array.isArray(data.days)}
  $('#plusBtn').addEventListener('click',()=>{normalize();state.current.paidCount++;save();render()});
  $('#plusFreeBtn').addEventListener('click',()=>{normalize();state.current.freeCount++;save();render()});
  $('#minusBtn').addEventListener('click',()=>{normalize();state.current.paidCount=Math.max(0,state.current.paidCount-1);save();render()});
  $('#minusFreeBtn').addEventListener('click',()=>{normalize();state.current.freeCount=Math.max(0,state.current.freeCount-1);save();render()});
  $('#openSettings').addEventListener('click',()=>$('#settingsModal').classList.remove('hidden'));$('#closeSettings').addEventListener('click',()=>$('#settingsModal').classList.add('hidden'));
  $('#savePrice').addEventListener('click',()=>{const price=Number(String($('#priceInput').value).replace(',','.')),from=$('#priceFrom').value;if(!from||!Number.isFinite(price)||price<=0){alert('Bitte gültigen Preis und Datum eingeben.');return}state.prices=state.prices.filter(x=>x.from!==from);state.prices.push({from,price:Number(price.toFixed(2))});save();render();setBackupStatus('Preis gespeichert.');});
  $('#exportBackup').addEventListener('click',()=>{save();const payload={app:'Hefeweizen-Counter',format:2,exportedAt:new Date().toISOString(),...state};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`hefeweizen-counter-sicherung-${today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setBackupStatus('Sicherung wurde erstellt.');});
  $('#importBackup').addEventListener('click',()=>$('#backupFile').click());
  $('#backupFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.app&&data.app!=='Hefeweizen-Counter')throw new Error('Falsche Sicherungsdatei');if(!validImport(data))throw new Error('Ungültige Sicherungsdatei');if(!confirm(`Sicherung importieren?\n\n${data.days.length} abgeschlossene Tage und ${data.prices.length} Preise werden übernommen. Die aktuellen Daten werden ersetzt.`))return;state={current:data.current||{date:today(),paidCount:0,freeCount:0},prices:data.prices,days:data.days};save();render();setBackupStatus('✓ Sicherung erfolgreich wiederhergestellt.');}catch(err){console.error(err);setBackupStatus('Die Sicherungsdatei konnte nicht importiert werden.',false)}finally{e.target.value=''}});
  $('#weekSelect').addEventListener('change',render);$('#monthSelect').addEventListener('change',render);addEventListener('storage',render);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')render()});if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));render();
})();