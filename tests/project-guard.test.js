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

test('UI UX Pro Max guidance is persisted and required for SLF pages', async () => {
  const master = await read('design-system/survival-legacy-frontier/MASTER.md');
  const agents = await read('AGENTS.md');
  const readme = await read('README.md');
  assert.match(master, /Dark Mode \(OLED\)/);
  assert.match(master, /Accessibility requirements/);
  assert.match(master, /Performance and implementation/);
  assert.match(agents, /design-system\/survival-legacy-frontier\/MASTER\.md/);
  assert.match(agents, /ui-ux-pro-max\/SKILL\.md/);
  for (const page of ['home','store','wiki','admin']) {
    const override = await read(`design-system/survival-legacy-frontier/pages/${page}.md`);
    assert.match(override, /MASTER\.md/);
  }
  assert.match(readme, /uipro init --ai codex/);
});

test('Wiki uses explicit Books and Chapters with a one-time non-destructive legacy migration', async () => {
  const schema = await read('functions/_lib/wiki-schema.js');
  const publicApi = await read('functions/api/wiki.js');
  const adminApi = await read('functions/api/admin/wiki.js');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS wiki_books/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS wiki_chapters/i);
  assert.match(schema, /wiki_migrations/);
  assert.match(schema, /INSERT OR IGNORE INTO wiki_chapters/i);
  assert.doesNotMatch(schema, /DROP\s+TABLE/i);
  assert.match(publicApi, /wiki_books/);
  assert.match(publicApi, /wiki_chapters/);
  assert.match(adminApi, /requireOwner\(request,\s*env\)/);
  assert.match(adminApi, /wiki_books/);
  assert.match(adminApi, /wiki_chapters/);
});

test('Wiki editor supports safe Markdown preview, tables, image URLs, and protected uploads', async () => {
  const renderer = await read('assets/js/wiki-markdown.js');
  const reader = await read('assets/js/wiki-library.js');
  const editor = await read('assets/js/wiki-admin.js');
  const adminPage = await read('admin/index.html');
  const adminApi = await read('functions/api/admin/media.js');
  assert.match(renderer, /function safeUrl/);
  assert.match(renderer, /wiki-table-wrap/);
  assert.match(renderer, /loading="lazy"/);
  assert.match(renderer, /escapeHtml/);
  assert.match(reader, /wiki-chapter-toc/);
  assert.ok(editor.includes("api()('/api/admin/media'"));
  assert.match(adminPage, /wiki-article-preview/);
  assert.match(adminPage, /wiki-upload-image/);
  assert.match(adminApi, /requireOwner\(request,env\)/);
});

