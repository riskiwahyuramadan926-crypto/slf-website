import { json, fail } from '../_lib/common.js';
import { ensureWikiSchema } from '../_lib/wiki-schema.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return fail('Perpustakaan Wiki belum tersedia: binding D1 DB tidak ditemukan.',503);
  try { await ensureWikiSchema(env.DB); } catch (error) {
    console.error('[SLF_WIKI] schema initialization failed:', error?.message || error);
    return json({error:'Database Wiki gagal disiapkan.',diagnostic:String(error?.message||error).slice(0,220)},503);
  }
  const { results: categories = [] } = await env.DB.prepare(
    `SELECT c.id,c.name,c.slug,c.description,c.icon,c.sort_order,
      COUNT(a.id) AS article_count
     FROM wiki_categories c
     LEFT JOIN wiki_articles a ON a.category_id=c.id AND a.status='published'
     WHERE c.active=1
     GROUP BY c.id
     ORDER BY c.sort_order ASC,c.name COLLATE NOCASE ASC`
  ).all();
  const { results: articles = [] } = await env.DB.prepare(
    `SELECT a.id,a.category_id,a.title,a.slug,a.summary,a.content,a.legacy_url,a.icon,a.sort_order,
      c.name AS category_name,c.slug AS category_slug
     FROM wiki_articles a
     INNER JOIN wiki_categories c ON c.id=a.category_id
     WHERE a.status='published' AND c.active=1
     ORDER BY c.sort_order ASC,a.sort_order ASC,a.title COLLATE NOCASE ASC`
  ).all();
  return json({categories,articles,generatedAt:new Date().toISOString()});
}
