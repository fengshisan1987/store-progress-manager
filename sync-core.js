(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SyncCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const records = ['stores', 'suppliers', 'maintenanceRecords'];
  const settings = ['basicFields', 'storePhases'];
  const clone = x => JSON.parse(JSON.stringify(x));
  const own = (x, k) => Object.prototype.hasOwnProperty.call(x, k);
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  function equal(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null) return false;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v,i) => equal(v,b[i]));
    if (object(a) && object(b)) {
      const keys = Object.keys(a);
      return keys.length === Object.keys(b).length && keys.every(k => own(b,k) && equal(a[k],b[k]));
    }
    return false;
  }
  function normalize(data, uuid) {
    for (const section of records) {
      if (!Array.isArray(data[section])) throw Error('记录列表格式错误：'+section);
      const seen = new Set();
      for (const row of data[section]) {
        if (!object(row)) throw Error('记录格式错误');
        if (!row._syncId) row._syncId = uuid();
        if (typeof row._syncId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(row._syncId) || seen.has(row._syncId)) throw Error('记录编号重复或无效');
        seen.add(row._syncId);
      }
    }
    for (const section of settings) if (!Array.isArray(data[section])) throw Error('设置格式错误：'+section);
    return data;
  }
  const state = (obj,k) => own(obj,k) ? {exists:true,value:clone(obj[k])} : {exists:false};
  function at(row,path) {
    let current = row;
    for (let i=0;i<path.length;i++) {
      if (!object(current) || !own(current,path[i])) return {exists:false};
      current = current[path[i]];
    }
    return {exists:true,value:clone(current)};
  }
  function put(row,path,next) {
    let current=row;
    for (let i=0;i<path.length-1;i++) {
      if (!own(current,path[i])) current[path[i]]={};
      if (!object(current[path[i]])) throw Error('父字段类型已变化');
      current=current[path[i]];
    }
    if (next.exists) current[path[path.length-1]]=clone(next.value);
    else delete current[path[path.length-1]];
  }
  function diff(base,local) {
    const ops=[];
    function fields(section,id,a,b,path) {
      for (const k of new Set([...Object.keys(a),...Object.keys(b)])) {
        if (k==='_syncId') continue;
        const before=state(a,k), after=state(b,k);
        if (equal(before,after)) continue;
        if (object(a[k]) && object(b[k])) fields(section,id,a[k],b[k],[...path,k]);
        else ops.push({kind:'set',section,id,path:[...path,k],before,after});
      }
    }
    for (const section of records) {
      const a=new Map(base[section].map(r=>[r._syncId,r]));
      const b=new Map(local[section].map(r=>[r._syncId,r]));
      for (const [id,row] of a) {
        if (!b.has(id)) ops.push({kind:'remove',section,id,before:clone(row)});
        else fields(section,id,row,b.get(id),[]);
      }
      for (const [id,row] of b) if (!a.has(id)) ops.push({kind:'add',section,id,after:clone(row)});
    }
    for (const section of settings) if (!equal(base[section],local[section])) ops.push({kind:'setting',section,before:clone(base[section]),after:clone(local[section])});
    return ops;
  }
  function validate(ops) {
    if (!Array.isArray(ops) || ops.length>30000) throw Error('修改数量或格式无效');
    for (const op of ops) {
      if (!object(op)) throw Error('修改格式无效');
      if (op.kind==='setting') {
        if (!settings.includes(op.section) || !Array.isArray(op.before) || !Array.isArray(op.after)) throw Error('设置修改无效');
        continue;
      }
      if (!records.includes(op.section) || typeof op.id!=='string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(op.id)) throw Error('记录编号无效');
      if (op.kind==='set') {
        if (!Array.isArray(op.path) || !op.path.length || op.path.length>20 || op.path.some(k=>typeof k!=='string'||!k.length||['__proto__','constructor','prototype','_syncId'].includes(k))) throw Error('字段路径无效');
        for (const s of [op.before,op.after]) if (!object(s)||typeof s.exists!=='boolean'||(s.exists&&!own(s,'value'))) throw Error('字段值无效');
      } else if (op.kind==='add') {
        if (!object(op.after)||op.after._syncId!==op.id) throw Error('新记录编号无效');
      } else if (op.kind==='remove') {
        if (!object(op.before)||op.before._syncId!==op.id) throw Error('删除记录无效');
      } else throw Error('不支持的修改类型');
    }
  }
  function apply(current,ops,force=false) {
    validate(ops);
    const result=clone(current),conflicts=[];
    for (let index=0;index<ops.length;index++) {
      const op=ops[index];let reason='',remote;
      if (op.kind==='setting') {
        remote=result[op.section];
        if (!force&&!equal(remote,op.before)&&!equal(remote,op.after)) reason='设置已被其他人修改';
        else result[op.section]=clone(op.after);
      } else {
        const list=result[op.section],i=list.findIndex(r=>r._syncId===op.id),row=list[i];
        if (op.kind==='add') {
          remote=row;
          if (row&&!equal(row,op.after)) reason='此编号已存在';
          else if (!row) list.push(clone(op.after));
        } else if (op.kind==='remove') {
          remote=row;
          if (row&&!force&&!equal(row,op.before)) reason='记录在删除前被其他人修改';
          else if (row) list.splice(i,1);
        } else if (!row) reason='记录已被其他人删除';
        else {
          remote=at(row,op.path);
          if (!force&&!equal(remote,op.before)&&!equal(remote,op.after)) reason='同一字段已被其他人修改';
          else {try {put(row,op.path,op.after);} catch(e) {reason=e.message;}}
        }
      }
      if(reason) conflicts.push({index,reason,section:op.section,id:op.id,path:op.path||[],remote:remote===undefined?null:clone(remote)});
    }
    return {data:conflicts.length?clone(current):result,conflicts};
  }
  return {records,settings,clone,equal,normalize,diff,apply,validate};
});
