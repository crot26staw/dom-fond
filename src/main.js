import './styles.css';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initHeroMotion } from './hero-motion.js';
import { initProgramsGallery } from './programs-gallery.js';
import storyVideoUrl from './assets/stories-video.mp4?url';

const landing = document.querySelector('[data-landing]');

function initHeroIntro(intro, syncHeader) {
  if (!intro) return;

  const motionQuery = '(prefers-reduced-motion: no-preference)';
  if (!window.matchMedia(motionQuery).matches || (window.location.hash && window.location.hash !== '#top')) {
    intro.hidden = true;
    return;
  }

  gsap.matchMedia().add(motionQuery, () => {
    if (intro.hidden) return;

    intro.dataset.introActive = '';
    syncHeader();
    const logo = intro.querySelector('.intro-logo');
    const house = intro.querySelector('.intro-house');
    const hands = intro.querySelectorAll('.intro-hand');
    const panes = intro.querySelectorAll('.intro-window i');
    const wordmark = intro.querySelector('.intro-wordmark');

    const logoAnimation = gsap.timeline()
      .set(logo, { xPercent: 31.06 }, 0)
      .fromTo(hands, { opacity: 0, xPercent: (index) => index === 0 ? -48 : 48, yPercent: 24 },
        { opacity: 1, xPercent: 0, yPercent: 0, duration: 0.55, ease: 'power2.out' }, 0.34)
      .fromTo(house, { opacity: 0, scale: 0.55, yPercent: 24 },
        { opacity: 1, scale: 1, yPercent: 0, duration: 0.55, ease: 'power2.out', transformOrigin: '10.96% 100%' }, 0.36)
      .fromTo(panes, { opacity: 0, yPercent: 220, rotate: -22 },
        { opacity: 1, yPercent: 0, rotate: 0, duration: 0.42, stagger: 0.12, ease: 'power2.out' }, 0.72)
      .to(logo, { xPercent: 0, duration: 0.96, ease: 'power2.inOut' }, 2.2)
      .fromTo(wordmark, { opacity: 0, yPercent: 10 },
        { opacity: 1, yPercent: 0, duration: 0.66, ease: 'power2.inOut' }, 2.5);

    function finishIntro() {
      intro.hidden = true;
      delete intro.dataset.introActive;
      syncHeader();
    }

    gsap.timeline({ onComplete: finishIntro })
      .add(logoAnimation.timeScale(2))
      .to(intro, { '--reveal-progress': 1, duration: 1, ease: 'sine.inOut' });

    return finishIntro;
  });
}

function initStoryCards(section) {
  if (!section) return;

  const scene = section.querySelector('.stories-scene');
  const cards = [...section.querySelectorAll('.story-card')];
  if (cards.length < 2) return;
  const nextSection = section.nextElementSibling;
  const founder = nextSection?.matches('.founder') ? nextSection : null;

  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    section.dataset.storiesScroll = '';
    section.style.setProperty('--stories-scroll-distance', `${65 * cards.length}dvh`);

    const stack = cards.map((_, depth) => depth === 0
      ? { xPercent: -2, yPercent: 7, rotation: -4, scale: 1 }
      : { xPercent: depth - 1, yPercent: 1 - depth, rotation: 0, scale: 1 - (depth - 1) * 0.015 });
    const tucked = { xPercent: -2, yPercent: 57, rotation: -3, scale: 0.98 };
    const halfTurn = 0.32;
    const sequenceEnd = cards.length + 0.65;
    const flip = gsap.timeline({ defaults: { ease: 'power1.inOut', duration: halfTurn } });

    cards.forEach((card, index) => {
      flip.set(card, { ...stack[index], zIndex: cards.length - index }, 0);
    });

    cards.forEach((card, index) => {
      const face = card.querySelector('.story-card-face');
      const swapAt = index + 1;
      const foldAt = swapAt - halfTurn;
      flip.to(card, tucked, foldAt);
      flip.to(face, { rotationX: 90, ease: 'none' }, foldAt);

      // Flip the edge and change layers when the face has no visible area.
      flip.set(face, { rotationX: -90 }, swapAt);
      flip.set(card, { zIndex: 1 }, swapAt);
      flip.to(face, { rotationX: 0, ease: 'none' }, swapAt);
      flip.to(card, stack.at(-1), swapAt);

      for (let depth = 1; depth < cards.length; depth += 1) {
        const next = cards[(index + depth) % cards.length];
        flip.to(next, stack[depth - 1], foldAt);
        flip.set(next, { zIndex: cards.length - depth + 1 }, swapAt);
      }
    });
    flip.set(cards[0], stack[0], sequenceEnd);

    let activeIndex;
    function syncActiveCard({ progress }) {
      const nextIndex = Math.floor(progress * sequenceEnd) % cards.length;
      if (nextIndex === activeIndex) return;

      cards.forEach((card, index) => {
        card.inert = index !== nextIndex;
        card.toggleAttribute('data-active', index === nextIndex);
      });
      activeIndex = nextIndex;
    }

    syncActiveCard({ progress: 0 });
    ScrollTrigger.create({
      trigger: section,
      start: () => `top ${getComputedStyle(scene).top}`,
      endTrigger: founder ?? section,
      end: founder ? 'top bottom' : 'bottom bottom',
      animation: flip,
      scrub: true,
      onRefresh: syncActiveCard,
      onUpdate: syncActiveCard,
    });

    return () => {
      delete section.dataset.storiesScroll;
      section.style.removeProperty('--stories-scroll-distance');
      cards.forEach((card) => {
        card.inert = false;
        card.removeAttribute('data-active');
      });
    };
  });
}

