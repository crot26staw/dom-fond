import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const graphemes = new Intl.Segmenter();

function smoothStep(from, to, value) {
  const t = gsap.utils.clamp(0, 1, (value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

function paintCopy(context, copy, media, ratio) {
  const bounds = media.getBoundingClientRect();
  const range = document.createRange();
  const supportsTracking = 'letterSpacing' in context;
  context.scale(ratio, ratio);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';

  for (const element of copy.children) {
    const style = getComputedStyle(element);
    const fontSize = parseFloat(style.fontSize);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.fillStyle = style.color;
    if (supportsTracking) context.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
    const metrics = context.measureText('M');
    const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
    const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const lines = new Map();

    // Match the HTML wrapping and alignment, including nonbreaking spaces and explicit line breaks.
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const { segment, index } of graphemes.segment(node.data)) {
        range.setStart(node, index);
        range.setEnd(node, index + segment.length);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;

        let line = lines.get(rect.top);
        if (!line) {
          const baseline = rect.top + (rect.height + ascent - descent) / 2;
          line = { baseline: baseline - bounds.top, glyphs: [] };
          lines.set(rect.top, line);
        }
        line.glyphs.push({ segment, x: rect.left - bounds.left });
      }
    }

    for (const { baseline, glyphs } of lines.values()) {
      if (supportsTracking) {
        context.fillText(glyphs.map(({ segment }) => segment).join(''), glyphs[0].x, baseline);
      } else {
        glyphs.forEach(({ segment, x }) => context.fillText(segment, x, baseline));
      }
    }
  }
}

function cacheCard(card, ratio) {
  const { element, image, texture } = card;
  if (!image.complete || !image.naturalWidth) return false;
  const { width, height } = texture;
  const context = texture.getContext('2d');
  context.clearRect(0, 0, width, height);

  const styles = getComputedStyle(element);
  const value = (property) => parseFloat(styles.getPropertyValue(property));
  const radius = value('--program-photo-radius') * ratio;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const imageWidth = image.naturalWidth * scale;
  const imageHeight = image.naturalHeight * scale;
  const left = (width - imageWidth) / 2;

  context.save();
  context.beginPath();
  context.roundRect(0, 0, width, height, radius);
  context.clip();
  context.drawImage(image, left, (height - imageHeight) / 2, imageWidth, imageHeight);
  const shade = context.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(value('--program-shade-start') / 100, 'transparent');
  shade.addColorStop(value('--program-shade-end') / 100, `rgba(0, 0, 0, ${value('--program-shade-opacity')})`);
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);
  paintCopy(context, card.copy, card.media, ratio);
  context.restore();
  return true;
}

