'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const pageSource=fs.readFileSync(path.resolve(__dirname,'../detail-page.js'),'utf8');
const template=fs.readFileSync(path.resolve(__dirname,'../detail.html'),'utf8');
const MomentsView=require('../moments-view');
const ID='detail_safe_token_12345678';
const WECHAT_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.64';
const snapshot={avatar:'data:image/png;base64,cached',nickname:'上次昵称',content:'这是一条详情',photos:[{src:'data:image/png;base64,photo',width:200,height:1000}],likers:[],timeLabel:'刚刚'};
function harness(options={}){
  class Element{
    constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.listeners={};this.open=false;this.textContent='';this.className='';}
    appendChild(child){this.children.push(child);return child;}
    replaceChildren(...children){this.children=[...children];}
    setAttribute(name,value){this.attributes[name]=String(value);if(name==='open')this.open=true;}
    removeAttribute(name){delete this.attributes[name];if(name==='open')this.open=false;}
    addEventListener(name,callback){(this.listeners[name]||=[]).push(callback);}
    click(){for(const callback of this.listeners.click||[])callback({preventDefault(){}});}
    showModal(){this.open=true;}
    close(){this.open=false;}
  }
  const elements=new Map(['momentsRoot','resultMenu','menuBack','menuCancel'].map(id=>[id,new Element()]));
  elements.get('momentsRoot').textContent='正在载入详情…';
  const loads=[],mounts=[],replacements=[];let backCalls=0,storeCreates=0;
  const document={title:'错误标题',referrer:options.referrer===undefined?'https://example.test/h5/index.html':options.referrer,getElementById(id){assert.ok(elements.has(id),'unknown template element '+id);return elements.get(id);},createElement(tag){return new Element(tag);}};
  const location={search:options.search===undefined?'?id='+ID:options.search,origin:'https://example.test',replace(url){replacements.push(url);}};
  const navigator={userAgent:options.userAgent===undefined?'Mozilla/5.0 Safari/604.1':options.userAgent,standalone:!!options.standalone};
  const window={location,navigator,history:{length:options.historyLength===undefined?2:options.historyLength,back(){backCalls++;}}};
  if(!options.noMatchMedia)window.matchMedia=query=>{assert.equal(query,'(display-mode: standalone)');return{matches:!!options.displayModeStandalone};};
  const context={URL,URLSearchParams,encodeURIComponent,document,navigator,window,DetailStore:{create(){storeCreates++;return{async load(id){loads.push(id);if(options.load) return options.load(id);if(options.error)throw new Error('storage blocked');return options.entry===undefined?{snapshot,draft:{nickname:'上次昵称'}}:options.entry;}};}},MomentsView:{usesNativeHeader:MomentsView.usesNativeHeader,mount(root,data,callbacks){mounts.push({root,data,callbacks});if(options.mountError)throw new Error('render failed');root.replaceChildren(new Element('article'));return{destroy(){}};}}};
  vm.runInNewContext(pageSource,context,{filename:'detail-page.js'});
  return{elements,document,loads,mounts,replacements,get backCalls(){return backCalls;},get storeCreates(){return storeCreates;},async settle(){await new Promise(setImmediate);}};
}
function allText(element){return[element.textContent,...element.children.map(allText)].flat(Infinity).join(' ');}

