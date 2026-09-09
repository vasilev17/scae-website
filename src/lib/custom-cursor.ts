import { flags } from '@/lib/flags';

const ENABLE_QUERY =
  '(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)';

const HOVER_SELECTOR = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  'summary',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="link"]',
  '[data-cursor="hover"]',
  '.gate-menu-joystick',
].join(',');

let mounted = false;

function isHoverTarget(target: EventTarget | null): boolean {
  const node =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  return node?.closest(HOVER_SELECTOR) != null;
}

export function mountCustomCursor(): void {
  if (!flags.customCursor || mounted) return;

  const root = document.querySelector<HTMLElement>('.site-cursor');
  if (!root) return;

  mounted = true;

  const html = document.documentElement;
  const media = window.matchMedia(ENABLE_QUERY);
  let x = 0;
  let y = 0;
  let hover = false;
  let visible = false;

  const paint = () => {
    root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const setVisible = (next: boolean) => {
    if (visible === next) return;
    visible = next;
    root.classList.toggle('is-visible', next);
  };

  const setHover = (next: boolean) => {
    if (hover === next) return;
    hover = next;
    root.dataset.hover = next ? 'true' : 'false';
  };

  const syncEnabled = () => {
    if (media.matches) {
      html.classList.add('has-custom-cursor');
      return;
    }
    html.classList.remove('has-custom-cursor');
    setVisible(false);
    setHover(false);
  };

  const onMove = (event: PointerEvent) => {
    if (!media.matches) return;
    x = event.clientX;
    y = event.clientY;
    paint();
    setVisible(true);
    setHover(isHoverTarget(event.target));
  };

  const onLeaveWindow = (event: PointerEvent) => {
    if (event.relatedTarget != null) return;
    setVisible(false);
    setHover(false);
  };

  syncEnabled();
  media.addEventListener('change', syncEnabled);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerout', onLeaveWindow);

  import.meta.hot?.dispose(() => {
    html.classList.remove('has-custom-cursor');
    media.removeEventListener('change', syncEnabled);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerout', onLeaveWindow);
    mounted = false;
  });
}
