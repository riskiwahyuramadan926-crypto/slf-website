/* ============================================================
   SLF WEBSITE — INTERAKSI
   Menu mobile, pencarian Wiki, konfigurasi link, dan notifikasi.
   Biasanya tidak perlu diedit untuk mengganti tautan; ubah config.js.
   ============================================================ */
(function () {
  "use strict";

  const config = window.SLF_CONFIG || { links: {} };

  // 1. Tahun footer otomatis mengikuti tahun saat ini.
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // 2. Menu navigasi untuk layar kecil.
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", function () {
      const isOpen = navLinks.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.textContent = isOpen ? "✕ Tutup" : "☰ Menu";
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰ Menu";
      });
    });
  }

  // 3. Isi tautan dari assets/js/config.js.
  //    Jika kosong, tombol lama tetap menampilkan pesan bahwa link belum dipasang.
  document.querySelectorAll("[data-config-link]").forEach(function (link) {
    const key = link.dataset.configLink;
    const url = (config.links && config.links[key] ? config.links[key] : "").trim();
    if (!url) return;

    link.href = url;
    link.removeAttribute("data-placeholder");
    link.classList.remove("unset");

    if (/^https?:\/\//i.test(url)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    const small = link.querySelector("small");
    if (small) small.textContent = "Terhubung ↗";
  });

  // 4. Pencarian artikel Wiki.
  const search = document.getElementById("wikiSearch");
  const entries = Array.from(document.querySelectorAll(".wiki-entry"));
  const count = document.getElementById("wikiCount");
  const noResults = document.getElementById("noWikiResults");

  if (search && count && noResults) {
    const initialCount = entries.length;
    count.textContent = initialCount + " topik panduan";

    search.addEventListener("input", function () {
      const query = search.value.trim().toLocaleLowerCase("id");
      let visible = 0;

      entries.forEach(function (entry) {
        const searchableText = (
          entry.innerText + " " + (entry.dataset.search || "")
        ).toLocaleLowerCase("id");
        const matches = searchableText.includes(query);
        entry.style.display = matches ? "" : "none";
        if (matches) visible += 1;
      });

      count.textContent = visible + " topik ditemukan";
      noResults.style.display = visible ? "none" : "block";
    });
  }

  // 5. Notifikasi untuk tombol yang belum punya tautan resmi.
  const toast = document.getElementById("toast");
  let toastTimer = null;

  document.querySelectorAll("[data-placeholder]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      if (!toast) return;
      toast.textContent = link.dataset.placeholder;
      toast.classList.add("show");
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(function () {
        toast.classList.remove("show");
      }, 3500);
    });
  });
})();
