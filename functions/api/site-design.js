import { json } from '../_lib/common.js';
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ design: null });
  const row = await env.DB.prepare("SELECT config_json,updated_at FROM site_design WHERE id='default'").first();
  if (!row) return json({ design: null });
  try { return json({ design: JSON.parse(row.config_json), updatedAt: row.updated_at }); }
  catch (_) { return json({ design: null, error: 'Konfigurasi visual tidak valid.' }, 500); }
}