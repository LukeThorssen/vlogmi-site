// Morning to Night: clips play as they come into view, the floating timeline follows along, any post
// opens the day player from that point, and How it works has three small working pieces of the app
// (camera, mini vlog, calendar). The clock times are plain text: they used to count up, which showed
// wrong times mid-count (removed November 14).
(function () {
  var data = JSON.parse(document.getElementById('data').textContent), posts = data.posts, root = data.root;
  var items = posts.map(function (p) { return { src: root + p.src, clip: p.clip ? root + p.clip : '', time: p.time, len: p.len || '', seconds: p.seconds }; });
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saver = navigator.connection && navigator.connection.saveData;
  var videos = [].slice.call(document.querySelectorAll('video[data-src]')), playing = false;
  var inView = function (fn, options) { return 'IntersectionObserver' in window ? new IntersectionObserver(fn, options) : null; };

  // Clips (including the camera's viewfinder): load and play only while mostly on screen.
  // Stills are shown with reduced motion or data saver. They are always silent on the page.
  var watch = !calm && !saver && inView(function (seen) {
    seen.forEach(function (item) {
      var video = item.target;
      video.dataset.seen = item.intersectionRatio >= 0.6 ? '1' : '';
      if (video.dataset.seen && !playing && !video.dataset.held) { if (!video.src) video.src = video.dataset.src; video.play().catch(function () {}); }
      else video.pause();
    });
  }, { threshold: [0, 0.6] });
  if (watch) videos.forEach(function (video) { watch.observe(video); });

  function openPlayer(start) {
    playing = true;
    videos.forEach(function (video) { video.pause(); });
    window.VlogPlayer.open({ title: 'Sunday, October 4', items: items, start: start, onClose: function () {
      playing = false;
      videos.forEach(function (video) { if (video.dataset.seen && video.src && !video.dataset.held) video.play().catch(function () {}); });
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
  document.addEventListener('click', function (e) {
    var button = e.target.closest('[data-play]');
    if (!button) return;
    var start = Number(button.dataset.play);
    if (!button.classList.contains('frame') || !e.detail) return openPlayer(start);
    var now = Date.now();
    if (pending && lastFrame === button && now - lastTap < 320) { clearTimeout(pending); pending = null; like(button, e); return; }
    clearTimeout(pending); lastTap = now; lastFrame = button;
    pending = setTimeout(function () { pending = null; openPlayer(start); }, 280);
  });

  // Download buttons: the "Out now" sticker pops on the first time its button is well into view.
  var getWatch = !calm && inView(function (seen) {
    seen.forEach(function (item) { if (item.isIntersecting) { item.target.classList.add('is-seen'); getWatch.unobserve(item.target); } });
  }, { rootMargin: '0px 0px -12% 0px' });
  if (getWatch) {
    document.documentElement.classList.add('pop-wait');
    [].slice.call(document.querySelectorAll('.get-tag')).forEach(function (tag) { getWatch.observe(tag.parentNode); });
  }

  // ---------- Header and floating timeline ----------
  var head = document.getElementById('head'), dayline = document.getElementById('dayline');
  var entries = [].slice.call(document.querySelectorAll('.entry')), segs = [].slice.call(document.querySelectorAll('.seg'));
  var now = document.getElementById('now'), thumb = document.getElementById('dl-thumb'), emoji = document.getElementById('dl-emoji');
  var play = dayline.querySelector('.dl-play'), peek = document.getElementById('dl-peek');
  var night = document.getElementById('night'), how = document.getElementById('how'), nightEnd = night.querySelector('.aside');
  var current = 0, queued = false;
  // Sunset: how far the sun has set follows how far the sunset section has scrolled past.
  var dusk = document.querySelector('.dusk'), land = dusk.querySelector('.land');
  function setSun() {
    var box = dusk.getBoundingClientRect(), progress = (window.innerHeight * 0.85 - box.top) / box.height;
    dusk.style.setProperty('--fall', (box.height - 120) + 'px');
    if (!calm) dusk.style.setProperty('--set', Math.max(0, Math.min(1, progress)).toFixed(3));
  }
  function headHeight() { return head.offsetHeight; }
  // The very top of the page always belongs to the first post, even on a tall monitor where the
  // second one sits nearer the middle.
  function topZone() { return Math.min(110, window.innerHeight * 0.12); }
  // Where the eye rests: a little above the middle of the space under the header. The current post
  // is the one nearest this line, and jumping to a post puts it here.
  function focusLine() { var top = headHeight(); return top + (window.innerHeight - top) * 0.42; }
  function show(i) {
    current = i;
    now.textContent = posts[i].time;
    thumb.src = root + posts[i].src;
    play.dataset.play = String(i);
    if (emoji.getAttribute('src') !== root + data.emoji[i]) {
      emoji.src = root + data.emoji[i];
      if (!calm) { emoji.classList.remove('pop'); void emoji.offsetWidth; emoji.classList.add('pop'); }
    }
    segs.forEach(function (seg, n) {
      seg.classList.toggle('past', n < i);
      seg.classList.toggle('is-now', n === i);
      if (n === i) seg.setAttribute('aria-current', 'true'); else seg.removeAttribute('aria-current');
    });
  }
  function update() {
    queued = false;
    setSun();
    var y = window.scrollY, h = window.innerHeight, nightTop = night.getBoundingClientRect().top, howTop = how.getBoundingClientRect().top;
    head.classList.toggle('is-scrolled', y > 8);
    // The header turns dark as soon as the dark land of the sunset reaches it, not at the night section.
    var darkTop = Math.min(nightTop, land.getBoundingClientRect().top + land.offsetHeight * 0.12);
    head.classList.toggle('is-dark', darkTop < headHeight());
    // The timeline belongs to the day: it appears after a first small scroll and slides away once the
    // last post has passed, before "That was Sunday" and How it works.
    // Where "That was Sunday" sits under the posts (phones and tablets), it also leaves as those words arrive.
    var lastBottom = entries[entries.length - 1].getBoundingClientRect().bottom, endTop = nightEnd.getBoundingClientRect().top;
    var wordsArrived = endTop > lastBottom - 1 && endTop < h - 110, ended = wordsArrived || lastBottom < headHeight() + (h - headHeight()) * 0.3;
    dayline.classList.toggle('is-on', y > 40 && !ended && howTop > h * 0.55);
    dayline.classList.toggle('is-dark', nightTop < h - 50);
    var middle = focusLine(), i = 0, best = Infinity;
    entries.forEach(function (entry, n) {
      var box = entry.getBoundingClientRect(), distance = Math.abs(box.top + box.height / 2 - middle);
      if (distance < best) { best = distance; i = n; }
    });
    if (y < topZone()) i = 0;
    // By the time the closing words arrive, the day's last post is the latest thing on screen.
    if (wordsArrived) i = entries.length - 1;
    if (i !== current) show(i);
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);

  function scrollToPost(n) {
    var box = entries[n].getBoundingClientRect(), top = window.scrollY + box.top + box.height / 2 - focusLine();
    if (n === 0) top = 0;
    if (n === 1) top = Math.max(top, topZone() + 12);
    window.scrollTo({ top: top, behavior: calm ? 'auto' : 'smooth' });
  }
  segs.forEach(function (seg, n) {
    seg.addEventListener('click', function (e) { e.preventDefault(); peek.classList.remove('is-on'); scrollToPost(n); });
    var peekAt = function () {
      peek.querySelector('img').src = root + posts[n].src;
      peek.querySelector('span').textContent = posts[n].time;
      peek.style.setProperty('--peek-x', (seg.offsetLeft + seg.offsetWidth / 2) + 'px');
      peek.classList.add('is-on');
    };
    seg.addEventListener('pointerenter', peekAt);
    seg.addEventListener('focus', peekAt);
    seg.addEventListener('blur', function () { peek.classList.remove('is-on'); });
  });
  dayline.addEventListener('pointerleave', function () { peek.classList.remove('is-on'); });

  // ---------- Step 1: the camera ----------
  var cam = document.getElementById('cam'), camVideo = cam.querySelector('video'), camNote = document.getElementById('cam-note');
  var shutter = document.getElementById('shutter'), camTimer;
  shutter.addEventListener('click', function () {
    clearTimeout(camTimer);
    cam.classList.remove('is-snap'); void cam.offsetWidth; cam.classList.add('is-snap', 'is-taken');
    camVideo.dataset.held = '1'; camVideo.pause();
    camNote.textContent = 'Got it. Add text or emoji, then post it to your day.';
    camTimer = setTimeout(function () {
      cam.classList.remove('is-taken');
      camNote.textContent = 'Tap the shutter';
      delete camVideo.dataset.held;
      if (camVideo.dataset.seen && camVideo.src && !playing) camVideo.play().catch(function () {});
    }, 3200);
  });

  // ---------- Step 2: the day as a mini vlog ----------
  var reel = document.getElementById('reel'), shots = [].slice.call(reel.querySelectorAll('.reel-shot')), bars = [].slice.call(reel.querySelectorAll('.reel-bars i'));
  var reelAt = 0, reelTimer = null, reelMs = 1600;
  reel.style.setProperty('--reel-ms', reelMs + 'ms');
  function reelShow(n) {
    reelAt = n;
    shots.forEach(function (shot, k) { shot.classList.toggle('is-on', k === n); });
    bars.forEach(function (bar, k) { bar.className = k < n ? 'done' : ''; });
    if (!calm) { void bars[n].offsetWidth; bars[n].className = 'run'; }
  }
  function reelStart() { if (reelTimer || calm) return; reelShow(reelAt); reelTimer = setInterval(function () { reelShow((reelAt + 1) % shots.length); }, reelMs); }
  function reelStop() { clearInterval(reelTimer); reelTimer = null; }
  var reelWatch = inView(function (seen) { seen.forEach(function (item) { if (item.isIntersecting) reelStart(); else reelStop(); }); }, { threshold: 0.5 });
  if (reelWatch) reelWatch.observe(reel);
  document.addEventListener('visibilitychange', function () { if (document.hidden) reelStop(); });

  // ---------- Step 3: the calendar ----------
  var cal = document.getElementById('cal'), days = [].slice.call(cal.querySelectorAll('.day'));
  var peekFig = cal.querySelector('.cal-peek'), peekImg = document.getElementById('peek-img'), peekTitle = document.getElementById('peek-title'), peekSub = document.getElementById('peek-sub');
  var picked = 4;
  function preview(d) {
    var day = data.month[d - 1], src = root + day.lead.src;
    peekTitle.textContent = day.label;
    peekSub.textContent = day.total + (day.total === 1 ? ' post' : ' posts') + (d === 4 ? ' · the day on this page' : '');
    peekImg.alt = 'Luke’s post from ' + day.label;
    if (peekImg.getAttribute('src') === src) return;
    peekFig.classList.add('is-loading');
    var next = new Image();
    next.onload = function () { peekImg.src = src; peekFig.classList.remove('is-loading'); };
    next.src = src;
  }
  function pick(d) {
    picked = d;
    days.forEach(function (day) { var on = Number(day.dataset.day) === d; day.classList.toggle('is-on', on); day.setAttribute('aria-pressed', String(on)); });
    preview(d);
  }
  days.forEach(function (day) {
    var d = Number(day.dataset.day);
    day.addEventListener('click', function () { pick(d); });
    day.addEventListener('keydown', function (e) {
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key], next = d + (step || 0);
      if (step && next >= 1 && next <= days.length) { e.preventDefault(); days[next - 1].focus(); pick(next); }
    });
  });
  // On a computer, hovering a day previews it; leaving the calendar goes back to the picked day.
  if (window.matchMedia('(hover: hover)').matches) {
    days.forEach(function (day) { day.addEventListener('pointerenter', function () { preview(Number(day.dataset.day)); }); });
    cal.querySelector('.cal-grid').addEventListener('pointerleave', function () { preview(picked); });
  }

  update();
})();
