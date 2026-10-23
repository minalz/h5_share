'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const MomentsView=require('../moments-view');
function fakeDocument(){
  const nodes=[];
  class Element{
    constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.style={};this.listeners={};this.textContent='';this.className='';nodes.push(this);}
    appendChild(child){child.parentNode=this;this.children.push(child);return child;}
    replaceChildren(...children){this.children.forEach(child=>{child.parentNode=null;});this.children=[];children.forEach(child=>this.appendChild(child));}
    setAttribute(name,value){this.attributes[name]=String(value);}
    addEventListener(name,handler){(this.listeners[name]||=[]).push(handler);}
    removeEventListener(name,handler){this.listeners[name]=(this.listeners[name]||[]).filter(item=>item!==handler);}
    click(){for(const handler of this.listeners.click||[])handler();}
  }
  const doc={
    createElement(tag){assert.notEqual(tag,'canvas','The detail view creates web elements only');return new Element(tag,doc);},
    createElementNS(namespace,tag){assert.equal(namespace,'http://www.w3.org/2000/svg');const el=new Element(tag,doc);el.namespace=namespace;return el;}
  };
  return{doc,nodes};
}
function descendants(element){return[element,...element.children.flatMap(descendants)];}
function byClass(element,name){return descendants(element).filter(node=>(node.className||node.attributes.class||'').split(' ').includes(name));}
const snapshot={avatar:'data:image/jpeg;base64,avatar',nickname:'小满',content:'春风有信\n好久不见',photos:[{src:'assets/photo.jpg',width:303,height:535}],timeLabel:'6分钟前',likers:Array.from({length:17},(_,index)=>({src:'assets/avatar-'+index+'.jpg',name:'昵称'+index}))};
const WECHAT_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.64 NetType/WIFI';

test('embedded WeChat uses its native header while browsers and standalone windows keep the web header',()=>{
  assert.equal(typeof MomentsView.usesNativeHeader,'function');
  for(const userAgent of[WECHAT_UA,'Mozilla/5.0 (Linux; Android 16) MicroMessenger/8.0.64','micromessenger/8.0']){
    assert.equal(MomentsView.usesNativeHeader(userAgent,false),true);
    assert.equal(MomentsView.usesNativeHeader(userAgent,true),false);
  }
  for(const userAgent of['Mozilla/5.0 (iPhone) Version/26.0 Mobile/15E148 Safari/604.1','Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36','',undefined])assert.equal(MomentsView.usesNativeHeader(userAgent,false),false);
});

test('native-header mode omits the entire second heading and its space while keeping the actual post and footer',()=>{
  const{doc}=fakeDocument(),container=doc.createElement('section');let clicked=0;
  const view=MomentsView.mount(container,snapshot,{nativeHeader:true,onBack:()=>clicked++,onMenu:()=>clicked++});
  for(const name of['moments-nav','moments-title','moments-back','moments-menu'])assert.equal(byClass(container,name).length,0,name+' must not duplicate WeChat chrome');
  const page=byClass(container,'moments-page')[0];
  assert.equal(page.children.length,2,'No empty header or placeholder consumes native-header space');
  assert.ok((page.children[0].className||'').split(' ').includes('moments-body'));
  assert.ok((page.children[1].className||'').split(' ').includes('moments-footer'));
  assert.equal(descendants(container).some(node=>node.tagName==='header'||node.tagName==='h1'||node.tagName==='button'),false);
  assert.equal(byClass(container,'moments-name')[0].textContent,snapshot.nickname);
  assert.equal(byClass(container,'moments-content')[0].textContent,snapshot.content);
  assert.equal(byClass(container,'moments-liker').length,17);assert.equal(byClass(container,'moments-comment')[0].textContent,'发表评论:');
  view.destroy();assert.equal(container.children.length,0);assert.equal(clicked,0);
});

test('Safari, desktop browsers and standalone WeChat keep usable web back and menu controls',()=>{
  for(const [userAgent,standalone]of[['Mozilla/5.0 Safari/604.1',false],['Mozilla/5.0 Chrome/140.0',false],[WECHAT_UA,true]]){
    const{doc}=fakeDocument(),container=doc.createElement('section');let back=0,menu=0;
    MomentsView.mount(container,snapshot,{nativeHeader:MomentsView.usesNativeHeader(userAgent,standalone),onBack:()=>back++,onMenu:()=>menu++});
    assert.equal(byClass(container,'moments-nav').length,1);assert.equal(byClass(container,'moments-title')[0].textContent,'详情');
    byClass(container,'moments-back')[0].click();byClass(container,'moments-menu')[0].click();assert.equal(back,1);assert.equal(menu,1);
  }
});

test('reference metrics adapt to window width and keep single-photo ratios within the reference bounds',()=>{
  assert.equal(MomentsView.metrics.likerColumns,8);
  for(const [width,height]of[[303,535],[4000,100],[100,4000],[1,1]]){
    const size=MomentsView.fitPhoto({width,height});
    assert.ok(size.width<=237&&size.height<=640);assert.ok(Math.abs(size.width/size.height-width/height)<1e-8);
  }
  const ios=MomentsView.getLayout(402,822),android=MomentsView.getLayout(360,760);
  assert.equal(ios.viewportWidth,402);assert.equal(ios.viewportHeight,822);assert.equal(android.width,942);
  assert.ok(ios.navHeight>android.navHeight);assert.equal(ios.height*ios.scale,822);
  const fallback=MomentsView.getLayout(0,NaN);assert.equal(fallback.viewportWidth,402);assert.equal(fallback.viewportHeight,822);
});

