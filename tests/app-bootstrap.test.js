import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

class Element {
  constructor(id='') {
    this.id=id;this.children=[];this.dataset={};this.listeners={};this.className='';
    this.classList={add(){},remove(){},toggle(){},contains(){return false;}};
    this.hidden=true;this.textContent='';this.onclick=null;this.parentElement=null;
  }
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  querySelector(selector){const key=selector==='b'?'b':'small';return this[key]??=(new Element(key));}
  click(){for(const fn of this.listeners.click||[])fn({target:this});if(this.onclick)this.onclick({target:this});}
  focus(){}
}
test('SLF Mobile renders all 16 menus and opens login before session completion',async()=>{
  const source=await readFile(new URL('../app/app.js',import.meta.url),'utf8');
  const section=(from,to)=>{const i=source.indexOf(from);const j=source.indexOf(to,i);assert.ok(i>=0&&j>i,'source section exists: '+from);return source.slice(i,j).trim();};
  const groups=section('const ADMIN_GROUPS=','\n];')+'\n];';
  const render=section('function renderHome(){','\nfunction openAdminMenu');
  const bind=section('function bindHomeAuth(){','\nasync function checkSession');
  const check=section('async function checkSession(){','\nfunction start');
  const start=section('function start(){','\ndocument.addEventListener');
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  const context={
    document:{getElementById:get,createElement:tag=>new Element(tag)},
    window:{addEventListener(){}},navigator:{onLine:true},console:{warn(){},error(){}},
    sessionStorage:{setItem(){},removeItem(){}},setTimeout,clearTimeout,Promise,Map,Set,Date,Math,JSON,
    SECRET_KEY:'test-session',role:'',auth:async()=>({role:'admin'}),
    openLogin:()=>{get('loginModal').hidden=false;},closeLogin:()=>{get('loginModal').hidden=true;},
    login(){},openAdminMenu(){},initStudio:async()=>{throw new Error('simulated Studio failure');}
  };
  context.$=get;
  vm.runInNewContext([groups,render,bind,check,start].join('\n'),context);
  context.start();
  assert.equal(get('menuGroups').children.length,2,'two menu groups are rendered synchronously');
  const cards=get('menuGroups').children.flatMap(group=>group.children.filter(child=>child.className.includes('module-grid')).flatMap(grid=>grid.children));
  assert.equal(cards.length,16,'all 16 Admin Tools cards are present');
  get('loginButton').click();
  assert.equal(get('loginModal').hidden,false,'login modal opens immediately');
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(get('roleLabel').textContent,/Admin/,'session role appears after verification');
  assert.equal(get('connectionState').textContent,'Terhubung','session status completes independently');
});
