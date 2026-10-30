(() => {
'use strict';
const isColor=v=>/^#[0-9a-f]{6}$/i.test(String(v||''));
const clamp=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
const pageName=()=>{const p=location.pathname.toLowerCase();if(p.startsWith('/store/order'))return'order';if(p.startsWith('/store/review'))return'review';if(p.startsWith('/store/ticket'))return'ticket';if(p.startsWith('/store'))return'store';if(p.startsWith('/wiki/artikel/'))return'wiki-'+(p.split('/').pop()||'artikel').replace(/\.html$/,'');if(p.startsWith('/wiki'))return'wiki';if(p.startsWith('/bantuan'))return'help';return'home';};
const studioMode=new URLSearchParams(location.search).get('slf_studio')==='1';
const fontMap={
 system:'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
 serif:'Georgia,"Times New Roman",serif',
 sans:'Arial,Helvetica,sans-serif',
 rounded:'"Trebuchet MS",Arial,sans-serif',
 mono:'ui-monospace,SFMono-Regular,Consolas,monospace',
 fantasy:'Georgia,"Palatino Linotype",serif',
 display:'Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif',
 book:'Palatino,"Palatino Linotype","Book Antiqua",serif'
};
const shadows={none:'none',soft:'0 8px 24px rgba(0,0,0,.18)',deep:'0 18px 42px rgba(0,0,0,.32)',glow:'0 0 24px rgba(126,230,246,.35)',gold:'0 0 24px rgba(243,203,130,.28)'};
const textShadows={none:'none',soft:'0 2px 10px rgba(0,0,0,.55)',glow:'0 0 16px rgba(126,230,246,.7)',gold:'0 0 16px rgba(243,203,130,.65)'};
const filters={none:'none',softBlur:'blur(1px)',gray:'grayscale(1)',warm:'sepia(.28) saturate(1.15)',vivid:'saturate(1.35) contrast(1.04)'};
let design=null,studioSelect=false,selected=null,originState=new WeakMap(),insertedNodes=new Map();
const parentOrigin=location.origin;
function selectorFor(el){
 if(el.id&&/^[A-Za-z][A-Za-z0-9_-]*$/.test(el.id))return '#'+el.id;
 const parts=[];let node=el;
 while(node&&node.nodeType===1&&node!==document.documentElement&&parts.length<7){
  let part=node.tagName.toLowerCase();
  const safeClasses=[...node.classList].filter(x=>/^[A-Za-z_-][A-Za-z0-9_-]*$/.test(x)).slice(0,2);
  if(safeClasses.length)part+='.'+safeClasses.join('.');
  const parent=node.parentElement;
  if(parent){
   const peers=[...parent.children].filter(x=>x.tagName===node.tagName&&safeClasses.every(c=>x.classList.contains(c)));
   if(peers.length>1)part+=':nth-of-type('+(Array.prototype.indexOf.call(parent.children,node)+1)+')';
  }
  parts.unshift(part);
  if(parent&&parent.id&&/^[A-Za-z][A-Za-z0-9_-]*$/.test(parent.id)){parts.unshift('#'+parent.id);break;}
  node=parent;
 }
 return parts.join(' > ').slice(0,280);
}
function canSelect(el){
 if(!el||el.nodeType!==1||!el.closest('main,body>footer,body>header'))return false;
 return !el.closest('#toast,.toast,[data-no-studio],script,style,link,meta,svg path');
}
function textIsEditable(el){
 return el.children.length===0&&el.tagName!=='IMG'&&el.tagName!=='INPUT'&&el.tagName!=='TEXTAREA'&&el.tagName!=='SELECT'&&el.textContent.length<4000;
}
function colorHex(value,fallback){const m=String(value||'').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);return m?'#'+[m[1],m[2],m[3]].map(x=>Math.max(0,Math.min(255,Number(x))).toString(16).padStart(2,'0')).join(''):fallback;}
function describe(el){
 const cs=getComputedStyle(el),fam=cs.fontFamily.toLowerCase();
 const font=fam.includes('georgia')||fam.includes('times')?'serif':fam.includes('mono')||fam.includes('console')?'mono':fam.includes('trebuchet')?'rounded':fam.includes('arial')||fam.includes('helvetica')?'sans':'system';
 const shadow=cs.boxShadow==='none'?'none':cs.boxShadow.includes('243, 203, 130')?'gold':cs.boxShadow.includes('126, 230, 246')?'glow':cs.boxShadow.includes('18px')?'deep':'soft';
 const tr=cs.translate&&cs.translate!=='none'?cs.translate.split(/\\s+/):[];
 const bg=cs.backgroundImage&&cs.backgroundImage!=='none'?(cs.backgroundImage.match(/url\(["']?(.*?)["']?\)/)||[])[1]||'':'';
 const ancestors=[];let parent=el.parentElement;
 while(parent&&ancestors.length<6&&parent!==document.body){if(canSelect(parent)&&(parent.matches('main,header,footer,section,article,.wrap,.hero,.section,.panel,.zone,.shop-card,.wiki-entry,.notice,.checkout,.products,.wiki-grid'))){ancestors.push({selector:selectorFor(parent),tag:parent.tagName.toLowerCase(),label:(parent.getAttribute('aria-label')||parent.querySelector('h1,h2,h3,h4')?.textContent||parent.className||parent.tagName).toString().trim().replace(/\s+/g,' ').slice(0,48)});}parent=parent.parentElement;}
 return {type:'slf-studio-selected',selector:selectorFor(el),tag:el.tagName.toLowerCase(),text:textIsEditable(el)?el.textContent:'',textEditable:textIsEditable(el),src:el.tagName==='IMG'?(el.getAttribute('src')||''):bg,backgroundImage:el.tagName!=='IMG'&&Boolean(bg),created:el.hasAttribute('data-slf-created'),id:el.id||'',label:(el.getAttribute('aria-label')||el.getAttribute('alt')||el.textContent||el.tagName).trim().replace(/\s+/g,' ').slice(0,100),ancestors,page:pageName(),computed:{color:colorHex(cs.color,'#ffffff'),backgroundColor:colorHex(cs.backgroundColor,'#100c18'),fontFamily:font,fontSize:parseFloat(cs.fontSize)||16,fontWeight:parseInt(cs.fontWeight,10)||700,letterSpacing:parseFloat(cs.letterSpacing)||0,lineHeight:parseFloat(cs.lineHeight)||1.5,textAlign:cs.textAlign,textTransform:cs.textTransform,borderRadius:parseFloat(cs.borderRadius)||0,padding:parseFloat(cs.paddingTop)||0,marginBottom:parseFloat(cs.marginBottom)||0,maxWidth:parseFloat(cs.maxWidth)||800,opacity:parseFloat(cs.opacity)||1,boxShadow:shadow,filter:'none',objectFit:cs.objectFit||'cover',translateX:parseFloat(tr[0])||0,translateY:parseFloat(tr[1])||0}};
}
function remember(el){
 if(!originState.has(el))originState.set(el,{style:el.getAttribute('style'),text:el.textContent,src:el.getAttribute('src'),hidden:el.hidden});
}
function applyStyle(el,styles){
 if(!styles||typeof styles!=='object')return;
 const allowed=['color','backgroundColor','fontFamily','fontStyle','textDecoration','fontSize','fontWeight','lineHeight','letterSpacing','textAlign','textTransform','borderRadius','padding','marginBottom','opacity','boxShadow','filter','maxWidth','widthPct','minHeight','borderWidth','borderColor','borderStyle','textShadow','objectFit','translateX','translateY'];
 for(const key of allowed){if(styles[key]===undefined)continue;let value=styles[key];
  if(key==='fontFamily')value=fontMap[value]||fontMap.system;
  if(key==='fontStyle'&&!['normal','italic'].includes(value))continue;
  if(key==='textDecoration'&&!['none','underline','line-through'].includes(value))continue;
  if(key==='boxShadow')value=shadows[value]||'none';
  if(key==='textShadow')value=textShadows[value]||'none';
  if(key==='borderColor'&&!isColor(value))continue;
  if(key==='borderStyle'&&!['solid','dashed','dotted','none'].includes(value))continue;
  if(key==='filter')value=filters[value]||'none';
  if(key==='color'||key==='backgroundColor'){if(value!=='transparent'&&!isColor(value))continue;}
  if(key==='fontWeight')value=String(clamp(value,300,900,700));
  if(key==='fontSize')value=clamp(value,8,120,16)+'px';
  if(key==='lineHeight')value=clamp(value,.8,3,1.5);
  if(key==='letterSpacing')value=clamp(value,-2,20,0)+'px';
  if(key==='borderRadius')value=clamp(value,0,80,0)+'px';
  if(key==='padding')value=clamp(value,0,80,0)+'px';
  if(key==='marginBottom')value=clamp(value,0,120,0)+'px';
  if(key==='opacity')value=clamp(value,0,1,1);
  if(key==='maxWidth')value=clamp(value,80,1200,800)+'px';
  if(key==='widthPct')value=clamp(value,0,100,100)+'%';
  if(key==='minHeight')value=clamp(value,0,900,0)+'px';
  if(key==='borderWidth')value=clamp(value,0,12,0)+'px';
  if(key==='textAlign'&&!['left','center','right','justify'].includes(value))continue;
  if(key==='textTransform'&&!['none','uppercase','lowercase','capitalize'].includes(value))continue;
  if(key==='objectFit'&&!['cover','contain','fill'].includes(value))continue;
  el.style[key]=String(value);
 }
 if(styles.translateX!==undefined||styles.translateY!==undefined){const tx=clamp(styles.translateX,-100,100,0),ty=clamp(styles.translateY,-100,100,0);el.style.translate=tx+'% '+ty+'%';}
}
function applyEffects(el,effects){
 const all=['slf-effect-glass','slf-effect-glow','slf-effect-float','slf-effect-pulse','slf-effect-gradient','slf-effect-hover','slf-effect-outline','slf-effect-neon','slf-effect-shine','slf-effect-tilt','slf-effect-soft','slf-effect-border-glow'];
 el.classList.remove(...all);
 (Array.isArray(effects)?effects:[]).forEach(name=>{const cls='slf-effect-'+name;if(all.includes(cls))el.classList.add(cls);});
}
function applyEdit(edit){
 if(!edit||edit.page!=='all'&&edit.page!==pageName()&&!(edit.page==='wiki'&&pageName().startsWith('wiki-')))return;
 let el;try{el=document.querySelector(edit.selector);}catch(_){return;}
 if(!el)return;
 remember(el);
 if(typeof edit.text==='string'&&textIsEditable(el))el.textContent=edit.text;
 if(typeof edit.src==='string'){if(el.tagName==='IMG'){if(edit.src)el.src=edit.src;else el.removeAttribute('src');}else if(edit.backgroundImage){el.style.backgroundImage=edit.src?'url("'+edit.src.replace(/["\\]/g,'')+'")':'none';if(edit.src){el.style.backgroundSize='cover';el.style.backgroundPosition='center';el.style.backgroundRepeat='no-repeat';}}}
 if(typeof edit.hidden==='boolean')el.hidden=edit.hidden;
 applyStyle(el,edit.styles);applyEffects(el,edit.effects);
}
function insertElement(item){
 if(!item||item.page!=='all'&&item.page!==pageName()&&!(item.page==='wiki'&&pageName().startsWith('wiki-'))||!item.id||document.getElementById(item.id))return;
 let host;try{host=document.querySelector(item.containerSelector);}catch(_){return;}
 if(!host)return;
 const type=['image','button','divider','card'].includes(item.type)?item.type:'text';
 const node=document.createElement(type==='image'?'img':type==='button'?'a':type==='divider'?'hr':type==='card'?'article':'div');
 node.id=item.id;node.setAttribute('data-slf-created','1');node.className='slf-created-element';
 if(type==='image'){node.src=item.src||'';node.alt=item.alt||'Gambar SLF';node.loading='lazy';node.decoding='async';node.style.maxWidth='100%';node.style.height='auto';}
 else if(type==='button'){node.href=item.href||'#';node.textContent=item.text||'Tombol';node.classList.add('btn','btn-primary');}
 else if(type==='divider'){node.style.border='0';node.style.borderTop='1px solid rgba(255,255,255,.25)';}
 else if(type==='card'){node.textContent=item.text||'Kartu informasi';node.classList.add('panel','slf-created-card');node.style.padding='18px';}
 else {node.textContent=item.text||'Teks baru';node.style.whiteSpace='pre-wrap';}
 node.style.display='block';node.style.position='relative';node.style.zIndex='2';node.style.margin='12px 0';
 applyStyle(node,item.styles);applyEffects(node,item.effects);
 host.append(node);insertedNodes.set(item.id,node);
}
function applyDesign(d){
 if(!d||typeof d!=='object')return;design=d;
 const root=document.documentElement;
 if(isColor(d.accent)){root.style.setProperty('--purple',d.accent);root.style.setProperty('--purple2',d.accent);root.style.setProperty('--accent',d.accent);}
 if(isColor(d.accent2)){root.style.setProperty('--gold',d.accent2);root.style.setProperty('--gold2',d.accent2);}if(fontMap[d.globalFont])document.body.style.fontFamily=fontMap[d.globalFont];
 (Array.isArray(d.insertedElements)?d.insertedElements:[]).forEach(insertElement);
 const edits=Array.isArray(d.elementEdits)?d.elementEdits:[];edits.filter(x=>x.page==='all').forEach(applyEdit);if(pageName().startsWith('wiki-'))edits.filter(x=>x.page==='wiki').forEach(applyEdit);edits.filter(x=>x.page===pageName()).forEach(applyEdit);
 const page=pageName();
 if(d.page&&d.page!=='all'&&d.page!==page)return;
 const hero=page==='home'?(document.querySelector('#beranda.hero')||document.querySelector('.hero')):page==='wiki'?(document.querySelector('.wiki-hero')||document.querySelector('main .hero')):(document.querySelector('main .hero')||document.querySelector('.hero'));
 const layers=Array.isArray(d.layers)?d.layers:[];
 const wall=layers.find(x=>x.id==='wallpaper'&&x.type==='image'&&x.visible!==false&&x.src);
 const overlayColor=isColor(d.overlayColor)?d.overlayColor:'#100c18';
 if(hero){
  const overlay='rgba('+parseInt(overlayColor.slice(1,3),16)+','+parseInt(overlayColor.slice(3,5),16)+','+parseInt(overlayColor.slice(5,7),16)+','+(clamp(d.overlayOpacity,0,100,65)/100)+')';
  if(wall){const src=String(wall.src).replace(/["\\]/g,'');hero.style.setProperty('background-image','linear-gradient('+overlay+','+overlay+'),url("'+src+'")','important');hero.style.setProperty('background-size','cover','important');hero.style.setProperty('background-position',clamp(wall.x,0,100,50)+'% '+clamp(wall.y,0,100,50)+'%','important');hero.style.setProperty('background-repeat','no-repeat','important');}
  else if(clamp(d.overlayOpacity,0,100,0)>0){const base=getComputedStyle(hero).backgroundImage;hero.style.setProperty('background-image','linear-gradient('+overlay+','+overlay+'), '+(base&&base!=='none'?base:'linear-gradient(#101a31,#080d19)'),'important');}
  if(isColor(d.background))hero.style.setProperty('background-color',d.background,'important');
  const texts=layers.filter(x=>x.type==='text'&&x.visible!==false&&String(x.text||'').trim());
  const images=layers.filter(x=>x.type==='image'&&x.id!=='wallpaper'&&x.visible!==false&&x.src);
  if(texts.length||images.length){
   hero.style.position='relative';hero.style.isolation='isolate';
   let canvas=hero.querySelector('.slf-published-layers');
   if(!canvas){canvas=document.createElement('div');canvas.className='slf-published-layers';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden;container-type:inline-size';hero.prepend(canvas);}
   canvas.replaceChildren();
   images.forEach(layer=>{const img=document.createElement('img');img.src=layer.src;img.alt='';img.loading='lazy';img.decoding='async';img.style.position='absolute';img.style.left=clamp(layer.x,0,100,0)+'%';img.style.top=clamp(layer.y,0,100,0)+'%';img.style.width=clamp(layer.width,5,100,30)+'%';img.style.height=clamp(layer.height,5,100,40)+'%';img.style.objectFit=layer.fit==='contain'?'contain':'cover';img.style.pointerEvents=studioMode?'auto':'none';img.style.opacity=clamp(layer.opacity,0,100,100)/100;img.style.filter='blur('+clamp(layer.blur,0,20,0)+'px)';img.style.zIndex=clamp(layer.z,1,10,2);canvas.append(img);});
   texts.forEach(layer=>{const node=document.createElement('div');node.className='slf-published-text';node.textContent=layer.text;node.style.position='absolute';node.style.left=clamp(layer.x,0,100,0)+'%';node.style.top=clamp(layer.y,0,100,0)+'%';node.style.width=clamp(layer.width,5,100,50)+'%';node.style.fontSize='clamp(16px,'+(clamp(layer.fontSize,12,120,32)/1440*100)+'cqw,120px)';node.style.color=isColor(layer.color)?layer.color:'#fff1d4';node.style.fontWeight=String(clamp(layer.weight,300,900,800));node.style.pointerEvents=studioMode?'auto':'none';node.style.textAlign=['left','center','right'].includes(layer.align)?layer.align:'left';node.style.opacity=clamp(layer.opacity,0,100,100)/100;node.style.zIndex=clamp(layer.z,1,10,3);node.style.textShadow='0 2px 14px rgba(0,0,0,.4)';node.style.lineHeight='1.08';node.style.whiteSpace='pre-wrap';canvas.append(node);});
  }
 }
}
function sendToParent(payload){if(studioMode&&window.parent!==window)window.parent.postMessage(payload,parentOrigin);}
function selectElement(el){
 if(!canSelect(el))return;
 if(selected)selected.classList.remove('slf-studio-selected');
 selected=el;selected.classList.add('slf-studio-selected');sendToParent(describe(el));
}
function addElement(data){
 if(!selected)return;
 let host=selected.closest('section,article,main,footer,.wrap,.panel,.card')||selected.parentElement||selected;
 if(host.matches('h1,h2,h3,h4,p,span,a,button,img'))host=host.parentElement||host;
 if(!host)return;
 const kind=['image','button','divider','card'].includes(data.kind)?data.kind:'text';
 let node;
 if(kind==='image'){node=document.createElement('img');node.src=data.src||'';node.alt='Gambar baru SLF';node.loading='lazy';node.decoding='async';node.style.maxWidth='100%';node.style.height='auto';}
 else if(kind==='button'){node=document.createElement('a');node.href=data.href||'#';node.textContent=data.text||'Tombol baru';node.className='btn btn-primary';}
 else if(kind==='divider'){node=document.createElement('hr');node.style.border='0';node.style.borderTop='1px solid rgba(255,255,255,.25)';node.style.width='100%';}
 else if(kind==='card'){node=document.createElement('article');node.textContent=data.text||'Kartu informasi baru';node.className='panel slf-created-card';node.style.padding='18px';}
 else {node=document.createElement('div');node.textContent='Teks baru';node.style.whiteSpace='pre-wrap';}
 const id='slf-added-'+Math.random().toString(36).slice(2,10);node.id=id;node.setAttribute('data-slf-created','1');node.classList.add('slf-created-element');node.style.display=kind==='divider'?'block':'block';node.style.position='relative';node.style.margin='12px 0';host.append(node);
 selectElement(node);sendToParent({type:'slf-studio-created',id,kind,text:node.textContent,src:data.src||'',href:kind==='button'?node.getAttribute('href'):'',containerSelector:selectorFor(host),page:pageName(),selected:describe(node)});
}
function ensureEffectStyles(){if(document.getElementById('slf-published-effects'))return;const style=document.createElement('style');style.id='slf-published-effects';style.textContent='.slf-studio-mode *{cursor:crosshair!important}.slf-studio-mode .slf-studio-selected{outline:2px solid #f3cb82!important;outline-offset:2px!important;box-shadow:0 0 0 4px rgba(243,203,130,.18)!important}.slf-effect-glass{background:rgba(255,255,255,.08)!important;backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.18)}.slf-effect-glow{filter:drop-shadow(0 0 15px rgba(126,230,246,.65))}.slf-effect-float{animation:slfFloat 4s ease-in-out infinite}.slf-effect-pulse{animation:slfPulse 2.6s ease-in-out infinite}.slf-effect-gradient{background-image:linear-gradient(115deg,rgba(126,230,246,.18),rgba(172,157,255,.18),rgba(243,203,130,.16))!important}.slf-effect-hover{transition:transform .2s,box-shadow .2s}.slf-effect-hover:hover{transform:translateY(-4px);box-shadow:0 14px 32px rgba(0,0,0,.25)}.slf-effect-outline{outline:1px solid rgba(126,230,246,.5);outline-offset:3px}@keyframes slfFloat{50%{transform:translateY(-7px)}}@keyframes slfPulse{50%{filter:brightness(1.18)}}@media(prefers-reduced-motion:reduce){.slf-effect-float,.slf-effect-pulse{animation:none!important}}';
 document.head.append(style);
}
function initStudioBridge(){
 if(!studioMode||window.parent===window)return;
 document.documentElement.classList.add('slf-studio-mode');
 studioSelect=true;
 ensureEffectStyles();
 document.querySelectorAll('.slf-published-layers > *').forEach(node=>node.style.pointerEvents='auto');
 let inlineMode=false;
 document.addEventListener('click',event=>{if(inlineMode){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();return;}if(!studioSelect)return;const el=event.target.closest('*');if(!canSelect(el))return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();selectElement(el);},true);
 document.addEventListener('dblclick',event=>{if(!inlineMode)return;const el=event.target.closest('*');if(!canSelect(el)||!textIsEditable(el))return;event.preventDefault();event.stopPropagation();selectElement(el);el.setAttribute('contenteditable','true');el.focus();const finish=()=>{el.removeAttribute('contenteditable');sendToParent({type:'slf-studio-inline-text',text:el.textContent});el.removeEventListener('blur',finish);};el.addEventListener('blur',finish);},true);
 document.addEventListener('pointerover',event=>{if(!studioSelect)return;const el=event.target.closest('*');if(canSelect(el)&&el!==selected)el.style.outline='1px dashed rgba(126,230,246,.65)';},true);
 document.addEventListener('pointerout',event=>{const el=event.target.closest('*');if(el&&el!==selected)el.style.outline='';},true);
 window.addEventListener('message',event=>{
  if(event.origin!==parentOrigin||event.source!==window.parent||!event.data)return;
  const m=event.data;
  if(m.type==='slf-studio-mode'){studioSelect=Boolean(m.enabled);}
  if(m.type==='slf-studio-inline-mode'){inlineMode=Boolean(m.enabled);studioSelect=false;}
  if(m.type==='slf-studio-select-target'&&typeof m.selector==='string'){try{const target=document.querySelector(m.selector);if(target)selectElement(target);}catch(_){}}
  if(m.type==='slf-studio-theme'){const root=document.documentElement;const t=m;if(t.globalFont&&fontMap[t.globalFont])document.body.style.fontFamily=fontMap[t.globalFont];if(isColor(t.accent)){root.style.setProperty('--purple',t.accent);root.style.setProperty('--purple2',t.accent);root.style.setProperty('--accent',t.accent);}if(isColor(t.accent2)){root.style.setProperty('--gold',t.accent2);root.style.setProperty('--gold2',t.accent2);}const hero=document.querySelector('.hero');if(hero&&(t.overlayColor||t.overlayOpacity!==undefined)){let shade=hero.querySelector(':scope > .slf-preview-overlay');if(!shade){shade=document.createElement('div');shade.className='slf-preview-overlay';shade.style.cssText='position:absolute;inset:0;z-index:0;pointer-events:none';hero.prepend(shade);hero.style.position='relative';}shade.style.backgroundColor=isColor(t.overlayColor)?t.overlayColor:'#100c18';shade.style.opacity=String(clamp(t.overlayOpacity,0,100,0)/100);}}
  if(m.type==='slf-studio-edit'&&selected){
   const edit=m.edit||{};
   remember(selected);
   if(typeof edit.text==='string'&&textIsEditable(selected)&&selected.textContent!==edit.text)selected.textContent=edit.text;
   if(typeof edit.src==='string'){if(selected.tagName==='IMG'){if(edit.src)selected.src=edit.src;else selected.removeAttribute('src');}else if(edit.backgroundImage){selected.style.backgroundImage=edit.src?'url("'+edit.src.replace(/["\\]/g,'')+'")':'none';if(edit.src){selected.style.backgroundSize='cover';selected.style.backgroundPosition='center';selected.style.backgroundRepeat='no-repeat';}}}
   if(typeof edit.hidden==='boolean')selected.hidden=edit.hidden;
   if(edit.styles)applyStyle(selected,edit.styles);
   if(edit.effects)applyEffects(selected,edit.effects);
  }
  if(m.type==='slf-studio-add')addElement(m);
  if(m.type==='slf-studio-remove'&&selected&&selected.hasAttribute('data-slf-created')){const id=selected.id;selected.remove();selected=null;sendToParent({type:'slf-studio-removed',id});}
 });
 const sendOutline=()=>{
  const nodes=[...document.querySelectorAll('main h1,main h2,main h3,main h4,main p,main section,main article,main .panel,main .card,main .zone,main button,main a,main img,header,header a,footer,footer a')].filter(canSelect);
  const seen=new Set(),items=[];
  for(const el of nodes){const selector=selectorFor(el);if(!selector||seen.has(selector))continue;seen.add(selector);const label=(el.getAttribute('aria-label')||el.getAttribute('alt')||el.textContent||el.tagName).trim().replace(/\s+/g,' ').slice(0,64)||el.tagName.toLowerCase();items.push({selector,tag:el.tagName.toLowerCase(),label});if(items.length>=100)break;}
  sendToParent({type:'slf-studio-outline',items});
 };
 sendToParent({type:'slf-studio-ready',page:pageName(),title:document.title});
 sendOutline();
 const outlineObserver=new MutationObserver(()=>{if(!outlineObserver._queued){outlineObserver._queued=true;requestAnimationFrame(()=>{outlineObserver._queued=false;sendOutline();});}});
 outlineObserver.observe(document.body,{childList:true,subtree:true});
}
async function init(){
 ensureEffectStyles();
 try{
  const response=await fetch('/api/site-design',{cache:'no-store'});
  if(response.ok){const data=await response.json();if(data.design)applyDesign(data.design);}
 }catch(_){}
 if(document.body){let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled||!design)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;(Array.isArray(design.insertedElements)?design.insertedElements:[]).forEach(insertElement);const edits=Array.isArray(design.elementEdits)?design.elementEdits:[];edits.filter(x=>x.page==='all').forEach(applyEdit);if(pageName().startsWith('wiki-'))edits.filter(x=>x.page==='wiki').forEach(applyEdit);edits.filter(x=>x.page===pageName()).forEach(applyEdit);});});observer.observe(document.body,{childList:true,subtree:true});}
 initStudioBridge();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();