function initStoriesGallery(staticGallery) {
  if (!staticGallery) return;

  const section = staticGallery.closest('.stories');
  const photos = [...new Map([...staticGallery.querySelectorAll('img')].map(photo => [photo.src, photo])).values()];
  const rowSettings = [
    { bow: -1, phase: 0.2, speed: 19, photoOffset: 0 },
    { bow: 0, phase: 0.7, speed: -28, photoOffset: 4 },
    { bow: 1, phase: 0.4, speed: 22, photoOffset: 2 },
  ];

  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const gallery = document.createElement('div');
    gallery.className = 'stories-gallery-motion';
    gallery.setAttribute('aria-hidden', 'true');

    const rows = rowSettings.map((settings) => {
      const row = document.createElement('div');
      row.className = 'stories-gallery-row';
      row.append(photos[settings.photoOffset].cloneNode());
      gallery.append(row);
      return { ...settings, row };
    });

    let elapsed = 0;
    let width;
    let photoWidth;
    let photoHeight;
    let pitch;
    let wrap;

    function draw() {
      const scale = photoHeight / 215;
      for (const { row, bow, phase, speed } of rows) {
        const shift = phase * pitch + elapsed * speed * scale;
        for (let index = 0; index < row.children.length; index += 1) {
          const x = wrap(index * pitch + shift);
          const edge = gsap.utils.clamp(-1, 1, 2 * (x + photoWidth / 2) / width - 1);
          const y = bow * 65 * edge ** 2 * scale;
          const photo = row.children[index];
          const height = bow === 0 ? (200 + 30 * edge ** 2) * scale : photoHeight;
          const tilt = edge * Math.abs(edge) * bow * 10;
          const shearHeight = photoWidth * Math.abs(Math.tan(tilt * Math.PI / 180));
          if (bow === 0) photo.style.height = height + 'px';
          // Keep the projected height within the card's original bounds.
          photo.style.transform = `translate3d(${x}px, calc(-50% + ${y}px), 0) skewY(${tilt}deg) scaleY(${1 - shearHeight / height})`;
        }
      }
    }

    function resize() {
      const firstRow = rows[0].row;
      width = gallery.clientWidth;
      const photoStyle = getComputedStyle(firstRow.firstElementChild);
      photoWidth = parseFloat(photoStyle.width);
      photoHeight = parseFloat(photoStyle.height);
      pitch = photoWidth + parseFloat(getComputedStyle(firstRow).columnGap);

      // Loop whole copies of the photo sequence and wrap only beyond the visible area.
      const count = photos.length * Math.ceil((width + pitch) / (photos.length * pitch));
      wrap = gsap.utils.wrap(-pitch, (count - 1) * pitch);

      for (const { row, photoOffset } of rows) {
        while (row.children.length > count) row.lastElementChild.remove();
        for (let index = row.children.length; index < count; index += 1) {
          row.append(photos[(index + photoOffset) % photos.length].cloneNode());
        }
      }
      draw();
    }

    staticGallery.before(gallery);
    resize();
    staticGallery.hidden = true;

    const size = new ResizeObserver(resize);
    size.observe(gallery);

    let inView = false;
    const tick = (_, delta) => {
      elapsed += Math.min(delta, 50) / 1000;
      draw();
    };
    const updatePlayback = () => {
      if (inView && !document.hidden) {
        gsap.ticker.add(tick);
      } else {
        gsap.ticker.remove(tick);
      }
    };
    const visibility = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updatePlayback();
    });
    visibility.observe(gallery);
    document.addEventListener('visibilitychange', updatePlayback);

    gsap.fromTo(gallery, { '--stories-gallery-offset': -1 }, {
      '--stories-gallery-offset': 1,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });

    return () => {
      size.disconnect();
      visibility.disconnect();
      gsap.ticker.remove(tick);
      document.removeEventListener('visibilitychange', updatePlayback);
      gallery.remove();
      staticGallery.hidden = false;
    };
  });
}