test('Store order and all re-entry tickets are persisted atomically', async () => {
  const order = await read('functions/api/orders/create.js');
  const schema = await read('functions/_lib/store-schema.js');
  assert.match(order, /ensureStoreSchema\(env\.DB\)/);
  assert.match(order, /env\.DB\.batch\(statements\)/);
  assert.match(order, /Order creation failed at /);
  assert.match(schema, /site_content:\s*\{[\s\S]*?image_url:\s*'TEXT'/);
});

test('Homepage no longer renders the inspiration section', async () => {
  const home = await read('index.html');
  assert.doesNotMatch(home, /inspiration-section|Empat gaya RPG/);
});

test('Obsolete Android Admin source and APK workflow are removed without removing web Admin', async () => {
  const admin = await read('admin/index.html');
  assert.match(admin, /wiki-manager-tab/);
  await assert.rejects(read('android-admin/README.md'));
  await assert.rejects(read('.github/workflows/android-admin-build.yml'));
});


test('Admin mobile payment flow persists PAID before optional links and opens WhatsApp without blank popups', async () => {
  const common = await read('functions/_lib/common.js');
  const orders = await read('functions/api/admin/orders.js');
  const payment = await read('functions/api/admin/verify-payment.js');
  const complete = await read('functions/api/admin/complete.js');
  const ticketStatus = await read('functions/api/admin/ticket-status.js');
  const admin = await read('assets/js/admin.js');
  const adminHtml = await read('admin/index.html');
  const schema = await read('functions/_lib/store-schema.js');

  const ticketSecretResolver = common.slice(
    common.indexOf('export function resolveTicketLinkSecret'),
    common.indexOf('export function randomHex')
  );
  assert.match(ticketSecretResolver, /TIKET_LINK_SRCRET/);
  assert.match(ticketSecretResolver, /derivationAvailable/);
  assert.match(common, /sha256Hex\('slf-ticket-subkey-v1:' \+ master\.value\)/);
  assert.match(common, /export async function getTicketLinkSecret/);
  assert.doesNotMatch(common, /slf-default-fallback-ticket-secret-key/);

  assert.match(schema, /access_key_encrypted:\s*'TEXT'/);
  assert.match(schema, /reentry_tickets:\s*\{[\s\S]*?submitted_at:\s*'TEXT'/);

  assert.match(orders, /ticket_link:\s*''/);
  assert.match(orders, /review_link:\s*''/);
  assert.match(orders, /link_error:/);
  assert.match(orders, /return json\(\{ orders, stats/);

  const paymentWrite = payment.indexOf("UPDATE orders SET status='PAID'");
  const paymentLinkBuild = payment.indexOf('await buildOrderLinks');
  assert.ok(paymentWrite >= 0 && paymentLinkBuild > paymentWrite, 'PAID must be persisted before creating secure links');
  const ticketLimitCheck = payment.indexOf("SELECT season_id, COUNT(*) AS total FROM reentry_tickets");
  assert.ok(ticketLimitCheck > paymentWrite, 'ticket cap validation must run only after PAID is persisted');
  assert.doesNotMatch(payment.slice(0, paymentWrite), /season_id|reentry_tickets/, 'ticket data must not veto the PAID update');
  assert.match(payment, /status:\s*order\.status/);
  assert.match(payment, /link_error:\s*linkError/);
  assert.match(payment, /whatsapp_url:\s*whatsappUrl/);
  assert.match(payment, /https:\/\/wa\.me\/\?text=/, 'missing phone must still return a WhatsApp recipient-picker URL');
  assert.match(payment, /return json\(/);

  const completionWrite = complete.indexOf("UPDATE orders SET status='COMPLETED'");
  const completionLinkBuild = complete.indexOf('await buildOrderReviewLink');
  assert.ok(completionWrite >= 0 && completionLinkBuild > completionWrite, 'COMPLETED must be persisted before creating review links');
  assert.match(complete, /link_error:\s*linkError/);
  assert.match(complete, /return json\(/);

  const acceptWrite = ticketStatus.indexOf("UPDATE reentry_tickets SET status='ACTIVE'");
  const acceptLinkBuild = ticketStatus.indexOf('await buildOrderLinks');
  const completeWrite = ticketStatus.indexOf("UPDATE reentry_tickets SET status='COMPLETED'");
  assert.ok(acceptWrite >= 0 && acceptLinkBuild > acceptWrite, 'ACCEPTED must be persisted before creating ticket links');
  assert.ok(completeWrite > acceptLinkBuild, 'ticket completion state update must remain present');
  assert.match(ticketStatus, /link_error:\s*linkError/);

  assert.doesNotMatch(admin, /about:blank|openWhatsAppTab|closeWhatsAppTab/);
  assert.match(admin, /window\.location\.href=url/);
  assert.match(admin, /window\.alert\('Detail error: '\+detail\)/);
  assert.match(admin, /function applyOrderActionResult/);
  assert.match(admin, /HTTP '\+res\.status/);
  assert.match(admin, /Konfirmasi pembayaran gagal:/);
  assert.match(adminHtml, /admin\.js\?v=20261128-review-split1/);
})

test('Purchase and ticket-service reviews use independent one-time D1 slots', async () => {
  const schema = await read('functions/_lib/store-schema.js');
  const sqlSchema = await read('schema.sql');
  const common = await read('functions/_lib/common.js');
  const complete = await read('functions/api/admin/complete.js');
  const ticketStatus = await read('functions/api/admin/ticket-status.js');
  const reviews = await read('functions/api/reviews.js');
  const orderApi = await read('functions/api/orders/[id].js');
  const adminReviews = await read('functions/api/admin/reviews.js');
  const reviewPage = await read('assets/js/review.js');
  const reviewHtml = await read('store/review.html');
  const catalog = await read('store/index.html');
  const catalogJs = await read('assets/js/store.js');
  const adminJs = await read('assets/js/admin.js');

  assert.match(schema, /CREATE TABLE IF NOT EXISTS ticket_reviews/);
  assert.match(schema, /review_key_hash TEXT/);
  assert.match(schema, /review_key_encrypted TEXT/);
  assert.match(schema, /ticket_reviews: \{ ticket_id:/);
  assert.match(schema, /review_key_hash: 'TEXT'/);
  assert.match(sqlSchema, /CREATE TABLE IF NOT EXISTS ticket_reviews/);
  assert.match(sqlSchema, /review_key_encrypted TEXT/);

  assert.match(common, /export async function buildOrderReviewLink/);
  const ensureKey = common.slice(common.indexOf('export async function ensureOrderAccessKey'), common.indexOf('export async function buildOrderReviewLink'));
  assert.doesNotMatch(ensureKey, /reentry_tickets|TICKET_LINK_SECRET/, 'purchase review key must not depend on ticket rows or ticket secret');

  assert.match(complete, /buildOrderReviewLink/);
  assert.match(complete, /review_link: reviewLink/);
  assert.doesNotMatch(complete, /buildOrderLinks/);
  assert.match(ticketStatus, /ensureTicketReviewLink/);
  assert.match(ticketStatus, /review_key_hash/);
  assert.match(ticketStatus, /ticket_review_link: ticketReviewLink/);
  assert.doesNotMatch(ticketStatus.slice(ticketStatus.indexOf("if (status === 'COMPLETED'")), /buildOrderReviewLink|buildOrderLinks/);

  assert.match(orderApi, /if \(row\.status === 'COMPLETED' && !row\.rated_at\)/);
  assert.doesNotMatch(orderApi.slice(orderApi.indexOf("if (row.status === 'COMPLETED' && !row.rated_at)")), /completedTicket/);

  assert.match(reviews, /INSERT INTO ticket_reviews/);
  assert.match(reviews, /INSERT INTO reviews/);
  assert.match(reviews, /Boolean\(orderId\) === Boolean\(ticketId\)/);
  assert.match(reviews, /typeof data\.comment === 'string' \? data\.comment\.trim\(\)/);
  assert.match(reviews, /UNION ALL/);
  assert.match(reviews, /hasMore:/);
  assert.match(adminReviews, /ticket_reviews/);
  assert.match(adminReviews, /review_type/);

  assert.match(reviewPage, /params\.get\('ticket'\)/);
  assert.match(reviewPage, /payload\.ticketId=ticketId/);
  assert.match(reviewPage, /payload\.orderId=id/);
  assert.doesNotMatch(reviewHtml, /maxlength=/);

  assert.match(catalog, /id="review-average"/);
  assert.match(catalog, /id="review-distribution"/);
  assert.match(catalog, /id="reviews-more"/);
  assert.match(catalogJs, /limit=6/);
  assert.match(catalogJs, /Lihat selengkapnya/);
  assert.match(catalogJs, /Lebih sedikit/);
  assert.match(catalogJs, /reviewType==='ticket_service'/);
  assert.match(adminJs, /ticket_review_link/);
});
;
