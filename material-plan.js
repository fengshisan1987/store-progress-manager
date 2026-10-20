/* Manual material schedules. Stored as one atomic array to keep date pairs consistent. */
const MATERIAL_START_NODE = '工程项目启动会完成以及物料下单';
const MATERIAL_PLAN_FIELD = '工程物料计划';
const MATERIAL_TYPES = [
  {key:'lights',name:'灯具',ship:'门店灯具已发货',arrival:'门店灯具已安装'},
  {key:'furniture',name:'家具',ship:'门店家具已发货',arrival:'门店家具已安装'},
  {key:'advertising',name:'广告物料',ship:'门店广告物料已发货',arrival:'门店广告物料已安装'}
];
function materialDay(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date.getTime()/86400000:null;
}
function materialToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function materialDone(v){return v==='已完成'||materialDay(v)!==null;}
function materialValidate(plan){
  if(!Array.isArray(plan)||plan.length!==3)return '请补充物料计划日期';
  for(const type of MATERIAL_TYPES){
    const entries=plan.filter(p=>p&&p.key===type.key);
    if(entries.length!==1)return '请补充'+type.name+'计划';
    const p=entries[0];if(p.notNeeded===true)continue;
    if(materialDay(p.shipDate)===null||materialDay(p.arrivalDate)===null)return '请填写'+type.name+'的计划发货、到货日期';
    if(p.arrivalDate<p.shipDate)return type.name+'计划到货日期不能早于发货日期';
  }
  return '';
}
function materialReminders(store,today=materialToday()){
  if(['已完成','已弃店'].includes(store['门店状态']))return [];
  if(!materialDone(store[MATERIAL_START_NODE]))return [];
  const plan=store[MATERIAL_PLAN_FIELD];
  if(materialValidate(plan))return [{level:'missing',text:'请补充物料计划日期：点击“工程项目启动会完成以及物料下单”填写。'}];
  const result=[];
  for(const type of MATERIAL_TYPES){
    const p=plan.find(p=>p.key===type.key);if(p.notNeeded)continue;
    for(const [dateKey,node,action] of [['shipDate',type.ship,'发货'],['arrivalDate',type.arrival,'到货']]){
      if(materialDone(store[node]))continue;
      const days=materialDay(today)-materialDay(p[dateKey]);if(days<0)continue;
      const timing=days===0?'今日计划'+action:'计划'+action+'日期已过'+days+'天';
      result.push({level:days===0?'today':'overdue',text:`${type.name}${timing}（计划日期：${p[dateKey]}），“${node}”尚未完成，请${action==='发货'?'确认发货并更新节点':'核实到货及安装情况'}。`});
    }
  }
  return result;
}
function materialEscape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderMaterialReminders(store){
  const reminders=materialReminders(store);
  const items=reminders.map(r=>`<span style="display:block;padding:6px 10px;border-radius:4px;border:1px solid ${r.level==='overdue'?'#ff7875':'#ffd666'};color:${r.level==='overdue'?'#cf1322':'#874d00'};background:${r.level==='overdue'?'#fff1f0':'#fffbe6'}">${materialEscape(r.text)}</span>`).join('');
  return `<div class="info-row material-overdue-row" data-material-store="${materialEscape(store._syncId||'')}" style="${items?'':'display:none'}"><div class="info-title">工程物料超期提醒</div><div style="display:flex;flex-direction:column;gap:6px;flex:1;min-width:0">${items}</div></div>`;
}
let materialEditor=null;
function closeMaterialPlan(force=false){
  if(materialEditor?.saving&&!force)return;
  document.getElementById('materialPlanDialog')?.remove();
  const focus=materialEditor?.focus;materialEditor=null;focus?.focus?.();
}
function openMaterialPlan(storeIdx){
  if(!['superadmin','admin','engineer'].includes(checkRole()))return;
  if(materialEditor)return;
  const store=STORES[storeIdx];if(!store)return;
  const overlay=document.createElement('div');overlay.id='materialPlanDialog';
  overlay.style.cssText='position:fixed;inset:0;background:#0007;z-index:2147483644;display:flex;align-items:center;justify-content:center;padding:16px';
  const panel=document.createElement('form');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','materialPlanTitle');
  panel.style.cssText='background:white;border-radius:12px;padding:24px;width:650px;max-width:100%;max-height:90vh;overflow:auto;color:#222;box-sizing:border-box';
  panel.innerHTML='<h2 id="materialPlanTitle" style="margin-top:0">工程物料计划</h2><p id="materialPlanStore"></p><p style="color:#666">填写计划日期，或勾选“无需此项”。到货计划以对应“已安装”节点判断完成。保存后完成启动会节点。</p>';
  panel.querySelector('#materialPlanStore').textContent=store['门店'];
  const fields=[];
  for(const type of MATERIAL_TYPES){
    const p=Array.isArray(store[MATERIAL_PLAN_FIELD])?store[MATERIAL_PLAN_FIELD].find(p=>p.key===type.key)||{}:{};
    const box=document.createElement('fieldset');box.style.cssText='border:1px solid #ddd;border-radius:8px;padding:12px;margin:12px 0';
    box.innerHTML=`<legend>${type.name}</legend><label style="display:block;margin-bottom:10px"><input type="checkbox" name="${type.key}-skip"> 无需此项</label><div style="display:flex;flex-wrap:wrap;gap:16px"><label style="flex:1;min-width:180px">${type.name}计划发货日期<input style="display:block;width:100%;box-sizing:border-box;padding:8px;margin-top:6px" type="date" name="${type.key}-ship" required></label><label style="flex:1;min-width:180px">${type.name}计划到货日期<input style="display:block;width:100%;box-sizing:border-box;padding:8px;margin-top:6px" type="date" name="${type.key}-arrival" required></label></div>`;
    const skip=box.querySelector('[type=checkbox]'),ship=box.querySelector(`[name="${type.key}-ship"]`),arrival=box.querySelector(`[name="${type.key}-arrival"]`);
    skip.checked=p.notNeeded===true;ship.value=p.shipDate||'';arrival.value=p.arrivalDate||'';
    const update=()=>{ship.disabled=arrival.disabled=skip.checked;arrival.min=ship.value;};skip.onchange=update;ship.oninput=update;update();
    fields.push({type,skip,ship,arrival});panel.appendChild(box);
  }
  const error=document.createElement('p');error.setAttribute('role','alert');error.style.color='#cf1322';panel.appendChild(error);
  const footer=document.createElement('div');footer.style.cssText='display:flex;gap:12px;justify-content:flex-end';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='取消';cancel.onclick=()=>closeMaterialPlan();
  const submit=document.createElement('button');submit.type='submit';submit.textContent='保存计划并完成节点';submit.style.cssText='background:#1677ff;color:white;border:0;border-radius:6px;padding:10px 16px';footer.append(cancel,submit);panel.appendChild(footer);overlay.appendChild(panel);
  const editor={id:store._syncId,store,fields,saving:false,focus:document.activeElement};materialEditor=editor;
  panel.onsubmit=async event=>{
    event.preventDefault();if(editor.saving)return;
    const plan=fields.map(({type,skip,ship,arrival})=>({key:type.key,notNeeded:skip.checked,shipDate:skip.checked?'':ship.value,arrivalDate:skip.checked?'':arrival.value}));
    error.textContent=materialValidate(plan);if(error.textContent)return;
    const idx=STORES.findIndex(s=>editor.id?s._syncId===editor.id:s===editor.store);
    if(idx<0){error.textContent='该门店已不存在，请关闭窗口并刷新。';return;}
    editor.saving=true;submit.disabled=cancel.disabled=true;submit.textContent='正在保存…';
    fields.forEach(f=>{f.skip.disabled=f.ship.disabled=f.arrival.disabled=true;});
    STORES[idx][MATERIAL_PLAN_FIELD]=plan;STORES[idx][MATERIAL_START_NODE]='已完成';
    try{await saveStores();closeMaterialPlan(true);checkAndCompleteStore(idx);render();}
    catch(e){error.textContent='保存尚未成功，输入已保留。请处理保存失败或冲突提示后重试。';}
    finally{editor.saving=false;submit.disabled=cancel.disabled=false;submit.textContent='保存计划并完成节点';fields.forEach(f=>{f.skip.disabled=false;f.ship.disabled=f.arrival.disabled=f.skip.checked;});}
  };
  panel.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();closeMaterialPlan();}if(e.key==='Tab'){const list=Array.from(panel.querySelectorAll('input,button')).filter(e=>!e.disabled);const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
  document.body.appendChild(overlay);fields[0].skip.focus();
}
// Refresh reminder dates after midnight without rerendering or losing editor input.
let materialRenderedDay=materialToday();
setInterval(()=>{const today=materialToday();if(today===materialRenderedDay)return;materialRenderedDay=today;
  document.querySelectorAll('[data-material-store]').forEach(el=>{const store=STORES.find(s=>s._syncId===el.dataset.materialStore);if(store)el.outerHTML=renderMaterialReminders(store);});
},60000);