function initLandingHeader(landing) {
  const header = landing?.querySelector('.landing-header');
  const hero = landing?.querySelector('.hero');
  if (!header || !hero) return;

  const intro = hero.querySelector('[data-hero-intro]');
  const programs = hero.nextElementSibling;
  function syncHeader() {
    const overHero = programs.getBoundingClientRect().top >= 1;
    header.toggleAttribute('data-filled-nav', !overHero);
    header.inert = overHero && intro?.hasAttribute('data-intro-active');
  }

  initHeroIntro(intro, syncHeader);
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });
  new ResizeObserver(syncHeader).observe(hero);

  const menu = header.querySelector('.landing-menu');
  const nav = menu.querySelector('.landing-nav');
  const compact = window.matchMedia('(max-width: 1105px)');
  function placeNavigation() {
    menu.open = false;
    menu.hidden = !compact.matches;
    if (compact.matches) menu.append(nav);
    else header.prepend(nav);
  }
  placeNavigation();
  compact.addEventListener('change', placeNavigation);

  menu.addEventListener('click', (event) => {
    if (event.target.closest('a, [data-dialog]')) menu.open = false;
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  menu.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
  });
}

initLandingHeader(landing);
initHeroMotion(landing?.querySelector('.hero'));
initProgramsGallery(landing?.querySelector('[data-programs-gallery]'));
initStoryCards(landing?.querySelector('.stories'));
initStoriesGallery(landing?.querySelector('.stories-gallery'));

const dialog = document.querySelector('#action-dialog');
const videoDialog = document.querySelector('#story-dialog');
const player = videoDialog.querySelector('video');
const dialogPanel = dialog.querySelector('[data-dialog-panel]');
const dialogLogo = dialog.querySelector('.dialog-brand');

let lenis;
if (landing) {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const smoothScroll = new Lenis({ anchors: true, stopInertiaOnNavigate: true });
    const advanceScroll = (time) => smoothScroll.raf(time * 1000);
    lenis = smoothScroll;
    smoothScroll.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(advanceScroll);
    gsap.ticker.lagSmoothing(0);
    if (dialog.open || videoDialog.open) smoothScroll.stop();

    return () => {
      gsap.ticker.remove(advanceScroll);
      smoothScroll.destroy();
      lenis = undefined;
    };
  });
}

function prepareSceneHandoff(section, scene, content, nextSection) {
  if (!nextSection) return;

  function measureExitGap() {
    const contentBottom = Math.max(...content.map((element) => element.getBoundingClientRect().bottom));
    const gap = Math.max(0, scene.getBoundingClientRect().bottom - contentBottom);
    nextSection.style.setProperty('--scene-exit-gap', `${gap}px`);
    return gap;
  }

  measureExitGap();
  const size = new ResizeObserver(measureExitGap);
  size.observe(scene);
  content.forEach((element) => size.observe(element));

  // Keep the final spacing in the page flow while the visual offset eases away.
  return (previousTrigger) => {
    gsap.fromTo(nextSection, { '--scene-exit-offset': 1 }, {
      '--scene-exit-offset': 0,
      ease: 'power1.inOut',
      scrollTrigger: {
        trigger: section,
        start: () => previousTrigger.end,
        end: () => `+=${Math.max(120, measureExitGap())}`,
        scrub: true,
      },
    });
  };
}

