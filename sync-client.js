/* Local test integration. Requires SyncCore and the application's existing globals. */
let _syncBase=null,_syncQueue=Promise.resolve(),_syncPending=null,_syncConflict=null;
let _syncEpoch=0,_syncBusy=0,_syncPollBusy=false,_syncTimer=null,_syncFailure=false;
const SYNC_INTERVAL=5000;
function syncUUID(){if(crypto.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
const _syncEditors=['storeEditorPanel','nodeEditorPanel','basicFieldSettingsPanel','maintenanceEditorPanel','financeEditPanel','detailPanel'];
function syncSnapshot() {
  const d={stores:STORES,basicFields:BASIC_FIELDS,storePhases:PHASES,suppliers:SUPPLIERS,maintenanceRecords:MAINTENANCE_RECORDS};
  SyncCore.normalize(d,()=>syncUUID());return SyncCore.clone(d);
}
function syncDirty(){return !!_syncBase&&SyncCore.diff(_syncBase,syncSnapshot()).length>0;}
function syncEditing(){return _syncEditors.some(id=>document.getElementById(id)?.classList.contains('open'))||['datePickerOverlay','stopWorkOverlay'].some(id=>document.getElementById(id)?.classList.contains('show'))||!!document.getElementById('supplierModalOverlay')||!!document.getElementById('syncConflictDialog')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);}
function syncStatus(message,error=false) {
  let bar=document.getElementById('syncStatusBar');
  if(!bar){bar=document.createElement('div');bar.id='syncStatusBar';bar.style.cssText='position:fixed;bottom:28px;left:12px;right:12px;z-index:2147483645;padding:9px 12px;border-radius:6px;background:#e6f4ff;color:#16365d;font-size:13px;display:flex;gap:12px;align-items:center';document.body.appendChild(bar);}
  bar.replaceChildren();bar.style.background=error?'#fff1f0':'#e6f4ff';
  const text=document.createElement('span');text.textContent=message;bar.appendChild(text);
  if(error){const button=document.createElement('button');button.textContent=_syncConflict?'核对冲突':'重试保存';button.onclick=()=>_syncConflict?showSyncConflict():saveStoresToServer().catch(()=>{});bar.appendChild(button);}
}
function syncKeepDraft(){try {sessionStorage.setItem('jd-sync-draft',JSON.stringify({base:_syncBase,local:syncSnapshot(),pending:_syncPending}));}catch(e){syncStatus('草稿未能写入浏览器缓存，请保持页面打开。',true);}}
function syncInstall(data,render=false) {
  STORES=SyncCore.clone(data.stores);BASIC_FIELDS=SyncCore.clone(data.basicFields);PHASES=SyncCore.clone(data.storePhases);
  SUPPLIERS=SyncCore.clone(data.suppliers);MAINTENANCE_RECORDS=SyncCore.clone(data.maintenanceRecords);
  ALL_STEPS=[].concat.apply([],PHASES.map(p=>p.steps.map(s=>({step:s.name,phase:p,requireDate:s.requireDate}))));
  _syncBase=SyncCore.clone(data);
  for(const [key,value] of [['storeData',STORES],['basicFields',BASIC_FIELDS],['storePhases',PHASES],['storeSuppliers',SUPPLIERS],['maintenanceRecords',MAINTENANCE_RECORDS]])localStorage.setItem(key,JSON.stringify(value));
  if(render){for(const fn of ['render','renderOverview','renderDetail','updateStats','renderMaintenanceList','renderSupplierList','renderFinanceStoreList']){try{if(typeof window[fn]==='function')window[fn]();}catch(e){console.error('刷新显示失败',fn,e);}}}
}
async function syncFetch(url,options={}) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{return await fetch(url,{...options,cache:'no-store',signal:controller.signal});}finally{clearTimeout(timer);}
}
async function loadStoresFromServer() {
  try {
    const r=await syncFetch(`${API_BASE}/data`);if(!r.ok)throw Error('无法加载服务器数据');
    const d=await r.json();if(d._sync?.protocol!==2)throw Error('服务版本不匹配，请刷新或联系维护人员');
    syncInstall(d);dataLoaded=true;
    const saved=sessionStorage.getItem('jd-sync-draft');
    if(saved&&confirm('检测到本页未保存的草稿，是否恢复？恢复后仍需保存，冲突会再次核对。')){
      const draft=JSON.parse(saved);SyncCore.normalize(draft.local,()=>syncUUID());
      syncInstall(draft.local);_syncBase=draft.base;_syncPending=draft.pending||null;_syncFailure=true;syncStatus('已恢复草稿，请核对后保存。',true);
    } else {sessionStorage.removeItem('jd-sync-draft');syncStatus('数据已加载，多人编辑保护已启用');}
    return true;
  } catch(e){_syncFailure=true;syncStatus('加载失败：'+e.message+'。为防止覆盖，暂时不能保存。',true);return false;}
}
async function syncSendPending() {
  const pending=_syncPending;
  const r=await syncFetch(`${API_BASE}/data`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending.body)});
  const result=await r.json();
  if(!r.ok||!result.success){
    if(r.status===409){_syncConflict={remote:result.data,conflicts:result.conflicts||[]};_syncPending=null;}
    throw Error(result.message||'服务器未确认保存成功');
  }
  // Keep current array order and later local edits intact. Remote changes are installed by a safe poll.
  _syncBase=SyncCore.clone(pending.snapshot);_syncBase._sync=result.data._sync;_syncPending=null;
}
function saveStoresToServer() {
  _syncEpoch++;_syncBusy++;
  const task=_syncQueue.catch(()=>{}).then(async()=>{
    try {
      if(!_syncBase)throw Error('数据尚未加载，请刷新后再编辑');
      if(_syncConflict)throw Error('请先核对保存冲突');
      syncStatus('正在保存，请稍候…');
      if(_syncPending)await syncSendPending();
      const snapshot=syncSnapshot(),changes=SyncCore.diff(_syncBase,snapshot);
      if(changes.length){_syncPending={snapshot,body:{protocol:2,requestId:syncUUID(),baseRevision:_syncBase._sync.revision,changes}};syncKeepDraft();await syncSendPending();}
      _syncFailure=false;
      if(syncDirty())syncKeepDraft();else sessionStorage.removeItem('jd-sync-draft');
      syncStatus(syncDirty()?'已保存提交内容，仍有后续修改未保存':'服务器已确认保存成功');
      return true;
    } catch(e){_syncFailure=true;e.syncHandled=true;syncKeepDraft();syncStatus(e.message+'；你的修改已保留。',true);if(_syncConflict)showSyncConflict();throw e;}
    finally{_syncBusy--;_syncEpoch++;}
  });
  _syncQueue=task;return task;
}
async function saveStores(){return await saveStoresToServer();}
async function syncFromServer(){
  if(!_syncBase||_syncBusy||_syncFailure||_syncPollBusy||syncEditing()||syncDirty())return;
  const epoch=_syncEpoch;_syncPollBusy=true;
  try{
    const r=await syncFetch(`${API_BASE}/data`);if(!r.ok)return;const d=await r.json();
    if(epoch!==_syncEpoch||_syncBusy||_syncFailure||syncEditing()||syncDirty())return;
    if(d._sync?.protocol===2&&d._sync.revision!==_syncBase._sync.revision){syncInstall(d,true);syncStatus('已同步其他人的更新');}
    // Same revision can still contain merged remote fields absent from our save baseline.
    else if(d._sync?.protocol===2&&!SyncCore.equal({...d,_sync:null},{..._syncBase,_sync:null}))syncInstall(d,true);
  }catch(e){/* Keep current data; a later poll retries. */}finally{_syncPollBusy=false;}
}
function startSyncPolling(){stopSyncPolling();_syncTimer=setInterval(syncFromServer,SYNC_INTERVAL);}
function stopSyncPolling(){if(_syncTimer)clearInterval(_syncTimer);_syncTimer=null;}
function syncDisplayValue(value){if(value&&typeof value.exists==='boolean')value=value.exists?value.value:'（未填写）';return typeof value==='string'?value:JSON.stringify(value,null,2);}
function showSyncConflict(){
  if(!_syncConflict||document.getElementById('syncConflictDialog'))return;
  const local=syncSnapshot(),ops=SyncCore.diff(_syncBase,local),remote=_syncConflict.remote;
  if(!remote){syncStatus('无法获得冲突详情，请保留草稿并稍后重试。',true);return;}
  const conflict=SyncCore.apply(remote,ops).conflicts;
  const overlay=document.createElement('div');overlay.id='syncConflictDialog';overlay.style.cssText='position:fixed;inset:0;background:#0007;z-index:2147483646;display:flex;align-items:center;justify-content:center';
  const panel=document.createElement('div');panel.style.cssText='background:white;padding:24px;border-radius:12px;max-width:850px;width:90%;max-height:85vh;overflow:auto;color:#222';overlay.appendChild(panel);
  const title=document.createElement('h2');title.textContent='内容发生冲突，请核对';panel.appendChild(title);
  const info=document.createElement('p');info.textContent='本次修改尚未保存。请选择冲突项的处理方式；其他修改会保留。处理后重新核对页面，再点击保存。';panel.appendChild(info);
  const choices=new Map();
  for(const c of conflict){
    const op=ops[c.index],box=document.createElement('div');box.style.cssText='padding:12px;border:1px solid #ddd;margin:10px 0';
    const row=local[c.section]?.find?.(r=>r._syncId===c.id)||remote[c.section]?.find?.(r=>r._syncId===c.id);
    const label=document.createElement('strong');label.textContent=(row?.['门店']||row?.name||row?.storeName||c.section)+' / '+(c.path.join(' → ')||'整条记录')+'：'+c.reason;box.appendChild(label);
    const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';pre.textContent='线上内容：'+syncDisplayValue(c.remote)+'\n我的修改：'+syncDisplayValue(op.after??'(删除记录)');box.appendChild(pre);
    const select=document.createElement('select');select.add(new Option('保留线上内容','remote'));if(c.reason!=='记录已被其他人删除'&&c.reason!=='父字段类型已变化'&&c.reason!=='此编号已存在')select.add(new Option('使用我的修改（下次保存仍检查冲突）','mine'));choices.set(c.index,select);box.appendChild(select);panel.appendChild(box);
  }
  const apply=document.createElement('button');apply.textContent='应用选择，保留草稿';apply.onclick=()=>{
    const selected=ops.filter((o,i)=>!choices.has(i)||choices.get(i).value==='mine');
    const merged=SyncCore.apply(remote,selected,true);if(merged.conflicts.length){alert('记录结构已改变，请先保留线上内容。');return;}
    for(const id of _syncEditors)document.getElementById(id)?.classList.remove('open');
    document.getElementById('supplierModalOverlay')?.remove();document.getElementById('overlay')?.classList.remove('show');
    overlay.remove();syncInstall(merged.data,true);_syncBase=SyncCore.clone(remote);_syncConflict=null;_syncPending=null;_syncFailure=syncDirty();_syncEpoch++;syncKeepDraft();syncStatus('冲突已整理，请核对草稿并点击重试保存。',true);
  };panel.appendChild(apply);
  const close=document.createElement('button');close.textContent='暂不处理，保留输入';close.style.marginLeft='12px';close.onclick=()=>overlay.remove();panel.appendChild(close);document.body.appendChild(overlay);
}
window.addEventListener('beforeunload',e=>{if(_syncBusy||_syncFailure||syncDirty()||syncEditing()){syncKeepDraft();e.preventDefault();e.returnValue='';}});
window.addEventListener('unhandledrejection',e=>{if(e.reason?.syncHandled)e.preventDefault();});
