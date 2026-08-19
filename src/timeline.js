export const MIN_DELAY_MS = 20;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeDimension(value, fallback = 720) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? clamp(parsed, 64, 1600) : fallback;
}

export function makeFrameSchedule(slides, options = {}) {
  const {
    transition = 'fade',
    transitionMs = 350,
    transitionFps = 8,
    loop = true,
  } = options;

  if (!slides.length) return [];

  const schedule = [];

  slides.forEach((slide, index) => {
    const durationMs = clamp(Math.round(Number(slide.duration) * 1000), 200, 30000);
    const hasNext = index < slides.length - 1 || loop;
    const shouldFade = transition === 'fade' && hasNext && slides.length > 1;
    const fadeMs = shouldFade ? clamp(Math.round(transitionMs), 0, durationMs - MIN_DELAY_MS) : 0;

    schedule.push({
      from: index,
      to: index,
      mix: 0,
      delay: Math.max(MIN_DELAY_MS, durationMs - fadeMs),
    });

    if (!shouldFade || fadeMs === 0) return;

    const next = (index + 1) % slides.length;
    const frameCount = Math.max(1, Math.round((fadeMs / 1000) * transitionFps));
    const frameDelay = Math.max(MIN_DELAY_MS, Math.round(fadeMs / frameCount));

    for (let frame = 1; frame <= frameCount; frame += 1) {
      schedule.push({
        from: index,
        to: next,
        mix: frame / frameCount,
        delay: frameDelay,
      });
    }
  });

  return schedule;
}

export function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return '2.0秒';
  return `${value.toFixed(1)}秒`;
}