function initAboutSteps(section) {
  if (!section) return;
  const scene = section.querySelector('.about-scene');
  const layout = section.querySelector('.about-layout');
  const nextSection = section.nextElementSibling;
  const numbers = nextSection?.matches('.numbers') ? nextSection : null;
  const addHandoff = prepareSceneHandoff(section, scene, [layout], numbers);
  const ring = section.querySelector('.about-ring-progress');
  const steps = [...section.querySelectorAll('.about-steps button')];
  const illustrations = section.querySelectorAll('[data-step-art]');
  const descriptions = section.querySelectorAll('[data-step-copy]');
  let activeStep = 0;
  let trigger;

  function showStep(index) {
    if (index === activeStep) return;

    steps[activeStep].setAttribute('aria-pressed', 'false');
    illustrations[activeStep].setAttribute('aria-hidden', 'true');
    descriptions[activeStep].setAttribute('aria-hidden', 'true');
    steps[index].setAttribute('aria-pressed', 'true');
    illustrations[index].removeAttribute('aria-hidden');
    descriptions[index].removeAttribute('aria-hidden');
    activeStep = index;
  }

  function updateStep({ progress }) {
    const position = progress * steps.length;
    const index = Math.min(Math.floor(position), steps.length - 1);
    // Hold the completed ring briefly before switching to the next step.
    const fill = Math.min((position - index) / 0.9, 1);
    showStep(index);
    ring.style.setProperty('--about-progress', `${fill}turn`);
  }

  steps.forEach((step, index) => {
    step.addEventListener('click', () => {
      if (index === activeStep) return;
      if (!trigger) {
        showStep(index);
        return;
      }

      const distance = (trigger.end - trigger.start) / steps.length;
      const target = Math.ceil(trigger.start + index * distance) + 1;
      if (lenis) lenis.scrollTo(target, { immediate: true });
      else window.scrollTo(0, target);
      trigger.update();
    });
  });

  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    section.dataset.aboutScroll = '';
    section.style.setProperty('--about-scroll-distance', `${steps.length * 75}dvh`);
    const stepsTrigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${section.offsetHeight - scene.offsetHeight}`,
      onUpdate: updateStep,
      onRefresh: updateStep,
    });
    trigger = stepsTrigger;
    addHandoff?.(stepsTrigger);

    return () => {
      trigger = undefined;
      delete section.dataset.aboutScroll;
      section.style.removeProperty('--about-scroll-distance');
      ring.style.removeProperty('--about-progress');
    };
  });
}

function initNumbers(section) {
  if (!section) return;

  const scene = section.querySelector('.numbers-scene');
  const house = section.querySelector('.numbers-house');
  const viewport = section.querySelector('.number-cards-viewport');
  const track = section.querySelector('.number-cards');
  const cards = [...track.children];
  const nextSection = section.nextElementSibling;
  const capital = nextSection?.matches('.capital') ? nextSection : null;
  const addHandoff = prepareSceneHandoff(section, scene, [house, track], capital);

  gsap.matchMedia().add({
    motion: '(prefers-reduced-motion: no-preference)',
    narrow: '(max-width: 999px)',
  }, ({ conditions: { motion, narrow } }) => {
    if (!motion) {
      viewport.tabIndex = 0;
      return () => viewport.removeAttribute('tabindex');
    }

    section.dataset.numbersScroll = '';
    section.style.setProperty('--numbers-scroll-distance', `${cards.length * 55}dvh`);

    function railOffset(index) {
      const cardOffset = cards[index].offsetLeft - cards[0].offsetLeft;
      return Math.min(cardOffset, Math.max(0, track.offsetWidth - viewport.clientWidth));
    }

    const cardDuration = 0.94;
    const cardStagger = 0.88;
    const rise = gsap.timeline({ defaults: { duration: cardDuration, ease: 'power2.out' } });
    if (narrow) rise.set(viewport, { scrollLeft: 0, '--numbers-deck-pan': '0px' }, 0);

    cards.forEach((card, index) => {
      const start = 0.12 + index * cardStagger;
      const face = card.firstElementChild;
      rise.set(card, { zIndex: cards.length - index, opacity: index === 0 ? 1 : 0 }, 0);
      if (index > 0) rise.set(card, { opacity: 1 }, start - cardStagger);

      rise.fromTo(card, {
        x: () => {
          const width = narrow ? viewport.clientWidth : track.offsetWidth;
          return (width - card.offsetWidth) / 2 - card.offsetLeft;
        },
        y: () => {
          const height = face.offsetHeight;
          const finalTop = track.offsetTop + (track.offsetHeight - height) / 2;
          const deckTop = scene.clientHeight - 0.54 * height;
          return deckTop - finalTop;
        },
        '--numbers-deck-follow': 1,
      }, { x: 0, y: 0, '--numbers-deck-follow': 0 }, start);

      if (narrow && index > 0) {
        rise.fromTo(viewport, {
          scrollLeft: () => railOffset(index - 1),
          '--numbers-deck-pan': () => `${railOffset(index - 1)}px`,
        }, {
          scrollLeft: () => railOffset(index),
          '--numbers-deck-pan': () => `${railOffset(index)}px`,
          immediateRender: false,
        }, start);
      }
    });

    function syncRail({ progress }) {
      if (!narrow) return;
      const settled = progress === 1;
      section.toggleAttribute('data-numbers-settled', settled);
      if (settled) viewport.tabIndex = 0;
      else viewport.removeAttribute('tabindex');
    }

    const riseTrigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${section.offsetHeight - scene.offsetHeight}`,
      animation: rise,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: syncRail,
      onRefresh: syncRail,
    });
    addHandoff?.(riseTrigger);

    return () => {
      delete section.dataset.numbersScroll;
      delete section.dataset.numbersSettled;
      section.style.removeProperty('--numbers-scroll-distance');
      viewport.removeAttribute('tabindex');
      viewport.scrollLeft = 0;
    };
  });
}

