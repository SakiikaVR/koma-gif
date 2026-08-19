import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFrameSchedule, normalizeDimension } from './timeline.js';

const slides = [
  { duration: 2 },
  { duration: 1.5 },
];

test('cut transition creates one frame per slide', () => {
  const frames = makeFrameSchedule(slides, { transition: 'cut', loop: true });
  assert.equal(frames.length, 2);
  assert.deepEqual(frames.map((frame) => frame.delay), [2000, 1500]);
});

test('fade preserves the requested duration for every slide', () => {
  const frames = makeFrameSchedule(slides, {
    transition: 'fade',
    transitionMs: 500,
    transitionFps: 8,
    loop: true,
  });

  const firstSlideDuration = frames
    .filter((frame) => frame.from === 0)
    .reduce((total, frame) => total + frame.delay, 0);
  const secondSlideDuration = frames
    .filter((frame) => frame.from === 1)
    .reduce((total, frame) => total + frame.delay, 0);

  assert.equal(firstSlideDuration, 2000);
  assert.equal(secondSlideDuration, 1500);
  assert.equal(frames.at(-1).to, 0);
});

test('one-shot animation does not fade the last slide back to the first', () => {
  const frames = makeFrameSchedule(slides, {
    transition: 'fade',
    transitionMs: 500,
    transitionFps: 8,
    loop: false,
  });
  const finalFrames = frames.filter((frame) => frame.from === 1);
  assert.equal(finalFrames.length, 1);
  assert.equal(finalFrames[0].delay, 1500);
});

test('dimensions are rounded and kept within safe limits', () => {
  assert.equal(normalizeDimension('719.6'), 720);
  assert.equal(normalizeDimension(10), 64);
  assert.equal(normalizeDimension(9999), 1600);
  assert.equal(normalizeDimension('not-a-number', 1080), 1080);
});
