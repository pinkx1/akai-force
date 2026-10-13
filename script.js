(() => {
  'use strict';
  const story = document.querySelector('.intro-story');
  const stage = document.querySelector('.intro-stage');
  const cover = document.querySelector('.intro-cover');
  let scheduled = false;
  function updateCover() {
    const progress = Math.min(1, Math.max(0, -story.getBoundingClientRect().top / stage.offsetHeight));
    cover.style.transform = `translateY(${(1 - progress) * 100}%)`;
    cover.style.pointerEvents = progress > .95 ? 'auto' : 'none';
    scheduled = false;
  }
  function scheduleCover() { if (!scheduled) { scheduled = true; requestAnimationFrame(updateCover); } }
  addEventListener('scroll', scheduleCover, {passive: true});
  addEventListener('resize', scheduleCover);
  updateCover();

  const rail = document.querySelector('.carousel');
  const cards = [...rail.querySelectorAll('.card')];
  const previous = document.querySelector('.previous');
  const next = document.querySelector('.next');
  const status = document.querySelector('#carousel-status');
  let active = 0;
  function positions() { return cards.map(card => card.offsetLeft - cards[0].offsetLeft); }
  function updateCarousel() {
    const offsets = positions();
    active = offsets.reduce((best, offset, i) => Math.abs(offset - rail.scrollLeft) < Math.abs(offsets[best] - rail.scrollLeft) ? i : best, 0);
    previous.disabled = active === 0;
    next.disabled = active === cards.length - 1;
    status.textContent = `Feature ${active + 1} of ${cards.length}`;
  }
  function go(direction) {
    active = Math.min(cards.length - 1, Math.max(0, active + direction));
    rail.scrollTo({left:positions()[active], behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }
  previous.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  rail.addEventListener('scroll', updateCarousel, {passive:true});
  rail.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); go(event.key === 'ArrowRight' ? 1 : -1); }
  });
  addEventListener('resize', updateCarousel);
  updateCarousel();

  // Touch keeps native scrolling; mouse and pen drag the same scroll container.
  let drag = null;
  rail.addEventListener('dragstart', event => {
    if (!event.target.closest('.card p')) event.preventDefault();
  });
  rail.addEventListener('pointerdown', event => {
    // Leave captions (including their nested emphasis) to native text selection.
    if (event.target.closest('.card p')) return;
    if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    updateCarousel();
    drag = {id:event.pointerId, x:event.clientX, scroll:rail.scrollLeft, index:active, delta:0};
    rail.classList.add('is-dragging');
    rail.scrollTo({left:drag.scroll, behavior:'instant'});
    rail.setPointerCapture(event.pointerId);
    rail.focus({preventScroll:true});
  });
  rail.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.delta = event.clientX - drag.x;
    rail.scrollLeft = drag.scroll - drag.delta;
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const gesture = drag;
    drag = null;
    updateCarousel();
    const threshold = Math.min(80, cards[gesture.index].clientWidth * .12);
    let target = active;
    if (event.type === 'pointerup' && Math.abs(gesture.delta) >= threshold) {
      target = gesture.delta < 0 ? Math.max(active, gesture.index + 1) : Math.min(active, gesture.index - 1);
    }
    target = Math.max(0, Math.min(cards.length - 1, target));
    rail.classList.remove('is-dragging');
    if (rail.hasPointerCapture(gesture.id)) rail.releasePointerCapture(gesture.id);
    rail.scrollTo({left:positions()[target], behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }
  ['pointerup','pointercancel','lostpointercapture'].forEach(type => rail.addEventListener(type, finishDrag));

  const powerButton = document.querySelector('.power-button');
  let clickAudio;
  function playMechanicalClick() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      clickAudio ||= new AudioContext();
      const playClick = () => {
        // Two tiny, damped impulses: the switch pressing in and springing back.
        [0, .095].forEach((delay, index) => {
          const length = Math.ceil(clickAudio.sampleRate * .035);
          const buffer = clickAudio.createBuffer(1, length, clickAudio.sampleRate);
          const samples = buffer.getChannelData(0);
          for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * .13));
          const source = clickAudio.createBufferSource();
          source.buffer = buffer;
          const filter = clickAudio.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = index ? 2100 : 1400;
          const gain = clickAudio.createGain();
          gain.gain.value = index ? .13 : .2;
          source.connect(filter).connect(gain).connect(clickAudio.destination);
          source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
          source.start(clickAudio.currentTime + delay);
        });
      };
      if (clickAudio.state === 'suspended') clickAudio.resume().then(playClick).catch(() => {});
      else if (clickAudio.state === 'running') playClick();
    } catch { /* Animation still works when audio is unavailable. */ }
  }
  powerButton.addEventListener('click', () => {
    powerButton.classList.remove('is-pressing');
    void powerButton.offsetWidth;
    powerButton.classList.add('is-pressing');
    playMechanicalClick();
  });
  powerButton.addEventListener('animationend', () => powerButton.classList.remove('is-pressing'));

  const video = document.querySelector('#force-video');
  const play = document.querySelector('.video-play');
  const sound = document.querySelector('.video-sound');
  const videoStatus = document.querySelector('#video-status');
  let userPaused = false;
  let visible = false;
  video.muted = true;
  function updatePlayer() {
    play.classList.toggle('is-playing', !video.paused);
    play.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
    play.setAttribute('aria-pressed', String(!video.paused));
    sound.classList.toggle('is-on', !video.muted);
    sound.setAttribute('aria-label', video.muted ? 'Turn sound on' : 'Turn sound off');
    sound.setAttribute('aria-pressed', String(!video.muted));
  }
  async function startVideo() {
    try { await video.play(); videoStatus.textContent = ''; }
    catch (error) { if (error.name !== 'AbortError') videoStatus.textContent = 'Press play to start the video.'; }
    updatePlayer();
  }
  play.addEventListener('click', () => {
    userPaused = !video.paused;
    if (video.paused) startVideo(); else video.pause();
  });
  sound.addEventListener('click', () => { video.muted = !video.muted; updatePlayer(); });
  ['play','pause','volumechange'].forEach(type => video.addEventListener(type, updatePlayer));
  video.addEventListener('error', () => { videoStatus.textContent = 'Video could not load. Please try again.'; updatePlayer(); });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .35;
    if (visible && !userPaused && !document.hidden) startVideo(); else video.pause();
  }, {threshold:[0,.35]}).observe(document.querySelector('.video-stage'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause(); else if (visible && !userPaused) startVideo();
  });
  updatePlayer();
})();
