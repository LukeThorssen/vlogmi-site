// Morning to Night: clips play as they come into view, the day bar follows along, and any post
// opens the day player from that point.
(function () {
  var data = JSON.parse(document.getElementById('data').textContent), posts = data.posts, root = data.root;
  var items = posts.map(function (p) { return { src: root + p.src, clip: p.clip ? root + p.clip : '', time: p.time, len: p.len || '', seconds: p.seconds }; });
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saver = navigator.connection && navigator.connection.saveData;
  var videos = [].slice.call(document.querySelectorAll('.frame video')), playing = false;

  // Clips: load and play only while mostly on screen. Stills are shown with reduced motion or data saver.
  if (!calm && !saver && 'IntersectionObserver' in window) {
    var watch = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        video.dataset.seen = entry.intersectionRatio >= 0.6 ? '1' : '';
        if (video.dataset.seen && !playing) { if (!video.src) video.src = video.dataset.src; video.play().catch(function () {}); }
        else video.pause();
      });
    }, { threshold: [0, 0.6] });
    videos.forEach(function (video) { watch.observe(video); });
  }

  function openPlayer(start) {
    playing = true;
    videos.forEach(function (video) { video.pause(); });
    window.VlogPlayer.open({ title: 'Sunday, October 4', items: items, start: start, onClose: function () {
      playing = false;
      videos.forEach(function (video) { if (video.dataset.seen && video.src) video.play().catch(function () {}); });
    } });
  }
  // One tap on a post opens the player there. Two quick taps like it instead: a heart pops where you tapped.
  var pending = null, lastTap = 0, lastFrame = null;
  function like(frame, e) {
    var box = frame.getBoundingClientRect(), heart = new Image();
    heart.className = 'like'; heart.alt = ''; heart.src = root + data.heart;
    heart.style.left = (e.clientX - box.left) + 'px'; heart.style.top = (e.clientY - box.top) + 'px';
    heart.addEventListener('animationend', function () { heart.remove(); });
    frame.appendChild(heart);
    if (calm) setTimeout(function () { heart.remove(); }, 900);
  }
  var toast = document.getElementById('toast'), toastTimer;
  document.addEventListener('click', function (e) {
    var store = e.target.closest('[data-store]');
    if (store) {
      // Until the app is in the App Store there is nowhere to send people, so say so.
      if (data.store) { window.location.href = data.store; return; }
      toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.hidden = true; }, 2800);
      return;
    }
    var button = e.target.closest('[data-play]');
    if (!button) return;
    var start = Number(button.dataset.play);
    if (!button.classList.contains('frame') || !e.detail) return openPlayer(start);
    var now = Date.now();
    if (pending && lastFrame === button && now - lastTap < 320) { clearTimeout(pending); pending = null; like(button, e); return; }
    clearTimeout(pending); lastTap = now; lastFrame = button;
    pending = setTimeout(function () { pending = null; openPlayer(start); }, 280);
  });

  // Film strip arrows.
  var film = document.querySelector('.film');
  document.querySelectorAll('.arrows button').forEach(function (button) {
    button.addEventListener('click', function () { film.scrollBy({ left: Number(button.dataset.dir) * 540, behavior: calm ? 'auto' : 'smooth' }); });
  });

  // Day bar: the dot sits on the post you are looking at.
  var entries = [].slice.call(document.querySelectorAll('.entry')), ticks = [].slice.call(document.querySelectorAll('.tick'));
  var line = document.querySelector('.dayline'), now = document.getElementById('now'), bar = document.querySelector('.daybar'), current = -1, queued = false;
  // Sunset: how far the sun has set follows how far the sunset section has scrolled past.
  var dusk = document.querySelector('.dusk'), sun = dusk.querySelector('.setting-sun');
  function setSun() {
    var box = dusk.getBoundingClientRect(), progress = (window.innerHeight * 0.85 - box.top) / box.height;
    dusk.style.setProperty('--fall', (box.height - 120) + 'px');
    if (!calm) dusk.style.setProperty('--set', Math.max(0, Math.min(1, progress)).toFixed(3));
  }
  // The walk strip holds six posts side by side, so they all sit at the same height on the page.
  // As the strip passes up the screen the timeline steps through them one at a time, and the strip
  // slides sideways to keep the current one in view. Scrolling the strip by hand also moves the dot.
  var countUp = function () {}; // set further down, once the timeline is ready
  var filmEntries = entries.filter(function (entry) { return entry.closest('.film'); });
  var filmFirst = entries.indexOf(filmEntries[0]), filmIndex = 0, filmStep = -1, sliding = 0;
  function stripLeft(entry) {
    return film.scrollLeft + entry.getBoundingClientRect().left - film.getBoundingClientRect().left - parseFloat(getComputedStyle(film).paddingLeft);
  }
  function slideTo(k) {
    sliding = Date.now() + 700;
    film.scrollTo({ left: stripLeft(filmEntries[k]), behavior: calm ? 'auto' : 'smooth' });
  }
  // Where the strip's middle is on screen decides the step: step 0 as it comes up past 78% of the
  // screen height, the last step by the time it reaches 24%.
  function stepAt(centre) {
    var progress = (window.innerHeight * 0.78 - centre) / (window.innerHeight * 0.54);
    return Math.max(0, Math.min(filmEntries.length - 1, Math.floor(progress * filmEntries.length)));
  }
  function topZone() { return Math.min(110, window.innerHeight * 0.12); }
  function update() {
    queued = false;
    setSun();
    var middle = (window.innerHeight + bar.offsetHeight) / 2, i = 0, best = Infinity;
    var filmBox = film.getBoundingClientRect(), step = stepAt(filmBox.top + filmBox.height / 2);
    if (step !== filmStep) { var first = filmStep < 0; filmStep = step; filmIndex = step; if (!first) slideTo(step); }
    entries.forEach(function (entry, n) {
      var inFilm = n >= filmFirst && n < filmFirst + filmEntries.length;
      if (inFilm && n !== filmFirst + filmIndex) return;
      var box = inFilm ? filmBox : entry.getBoundingClientRect();
      var distance = Math.abs(box.top + box.height / 2 - middle);
      if (distance < best) { best = distance; i = n; }
    });
    // The first two posts share the top of the page, and the taller one would otherwise never be
    // "nearest". So the very top of the page is always the first post; a short scroll moves to the second.
    if (i <= 1) i = window.scrollY < topZone() ? 0 : 1;
    if (i === current) return;
    current = i;
    if (i >= filmFirst && i < filmFirst + filmEntries.length) countUp(i);
    line.style.setProperty('--x', ticks[i].style.left);
    now.textContent = posts[i].time;
    ticks.forEach(function (tick, n) { tick.classList.toggle('past', n <= i); if (n === i) tick.setAttribute('aria-current', 'true'); else tick.removeAttribute('aria-current'); });
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  film.addEventListener('scroll', function () {
    if (Date.now() < sliding) return; // our own slide, not the visitor's
    // Scrolled by hand: the current post is the one nearest the strip's left edge, or the last one at the far end.
    var atEnd = film.scrollLeft >= film.scrollWidth - film.clientWidth - 2, nearest = Infinity;
    filmEntries.forEach(function (entry, k) { var d = Math.abs(stripLeft(entry) - film.scrollLeft); if (d < nearest) { nearest = d; filmIndex = k; } });
    if (atEnd) filmIndex = filmEntries.length - 1;
    queue();
  }, { passive: true });
  // Posts a few minutes apart have ticks that overlap, so a click goes to the tick nearest the pointer.
  line.addEventListener('click', function (e) {
    var n = ticks.indexOf(e.target.closest('.tick'));
    if (e.detail) {
      var nearest = Infinity;
      ticks.forEach(function (tick, k) {
        var box = tick.getBoundingClientRect(), distance = Math.abs(box.left + box.width / 2 - e.clientX);
        if (distance < nearest) { nearest = distance; n = k; }
      });
    }
    if (n < 0) return;
    e.preventDefault();
    var behavior = calm ? 'auto' : 'smooth', k = n - filmFirst;
    if (k >= 0 && k < filmEntries.length) {
      // A post in the walk strip: scroll to the height where the timeline is on that post's step, and slide to it.
      var strip = film.getBoundingClientRect(), centre = window.innerHeight * (0.78 - 0.54 * (k + 0.5) / filmEntries.length);
      filmStep = k; filmIndex = k; slideTo(k);
      window.scrollTo({ top: window.scrollY + strip.top + strip.height / 2 - centre, behavior: behavior });
      queue();
      return;
    }
    // Any other post: centre it in the space under the day bar. The first post is the top of the
    // page, and the second sits just past the short stretch that belongs to the first.
    var box = entries[n].getBoundingClientRect(), top = window.scrollY + box.top + box.height / 2 - (window.innerHeight + bar.offsetHeight) / 2;
    if (n === 0) top = 0;
    if (n === 1) top = Math.max(top, topZone() + 12);
    window.scrollTo({ top: top, behavior: behavior });
  });
  update();

  // Each post's big time counts up from the previous post's time, like a clock running forward to
  // that moment. It happens when the time reaches the middle band of the screen, not when it first
  // peeks in at the bottom, so on a tall monitor they go one after another as you scroll. In the walk
  // strip each time counts as the timeline steps onto its post. Once per post; skipped with reduced motion.
  var counted = {};
  function face(minutes) { var h = Math.floor(minutes / 60), m = Math.round(minutes % 60); if (m === 60) { h += 1; m = 0; } return [((h + 11) % 12 + 1) + ':' + (m < 10 ? '0' : '') + m, h % 24 < 12 ? 'am' : 'pm']; }
  countUp = function (n, wait) {
    if (calm || counted[n]) return;
    counted[n] = true;
    var to = posts[n].minutes, from = n ? posts[n - 1].minutes : to - 31;
    var clock = entries[n].querySelector('.clock'), mer = entries[n].querySelector('.mer');
    var length = Math.min(1100, 420 + (to - from) * 2.2), began = null;
    clock.textContent = face(from)[0]; mer.textContent = face(from)[1];
    var tick = function (t) {
      if (began === null) began = t;
      var p = Math.min(1, (t - began) / length), eased = 1 - Math.pow(1 - p, 3), shown = face(from + (to - from) * eased);
      clock.textContent = p === 1 ? posts[n].clock : shown[0];
      mer.textContent = p === 1 ? posts[n].mer : shown[1];
      if (p < 1) requestAnimationFrame(tick);
    };
    setTimeout(function () { requestAnimationFrame(tick); }, wait || 0);
  };
  if (!calm && 'IntersectionObserver' in window) {
    // The band runs from 18% to 62% of the way down the screen.
    var counting = new IntersectionObserver(function (seen) {
      seen.forEach(function (item) {
        if (!item.isIntersecting) return;
        counting.unobserve(item.target);
        var entry = item.target.closest('.entry'), previous = entry.previousElementSibling;
        // Two posts side by side start a beat apart.
        countUp(entries.indexOf(entry), previous && previous.classList.contains('entry') ? 160 : 0);
      });
    }, { rootMargin: '-18% 0px -38% 0px', threshold: 0.5 });
    entries.forEach(function (entry, n) { if (n < filmFirst || n >= filmFirst + filmEntries.length) counting.observe(entry.querySelector('.time')); });
    // The first two are on screen when the page opens, wherever they sit on a very tall monitor.
    countUp(0); countUp(1, 160);
    if (current >= filmFirst && current < filmFirst + filmEntries.length) countUp(current);
  }
})();
