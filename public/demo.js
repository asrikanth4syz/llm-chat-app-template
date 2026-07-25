(function() {
  var currentSlide = 0;
  var totalSlides = 5;
  var autoTimer = null;
  var progressTimer = null;
  var SLIDE_DURATION = 7000;

  window.openDemo = function() {
    var o = document.getElementById('demo-overlay');
    o.classList.add('open');
    gotoSlide(0);
    startAutoAdvance();
  };
  window.closeDemo = function() {
    document.getElementById('demo-overlay').classList.remove('open');
    stopAutoAdvance();
  };
  window.handleDemoOverlayClick = function(e) {
    if (e.target === document.getElementById('demo-overlay')) closeDemo();
  };

  window.gotoSlide = function(n) {
    stopAutoAdvance();
    var slides = document.querySelectorAll('.demo-slide');
    var tabs   = document.querySelectorAll('.demo-tab');
    slides.forEach(function(s, i) { s.classList.toggle('active', i === n); });
    tabs.forEach(function(t, i) { t.classList.toggle('active', i === n); });
    currentSlide = n;

    document.getElementById('demo-step-info').textContent = (n + 1) + ' of ' + totalSlides;
    var nextBtn = document.getElementById('demo-next-btn');
    if (n === totalSlides - 1) {
      nextBtn.innerHTML = 'Sign In &nbsp;<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
      nextBtn.onclick = function() { closeDemo(); };
    } else {
      nextBtn.innerHTML = 'Next &nbsp;<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
      nextBtn.onclick = nextSlide;
    }

    // Animate progress bar
    var fill = document.getElementById('demo-progress-fill');
    fill.style.transition = 'none';
    fill.style.width = '0%';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        fill.style.transition = 'width ' + (SLIDE_DURATION / 1000) + 's linear';
        fill.style.width = '100%';
      });
    });

    startAutoAdvance();
  };

  window.nextSlide = function() {
    if (currentSlide < totalSlides - 1) gotoSlide(currentSlide + 1);
  };
  window.prevSlide = function() {
    if (currentSlide > 0) gotoSlide(currentSlide - 1);
  };

  function startAutoAdvance() {
    stopAutoAdvance();
    autoTimer = setTimeout(function() {
      if (currentSlide < totalSlides - 1) gotoSlide(currentSlide + 1);
    }, SLIDE_DURATION);
  }
  function stopAutoAdvance() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }

  // Keyboard nav
  document.addEventListener('keydown', function(e) {
    var overlay = document.getElementById('demo-overlay');
    if (!overlay || !overlay.classList.contains('open')) return;
    if (e.key === 'Escape') closeDemo();
    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft')  prevSlide();
  });
})();

// Backdrop click closes the demo (formerly wired via an inline handler).
document.addEventListener('DOMContentLoaded', function () {
  var ov = document.getElementById('demo-overlay');
  if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) window.closeDemo(); });
});
