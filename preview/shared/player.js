// The day player. VlogPlayer.open({title, items, start}) plays a day's posts in order, the way the
// app plays a daily vlog: bars along the top, tap right for next, tap left for back, hold to pause.
(function () {
  var dialog, state = null, stillMs = 4000, sound = true;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function build() {
    dialog = el('<dialog class="vp" aria-label="Day player"><div class="vp-stage">' +
      '<div class="vp-media"></div><div class="vp-bars"></div>' +
      '<div class="vp-head"><span class="dot"></span><div class="vp-who"><b></b><span class="mono" aria-live="polite"></span></div>' +
      '<button class="vp-sound" type="button" aria-label="Sound" aria-pressed="true"><svg class="on" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor"/><path d="M13.5 7a4 4 0 010 6M15.8 4.6a7.5 7.5 0 010 10.8"/></svg><svg class="off" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor"/><path d="M13.5 7.5l5 5M18.5 7.5l-5 5"/></svg></button>' +
      '<button class="vp-close" type="button" aria-label="Close player"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 4l12 12M16 4L4 16"/></svg></button></div>' +
      '<button class="vp-prev" type="button" aria-label="Previous post"></button><button class="vp-next" type="button" aria-label="Next post"></button>' +
      '<span class="vp-kind mono" hidden></span><p class="vp-hint mono">Tap right for next · hold to pause</p>' +
      '<div class="vp-end" hidden><h2></h2><p>Every post was taken in the Vlogmi camera, in this order.</p><div><button class="cta light vp-again" type="button">Watch again</button><a class="cta line vp-join" href="#early">Download the app</a></div></div>' +
      '</div></dialog>');
    document.body.appendChild(dialog);
    var q = function (s) { return dialog.querySelector(s); };
    q('.vp-close').addEventListener('click', function () { dialog.close(); });
    q('.vp-sound').addEventListener('click', function () { setSound(!sound); });
    q('.vp-next').addEventListener('click', function () { if (!state.held) go(state.i + 1); });
    q('.vp-prev').addEventListener('click', function () { if (!state.held) go(Math.max(0, state.i - 1)); });
    q('.vp-again').addEventListener('click', function () { go(0); });
    q('.vp-join').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', stop);
    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') go(state.i + 1);
      else if (e.key === 'ArrowLeft') go(Math.max(0, state.i - 1));
      else if (e.key === ' ') { e.preventDefault(); pause(!state.paused); }
    });
    // Hold to pause, as in the app.
    var timer;
    q('.vp-stage').addEventListener('pointerdown', function (e) {
      if (e.target.closest('.vp-close,.vp-sound,.vp-end')) return;
      state.held = false;
      timer = setTimeout(function () { state.held = true; pause(true); }, 220);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      q('.vp-stage').addEventListener(type, function () { clearTimeout(timer); if (state && state.held) { pause(false); setTimeout(function () { if (state) state.held = false; }, 0); } });
    });
    document.addEventListener('visibilitychange', function () { if (state && dialog.open) pause(document.hidden); });
  }
  // Sound belongs to the player only: it is on when a day is opened, can be switched off here, and
  // stops when the player closes. Clips on the page itself are always silent.
  function setSound(on) {
    sound = on;
    var button = dialog.querySelector('.vp-sound'), video = dialog.querySelector('video');
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', on ? 'Sound on. Switch sound off' : 'Sound off. Switch sound on');
    if (video) video.muted = !on;
  }
  function stop() {
    if (!state) return;
    if (state.anim) state.anim.cancel();
    var v = dialog.querySelector('video'); if (v) v.pause();
    var done = state.onClose; state = null;
    if (done) done();
  }
  function pause(on) {
    if (!state || state.ended) return;
    state.paused = on;
    var v = dialog.querySelector('video');
    if (state.anim) on ? state.anim.pause() : state.anim.play();
    if (v) on ? v.pause() : v.play().catch(function () {});
  }
  function run(bar, ms) {
    if (calm) { bar.style.transform = 'scaleX(1)'; return; }
    state.anim = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: ms, fill: 'forwards' });
    state.anim.onfinish = function () { go(state.i + 1); };
  }
  function go(i) {
    if (!state) return;
    if (state.anim) { state.anim.onfinish = null; state.anim.cancel(); state.anim = null; }
    var items = state.items, bars = dialog.querySelectorAll('.vp-bars i'), end = dialog.querySelector('.vp-end'), media = dialog.querySelector('.vp-media');
    state.ended = i >= items.length;
    end.hidden = !state.ended;
    dialog.querySelector('.vp-hint').hidden = state.ended || i > 0;
    if (state.ended) {
      bars.forEach(function (b) { b.className = 'done'; });
      var v0 = media.querySelector('video'); if (v0) v0.pause();
      end.querySelector('h2').textContent = 'That was ' + state.title + '.';
      dialog.querySelector('.vp-again').focus();
      return;
    }
    state.i = i; state.paused = false;
    var item = items[i], kind = dialog.querySelector('.vp-kind');
    bars.forEach(function (b, n) { b.className = n < i ? 'done' : ''; b.firstChild.style.transform = ''; });
    dialog.querySelector('.vp-who span').textContent = item.time + ' · ' + (i + 1) + ' of ' + items.length;
    kind.hidden = !item.len; kind.textContent = item.len ? 'Video ' + item.len : '';
    media.textContent = '';
    var img = new Image(); img.src = item.src; img.alt = ''; media.appendChild(img);
    var bar = bars[i].firstChild;
    if (item.clip) {
      var video = document.createElement('video');
      video.muted = !sound; video.loop = true; video.playsInline = true; video.preload = 'auto'; video.poster = item.src; video.src = item.clip;
      media.appendChild(video);
      var started = false, begin = function () { if (started || !state || state.i !== i) return; started = true; run(bar, Math.max(3000, (item.seconds || 4) * 1000)); };
      video.addEventListener('playing', begin);
      // If the browser refuses to start with sound, carry on silently and show sound as off.
      video.play().catch(function () { setSound(false); return video.play(); }).catch(begin);
      setTimeout(begin, 2500);
    } else {
      run(bar, stillMs);
    }
    if (items[i + 1]) { var next = new Image(); next.src = items[i + 1].src; }
  }
  window.VlogPlayer = {
    open: function (options) {
      if (!dialog) build();
      if (!dialog.showModal) return;
      state = { items: options.items, title: options.title, i: 0, onClose: options.onClose };
      dialog.querySelector('.vp-who b').textContent = '@luke · ' + options.title;
      dialog.querySelector('.vp-bars').innerHTML = options.items.map(function () { return '<i><b></b></i>'; }).join('');
      dialog.querySelector('.vp-sound').hidden = !options.items.some(function (item) { return item.clip; });
      setSound(true);
      dialog.showModal();
      go(options.start || 0);
    }
  };
})();
