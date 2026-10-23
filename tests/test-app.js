// Crop gestures and dedicated HTML detail navigation; no PNG entry or downloads.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),elements=new Map(),drawCalls=[],mounts=[],downloads=[],events={},cacheWrites=[],savedPages=[],loads=[],navigations=[],replaced=[];
const SAFE_ID='0123456789abcdef0123456789abcdef';
let exportCalls=0,destroyed=0,saveAction=async()=>SAFE_ID,loadAction=async()=>null;
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function canvas(){const ctx=new Proxy({drawImage:(...a)=>drawCalls.push(a)},{get:(o,k)=>o[k]||(()=>{})});return{width:300,height:300,getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,YQ==',getBoundingClientRect:()=>({left:0,top:0,width:240,height:320}),setPointerCapture(){}};}
function element(){return Object.assign(canvas(),{value:'',checked:true,files:[],hidden:false,children:[],listeners:{},classList:{add(){},remove(){}},append(...c){this.children.push(...c);},replaceChildren(...c){this.children=c;},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},addEventListener(k,v){(this.listeners[k]||=[]).push(v);},showModal(){this.open=true;},close(){this.open=false;for(const f of this.listeners.close||[])f();},focus(){},blur(){},click(){if(this.download)downloads.push({name:this.download,href:this.href});},remove(){}});}
const document={title:'图文集赞',activeElement:null,body:element(),getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:t=>t==='canvas'?canvas():element()};
const location={href:'http://localhost:5173/',hash:'',pathname:'/',search:'',assign(url){navigations.push(url);}};
function applyHistoryUrl(value){const url=new URL(value,location.href);location.href=url.href;location.hash=url.hash;location.pathname=url.pathname;location.search=url.search;}
const window={innerWidth:402,innerHeight:812,location,scrollTo(){},addEventListener(k,v){events[k]=v;},history:{state:null,pushState(state,_,value){this.state=state;applyHistoryUrl(value);},replaceState(state,_,value){this.state=state;replaced.push(value);if(value)applyHistoryUrl(value);},back(){this.state=null;location.hash='';events.popstate?.();},forward(){this.state={momentsDetail:true};location.hash='#detail';events.popstate?.();}}};
const sandbox={document,window,console,Math,Map,Set,Number,String,Array,Promise,URLSearchParams,setTimeout,clearTimeout,AbortController,navigator:{userAgent:''},URL:{createObjectURL:()=> 'blob:detail',revokeObjectURL(){}},ProfileCache:{create:()=>({restore:async()=>({hasNickname:false,nickname:'',avatarDataUrl:''}),saveNickname:async name=>{cacheWrites.push(name);return true;},saveAvatar:async()=>true})},DetailStore:{create:()=>({save(payload){savedPages.push(payload);return saveAction(payload);},load(id){loads.push(id);return loadAction(id);}})},MomentsView:{mount:(container,snapshot,callbacks)=>{mounts.push({container,snapshot,callbacks});return{destroy(){destroyed++;}};},renderPNG:async()=>{exportCalls++;throw new Error('PNG rendering must not run');}},fetch:async()=>({ok:true,json:async()=>Array.from({length:100},(_,i)=>({id:'photo-'+i,path:'photo-'+i+'.jpg',category:i<10?'male':i<60?'female':i<80?'landscape':'cartoon'}))}),Image:class{constructor(){this.width=this.naturalWidth=1206;this.height=this.naturalHeight=2622;}async decode(){}}};
document.getElementById('likeCount').value='5';
document.getElementById('content').value='浏览器保留的旧正文';
location.search='?draft='+SAFE_ID+'&campaign=keep';
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),sandbox);const run=code=>vm.runInContext(code,sandbox);
async function main(){
 assert.equal(run('state.ready'),true);assert.equal(elements.get('generate').disabled,false,'publication is available immediately on startup');
 assert.equal(run("$('content').value"),'');assert.equal(run('state.photos.length'),0,'fresh entry has no default or restored photo');
 assert.equal(location.search,'?campaign=keep','an old draft bookmark is consumed without restoring the old post');
 await run('editorReady');await run('localProfileReady');
 assert.equal(document.title,'图文集赞');assert.equal(loads.length,0,'fresh entry never reads a saved draft');
 assert.equal(run("$('sourceName').value"),'51Talk无忧英语');
 run("openCrop({width:1600,height:1200},null);state.zoom=2;cropAvatar();");
 run("$('cropCanvas').onpointerdown({pointerId:1,clientX:120,clientY:160});$('cropCanvas').onpointermove({pointerId:1,clientX:160,clientY:170});");
 assert.ok(Math.abs(run('state.x')+100/.86)<.001);assert.ok(Math.abs(run('state.y')+25/.86)<.001);
 run("$('cropCanvas').onpointerdown({pointerId:2,clientX:200,clientY:170});$('cropCanvas').onpointermove({pointerId:2,clientX:240,clientY:170});");assert.equal(run('state.zoom'),4);
 run("$('cropCanvas').onpointercancel({pointerId:2});$('cropCanvas').onpointerup({pointerId:1});zoomAt(100);cropAvatar();");assert.equal(run('state.zoom'),6);assert.equal(run('pointers.size'),0);
 run("$('resetCrop').onclick();");assert.equal(run('state.zoom'),1);assert.equal(run('state.x'),0);assert.equal(run('state.y'),0);
 run("$('cancelCrop').onclick();");assert.equal(run('avatar.width'),1024);
 run("openCrop({width:1600,height:1200},null);$('applyCrop').onclick();");assert.equal(run('avatar.width'),2048);

 // Save the immutable result and editable draft before navigating. While this
 // save is outstanding, duplicate clicks must not create additional pages.
 const pending=deferred();saveAction=()=>pending.promise;
 const publishing=run("$('content').value='原生正文';state.photos=[Object.assign(document.createElement('canvas'),{width:320,height:240})];$('sourceName').value='  自定义来源  ';$('nickname').value='Moonlight';$('publishAt').value='2026-10-21T09:20';$('likeCount').value='7';$('generate').onclick();");
 await new Promise(setImmediate);
 assert.equal(savedPages.length,1);assert.equal(navigations.length,0,'the HTML result must not open before persistence completes');
 assert.equal(mounts.length,0,'there is no intermediate editor-page preview');assert.equal(exportCalls,0);assert.equal(downloads.length,0);
 assert.equal(elements.get('generate').disabled,true,'the save locks publication against duplicate clicks');
 await run("$('generate').onclick();");assert.equal(savedPages.length,1,'duplicate publication while saving is ignored');
 const payload=savedPages[0];assert.equal(payload.snapshot.likers.length,8);assert.equal(payload.snapshot.nickname,'Moonlight');assert.equal(payload.snapshot.content,'原生正文');assert.ok(cacheWrites.includes('Moonlight'));
 assert.equal(payload.snapshot.photos.length,1);assert.equal(payload.snapshot.photos[0].width,320);assert.equal(payload.snapshot.photos[0].height,240);
 assert.equal(payload.snapshot.sourceName,'自定义来源','the configured source travels with the saved detail');
 assert.equal(payload.draft.version,1);assert.equal(payload.draft.users.length,7);assert.equal(payload.draft.selfLike,true);assert.equal(payload.draft.publishAt,'2026-10-21T09:20');
 run("$('content').value='保存期间编辑的草稿';state.users[0].name='保存期间修改';");
 assert.equal(payload.snapshot.content,'原生正文');assert.notEqual(payload.draft.users[0].name,'保存期间修改','the persisted draft is independent of live user objects');
 pending.resolve(SAFE_ID);await publishing;
 assert.deepEqual(navigations,['detail.html?id='+SAFE_ID]);assert.equal(mounts.length,0);assert.equal(exportCalls,0);assert.deepEqual(downloads,[]);
 assert.equal(run("$('content').value"),'','the outgoing editor is cleared before browsers can preserve its form values');
 assert.equal(run('state.photos.length'),0,'the outgoing editor releases previous attachments before entering history');
 assert.equal(new URLSearchParams(location.search).has('draft'),false,'publishing does not make future refreshes restore the old post');
 assert.equal(elements.get('generate').disabled,true,'the outgoing page stays locked until navigation actually leaves');
 await run("$('generate').onclick();");assert.equal(savedPages.length,1,'a second click after save completion cannot navigate twice');
 events.pageshow({persisted:true});
 assert.equal(elements.get('generate').disabled,false,'returning through the back/forward cache releases publication');
 assert.equal(run("$('content').value"),'','returning to the editor clears the previous post text');
 assert.equal(run('state.photos.length'),0,'returning to the editor clears previous attachments');
 assert.equal(run("$('nickname').value"),'Moonlight');assert.equal(run('avatar.width'),2048,'clearing the post preserves the chosen identity');
 assert.equal(run('state.users.length'),7);assert.equal(loads.length,0);
 run("$('content').value='第二次正文';");events.pageshow({persisted:false});
 assert.equal(run("$('content').value"),'第二次正文','the ordinary pageshow event does not discard edits made after initialization');

 // A broken store or invalid id keeps the final HTML view usable and never
 // exposes a malformed URL or falls back to a downloaded image.
 saveAction=async()=>{throw new Error('storage denied');};
 const beforeFallback=navigations.length;await run("$('generate').onclick();");
 assert.equal(navigations.length,beforeFallback);assert.equal(mounts.length,1);assert.equal(elements.get('resultPage').hidden,false);assert.equal(elements.get('editorPage').hidden,true);assert.equal(document.title,'详情');
 assert.equal(mounts[0].snapshot.content,'第二次正文');assert.equal(exportCalls,0);assert.equal(downloads.length,0);
 mounts[0].callbacks.onMenu();assert.equal(elements.get('resultMenu').open,true);run("$('menuCancel').onclick();");assert.equal(elements.get('resultMenu').open,false);
 mounts[0].callbacks.onBack();assert.equal(document.title,'图文集赞');assert.equal(elements.get('resultPage').hidden,true);assert.equal(run('state.users.length'),7);assert.equal(destroyed,1);
 window.history.forward();assert.equal(document.title,'详情');assert.equal(elements.get('resultPage').hidden,false);assert.equal(mounts.length,2);assert.equal(exportCalls,0);assert.equal(downloads.length,0);
 window.history.back();
 saveAction=async()=> '../../outside?secret=1';
 await run("$('generate').onclick();");
 assert.equal(navigations.length,beforeFallback,'a storage id cannot inject path traversal or query parameters into navigation');assert.equal(mounts.length,3,'an invalid id uses the same native HTML fallback');
 assert.equal(exportCalls,0);assert.equal(downloads.length,0);

 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),detail=fs.readFileSync(path.join(root,'detail.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 assert.match(html,/profile-cache\.js/);assert.match(html,/moments-view\.js/);assert.match(html,/detail-store\.js/);
 assert.match(detail,/<title>详情<\/title>/);
 assert.equal((html.match(/id="generate"/g)||[]).length,1,'there is exactly one publication button');
 const profileRow=html.match(/<div class="profile-row">([\s\S]*?)<\/div>/)[1];
 assert.match(profileRow,/<input id="nickname"[^>]*><button id="generate"[^>]*>发表<\/button>/,'publication follows the nickname in the profile row');
 assert.doesNotMatch(html,/id="randomName"|id="backTop"/,'the old random-name and top-back controls are removed');
 assert.doesNotMatch(html,/download=|id="download"|朋友圈分享\.png|resultDialog|resultImage|statusNote|device-status\.js/);
 assert.doesNotMatch(app,/assets\/template\.png|originalText|restoreEditorDraft|restoreDraftFromURL/,'startup never depends on the old screenshot or restores a prior post');
 assert.doesNotMatch(app,/PhoneStatusBar|getBattery|status-reference|phoneStatus\.draw|renderPNG/);
 assert.doesNotMatch(app,/requestFullscreen|webkitRequestFullscreen/);
 for(const match of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes('id="'+match[1]+'"'),'Missing page element '+match[1]);
 console.log('PASS: immediate blank editor, profile-row publication, crop gestures, save-before-navigation and duplicate-click guard, fresh text/photos after return with identity preserved, native HTML fallback/back/forward');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