function initCapitalTyping(value) {
  if (!value) return;

  const symbols = value.textContent.match(/\s*\S/g);
  if (!symbols) return;
  let played = false;

  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    if (played) return;

    const visual = document.createElement('span');
    visual.className = 'capital-value-typed';
    visual.setAttribute('aria-hidden', 'true');
    value.append(visual);
    value.dataset.capitalTyping = '';

    function showFullAmount() {
      visual.remove();
      delete value.dataset.capitalTyping;
    }

    const typing = gsap.timeline({ paused: true, onComplete: showFullAmount });
    let prefix = '';
    symbols.forEach((symbol, index) => {
      prefix += symbol;
      const text = prefix;
      typing.call(() => { visual.textContent = text; }, [], (index + 1) * 0.09);
    });

    const visibleRatio = 0.35;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.intersectionRatio >= visibleRatio)) return;
      observer.disconnect();
      played = true;
      typing.play();
    }, { threshold: visibleRatio });
    observer.observe(value);

    return () => {
      observer.disconnect();
      showFullAmount();
    };
  });
}

function initDocumentPreview(list) {
  if (!list) return;

  const rows = [...list.querySelectorAll('.document-row')];
  const preview = list.querySelector('.document-preview');
  const titleBox = preview.querySelector('.document-preview-titles');
  const desktop = window.matchMedia('(min-width: 1000px)');
  const titles = new Map(rows.map((row, index) => {
    const title = index === 0 ? titleBox.firstElementChild : document.createElement('strong');
    title.textContent = row.dataset.previewTitle ?? row.querySelector('h4').textContent;
    if (index > 0) titleBox.append(title);
    return [row, title];
  }));
  const defaultTitle = titles.get(rows[0]);
  let currentTitle = defaultTitle;
  let activeRow;
  let hoveredRow;

  function placePreview() {
    if (preview.hidden || !activeRow) return;

    const titleHeight = currentTitle.offsetHeight;
    const cardHeight = preview.offsetHeight - titleBox.offsetHeight + titleHeight;
    const rowTop = activeRow.offsetTop + (activeRow.offsetHeight - cardHeight) / 2;
    const top = Math.max(0, Math.min(rowTop, list.clientHeight - cardHeight));
    preview.style.setProperty('--document-preview-title-height', `${titleHeight}px`);
    preview.style.setProperty('--document-preview-top', `${top}px`);
  }

  function selectRow(row) {
    preview.hidden = !hoveredRow;
    if (row !== activeRow) {
      activeRow?.removeAttribute('data-document-active');
      activeRow = row;
      activeRow?.setAttribute('data-document-active', '');
      currentTitle.removeAttribute('data-current');
      currentTitle = titles.get(row) ?? defaultTitle;
      currentTitle.setAttribute('data-current', '');
    }
    placePreview();
  }

  for (const row of rows) {
    row.addEventListener('pointerenter', (event) => {
      if (!desktop.matches || event.pointerType === 'touch') return;
      hoveredRow = row;
      selectRow(row);
    });
  }

  list.addEventListener('pointerleave', () => {
    hoveredRow = undefined;
    selectRow(rows.find((row) => row.contains(document.activeElement)));
  });

  list.addEventListener('focusin', (event) => {
    if (!desktop.matches) return;
    selectRow(hoveredRow ?? event.target.closest('.document-row'));
  });

  list.addEventListener('focusout', (event) => {
    if (!list.contains(event.relatedTarget)) selectRow(hoveredRow);
  });

  function syncViewport() {
    for (const row of rows) {
      if (desktop.matches) row.tabIndex = 0;
      else row.removeAttribute('tabindex');
    }
    if (!desktop.matches) {
      hoveredRow = undefined;
      selectRow(undefined);
    }
    placePreview();
  }

  desktop.addEventListener('change', syncViewport);
  const size = new ResizeObserver(placePreview);
  size.observe(list);
  titles.forEach((title) => size.observe(title));
  syncViewport();
}

