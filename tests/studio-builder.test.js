import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildStudioCreateTableSql, normalizeStudioLayers, normalizeStudioRoute, normalizeStudioSubmission, normalizeStudioTableDefinition } from '../functions/_lib/studio-builder.js';
test('custom route accepts a clean slug and blocks reserved routes',()=>{
 assert.equal(normalizeStudioRoute('/Event/'),'/event');assert.equal(normalizeStudioRoute('/event-season-one'),'/event-season-one');
 assert.throws(()=>normalizeStudioRoute('/api'),/jalur khusus/);assert.throws(()=>normalizeStudioRoute('/event/../admin'),/satu segmen/);assert.throws(()=>normalizeStudioRoute('//evil.test'),/satu segmen/);
});
test('backend table schema is namespaced and SQL identifiers use a strict allowlist',()=>{
 const schema=normalizeStudioTableDefinition({slug:'event-signups',columns:[{name:'player_name',type:'text',required:true}]});
 assert.equal(schema.tableName,'studio_event_signups');assert.match(buildStudioCreateTableSql(schema),/^CREATE TABLE "studio_event_signups"/);
 assert.throws(()=>normalizeStudioTableDefinition({slug:'orders',columns:[{name:'id',type:'text'}]}),/Nama kolom tidak valid/);
 assert.throws(()=>normalizeStudioTableDefinition({slug:'events',columns:[{name:'name',type:'text); DROP TABLE orders;--'}]}),/Tipe kolom tidak didukung/);
});
test('public submissions validate required keys and normalize typed values',()=>{
 const schema={slug:'event',columns:[{name:'player_name',type:'text',required:true},{name:'age',type:'integer'}]};
 assert.deepEqual(normalizeStudioSubmission(schema,{player_name:'Ryu',age:'16'}),{names:['player_name','age'],values:['Ryu',16]});
 assert.throws(()=>normalizeStudioSubmission(schema,{age:16}),/wajib diisi/);assert.throws(()=>normalizeStudioSubmission(schema,{player_name:'Ryu',is_admin:true}),/tidak diizinkan/);
});
test('published page layers validate input, media URLs and backend target namespace',()=>{
 assert.equal(normalizeStudioLayers([{id:'one',type:'button',action:{type:'javascript',target:'alert(1)'}}])[0].action.type,'none');
 assert.throws(()=>normalizeStudioLayers([{id:'one',type:'image',src:'javascript:alert(1)'}]),/URL gambar/);
 assert.throws(()=>normalizeStudioLayers([{id:'btn',type:'button',action:{type:'backend-submit',target:'orders'}}]),/studio_/);
 assert.equal(normalizeStudioLayers([{id:'one',type:'input',fieldName:'player_name',content:'Nama'}])[0].type,'input');
});
test('account login binds role once and uses secure password/session primitives',async()=>{
 const account=await readFile(new URL('../functions/api/admin/account.js',import.meta.url),'utf8');
 assert.match(account,/resolveAdminSecrets/);assert.match(account,/role==='owner'/);assert.match(account,/iterations:310000/);
 assert.match(account,/HttpOnly; Secure; SameSite=Lax/);assert.match(account,/emailOk/);
});
test('soft-deleted transactions are Owner guarded and omitted from reports',async()=>{
 const orders=await readFile(new URL('../functions/api/admin/orders.js',import.meta.url),'utf8');
 const finance=await readFile(new URL('../functions/api/admin/finance.js',import.meta.url),'utf8');
 const reports=await readFile(new URL('../functions/api/admin/reports.js',import.meta.url),'utf8');
 assert.match(orders,/requireOwner\(request,env\)/);assert.match(orders,/deleted_at IS NULL/);
 assert.match(finance,/requireOwner\(request, env\)/);assert.match(finance,/deleted_at IS NULL/);
 assert.match(reports,/requireOwner\(request, env\)/);assert.match(reports,/deleted_at IS NULL/);
});
test('Studio pages and backend table creation both enforce Owner authorization',async()=>{
 const pages=await readFile(new URL('../functions/api/admin/studio/pages.js',import.meta.url),'utf8');
 const backend=await readFile(new URL('../functions/api/admin/studio/backend.js',import.meta.url),'utf8');
 assert.match(pages,/requireOwner/);assert.match(backend,/requireOwner/);
});