test('mount renders the actual detail web structure and user content is always safe text',()=>{
  const{doc}=fakeDocument(),container=doc.createElement('section');
  const hostile={...snapshot,nickname:'<img src=x onerror=alert(1)>',content:'<script>alert(1)</script>'};
  MomentsView.mount(container,hostile);
  assert.equal(byClass(container,'moments-title')[0].textContent,'详情');
  assert.equal(byClass(container,'moments-name')[0].textContent,hostile.nickname);
  assert.equal(byClass(container,'moments-content')[0].textContent,hostile.content);
  assert.equal(descendants(container).filter(node=>node.tagName==='script').length,0);
  assert.equal(byClass(container,'moments-comment')[0].textContent,'发表评论:');
  assert.equal(byClass(container,'moments-page').length,1);assert.equal(byClass(container,'moments-body').length,1);assert.equal(byClass(container,'moments-footer').length,1);
  assert.equal(descendants(container).some(node=>/status|battery|wifi|download|resultDialog/.test(node.className||'')),false);
  assert.equal(descendants(container).some(node=>node.tagName==='a'||node.tagName==='canvas'),false);
});

test('all content icons are SVG elements with matching aspect-ratio view boxes and circular two-dot shapes',()=>{
  const{doc}=fakeDocument(),container=doc.createElement('section');MomentsView.mount(container,snapshot);
  const icon=name=>byClass(container,name)[0];
  assert.equal(icon('moments-delete').attributes.viewBox,'0 0 34 40');
  assert.equal(icon('moments-heart').attributes.viewBox,'0 0 40 34');
  assert.equal(icon('moments-smile').attributes.viewBox,'0 0 80 80');
  assert.equal(icon('moments-album').attributes.viewBox,'0 0 80 64');
  for(const svg of byClass(container,'moments-icon')){assert.equal(svg.tagName,'svg');assert.equal(svg.attributes['aria-hidden'],'true');assert.equal(svg.attributes.focusable,'false');}
  const more=byClass(container,'moments-more')[0].children[0];
  assert.equal(more.children.length,2);assert.equal(more.children.every(node=>node.tagName==='circle'),true);
  assert.equal(more.children[0].attributes.r,more.children[1].attributes.r);
  assert.equal(more.children[0].attributes.cy,more.children[1].attributes.cy);
});

test('photo grids use two columns for four pictures and three for other multi-picture counts, preserving image sources',()=>{
  for(const count of[1,2,4,9]){
    const{doc}=fakeDocument(),container=doc.createElement('section');
    const photos=Array.from({length:count},(_,i)=>({src:'photo-'+i,width:200,height:1000}));
    MomentsView.mount(container,{...snapshot,photos});
    const photoNodes=byClass(container,'moments-photo'),grid=byClass(container,'moments-photos')[0];
    assert.equal(photoNodes.length,count);assert.equal(grid.attributes['data-columns'],String(count===1?1:count===4?2:3));
    assert.deepEqual(photoNodes.map(node=>node.src),photos.map(photo=>photo.src));
    const size=count===1?MomentsView.fitPhoto(photos[0]):{width:214,height:214};
    for(const image of photoNodes){assert.equal(image.style.width,'calc(var(--moments-unit, 1px) * '+size.width+')');assert.equal(image.style.height,'calc(var(--moments-unit, 1px) * '+size.height+')');assert.equal(image.draggable,false);}
  }
});

test('older snapshots default to the reference source text between the photo and publication time',()=>{
  const{doc}=fakeDocument(),container=doc.createElement('section');
  assert.equal(Object.hasOwn(snapshot,'sourceName'),false);
  assert.equal(MomentsView.normalizeSnapshot(snapshot).sourceName,'51Talk无忧英语');
  MomentsView.mount(container,snapshot);
  const main=byClass(container,'moments-main')[0],photos=byClass(container,'moments-photos')[0],source=byClass(container,'moments-source')[0],meta=byClass(container,'moments-meta')[0];
  assert.equal(source.textContent,'51Talk无忧英语');assert.equal(source.tagName,'div');
  assert.equal(main.children.indexOf(source),main.children.indexOf(photos)+1,'The source follows the photo instead of being added to the article text');
  assert.equal(main.children.indexOf(meta),main.children.indexOf(source)+1,'The publication time immediately follows the source line');
});

test('explicitly clearing the source removes its node rather than leaving an empty source row',()=>{
  const{doc}=fakeDocument(),container=doc.createElement('section'),value={...snapshot,sourceName:''};
  assert.equal(MomentsView.normalizeSnapshot(value).sourceName,'');MomentsView.mount(container,value);
  assert.equal(byClass(container,'moments-source').length,0);
  const main=byClass(container,'moments-main')[0],photos=byClass(container,'moments-photos')[0],meta=byClass(container,'moments-meta')[0];
  assert.equal(main.children.indexOf(meta),main.children.indexOf(photos)+1,'Clearing the source leaves no intervening placeholder');
});