function initBreadVideoCursor(scene) {
  let pointer;
  let hoveredButton;
  let refreshPending = false;

  function positionLabel(button) {
    if (button !== hoveredButton) hoveredButton?.removeAttribute('data-follow-pointer');
    hoveredButton = button;
    if (!button) return;

    const { left, top } = button.getBoundingClientRect();
    button.style.setProperty('--bread-pointer-x', `${pointer.x - left}px`);
    button.style.setProperty('--bread-pointer-y', `${pointer.y - top}px`);
    button.dataset.followPointer = '';
  }

  function trackPointer(event) {
    if (event.pointerType !== 'mouse') return;

    pointer = { x: event.clientX, y: event.clientY };
    positionLabel(event.target.closest('.watch-button'));
  }

  function refreshPointer() {
    if (!pointer || refreshPending) return;
    refreshPending = true;
    requestAnimationFrame(() => {
      refreshPending = false;
      if (!pointer) return;

      const target = document.elementFromPoint(pointer.x, pointer.y);
      positionLabel(scene.contains(target) ? target.closest('.watch-button') : null);
    });
  }

  scene.addEventListener('pointerover', trackPointer);
  scene.addEventListener('pointermove', trackPointer);
  scene.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    pointer = undefined;
    positionLabel(null);
  });
  window.addEventListener('scroll', refreshPointer, { passive: true });
  window.addEventListener('resize', refreshPointer);
}

function initBreadScene(section) {
  if (!section) return;

  const scene = section.querySelector('.bread-scene');
  const cards = [...scene.querySelectorAll('.bread-card')];
  const content = cards.map((card) => card.querySelector('.bread-content'));
  const buttons = cards.map((card) => card.querySelector('.watch-button'));
  const previous = section.previousElementSibling;
  const previousBackground = previous?.querySelector('.scene-image');
  const motion = '(prefers-reduced-motion: no-preference)';
  const pinSizes = [
    '(min-width: 1000px) and (min-height: 520px)',
    '(min-width: 600px) and (max-width: 999px) and (min-height: 800px)',
    '(max-width: 599px) and (min-height: 665px)',
  ];

  initBreadVideoCursor(scene);

  gsap.matchMedia().add(pinSizes.map((size) => `${motion} and ${size}`).join(', '), () => {
    section.dataset.breadScroll = '';
    const transitionProgress = gsap.utils.pipe(
      gsap.utils.normalize(0.14, 0.84),
      gsap.utils.clamp(0, 1),
      gsap.parseEase('power1.inOut'),
    );
    let activeIndex = -1;

    function updateScene({ progress }) {
      const reveal = transitionProgress(progress);
      scene.style.setProperty('--bread-scene-progress', reveal);
      section.toggleAttribute('data-bread-advanced', progress > 0);
      const nextIndex = reveal < 0.5 ? 0 : 1;
      if (nextIndex === activeIndex) return;

      const focusedButton = buttons[activeIndex] === document.activeElement;
      activeIndex = nextIndex;
      cards.forEach((card, index) => {
        card.toggleAttribute('data-active', index === activeIndex);
        if (index === activeIndex) content[index].removeAttribute('aria-hidden');
        else content[index].setAttribute('aria-hidden', 'true');
      });
      if (focusedButton) buttons[activeIndex].focus({ preventScroll: true });
    }

    function refreshScene(trigger) {
      // Match the visible edge of the preceding section while the scene stays centered.
      if (previousBackground?.naturalHeight) {
        scene.style.setProperty('--bread-previous-height', `${previous.offsetHeight}px`);
        scene.style.setProperty('--bread-previous-ratio', previousBackground.naturalWidth / previousBackground.naturalHeight);
      }
      updateScene(trigger);
    }

    updateScene({ progress: 0 });
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: () => `top ${getComputedStyle(scene).top}`,
      end: () => `+=${section.offsetHeight - scene.offsetHeight}`,
      onUpdate: updateScene,
      onRefresh: refreshScene,
    });

    function revealFocusedButton(event) {
      const index = buttons.indexOf(event.target);
      if (index < 0 || index === activeIndex) return;

      // Bring a keyboard-focused button into view at its fully revealed state.
      const progress = index === 0 ? 0.08 : 0.92;
      const target = gsap.utils.interpolate(trigger.start, trigger.end, progress);
      if (lenis) lenis.scrollTo(target, { immediate: true });
      else window.scrollTo(0, target);
      trigger.update();
    }

    scene.addEventListener('focusin', revealFocusedButton);
    return () => {
      scene.removeEventListener('focusin', revealFocusedButton);
      scene.style.removeProperty('--bread-scene-progress');
      scene.style.removeProperty('--bread-previous-height');
      scene.style.removeProperty('--bread-previous-ratio');
      delete section.dataset.breadScroll;
      delete section.dataset.breadAdvanced;
      cards.forEach((card, index) => {
        card.removeAttribute('data-active');
        content[index].removeAttribute('aria-hidden');
      });
    };
  });
}

