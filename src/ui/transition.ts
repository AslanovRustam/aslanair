import { curtainFrame, reducedCurtainFrame } from '@/experience/curtain';
import { curtainStore } from '@/experience/curtainStore';
import type { TransitionLabel } from '@/experience/navState';
import { cameraSettled } from '@/scene/CameraRig';
import { lockScroll } from '@/scroll/SmoothScroll';

/** Frames the camera must ride its pose after the jump before the chapter counts as ready — counted only once the
 * rig has had a few frames to see the jump (a phase change sets it gliding). */
const SETTLE_FRAMES = 2;
const SEE_JUMP_FRAMES = 3;

/**
 * A chapter jump behind the curtain (spec r4 §7): the curtain covers the screen, `jump` runs at the first covered
 * frame (the scroll, a phase change), the chapter counts as ready once the camera has ridden its new pose for two
 * frames, and the curtain lifts; focus then goes to the chapter's heading. The visitor's scrolling is held still
 * meanwhile, and a click while one runs does nothing. The stage is on <html data-curtain> for the page's CSS.
 */
export function transitionTo(to: TransitionLabel, jump: () => void): void {
  const store = curtainStore.getState();
  if (!store.begin(to, performance.now() / 1000)) return;
  lockScroll(true);
  const frameAt = matchMedia('(prefers-reduced-motion: reduce)').matches ? reducedCurtainFrame : curtainFrame;
  const root = document.documentElement;
  let jumped = false;
  let sinceJump = 0;
  let settled = 0;

  const tick = () => {
    const s = curtainStore.getState();
    const now = performance.now() / 1000;
    if (jumped && s.readyAt === null && ++sinceJump > SEE_JUMP_FRAMES) {
      settled = cameraSettled() ? settled + 1 : 0;
      if (settled >= SETTLE_FRAMES) s.markReady(now);
    }
    const ready = curtainStore.getState().readyAt;
    const frame = frameAt(now - s.startedAt, ready === null ? null : ready - s.startedAt);
    if (frame.stage === 'covered' && !jumped) {
      jumped = true;
      jump();
    }
    if (frame.done) {
      s.finish();
      delete root.dataset.curtain;
      lockScroll(false);
      const heading = document.querySelector<HTMLElement>(`[data-heading="${to.heading}"]`);
      if (heading) {
        if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
      return;
    }
    s.setFrame(frame);
    root.dataset.curtain = frame.stage;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