export function initProgramsGallery(gallery) {
  if (!gallery) return;

  const section = gallery.closest('.programs');
  const scene = gallery.closest('.programs-scene');
  const heading = scene.querySelector('h2');
  const intro = scene.querySelector('.programs-intro');
  const nextSection = section.nextElementSibling;
  const stories = nextSection?.matches('.stories') ? nextSection : null;
  const track = gallery.firstElementChild;

  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.className = 'programs-wave';
    canvas.setAttribute('aria-hidden', 'true');

    const cards = [...track.children].map((element) => ({
      element,
      media: element.querySelector('.program-card-media'),
      image: element.querySelector('img'),
      copy: element.querySelector('.program-copy'),
      texture: document.createElement('canvas'),
      ready: false,
    }));

    gallery.scrollLeft = 0;
    gallery.prepend(canvas);
    section.setAttribute('data-programs-scroll', '');
    const moveTrack = gsap.quickSetter(track, 'x', 'px');
    let width = 0;
    let ratio = 1;
    let minHeight = 0;
    let edgeHeight = 0;
    let maxHeight = 0;
    let cardRadius = 0;
    let ribbonRadius = 0;
    let startOffset = 0;
    let introThreshold = 0;
    let desktop = false;
    let distance = 0;
    let scrollDistance = 0;
    let position = 0;
    let lastScrollTime = 0;
    let pull = 0;
    let ripple = 0;
    let ticking = false;
    let edgeShade;

    function render() {
      const shift = -distance * position;
      const offset = startOffset + shift;
      moveTrack(shift);
      if (desktop) {
        intro.style.opacity = gsap.utils.clamp(0, 1, (offset - introThreshold) / Math.max(1, startOffset - introThreshold));
      }

      if (document.fonts.status === 'loading' || !cards.every((card) => card.ready || (card.ready = cacheCard(card, ratio)))) {
        gallery.removeAttribute('data-bending');
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      const step = Math.max(1, Math.round(3 * ratio));
      const circumference = Math.PI * 2;
      const magnification = desktop ? 0.22 : 0.15;
      const pullAmplitude = Math.min(36, width * 0.032) * Math.abs(ripple);

      function projectX(x) {
        if (x < 0) return x * (1 - magnification);
        if (x > width) return width + (x - width) * (1 - magnification);
        const phase = x / width * circumference;
        return x - Math.sin(phase) * magnification * width / circumference;
      }

      function ribbonAt(x) {
        const screen = x / width - 0.5;
        const fromCenter = Math.abs(x - width / 2);
        const lens = 1 - smoothStep(0.08, 0.35, Math.abs(screen));
        const curve = Math.sin(screen * Math.PI * 1.2 + 0.72);
        // The flutter travels with the unbroken ribbon, while the lens stays fixed in the viewport.
        const materialX = (x - offset) / width;
        const flutter = Math.sin(materialX * circumference * 1.3 + ripple * 2.1) * lens;
        const flex = flutter * Math.abs(ripple) * 0.45;
        const onCenterCard = fromCenter <= cardRadius;
        const drop = onCenterCard
          ? smoothStep(0, cardRadius, fromCenter)
          : smoothStep(cardRadius, ribbonRadius, fromCenter);
        // The ripple can bend the transition between the three heights without moving those anchors.
        const easedDrop = drop + flex * drop * (1 - drop);
        const height = onCenterCard
          ? maxHeight - (maxHeight - edgeHeight) * easedDrop
          : edgeHeight - (edgeHeight - minHeight) * easedDrop;
        const focus = (height - minHeight) / (maxHeight - minHeight);
        const top = (maxHeight - height) * (0.52 + curve * 0.10 + flex * 0.16);
        const bow = curve * Math.min(13, width * 0.014) * focus;
        return {
          top,
          middle: top + height / 2 + bow + flutter * pullAmplitude * 0.26,
          bottom: top + height,
          shear: (curve * Math.min(15, width * 0.018) + ripple * Math.min(36, width * 0.04)) * lens,
        };
      }

      cards.forEach(({ texture, left, top }) => {
        const x = Math.round((left + offset) * ratio);
        const baseTop = top * ratio;
        const sourceMiddle = texture.height / 2;
        const start = Math.max(0, Math.floor(-x / step) * step);
        const end = Math.min(texture.width, canvas.width - x);
        for (let column = start; column < end; column += step) {
          const span = Math.min(step, texture.width - column);
          const projectedLeft = Math.round(projectX((x + column) / ratio) * ratio);
          const projectedRight = Math.round(projectX((x + column + span) / ratio) * ratio);
          if (projectedRight <= projectedLeft) continue;
          const center = column + span / 2;
          const ribbon = ribbonAt((x + center) / ratio);
          const topEdge = ribbon.top * ratio;
          const middle = ribbon.middle * ratio;
          const bottomEdge = ribbon.bottom * ratio;
          const upperScale = (middle - topEdge) / sourceMiddle;
          const lowerScale = (bottomEdge - middle) / sourceMiddle;
          const centerY = baseTop + middle;
          const shear = ribbon.shear * ratio / (bottomEdge - topEdge);
          const projectedWidth = projectedRight - projectedLeft + (column + span < texture.width ? Math.min(1, Math.abs(shear) * 20) : 0);
          const upperHeight = sourceMiddle + 1.5 / upperScale;
          // Stretch the edges around the center of the image and let the same surface lean as it moves.
          context.setTransform(1, 0, shear, 1, -shear * centerY, 0);
          context.drawImage(
            texture, column, 0, span, upperHeight,
            projectedLeft, centerY - sourceMiddle * upperScale,
            projectedWidth, upperHeight * upperScale,
          );
          context.drawImage(
            texture, column, sourceMiddle, span, texture.height - sourceMiddle,
            projectedLeft, centerY, projectedWidth, (texture.height - sourceMiddle) * lowerScale,
          );
        }
      });
      context.resetTransform();
      context.globalCompositeOperation = 'source-atop';
      context.fillStyle = edgeShade;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = 'source-over';
      gallery.setAttribute('data-bending', '');
    }

    function measure() {
      width = gallery.clientWidth;
      if (!width) return;
      const styles = getComputedStyle(gallery);
      const pixels = (property) => parseFloat(styles.getPropertyValue(property));
      const gap = pixels('--programs-heading-gap');
      const headingBottom = heading.getBoundingClientRect().bottom - scene.getBoundingClientRect().top;
      minHeight = pixels('--program-card-min-height');
      edgeHeight = pixels('--program-card-edge-height');
      maxHeight = pixels('--program-card-max-height');
      cardRadius = cards[0].element.getBoundingClientRect().width / 2;
      const outerSpace = width / 2 - cardRadius;
      ribbonRadius = width / 2 - Math.min(12, outerSpace * 0.35);
      gallery.style.setProperty('--programs-card-top', `${headingBottom + gap}px`);
      if (width < 600) {
        const introTop = headingBottom + Math.max(0, (gap - intro.offsetHeight) / 2);
        intro.style.top = `${introTop}px`;
      } else {
        intro.style.removeProperty('top');
      }
      ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      ratio = canvas.width / width;
      canvas.height = Math.round(gallery.clientHeight * ratio);
      edgeShade = context.createLinearGradient(0, 0, canvas.width, 0);
      edgeShade.addColorStop(0, 'rgb(0 0 0 / 14%)');
      edgeShade.addColorStop(0.38, 'transparent');
      edgeShade.addColorStop(0.62, 'transparent');
      edgeShade.addColorStop(1, 'rgb(0 0 0 / 14%)');
      desktop = width >= 1000;
      if (!desktop) intro.style.removeProperty('opacity');
      startOffset = track.offsetLeft;
      introThreshold = intro.offsetLeft + intro.offsetWidth + 9 + width * 0.035;
      const gutter = pixels('--programs-gutter');
      const lastCardWidth = cards.at(-1).element.offsetWidth;
      const endGutter = Math.max(gutter, (width - lastCardWidth) / 2);
      const endOffset = Math.min(gutter, width - track.offsetWidth - endGutter);
      distance = Math.max(0, startOffset - endOffset);
      const sceneHeight = scene.getBoundingClientRect().height;
      const visibleHeight = Math.min(sceneHeight, window.innerHeight);
      scrollDistance = Math.round(Math.max(visibleHeight * 0.85, distance * 0.95));
      section.style.setProperty('--programs-scroll-distance', `${scrollDistance}px`);

      if (stories) {
        const cardsBottom = headingBottom + gap + maxHeight;
        const overlap = Math.max(0, sceneHeight - cardsBottom - pixels('--programs-exit-gap'));
        // Keep the scene pinned while Stories covers the empty space below the cards.
        section.style.setProperty('--programs-exit-overlap', `${overlap}px`);
        stories.style.setProperty('--programs-exit-overlap', `${overlap}px`);
      }

      const trackBounds = track.getBoundingClientRect();
      const galleryTop = gallery.getBoundingClientRect().top;
      cards.forEach((card) => {
        const bounds = card.element.getBoundingClientRect();
        const media = card.media.getBoundingClientRect();
        card.left = bounds.left - trackBounds.left;
        card.top = bounds.top - galleryTop;
        card.texture.width = Math.round(media.width * ratio);
        card.texture.height = Math.round(media.height * ratio);
        card.ready = false;
      });
    }

    function stopRipple() {
      gsap.ticker.remove(updateRipple);
      ticking = false;
      lastScrollTime = 0;
      pull = 0;
      ripple = 0;
    }

    function updateRipple(_time, deltaTime) {
      const elapsed = Math.min(deltaTime, 48) / 1000;
      const target = performance.now() - lastScrollTime < 64 ? pull : 0;
      ripple += (target - ripple) * (1 - Math.exp(-elapsed * (target ? 12 : 7)));
      if (!target && Math.abs(ripple) < 0.004) stopRipple();
      render();
    }

    function followScroll({ progress }) {
      const now = performance.now();
      const elapsed = lastScrollTime ? gsap.utils.clamp(12, 48, now - lastScrollTime) : 16.7;
      const speed = (progress - position) * scrollDistance * 1000 / elapsed;
      pull = Math.sign(speed) * gsap.utils.clamp(0, 1, (Math.abs(speed) - 160) / 1350);
      lastScrollTime = now;
      position = progress;
      if (position === 0) stopRipple();
      if (pull && !ticking) {
        ticking = true;
        gsap.ticker.add(updateRipple);
        return;
      }
      if (!ticking) render();
    }

    function seek({ progress }) {
      stopRipple();
      position = progress;
      render();
    }

    measure();
    const assetLoads = new AbortController();
    cards.forEach((card) => card.image.addEventListener('load', () => {
      card.ready = false;
      render();
    }, { signal: assetLoads.signal }));
    document.fonts.addEventListener('loadingdone', () => {
      cards.forEach((card) => { card.ready = false; });
      render();
    }, { signal: assetLoads.signal });

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: () => `top ${getComputedStyle(scene).top}`,
      end: () => `+=${scrollDistance}`,
      onRefreshInit: measure,
      onRefresh: seek,
      onUpdate: followScroll,
    });
    const layoutResize = new ResizeObserver(() => ScrollTrigger.refresh());
    layoutResize.observe(heading);
    layoutResize.observe(scene);

    return () => {
      trigger.kill();
      layoutResize.disconnect();
      assetLoads.abort();
      stopRipple();
      gallery.removeAttribute('data-bending');
      section.removeAttribute('data-programs-scroll');
      section.style.removeProperty('--programs-scroll-distance');
      section.style.removeProperty('--programs-exit-overlap');
      stories?.style.removeProperty('--programs-exit-overlap');
      intro.style.removeProperty('opacity');
      intro.style.removeProperty('top');
      gallery.style.removeProperty('--programs-card-top');
      track.style.removeProperty('transform');
      canvas.remove();
    };
  });
}