function initDonationScene(section) {
  if (!section) return;

  const scene = section.querySelector('.donation-scene');
  const intro = scene.querySelector('.donation-intro');
  const poster = scene.querySelector('.donation-poster');
  const backdrop = scene.querySelector('.donation-backdrop');
  const panel = scene.querySelector('.donation-panel');
  const skip = intro.querySelector('[data-donation-skip]');
  const nextSection = section.nextElementSibling;
  const social = nextSection?.matches('.social') ? nextSection : null;

  gsap.matchMedia().add('(prefers-reduced-motion: no-preference) and (min-height: 620px)', () => {
    section.dataset.donationScroll = '';
    const transition = gsap.timeline()
      .to(poster, { filter: 'blur(0.5rem)', scale: 0.82, duration: 0.23, ease: 'power1.inOut' }, 0.1)
      .fromTo(backdrop, { '--donation-reveal': 0 }, {
        '--donation-reveal': 1, duration: 0.47, ease: 'power1.inOut',
      }, 0.25)
      .to(intro, { autoAlpha: 0, duration: 0.27, ease: 'power1.inOut' }, 0.29)
      .fromTo(panel, { autoAlpha: 0, scale: 0.88, y: '0.75rem' }, {
        autoAlpha: 1, scale: 1, y: 0, duration: 0.22, ease: 'power1.inOut',
      }, 0.72)
      .set(panel, { autoAlpha: 1 }, 1);

    function syncInteractivity({ progress }) {
      intro.toggleAttribute('inert', progress >= 0.33);
      panel.toggleAttribute('inert', progress < 0.9);
    }

    syncInteractivity({ progress: 0 });
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      endTrigger: social ?? section,
      end: () => social ? `top ${scene.offsetHeight}px` : `+=${section.offsetHeight - scene.offsetHeight}`,
      animation: transition,
      scrub: true,
      onUpdate: syncInteractivity,
      onRefresh: syncInteractivity,
    });

    function revealForm() {
      const target = gsap.utils.interpolate(trigger.start, trigger.end, 0.96);
      if (lenis) lenis.scrollTo(target, { immediate: true });
      else window.scrollTo(0, target);
      trigger.update();
    }

    function skipToForm() {
      revealForm();
      panel.querySelector('input[name="frequency"]:checked').focus({ preventScroll: true });
    }

    function revealCoveredField({ target }) {
      if (!social) return;
      requestAnimationFrame(() => {
        if (document.activeElement !== target || !section.hasAttribute('data-donation-scroll')) return;
        if (social.getBoundingClientRect().top < target.getBoundingClientRect().bottom) revealForm();
      });
    }

    skip.addEventListener('click', skipToForm);
    panel.addEventListener('focusin', revealCoveredField);
    return () => {
      skip.removeEventListener('click', skipToForm);
      panel.removeEventListener('focusin', revealCoveredField);
      delete section.dataset.donationScroll;
      intro.inert = false;
      panel.inert = false;
    };
  });
}

function initFaq(list) {
  if (!list?.childElementCount) return;

  const questions = [...list.children];
  const group = questions[0].getAttribute('name');

  if (!('name' in HTMLDetailsElement.prototype)) {
    list.addEventListener('toggle', ({ target }) => {
      // The named group is handled here only when the browser doesn't support it.
      if (!target.matches('.faq-item[name][open]')) return;

      list.querySelectorAll('.faq-item[name][open]').forEach((item) => {
        if (item !== target) item.open = false;
      });
    }, true);
  }

  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    function settleQuestion(item, expanded) {
      const [summary, answer] = item.children;
      item.open = expanded;
      item.setAttribute('name', group);
      item.style.removeProperty('height');
      summary.removeAttribute('aria-expanded');
      answer.inert = false;
    }

    function animateQuestion(item, expanded) {
      const [summary, answer] = item.children;
      const height = item.getBoundingClientRect().height;
      if (expanded) {
        item.setAttribute('name', group);
        item.open = true;
      } else {
        // Keep the answer rendered while the next question opens.
        item.removeAttribute('name');
      }
      summary.setAttribute('aria-expanded', String(expanded));
      answer.inert = !expanded;

      gsap.fromTo(item, { height }, {
        height: expanded ? 'auto' : summary.getBoundingClientRect().height,
        duration: 0.28,
        ease: 'power2.inOut',
        overwrite: true,
        onComplete: () => settleQuestion(item, expanded),
      });
    }

    function toggleQuestion(event) {
      const summary = event.target.closest('.faq-item > summary');
      if (!summary) return;

      event.preventDefault();
      const item = summary.parentElement;
      const active = list.querySelector('.faq-item[name][open]');
      if (active) animateQuestion(active, false);
      if (item !== active) animateQuestion(item, true);
    }

    list.addEventListener('click', toggleQuestion);
    return () => {
      list.removeEventListener('click', toggleQuestion);
      questions.forEach((item) => {
        gsap.killTweensOf(item);
        settleQuestion(item, item.open && item.hasAttribute('name'));
      });
    };
  });
}

