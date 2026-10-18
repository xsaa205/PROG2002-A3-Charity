/* ============================================================================
   coverflow.js — centre-focused, snap-to-card horizontal carousel
   ----------------------------------------------------------------------------
   Turns a list of event cards into a coverflow row:

     * move with a mouse / touch drag, the mouse wheel, or the side arrows
     * the card nearest the centre scales up, regains colour, lifts on top
     * cards sliding away shrink, turn greyscale and dim (depth)
     * on release the nearest card snaps to the centre (elastic)

   No libraries: plain DOM, pointer events and requestAnimationFrame.
   The public entry point is buildCoverflow(container, events).
   ========================================================================== */
'use strict';

function buildCoverflow(container, events) {
  if (!container || !events || !events.length) return;

  /* --- markup ---------------------------------------------------------- */
  container.classList.remove('card-grid');
  container.classList.add('cf');
  container.innerHTML =
    '<button class="cf-arrow cf-prev" type="button" aria-label="Previous event">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="m15 5-7 7 7 7"/></svg>' +
    '</button>' +
    '<div class="cf-stage" tabindex="0" role="region" aria-roledescription="carousel" ' +
    'aria-label="Upcoming events">' +
      '<div class="cf-track">' +
        events
          .map(function (evt, i) {
            return '<div class="cf-item" data-index="' + i + '">' + eventCardHTML(evt) + '</div>';
          })
          .join('') +
      '</div>' +
    '</div>' +
    '<button class="cf-arrow cf-next" type="button" aria-label="Next event">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="m9 5 7 7-7 7"/></svg>' +
    '</button>';

  var stage = container.querySelector('.cf-stage');
  var track = container.querySelector('.cf-track');
  var prevBtn = container.querySelector('.cf-prev');
  var nextBtn = container.querySelector('.cf-next');
  var items = Array.prototype.slice.call(container.querySelectorAll('.cf-item'));
  var n = items.length;

  var W = 300; // card width
  var G = 30; // gap between cards
  var step = 330; // W + G, distance between two card centres
  // Start one card in when there is enough to fill both sides of the stage;
  // otherwise the centre card would sit with a large empty gap to its left.
  var index = n >= 3 ? 1 : 0; // the card currently centred
  var offset = 0; // live drag / wheel offset in px
  var dragging = false;
  var suppressClick = false;
  var wheelTarget = 0; // where the wheel wants offset to be (eased toward)
  var wheelActive = false; // rAF easing loop running
  var wheelLast = 0; // timestamp of the last wheel event
  var startX = 0;
  var startOffset = 0;
  var moved = 0;

  /* --- geometry -------------------------------------------------------- */
  function measure() {
    var stageW = stage.clientWidth || container.clientWidth || 600;
    W = Math.max(220, Math.min(360, Math.round(stageW * 0.4)));
    G = Math.round(W * 0.1);
    step = W + G;
    track.style.gap = G + 'px';
    items.forEach(function (it) {
      it.style.width = W + 'px';
    });
  }

  function clampOffset(value) {
    var minOff = -(n - 1 - index) * step; // furthest we may slide one way
    var maxOff = index * step; // ... and the other
    if (value < minOff) value = minOff - (minOff - value) * 0.35;
    if (value > maxOff) value = maxOff + (value - maxOff) * 0.35;
    return value;
  }

  /* Position the track so the active card sits dead centre (+ live offset),
     then decorate every card by how far it is from the centre. */
  function render() {
    var stageW = stage.clientWidth || container.clientWidth || 600;
    var tx = stageW / 2 - (index * step + W / 2) + offset;
    track.style.transform = 'translate3d(' + tx + 'px,0,0)';

    for (var i = 0; i < n; i++) {
      var it = items[i];
      var a = Math.abs((offset + (i - index) * step) / step); // distance in cards
      var scale = Math.max(0.7, 1 - a * 0.18);
      var gray = Math.min(1, a);
      var bright = Math.max(0.72, 1 - a * 0.16);
      var y = Math.min(a, 2) * 10;

      it.style.transform = 'translate3d(0,' + y + 'px,0) scale(' + scale.toFixed(3) + ')';
      it.style.filter = 'grayscale(' + gray.toFixed(3) + ') brightness(' + bright.toFixed(3) + ')';
      it.style.zIndex = String(100 - Math.round(a * 10));
      it.style.setProperty(
        '--cf-shadow',
        a < 0.5 ? '0 30px 60px rgba(15,36,28,.32)' : '0 12px 24px rgba(15,36,28,.14)'
      );
      if (a < 0.5) it.classList.add('is-center');
      else it.classList.remove('is-center');
    }
  }

  function updateArrows() {
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= n - 1;
  }

  function snapTo(target) {
    index = Math.max(0, Math.min(n - 1, target));
    offset = 0;
    container.classList.remove('is-dragging');
    render();
    updateArrows();
  }

  /* --- arrows ---------------------------------------------------------- */
  prevBtn.addEventListener('click', function () {
    snapTo(index - 1);
  });
  nextBtn.addEventListener('click', function () {
    snapTo(index + 1);
  });

  /* --- drag (mouse / touch via pointer events) ------------------------- */
  stage.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    wheelActive = false; // cancel any in-flight wheel easing
    dragging = true;
    moved = 0;
    startX = e.clientX;
    startOffset = offset;
    suppressClick = false;
    container.classList.add('is-dragging');
    try {
      stage.setPointerCapture(e.pointerId);
    } catch (_) {}
  });

  stage.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - startX;
    if (Math.abs(dx) > moved) moved = Math.abs(dx);
    offset = clampOffset(startOffset + dx);
    render();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    try {
      if (e.pointerId != null && stage.hasPointerCapture(e.pointerId)) {
        stage.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    if (moved > 8) suppressClick = true;

    // Elastic snap: centre whichever card is now closest.
    snapTo(Math.round(index - offset / step));
  }

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // Swallow the click that follows a real drag so links don't fire mid-swipe.
  stage.addEventListener(
    'click',
    function (e) {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick = false;
      }
    },
    true
  );

  // Don't let images start a native drag while swiping.
  stage.addEventListener('dragstart', function (e) {
    e.preventDefault();
  });

  /* --- mouse wheel (smoothed) ------------------------------------------ */
  // The wheel only updates a *target* position; a rAF loop eases the real
  // offset toward it so motion is continuous instead of one hard jump per
  // notch. When the wheel goes quiet the nearest card snaps into the centre.
  function wheelTick() {
    var diff = wheelTarget - offset;
    if (Math.abs(diff) < 0.4) {
      offset = wheelTarget;
      render();
      // once we've caught up and no wheel has arrived for a moment, settle.
      if (Date.now() - wheelLast > 110) {
        wheelActive = false;
        container.classList.remove('is-dragging');
        snapTo(Math.round(index - offset / step));
        return; // stop the loop
      }
    } else {
      offset += diff * 0.22; // ease factor (higher = snappier)
      render();
    }
    if (wheelActive) requestAnimationFrame(wheelTick);
  }

  function startWheelLoop() {
    if (wheelActive) return;
    wheelActive = true;
    // disable CSS transition so per-frame tweens are smooth (no double anim)
    container.classList.add('is-dragging');
    requestAnimationFrame(wheelTick);
  }

  stage.addEventListener(
    'wheel',
    function (e) {
      // Normalise delta across mice / trackpads (pixel / line / page modes).
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.deltaMode === 1) d *= 16; // lines -> px
      else if (e.deltaMode === 2) d *= stage.clientWidth || 600; // pages -> px
      if (!d) return;

      var atStart = index === 0 && offset === 0 && d < 0;
      var atEnd = index === n - 1 && offset === 0 && d > 0;
      if (atStart || atEnd) return; // let the page scroll at the ends

      e.preventDefault();
      wheelLast = Date.now();
      // Build the target from wherever we are: if a burst is in flight use the
      // existing target, otherwise start from the current offset.
      var base = wheelActive ? wheelTarget : offset;
      wheelTarget = clampOffset(base - d * 0.8);
      startWheelLoop();
    },
    { passive: false }
  );

  /* --- keyboard -------------------------------------------------------- */
  stage.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      snapTo(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      snapTo(index + 1);
    }
  });

  /* --- resize ---------------------------------------------------------- */
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      measure();
      render();
    }, 120);
  });

  /* --- first paint (no startup animation) ------------------------------ */
  measure();
  updateArrows();
  container.classList.add('is-dragging');
  render();
  requestAnimationFrame(function () {
    container.classList.remove('is-dragging');
  });
}
