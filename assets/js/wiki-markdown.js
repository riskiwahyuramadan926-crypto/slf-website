(() => {
  'use strict';

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[char]);

  function safeUrl(value, image = false) {
    const raw = String(value || '').trim();
    if (!raw || raw.startsWith('//') || /[\u0000-\u001f]/.test(raw)) return '';
    try {
      const url = new URL(raw, window.location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      if (image && url.origin !== window.location.origin && url.protocol !== 'https:') return '';
      return url.href;
    } catch {
      return '';
    }
  }

  function inline(source) {
    const tokens = [];
    const hold = html => {
      const marker = '@@SLF_TOKEN_' + tokens.length + '@@';
      tokens.push(html);
      return marker;
    };
    let value = String(source || '');
    value = value.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (all, alt, rawUrl) => {
      const url = safeUrl(rawUrl, true);
      return url ? hold('<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">') : escapeHtml(alt);
    });
    value = value.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (all, label, rawUrl) => {
      const url = safeUrl(rawUrl, false);
      return url ? hold('<a href="' + escapeHtml(url) + '" rel="noopener noreferrer">' + escapeHtml(label) + '</a>') : escapeHtml(label);
    });
    value = escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    value = value.replace(/@@SLF_TOKEN_(\d+)@@/g, (all, index) => tokens[Number(index)] || '');
    return value;
  }

  function splitCells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
  }

  function isTableDelimiter(line) {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  }

  function render(markdown) {
    const lines = String(markdown || '').replace(/\r/g, '').split('\n');
    const out = [];
    let paragraph = [];
    let listType = '';
    let quote = [];
    let code = [];
    let inCode = false;

    const flushParagraph = () => {
      if (paragraph.length) out.push('<p>' + paragraph.map(inline).join('<br>') + '</p>');
      paragraph = [];
    };
    const closeList = () => {
      if (listType) out.push('</' + listType + '>');
      listType = '';
    };
    const flushQuote = () => {
      if (quote.length) out.push('<aside class="wiki-callout">' + quote.map(inline).join('<br>') + '</aside>');
      quote = [];
    };
    const flushTextBlocks = () => {
      flushParagraph();
      closeList();
      flushQuote();
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^\s*```/.test(line)) {
        if (inCode) {
          out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
          code = [];
          inCode = false;
        } else {
          flushTextBlocks();
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        code.push(line);
        continue;
      }
      if (!line.trim()) {
        flushTextBlocks();
        continue;
      }
      if (index + 1 < lines.length && line.includes('|') && isTableDelimiter(lines[index + 1])) {
        flushTextBlocks();
        const headers = splitCells(line);
        const aligns = splitCells(lines[index + 1]).map(cell => cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : 'left');
        out.push('<div class="wiki-table-wrap"><table><thead><tr>' + headers.map((cell,i) => '<th style="text-align:' + (aligns[i] || 'left') + '">' + inline(cell) + '</th>').join('') + '</tr></thead><tbody>');
        index += 2;
        while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
          const cells = splitCells(lines[index]);
          out.push('<tr>' + headers.map((_,i) => '<td style="text-align:' + (aligns[i] || 'left') + '">' + inline(cells[i] || '') + '</td>').join('') + '</tr>');
          index += 1;
        }
        out.push('</tbody></table></div>');
        index -= 1;
        continue;
      }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushTextBlocks();
        const level = heading[1].length + 1;
        out.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
        continue;
      }
      if (/^\s*(---+|\*\*\*|___)\s*$/.test(line)) {
        flushTextBlocks();
        out.push('<hr>');
        continue;
      }
      if (/^>\s?/.test(line)) {
        flushParagraph();
        closeList();
        quote.push(line.replace(/^>\s?/, ''));
        continue;
      }
      const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph();
        flushQuote();
        const nextType = unordered ? 'ul' : 'ol';
        if (listType && listType !== nextType) closeList();
        if (!listType) {
          listType = nextType;
          out.push('<' + listType + '>');
        }
        out.push('<li>' + inline((unordered || ordered)[1]) + '</li>');
        continue;
      }
      closeList();
      flushQuote();
      paragraph.push(line);
    }

    if (inCode) out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
    flushTextBlocks();
    return out.join('');
  }

  window.SLFWikiMarkdown = Object.freeze({ render, safeUrl });
})();
