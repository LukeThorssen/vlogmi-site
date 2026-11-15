// The emoji page: tap an emoji to open it, search, jump between kinds, Surprise me.
// Everything it shows is already in the page (written by build-emoji.mjs); nothing is fetched.
(() => {
  const $ = id => document.getElementById(id);
  const cells = [...document.querySelectorAll('.e')], sections = [...document.querySelectorAll('.cat')];
  const chips = [...document.querySelectorAll('#chips a')];
  const fx = $('fx'), dock = $('dock'), art = $('dock-art'), name = $('dock-name'), copy = $('copy'), q = $('q');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  let chosen = null;

  // ---------- Thrown copies ----------
  const fly = (id, size, left, top, frames, options) => {
    const img = new Image(size, size);
    img.src = `art/s/${id}.webp`; img.alt = '';
    img.style.cssText = `left:${left}px;top:${top}px;width:${size}px;height:${size}px`;
    fx.append(img);
    img.animate(frames, { fill: 'both', ...options }).finished.then(() => img.remove(), () => img.remove());
  };
  // A handful fly up and out from where you tapped, then fall away.
  function burst(id, x, y) {
    if (calm) return;
    for (let i = 0; i < 8; i++) {
      const size = rand(26, 54), angle = -Math.PI / 2 + rand(-1.25, 1.25), far = rand(90, 220), turn = rand(-70, 70);
      const dx = Math.cos(angle) * far, dy = Math.sin(angle) * far;
      fly(id, size, x - size / 2, y - size / 2, [
        { transform: 'translate(0,0) scale(.3) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(1) rotate(${turn}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx * 1.15}px,${dy + 90}px) scale(.85) rotate(${turn * 1.5}deg)`, opacity: 0 },
      ], { duration: rand(900, 1400), easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
  }
  // A shower of one emoji down the whole screen.
  function rain(id) {
    if (calm) return;
    const drops = Math.min(34, Math.round(innerWidth / 26));
    for (let i = 0; i < drops; i++) {
      const size = rand(30, 76), turn = rand(-120, 120);
      fly(id, size, rand(-20, innerWidth - size + 20), -size - 10, [
        { transform: 'translateY(0) rotate(0deg)' },
        { transform: `translateY(${innerHeight + size + 30}px) rotate(${turn}deg)` },
      ], { duration: rand(1300, 2400), delay: rand(0, 700), easing: 'cubic-bezier(.4,0,.8,.6)' });
    }
  }

  // ---------- The opened emoji ----------
  function open(cell) {
    if (chosen) chosen.classList.remove('is-on');
    chosen = cell; cell.classList.add('is-on');
    art.src = `art/l/${cell.dataset.id}.webp`;
    name.textContent = cell.getAttribute('aria-label');
    copy.textContent = 'Copy';
    dock.inert = false; dock.classList.add('is-on');
    replay(art, 'pop');
  }
  function close() {
    if (chosen) chosen.classList.remove('is-on');
    chosen = null; dock.classList.remove('is-on'); dock.inert = true;
  }
  for (const cell of cells) cell.addEventListener('click', event => {
    const box = cell.getBoundingClientRect();
    // A keyboard press has no pointer position, so the burst starts from the middle of the emoji.
    const x = event.detail ? event.clientX : box.left + box.width / 2, y = event.detail ? event.clientY : box.top + box.height / 2;
    burst(cell.dataset.id, x, y);
    open(cell);
  });
  $('dock-x').addEventListener('click', close);
  addEventListener('keydown', event => { if (event.key === 'Escape' && chosen) { const back = chosen; close(); back.focus(); } });
  // Copy puts the emoji itself on the clipboard, so it can be pasted anywhere.
  if (!navigator.clipboard) copy.hidden = true;
  copy.addEventListener('click', () => {
    if (!chosen) return;
    navigator.clipboard.writeText(chosen.dataset.u).then(() => { copy.textContent = 'Copied'; burst(chosen.dataset.id, innerWidth / 2, innerHeight - 90); }, () => { copy.textContent = 'Not copied'; });
  });

  // ---------- Surprise me, and the three beside the headline ----------
  // Flags are left out of the random picks so they do not crowd out everything else.
  const main = cells.filter(cell => !cell.closest('.cat-extra')), mixed = main.filter(cell => cell.closest('.cat').id !== 'flags');
  const pool = mixed.length ? mixed : main;
  const trio = [...document.querySelectorAll('#trio img')], used = new Set();
  for (const img of trio) { let cell; do cell = pick(pool); while (used.has(cell) && used.size < pool.length); used.add(cell); img.src = `art/l/${cell.dataset.id}.webp`; }
  $('surprise').addEventListener('click', () => {
    if (q.value) { q.value = ''; search(); }
    const cell = pick(pool);
    rain(cell.dataset.id); open(cell); replay($('count'), 'pop');
  });

  // ---------- Search ----------
  function search() {
    const words = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let any = false;
    for (const section of sections) {
      let shown = 0;
      // While searching, the New row is hidden so nothing shows twice.
      if (!(words.length && section.classList.contains('cat-extra'))) for (const cell of section.querySelectorAll('.e')) {
        const match = words.every(word => cell.dataset.k.includes(word));
        cell.hidden = !match; if (match) shown++;
      }
      section.hidden = !shown; any ||= shown > 0;
    }
    $('none-q').textContent = q.value.trim(); $('none').hidden = any;
    // A kind's total would be wrong beside a handful of results, so it is hidden while searching.
    $('sets').classList.toggle('is-searching', words.length > 0);
    if (chosen && (chosen.hidden || chosen.closest('.cat').hidden)) close();
    mark();
  }
  q.addEventListener('input', () => {
    search();
    // Bring the results right under the bar: from the top of the page they would be below the fold, and
    // from far down a now-shorter page they would be above it.
    // Measured from the emoji, not the bar: once the bar is stuck to the top its own position says nothing.
    const top = Math.round($('sets').getBoundingClientRect().top + scrollY - $('bar').offsetHeight);
    if (q.value.trim() ? Math.abs(scrollY - top) > 1 : scrollY > top) scrollTo({ top, behavior: 'instant' });
  });

  // ---------- Which kind is on screen ----------
  let current = null, ticking = false;
  function mark() {
    ticking = false;
    const line = $('bar').getBoundingClientRect().bottom + 24, open = sections.filter(section => !section.hidden);
    let now = open[0];
    for (const section of open) if (section.getBoundingClientRect().top <= line) now = section;
    // At the very bottom the last kind may be too short to reach the line.
    if (open.length && innerHeight + scrollY >= document.documentElement.scrollHeight - 2 && open.at(-1).getBoundingClientRect().top < innerHeight) now = open.at(-1);
    if (now === current) return;
    current = now;
    for (const chip of chips) {
      const on = !!now && chip.hash === `#${now.id}`;
      if (on) chip.setAttribute('aria-current', 'true'); else chip.removeAttribute('aria-current');
      // Slide the row of kinds so the current one is in view, without moving the page.
      if (on) { const row = chip.parentElement, target = chip.offsetLeft - row.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2; row.scrollTo({ left: target, behavior: calm ? 'instant' : 'smooth' }); }
    }
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, { passive: true });
  addEventListener('resize', mark);
  // Choosing a kind while a search is on clears the search first, so the kind is there to jump to.
  for (const chip of chips) chip.addEventListener('click', () => { if (q.value) { q.value = ''; search(); } });
  mark();
})();
