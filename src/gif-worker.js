import { GIFEncoder, applyPalette, quantize } from 'gifenc';

let encoder;
let width;
let height;
let repeat;
let frameIndex;

self.addEventListener('message', (event) => {
  const message = event.data;

  try {
    if (message.type === 'start') {
      encoder = GIFEncoder();
      width = message.width;
      height = message.height;
      repeat = message.repeat;
      frameIndex = 0;
      self.postMessage({ type: 'ready' });
      return;
    }

    if (message.type === 'frame') {
      const rgba = new Uint8ClampedArray(message.pixels);
      const palette = quantize(rgba, message.colors, { format: 'rgb565' });
      const indexed = applyPalette(rgba, palette, 'rgb565');

      encoder.writeFrame(indexed, width, height, {
        palette,
        delay: message.delay,
        repeat,
      });

      frameIndex += 1;
      self.postMessage({ type: 'frame-complete', frameIndex });
      return;
    }

    if (message.type === 'finish') {
      encoder.finish();
      const bytes = encoder.bytes();
      self.postMessage({ type: 'complete', bytes: bytes.buffer }, [bytes.buffer]);
      encoder = null;
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
