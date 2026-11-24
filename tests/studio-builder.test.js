import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildStudioCreateTableSql, getStudioScope, normalizeStudioLayers, normalizeStudioRoute, normalizeStudioSubmission, normalizeStudioTableDefinition } from '../functions/_lib/studio-builder.js';

test('custom route accepts a clean slug and blocks reserved routes',()=>{
 assert.equal(normalizeStudioRoute('/Event/'),'/event');assert.equal(normalizeStudioRoute('/event-season-one'),'/event-season-one');
 assert.throws(()=>normalizeStudioRoute('/api'),/jalur khusus/);assert.throws(()=>normalizeStudioRoute('/event/../admin'),/satu segmen/);assert.throws(()=>normalizeStudioRoute('//evil.test'),/satu segmen/);
});
test('production and preview hosts resolve to isolated Studio namespaces',()=>{
 assert.equal(getStudioScope(new Request('https://legacy-frontier.web.id/event')).pagesTable,'studio_pages');
 const preview=getStudioScope(new Request('https://a841965a.slf-website.pages.dev/event'));
 assert.equal(preview.environment,'preview');assert.equal(preview.pagesTable,'studio_preview_pages');assert.equal(preview.tablePrefix,'studio_preview_');
 assert.equal(getStudioScope(new Request('https://example.invalid/event')),null);
});
test('backend table schema is namespaced and SQL identifiers use a strict allowlist',()=>{
 const schema=normalizeStudioTableDefinition({slug:'event-signups',columns:[{name:'player_name',type:'text',required:true}]});
 assert.equal(schema.tableName,'studio_event_signups');assert.equal(schema.allowPublicWrite,false,'public writes are disabled by default');assert.match(buildStudioCreateTableSql(schema),/^CREATE TABLE "studio_event_signups"/);
 const preview=normalizeStudioTableDefinition({slug:'event-signups',columns:[{name:'player_name',type:'text',required:true}]},'studio_preview_');
 assert.equal(preview.tableName,'studio_preview_event_signups');assert.match(buildStudioCreateTableSql(preview),/^CREATE TABLE "studio_preview_event_signups"/);
 assert.equal(normalizeStudioTableDefinition({slug:'public_form',columns:[{name:'value'}],allowPublicWrite:true}).allowPublicWrite,true);
 assert.throws(()=>normalizeStudioTableDefinition({slug:'orders',columns:[{name:'id',type:'text'}]}),/Nama kolom tidak valid/);
 assert.throws(()=>normalizeStudioTableDefinition({slug:'events',columns:[{name:'name',type:'text); DROP TABLE orders;--'}]}),/Tipe kolom tidak didukung/);
});
test('public submissions validate required keys and normalize typed values in both namespaces',()=>{
 const schema={slug:'event',columns:[{name:'player_name',type:'text',required:true},{name:'age',type:'integer'}]};
 assert.deepEqual(normalizeStudioSubmission(schema,{player_name:'Ryu',age:'16'}),{names:['player_name','age'],values:['Ryu',16]});
 assert.throws(()=>normalizeStudioSubmission(schema,{age:16}),/wajib diisi/);assert.throws(()=>normalizeStudioSubmission(schema,{player_name:'Ryu',is_admin:true}),/tidak diizinkan/);
 const preview={...normalizeStudioTableDefinition({slug:'event',columns:[{name:'player_name',type:'text',required:true}]},'studio_preview_')};
 assert.deepEqual(normalizeStudioSubmission(preview,{player_name:'Player'}),{names:['player_name'],values:['Player']});
});
test('published page layers validate input, media URLs and environment-specific backend target',()=>{
 assert.equal(normalizeStudioLayers([{id:'one',type:'button',action:{type:'javascript',target:'alert(1)'}}])[0].action.type,'none');
 assert.throws(()=>normalizeStudioLayers([{id:'one',type:'image',src:'javascript:alert(1)'}]),/URL gambar/);
 assert.throws(()=>normalizeStudioLayers([{id:'btn',type:'button',action:{type:'backend-submit',target:'orders'}}]),/studio_/);
 assert.throws(()=>normalizeStudioLayers([{id:'btn',type:'button',action:{type:'backend-submit',target:'studio_preview_signups'}}]),/studio_/);
 assert.equal(normalizeStudioLayers([{id:'btn',type:'button',action:{type:'backend-submit',target:'studio_preview_signups'}}],'studio_preview_')[0].action.target,'studio_preview_signups');
 assert.equal(normalizeStudioLayers([{id:'one',type:'input',fieldName:'player_name',content:'Nama'}])[0].type,'input');
});
test('page renderer shares the same route renderer for root and catch-all routes',async()=>{
 const root=await readFile(new URL('../functions/[slug].js',import.meta.url),'utf8');
 const catchall=await readFile(new URL('../functions/[[catchall]].js',import.meta.url),'utf8');
 const renderer=await readFile(new URL('../functions/_lib/studio-page-response.js',import.meta.url),'utf8');
 assert.match(root,/renderStudioPageRoute/);assert.match(catchall,/renderStudioPageRoute/);
 assert.match(renderer,/normalizeStudioLayers\(rawLayers,scope\.tablePrefix\)/);
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
test('Studio pages and backend table creation both enforce Owner authorization and scoped table namespaces',async()=>{
 const pages=await readFile(new URL('../functions/api/admin/studio/pages.js',import.meta.url),'utf8');
 const backend=await readFile(new URL('../functions/api/admin/studio/backend.js',import.meta.url),'utf8');
 const data=await readFile(new URL('../functions/api/studio/data.js',import.meta.url),'utf8');
 assert.match(pages,/requireOwner/);assert.match(backend,/requireOwner/);
 assert.match(pages,/getStudioScope/);assert.match(backend,/scope\.tablePrefix/);
 assert.match(data,/scope\.backendTablesTable/);assert.match(data,/scope\.rateLimitTable/);
});