initAboutSteps(landing?.querySelector('[data-about]'));
initNumbers(landing?.querySelector('[data-numbers]'));
initCapitalTyping(landing?.querySelector('[data-capital-value]'));
initDocumentPreview(landing?.querySelector('[data-document-list]'));
initBreadScene(landing?.querySelector('[data-bread-scene]'));
initDonationScene(landing?.querySelector('[data-donation-scene]'));
initFaq(landing?.querySelector('.faq-list'));

let dialogTrigger;
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-dialog]');
  if (!trigger) return;

  const form = document.getElementById(trigger.dataset.dialog);
  dialogPanel.replaceChildren(form.content.cloneNode(true));
  dialog.querySelector('[data-donate-caption]').hidden = trigger.dataset.dialog !== 'donate';
  dialogTrigger = trigger.closest('.landing-menu')?.querySelector('summary') ?? trigger;
  dialog.showModal();
  lenis?.stop();
  dialog.querySelector('[data-dialog-close]').focus({ preventScroll: true });
});

dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
dialogLogo.addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  if (!videoDialog.open) lenis?.start();
  dialogTrigger?.focus({ preventScroll: true });
});

const videos = {
  story: { title: 'Видео истории Альбины и Дмитрия', source: storyVideoUrl },
  bread: { title: 'Видео о бесплатном хлебе', source: storyVideoUrl },
  'spiritual-support': { title: 'Видео о духовной поддержке', source: storyVideoUrl },
  donation: { title: 'Видео о фонде', source: storyVideoUrl },
};
let videoTrigger;
const videoError = videoDialog.querySelector('.story-video-error');

landing?.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-story-play], [data-project-video], [data-video]');
  if (!trigger || videoDialog.open) return;

  const { title, source } = videos[trigger.dataset.video ?? trigger.dataset.projectVideo ?? 'story'];
  videoTrigger = trigger;
  videoDialog.setAttribute('aria-label', title);
  player.setAttribute('aria-label', title);
  videoError.hidden = true;
  if (player.getAttribute('src') !== source || player.error) {
    player.style.removeProperty('--video-ratio');
    player.src = source;
  }
  videoDialog.showModal();
  lenis?.stop();
  player.play().catch(() => {
    if (player.error && videoDialog.open) videoError.hidden = false;
  });
});

player.addEventListener('loadedmetadata', () => {
  if (player.videoHeight) player.style.setProperty('--video-ratio', player.videoWidth / player.videoHeight);
});

player.addEventListener('error', () => {
  if (videoDialog.open) videoError.hidden = false;
});

videoDialog.querySelector('.story-close').addEventListener('click', () => videoDialog.close());
videoDialog.addEventListener('click', (event) => {
  if (event.target === videoDialog) videoDialog.close();
});

videoDialog.addEventListener('close', () => {
  if (videoDialog.open) return;

  player.pause();
  player.currentTime = 0;
  if (!dialog.open) lenis?.start();
  videoTrigger?.focus({ preventScroll: true });
});

function syncAmountPresets(amount) {
  amount.form.querySelectorAll('[data-amount]').forEach((item) => {
    item.setAttribute('aria-pressed', String(item.dataset.amount === amount.value));
  });
}

document.addEventListener('click', (event) => {
  const preset = event.target.closest('[data-static-form] [data-amount]');
  if (!preset) return;

  const amount = preset.form.elements.amount;
  amount.value = preset.dataset.amount;
  syncAmountPresets(amount);
  if (!amount.value) amount.focus();
});

document.addEventListener('input', (event) => {
  if (event.target.matches('[data-static-form] input[name="amount"]')) syncAmountPresets(event.target);
});

document.addEventListener('submit', (event) => {
  if (!event.target.matches('form[data-static-form]')) return;

  event.preventDefault();
  event.target.querySelector('.form-message').hidden = false;
});
