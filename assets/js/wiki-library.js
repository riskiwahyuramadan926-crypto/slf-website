(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { books:[], chapters:[], bookId:'', activeChapterId:'', returnMode:'book', readerRequest:0 };
  const year = $('wikiYear');
  if (year) year.textContent = new Date().getFullYear();

  const menu = $('wikiMenuToggle');
  const nav = $('wikiNav');
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
      menu.textContent = open ? '✕ Tutup' : '☰ Menu';
    });
  }

  const renderMarkdown = value => window.SLFWikiMarkdown
    ? window.SLFWikiMarkdown.render(value)
    : '<p>' + String(value || '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])) + '</p>';

  function show(viewId) {
    ['wiki-shelf','wiki-search-view','wiki-category-view','wiki-reader'].forEach(id => {
      const node = $(id);
      if (node) node.hidden = id !== viewId;
    });
  }

  function renderBooks() {
    const root = $('wiki-book-grid');
    root.replaceChildren();
    state.books.forEach(book => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wiki-book';
      const cover = document.createElement('span');
      cover.className = 'wiki-book-cover';
      cover.textContent = book.icon || '📚';
      const copy = document.createElement('span');
      copy.className = 'wiki-book-copy';
      const label = document.createElement('small');
      label.textContent = 'BUKU · ' + String(book.sort_order || 0).padStart(2, '0');
      const title = document.createElement('strong');
      title.textContent = book.name;
      const description = document.createElement('span');
      description.textContent = book.description || 'Kumpulan panduan SLF.';
      const count = document.createElement('span');
      count.className = 'wiki-book-count';
      count.textContent = (Number(book.chapter_count ?? book.article_count) || 0) + ' bab · Buka buku →';
      copy.append(label,title,description,count);
      button.append(cover,copy);
      button.addEventListener('click', () => openBook(book.id));
      root.append(button);
    });
  }

  function renderChapterRows(root, chapters, mode) {
    root.replaceChildren();
    if (!chapters.length) {
      const empty = document.createElement('div');
      empty.className = 'wiki-library-message';
      empty.textContent = 'Belum ada bab yang diterbitkan dalam buku ini.';
      root.append(empty);
      return;
    }
    chapters.forEach((chapter,index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wiki-article-row';
      const icon = document.createElement('span');
      icon.className = 'wiki-article-icon';
      icon.textContent = chapter.icon || '📖';
      const copy = document.createElement('span');
      copy.className = 'wiki-article-copy';
      const title = document.createElement('strong');
      title.textContent = 'Bab ' + (index + 1) + ' · ' + chapter.title;
      const summary = document.createElement('small');
      summary.textContent = chapter.summary || 'Buka untuk membaca bab ini.';
      copy.append(title,summary);
      const action = document.createElement('span');
      action.className = 'wiki-article-open';
      action.textContent = 'Baca bab →';
      button.append(icon,copy,action);
      button.addEventListener('click', () => openChapter(chapter.id,mode));
      root.append(button);
    });
  }

  function openBook(id) {
    state.readerRequest += 1;
    const book = state.books.find(item => item.id === id);
    if (!book) return;
    state.bookId = id;
    state.activeChapterId = '';
    const heading = $('wiki-category-heading');
    heading.replaceChildren();
    const label = document.createElement('div');
    label.className = 'eyebrow';
    label.textContent = 'ISI BUKU · ' + book.name.toUpperCase();
    const title = document.createElement('h2');
    title.textContent = book.name;
    const description = document.createElement('p');
    description.textContent = book.description || 'Daftar bab dalam buku ini.';
    heading.append(label,title,description);
    renderChapterRows($('wiki-article-list'),state.chapters.filter(chapter => chapter.book_id === id),'book');
    show('wiki-category-view');
  }

  function chapterList() {
    return state.chapters.filter(chapter => chapter.book_id === state.bookId);
  }

  function renderChapterToc(currentId) {
    const root = $('wiki-chapter-toc');
    root.replaceChildren();
    const chapters = chapterList();
    if (!chapters.length) {
      const empty = document.createElement('p');
      empty.className = 'wiki-toc-empty';
      empty.textContent = 'Belum ada bab.';
      root.append(empty);
      return;
    }
    chapters.forEach((chapter,index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wiki-toc-item' + (chapter.id === currentId ? ' active' : '');
      button.setAttribute('aria-current',chapter.id === currentId ? 'page' : 'false');
      const number = document.createElement('span');
      number.className = 'wiki-toc-number';
      number.textContent = String(index + 1).padStart(2,'0');
      const label = document.createElement('span');
      label.className = 'wiki-toc-label';
      label.textContent = chapter.title;
      button.append(number,label);
      button.addEventListener('click',() => openChapter(chapter.id,state.returnMode));
      root.append(button);
    });
  }

  function legacyInline(node,baseUrl) {
    if (node.nodeType === 3) return node.nodeValue.replace(/\s+/g,' ');
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '\n';
    if (tag === 'img') {
      const src = node.getAttribute('src');
      const alt = node.getAttribute('alt') || 'gambar';
      if (!src) return '';
      return '![' + alt.replace(/[\]]/g,'') + '](' + new URL(src,baseUrl).href + ')';
    }
    const inner = Array.from(node.childNodes).map(child => legacyInline(child,baseUrl)).join('');
    if (tag === 'strong' || tag === 'b') return '**' + inner.trim() + '**';
    if (tag === 'em' || tag === 'i') return '*' + inner.trim() + '*';
    if (tag === 'code') return '`' + inner.trim().replace(/`/g,"'") + '`';
    if (tag === 'a') {
      const href = node.getAttribute('href');
      if (!href) return inner;
      try { return '[' + inner.trim() + '](' + new URL(href,baseUrl).href + ')'; } catch { return inner; }
    }
    return inner;
  }

  function legacyBlocks(root,baseUrl) {
    const output = [];
    Array.from(root.childNodes).forEach(node => {
      if (node.nodeType === 3) {
        const text = node.nodeValue.trim();
        if (text) output.push(text);
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') {
        const ordered = tag === 'ol';
        const lines = Array.from(node.children).filter(child => child.tagName.toLowerCase() === 'li')
          .map((li,index) => (ordered ? (index + 1) + '. ' : '- ') + legacyInline(li,baseUrl).trim());
        if (lines.length) output.push(lines.join('\n'));
        return;
      }
      if (/^h[1-6]$/.test(tag)) {
        output.push('#'.repeat(Math.min(3,Math.max(1,Number(tag.slice(1))))) + ' ' + legacyInline(node,baseUrl).trim());
        return;
      }
      if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
        const content = legacyBlocks(node,baseUrl) || legacyInline(node,baseUrl).trim();
        if (content) output.push(content);
        return;
      }
      if (tag === 'blockquote' || node.classList?.contains('wiki-callout')) {
        const content = legacyBlocks(node,baseUrl) || legacyInline(node,baseUrl).trim();
        if (content) output.push(content.split('\n').map(line => '> ' + line).join('\n'));
        return;
      }
      if (tag === 'hr') output.push('---');
      else {
        const content = legacyInline(node,baseUrl).trim();
        if (content) output.push(content);
      }
    });
    return output.join('\n\n').replace(/\n{3,}/g,'\n\n').trim();
  }

  async function chapterContent(chapter) {
    if (String(chapter.content || '').trim()) return chapter.content;
    if (!chapter.legacy_url) return '';
    const response = await fetch(chapter.legacy_url,{cache:'no-store',credentials:'same-origin'});
    if (!response.ok) throw new Error('Konten bab lama gagal dimuat (HTTP ' + response.status + ').');
    const html = await response.text();
    const documentNode = new DOMParser().parseFromString(html,'text/html');
    const body = documentNode.querySelector('.wiki-article-body');
    if (!body) throw new Error('Bagian isi bab lama tidak ditemukan.');
    const converted = legacyBlocks(body,new URL(chapter.legacy_url,location.href).href);
    if (converted.length < 3) throw new Error('Konten bab lama belum dapat dikonversi.');
    return converted;
  }

  async function openChapter(id,mode) {
    const chapter = state.chapters.find(item => item.id === id);
    if (!chapter) return;
    state.bookId = chapter.book_id;
    const requestId = ++state.readerRequest;
    state.activeChapterId = id;
    state.returnMode = mode || 'book';
    const book = state.books.find(item => item.id === chapter.book_id);
    $('wiki-reader-breadcrumb').textContent = (book?.name || chapter.book_name || 'Wiki') + ' · ' + chapter.title;
    $('wiki-reader-category').textContent = book?.name || chapter.book_name || 'Wiki SLF';
    $('wiki-reader-title').textContent = chapter.title;
    $('wiki-reader-summary').textContent = chapter.summary || '';
    $('wiki-reader-body').innerHTML = '<p class="wiki-reader-loading">Memuat isi bab…</p>';
    renderChapterToc(id);
    const chapters = chapterList();
    const index = chapters.findIndex(item => item.id === id);
    const previous = $('wiki-reader-prev');
    const next = $('wiki-reader-next');
    previous.disabled = index <= 0;
    next.disabled = index < 0 || index >= chapters.length - 1;
    previous.onclick = () => { if (index > 0) openChapter(chapters[index - 1].id,state.returnMode); };
    next.onclick = () => { if (index >= 0 && index < chapters.length - 1) openChapter(chapters[index + 1].id,state.returnMode); };
    show('wiki-reader');
    try {
      const content = await chapterContent(chapter);
      if (requestId !== state.readerRequest) return;
      $('wiki-reader-body').innerHTML = content ? renderMarkdown(content) : '<p>Bab ini belum memiliki isi.</p>';
    } catch (error) {
      if (requestId !== state.readerRequest) return;
      const url = chapter.legacy_url ? new URL(chapter.legacy_url,location.href).href : '';
      $('wiki-reader-body').innerHTML = '<div class="wiki-library-message">' +
        (error.message || 'Bab belum dapat dimuat.') +
        (url ? ' <a href="' + url.replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '">Buka halaman lama ↗</a>' : '') +
        '</div>';
    }
  }

  function search() {
    const query = $('wikiSearch').value.trim().toLocaleLowerCase('id');
    if (!query) {
      $('wiki-library-count').textContent = state.books.length + ' buku · ' + state.chapters.length + ' bab';
      show('wiki-shelf');
      return;
    }
    const matches = state.chapters.filter(chapter => {
      const book = state.books.find(item => item.id === chapter.book_id);
      return (chapter.title + ' ' + chapter.summary + ' ' + chapter.content + ' ' + (book?.name || chapter.book_name || '')).toLocaleLowerCase('id').includes(query);
    });
    $('wiki-search-title').textContent = 'Hasil untuk “' + query + '”';
    $('wiki-library-count').textContent = matches.length + ' bab ditemukan';
    renderChapterRows($('wiki-search-results'),matches,'search');
    show('wiki-search-view');
  }

  async function init() {
    try {
      const response = await fetch('/api/wiki',{cache:'no-store'});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data.error || 'API Wiki gagal dimuat') + ' (HTTP ' + response.status + ')' + (data.diagnostic ? ' · ' + data.diagnostic : ''));
      state.books = Array.isArray(data.books) ? data.books : (Array.isArray(data.categories) ? data.categories : []);
      state.chapters = Array.isArray(data.chapters) ? data.chapters : (Array.isArray(data.articles) ? data.articles.map(item => ({...item,book_id:item.book_id || item.category_id})) : []);
      if (!state.books.length) throw new Error('Belum ada buku aktif di perpustakaan.');
      $('wiki-library-count').textContent = state.books.length + ' buku · ' + state.chapters.length + ' bab';
      renderBooks();
      show('wiki-shelf');
    } catch (error) {
      $('wiki-library-error').hidden = false;
      $('wiki-library-error').textContent = error.message || 'Wiki belum dapat dimuat.';
      $('wiki-book-grid').textContent = 'Perpustakaan belum tersedia. Coba muat ulang halaman.';
    }
  }

  $('wikiSearch').addEventListener('input',search);
  $('wiki-search-clear').addEventListener('click',() => { $('wikiSearch').value=''; search(); });
  $('wiki-back-shelf').addEventListener('click',() => { state.bookId=''; $('wikiSearch').value=''; search(); });
  $('wiki-reader-back').addEventListener('click',() => {
    if (state.returnMode === 'search') show('wiki-search-view');
    else openBook(state.bookId);
  });
  init();
})();
