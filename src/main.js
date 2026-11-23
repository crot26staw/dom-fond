import './styles.css';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initProgramsGallery } from './programs-gallery.js';

const landing = document.querySelector('[data-landing]');
initProgramsGallery(landing?.querySelector('[data-programs-gallery]'));

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

const steps = document.querySelectorAll('[data-step]');
const stepCopy = document.querySelector('[data-step-copy]');
const stepDescriptions = [
  stepCopy.textContent,
  'Средства передаются управляющей компании с лицензией ЦБ РФ и инвестируются в консервативные надёжные инструменты.',
  'Вся прибыль от инвестиций регулярно превращается в реальную помощь. Ваш вклад становится вечным двигателем добра.',
];

steps.forEach((step) => {
  step.addEventListener('click', () => {
    steps.forEach((item) => item.setAttribute('aria-pressed', String(item === step)));
    stepCopy.textContent = stepDescriptions[Number(step.dataset.step)];
  });
});

const dialog = document.querySelector('#action-dialog');
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
    if (dialog.open) smoothScroll.stop();

    return () => {
      gsap.ticker.remove(advanceScroll);
      smoothScroll.destroy();
      lenis = undefined;
    };
  });
}

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
  lenis?.start();
  dialogTrigger?.focus({ preventScroll: true });
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
