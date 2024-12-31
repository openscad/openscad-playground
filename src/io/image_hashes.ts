// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { rgbaToThumbHash, thumbHashToRGBA } from 'thumbhash'
import { decode as decodeBlurHash, encode as encodeBlurHash } from "blurhash";

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (...args) => reject(args);
    img.src = src;
  });
}

export async function imageToBlurhash(imageUrl: string): Promise<string> {
  const {rgba, w, h} = await getImageThumbnail(imageUrl, {maxSize: 100, opaque: true});
  const parts = 9;
  // const parts = 6;
  return encodeBlurHash(new Uint8ClampedArray(rgba), w, h, parts, parts);
}

export async function imageToThumbhash(imagePath: string): Promise<string> {
  const {rgba, w, h} = await getImageThumbnail(imagePath, {maxSize: 100, opaque: false});
  const hash = rgbaToThumbHash(w, h, rgba);
  return btoa(String.fromCharCode(...hash));
}

export function blurHashToImage(hash: string, width: number, height: number): string {
  const pixels = decodeBlurHash(hash, width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export function thumbHashToImage(hash: string): string {
  const {w: width, h: height, rgba} = thumbHashToRGBA(new Uint8Array([...atob(hash)].map(c => c.charCodeAt(0))));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(rgba);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

async function getImageThumbnail(imageUrl: string, {maxSize, opaque}: {maxSize: number, opaque: boolean}): Promise<{rgba: Uint8Array, w: number, h: number}> {
  const image = await loadImage(imageUrl);
  const width = image.width;
  const height = image.height;

  const scale = Math.min(maxSize / width, maxSize / height);
  const resizedWidth = Math.floor(width * scale);
  const resizedHeight = Math.floor(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = resizedWidth;
  canvas.height = resizedHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  if (opaque) {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, resizedWidth, resizedHeight);
  }
  ctx.drawImage(image, 0, 0, resizedWidth, resizedHeight);

  const imageData = ctx.getImageData(0, 0, resizedWidth, resizedHeight);
  const rgba = new Uint8Array(imageData.data.buffer);
  return {rgba, w: resizedWidth, h: resizedHeight};
}
