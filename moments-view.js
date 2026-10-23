(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MomentsView = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const metrics = Object.freeze({width:942,navHeight:104,bodyTop:34,avatarX:28,avatarSize:94,mainX:145,right:36,nameSize:38,nameHeight:47,nameGap:14,textSize:40,lineHeight:54,photoGap:10,singlePhotoWidth:237,singlePhotoHeight:640,photoCell:214,gridGap:10,metaGap:20,timeSize:33,metaHeight:48,likesX:28,likesWidth:881,likesTop:20,likesBottom:26,likerSize:84,likerGap:12,likerColumns:8,footerHeight:132});
  const BLUE='#576b95',BLACK='#181818';
  const NS='http://www.w3.org/2000/svg';
  const VIEWBOXES=Object.freeze({back:[24,40],menu:[49,32],delete:[34,40],heart:[40,34],smile:[80,80],album:[80,64]});
  // Content icons are native SVG elements; phone status icons belong to the OS.
  const ICONS=Object.freeze({
    back:[{commands:[['M',21.5,2],['L',3.5,20],['L',21.5,38]],stroke:BLACK,strokeWidth:3.2}],
    menu:[{circle:[8,16,4],fill:BLACK},{circle:[24.5,16,4],fill:BLACK},{circle:[41,16,4],fill:BLACK}],
    delete:[{commands:[['M',4,9],['L',30,9],['L',28,37],['C',27.8,39,26.5,40,24,40],['L',10,40],['C',7.5,40,6.2,39,6,37],['Z']],fill:BLUE},{commands:[['M',0,5],['L',34,5],['L',34,10],['L',0,10],['Z']],fill:BLUE},{commands:[['M',12,0],['L',22,0],['L',22,4],['L',12,4],['Z']],fill:BLUE},{commands:[['M',12,15],['L',13,30],['M',22,15],['L',21,30]],stroke:'#fff',strokeWidth:3}],
    more:[{circle:[9,16,3.5],fill:BLUE},{circle:[23,16,3.5],fill:BLUE}],
    heart:[{commands:[['M',20,32],['C',17,29,2,18,2,10],['C',2,1,14,0,20,8],['C',26,0,38,1,38,10],['C',38,18,23,29,20,32],['Z']],stroke:BLUE,strokeWidth:2.5}],
    smile:[{circle:[40,40,37.5],stroke:'#191919',strokeWidth:5},{circle:[26,28,6],fill:'#191919'},{circle:[54,28,6],fill:'#191919'},{commands:[['M',18.5,44.5],['L',61.5,44.5],['C',58.5,70,21.5,70,18.5,44.5],['Z']],stroke:'#191919',strokeWidth:5}],
    album:[{commands:[['M',2.5,2.5],['L',77.5,2.5],['L',77.5,61.5],['L',2.5,61.5],['Z'],['M',3,47],['L',28,25],['L',49,42],['L',61,33],['L',77,47]],stroke:'#191919',strokeWidth:5}]
  });
  function number(value,fallback){const n=Number(value);return Number.isFinite(n)&&n>0?n:fallback;}
  function getLayout(width,height){
    const viewportWidth=number(width,402),viewportHeight=number(height,822),scale=viewportWidth/metrics.width;
    return {viewportWidth,viewportHeight,scale,width:metrics.width,height:viewportHeight/scale,navHeight:metrics.navHeight*scale,footerHeight:metrics.footerHeight*scale,likerColumns:metrics.likerColumns};
  }
  function fitPhoto(photo,maxWidth=metrics.singlePhotoWidth,maxHeight=metrics.singlePhotoHeight){
    const width=number(photo&&photo.width,1),height=number(photo&&photo.height,1),scale=Math.min(maxWidth/width,maxHeight/height);
    return {width:width*scale,height:height*scale};
  }
  function normalizeSnapshot(value){
    const s=value||{};
    return {avatar:String(s.avatar||''),nickname:String(s.nickname||''),content:String(s.content||'').slice(0,2000),sourceName:typeof s.sourceName==='string'?s.sourceName.trim().slice(0,60):'51Talk无忧英语',timeLabel:String(s.timeLabel||'刚刚'),photos:(Array.isArray(s.photos)?s.photos:[]).slice(0,9).filter(p=>p&&p.src).map(p=>({src:String(p.src),width:number(p.width,1),height:number(p.height,1)})),likers:(Array.isArray(s.likers)?s.likers:[]).slice(0,101).filter(p=>p&&p.src).map(p=>({src:String(p.src),name:String(p.name||'')}))};
  }
  function pathText(commands){return commands.map(part=>part.join(' ')).join(' ');}
  function usesNativeHeader(userAgent,standalone=false){return !standalone&&/MicroMessenger/i.test(String(userAgent||''));}
  function createIcon(doc,name,className){
    const viewBox=VIEWBOXES[name]||[32,32],svg=doc.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 '+viewBox.join(' '));svg.setAttribute('class','moments-icon '+(className||''));svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
    for(const shape of ICONS[name]||[]){
      const node=doc.createElementNS(NS,shape.circle?'circle':'path');
      if(shape.circle){node.setAttribute('cx',shape.circle[0]);node.setAttribute('cy',shape.circle[1]);node.setAttribute('r',shape.circle[2]);}else node.setAttribute('d',pathText(shape.commands));
      node.setAttribute('fill',shape.fill||'none');
      if(shape.stroke){node.setAttribute('stroke',shape.stroke);node.setAttribute('stroke-width',shape.strokeWidth);node.setAttribute('stroke-linejoin','round');node.setAttribute('stroke-linecap','round');}
      svg.appendChild(node);
    }
    return svg;
  }
  function mount(container,value,options={}){
    if(!container||!container.ownerDocument)throw new Error('结果容器未准备好');
    const doc=container.ownerDocument,s=normalizeSnapshot(value),cleanups=[];
    const node=(tag,className,text)=>{const el=doc.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
    const append=(parent,...children)=>{children.forEach(child=>parent.appendChild(child));return parent;};
    const picture=(src,className,alt)=>{const el=node('img',className);el.src=src;el.alt=alt||'';el.draggable=false;return el;};
    const button=(className,label,iconName,handler)=>{const el=node('button',className);el.type='button';el.setAttribute('aria-label',label);el.appendChild(createIcon(doc,iconName));if(typeof handler==='function'){el.addEventListener('click',handler);cleanups.push(()=>el.removeEventListener('click',handler));}return el;};
    const page=node('div','moments-page');
    if(!options.nativeHeader){
      const nav=node('header','moments-nav');
      append(nav,button('moments-back','返回编辑','back',options.onBack),node('h1','moments-title','详情'),button('moments-menu','更多操作','menu',options.onMenu));
      page.appendChild(nav);
    }
    const body=node('div','moments-body');body.setAttribute('aria-label','朋友圈详情内容');
    const post=node('article','moments-post'),main=node('div','moments-main');
    append(post,picture(s.avatar,'moments-avatar','发布者头像'),main);
    append(main,node('div','moments-name',s.nickname));
    if(s.content)main.appendChild(node('div','moments-content',s.content));
    if(s.photos.length){
      const single=s.photos.length===1,columns=s.photos.length===4?2:3,photos=node('div','moments-photos '+(single?'photos-single':'photos-grid'));
      photos.setAttribute('data-columns',single?1:columns);
      s.photos.forEach((p,index)=>{const image=picture(p.src,'moments-photo','配图 '+(index+1));const size=single?fitPhoto(p):{width:metrics.photoCell,height:metrics.photoCell};image.style.width='calc(var(--moments-unit, 1px) * '+size.width+')';image.style.height='calc(var(--moments-unit, 1px) * '+size.height+')';photos.appendChild(image);});
      main.appendChild(photos);
    }
    if(s.sourceName)main.appendChild(node('div','moments-source',s.sourceName));
    const meta=node('div','moments-meta'),more=node('span','moments-more');
    append(more,createIcon(doc,'more'));
    append(meta,node('span','moments-time',s.timeLabel),createIcon(doc,'delete','moments-delete'),more);main.appendChild(meta);body.appendChild(post);
    if(s.likers.length){
      const likes=node('section','moments-likes'),grid=node('div','moments-liker-grid');likes.setAttribute('aria-label',s.likers.length+' 位用户点赞');
      s.likers.forEach(p=>grid.appendChild(picture(p.src,'moments-liker',p.name? p.name+'的头像':'点赞用户头像')));
      append(likes,createIcon(doc,'heart','moments-heart'),grid);body.appendChild(likes);
    }
    const footer=node('footer','moments-footer'),row=node('div','moments-comment-row');
    append(row,node('div','moments-comment','发表评论:'),createIcon(doc,'smile','moments-smile'),createIcon(doc,'album','moments-album'));footer.appendChild(row);
    append(page,body,footer);container.replaceChildren(page);
    return {destroy(){cleanups.splice(0).forEach(clean=>clean());if(page.parentNode===container)container.replaceChildren();}};
  }
  return {metrics,icons:ICONS,getLayout,fitPhoto,normalizeSnapshot,usesNativeHeader,mount};
});
