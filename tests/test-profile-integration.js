'use strict';
// Exercise the actual app and cache module across fresh page instances.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ProfileCache=require('../profile-cache');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const cacheSource=fs.readFileSync(path.join(root,'profile-cache.js'),'utf8');
const key=ProfileCache.DEFAULT_KEY;
const imageData=stamp=>'data:image/jpeg;base64,'+Buffer.from(stamp).toString('base64');
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function storage(profile){
  const entries=new Map(profile?[[key,JSON.stringify(Object.assign({version:1},profile))]]:[]);
  return{entries,getItem:name=>entries.has(name)?entries.get(name):null,setItem:(name,value)=>entries.set(name,value)};
}
function makeApp(options={}){
  const elements=new Map(),requests=[],operations=[],mounts=[],exports=[],listeners={},savedPages=[],navigations=[],draftLoads=[];
  const backing=options.storage||storage();
  let number=0;
  function canvas(){
    const result={width:300,height:300,stamp:'default',
      toDataURL(type='image/png'){return'data:'+type+';base64,'+Buffer.from(this.stamp).toString('base64');},
      toBlob(done){done({});},getBoundingClientRect:()=>({left:0,top:0,width:240,height:320}),setPointerCapture(){}};
    const context=new Proxy({
      drawImage(image,...args){result.stamp=image.stamp||image.src||'image';operations.push({kind:'drawImage',canvas:result,image,args});},
      measureText:value=>({width:value.length*38})
    },{get:(object,name)=>object[name]||(()=>{})});
    result.getContext=()=>context;
    return result;
  }
  function element(){return Object.assign(canvas(),{value:'',checked:true,files:[],children:[],listeners:{},classList:{add(){},remove(){},toggle(){}},
    addEventListener(type,handler){(this.listeners[type]||=[]).push(handler);},
    dispatchEvent(event){event.target||=this;this['on'+event.type]?.(event);for(const handler of this.listeners[event.type]||[])handler(event);},
    append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(){},removeAttribute(){},focus(){},click(){},remove(){},
    showModal(){this.open=true;},close(){this.open=false;this.dispatchEvent({type:'close'});}});}
  const history={state:null,pushState(state,unused,url){this.state=state;browser.location.hash=url;},replaceState(state,unused,url){this.state=state;},back(){this.state=null;for(const callback of listeners.popstate||[])callback();}};
  const browser={location:{href:'http://localhost:5173/',hash:'',pathname:'/',search:options.search||'',assign(url){navigations.push(url);},replace(url){requests.push({redirect:url});}},history,scrollTo(){},addEventListener(type,handler){(listeners[type]||=[]).push(handler);}};
  const sandbox={console,Math,Map,Set,Number,String,Array,Promise,setTimeout,clearTimeout,AbortController,localStorage:backing,
    navigator:{userAgent:options.wechat?'MicroMessenger/8.0':'Browser'},window:browser,URLSearchParams,
    URL:{createObjectURL:()=>`blob:wechat-${++number}`,revokeObjectURL(){}},
    Image:class{
      constructor(){this.width=this.naturalWidth=1024;this.height=this.naturalHeight=1024;}
      set src(value){this._src=value;this.stamp=value.startsWith('data:')?Buffer.from(value.split(',')[1],'base64').toString():value.startsWith('blob:')?'wechat-avatar':value;}
      get src(){return this._src;}
      async decode(){if(this.src.startsWith('data:')&&options.cacheDecode)return options.cacheDecode(this);if(this.src.startsWith('blob:')&&options.oauthDecode)return options.oauthDecode(this);}
    },
    document:{body:{classList:{add(){},remove(){}},append(){}},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:tag=>tag==='canvas'?canvas():element()},
    fetch:async(url,args)=>{
      requests.push({url,args});
      if(url==='/api/wechat/profile')return options.profileRequest?options.profileRequest():{ok:true,json:async()=>options.profile||{available:false,configured:false}};
      if(url==='/api/wechat/avatar')return{ok:true,blob:async()=>({type:'image/png',size:200})};
      return{ok:true,json:async()=>[{id:'fixture',path:'assets/avatars/fixture.jpg',category:'female'}]};
    },
    DetailStore:{create:()=>({
      async save(payload){savedPages.push(payload);return'0123456789abcdef0123456789abcdef';},
      async load(id){draftLoads.push(id);return options.loadDraft?options.loadDraft():options.draftRecord||null;}
    })},
    MomentsView:{
      mount(target,snapshot){mounts.push(snapshot);return{destroy(){}};},
      async renderPNG(snapshot,settings){exports.push({snapshot,settings});return{blob:{type:'image/png',size:128},width:5425,height:11795,filename:'详情.png'};}
    }
  };
  sandbox.document.getElementById('nickname').value='';
  sandbox.document.getElementById('likeCount').value='0';
  sandbox.document.getElementById('content').value=options.initialContent||'';
  vm.createContext(sandbox);
  vm.runInContext(cacheSource,sandbox,{filename:'profile-cache.js'});
  vm.runInContext(source,sandbox,{filename:'app.js'});
  const run=code=>vm.runInContext(code,sandbox);
  function nickname(value){elements.get('nickname').value=value;elements.get('nickname').dispatchEvent({type:'input'});}
  function crop(stamp){sandbox.cropFixture={width:1200,height:1600,stamp};run("openCrop(cropFixture,null); $('applyCrop').onclick();");}
  return{run,sandbox,elements,requests,operations,mounts,exports,savedPages,navigations,draftLoads,storage:backing,nickname,crop,
    pageShow:event=>{for(const handler of listeners.pageshow||[])handler(event);},
    profileRequests:()=>requests.filter(request=>request.url?.startsWith('/api/wechat/')),
    flush:()=>run('profileCache.restore()')};
}
async function main(){
  const backing=storage();
  let app=makeApp({storage:backing});
  await app.run('avatarReady');
  app.nickname('橘子海🌙');app.crop('portrait-first');
  assert.equal(app.run('avatar.stamp'),'portrait-first');
  assert.equal(app.run('avatar.width'),2048,'the committed export avatar stays high resolution');
  let cached=await app.flush();
  assert.equal(cached.nickname,'橘子海🌙');assert.equal(cached.avatarDataUrl,imageData('portrait-first'));
  assert.ok(app.operations.some(operation=>operation.kind==='drawImage'&&operation.canvas.width===1024&&operation.image===app.run('avatar')),'persistence uses the reduced avatar canvas without changing export quality');
  app=makeApp({storage:backing});
  await app.run('avatarReady');
  assert.equal(app.run('state.avatarOrigin'),'cache');
  assert.equal(app.run('avatar.stamp'),'portrait-first');assert.equal(app.run("$('nickname').value"),'橘子海🌙');
  assert.equal(app.profileRequests().length,0,'ordinary reentry restores locally without authorizing or uploading');
  app.crop('portrait-second');app.nickname('改成这次');app.crop('portrait-latest');app.nickname('');
  cached=await app.flush();
  assert.equal(cached.avatarDataUrl,imageData('portrait-latest'));assert.equal(cached.hasNickname,true);assert.equal(cached.nickname,'');
  app=makeApp({storage:backing,wechat:true,profile:{available:true,nickname:'微信旧昵称',avatarUrl:'/api/wechat/avatar'}});
  await app.run('avatarReady');
  assert.equal(app.run('avatar.stamp'),'portrait-latest');assert.equal(app.run("$('nickname').value"),'');
  assert.equal(app.profileRequests().length,0,'a valid cached avatar and deliberately empty nickname win over OAuth on reentry');
  const nicknameOnly=storage({nickname:''});
  app=makeApp({storage:nicknameOnly,wechat:true,profile:{available:true,nickname:'不覆盖空昵称',avatarUrl:'/api/wechat/avatar'}});
  await app.run('avatarReady');cached=await app.flush();
  assert.equal(app.run("$('nickname').value"),'');assert.equal(app.run('state.avatarOrigin'),'wechat');
  assert.equal(cached.nickname,'');assert.equal(cached.avatarDataUrl,imageData('wechat-avatar'),'an independently missing avatar can still be obtained and cached');
  const avatarOnly=storage({avatarDataUrl:imageData('cached-portrait')});
  app=makeApp({storage:avatarOnly,wechat:true,profile:{available:true,nickname:'只补充微信昵称',avatarUrl:'/api/wechat/avatar'}});
  await app.run('avatarReady');cached=await app.flush();
  assert.equal(app.run('avatar.stamp'),'cached-portrait');assert.equal(app.run("$('nickname').value"),'只补充微信昵称');
  assert.equal(app.requests.filter(request=>request.url==='/api/wechat/avatar').length,0,'cached avatar is independent of a previously unset nickname');
  const decode=deferred(),started=deferred(),raceStorage=storage({nickname:'旧缓存昵称',avatarDataUrl:imageData('old-portrait')});
  app=makeApp({storage:raceStorage,cacheDecode(){started.resolve();return decode.promise;}});
  await started.promise;
  app.nickname('当前手动选择');app.crop('current-upload');
  decode.resolve();await app.run('avatarReady');cached=await app.flush();
  assert.equal(app.run('state.avatarOrigin'),'upload');assert.equal(app.run('avatar.stamp'),'current-upload');
  assert.equal(app.run("$('nickname').value"),'当前手动选择');assert.equal(cached.nickname,'当前手动选择');assert.equal(cached.avatarDataUrl,imageData('current-upload'));
  const immediateStorage=storage({nickname:'之前保存',avatarDataUrl:imageData('existing-avatar')});
  app=makeApp({storage:immediateStorage});app.nickname('载入时就编辑');await app.run('avatarReady');cached=await app.flush();
  assert.equal(app.run("$('nickname').value"),'载入时就编辑');assert.equal(cached.nickname,'载入时就编辑','a pending cache read cannot overwrite newer input');
  const corruptAvatarStorage=storage({nickname:'保留本地昵称',avatarDataUrl:imageData('bad-image')});
  app=makeApp({storage:corruptAvatarStorage,wechat:true,cacheDecode(){return Promise.reject(new Error('unreadable cache'));},profile:{available:true,nickname:'晚到微信昵称',avatarUrl:'/api/wechat/avatar'}});
  await app.run('avatarReady');
  assert.equal(app.run('state.avatarOrigin'),'wechat');assert.equal(app.run("$('nickname').value"),'保留本地昵称','failed cached image decode does not erase an independently valid cached name');
  app=makeApp();await app.run('avatarReady');
  app.nickname('手动选择的新昵称');cached=await app.flush();
  assert.equal(cached.nickname,'手动选择的新昵称','manual nickname choices persist as the current profile');
  await app.run("$('nickname').value='发表时的最近昵称'; $('generate').onclick();");cached=await app.flush();
  assert.equal(cached.nickname,'发表时的最近昵称');assert.equal(app.savedPages.length,1,'publishing also commits the most recent nickname without requiring another input event');
  assert.equal(app.savedPages[0].snapshot.nickname,'发表时的最近昵称','the persisted profile and saved detail snapshot use the same latest nickname');
  assert.ok(app.savedPages[0].draft,'publication retains the compatible detail record metadata');
  assert.equal(app.navigations.length,1);assert.match(app.navigations[0],/^detail\.html\?id=[A-Za-z0-9_-]+$/);
  assert.equal(app.mounts.length,0,'successful publication navigates to the dedicated HTML result without an intermediate preview');
  assert.equal(app.exports.length,0,'publishing never exports an image or starts a download');
  const oldDraft={
    snapshot:{avatar:imageData('older-draft-avatar'),nickname:'旧详情昵称',content:'旧详情正文',photos:[{src:imageData('old-photo'),width:1200,height:1800}],likers:[]},
    draft:{version:1,selfLike:false,publishAt:'2026-10-21T10:20',users:[]}
  };
  const draftURL='?draft=0123456789abcdef0123456789abcdef';
  const latestIdentity=storage({nickname:'最近设置',avatarDataUrl:imageData('latest-cache-avatar')});
  app=makeApp({storage:latestIdentity,search:draftURL,draftRecord:oldDraft,initialContent:'浏览器恢复的旧正文'});
  await app.run('editorReady');await app.run('localProfileReady');cached=await app.flush();
  assert.equal(app.run("$('nickname').value"),'最近设置','reopening a saved editor URL must prefer the latest persistent name over its older draft');
  assert.equal(app.run('avatar.stamp'),'latest-cache-avatar','the latest persistent avatar must also win over a saved detail identity');
  assert.equal(app.run("$('content').value"),'','a fresh entry clears both saved draft content and browser-restored text');
  assert.equal(app.run('state.photos.length'),0,'a fresh entry never restores saved draft photos');
  assert.equal(app.draftLoads.length,0,'old editor draft URLs no longer load a saved post');
  assert.equal(cached.nickname,'最近设置');assert.equal(cached.avatarDataUrl,imageData('latest-cache-avatar'));
  app.run("$('content').value='返回前编辑的正文';state.photos.push(document.createElement('canvas'));");
  app.pageShow({persisted:true});
  assert.equal(app.run("$('content').value"),'','returning through BFCache also starts with empty post content');
  assert.equal(app.run('state.photos.length'),0,'returning through BFCache also clears the photo album');
  assert.equal(app.run("$('nickname').value"),'最近设置');assert.equal(app.run('avatar.stamp'),'latest-cache-avatar','post resets preserve the most recently cached identity');
  app=makeApp({storage:storage({nickname:''}),search:draftURL,draftRecord:oldDraft});
  await app.run('editorReady');await app.run('localProfileReady');cached=await app.flush();
  assert.equal(app.run("$('nickname').value"),'','an intentionally cleared cached name is newer than a nonempty saved draft');
  assert.equal(app.run('state.avatarOrigin'),'default');
  assert.equal(cached.avatarDataUrl,'','an independently missing cached avatar is not imported from an obsolete draft');
  assert.equal(app.draftLoads.length,0);
  const blankProfile=storage();
  app=makeApp({storage:blankProfile,search:draftURL,draftRecord:oldDraft});
  await app.run('editorReady');await app.run('localProfileReady');cached=await app.flush();
  assert.equal(cached.hasNickname,false);assert.equal(cached.avatarDataUrl,'','old detail links never seed a fresh profile');
  assert.equal(app.run("$('nickname').value"),'');assert.equal(app.run('state.avatarOrigin'),'default');
  assert.equal(app.run("$('content').value"),'');assert.equal(app.run('state.photos.length'),0);assert.equal(app.draftLoads.length,0);
  app=makeApp({storage:blankProfile});await app.run('avatarReady');
  assert.equal(app.run("$('nickname').value"),'');assert.equal(app.run('state.avatarOrigin'),'default','another fresh entry retains the default plus avatar and empty nickname');

  const slowProfile=deferred();
  app=makeApp({wechat:true,profileRequest:()=>slowProfile.promise});
  assert.equal(app.run('state.ready'),true,'the editor is ready synchronously before optional profile authorization completes');
  assert.equal(app.elements.get('generate').disabled,false,'the publish button is enabled without waiting for remote profile data');
  await app.run('localProfileReady');
  let publicationDeadline;
  try{
    await Promise.race([
      app.run("$('content').value='不等远端微信资料';$('generate').onclick();"),
      new Promise((_,reject)=>{publicationDeadline=setTimeout(()=>reject(new Error('Publication waited for optional OAuth')),1000);})
    ]);
    assert.equal(app.savedPages.length,1,'publication uses the local fallback identity while remote authorization is still pending');
    assert.equal(app.navigations.length,1);
    assert.equal(app.savedPages[0].snapshot.content,'不等远端微信资料');
    assert.equal(app.savedPages[0].snapshot.nickname,'');assert.equal(app.run('state.avatarOrigin'),'default');
  }finally{
    clearTimeout(publicationDeadline);
    slowProfile.resolve({ok:true,json:async()=>({available:true,nickname:'迟到的微信资料',avatarUrl:'/api/wechat/avatar'})});
    await app.run('avatarReady');
  }
  assert.equal(app.run("$('nickname').value"),'','a late OAuth response cannot change a profile that has already been published');
  assert.equal(app.run('state.avatarOrigin'),'default');
  const deniedStorage={getItem(){throw new Error('SecurityError');},setItem(){throw new Error('SecurityError');}};
  app=makeApp({storage:deniedStorage});await app.run('avatarReady');app.nickname('仍然可用');app.crop('temporary-portrait');await app.flush();
  assert.equal(app.run("$('nickname').value"),'仍然可用');assert.equal(app.run('avatar.stamp'),'temporary-portrait','disabled persistent storage must not break current-session editing');
  console.log('PASS: actual H5 profile persistence across reentry, latest cropped avatar/name and intentional blank, OAuth priorities and races, empty posts on fresh/BFCache entries and old draft URLs, immediate publication without optional OAuth, and blocked-storage editing');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
