(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const form = $('support-form');
  if (!form) return;
  const year = $('year');
  if (year) year.textContent = new Date().getFullYear();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = $('support-form-error');
    const result = $('support-result');
    const success = $('support-success');
    const button = $('support-submit');
    error.textContent = '';
    error.classList.remove('show');
    result.textContent = '';
    success.textContent = '';
    success.classList.remove('show');
    button.disabled = true;
    button.textContent = 'Mengirim tiket…';

    const payload = {
      playerName: $('support-player').value.trim(),
      contact: $('support-contact').value.trim(),
      category: $('support-category').value,
      subject: $('support-subject').value.trim(),
      message: $('support-message').value.trim(),
      website: $('support-website').value
    };

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Tiket belum dapat dikirim. Coba lagi sebentar.');
      const ticketId = data.ticketId || 'Tercatat';
      success.textContent = 'Tiket berhasil dibuat: ' + ticketId + '. Simpan nomor ini untuk tindak lanjut.';
      success.classList.add('show');
      result.textContent = 'Tiket sudah masuk ke sistem bantuan SLF.';
      form.reset();
    } catch (err) {
      error.textContent = err.message || 'Koneksi gagal. Periksa internet lalu coba kembali.';
      error.classList.add('show');
    } finally {
      button.disabled = false;
      button.textContent = 'Kirim Tiket Bantuan ↗';
    }
  });
})();
