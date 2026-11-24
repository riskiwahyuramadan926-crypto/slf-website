import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

class Element {
  constructor(id='') {
    this.id=id; this.children=[]; this.dataset={}; this.listeners={}; this.className='';
    this.classList={add(){},remove(){},toggle(){},contains(){return false;}};
    this.style={setProperty(){}}; this.hidden=false; this.value=''; this.textContent='';
    this.disabled=false; this.files=[]; this.parentElement=null; this.contentWindow={};
  }
  append(...nodes){ for(const node of nodes){node.parentElement=this;this.children.push(node);} }
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  querySelector(){return new Element('child');}
  querySelectorAll(){return [];}
  closest(){return null;}
  focus(){}
  click(){for(const fn of this.listeners.click||[])fn({target:this});if(this.onclick)this.onclick({target:this});}
}
test('SLF Mobile beranda dan login tetap hidup tanpa menunggu pemeriksaan sesi', async()=>{
  const source=await readFile(new URL('../app/app.js',import.meta.url),'utf8');
  const elements=new Map();
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  let domReady;
  const document={
    getElementById:get,
    createElement:tag=>new Element(tag),
    querySelectorAll:()=>[],
    addEventListener:(name,fn)=>{if(name==='DOMContentLoaded')domReady=fn;}
  };
  const window={addEventListener(){},location:{},};
  const context={
    document,window,navigator:{onLine:true},console:{warn(){},error(){},log(){}},
    fetch:async()=>({ok:true,status:200,json:async()=>({role:'admin'})}),
    sessionStorage:{setItem(){},removeItem(){}},
    setTimeout,clearTimeout,Promise,Map,Set,URL,Date,Math,JSON,Number,String,Boolean,Array,Object,RegExp,Error,
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},performance:{now:()=>0},
    location:{hash:''},history:{replaceState(){}},confirm:()=>true
  };
  vm.runInNewContext(source,context,{filename:'app.js'});
  assert.equal(typeof domReady,'function','DOMContentLoaded handler registered');
  domReady();
  assert.equal(get('menuGroups').children.length,2,'both Admin Tools menu groups render synchronously');
  const cards=get('menuGroups').children.flatMap(group=>group.children.filter(child=>child.className.includes('module-grid')).flatMap(grid=>grid.children));
  assert.equal(cards.length,16,'all 16 Admin Tools cards render before session fetch completes');
  assert.equal(typeof get('loginButton').listeners.click?.[0],'function','login button handler is attached immediately');
  get('loginButton').click();
  assert.equal(get('loginModal').hidden,false,'login button opens the login modal');
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(get('roleLabel').textContent,/Admin/,'session result updates the home role label');
  assert.equal(get('connectionState').textContent,'Terhubung','session status resolves independently of Studio init');
});
