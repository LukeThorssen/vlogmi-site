// "Download the app" pills that split into iPhone and Android (markup from getApp in config.mjs,
// looks in base.css). Pressing the pill opens it; Escape, a tap anywhere else, tabbing out of it or
// opening another one closes it. Its width is set here so neighbours slide over smoothly.
(function () {
  var all = [].slice.call(document.querySelectorAll('[data-get]'));
  if (!all.length) return;

  // The two halves sit inside the closed pill (so nothing pokes past the page edge); this is the
  // width they need side by side, each as wide as the longer label.
  function natural(stores) {
    stores.style.width = 'max-content';
    var width = stores.offsetWidth;
    stores.style.width = '';
    return width;
  }

  function set(get, open, focus) {
    if (get.classList.contains('is-open') === open) return;
    var btn = get.querySelector('.get-btn'), stores = get.querySelector('.get-stores');
    get.style.width = get.offsetWidth + 'px';
    void get.offsetWidth; // start the width change from where it is now
    get.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    get.style.width = (open ? natural(stores) : btn.offsetWidth) + 'px';
    if (open) {
      all.forEach(function (other) { if (other !== get) set(other, false); });
      get.querySelector('.get-store').focus({ preventScroll: true });
    } else if (focus) btn.focus({ preventScroll: true });
  }

  all.forEach(function (get) {
    get.querySelector('.get-btn').addEventListener('click', function () { set(get, true); });
    // Once closed, go back to the natural width so a font swap or resize never leaves it wrong.
    get.addEventListener('transitionend', function (e) {
      if (e.target === get && e.propertyName === 'width' && !get.classList.contains('is-open')) get.style.width = '';
    });
    get.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(get, false, true); });
    get.addEventListener('focusout', function (e) { if (e.relatedTarget && !get.contains(e.relatedTarget)) set(get, false); });
  });
  document.addEventListener('pointerdown', function (e) {
    all.forEach(function (get) { if (!get.contains(e.target)) set(get, false); });
  });
})();
