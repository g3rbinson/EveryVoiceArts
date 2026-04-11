/* ============================================================
   MAIN.JS — Shared site logic
   - Navigation: scroll shadow, hamburger toggle, active links
   - Page-specific data loaders invoked by each page's inline script
   ============================================================ */

'use strict';

/* ── Navigation ─────────────────────────────────────────────── */
(function initNav() {
  const nav    = document.querySelector('.site-nav');
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');

  // Scroll shadow
  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Hamburger
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      const isOpen = links.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) {
        links.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on nav link click (mobile)
    links.querySelectorAll('a:not(.coming-soon)').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Active link — mark by matching href to current page filename
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    const href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
})();

/* ── Hero Ken-Burns trigger ──────────────────────────────────── */
(function initHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  requestAnimationFrame(function () { hero.classList.add('loaded'); });
})();

/* ── Data Helpers ────────────────────────────────────────────── */

/**
 * fetch a local JSON file and return the parsed array.
 * Returns [] on any error so the page degrades gracefully.
 */
async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    console.warn('Could not load', path, err);
    return [];
  }
}

/** Format a date string "YYYY-MM-DD" → { month, day, year } display parts */
function parseDateParts(dateStr) {
  // Parse as local date to avoid UTC-offset shifting
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return {
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day:   d.getDate(),
    year:  d.getFullYear(),
    iso:   dateStr,
    isPast: d < new Date(new Date().toDateString()),
  };
}

/** Format a date string for display like "April 12, 2026" */
function formatDateLong(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/* ── Schedule Renderer ───────────────────────────────────────── */
function renderSchedule(events, containerId, filterBtns) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let active = 'all';

  function render(list) {
    if (list.length === 0) {
      container.innerHTML = '<p class="no-events">No events match this filter.</p>';
      return;
    }

    container.innerHTML = list.map(function (ev) {
      const date = parseDateParts(ev.date);
      const pastClass = date.isPast ? ' past' : '';
      const detailsHtml = [
        ev.time   ? `<span>&#9656; ${escHtml(ev.time)}</span>` : '',
        ev.venue  ? `<span>&#9656; ${escHtml(ev.venue)}</span>` : '',
        ev.tickets ? `<span>&#9656; ${escHtml(ev.tickets)}</span>` : '',
      ].filter(Boolean).join('');

      return `
        <article class="event-row${pastClass}" aria-label="${escHtml(ev.title)}">
          <div class="event-date-block" aria-hidden="true">
            <span class="month">${date.month}</span>
            <span class="day">${date.day}</span>
            <span class="year">${date.year}</span>
          </div>
          <div class="event-info">
            <span class="tag">${escHtml(ev.category)}</span>
            <h3>${escHtml(ev.title)}</h3>
            ${ev.composer ? `<p class="composer">by ${escHtml(ev.composer)}</p>` : ''}
            <p class="event-details">${detailsHtml}</p>
            ${ev.description ? `<p class="card-excerpt">${escHtml(ev.description)}</p>` : ''}
          </div>
          <div class="event-action">
            ${!date.isPast && ev.eventbriteId
              ? `<button id="eb-trigger-${escAttr(ev.eventbriteId)}" type="button" class="btn btn-outline-gold">Tickets</button>`
              : !date.isPast && ev.ticketUrl
              ? `<a href="${escAttr(ev.ticketUrl)}" class="btn btn-outline-gold" rel="noopener noreferrer">Tickets</a>`
              : date.isPast
              ? `<span style="font-size:.75rem;color:var(--clr-text-muted);letter-spacing:.08em;text-transform:uppercase;">Completed</span>`
              : `<span class="btn btn-outline-gold" style="opacity:.4;pointer-events:none">TBA</span>`}
          </div>
        </article>`;
    }).join('');
  }

  function applyFilter(cat) {
    active = cat;
    const filtered = cat === 'all'
      ? events
      : events.filter(function (e) { return e.category === cat; });
    render(filtered);

    if (filterBtns) {
      filterBtns.forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.filter === cat);
      });
    }
  }

  if (filterBtns) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () { applyFilter(btn.dataset.filter); });
    });
  }

  applyFilter('all');
}

