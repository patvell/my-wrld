import type { CanvasTexture, MeshStandardMaterial } from "three";

const MASK_URL = "/textures/earth-water.png";

const LAND_ALPHA = 235;
const WATER_ALPHA = 0;
const LAND_COLOR = { r: 248, g: 248, b: 248 };
const BLUR_RADIUS = 1;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function blurAlphaChannel(data: Uint8ClampedArray, width: number, height: number, radius: number) {
  const alphas = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    alphas[i] = data[i * 4 + 3];
  }

  const blurred = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += alphas[ny * width + nx];
            count++;
          }
        }
      }
      blurred[y * width + x] = sum / count;
    }
  }

  for (let i = 0; i < width * height; i++) {
    data[i * 4 + 3] = Math.round(blurred[i]);
  }
}

function processMaskImageData(imageData: ImageData) {
  const { data, width, height } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const landFactor = 1 - smoothstep(115, 145, luminance);
    const alpha = Math.round(WATER_ALPHA + landFactor * (LAND_ALPHA - WATER_ALPHA));

    data[i] = LAND_COLOR.r;
    data[i + 1] = LAND_COLOR.g;
    data[i + 2] = LAND_COLOR.b;
    data[i + 3] = alpha;
  }

  blurAlphaChannel(data, width, height, BLUR_RADIUS);
}

export interface GlobeTextureResult {
  material: MeshStandardMaterial;
  texture: CanvasTexture;
}

export function loadGlobeTexture(): Promise<GlobeTextureResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = MASK_URL;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas 2D context"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      processMaskImageData(imageData);
      ctx.putImageData(imageData, 0, 0);

      import("three").then((THREE) => {
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const material = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          opacity: 1.0,
          roughness: 0.85,
          metalness: 0.05,
          side: THREE.FrontSide,
        });

        resolve({ material, texture });
      }).catch(reject);
    };

    img.onerror = () => reject(new Error(`Failed to load globe mask: ${MASK_URL}`));
  });
}

export function applyTextureAnisotropy(
  texture: CanvasTexture,
  maxAnisotropy: number,
) {
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
}
