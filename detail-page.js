(function () {
  'use strict';
  const root=document.getElementById('momentsRoot'),menu=document.getElementById('resultMenu');
  const token=new URLSearchParams(window.location.search).get('id')||'';
  const id=/^[A-Za-z0-9_-]{16,80}$/.test(token)?token:'';
  const editorURL='index.html';
  const client=typeof navigator==='object'?navigator:{};
  const standalone=Boolean(client.standalone||(typeof window.matchMedia==='function'&&window.matchMedia('(display-mode: standalone)').matches));
  const nativeHeader=MomentsView.usesNativeHeader(client.userAgent,standalone);
  document.title='详情';

  function closeMenu(){
    if(typeof menu.close==='function'){if(menu.open)menu.close();}
    else menu.removeAttribute('open');
  }
  function back(){
    closeMenu();
    let fromEditor=false;
    try{
      const previous=new URL(document.referrer);
      fromEditor=previous.origin===window.location.origin&&!/\/detail\.html\/?$/i.test(previous.pathname);
    }catch(_){/* An address opened directly has no trustworthy previous page. */}
    if(fromEditor&&window.history.length>1&&typeof window.history.back==='function')window.history.back();
    else window.location.replace(editorURL);
  }
  function showMenu(){
    if(menu.open)return;
    if(typeof menu.showModal==='function')menu.showModal();
    else menu.setAttribute('open','');
  }
  function unavailable(){
    closeMenu();
    const state=document.createElement('div'),title=document.createElement('h1'),copy=document.createElement('p'),link=document.createElement('a');
    state.className='detail-state';state.setAttribute('role','status');
    title.textContent='详情暂不可用';copy.textContent='内容可能已过期或被清理，请返回配置后重新发表。';
    link.textContent='返回配置';link.href=editorURL;link.addEventListener('click',event=>{event.preventDefault();back();});
    state.appendChild(title);state.appendChild(copy);state.appendChild(link);root.replaceChildren(state);
  }
  document.getElementById('menuBack').addEventListener('click',back);
  document.getElementById('menuCancel').addEventListener('click',closeMenu);

  async function start(){
    if(!id){unavailable();return;}
    try{
      const entry=await DetailStore.create().load(id);
      if(!entry||!entry.snapshot||typeof entry.snapshot!=='object'||Array.isArray(entry.snapshot)){unavailable();return;}
      MomentsView.mount(root,entry.snapshot,{onBack:back,onMenu:showMenu,nativeHeader});
    }catch(_){unavailable();}
  }
  void start();
})();
