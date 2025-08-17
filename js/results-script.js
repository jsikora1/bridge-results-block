document.addEventListener('DOMContentLoaded', function () {
  const containers = document.querySelectorAll('.bridge-results-table');
  if (!containers.length || typeof bridgeApi === 'undefined') return;

  containers.forEach(async (container) => {
    // ---- 1) Settings (defaults + per-instance from DOM) ----
    let settings = {
      numberOfResults: 10,
      filterTourneyType: '',
      showCategory: true,
      showLocation: true,
      showImages: true,
      showTableHeader: true,
      showTourneyType: true,
      showTournament: true,
      showDate: false,
      useDefaultImage: false,
      defaultImageUrl: ''
    };
    try {
      const ds = container.dataset.bridgeSettings ? JSON.parse(container.dataset.bridgeSettings) : {};
      settings = { ...settings, ...ds };
    } catch {}

    const {
      showDate, showCategory, showLocation, showImages, showTableHeader,
      showTourneyType, showTournament, useDefaultImage, defaultImageUrl,
      filterTourneyType
    } = settings;

    // ---- 2) Scoped DOM ----
    const table = container.querySelector('#results-table');
    const tbody = container.querySelector('#results-table tbody');
    if (!table || !tbody) return;
    tbody.innerHTML = '';

    // ---- 3) Helpers ----
    const debounce = (fn, delay = 300) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; };
    function showSkeleton() {
      const colCount =
        (showDate ? 1 : 0) +
        (showImages ? 1 : 0) +
        (showCategory ? 1 : 0) +
        (showTournament ? 1 : 0) +
        (showTourneyType ? 1 : 0);
      const tr = document.createElement('tr');
      for (let i = 0; i < Math.max(colCount, 1); i++) {
        const td = document.createElement('td');
        td.innerHTML =
          '<div class="bridge-skeleton" style="width:100%;height:1.2em;"></div>' +
          '<div class="bridge-skeleton" style="width:100%;height:1.2em;"></div>';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    function clearTbody() { tbody.innerHTML = ''; }

    // ---- 4) Header with sort arrows ----
    if (showTableHeader) {
      const thead = document.createElement('thead');
      thead.innerHTML = `<tr>
        ${showDate ? '<th data-type="date">Data <span class="sort-arrow"></span></th>' : ''}
        ${showImages ? '<th data-type="none" class="col-image">Img</th>' : ''}
        ${showCategory ? '<th data-type="text">Kategoria <span class="sort-arrow"></span></th>' : ''}
        ${showTournament ? '<th data-type="text">Nazwa <span class="sort-arrow"></span></th>' : ''}
        ${showTourneyType ? '<th data-type="text">Typ <span class="sort-arrow"></span></th>' : ''}
      </tr>`;
      table.prepend(thead);
    }

    function attachSorting(tableEl, tbodyEl) {
      const headers = tableEl.querySelectorAll('thead th');
      if (!headers.length) return;

      headers.forEach((th, colIndex) => {
        const type = th.getAttribute('data-type') || 'text';
        if (type === 'none') return;

        th.style.cursor = 'pointer';
        let asc = true;

        th.addEventListener('click', () => {
          const rows = Array.from(tbodyEl.querySelectorAll('tr'));
          const cell = (row) => (row.children[colIndex]?.textContent || '').trim();

          rows.sort((a, b) => {
            let A = cell(a), B = cell(b);
            if (type === 'date') {
              const va = new Date(A.split('.').reverse().join('-')).getTime() || 0;
              const vb = new Date(B.split('.').reverse().join('-')).getTime() || 0;
              return asc ? va - vb : vb - va;
            }
            return asc
              ? A.localeCompare(B, undefined, { numeric: true })
              : B.localeCompare(A, undefined, { numeric: true });
          });

          clearTbody();
          rows.forEach(r => tbodyEl.appendChild(r));
          asc = !asc;

          headers.forEach(h => { const s = h.querySelector('.sort-arrow'); if (s) s.textContent = ''; });
          const s = th.querySelector('.sort-arrow'); if (s) s.textContent = asc ? '▲' : '▼';
        });
      });
    }

    function appendRows(rows) {
      rows
        .filter(r => !filterTourneyType || r.tourney_type === filterTourneyType)
        .forEach(row => {
          const tr = document.createElement('tr');

          const d = new Date(row.tourney_date);
          const date = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

          const nameHtml = row.tourney_link
            ? `<a href="${row.tourney_link}" target="_blank" style="color:var(--global-palette-highlight);">${row.tourney_name}</a>`
            : row.tourney_name;

          const locationHtml = (showLocation && row.tourney_location)
            ? `<div style="font-size:.8em;color:#666;">${row.tourney_location}</div>`
            : '';

          const imgSrc = showImages ? (row.event_thumb || (useDefaultImage ? defaultImageUrl : '')) : '';
          const thumbHtml = imgSrc
            ? `<img src="${imgSrc}" alt="" loading="lazy" style="max-width:40px;max-height:40px;object-fit:cover;border-radius:8px;display:block;margin:auto;">`
            : '';

          tr.innerHTML = `
            ${showDate ? `<td>${date}</td>` : ''}
            ${showImages ? `<td class="col-image" style="padding:2px 5px;">${thumbHtml || '&nbsp;'} </td>` : ''}
            ${showCategory ? `<td style="text-align:center;padding:2px 10px;"><span class="result-category" style="background-color:${row.category_color};">${row.tourney_category}</span></td>` : ''}
            ${showTournament ? `<td width="100%"><div>${nameHtml}${locationHtml}</div></td>` : ''}
            ${showTourneyType ? `<td>${row.tourney_type}</td>` : ''}
          `;
          tbody.appendChild(tr);
        });
    }

    function renderYearButtons(rows, onFilterByYear) {
      const existing = container.querySelector('.results-year-nav');
      if (existing) existing.remove();

      const wrap = document.createElement('div');
      wrap.className = 'results-year-nav';

      const years = [...new Set(rows.map(r => new Date(r.tourney_date).getFullYear()))].sort((a,b)=>b-a);
      years.forEach(yr => {
        const btn = document.createElement('button');
        btn.className = 'results-year-btn';
        btn.textContent = yr;
        btn.addEventListener('click', () => onFilterByYear(yr));
        wrap.appendChild(btn);
      });

      container.prepend(wrap);
    }

    // ---- 5) Meta bar (place above table safely) ----
    const meta = document.createElement('div');
    meta.className = 'results-meta';
    meta.style.margin = '6px 0';
    if (table.parentElement) {
      table.parentElement.insertBefore(meta, table);
    } else {
      container.prepend(meta);
    }
    function updateMeta({ page, perPage, total }) {
      const start = total ? (page - 1) * perPage + 1 : 0;
      const end   = Math.min(page * perPage, total);
      meta.textContent = total
        ? `Showing ${start}–${end} of ${total} results`
        : 'No results';
    }

    // ---- 6) Loading helpers ----
    function setTableLoading(isLoading) {
      container.classList.toggle('is-loading', isLoading);
      table.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    }
    function setButtonLoading(btn, isLoading, idleText = 'Load more') {
      if (!btn) return;
      btn.disabled = isLoading;
      if (!btn.dataset.idleText) btn.dataset.idleText = idleText;
      btn.textContent = isLoading ? 'Loading…' : btn.dataset.idleText;
    }

    // ---- 7) Client cache + fetchResults (per container, AFTER settings) ----
    const clientCache = new Map();
    const cacheKey = (o) => JSON.stringify(o);
    async function fetchResults(params) {
      const key = cacheKey(params);
      if (clientCache.has(key)) return clientCache.get(key);

      const qs = new URLSearchParams();
      qs.set('page', params.page || 1);
      qs.set('per_page', params.per_page || (settings.numberOfResults || 10));
      if (params.keyword)  qs.set('keyword', params.keyword);
      if (params.year)     qs.set('year', params.year);
      if (params.category) qs.set('category', params.category);
      if (params.type)     qs.set('type', params.type);

      const res = await fetch(`${bridgeApi.root}/results?${qs.toString()}`, {
        headers: bridgeApi?.nonce ? { 'X-WP-Nonce': bridgeApi.nonce } : {}
      });
      const data = await res.json();
      const total = parseInt(res.headers.get('X-WP-Total') || '0', 10);
      const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10);

      const payload = { data, total, totalPages, page: parseInt(qs.get('page'), 10) };
      clientCache.set(key, payload);
      return payload;
    }

    // ---- 8) Pagination state + controls ----
    let current = { page: 1, totalPages: 1, params: {} };

    const searchBox = document.createElement('input');
    searchBox.type = 'search';
    searchBox.placeholder = 'Wyszukaj...';
    searchBox.className = 'results-search-box';
    container.prepend(searchBox);

    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.textContent = 'Load more';
    loadMoreBtn.className = 'bridge-load-more';
    loadMoreBtn.style.margin = '10px 0';
    loadMoreBtn.style.display = 'none';
    container.append(loadMoreBtn);

    async function loadFirstPage(params = {}) {
      setTableLoading(true);
      showSkeleton();
      try {
        const perPage = settings.numberOfResults || 10;
        const r = await fetchResults({ page: 1, per_page: perPage, ...params });
        current = { page: r.page, totalPages: r.totalPages, params };
        clearTbody();
        appendRows(r.data);
        attachSorting(table, tbody);
        loadMoreBtn.style.display = (r.page < r.totalPages) ? '' : 'none';
        updateMeta({ page: r.page, perPage, total: r.total });
        return r;
      } finally {
        setTableLoading(false);
      }
    }

    async function loadMore() {
      if (current.page >= current.totalPages) return;
      setButtonLoading(loadMoreBtn, true);
      try {
        const perPage = settings.numberOfResults || 10;
        const next = current.page + 1;
        const r = await fetchResults({ page: next, per_page: perPage, ...current.params });
        current.page = r.page;
        appendRows(r.data);
        loadMoreBtn.style.display = (r.page < r.totalPages) ? '' : 'none';
        updateMeta({ page: r.page, perPage, total: r.total });
      } finally {
        setButtonLoading(loadMoreBtn, false); // ← fix: turn off loading state
      }
    }
    loadMoreBtn.addEventListener('click', loadMore);

    // ---- 9) Debounced REST search ----
    const runSearch = debounce(async () => {
      setTableLoading(true);
      showSkeleton();
      try {
        const keyword = searchBox.value.trim();
        await loadFirstPage({ keyword });
      } finally {
        setTableLoading(false);
      }
    }, 300);
    searchBox.addEventListener('input', runSearch);

    // ---- 10) Initial load + year buttons from first page ----
    const first = await loadFirstPage();
    const firstRows = first?.data || [];
    renderYearButtons(firstRows, (selectedYear) => {
      const filtered = firstRows.filter(r => new Date(r.tourney_date).getFullYear() === selectedYear);
      clearTbody();
      appendRows(filtered);
      loadMoreBtn.style.display = 'none'; // disable pagination when client-filtered
      updateMeta({ page: 1, perPage: settings.numberOfResults || 10, total: filtered.length });
    });
  });
});
