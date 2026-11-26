import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import heroVideoUrl from './assets/hero-scroll.mp4?url';

const plantAssets = import.meta.glob('../plants_48_webp_frames/frame_*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});
const plantFrameUrls = Object.keys(plantAssets).sort().map((path) => plantAssets[path]);
const plantFps = 16;
const videoFps = 24;
const videoScroll = 180;
const windowScroll = 95;
const videoEnd = videoScroll / (videoScroll + windowScroll);
const clampProgress = gsap.utils.clamp(0, 1);
const ease = gsap.parseEase('power1.inOut');

// Inside edges of the opening, traced every eight frames on a 640 × 356 reference.
const windowOutlines = [
  [250, 218, 307, 218, 317, 254, 321, 271, 316, 299, 243, 299, 243, 256, 247, 236],
  [252, 195, 315, 196, 326, 235, 332, 258, 326, 295, 242, 295, 241, 243, 247, 216],
  [249, 171, 325, 174, 337, 225, 347, 252, 338, 292, 239, 292, 237, 233, 244, 201],
  [249, 141, 340, 145, 355, 205, 368, 244, 358, 290, 235, 290, 233, 216, 241, 183],
  [244, 105, 357, 109, 371, 181, 391, 224, 375, 289, 226, 289, 223, 199, 234, 157],
];
const firstWindowFrame = 88;
const windowFrameStep = 8;
const finalWindowFrame = firstWindowFrame + (windowOutlines.length - 1) * windowFrameStep;

export function initHeroMotion(hero) {
  if (!hero) return;

  const scene = hero.querySelector('.hero-scene');
  const camera = scene.querySelector('.hero-camera');
  const video = scene.querySelector('.hero-video');
  const still = scene.querySelector('.hero-window-still');
  const title = scene.querySelector('.hero-title');
  const aperture = scene.querySelector('.hero-window');
  const room = aperture.querySelector('.hero-window-room');
  const programsRoom = hero.nextElementSibling?.querySelector('.programs-room');
  const foreground = scene.querySelector('.hero-foreground');
  const firstPlantFrame = foreground.src;

  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const events = new AbortController();
    // Reveal the heading through the same window mask as the room, before the section takes over.
    const roomTitle = hero.nextElementSibling?.querySelector('.programs-title')?.cloneNode(true);
    if (roomTitle) {
      roomTitle.querySelector('h2').removeAttribute('id');
      room.append(roomTitle);
    }
    const frames = [];
    let progress = 0;
    let scrollProgress = 0;
    let displayedFrame = 0;
    let plantFrameIndex = 0;
    let width;
    let height;

    function renderWindow() {
      const entry = clampProgress((scrollProgress - videoEnd) / (1 - videoEnd));
      const entering = entry > 0;
      const frame = entering ? finalWindowFrame : displayedFrame;
      title.style.opacity = 1 - ease(clampProgress((frame - 68) / 27));
      hero.toggleAttribute('data-entered-room', entry >= 1);

      still.hidden = !entering;
      room.hidden = !entering;
      aperture.toggleAttribute('data-opening', entering);
      if (!entering) {
        camera.style.removeProperty('transform');
        camera.style.removeProperty('transform-origin');
      }
      aperture.hidden = frame < firstWindowFrame;
      if (aperture.hidden) return;

      const sample = Math.min(windowOutlines.length - 1, (frame - firstWindowFrame) / windowFrameStep);
      const before = Math.floor(sample);
      const after = Math.ceil(sample);
      const outline = windowOutlines[before].map((pixel, index) =>
        gsap.utils.interpolate(pixel, windowOutlines[after][index], sample - before));

      const cover = Math.max(width / 640, height / 356);
      const left = (width - 640 * cover) / 2;
      const top = (height - 356 * cover) / 2;
      const x = left + (outline[0] + outline[2]) / 2 * cover;
      const y = top + (outline[3] + outline[11]) / 2 * cover;
      const zoomProgress = ease(entry);
      // Zoom until the rectangle inside the curtains covers even the viewport corners.
      const fill = Math.max(width / (110 * cover), height / (174 * cover)) * 1.08;
      const scale = fill ** zoomProgress;
      const shiftX = (width / 2 - x) * zoomProgress;
      const shiftY = (height / 2 - y) * zoomProgress;

      const points = [];
      for (let i = 0; i < outline.length; i += 2) {
        const pointX = x + (left + outline[i] * cover - x) * scale + shiftX;
        const pointY = y + (top + outline[i + 1] * cover - y) * scale + shiftY;
        points.push(`${pointX}px ${pointY}px`);
      }
      if (entering) {
        camera.style.transformOrigin = `${x}px ${y}px`;
        camera.style.transform = `translate(${shiftX}px, ${shiftY}px) scale(${scale})`;
      }
      aperture.style.clipPath = `polygon(${points.join(', ')})`;
      aperture.style.setProperty('--window-shadow', ease(clampProgress((frame - firstWindowFrame) / 15)));
      aperture.style.setProperty('--window-x', `${x + shiftX}px`);
      aperture.style.setProperty('--window-y', `${y + shiftY}px`);
      aperture.style.setProperty('--window-feather', `${Math.min(width, height) * 0.17}px`);
      const opening = ease(clampProgress((entry - 0.15) / 0.81)) * Math.hypot(width, height) * 0.8;
      aperture.style.setProperty('--window-opening', `${opening}px`);
    }

    function showPlantFrame() {
      const frame = frames[plantFrameIndex];
      if (frame?.naturalWidth && foreground.src !== frame.src) foreground.src = frame.src;
    }

    function seekVideo() {
      if (video.seeking || !Number.isFinite(video.duration)) return;

      // Finish on the last frame instead of seeking past it.
      const lastFrame = Math.round(video.duration * videoFps) - 1;
      const frame = Math.round(progress * lastFrame);
      const time = frame === 0 ? 0 : (frame + 0.25) / videoFps;
      if (Math.abs(video.currentTime - time) > 0.5 / videoFps) video.currentTime = time;
    }

    function showVideoFrame() {
      if (video.seeking || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

      video.hidden = false;
      if (!frames.length) {
        for (const url of plantFrameUrls) {
          const frame = new Image();
          frame.fetchPriority = 'low';
          frame.addEventListener('load', showPlantFrame, { signal: events.signal });
          frame.src = url;
          frames.push(frame);
        }
      }

      const time = video.currentTime;
      displayedFrame = Math.floor(time * videoFps);
      renderWindow();
      plantFrameIndex = Math.floor(time * plantFps) % frames.length;
      showPlantFrame();
      // As the camera approaches the window, the foreground leaves the shot.
      const fade = gsap.utils.mapRange(0.65, 0.95, 1, 0, time / video.duration);
      foreground.style.opacity = gsap.utils.clamp(0, 1, fade);

      // If scrolling continued during this seek, render the newest requested frame next.
      seekVideo();
    }

    function resetMedia() {
      video.hidden = true;
      foreground.src = firstPlantFrame;
      foreground.style.removeProperty('opacity');
      delete hero.dataset.heroScroll;
      delete hero.dataset.enteredRoom;
      hero.style.removeProperty('--hero-scroll-distance');
      camera.style.removeProperty('transform');
      camera.style.removeProperty('transform-origin');
      title.style.removeProperty('opacity');
      room.style.removeProperty('height');
      roomTitle?.remove();
      still.hidden = true;
      room.hidden = true;
      aperture.removeAttribute('data-opening');
      aperture.hidden = true;
    }

    function updateScroll({ progress: nextProgress }) {
      scrollProgress = nextProgress;
      progress = clampProgress(scrollProgress / videoEnd);
      renderWindow();
      seekVideo();
    }

    function measureScene() {
      width = scene.clientWidth;
      height = scene.getBoundingClientRect().height;
      room.style.height = `${programsRoom?.getBoundingClientRect().height || height}px`;
    }

    hero.style.setProperty('--hero-scroll-distance', `${videoScroll + windowScroll}svh`);
    hero.dataset.heroScroll = '';
    measureScene();
    const trigger = ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: () => `+=${hero.getBoundingClientRect().height - height}`,
      onUpdate: updateScroll,
      onRefreshInit: measureScene,
      onRefresh: updateScroll,
    });

    const { signal } = events;
    video.addEventListener('loadedmetadata', seekVideo, { signal });
    video.addEventListener('loadeddata', showVideoFrame, { signal });
    video.addEventListener('seeked', showVideoFrame, { signal });
    video.addEventListener('error', () => {
      trigger.kill();
      events.abort();
      resetMedia();
      ScrollTrigger.refresh();
    }, { signal });

    const visibility = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      video.src = heroVideoUrl;
      visibility.disconnect();
    });
    visibility.observe(scene);

    return () => {
      visibility.disconnect();
      events.abort();
      resetMedia();
      if (video.hasAttribute('src')) {
        video.removeAttribute('src');
        video.load();
      }
    };
  });
}
