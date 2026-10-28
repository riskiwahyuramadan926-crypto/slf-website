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
    PENDING: ['Pending · menunggu admin', 'Pengajuan sudah tersimpan dan masuk ke antrean Admin SLF. Simpan nomor tiket ini untuk tindak lanjut; admin akan memperbarui statusnya setelah diproses.', ''],
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
    const phone = String(cfg.adminWhatsApp || '').replace(/\\D/g, '');
    const button = $('apply-ticket');
    const waWindow = phone ? window.open('about:blank', '_blank') : null;
    button.disabled = true;
    button.textContent = 'Mengajukan tiket…';
    $('ticket-error').textContent = '';
    $('ticket-error').classList.remove('show');
    try {
      // Submit to D1 first. WhatsApp is optional and must never block a valid request.
      const response = await fetch('/api/tickets/' + encodeURIComponent(id), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Tiket belum dapat diajukan.');
      current.status = data.status || 'PENDING';
      render();

      if (phone) {
        const message = [
          'Halo Admin SLF, saya sudah mengajukan tiket re-entry melalui website.',
          'Nomor tiket: ' + current.id,
          'Nomor pesanan: ' + current.orderId,
          'Nama Minecraft: ' + current.minecraftName,
          'Paket: ' + current.productName,
          'Jumlah nyawa mengikuti status rank/langganan yang berlaku saat diproses.',
          'Tautan tiket pribadi: ' + location.href,
          'Mohon periksa pengajuan pada panel Admin SLF.'
        ].join('\\n');
        const target = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
        if (waWindow && !waWindow.closed) waWindow.location.href = target;
        else window.location.href = target;
      } else {
        // The request is already stored in D1 and visible from Admin > Tiket Re-entry.
        $('ticket-copy').textContent = 'Pengajuan berhasil tersimpan di sistem dan sudah masuk ke antrean Admin SLF. Nomor WhatsApp admin belum dikonfigurasi di website, tetapi pengajuanmu tetap tercatat. Simpan tautan ini dan nomor tiket untuk tindak lanjut.';
      }
    } catch (error) {
      if (waWindow && !waWindow.closed) waWindow.close();
      fail(error.message || 'Pengajuan gagal. Coba muat ulang halaman.');
      button.disabled = current.status !== 'ACTIVE';
      button.textContent = 'Ajukan tiket ↗';
    }
  });
  function fail(message) {
    $('ticket-error').textContent = message;
    $('ticket-error').classList.add('show');
  }
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 15000);
})();
