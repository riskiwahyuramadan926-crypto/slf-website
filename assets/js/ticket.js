(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  const key = params.get('key') || '';
  const cfg = window.SLF_STORE_CONFIG || {};
  const labels = {
    WAITING_PAYMENT: ['Menunggu transaksi selesai', 'Tiket sudah dibuat, tetapi belum aktif. Selesaikan pembayaran dan tunggu admin menandai transaksi selesai.', ''],
    ACTIVE: ['Tiket aktif', 'Tiket siap diajukan. Tekan tombol di bawah jika kamu benar-benar ingin meminta re-entry.', 'paid'],
    PENDING: ['Pending · menunggu admin', 'Pengajuan sudah dikirim. Hubungi admin melalui WhatsApp jika perlu menambahkan informasi.', ''],
    COMPLETED: ['Selesai · tiket terpakai', 'Admin sudah menandai proses re-entry selesai. Tiket ini tidak dapat diajukan lagi.', 'completed'],
    CANCELLED: ['Tiket dibatalkan', 'Tiket ini dibatalkan karena transaksi tidak dilanjutkan. Hubungi admin jika menurutmu ini keliru.', 'expired']
  };
  let current = null;
  $('year').textContent = new Date().getFullYear();
  if (!id || key.length < 32) { fail('Tautan tiket tidak lengkap atau tidak valid. Buka tautan pribadi dari halaman status pesanan.'); return; }

  async function refresh() {
    try {
      const response = await fetch('/api/tickets/' + encodeURIComponent(id) + '?key=' + encodeURIComponent(key), { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Tiket tidak dapat dibuka.');
      current = data.ticket;
      render();
    } catch (error) { fail(error.message || 'Koneksi gagal.'); }
  }
  function render() {
    if (!current) return;
    const label = labels[current.status] || ['Status tiket', 'Status sedang diperiksa.', ''];
    $('ticket-title').textContent = label[0];
    $('ticket-copy').textContent = label[1];
    $('ticket-status').textContent = label[0];
    $('ticket-status').className = 'status-pill ' + label[2];
    const meta = $('ticket-meta'); meta.replaceChildren();
    [
      ['Nomor tiket', current.id],
      ['Nomor pesanan', current.orderId],
      ['Pemain', current.minecraftName],
      ['Paket', current.productName],
      ['Dibuat', current.createdAt ? new Date(current.createdAt).toLocaleString('id-ID') : '—'],
      ['Diajukan', current.submittedAt ? new Date(current.submittedAt).toLocaleString('id-ID') : '—'],
      ['Selesai', current.completedAt ? new Date(current.completedAt).toLocaleString('id-ID') : '—']
    ].forEach(([name, value]) => {
      const item = document.createElement('div'); item.className = 'meta-item';
      const small = document.createElement('small'); small.textContent = name;
      const strong = document.createElement('b'); strong.textContent = value || '—';
      item.append(small, strong); meta.append(item);
    });
    const button = $('apply-ticket');
    button.disabled = current.status !== 'ACTIVE' || current.orderStatus !== 'COMPLETED';
    button.textContent = current.status === 'ACTIVE' ? 'Ajukan tiket ↗' : current.status === 'PENDING' ? 'Pengajuan sudah dikirim' : 'Ajukan tiket tidak tersedia';
  }
  $('apply-ticket').addEventListener('click', async () => {
    if (!current || current.status !== 'ACTIVE') return;
    const phone = String(cfg.adminWhatsApp || '').replace(/\D/g, '');
    if (!phone) { fail('Nomor WhatsApp admin belum diatur di konfigurasi Store.'); return; }
    const waWindow = window.open('about:blank', '_blank');
    const button = $('apply-ticket'); button.disabled = true; button.textContent = 'Mengajukan tiket…';
    try {
      const response = await fetch('/api/tickets/' + encodeURIComponent(id), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Tiket belum dapat diajukan.');
      current.status = data.status || 'PENDING';
      render();
      const link = location.href;
      const message = [
        'Halo Admin SLF, saya ingin mengajukan tiket re-entry.',
        'Nomor tiket: ' + current.id,
        'Nomor pesanan: ' + current.orderId,
        'Nama Minecraft: ' + current.minecraftName,
        'Paket: ' + current.productName,
        'Tautan tiket pribadi: ' + link,
        'Mohon proses pengajuan re-entry saya.'
      ].join('\n');
      const target = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
      if (waWindow && !waWindow.closed) waWindow.location.href = target;
      else window.location.href = target;
    } catch (error) {
      if (waWindow && !waWindow.closed) waWindow.close();
      fail(error.message || 'Pengajuan gagal. Coba muat ulang halaman.');
      button.disabled = current.status !== 'ACTIVE'; button.textContent = 'Ajukan tiket ↗';
    }
  });
  function fail(message) {
    $('ticket-error').textContent = message;
    $('ticket-error').classList.add('show');
  }
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 15000);
})();
