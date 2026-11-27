import { json, fail, requireAdmin, buildOrderLinks, buildWhatsAppUrl } from '../../_lib/common.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return fail('Akses admin ditolak. Periksa ADMIN_SECRET.', 401);
  if (!env.DB) return fail('Database belum tersambung.', 503);

  try {
    const { results = [] } = await env.DB.prepare(
      'SELECT t.id, t.order_id, t.minecraft_name, t.product_name, t.season_id, t.status, t.created_at, t.updated_at, t.submitted_at, t.completed_at, o.status AS order_status, o.whatsapp, o.total, o.access_key_hash, o.access_key_encrypted, o.product_id FROM reentry_tickets t JOIN orders o ON o.id = t.order_id ORDER BY t.created_at DESC'
    ).all();

    const linksByOrder = new Map();
    const getLinks = order => {
      if (!linksByOrder.has(order.order_id)) {
        linksByOrder.set(order.order_id, buildOrderLinks(env.DB, {
          id: order.order_id,
          product_id: order.product_id,
          access_key_hash: order.access_key_hash,
          access_key_encrypted: order.access_key_encrypted
        }, new URL(request.url).origin, env).catch(error => {
          console.error('Admin ticket link generation failed for order ' + order.order_id + ':', error?.message || error);
          return { ticket_link: '', ticket_links: [], review_link: '', link_error: String(error?.message || error).slice(0, 240) };
        }));
      }
      return linksByOrder.get(order.order_id);
    };

    const tickets = await Promise.all(results.map(async ticket => {
      const links = await getLinks(ticket);
      const ticketLink = links.ticket_links.find(item => item.id === String(ticket.id))?.url || '';
      const acceptanceMessage = 'Halo ' + ticket.minecraft_name + ', pengajuan tiket ' + ticket.id + ' kamu sudah kami terima!\nHarap segera login sekarang dan tunggu di lobby, lalu nantikan instruksi selanjutnya dari Admin.\nLink tiket pribadi:\n' + ticketLink;
      const reviewMessage = 'Halo ' + ticket.minecraft_name + ', penggunaan tiket ' + ticket.id + ' telah selesai diproses. Selamat bermain kembali!\nJangan lupa berikan ulasan layanan kami di sini:\n' + links.review_link;
      const needsAcceptanceFallback = ticket.status === 'PENDING' || (ticket.status === 'ACTIVE' && Boolean(ticket.submitted_at));
      return {
        id: ticket.id,
        order_id: ticket.order_id,
        minecraft_name: ticket.minecraft_name,
        product_name: ticket.product_name,
        season_id: ticket.season_id,
        status: ticket.status,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        submitted_at: ticket.submitted_at,
        completed_at: ticket.completed_at,
        order_status: ticket.order_status,
        whatsapp: ticket.whatsapp,
        total: ticket.total,
        ticket_link: ticketLink,
        review_link: links.review_link,
        accept_whatsapp_url: needsAcceptanceFallback && ticketLink ? buildWhatsAppUrl(ticket.whatsapp, acceptanceMessage) : '',
        review_whatsapp_url: ticket.status === 'COMPLETED' && links.review_link ? buildWhatsAppUrl(ticket.whatsapp, reviewMessage) : '',
        link_error: links.link_error || ''
      };
    }));

    return json({ tickets, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Admin ticket links could not be generated:', error?.message || error);
    return fail('Data tiket gagal dimuat karena tautan pribadi belum dapat disiapkan: ' + String(error?.message || error), 503);
  }
}
