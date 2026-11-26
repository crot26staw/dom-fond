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
  const { element, image, media, texture } = card;
  if (!image.complete || !image.naturalWidth) return false;
  const { width, height } = texture;
  const context = texture.getContext('2d');
  context.clearRect(0, 0, width, height);

  const styles = getComputedStyle(element);
  const value = (property) => parseFloat(styles.getPropertyValue(property));
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  card.crop = [(image.naturalWidth - cropWidth) / 2, (image.naturalHeight - cropHeight) / 2, cropWidth, cropHeight];
  card.radius = parseFloat(getComputedStyle(media).borderTopLeftRadius) * ratio;

  context.save();
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
  const curtain = scene.querySelector('.programs-curtain');
  const heading = scene.querySelector('.programs-title h2');
  const intro = scene.querySelector('.programs-intro');
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
    let maxHeight = 0;
    let ribbonRadius = 0;
    let startOffset = 0;
    let introThreshold = 0;
    let desktop = false;
    let distance = 0;
    let entryDistance = 0;
    let trackStartScroll = 0;
    let firstCardScroll = 0;
    let scrollDistance = 0;
    let position = 0;
    let entryProgress = 0;
    let edgeShade;
    const roomFadeEnd = 0.68;

    function ribbonAt(pixelX) {
      const x = pixelX / ratio;
      const drop = smoothStep(0, ribbonRadius, Math.abs(x - width / 2));
      const height = maxHeight - (maxHeight - minHeight) * drop;
      const curve = Math.sin((x / width - 0.5) * Math.PI * 1.2 + 0.72);
      const top = (maxHeight - height) * (0.52 + curve * 0.10);
      return {
        top: top * ratio,
        bottom: (top + height) * ratio,
      };
    }

    function clipCard(left, right, radius) {
      const first = left + radius;
      const last = right - radius;
      const start = ribbonAt(first);
      const end = ribbonAt(last);
      const step = 16 * ratio;
      context.beginPath();
      context.moveTo(first, start.top);
      for (let x = first + step; x < last; x += step) context.lineTo(x, ribbonAt(x).top);
      context.lineTo(last, end.top);
      context.quadraticCurveTo(right, end.top, right, end.top + radius);
      context.lineTo(right, end.bottom - radius);
      context.quadraticCurveTo(right, end.bottom, last, end.bottom);
      for (let x = last - step; x > first; x -= step) context.lineTo(x, ribbonAt(x).bottom);
      context.lineTo(first, start.bottom);
      context.quadraticCurveTo(left, start.bottom, left, start.bottom - radius);
      context.lineTo(left, start.top + radius);
      context.quadraticCurveTo(left, start.top, first, start.top);
      context.closePath();
      context.clip();
    }

    function render() {
      const offset = width - distance * position;
      moveTrack(offset - startOffset);
      const trackOpacity = desktop
        ? gsap.utils.clamp(0, 1, (offset - introThreshold) / Math.max(1, startOffset - introThreshold))
        : 1;
      curtain.style.opacity = smoothStep(0.07, roomFadeEnd, entryProgress);
      intro.style.opacity = smoothStep(roomFadeEnd, 1, entryProgress) * trackOpacity;

      if (document.fonts.status === 'loading' || !cards.every((card) => card.ready || (card.ready = cacheCard(card, ratio)))) {
        gallery.removeAttribute('data-bending');
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      const step = Math.max(1, Math.round(3 * ratio));
      cards.forEach(({ texture, image, crop, radius, left, top }) => {
        const x = Math.round((left + offset) * ratio);
        if (x >= canvas.width || x + texture.width <= 0) return;
        context.save();
        context.translate(0, top * ratio);
        clipCard(x, x + texture.width, radius);
        context.drawImage(image, ...crop, x, 0, texture.width, texture.height);

        // Only the caption and its shade follow the ribbon surface.
        const start = Math.max(0, Math.floor(-x / step) * step);
        const end = Math.min(texture.width, canvas.width - x);
        for (let column = start; column < end; column += step) {
          const span = Math.min(step, texture.width - column);
          const center = column + span / 2;
          const ribbon = ribbonAt(x + center);
          context.drawImage(
            texture, column, 0, span, texture.height,
            x + column, ribbon.top, span, ribbon.bottom - ribbon.top,
          );
        }
        context.restore();
      });
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
      const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const pixels = (property) => {
        const length = styles.getPropertyValue(property).trim();
        return parseFloat(length) * (length.endsWith('rem') ? rootSize : 1);
      };
      const gap = pixels('--programs-heading-gap');
      const headingBottom = heading.getBoundingClientRect().bottom - scene.getBoundingClientRect().top;
      minHeight = pixels('--program-card-min-height');
      maxHeight = pixels('--program-card-max-height');
      ribbonRadius = width / 2 - 0.75 * rootSize;
      gallery.style.setProperty('--programs-card-top', `${headingBottom + gap}px`);
      if (width < 600) {
        const introTop = headingBottom + Math.max(0, (gap - intro.offsetHeight) / 2);
        intro.style.top = `${introTop}px`;
      } else {
        intro.style.removeProperty('top');
      }
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      ratio = canvas.width / width;
      canvas.height = Math.round(gallery.clientHeight * ratio);
      edgeShade = context.createLinearGradient(0, 0, canvas.width, 0);
      edgeShade.addColorStop(0, 'rgb(0 0 0 / 14%)');
      edgeShade.addColorStop(0.38, 'transparent');
      edgeShade.addColorStop(0.62, 'transparent');
      edgeShade.addColorStop(1, 'rgb(0 0 0 / 14%)');
      desktop = width >= 1000;
      startOffset = parseFloat(getComputedStyle(track).marginInlineStart);
      introThreshold = intro.offsetLeft + intro.offsetWidth + 0.5625 * rootSize + width * 0.035;
      const gutter = pixels('--programs-gutter');
      const lastCardWidth = cards.at(-1).element.offsetWidth;
      const endGutter = Math.max(gutter, (width - lastCardWidth) / 2);
      const endOffset = Math.min(gutter, width - track.offsetWidth - endGutter);
      const arrivalDistance = width - startOffset;
      const galleryDistance = Math.max(0, startOffset - endOffset);
      distance = arrivalDistance + galleryDistance;
      const contentHeight = headingBottom + gap + maxHeight + pixels('--programs-bottom-gap');
      section.style.setProperty('--programs-content-height', `${contentHeight}px`);
      const sceneHeight = scene.getBoundingClientRect().height;
      const visibleHeight = Math.min(sceneHeight, window.innerHeight);
      entryDistance = Math.round(visibleHeight * 0.78);
      trackStartScroll = entryDistance * roomFadeEnd;
      // Keep the gallery's scroll rate across the whole track, including the way in.
      const scrollPerPixel = galleryDistance > 0
        ? Math.round(Math.max(visibleHeight * 0.85, galleryDistance * 0.95)) / galleryDistance
        : 0.95;
      const trackScroll = Math.round(distance * scrollPerPixel);
      firstCardScroll = trackStartScroll + trackScroll * arrivalDistance / distance;
      scrollDistance = trackStartScroll + trackScroll;
      section.style.setProperty('--programs-scroll-distance', `${scrollDistance}px`);

      const trackBounds = track.getBoundingClientRect();
      const galleryBounds = gallery.getBoundingClientRect();
      cards.forEach((card) => {
        const bounds = card.element.getBoundingClientRect();
        const media = card.media.getBoundingClientRect();
        card.left = bounds.left - trackBounds.left;
        card.top = bounds.top - galleryBounds.top;
        card.texture.width = Math.round(media.width * ratio);
        card.texture.height = Math.round(media.height * ratio);
        card.ready = false;
      });
    }

    function followScroll({ progress }) {
      const travelled = progress * scrollDistance;
      entryProgress = gsap.utils.clamp(0, 1, travelled / entryDistance);
      position = gsap.utils.clamp(0, 1, (travelled - trackStartScroll) / (scrollDistance - trackStartScroll));
      render();
    }

    measure();
    const listeners = new AbortController();
    cards.forEach((card) => card.image.addEventListener('load', () => {
      card.ready = false;
      render();
    }, { signal: listeners.signal }));
    document.fonts.addEventListener('loadingdone', () => {
      cards.forEach((card) => { card.ready = false; });
      render();
    }, { signal: listeners.signal });

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: () => `top ${getComputedStyle(scene).top}`,
      end: () => `+=${scrollDistance}`,
      onRefreshInit: measure,
      onRefresh: followScroll,
      onUpdate: followScroll,
    });
    gallery.addEventListener('focus', () => {
      const firstCardTarget = trigger.start + firstCardScroll;
      if (trigger.scroll() < firstCardTarget && gallery.matches(':focus-visible')) {
        window.scrollTo({ top: firstCardTarget, behavior: 'instant' });
      }
    }, { signal: listeners.signal });
    let refreshFrame;
    const layoutResize = new ResizeObserver(() => {
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
    });
    layoutResize.observe(heading);
    layoutResize.observe(scene);

    return () => {
      trigger.kill();
      layoutResize.disconnect();
      cancelAnimationFrame(refreshFrame);
      listeners.abort();
      gallery.removeAttribute('data-bending');
      section.removeAttribute('data-programs-scroll');
      section.style.removeProperty('--programs-content-height');
      section.style.removeProperty('--programs-scroll-distance');
      curtain.style.removeProperty('opacity');
      intro.style.removeProperty('opacity');
      intro.style.removeProperty('top');
      gallery.style.removeProperty('--programs-card-top');
      track.style.removeProperty('transform');
      canvas.remove();
    };
  });
}
