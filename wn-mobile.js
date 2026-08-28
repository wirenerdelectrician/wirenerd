/* ===========================================================
   WireNerd — shared mobile behaviour
   1. Collapses the site nav into a hamburger drawer on phones.
   2. Makes wide ladder diagrams tap-to-enlarge.
   Safe to load on every page; does nothing if it finds no nav.
   =========================================================== */
(function () {
  'use strict';

  /* ---------- 1. hamburger nav ---------- */

  // The site grew three different nav shells. Match them in order
  // of specificity and use whichever one this page actually has.
  var SHELLS = [
    { root: 'nav.topnav',      bar: '.wrap',    links: '.navlinks'   },
    { root: 'header.wn-head',  bar: '.wn-wrap', links: 'nav.wn-nav'  },
    { root: 'header',          bar: '.wrap',    links: 'nav'         }
  ];

  function buildNav() {
    var root, bar, links, i, spec;

    for (i = 0; i < SHELLS.length; i++) {
      spec  = SHELLS[i];
      root  = document.querySelector(spec.root);
      if (!root) continue;
      bar   = root.querySelector(spec.bar);
      links = root.querySelector(spec.links);
      if (bar && links) break;
      root = null;
    }
    if (!root || !bar || !links) return;              // no nav on this page
    if (root.classList.contains('wn-mnav')) return;   // already wired

    // A two-link nav doesn't need a hamburger.
    if (links.querySelectorAll('a').length <= 3) return;

    root.classList.add('wn-mnav');
    bar.classList.add('wn-mnav-bar');
    links.classList.add('wn-mnav-links');

    var btn = document.createElement('button');
    btn.className = 'wn-mnav-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="wn-bars"><i></i><i></i><i></i></span>';
    bar.appendChild(btn);

    function setOpen(open) {
      root.classList.toggle('wn-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!root.classList.contains('wn-open'));
    });

    // Close on: link tap, outside tap, Escape, or growing past the breakpoint.
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (!root.classList.contains('wn-open')) return;
      if (!root.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 860) setOpen(false);
    });
  }

  /* ---------- 2. tap-to-enlarge diagrams ---------- */

  var MIN_VB_WIDTH = 520;   // anything this wide is unreadable shrunk to a phone
  var lb = null;

  function lightbox() {
    if (lb) return lb;
    lb = document.createElement('div');
    lb.className = 'wn-lightbox';
    lb.innerHTML =
      '<div class="wn-lb-bar"><span>Pinch or scroll to read &middot; tap &times; to close</span>' +
      '<button class="wn-lb-close" type="button" aria-label="Close">&times;</button></div>' +
      '<div class="wn-lb-scroll"></div>';
    document.body.appendChild(lb);

    function close() {
      lb.classList.remove('wn-lb-open');
      lb.querySelector('.wn-lb-scroll').innerHTML = '';
      document.body.style.overflow = '';
    }
    lb.querySelector('.wn-lb-close').addEventListener('click', close);
    lb.addEventListener('click', function (e) {
      if (e.target === lb) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    return lb;
  }

  function openDiagram(svg) {
    var box = lightbox();
    var scroll = box.querySelector('.wn-lb-scroll');
    scroll.innerHTML = '';
    var clone = svg.cloneNode(true);
    clone.removeAttribute('class');
    clone.removeAttribute('style');
    scroll.appendChild(clone);
    box.classList.add('wn-lb-open');
    document.body.style.overflow = 'hidden';
  }

  function buildDiagrams() {
    var svgs = document.querySelectorAll('svg[viewBox]');
    Array.prototype.forEach.call(svgs, function (svg) {
      // Skip live/interactive canvases — the sandboxes handle their own touch.
      if (svg.id === 'panel' || svg.classList.contains('canvas')) return;
      if (svg.closest('.wn-lightbox')) return;

      var vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/);
      var w = parseFloat(vb[2]);
      if (!(w >= MIN_VB_WIDTH)) return;

      svg.classList.add('wn-zoomable');
      svg.addEventListener('click', function () {
        if (window.innerWidth > 700) return;   // desktop shows it fine already
        openDiagram(svg);
      });

      var hint = document.createElement('div');
      hint.className = 'wn-zoomhint';
      hint.textContent = 'Tap diagram to enlarge';
      if (svg.parentNode) svg.parentNode.insertBefore(hint, svg.nextSibling);
    });
  }

  function init() { buildNav(); buildDiagrams(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
