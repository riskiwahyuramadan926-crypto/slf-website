import { json, fail } from '../_lib/common.js';
import { ensureWikiSchema } from '../_lib/wiki-schema.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return fail('Perpustakaan Wiki belum tersedia: binding D1 DB tidak ditemukan.',503);
  try { await ensureWikiSchema(env.DB); } catch (error) {
    console.error('[SLF_WIKI] schema initialization failed:', error?.message || error);
    return json({error:'Database Wiki gagal disiapkan.',diagnostic:String(error?.message||error).slice(0,220)},503);
  }

  const {results:books=[]}=await env.DB.prepare(`
    SELECT b.id,b.name,b.slug,b.description,b.icon,b.sort_order,
      COUNT(c.id) AS chapter_count
    FROM wiki_books b
    LEFT JOIN wiki_chapters c ON c.book_id=b.id AND c.status='published'
    WHERE b.active=1
    GROUP BY b.id
    ORDER BY b.sort_order ASC,b.name COLLATE NOCASE ASC
  `).all();

  const {results:chapters=[]}=await env.DB.prepare(`
    SELECT c.id,c.book_id,c.title,c.slug,c.summary,c.content,c.legacy_url,c.icon,c.sort_order,
      b.name AS book_name,b.slug AS book_slug
    FROM wiki_chapters c
    INNER JOIN wiki_books b ON b.id=c.book_id
    WHERE c.status='published' AND b.active=1
    ORDER BY b.sort_order ASC,c.sort_order ASC,c.title COLLATE NOCASE ASC
  `).all();

  // Compatibility aliases keep any older public components from breaking during rollout.
  const categories=books.map(b=>({...b,article_count:b.chapter_count}));
  const articles=chapters.map(c=>({...c,category_id:c.book_id,category_name:c.book_name,category_slug:c.book_slug}));
  return json({books,chapters,categories,articles,generatedAt:new Date().toISOString()});
}
