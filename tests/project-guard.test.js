import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) result.push(full);
  }
  return result;
}

test('Cloudflare Pages keeps the expected output directory and D1 binding', async () => {
  const config = await read('wrangler.toml');
  assert.match(config, /^pages_build_output_dir\s*=\s*"\."/m);
  assert.match(config, /^binding\s*=\s*"DB"$/m);
  assert.match(config, /^database_name\s*=\s*"slf-store-db"$/m);
  assert.match(config, /^database_id\s*=\s*"[a-f0-9-]{36}"$/m);
});

test('D1 schema helpers use repeatable, non-destructive migrations', async () => {
  for (const file of [
    'functions/_lib/store-schema.js',
    'functions/_lib/wiki-schema.js',
    'functions/_lib/announcement-schema.js'
  ]) {
    const source = await read(file);
    assert.match(source, /CREATE TABLE IF NOT EXISTS/i, file + ' must create missing tables safely');
    assert.doesNotMatch(source, /DROP\s+TABLE/i, file + ' must not drop stored tables');
  }
});

test('public health diagnostics never return the actual secret values', async () => {
  const source = await read('functions/api/health.js');
  assert.match(source, /ownerSecretConfigured/);
  assert.match(source, /adminSecretConfigured/);
  assert.match(source, /ticketLinkSecretConfigured/);
  assert.doesNotMatch(source, /ownerSecret\s*:/);
  assert.doesNotMatch(source, /adminSecret\s*:/);
  assert.doesNotMatch(source, /ticketLinkSecret\s*:/);
});

test('sensitive Admin APIs enforce roles on the server', async () => {
  const wiki = await read('functions/api/admin/wiki.js');
  const announcements = await read('functions/api/admin/announcements.js');
  const orders = await read('functions/api/admin/orders.js');
  const media = await read('functions/api/admin/media.js');
  assert.match(wiki, /requireOwner\(request,\s*env\)/);
  assert.match(announcements, /requireAdmin\(request,\s*env\)/);
  assert.match(orders, /requireAdmin\(request,\s*env\)/);
  assert.match(media, /requireOwner\(request,\s*env\)/);
});

test('local secret files are ignored and the example contains no values', async () => {
  const ignore = await read('.gitignore');
  const example = await read('.dev.vars.example');
  assert.match(ignore, /^\.dev\.vars$/m);
  assert.match(ignore, /^\.dev\.vars\.\*$/m);
  assert.match(ignore, /^!\.dev\.vars\.example$/m);
  assert.match(ignore, /^\.env$/m);
  const assignments = example.split(/\r?\n/).filter(line => /^[A-Z][A-Z0-9_]*=/.test(line));
  assert.ok(assignments.length >= 3, 'example must list required secret names');
  assert.ok(assignments.every(line => line.endsWith('=')), 'example values must remain empty');
});

test('all application JavaScript files pass Node syntax checking', async () => {
  const roots = ['assets/js', 'functions', 'tests'];
  const files = [];
  for (const directory of roots) files.push(...await walk(path.join(root, directory)));
  assert.ok(files.length > 0, 'JavaScript source files should be discovered');
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, path.relative(root, file) + '\n' + (result.stderr || result.stdout));
  }
});