/* ── News Renderer ───────────────────────────────────────────── */
function renderNews(items, featuredId, gridId, sidebarBtns) {
  const featuredEl = document.getElementById(featuredId);
  const gridEl     = document.getElementById(gridId);
  if (!featuredEl || !gridEl || items.length === 0) return;

  let active = 'all';

  const tagColor = {
    'upcoming':  'var(--clr-gold)',
    'award':     '#b07cc6',
    'community': '#5a9bd5',
  };

  function tagClass(cat) {
    return cat === 'award' ? 'tag-award' : cat === 'community' ? 'tag-community' : '';
  }

  function render(list) {
    const [first, ...rest] = list;
    if (!first) { featuredEl.innerHTML = '<p class="no-events">No news found.</p>'; gridEl.innerHTML = ''; return; }

    featuredEl.innerHTML = `
      ${first.image ? `<img src="${escAttr(first.image)}" alt="${escAttr(first.title)}" loading="lazy">` : ''}
      <div class="news-featured-body">
        <span class="tag ${tagClass(first.category)}" style="color:${tagColor[first.category] || 'var(--clr-gold)'}">
          ${escHtml(first.category)}
        </span>
        <h2>${escHtml(first.title)}</h2>
        <p class="meta">${formatDateLong(first.date)}</p>
        <p>${escHtml(first.excerpt)}</p>
      </div>`;

    gridEl.innerHTML = rest.slice(0, 6).map(function (item) {
      return `
        <article class="card">
          ${item.image
            ? `<img class="card-img" src="${escAttr(item.image)}" alt="${escAttr(item.title)}" loading="lazy">`
            : `<div class="card-img-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 9 5 5 4-4 6 7"/></svg></div>`}
          <div class="card-body">
            <span class="card-tag ${tagClass(item.category)}">${escHtml(item.category)}</span>
            <h3 class="card-title">${escHtml(item.title)}</h3>
            <p class="card-meta">${formatDateLong(item.date)}</p>
            <p class="card-excerpt">${escHtml(item.excerpt)}</p>
            <span class="card-link" aria-hidden="true">Read more &#8594;</span>
          </div>
        </article>`;
    }).join('');
  }

  function applyFilter(cat) {
    active = cat;
    const filtered = cat === 'all'
      ? items
      : items.filter(function (i) { return i.category === cat; });
    render(filtered);

    if (sidebarBtns) {
      sidebarBtns.forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.filter === cat);
      });
    }
  }

  if (sidebarBtns) {
    sidebarBtns.forEach(function (btn) {
      btn.addEventListener('click', function () { applyFilter(btn.dataset.filter); });
    });
  }

  applyFilter('all');
}

/* ── Home preview loaders ────────────────────────────────────── */
async function loadHomePreview() {
  const [events, news] = await Promise.all([
    loadJSON('data/events.json'),
    loadJSON('data/news.json'),
  ]);

  // Featured upcoming event
  const evContainer = document.getElementById('home-next-event');
  if (evContainer && events.length > 0) {
    const next = events.find(function (e) { return e.featured; })
      || events.find(function (e) { return !parseDateParts(e.date).isPast; })
      || events[0];
    const date = parseDateParts(next.date);
    evContainer.querySelector('.featured-card-body .tag').textContent = next.category;
    evContainer.querySelector('.featured-card-body h3').textContent = next.title;
    const composer = evContainer.querySelector('.featured-card-body .composer');
    if (composer) composer.textContent = next.composer ? 'by ' + next.composer : '';
    const items = evContainer.querySelectorAll('.featured-meta-item');
    if (items[0]) items[0].lastChild.textContent = ' ' + formatDateLong(next.date) + (next.time ? ' · ' + next.time : '');
    if (items[1]) items[1].lastChild.textContent = ' ' + (next.venue || 'TBA');
  }

  // News mini-cards
  const newsContainer = document.getElementById('home-news-grid');
  if (newsContainer && news.length > 0) {
    newsContainer.innerHTML = news.slice(0, 3).map(function (item) {
      return `
        <article class="card">
          ${item.image
            ? `<img class="card-img" src="${escAttr(item.image)}" alt="${escAttr(item.title)}" loading="lazy">`
            : `<div class="card-img-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 9 5 5 4-4 6 7"/></svg></div>`}
          <div class="card-body">
            <span class="card-tag">${escHtml(item.category)}</span>
            <h3 class="card-title">${escHtml(item.title)}</h3>
            <p class="card-meta">${formatDateLong(item.date)}</p>
            <p class="card-excerpt">${escHtml(item.excerpt)}</p>
            <a href="news.html" class="card-link" aria-label="Read more about ${escAttr(item.title)}">Read more &#8594;</a>
          </div>
        </article>`;
    }).join('');
  }
}

/* ── Security: output-escaping helpers ──────────────────────── */
function escHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function escAttr(str) {
  return escHtml(String(str || ''));
}
