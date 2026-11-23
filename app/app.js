(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DB_NAME = 'slf-mobile-local';
  const DB_VERSION = 1;
  const STORE = 'records';
  const PROJECT_KEY = 'studio-current-project';
  const PROJECTS_KEY = 'studio-project-list';
  const MODULES = {
    wiki: { title: 'Wiki', subtitle: 'Perpustakaan Buku & Bab', href: '/wiki/', note: 'Buku dan bab Wiki tetap menggunakan sistem publik yang sudah berjalan. Integrasi editor dan cache data privat akan masuk pada tahap integrasi.' },
    tickets: { title: 'Tiket', subtitle: 'Re-entry & bantuan pemain', href: '/store/ticket.html', note: 'Halaman tiket lama tetap tersedia. Data tiket dan tindakan Admin akan dihubungkan melalui API yang sudah ada pada tahap integrasi.' },
    transactions: { title: 'Transaksi', subtitle: 'Pesanan & laporan pendapatan', href: '/admin/', note: 'Transaksi tetap dikelola oleh backend D1 yang sekarang. Aksi Owner dan penghitungan laporan akan diintegrasikan setelah audit endpoint dan role.' },
    owner: { title: 'Pengaturan Owner', subtitle: 'Akses khusus pemilik', href: '/admin/', note: 'Pengaturan Owner akan memakai autentikasi server yang sudah ada. Tidak ada hak Owner yang diberikan hanya berdasarkan tampilan aplikasi.' }
  };
  const TYPE_META = {
    text: { label: 'Teks', icon: 'T' }, image: { label: 'Gambar', icon: '▧' },
    video: { label: 'Video', icon: '▷' }, button: { label: 'Tombol', icon: '▱' },
    table: { label: 'Tabel', icon: '▦' }, card: { label: 'Kartu info', icon: '▣' }
  };

  let dbPromise;
  let project = createProject();
  let selectedLayerId = null;
  let deferredInstallPrompt = null;
  let toastTimer;

  function createId() {
    return globalThis.crypto?.randomUUID?.() || 'slf-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function createProject() {
    return { id: createId(), name: 'Project SLF Baru', updatedAt: new Date().toISOString(), version: 1, layers: [] };
  }
  function openDb() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB tidak tersedia di browser ini.'));
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Gagal membuka penyimpanan lokal.'));
    });
    return dbPromise;
  }
  async function localGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => reject(req.error);
    });
  }
  async function localPut(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ key, value, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('Gagal menyimpan draft.'));
      tx.onabort = () => reject(tx.error || new Error('Penyimpanan draft dibatalkan.'));
    });
  }
  function safeText(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
  function notify(message) {
    const node = $('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 2300);
  }
  function setConnection() {
    const online = navigator.onLine;
    const node = $('connectionState');
    node.classList.toggle('offline', !online);
    node.innerHTML = '<i></i>' + (online ? ' Online' : ' Offline');
  }
  function setView(name) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    const target = name === 'home' ? $('homeView') : name === 'studio' ? $('studioView') : $('moduleView');
    target.classList.add('active');
    if (name === 'studio') {
      renderLayers();
      renderPreview();
      document.querySelector('.bottom-nav [data-open="studio"]')?.classList.add('selected');
    } else if (name !== 'home') renderModule(name);
    if (name === 'home') renderRecentProjects();
    history.replaceState({ view: name }, '', name === 'home' ? './' : './#' + name);
  }
  function renderModule(name) {
    const module = MODULES[name];
    if (!module) return;
    $('moduleTitle').textContent = module.title;
    $('moduleSubtitle').textContent = module.subtitle;
    $('moduleBody').replaceChildren();
    const eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'MODUL SLF';
    const title = document.createElement('h1');
    title.textContent = module.title;
    const description = document.createElement('p');
    description.textContent = module.note;
    const status = document.createElement('div');
    status.className = 'module-status';
    status.textContent = 'Integrasi native aplikasi: Tahap 2. Sistem lama tetap dapat digunakan melalui halaman yang tersedia.';
    const link = document.createElement('a');
    link.className = 'save-button';
    link.href = module.href;
    link.textContent = 'Buka panel SLF saat ini ↗';
    link.style.display = 'inline-flex';
    link.style.textDecoration = 'none';
    link.style.marginTop = '15px';
    link.target = '_self';
    $('moduleBody').append(eyebrow, title, description, status, link);
  }
  function selectPanel(panel) {
    document.querySelectorAll('.editor-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.panel === panel));
    document.querySelectorAll('.editor-panel').forEach(node => node.classList.toggle('active', node.id === 'panel-' + panel));
  }
  function renderLayers() {
    const root = $('layerList');
    root.replaceChildren();
    $('layerCount').textContent = project.layers.length + (project.layers.length === 1 ? ' layer' : ' layer');
    if (!project.layers.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-card compact';
      empty.textContent = 'Belum ada layer. Tekan tombol + untuk menambahkan elemen.';
      root.append(empty);
      renderProperties();
      return;
    }
    project.layers.slice().reverse().forEach(layer => {
      const row = document.createElement('div');
      row.className = 'layer-row' + (layer.id === selectedLayerId ? ' active' : '');
      const type = document.createElement('span'); type.className = 'layer-type'; type.textContent = TYPE_META[layer.type]?.icon || '◇';
      const label = document.createElement('span'); label.className = 'layer-label';
      const name = document.createElement('b'); name.textContent = layer.name;
      const meta = document.createElement('small'); meta.textContent = TYPE_META[layer.type]?.label || layer.type;
      label.append(name, meta);
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = '•••'; edit.setAttribute('aria-label', 'Pilih ' + layer.name);
      edit.addEventListener('click', () => { selectedLayerId = layer.id; renderLayers(); selectPanel('properties'); });
      row.addEventListener('click', () => { selectedLayerId = layer.id; renderLayers(); selectPanel('properties'); });
      row.append(type, label, edit);
      root.append(row);
    });
    renderProperties();
  }
  function selectedLayer() { return project.layers.find(layer => layer.id === selectedLayerId) || null; }
  function renderProperties() {
    const root = $('propertyFields');
    root.replaceChildren();
    const layer = selectedLayer();
    $('selectedLayerName').textContent = layer ? layer.name : 'Pilih layer untuk mengedit';
    $('animationPreset').value = layer?.animation || 'none';
    $('animationLoop').checked = Boolean(layer?.loop);
    if (!layer) {
      const note = document.createElement('p'); note.className = 'muted'; note.textContent = 'Pilih salah satu layer terlebih dahulu.'; root.append(note); return;
    }
    const name = document.createElement('label'); name.className = 'field-label'; name.textContent = 'Nama layer';
    const nameInput = document.createElement('input'); nameInput.value = layer.name; nameInput.maxLength = 80;
    nameInput.addEventListener('input', () => { layer.name = nameInput.value; renderLayers(); });
    name.append(nameInput); root.append(name);
    if (['text','button','card'].includes(layer.type)) {
      const content = document.createElement('label'); content.className = 'field-label'; content.textContent = layer.type === 'text' ? 'Isi teks' : 'Label / konten';
      const input = document.createElement('textarea'); input.value = layer.content || ''; input.maxLength = 2000;
      input.addEventListener('input', () => { layer.content = input.value; renderPreview(); });
      content.append(input); root.append(content);
    }
    if (['image','video'].includes(layer.type)) {
      const source = document.createElement('label'); source.className = 'field-label'; source.textContent = layer.type === 'image' ? 'URL gambar' : 'URL video embed';
      const input = document.createElement('input'); input.type = 'url'; input.placeholder = 'https://…'; input.value = layer.src || '';
      input.addEventListener('change', () => { layer.src = input.value.trim(); renderPreview(); });
      source.append(input); root.append(source);
    }
    const remove = document.createElement('button'); remove.className = 'mini-button'; remove.type = 'button'; remove.textContent = 'Hapus layer';
    remove.addEventListener('click', () => { project.layers = project.layers.filter(item => item.id !== layer.id); selectedLayerId = null; renderLayers(); renderPreview(); });
    root.append(remove);
  }
  function renderPreview() {
    const root = $('previewPage');
    root.querySelectorAll('.preview-layer').forEach(node => node.remove());
    project.layers.forEach(layer => {
      const node = document.createElement('div');
      node.className = 'preview-layer' + (layer.id === selectedLayerId ? ' selected' : '');
      node.dataset.layerId = layer.id;
      if (layer.type === 'image' && layer.src) {
        const img = document.createElement('img'); img.src = layer.src; img.alt = layer.name; img.loading = 'lazy'; img.style.maxWidth = '100%'; img.style.maxHeight = '90px'; node.append(img);
      } else if (layer.type === 'video' && layer.src) {
        const text = document.createElement('span'); text.textContent = 'Video embed: ' + layer.src; node.append(text);
      } else node.textContent = layer.content || layer.name;
      node.addEventListener('click', () => { selectedLayerId = layer.id; renderLayers(); renderPreview(); selectPanel('properties'); });
      root.append(node);
      const animation = layer.animation || 'none';
      if (layer.loop && animation !== 'none') node.classList.add('anim-' + animation);
    });
  }
  function addLayer(type) {
    if (!TYPE_META[type]) return;
    const layer = { id: createId(), type, name: TYPE_META[type].label + ' ' + (project.layers.length + 1), content: type === 'text' ? 'Teks baru' : type === 'button' ? 'Klik di sini' : type === 'card' ? 'Informasi baru' : '', src: '', animation: 'none', loop: false };
    project.layers.push(layer);
    selectedLayerId = layer.id;
    renderLayers();
    renderPreview();
    selectPanel('properties');
    closeSheet();
    notify('Layer ditambahkan ke draft lokal.');
  }
  async function saveProject() {
    project.updatedAt = new Date().toISOString();
    try {
      await localPut(PROJECT_KEY, project);
      let list = await localGet(PROJECTS_KEY);
      if (!Array.isArray(list)) list = [];
      list = [project, ...list.filter(item => item.id !== project.id)].slice(0, 30);
      await localPut(PROJECTS_KEY, list);
      $('projectStatus').textContent = 'Tersimpan lokal · ' + new Date(project.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      $('syncLabel').textContent = 'Draft tersimpan di perangkat';
      renderRecentProjects();
      notify('Draft berhasil disimpan di perangkat ini.');
    } catch (error) {
      notify(error.message || 'Gagal menyimpan draft.');
    }
  }
  async function loadProject() {
    try {
      const saved = await localGet(PROJECT_KEY);
      if (saved && saved.id && Array.isArray(saved.layers)) project = saved;
    } catch (error) {
      notify('Penyimpanan lokal belum tersedia: ' + error.message);
    }
    renderLayers();
    renderPreview();
    renderRecentProjects();
  }
  async function renderRecentProjects() {
    const root = $('recentProjects');
    if (!root) return;
    root.replaceChildren();
    try {
      const list = await localGet(PROJECTS_KEY);
      if (!Array.isArray(list) || !list.length) {
        const empty = document.createElement('div'); empty.className = 'empty-card'; empty.textContent = 'Belum ada draft. Buat project pertama di SLF Studio.'; root.append(empty); return;
      }
      list.slice(0, 4).forEach(item => {
        const card = document.createElement('button'); card.type = 'button'; card.className = 'project-card'; card.style.textAlign = 'left'; card.style.color = 'inherit';
        const copy = document.createElement('span'); const title = document.createElement('b'); title.textContent = item.name || 'Project tanpa nama'; const meta = document.createElement('small'); meta.textContent = (item.layers?.length || 0) + ' layer · Draft lokal'; copy.append(title, meta);
        const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.style.color = 'var(--purple)';
        card.append(copy, arrow);
        card.addEventListener('click', async () => { project = item; await localPut(PROJECT_KEY, project); selectedLayerId = null; setView('studio'); });
        root.append(card);
      });
    } catch { /* Keep the home screen usable when local storage is unavailable. */ }
  }
  function openSheet() { $('addSheet').hidden = false; }
  function closeSheet() { $('addSheet').hidden = true; }
  async function start() {
    setConnection();
    window.addEventListener('online', setConnection);
    window.addEventListener('offline', setConnection);
    document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => setView(button.dataset.open)));
    document.querySelectorAll('.editor-tab').forEach(button => button.addEventListener('click', () => selectPanel(button.dataset.panel)));
    $('floatingAdd').addEventListener('click', openSheet);
    $('addLayerInline').addEventListener('click', openSheet);
    $('closeSheet').addEventListener('click', closeSheet);
    $('addSheet').addEventListener('click', event => { if (event.target === $('addSheet')) closeSheet(); });
    document.querySelectorAll('[data-create]').forEach(button => button.addEventListener('click', () => {
      const type = button.dataset.create;
      if (TYPE_META[type]) addLayer(type);
      else { closeSheet(); notify(type === 'page' ? 'Page Builder tersedia pada tahap 3.' : 'Backend & D1 Builder tersedia pada tahap 3.'); }
    }));
    $('saveProject').addEventListener('click', saveProject);
    $('refreshPreview').addEventListener('click', renderPreview);
    $('profileButton').addEventListener('click', () => notify('Login dan role akan terhubung dengan autentikasi Admin SLF pada tahap integrasi.'));
    $('animationPreset').addEventListener('change', event => { const layer = selectedLayer(); if (layer) { layer.animation = event.target.value; renderPreview(); } });
    $('animationLoop').addEventListener('change', event => { const layer = selectedLayer(); if (layer) { layer.loop = event.target.checked; renderPreview(); } });
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; $('installButton').hidden = false; });
    $('installButton').addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $('installButton').hidden = true;
    });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => console.warn('SLF PWA service worker:', error));
    }
    await loadProject();
    if (location.hash && MODULES[location.hash.slice(1)]) setView(location.hash.slice(1));
    else if (location.hash === '#studio') setView('studio');
  }
  document.addEventListener('DOMContentLoaded', start);
})();