test('the independent document is titled detail and contains no image viewer, export or automatic fullscreen flow',()=>{
  assert.match(template,/<title>详情<\/title>/);assert.match(template,/body class="viewing-detail"/);
  assert.match(template,/id="resultPage"[^>]*><div id="momentsRoot"/);
  const version=template.match(/styles\.css\?v=([\d-]+)/)[1];
  for(const file of['detail-store.js','moments-view.js','detail-page.js','styles.css'])assert.ok(template.includes(file+'?v='+version),'All entry resources share the current cache version');
  for(const id of['menuBack','menuCancel'])assert.ok(template.includes('id="'+id+'"'));
  assert.doesNotMatch(template+pageSource,/renderPNG|toBlob|download\s*=|window\.open|previewImage|requestFullscreen|image\/png|\.png["']/);
  assert.match(template,/viewport-fit=cover/);assert.match(template,/format-detection" content="telephone=no"/);
});

test('a valid stored entry mounts native DOM and menu remains closed until requested',async()=>{
  const h=harness();await h.settle();
  assert.equal(h.document.title,'详情');assert.deepEqual(h.loads,[ID]);assert.equal(h.mounts.length,1);assert.equal(h.mounts[0].data,snapshot);
  assert.equal(h.elements.get('resultMenu').open,false);h.mounts[0].callbacks.onMenu();assert.equal(h.elements.get('resultMenu').open,true);
  h.elements.get('menuCancel').click();assert.equal(h.elements.get('resultMenu').open,false);
  assert.equal(h.replacements.length,0);assert.equal(h.backCalls,0);
});

test('the real detail document requests the native WeChat header only when it is embedded',async()=>{
  for(const options of[{userAgent:WECHAT_UA},{userAgent:WECHAT_UA,noMatchMedia:true}]){
    const h=harness(options);await h.settle();
    assert.equal(h.mounts.length,1);assert.equal(h.mounts[0].callbacks.nativeHeader,true);assert.equal(h.document.title,'详情');
  }
});

test('ordinary browsers and both standalone detection paths retain the web detail header',async()=>{
  for(const options of[{}, {userAgent:'Mozilla/5.0 Chrome/140.0'}, {userAgent:WECHAT_UA,standalone:true}, {userAgent:WECHAT_UA,displayModeStandalone:true}, {userAgent:WECHAT_UA,standalone:true,noMatchMedia:true}]){
    const h=harness(options);await h.settle();
    assert.equal(h.mounts.length,1);assert.equal(h.mounts[0].callbacks.nativeHeader,false);assert.equal(h.document.title,'详情');
  }
});

test('back uses same-origin editor history and closes the menu',async()=>{
  const h=harness();await h.settle();h.mounts[0].callbacks.onMenu();h.elements.get('menuBack').click();
  assert.equal(h.backCalls,1);assert.equal(h.elements.get('resultMenu').open,false);assert.deepEqual(h.replacements,[]);
});

test('direct, external, detail-referrer and shallow history visits return to a fresh editor URL',async()=>{
  for(const options of[{referrer:''},{referrer:'https://other.test/index.html'},{referrer:'https://example.test/h5/detail.html?id=older'},{historyLength:1}]){
    const h=harness(options);await h.settle();h.mounts[0].callbacks.onBack();
    assert.equal(h.backCalls,0);assert.deepEqual(h.replacements,['index.html']);
  }
});

test('missing or unsafe tokens show a usable empty state without reading storage',async()=>{
  for(const search of['','?id=short','?id='+encodeURIComponent('../index.html'),'?id='+'a'.repeat(81),'?id=%3Cscript%3E']){
    const h=harness({search,referrer:''});await h.settle();
    assert.equal(h.storeCreates,0);assert.equal(h.mounts.length,0);assert.match(allText(h.elements.get('momentsRoot')),/详情暂不可用.*返回配置/);
    const link=h.elements.get('momentsRoot').children[0].children.find(node=>node.tagName==='a');assert.equal(link.href,'index.html');link.click();assert.deepEqual(h.replacements,['index.html']);
  }
});

test('expired, absent, malformed, unreadable and unrenderable entries never leave a blank result',async()=>{
  for(const options of[{entry:null},{entry:{}},{entry:{snapshot:null}},{entry:{snapshot:[]}},{error:true},{mountError:true}]){
    const h=harness({...options,referrer:''});await h.settle();
    assert.match(allText(h.elements.get('momentsRoot')),/详情暂不可用/);assert.equal(h.document.title,'详情');
    const link=h.elements.get('momentsRoot').children[0].children.find(node=>node.tagName==='a');assert.equal(link.href,'index.html');
  }
});

test('refresh reads the same persistent entry again and loading only finishes after the store resolves',async()=>{
  let resolve;const pending=new Promise(done=>{resolve=done;}),h=harness({load:()=>pending});
  assert.equal(h.mounts.length,0);resolve({snapshot,draft:{}});await h.settle();assert.equal(h.mounts.length,1);
  const refreshed=harness({referrer:'https://example.test/h5/detail.html?id='+ID});await refreshed.settle();
  assert.deepEqual(refreshed.loads,[ID]);assert.equal(refreshed.mounts[0].data.photos[0].width,200);assert.equal(refreshed.mounts[0].data.photos[0].height,1000);
});
