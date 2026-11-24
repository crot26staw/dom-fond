import './styles.css';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initProgramsGallery } from './programs-gallery.js';
import storyVideoUrl from './assets/stories-video.mp4?url';

const landing = document.querySelector('[data-landing]');

function initHeroIntro(hero) {
  const intro = hero?.querySelector('[data-hero-intro]');
  if (!intro) return;
  if (window.location.hash && window.location.hash !== '#top') {
    intro.hidden = true;
    return;
  }

  const header = hero.querySelector('.landing-header');
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    intro.hidden = false;
    intro.dataset.introActive = '';
    const logo = intro.querySelector('.intro-logo');
    const house = intro.querySelector('.intro-house');
    const hands = intro.querySelectorAll('.intro-hand');
    const panes = intro.querySelectorAll('.intro-window i');
    const wordmark = intro.querySelector('.intro-wordmark');

    gsap.timeline()
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

    const reveal = gsap.to(intro, { '--reveal-progress': 1, ease: 'none' });
    function updateCurtain({ progress }) {
      const revealed = progress === 1;
      intro.hidden = revealed;
      header.inert = !revealed;
    }

    ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: () => `+=${hero.offsetHeight}`,
      animation: reveal,
      pin: true,
      scrub: true,
      refreshPriority: 1,
      onUpdate: updateCurtain,
      onRefresh: updateCurtain,
    });

    return () => {
      delete intro.dataset.introActive;
      intro.hidden = true;
      header.inert = false;
    };
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
    let pitch;
    let wrap;

    function draw() {
      for (const { row, bow, phase, speed } of rows) {
        const shift = phase * pitch + elapsed * speed;
        for (let index = 0; index < row.children.length; index += 1) {
          const x = wrap(index * pitch + shift);
          const edge = gsap.utils.clamp(-1, 1, 2 * (x + photoWidth / 2) / width - 1);
          const y = bow * 65 * edge ** 2;
          const photo = row.children[index];
          const height = bow === 0 ? 200 + 30 * edge ** 2 : 215;
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
      photoWidth = parseFloat(getComputedStyle(firstRow.firstElementChild).width);
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
    visibility.observe(section);
    document.addEventListener('visibilitychange', updatePlayback);

    gsap.fromTo(gallery, { y: -95 }, {
      y: 95,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
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

const header = document.querySelector('#landing-header');
document.querySelectorAll('[data-header]').forEach((slot) => {
  const content = header.content.cloneNode(true);
  if (slot.closest('.programs')) {
    content.querySelector('.pill-sound img').src = new URL('./assets/music-programs.svg', import.meta.url).href;
    const menu = document.querySelector('#programs-menu').content.firstElementChild.cloneNode(true);
    menu.append(content.querySelector('.landing-nav').cloneNode(true));
    content.querySelector('.landing-actions').append(menu);
    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) menu.open = false;
    });
    menu.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !menu.open) return;
      menu.open = false;
      menu.querySelector('summary').focus();
    });
  }
  slot.replaceWith(content);
});

initHeroIntro(landing?.querySelector('.hero'));
initProgramsGallery(landing?.querySelector('[data-programs-gallery]'));
initStoryCards(landing?.querySelector('.stories'));
initStoriesGallery(landing?.querySelector('.stories-gallery'));

const dialog = document.querySelector('#action-dialog');
const storyDialog = document.querySelector('#story-dialog');
const storyVideo = storyDialog.querySelector('video');
const dialogPanel = dialog.querySelector('[data-dialog-panel]');
const dialogLogo = header.content.querySelector('.landing-logo').cloneNode(true);
dialog.querySelector('[data-dialog-brand]').append(dialogLogo);

