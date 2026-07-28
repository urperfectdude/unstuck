/* =============================================================================
   Unstuck House: interactions
   Everything degrades gracefully: with JS off the page is fully readable and
   the form still posts (once you wire FORM_ENDPOINT to a real handler).
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     CONFIG
     ------------------------------------------------------------------ */

  // Where the application POSTs. This is the Cloudflare Worker in ./worker,
  // which holds the Telegram bot token and relays each application to the chat.
  // The token must never appear here: this file is public.
  // Leave null to run the form in demo mode: it validates and shows the
  // confirmation, but sends nothing.
  var FORM_ENDPOINT = null;  // e.g. 'https://unstuck-apply.<subdomain>.workers.dev'

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.add('js');

  /* ---------------------------------------------------------------------
     HERO LOAD-IN
     ------------------------------------------------------------------ */

  var hero = document.querySelector('.hero');
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (hero) hero.classList.add('is-loaded');
    });
  });

  /* ---------------------------------------------------------------------
     SCROLL REVEAL
     ------------------------------------------------------------------ */

  var revealTargets = document.querySelectorAll('[data-reveal], [data-reveal-words]');

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    // Split statement copy into per-word masks before observing.
    document.querySelectorAll('[data-reveal-words]').forEach(splitWords);

    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('is-visible');
        // Mark the parent list item too, so dots/step numbers can react.
        var group = el.closest('.day, .step');
        if (group) group.classList.add('is-visible');
        revealObserver.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    revealTargets.forEach(function (el, i) {
      // Stagger siblings inside a grid/list so they cascade rather than pop.
      var sibs = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      if (el.matches('.card, .step, .qa, .day, .fit__col')) {
        el.style.transitionDelay = Math.min(sibs, 6) * 70 + 'ms';
      }
      revealObserver.observe(el);
    });
  }

  function splitWords(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(function (node) {
      var parts = node.nodeValue.split(/(\s+)/);
      var frag = document.createDocumentFragment();
      parts.forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        var outer = document.createElement('span');
        outer.className = 'word';
        var inner = document.createElement('span');
        inner.textContent = part;
        outer.appendChild(inner);
        frag.appendChild(outer);
      });
      node.parentNode.replaceChild(frag, node);
    });

    // Cascade the words left to right.
    el.querySelectorAll('.word > span').forEach(function (span, i) {
      span.style.transitionDelay = Math.min(i * 20, 420) + 'ms';
    });
  }

  /* ---------------------------------------------------------------------
     REEL: one play/pause button, driven over the YouTube iframe API.

     The shield above the iframe eats all pointer events, so this button is the
     only thing that can touch playback. State is tracked locally: the video is
     looping, so it never ends on its own and can't drift out of sync.
     ------------------------------------------------------------------ */

  var player = document.getElementById('reel-player');
  var reelToggle = document.querySelector('[data-reel-toggle]');

  if (player && reelToggle) {
    var reelFrame = player.closest('.reel__frame');
    var reelLabel = reelToggle.querySelector('[data-reel-label]');
    var wantsPlay = true;  // what the person asked for
    var inView = true;     // whether it's worth playing to
    var sent = 'playVideo';  // it autoplays, so that's the standing state

    // Redundant commands are skipped: every postMessage makes the player flash
    // its own UI, so the quietest player is one we talk to as little as possible.
    var apply = function () {
      var want = wantsPlay && inView ? 'playVideo' : 'pauseVideo';
      reelFrame.classList.toggle('is-paused', want === 'pauseVideo');
      if (want === sent) return;
      sent = want;
      command(want);
    };

    reelToggle.addEventListener('click', function () {
      wantsPlay = !wantsPlay;
      reelToggle.setAttribute('aria-pressed', String(wantsPlay));
      reelLabel.textContent = wantsPlay ? 'Pause the reel' : 'Play the reel';
      apply();
    });

    // Don't leave it playing to nobody once it's scrolled past.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          inView = entry.isIntersecting;
          apply();
        });
      }, { threshold: 0.25 }).observe(player);
    }
  }

  function command(func) {
    player.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: func, args: [] }),
      'https://www.youtube-nocookie.com'
    );
  }

  /* ---------------------------------------------------------------------
     SCROLL PROGRESS + STICKY CTA
     ------------------------------------------------------------------ */

  var progress = document.querySelector('[data-progress]');
  var stickybar = document.querySelector('[data-stickybar]');
  var applySection = document.getElementById('apply');
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      if (progress) progress.style.transform = 'scaleX(' + ratio + ')';

      if (stickybar) {
        var pastHero = window.scrollY > window.innerHeight * 0.85;
        // Hide it once the form itself is on screen, or the bar competes.
        var atForm = applySection && applySection.getBoundingClientRect().top < window.innerHeight * 0.7;
        stickybar.classList.toggle('is-shown', pastHero && !atForm);
      }
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------------------------------------------------------------------
     PRICE COUNT-UP
     ------------------------------------------------------------------ */

  var counters = document.querySelectorAll('[data-countup]');
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target, parseInt(entry.target.dataset.countup, 10));
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { countObserver.observe(el); });
  }

  function countUp(el, target) {
    var start = performance.now();
    var duration = 900;
    function frame(now) {
      var t = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en-IN');
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------------
     FAQ: one open at a time, animated both ways.

     A closed <details> doesn't render its children, so the 0fr -> 1fr grid
     transition can't run off [open] alone. We drive it with .is-open and only
     flip the `open` attribute after the closing transition finishes.
     ------------------------------------------------------------------ */

  var qas = Array.prototype.slice.call(document.querySelectorAll('.qa'));

  qas.forEach(function (qa) {
    var summary = qa.querySelector('summary');
    var panel = qa.querySelector('.qa__panel');

    summary.addEventListener('click', function (e) {
      e.preventDefault();
      if (qa.classList.contains('is-open')) closeQa(qa, panel);
      else openQa(qa, panel);
    });
  });

  function openQa(qa, panel) {
    qas.forEach(function (other) {
      if (other !== qa && other.classList.contains('is-open')) {
        closeQa(other, other.querySelector('.qa__panel'));
      }
    });
    qa.open = true;
    if (reduceMotion) { qa.classList.add('is-open'); return; }
    requestAnimationFrame(function () { qa.classList.add('is-open'); });
  }

  function closeQa(qa, panel) {
    qa.classList.remove('is-open');
    if (reduceMotion) { qa.open = false; return; }
    var done = function (e) {
      if (e.propertyName !== 'grid-template-rows') return;
      panel.removeEventListener('transitionend', done);
      if (!qa.classList.contains('is-open')) qa.open = false;
    };
    panel.addEventListener('transitionend', done);
  }

  /* ---------------------------------------------------------------------
     FORM: character counts, validation, submit
     ------------------------------------------------------------------ */

  var form = document.getElementById('application-form');
  if (!form) return;

  var confirmation = document.getElementById('confirmation');
  var formError = form.querySelector('[data-form-error]');

  // Live character counts on the two questions that decide the application.
  form.querySelectorAll('[data-counter]').forEach(function (field) {
    var out = field.closest('.field').querySelector('[data-count]');
    var min = parseInt(field.getAttribute('minlength') || '0', 10);
    var update = function () {
      var n = field.value.trim().length;
      out.textContent = n < min ? n + ' / ' + min : n;
      out.style.color = n >= min ? 'var(--accent)' : '';
    };
    field.addEventListener('input', update);
    update();
  });

  /* --- "Book your 15": bound the date to the next three weeks and echo the
         choice back so the person can see what they've asked for. --- */

  var slot = form.querySelector('[data-slot]');
  var dateInput = document.getElementById('f-calldate');

  if (slot && dateInput) {
    var today = new Date();
    var horizon = new Date(today.getTime() + 21 * 864e5);
    dateInput.min = toISODate(today);
    dateInput.max = toISODate(horizon);

    var summary = slot.querySelector('[data-slot-summary]');
    var summaryText = slot.querySelector('[data-slot-text]');

    slot.addEventListener('change', function () {
      var phrase = describeSlot();
      if (!phrase) return;
      summaryText.textContent = phrase;
      summary.hidden = false;
    });
  }

  function toISODate(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  // "Tue 5 Aug, morning (9–12 IST)", only once both halves are chosen.
  function describeSlot() {
    if (!dateInput || !dateInput.value) return '';
    var picked = form.querySelector('input[name="call_window"]:checked');
    if (!picked) return '';

    var parts = dateInput.value.split('-');
    var day = new Date(+parts[0], parts[1] - 1, +parts[2]);
    var when = day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    var window_ = picked.value.split(' · ');
    return when + ', ' + window_[0].toLowerCase() + ' (' + window_[1] + ' IST)';
  }

  // Clear a field's error as soon as the person starts fixing it.
  form.addEventListener('input', function (e) {
    var field = e.target.closest('.field');
    if (field && field.classList.contains('has-error')) {
      field.classList.remove('has-error');
      field.querySelector('[data-error]').textContent = '';
    }
  });
  form.addEventListener('change', function (e) {
    var field = e.target.closest('.field');
    if (field) field.classList.remove('has-error');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formError.hidden = true;

    var problems = validate();
    if (problems.length) {
      form.classList.remove('is-invalid');
      void form.offsetWidth; // restart the shake
      form.classList.add('is-invalid');
      problems[0].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      var focusable = problems[0].querySelector('input, textarea, select');
      if (focusable) setTimeout(function () { focusable.focus({ preventScroll: true }); }, reduceMotion ? 0 : 450);
      return;
    }

    var button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.querySelector('span').textContent = 'Sending…';

    send(collect())
      .then(showConfirmation)
      .catch(function () {
        button.disabled = false;
        button.querySelector('span').textContent = 'Send my application';
        formError.textContent = "That didn't go through. Try again, or email us and we'll take it that way.";
        formError.hidden = false;
      });
  });

  function validate() {
    var failed = [];

    form.querySelectorAll('.field').forEach(function (field) {
      var input = field.querySelector('input:not([type="radio"]), textarea, select');
      var radios = field.querySelectorAll('input[type="radio"]');
      var errorEl = field.querySelector('[data-error]');
      var message = '';

      if (radios.length) {
        var picked = field.querySelector('input[type="radio"]:checked');
        if (!picked) message = 'Pick one.';
        else if (picked.value === 'No') message = 'All three days is the whole point. We can only take full-weekend applications.';
      } else if (input && input.type === 'date' && input.required) {
        if (!input.value) message = 'Pick a day.';
        else if (input.value < input.min) message = 'That day has passed. Pick one coming up.';
        else if (input.max && input.value > input.max) message = 'Keep it within the next three weeks.';
      } else if (input && input.required) {
        var value = input.value.trim();
        var min = parseInt(input.getAttribute('minlength') || '0', 10);
        if (!value) message = 'This one is required.';
        else if (input.type === 'email' && !/^\S+@\S+\.\S+$/.test(value)) {
          message = "That doesn't look like an email address.";
        } else if (input.type === 'tel' && value.replace(/\D/g, '').length < 7) {
          message = 'A number we can actually reach you on, please.';
        } else if (min && value.length < min) {
          message = 'Give us a bit more: at least ' + min + ' characters.';
        }
      }

      field.classList.toggle('has-error', !!message);
      if (errorEl) errorEl.textContent = message;
      if (message) failed.push(field);
    });

    return failed;
  }

  function collect() {
    var data = {};
    new FormData(form).forEach(function (value, key) { data[key] = value; });
    data.submitted_at = new Date().toISOString();
    data.cohort = '01 · 25–27 Sept 2026';
    data.call_slot = describeSlot();
    return data;
  }

  function send(data) {
    if (!FORM_ENDPOINT) {
      // Demo mode: nothing leaves the browser.
      console.info('[unstuck] no FORM_ENDPOINT set; application not sent:', data);
      return new Promise(function (resolve) { setTimeout(resolve, 600); });
    }
    return fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
    });
  }

  function showConfirmation() {
    var slotEcho = confirmation.querySelector('[data-confirm-slot]');
    var phrase = describeSlot();
    if (slotEcho && phrase) slotEcho.textContent = phrase;

    form.hidden = true;
    var head = document.querySelector('.apply__head');
    if (head) head.hidden = true;
    confirmation.hidden = false;
    if (stickybar) stickybar.classList.remove('is-shown');
    confirmation.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    confirmation.setAttribute('tabindex', '-1');
    confirmation.focus({ preventScroll: true });
  }
})();
