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
  function update() {
    queued = false;
    setSun();
    // The current post is the one nearest the middle of the screen. In the film strip, which
    // scrolls sideways, only the first post that is at least half in view can be current.
    var middle = (window.innerHeight + bar.offsetHeight) / 2, i = 0, best = Infinity, filmLead = null;
    entries.forEach(function (entry, n) {
      var box = entry.getBoundingClientRect();
      if (entry.closest('.film')) {
        if (filmLead !== null || box.left + box.width / 2 < 0) return;
        filmLead = n;
      }
      var distance = Math.abs(box.top + box.height / 2 - middle);
      if (distance < best) { best = distance; i = n; }
    });
    if (i === current) return;
    current = i;
    line.style.setProperty('--x', ticks[i].style.left);
    now.textContent = posts[i].time;
    ticks.forEach(function (tick, n) { tick.classList.toggle('past', n <= i); if (n === i) tick.setAttribute('aria-current', 'true'); else tick.removeAttribute('aria-current'); });
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  film.addEventListener('scroll', queue, { passive: true });
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
    // Centre the post in the space under the day bar; in the film strip, also slide it into view.
    var entry = entries[n], strip = entry.closest('.film'), behavior = calm ? 'auto' : 'smooth', box = entry.getBoundingClientRect();
    if (strip) strip.scrollTo({ left: strip.scrollLeft + box.left - strip.getBoundingClientRect().left - parseFloat(getComputedStyle(strip).paddingLeft), behavior: behavior });
    window.scrollTo({ top: window.scrollY + box.top + box.height / 2 - (window.innerHeight + bar.offsetHeight) / 2, behavior: behavior });
  });
  update();
})();