let lenis;
if (landing) {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const smoothScroll = new Lenis({ anchors: true, stopInertiaOnNavigate: true });
    const advanceScroll = (time) => smoothScroll.raf(time * 1000);
    lenis = smoothScroll;
    smoothScroll.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(advanceScroll);
    gsap.ticker.lagSmoothing(0);
    if (dialog.open || storyDialog.open) smoothScroll.stop();

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
      rise.set(card, { zIndex: 0 }, start + cardDuration);

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
    if (!desktop.matches) return;

    const titleHeight = currentTitle.offsetHeight;
    const cardHeight = preview.offsetHeight - titleBox.offsetHeight + titleHeight;
    const rowTop = activeRow ? activeRow.offsetTop + (activeRow.offsetHeight - cardHeight) / 2 : 0;
    const top = Math.max(0, Math.min(rowTop, list.clientHeight - cardHeight));
    preview.style.setProperty('--document-preview-title-height', `${titleHeight}px`);
    preview.style.setProperty('--document-preview-top', `${top}px`);
  }

  function selectRow(row) {
    if (row === activeRow) return;

    activeRow?.removeAttribute('data-document-active');
    activeRow = row;
    activeRow?.setAttribute('data-document-active', '');
    currentTitle.removeAttribute('data-current');
    currentTitle = titles.get(row) ?? defaultTitle;
    currentTitle.setAttribute('data-current', '');
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
    selectRow(event.target.closest('.document-row') ?? hoveredRow);
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

initAboutSteps(landing?.querySelector('[data-about]'));
initNumbers(landing?.querySelector('[data-numbers]'));
initCapitalTyping(landing?.querySelector('[data-capital-value]'));
initDocumentPreview(landing?.querySelector('[data-document-list]'));

let dialogTrigger;
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-dialog]');
  if (!trigger) return;

  const form = document.getElementById(trigger.dataset.dialog);
  dialogPanel.replaceChildren(form.content.cloneNode(true));
  dialog.querySelector('[data-donate-caption]').hidden = trigger.dataset.dialog !== 'donate';
  dialogTrigger = trigger;
  dialog.showModal();
  lenis?.stop();
  dialog.querySelector('[data-dialog-close]').focus({ preventScroll: true });
});

dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
dialogLogo.addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  if (!storyDialog.open) lenis?.start();
  dialogTrigger?.focus({ preventScroll: true });
});

let storyTrigger;
const storyError = storyDialog.querySelector('.story-video-error');

landing?.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-story-play]');
  if (!trigger || storyDialog.open) return;

  storyTrigger = trigger;
  storyError.hidden = true;
  if (!storyVideo.hasAttribute('src') || storyVideo.error) storyVideo.src = storyVideoUrl;
  storyDialog.showModal();
  lenis?.stop();
  storyVideo.play().catch(() => {
    if (storyVideo.error && storyDialog.open) storyError.hidden = false;
  });
});

storyVideo.addEventListener('error', () => {
  storyError.hidden = false;
});

storyDialog.querySelector('.story-close').addEventListener('click', () => storyDialog.close());
storyDialog.addEventListener('click', (event) => {
  if (event.target === storyDialog) storyDialog.close();
});

storyDialog.addEventListener('close', () => {
  storyVideo.pause();
  storyVideo.currentTime = 0;
  if (!dialog.open) lenis?.start();
  storyTrigger?.focus({ preventScroll: true });
});

dialog.addEventListener('click', (event) => {
  const preset = event.target.closest('[data-amount]');
  if (!preset) return;

  const amount = preset.form.elements.amount;
  amount.value = preset.dataset.amount;
  preset.form.querySelectorAll('[data-amount]').forEach((item) => {
    item.setAttribute('aria-pressed', String(item === preset));
  });
  if (!amount.value) amount.focus();
});

dialog.addEventListener('input', (event) => {
  if (event.target.name !== 'amount') return;

  event.target.form.querySelectorAll('[data-amount]').forEach((item) => {
    item.setAttribute('aria-pressed', String(item.dataset.amount === event.target.value));
  });
});

dialog.addEventListener('submit', (event) => {
  event.preventDefault();
  event.target.querySelector('.form-message').hidden = false;
});
