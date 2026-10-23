/* Temporary detail-page data only; independent of the persistent profile cache. */
(function(root,factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DetailStore=api;
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const DB_NAME='h5-share-detail-v1',STORE='records',PREFIX='h5-share-detail-v1:';
  const TTL=24*60*60*1000,MAX_RECORDS=20,ID=/^[A-Za-z0-9_-]{16,80}$/;
  let sequence=0;
  const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
  const object=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
  function validPayload(value){
    if(!object(value)||!object(value.snapshot)||!object(value.draft))return false;
    const s=value.snapshot,d=value.draft;
    return typeof s.avatar==='string'&&typeof s.nickname==='string'&&typeof s.content==='string'&&typeof s.timeLabel==='string'&&Array.isArray(s.photos)&&Array.isArray(s.likers)&&
      s.photos.every(p=>object(p)&&typeof p.src==='string'&&Number.isFinite(p.width)&&p.width>0&&Number.isFinite(p.height)&&p.height>0)&&
      s.likers.every(p=>object(p)&&typeof p.src==='string'&&typeof p.name==='string')&&
      d.version===1&&typeof d.selfLike==='boolean'&&typeof d.publishAt==='string'&&Array.isArray(d.users)&&
      d.users.every(p=>object(p)&&typeof p.name==='string'&&typeof p.avatarCustom==='boolean'&&typeof p.avatarCategory==='string');
  }
  function clone(value){
    const seen=new Set();
    function inspect(item){
      if(item===null||typeof item==='string'||typeof item==='boolean')return;
      if(typeof item==='number'&&Number.isFinite(item))return;
      if(typeof item!=='object'||seen.has(item))throw new Error('Invalid JSON data');
      if(!Array.isArray(item)&&Object.prototype.toString.call(item)!=='[object Object]')throw new Error('Invalid JSON object');
      seen.add(item);for(const key of Object.keys(item))inspect(item[key]);seen.delete(item);
    }
    inspect(value);
    return JSON.parse(JSON.stringify(value));
  }
  function create(options={}){
    function setting(name){try{return own(options,name)?options[name]:root[name];}catch(_){return null;}}
    const indexedDB=setting('indexedDB'),session=setting('sessionStorage'),crypto=setting('crypto');
    const now=typeof options.now==='function'?options.now:Date.now;
    const random=typeof options.random==='function'?options.random:Math.random;
    const timeout=Math.max(1,Math.min(10000,Number(options.timeoutMs)||3000));
    let database=null,opening=null,queue=Promise.resolve();
    const storageError=()=>new Error('当前浏览器无法暂存详情，请保留当前页面后重试');
    function currentTime(){const time=Number(now());return Number.isFinite(time)?time:Date.now();}
    function validRecord(record,id){
      return object(record)&&record.version===1&&typeof record.id==='string'&&ID.test(record.id)&&(!id||record.id===id)&&
        Number.isFinite(record.createdAt)&&record.createdAt<=currentTime()+60000&&currentTime()-record.createdAt<TTL&&validPayload(record.payload);
    }
    function makeId(){
      try{if(crypto&&typeof crypto.randomUUID==='function'){const id='d_'+crypto.randomUUID();if(ID.test(id))return id;}}catch(_){}
      try{if(crypto&&typeof crypto.getRandomValues==='function'){const bytes=new Uint8Array(20);crypto.getRandomValues(bytes);return'd_'+Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}}catch(_){}
      const bytes=Array.from({length:16},()=>Math.max(0,Math.min(255,Math.floor(Number(random())*256)||0)).toString(16).padStart(2,'0')).join('');
      return'd_'+Math.max(0,currentTime()).toString(36)+'_'+bytes+'_'+(++sequence).toString(36);
    }
    function openDatabase(){
      if(database)return Promise.resolve(database);
      if(opening)return opening;
      opening=new Promise((resolve,reject)=>{
        if(!indexedDB||typeof indexedDB.open!=='function'){reject(storageError());return;}
        let request,settled=false;
        const timer=setTimeout(()=>finish(false),timeout);
        function finish(ok,result){if(settled){if(ok&&result)try{result.close();}catch(_){}return;}settled=true;clearTimeout(timer);if(ok){database=result;database.onversionchange=()=>{try{result.close();}catch(_){}if(database===result)database=null;};resolve(result);}else reject(storageError());}
        try{
          request=indexedDB.open(DB_NAME,1);
          request.onupgradeneeded=()=>{try{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});}catch(_){try{request.transaction.abort();}catch(_){}finish(false);}};
          request.onsuccess=()=>finish(true,request.result);
          request.onerror=()=>finish(false);
          // A blocked upgrade is bounded by the same timeout, rather than
          // waiting forever for another page to close its connection.
        }catch(_){finish(false);}
      }).finally(()=>{opening=null;});
      return opening;
    }
    function transact(db,mode,work){
      return new Promise((resolve,reject)=>{
        let transaction,settled=false,result;
        const timer=setTimeout(()=>{try{transaction&&transaction.abort();}catch(_){}finish(false);},timeout);
        function finish(ok){if(settled)return;settled=true;clearTimeout(timer);if(ok)resolve(result);else reject(storageError());}
        try{
          transaction=db.transaction(STORE,mode);
          transaction.oncomplete=()=>finish(true);
          transaction.onabort=transaction.onerror=()=>finish(false);
          work(transaction.objectStore(STORE),value=>{result=value;});
        }catch(_){try{transaction&&transaction.abort();}catch(_){}finish(false);}
      });
    }
    function sessionRecords(){
      if(!session||typeof session.getItem!=='function'||typeof session.setItem!=='function')throw storageError();
      const records=[],keys=[];
      for(let index=0;index<session.length;index++){const key=session.key(index);if(typeof key==='string'&&key.startsWith(PREFIX))keys.push(key);}
      for(const key of keys){
        let record;
        try{record=JSON.parse(session.getItem(key));}catch(_){}
        if(validRecord(record,key.slice(PREFIX.length)))records.push(record);
        else session.removeItem(key);
      }
      return records;
    }
    function ordered(records,newId){return records.sort((a,b)=>(b.id===newId)-(a.id===newId)||b.createdAt-a.createdAt||a.id.localeCompare(b.id));}
    async function savePrimary(record){
      const db=await openDatabase();
      let fallback=[];try{fallback=sessionRecords();}catch(_){}
      await transact(db,'readwrite',store=>{
        for(const item of fallback)store.put(item);
        store.put(record);
        // Read one record at a time. getAll() would decode every cached large
        // image into memory at once just to decide which old keys to remove.
        const items=[],request=store.openCursor();
        request.onsuccess=()=>{
          const cursor=request.result;
          if(cursor){const item=cursor.value;items.push({key:cursor.primaryKey,id:item&&item.id,createdAt:item&&item.createdAt,valid:validRecord(item)});cursor.continue();return;}
          const valid=ordered(items.filter(item=>item.valid),record.id),keep=new Set(valid.slice(0,MAX_RECORDS).map(item=>item.id));
          for(const item of items)if(!keep.has(item.id))store.delete(item.key);
        };
      });
      // Successfully migrated fallback records no longer occupy session quota.
      if(session)for(const item of fallback)try{session.removeItem(PREFIX+item.id);}catch(_){}
    }
    function saveFallback(record){
      const previous=sessionRecords();
      const key=PREFIX+record.id,serialized=JSON.stringify(record);
      try{session.setItem(key,serialized);}catch(_){
        // Reclaim only the oldest of this module's records when the fallback
        // is full. Never touch the persistent avatar/nickname cache.
        const oldest=ordered(previous.slice()).reverse();let saved=false;
        for(const item of oldest){session.removeItem(PREFIX+item.id);try{session.setItem(key,serialized);saved=true;break;}catch(_){}}
        if(!saved)throw storageError();
      }
      const keep=new Set(ordered(previous.filter(item=>item.id!==record.id).concat(record),record.id).slice(0,MAX_RECORDS).map(item=>item.id));
      for(const item of previous)if(!keep.has(item.id))session.removeItem(PREFIX+item.id);
    }
    async function loadPrimary(id){
      const db=await openDatabase();
      return transact(db,'readwrite',(store,setResult)=>{
        const request=store.get(id);
        request.onsuccess=()=>{const record=request.result;if(validRecord(record,id)){try{setResult(clone(record.payload));}catch(_){store.delete(id);setResult(null);}}else{if(record)store.delete(id);setResult(null);}};
      });
    }
    function loadFallback(id){
      if(!session||typeof session.getItem!=='function')return null;
      const key=PREFIX+id,serialized=session.getItem(key);if(!serialized)return null;
      let record;try{record=JSON.parse(serialized);}catch(_){}
      if(!validRecord(record,id)){session.removeItem(key);return null;}
      return clone(record.payload);
    }
    function enqueue(work){const pending=queue.then(work,work);queue=pending.catch(()=>{});return pending;}
    return{
      save(value){
        let payload;try{payload=clone(value);if(!validPayload(payload))throw new Error();}catch(_){return Promise.reject(new Error('详情数据格式不正确，请返回重新生成'));}
        return enqueue(async()=>{
          const id=makeId(),record={version:1,id,createdAt:currentTime(),payload};
          try{await savePrimary(record);return id;}catch(_){}
          try{saveFallback(record);return id;}catch(_){throw storageError();}
        });
      },
      load(id){
        if(typeof id!=='string'||!ID.test(id))return Promise.resolve(null);
        return enqueue(async()=>{
          // A preceding page may already have hit the IndexedDB timeout and
          // saved this token in its session fallback. Do not make navigation
          // wait through the same unavailable database a second time.
          try{const payload=loadFallback(id);if(payload)return payload;}catch(_){}
          try{const payload=await loadPrimary(id);if(payload)return payload;}catch(_){}
          try{return loadFallback(id);}catch(_){return null;}
        });
      }
    };
  }
  return{create,DB_NAME,STORE,PREFIX,TTL,MAX_RECORDS};
});
