'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const appSource=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const ID='0123456789abcdef0123456789abcdef';
const materials=Array.from({length:100},(_,index)=>({id:'avatar-'+index,path:'assets/avatars/avatar-'+index+'.jpg',category:index<10?'male':index<60?'female':index<80?'landscape':'cartoon'}));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function harness(options={}){
  const elements=new Map(),downloads=[],decodes=[],saved=[],navigations=[],requests=[],timers=new Set();
  function canvas(){return{width:1024,height:1024,getContext:()=>new Proxy({},{get:()=>()=>{}}),toDataURL:()=> 'data:image/png;base64,YQ==',getBoundingClientRect:()=>({left:0,top:0,width:240,height:320}),setPointerCapture(){}};}
  function element(){return Object.assign(canvas(),{value:'',checked:true,files:[],children:[],listeners:{},classList:{add(){},remove(){}},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(){},addEventListener(name,handler){(this.listeners[name]||=[]).push(handler);},showModal(){this.open=true;},close(){this.open=false;},focus(){},blur(){},click(){}});}
  const document={activeElement:null,title:'图文集赞',body:element(),getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:tag=>tag==='canvas'?canvas():element()};
  document.getElementById('likeCount').value=String(options.count===undefined?5:options.count);
  const browser={location:{pathname:'/',search:'',hash:'',assign(url){navigations.push(url);},replace(url){navigations.push(url);}},history:{state:null,pushState(){},replaceState(){},back(){}},addEventListener(){},scrollTo(){}};
  const context={document,window:browser,console,Math,Map,Set,Number,String,Array,Promise,URLSearchParams,AbortController,navigator:{userAgent:options.wechat?'MicroMessenger/8.0':'Browser'},URL:{createObjectURL:()=> 'blob:avatar',revokeObjectURL(){}},
    setTimeout(callback,delay){const timer=setTimeout(()=>{timers.delete(timer);callback();},delay);timer.unref?.();timers.add(timer);return timer;},clearTimeout(timer){timers.delete(timer);clearTimeout(timer);},
    ProfileCache:{create:()=>({restore:async()=>options.restore?options.restore():options.cached||{hasNickname:false,nickname:'',avatarDataUrl:''},saveNickname:async()=>true,saveAvatar:async()=>true})},
    DetailStore:{create:()=>({async save(payload){saved.push(payload);return ID;},async load(){throw new Error('Fresh startup must never restore an old post');}})},
    MomentsView:{mount(){throw new Error('Successful publication must navigate to its own HTML document');}},
    Image:class{
      constructor(){this.width=this.naturalWidth=250;this.height=this.naturalHeight=250;this._src='';}
      set src(value){this._src=value;if(value.startsWith('assets/avatars/'))downloads.push(value);}
      get src(){return this._src;}
      async decode(){decodes.push(this.src);return options.decode?options.decode(this.src):undefined;}
    },
    async fetch(url){requests.push(url);if(url==='/api/wechat/profile')return options.profile?options.profile():{ok:true,json:async()=>({available:false,configured:false})};return{ok:true,json:async()=>options.manifest?options.manifest():materials};}
  };
  vm.createContext(context);vm.runInContext(appSource,context,{filename:'app.js'});
  return{elements,downloads,decodes,saved,navigations,requests,run:code=>vm.runInContext(code,context),settle:()=>new Promise(setImmediate),dispose(){for(const timer of timers)clearTimeout(timer);timers.clear();}};
}