test('custom source names are rendered as safe text and never create HTML elements or event handlers',()=>{
  const{doc}=fakeDocument(),container=doc.createElement('section'),sourceName='<img src=x onerror=alert(1)><script>alert(1)</script>';
  MomentsView.mount(container,{...snapshot,sourceName});
  const source=byClass(container,'moments-source')[0];assert.equal(source.textContent,sourceName);assert.equal(source.children.length,0);
  assert.equal(descendants(container).some(node=>node.tagName==='script'),false);
  assert.equal(descendants(container).some(node=>Object.hasOwn(node.attributes,'onerror')),false);
});

test('no photo, no text and no likes omit their containers rather than adding invisible sections or imaginary comments',()=>{
  const{doc}=fakeDocument(),container=doc.createElement('section');
  MomentsView.mount(container,{...snapshot,nickname:'',content:'',photos:[],likers:[]});
  for(const name of['moments-content','moments-photos','moments-likes','moments-comments'])assert.equal(byClass(container,name).length,0,name+' must be absent');
  assert.equal(byClass(container,'moments-name').length,1,'Empty names still have the reference name row');assert.equal(byClass(container,'moments-name')[0].textContent,'');
  assert.equal(byClass(container,'moments-meta').length,1);assert.equal(byClass(container,'moments-comment').length,1);
});

test('the eight-column liker grid keeps every configured avatar/name and caps oversized snapshots to 100 users plus self',()=>{
  const{doc}=fakeDocument(),container=doc.createElement('section');
  const likers=Array.from({length:110},(_,index)=>({src:'avatar-'+index,name:'用户'+index}));
  MomentsView.mount(container,{...snapshot,likers});
  const images=byClass(container,'moments-liker');assert.equal(images.length,101);assert.equal(MomentsView.metrics.likerColumns,8);
  assert.equal(byClass(container,'moments-likes')[0].attributes['aria-label'],'101 位用户点赞');
  assert.equal(images[0].src,'avatar-0');assert.equal(images[100].src,'avatar-100');assert.equal(images[100].alt,'用户100的头像');
  assert.equal(byClass(container,'moments-liker-grid')[0].children.length,101);
});

test('native back and menu buttons call their handlers, and destroy removes old handlers without deleting a newer mount',()=>{
  const{doc}=fakeDocument(),container=doc.createElement('section');let back=0,menu=0;
  const old=MomentsView.mount(container,snapshot,{onBack:()=>back++,onMenu:()=>menu++});
  const buttons=descendants(container).filter(node=>node.tagName==='button');
  assert.deepEqual(buttons.map(node=>node.attributes['aria-label']),['返回编辑','更多操作']);
  buttons[0].click();buttons[1].click();assert.equal(back,1);assert.equal(menu,1);
  const newer=MomentsView.mount(container,{...snapshot,nickname:'新的详情'});old.destroy();buttons[0].click();buttons[1].click();
  assert.equal(back,1);assert.equal(menu,1);assert.equal(byClass(container,'moments-name')[0].textContent,'新的详情');
  newer.destroy();assert.equal(container.children.length,0);assert.doesNotThrow(()=>newer.destroy());
});

test('snapshot normalization is independent and keeps long nicknames, newlines and joined emoji intact for browser layout',()=>{
  const value={...snapshot,nickname:'春'.repeat(24),content:'第一行\n👨‍👩‍👧‍👦 👩🏽‍💻 🇨🇳',photos:[{src:'p',width:200,height:1000}],likers:[{src:'a',name:'自定义'}]};
  const result=MomentsView.normalizeSnapshot(value);value.photos[0].width=999;value.likers[0].name='修改后';
  assert.equal(result.photos[0].width,200);assert.equal(result.likers[0].name,'自定义');
  assert.equal(result.nickname,'春'.repeat(24));assert.equal(result.content,'第一行\n👨‍👩‍👧‍👦 👩🏽‍💻 🇨🇳');
  const{doc}=fakeDocument(),container=doc.createElement('section');MomentsView.mount(container,result);
  assert.equal(byClass(container,'moments-name')[0].textContent,result.nickname);assert.equal(byClass(container,'moments-content')[0].textContent,result.content);
});

test('the public module contains only web-view functions and no image encoder or download entry point',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../moments-view.js'),'utf8');
  for(const obsolete of['renderPNG','drawIcon','roundRect','paintImage','paintRect','wrap','exportSize'])assert.equal(MomentsView[obsolete],undefined,obsolete+' must be removed');
  assert.doesNotMatch(source,/renderPNG|toBlob|toDataURL|createObjectURL|createElement\(['"]canvas|getContext\(|window\.open|previewImage|download|const FONT\b/);
  assert.equal(typeof MomentsView.mount,'function');assert.equal(typeof MomentsView.fitPhoto,'function');
  assert.throws(()=>MomentsView.mount(null,snapshot),/结果容器/);
});
