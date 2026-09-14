'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const Core=require('../sync-core');
module.exports=function createStore(file) {
  const lock=file+'.sync-lock';
  function locked(fn) {
    let fd;
    try {fd=fs.openSync(lock,'wx',0o600);} catch(e) {if(e.code==='EEXIST'){e.status=503;e.message='数据正在保存，请稍后重试';}throw e;}
    try {return fn();} finally {fs.closeSync(fd);fs.unlinkSync(lock);}
  }
  function write(data) {
    const tmp=file+'.tmp-'+crypto.randomUUID();let fd;
    try {fd=fs.openSync(tmp,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(data,null,2));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(tmp,file);}
    finally {if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
  }
  function read() {const data=JSON.parse(fs.readFileSync(file,'utf8'));if(!data._syncMeta||data._syncMeta.protocol!==2)throw Error('数据同步版本无效');return data;}
  const publicData=d=>{const r=Core.clone(d);delete r._syncMeta;r._sync={protocol:2,revision:d._syncMeta.revision};return r;};
  locked(()=>{
    const original=fs.readFileSync(file,'utf8'),data=JSON.parse(original);
    const before=JSON.stringify(data);
    for(const key of [...Core.records,...Core.settings]) if(data[key]===undefined)data[key]=[];
    Core.normalize(data,()=>crypto.randomUUID());
    if(!data._syncMeta)data._syncMeta={protocol:2,revision:0,receipts:[]};
    if(data._syncMeta.protocol!==2||!Number.isSafeInteger(data._syncMeta.revision)||!Array.isArray(data._syncMeta.receipts))throw Error('无法识别同步元数据');
    if(before!==JSON.stringify(data)) {
      fs.writeFileSync(file+'.before-sync-'+Date.now()+'.json',original,{flag:'wx',mode:0o600});write(data);
    }
  });
  return {
    get:()=>publicData(read()),
    save:body=>locked(()=>{
      if(!body||body.protocol!==2){const e=Error('此页面版本过旧，请刷新页面后再保存。旧版整份覆盖已被阻止。');e.status=428;throw e;}
      if(!/^[a-zA-Z0-9_-]{8,100}$/.test(body.requestId||'')||!Number.isSafeInteger(body.baseRevision)||body.baseRevision<0){const e=Error('保存请求格式错误');e.status=400;throw e;}
      try {Core.validate(body.changes);}catch(e){e.status=400;throw e;}
      const current=read(),hash=crypto.createHash('sha256').update(JSON.stringify(body.changes)).digest('hex');
      const receipt=current._syncMeta.receipts.find(r=>r.id===body.requestId);
      if(receipt) {
        if(receipt.hash!==hash){const e=Error('重复请求编号对应不同内容');e.status=400;throw e;}
        return {success:true,replayed:true,data:publicData(current)};
      }
      if(body.baseRevision>current._syncMeta.revision){const e=Error('客户端数据版本异常，请重新核对');e.status=409;e.data=publicData(current);e.conflicts=[];throw e;}
      const merged=Core.apply(current,body.changes);
      if(merged.conflicts.length){const e=Error('保存冲突：其他人已修改相同内容。你的输入已保留，请核对。');e.status=409;e.conflicts=merged.conflicts;e.data=publicData(current);throw e;}
      Core.normalize(merged.data,()=>crypto.randomUUID());
      merged.data._syncMeta.revision++;
      merged.data._syncMeta.receipts.push({id:body.requestId,hash});
      merged.data._syncMeta.receipts=merged.data._syncMeta.receipts.slice(-256);
      write(merged.data);
      return {success:true,data:publicData(merged.data)};
    })
  };
};
