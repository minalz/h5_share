'use strict';
const assert=require('node:assert/strict');
const DetailStore=require('../detail-store');
const BASE=1800000000000;
const copy=value=>JSON.parse(JSON.stringify(value));
function payload(name='橘子海'){
  return{snapshot:{avatar:'data:image/png;base64,YQ==',nickname:name,content:'正文',timeLabel:'刚刚',photos:[],likers:[]},draft:{version:1,selfLike:true,publishAt:'2026-10-21T12:00',users:[]}};
}
function sessionStorage(){
  const values=new Map();
  return{values,writes:0,get length(){return values.size;},key:index=>Array.from(values.keys())[index]||null,getItem:key=>values.has(key)?values.get(key):null,setItem(key,value){this.writes++;values.set(key,String(value));},removeItem:key=>values.delete(key)};
}
// An asynchronous, transactional IDB test double. Requests run after handlers
// are registered; transactions serialize and commit only after every request.
function indexedDB(options={}){
  const databases=new Map(),jobs=[],openRequests=[];
  let busy=false,closed=0,aborted=0;
  function schedule(){if(busy||!jobs.length)return;busy=true;const job=jobs.shift();queueMicrotask(()=>job(()=>{busy=false;schedule();}));}
  const factory={databases,openRequests,get closed(){return closed;},get aborted(){return aborted;},
    open(name,version){
      assert.equal(name,DetailStore.DB_NAME);assert.equal(version,1);
      const request={};openRequests.push(request);
      const finish=()=>{
        if(options.failOpen){request.onerror?.({target:request});return;}
        const first=!databases.has(name);if(first)databases.set(name,new Map());
        const stores=databases.get(name);
        const db={objectStoreNames:{contains:name=>stores.has(name)},createObjectStore(name,config){assert.equal(config.keyPath,'id');stores.set(name,new Map());},close(){closed++;},
          transaction(name,mode){
            assert.equal(name,DetailStore.STORE);assert.equal(mode,'readwrite');
            const requests=[];let state='queued',working,release;
            const transaction={abort(){if(state==='done'||state==='aborted')return;state='aborted';aborted++;queueMicrotask(()=>{transaction.onabort?.();if(release){const done=release;release=null;done();}});},objectStore:storeName=>{assert.equal(storeName,name);return api;}};
            function pump(){
              if(state!=='active')return;
              const next=requests.shift();
              if(!next){state='done';stores.set(name,working);queueMicrotask(()=>{transaction.oncomplete?.();if(release){const done=release;release=null;done();}});return;}
              queueMicrotask(()=>{
                if(state!=='active')return;
                try{next.request.result=next.run();next.request.onsuccess?.({target:next.request});pump();}
                catch(error){next.request.error=error;next.request.onerror?.({target:next.request});transaction.onerror?.();transaction.abort();}
              });
            }
            function enqueue(run){const request={};requests.push({request,run});return request;}
            const api={
              put:record=>enqueue(()=>{if(options.failWrite)throw new Error('private content must never escape');working.set(record.id,copy(record));return record.id;}),
              get:id=>enqueue(()=>working.has(id)?copy(working.get(id)):undefined),
              getAll:()=>enqueue(()=>Array.from(working.values(),copy)),
              openCursor(){
                let keys,index=0;
                const request={};
                const read=()=>{
                  if(!keys)keys=Array.from(working.keys());
                  if(index>=keys.length)return null;
                  const key=keys[index];
                  return{primaryKey:key,value:copy(working.get(key)),continue(){index++;requests.push({request,run:read});}};
                };
                requests.push({request,run:read});return request;
              },
              delete:id=>enqueue(()=>working.delete(id))
            };
            if(!options.stallTransaction){jobs.push(done=>{release=done;if(state==='aborted'){release=null;done();return;}working=new Map(stores.get(name));state='active';pump();});schedule();}
            return transaction;
          }};
        request.result=db;
        if(first)request.onupgradeneeded?.({target:request});
        request.onsuccess?.({target:request});
      };
      request.finish=finish;if(!options.stallOpen)queueMicrotask(finish);
      return request;
    }};
  return factory;
}
async function main(){
  let time=BASE;
  const primary=indexedDB(),fallback=sessionStorage();fallback.setItem('h5-share-profile-v1','keep profile');
  const store=DetailStore.create({indexedDB:primary,sessionStorage:fallback,now:()=>time,crypto:null,random:()=>0,timeoutMs:50});
  const original=payload(),id=await store.save(original);
  assert.match(id,/^[A-Za-z0-9_-]{16,80}$/);
  original.snapshot.nickname='已在编辑页修改';
  assert.equal((await store.load(id)).snapshot.nickname,'橘子海','saved detail is independent of subsequent editor mutations');
  const loaded=await store.load(id);loaded.snapshot.content='修改返回值';
  assert.equal((await store.load(id)).snapshot.content,'正文','a caller cannot mutate persisted data by changing its read result');
  assert.equal(fallback.getItem('h5-share-profile-v1'),'keep profile');assert.equal(fallback.writes,1,'working IndexedDB does not depend on session JSON quota');
  const large=payload('大图');large.snapshot.photos=[{src:'data:image/png;base64,'+'A'.repeat(6*1024*1024),width:8192,height:4096}];
  const largeId=await store.save(large);assert.equal((await store.load(largeId)).snapshot.photos[0].src.length,large.snapshot.photos[0].src.length,'data larger than a typical 5 MiB session quota stays in IndexedDB');
  const another=DetailStore.create({indexedDB:primary,sessionStorage:fallback,now:()=>time,crypto:null,random:()=>0,timeoutMs:50});
  assert.equal((await another.load(id)).snapshot.nickname,'橘子海','a new page instance can load the detail token');
  const concurrent=await Promise.all(Array.from({length:23},(_,index)=>{time++;return(index%2?store:another).save(payload('并发'+index));}));
  assert.equal(new Set(concurrent).size,23);
  assert.equal(primary.databases.get(DetailStore.DB_NAME).get(DetailStore.STORE).size,20,'serialized transactions retain at most 20 detail records across instances');
  assert.equal(await store.load(id),null,'older records are evicted');assert.equal((await store.load(concurrent.at(-1))).snapshot.nickname,'并发22');
  time+=DetailStore.TTL;
  assert.equal(await store.load(concurrent.at(-1)),null,'records are invalid at the 24 hour boundary');
  assert.equal(fallback.getItem('h5-share-profile-v1'),'keep profile','detail cleanup never clears the profile namespace');
  const backup=sessionStorage(),onlySession=DetailStore.create({indexedDB:null,sessionStorage:backup,now:()=>BASE,crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789abc'}});
  const backupId=await onlySession.save(payload('备用存储'));assert.equal((await onlySession.load(backupId)).snapshot.nickname,'备用存储');
  assert.ok(backup.getItem(DetailStore.PREFIX+backupId));
  assert.equal(await onlySession.load('../invalid'),null);assert.equal(await onlySession.load('x'),null);assert.equal(await onlySession.load('A'.repeat(81)),null);
  backup.setItem(DetailStore.PREFIX+'invalid_record_123456',JSON.stringify({version:2,id:'invalid_record_123456',createdAt:BASE,payload:payload()}));
  backup.setItem('unrelated-data','keep unrelated');
  assert.equal(await onlySession.load('invalid_record_123456'),null);assert.equal(backup.getItem('unrelated-data'),'keep unrelated');
  const sessionBounds=sessionStorage(),bounded=DetailStore.create({indexedDB:null,sessionStorage:sessionBounds,now:()=>++time,crypto:null});
  for(let index=0;index<25;index++)await bounded.save(payload('第'+index));
  assert.equal([...sessionBounds.values.keys()].filter(key=>key.startsWith(DetailStore.PREFIX)).length,20);
  const stalled=indexedDB({stallOpen:true}),timeoutBackup=sessionStorage();
  const timeoutStore=DetailStore.create({indexedDB:stalled,sessionStorage:timeoutBackup,now:()=>BASE,timeoutMs:12});
  const started=Date.now(),timeoutId=await timeoutStore.save(payload('超时备用'));
  assert.ok(Date.now()-started<1000);assert.ok(timeoutBackup.getItem(DetailStore.PREFIX+timeoutId),'a stalled open must reach its fallback');
  stalled.openRequests[0].finish();assert.equal(stalled.closed,1,'a connection arriving after timeout is closed');
  const stalledTx=indexedDB({stallTransaction:true}),txBackup=sessionStorage(),transactionStore=DetailStore.create({indexedDB:stalledTx,sessionStorage:txBackup,now:()=>BASE,timeoutMs:12});
  const txId=await transactionStore.save(payload('事务超时'));assert.ok(txBackup.getItem(DetailStore.PREFIX+txId));assert.equal(stalledTx.aborted,1);
  const failing=indexedDB({failWrite:true}),writeFallback=sessionStorage(),writeStore=DetailStore.create({indexedDB:failing,sessionStorage:writeFallback,now:()=>BASE,timeoutMs:50});
  const writeId=await writeStore.save(payload('写入失败备用'));assert.equal((await writeStore.load(writeId)).snapshot.nickname,'写入失败备用');
  const migrateFactory=indexedDB(),migrating=DetailStore.create({indexedDB:migrateFactory,sessionStorage:backup,now:()=>BASE});
  await migrating.save(payload('迁移'));assert.equal(backup.getItem(DetailStore.PREFIX+backupId),null);assert.equal((await migrating.load(backupId)).snapshot.nickname,'备用存储','recovered IndexedDB migrates the valid fallback records without losing their tokens');
  const disabled=DetailStore.create({indexedDB:null,sessionStorage:null});
  await assert.rejects(disabled.save(payload('私人昵称不应出现在错误中')),error=>!error.message.includes('私人')&&/无法暂存/.test(error.message));
  assert.equal(await disabled.load(id),null);
  for(const bad of [null,{}, {snapshot:{},draft:{}}, {snapshot:payload().snapshot,draft:{version:2}}, {snapshot:payload().snapshot,draft:{...payload().draft,selfLike:'yes'}}])await assert.rejects(store.save(bad),/数据格式不正确/);
  const badJSON=payload();badJSON.draft.execute=()=>{};await assert.rejects(store.save(badJSON),/数据格式不正确/);
  const cyclic=payload();cyclic.draft.circular=cyclic;await assert.rejects(store.save(cyclic),/数据格式不正确/);
  console.log('PASS: IndexedDB detail storage and large data, page reentry, safe tokens, concurrent 20-record retention, session fallback/migration, 24h expiry, bounded waits, invalid data and profile isolation');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