test('a slow manifest keeps the blank editor usable and only selected avatars download before publication',async t=>{
  const manifest=deferred(),images=deferred();
  const h=harness({manifest:()=>manifest.promise,decode:src=>src.startsWith('assets/avatars/')?images.promise:undefined});t.after(()=>h.dispose());
  assert.equal(h.run('state.ready'),true);assert.equal(h.elements.get('generate').disabled,false);
  assert.equal(h.elements.get('content').value,'');assert.equal(h.run('state.photos.length'),0);
  assert.equal(h.downloads.length,0,'registering a pending library does not download its files');
  h.run("$('content').value='等待加载期间输入的正文';$('nickname').value='小满';");
  const publication=h.run("$('generate').onclick()");await h.settle();
  assert.equal(h.saved.length,0);assert.equal(h.navigations.length,0);assert.equal(h.elements.get('generate').disabled,true);
  manifest.resolve(materials);await h.run('editorReady');await h.settle();
  assert.equal(h.run('state.library.length'),100,'all candidates remain available for category ratios and uniqueness');
  assert.equal(new Set(h.downloads).size,5);assert.equal(h.downloads.length,5,'the other 95 images are not eagerly requested');
  assert.equal(h.decodes.filter(src=>src.startsWith('assets/avatars/')).length,5);
  assert.equal(h.saved.length,0,'saving waits until every selected avatar has decoded');
  assert.equal(h.navigations.length,0);assert.equal(h.elements.get('content').value,'等待加载期间输入的正文','late material loading preserves text entered during startup');
  h.run("$('content').value='解码期间修改的正文';state.users[0].name='解码期间修改的昵称';");
  images.resolve();await publication;
  assert.equal(h.saved.length,1);assert.equal(h.saved[0].snapshot.content,'等待加载期间输入的正文');
  assert.notEqual(h.saved[0].draft.users[0].name,'解码期间修改的昵称','the clicked post is independent of later edits');
  assert.equal(h.saved[0].snapshot.likers.length,6);assert.equal(h.saved[0].snapshot.photos.length,0);
  assert.equal(new Set(h.saved[0].snapshot.likers.slice(1).map(user=>user.src)).size,5);
  assert.deepEqual(h.navigations,['detail.html?id='+ID]);
});

test('a broken selected avatar keeps the editor available and never stores or navigates a partial post',async t=>{
  let broken=true;
  const h=harness({count:3,decode:src=>{if(broken&&src.startsWith('assets/avatars/'))throw new Error('corrupt image');}});t.after(()=>h.dispose());
  await h.run('editorReady');await h.run("$('generate').onclick()");
  assert.equal(h.saved.length,0);assert.equal(h.navigations.length,0);assert.equal(h.elements.get('generate').disabled,false);
  assert.match(h.elements.get('toast').textContent,/头像.*加载/);
  assert.equal(h.run('state.users.length'),3);assert.equal(h.elements.get('likeCount').value,'3','a failed publication leaves the requested count intact');
  broken=false;await h.run("$('generate').onclick()");
  assert.equal(h.saved.length,1);assert.equal(h.saved[0].snapshot.likers.length,4);
  assert.ok(h.saved[0].snapshot.likers.slice(1).every(user=>user.src.endsWith('?retry=1')),'a retry refreshes failed requests without replacing or duplicating users');
});

test('a post with no automatic likers waits for its local identity but not the manifest or optional network profile',async t=>{
  const local=deferred(),manifest=deferred(),profile=deferred();
  const h=harness({count:0,wechat:true,restore:()=>local.promise,manifest:()=>manifest.promise,profile:()=>profile.promise});t.after(()=>h.dispose());
  const publication=h.run("$('generate').onclick()");await h.settle();
  assert.equal(h.saved.length,0,'an immediate click cannot publish before the local identity has been restored');
  local.resolve({hasNickname:true,nickname:'缓存昵称',avatarDataUrl:''});await publication;
  assert.ok(h.requests.includes('/api/wechat/profile'));
  assert.equal(h.saved.length,1);assert.equal(h.saved[0].snapshot.nickname,'缓存昵称');assert.equal(h.saved[0].snapshot.likers.length,1);
  assert.equal(h.downloads.length,0);assert.deepEqual(h.navigations,['detail.html?id='+ID]);
  manifest.resolve(materials);profile.resolve({ok:true,json:async()=>({available:false,configured:false})});
  await h.run('editorReady');await h.run('avatarReady');
});
