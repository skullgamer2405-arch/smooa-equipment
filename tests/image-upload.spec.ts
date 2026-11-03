import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\//, route => new URL(route.request().url()).origin === "http://127.0.0.1:5174" ? route.continue() : route.abort());
  await page.goto("/");
});

test("noisy PNG above ingress limit shrinks with its aspect ratio intact", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = "/src/lib/image-upload.ts";
    const { prepareImage } = await import(modulePath);
    const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 1000;
    const context = canvas.getContext("2d")!;
    const pixels = context.createImageData(canvas.width, canvas.height);
    let seed = 42;
    for (let i = 0; i < pixels.data.length; i += 4) {
      for (let c = 0; c < 3; c++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels.data[i+c] = seed >>> 24; }
      pixels.data[i+3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const source = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), "image/png"));
    const png = await prepareImage(new File([source], "noise.png", { type: "image/png" }));
    const image = await createImageBitmap(png);
    const result = { source: source.size, size: png.size, type: png.type, width: image.width, height: image.height };
    image.close(); return result;
  });
  console.log("noisy PNG measurements", result);
  expect(result.source).toBeGreaterThan(3 * 1024 * 1024);
  expect(result.size).toBeLessThanOrEqual(3 * 1024 * 1024);
  expect(result.type).toBe("image/png");
  expect(result.width).toBeLessThan(1600);
  expect(result.width / result.height).toBeCloseTo(1.6, 2);
});

test("small RGBA stays full size and transparent; JPEG/WebP and invalid sources", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = "/src/lib/image-upload.ts";
    const { prepareImage } = await import(modulePath);
    const canvas = document.createElement("canvas"); canvas.width = 7; canvas.height = 5;
    canvas.getContext("2d")!.fillRect(1, 1, 2, 2);
    const formats = [];
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      const source = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), type));
      const png = await prepareImage(new File([source], "small", { type }));
      const bitmap = await createImageBitmap(png);
      const output = document.createElement("canvas"); output.width = bitmap.width; output.height = bitmap.height;
      output.getContext("2d")!.drawImage(bitmap, 0, 0);
      formats.push({ width: bitmap.width, height: bitmap.height, type: png.type, alpha: output.getContext("2d")!.getImageData(0,0,1,1).data[3] });
      bitmap.close();
    }
    const errors = [];
    for (const file of [new File(["bad"], "bad.svg", {type:"image/svg+xml"}), new File([new Uint8Array(10*1024*1024+1)],"large.png",{type:"image/png"}), new File(["bad"], "broken.png", {type:"image/png"})]) {
      try { await prepareImage(file); errors.push(""); } catch(e) { errors.push(String(e)); }
    }
    return { formats, errors };
  });
  expect(result.formats.map(x => [x.width,x.height,x.type])).toEqual(Array(3).fill([7,5,"image/png"]));
  expect(result.formats[0].alpha).toBe(0);
  expect(result.formats[2].alpha).toBe(0);
  expect(result.errors.every(Boolean)).toBe(true);
});

test("out-of-bounds dimensions reject and encoding failure closes decoded bitmap", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = "/src/lib/image-upload.ts";
    const { prepareImage } = await import(modulePath);
    const errors = [];
    for (const [width,height] of [[4097,1],[4001,4000]]) {
      const canvas = document.createElement("canvas"); canvas.width=width; canvas.height=height;
      const source = await new Promise<Blob>(resolve => canvas.toBlob(b=>resolve(b!)));
      try { await prepareImage(new File([source],"large.png",{type:"image/png"})); errors.push(""); } catch(e) { errors.push(String(e)); }
    }
    const canvas = document.createElement("canvas"); canvas.width=2;canvas.height=2;
    const source = await new Promise<Blob>(resolve => canvas.toBlob(b=>resolve(b!)));
    const originalDecode = window.createImageBitmap;
    const originalEncode = HTMLCanvasElement.prototype.toBlob;
    let closed = false;
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      const bitmap = await (originalDecode as Function)(...args);
      const close = bitmap.close.bind(bitmap);
      bitmap.close = () => { closed=true; close(); };
      return bitmap;
    }) as typeof createImageBitmap;
    HTMLCanvasElement.prototype.toBlob = callback => callback(null);
    try { await prepareImage(new File([source],"small.png",{type:"image/png"})); errors.push(""); } catch(e) { errors.push(String(e)); }
    finally { window.createImageBitmap=originalDecode;HTMLCanvasElement.prototype.toBlob=originalEncode; }
    return { errors,closed };
  });
  expect(result.errors.slice(0,2).every(error=>error.includes("4096px"))).toBe(true);
  expect(result.errors[2]).toContain("เตรียมภาพไม่สำเร็จ");
  expect(result.closed).toBe(true);
});
