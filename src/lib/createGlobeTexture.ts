import type { CanvasTexture, MeshPhongMaterial } from "three";
import { desaturateHex, hexToRgb, mixWithWhite } from "@/lib/colors";

const MASK_URL = "/textures/earth-water.png";

function parseColor(color: string): { r: number; g: number; b: number } {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
    };
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return {
      r: parseInt(match[1], 10) / 255,
      g: parseInt(match[2], 10) / 255,
      b: parseInt(match[3], 10) / 255,
    };
  }
  return { r: 0.3, g: 0.4, b: 0.5 };
}

function getLandRgb(primaryColor: string, isLight: boolean): { r: number; g: number; b: number } {
  if (isLight) {
    const tinted = desaturateHex(mixWithWhite(primaryColor, 0.35), 0.25);
    const rgb = hexToRgb(tinted);
    if (rgb) return rgb;
    return { r: 210, g: 205, b: 198 };
  }

  const warmed = mixWithWhite(desaturateHex(primaryColor, 0.4), 0.88);
  const rgb = hexToRgb(warmed);
  if (rgb) return rgb;
  return { r: 235, g: 232, b: 228 };
}

function processMaskImageData(imageData: ImageData, primaryColor: string, isLight: boolean) {
  const { r: pr, g: pg, b: pb } = parseColor(primaryColor);
  const land = getLandRgb(primaryColor, isLight);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const isWater = luminance >= 127;

    if (isWater) {
      data[i] = Math.round(pr * 255 * (isLight ? 0.55 : 0.45));
      data[i + 1] = Math.round(pg * 255 * (isLight ? 0.55 : 0.45));
      data[i + 2] = Math.round(pb * 255 * (isLight ? 0.65 : 0.55));
      data[i + 3] = isLight ? 85 : 75;
    } else {
      data[i] = land.r;
      data[i + 1] = land.g;
      data[i + 2] = land.b;
      data[i + 3] = 255;
    }
  }
}

export function loadGlobeTexture(
  primaryColor: string,
  isLight = false,
): Promise<MeshPhongMaterial> {
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
      processMaskImageData(imageData, primaryColor, isLight);
      ctx.putImageData(imageData, 0, 0);

      import("three")
        .then((THREE) => {
          const tex = new THREE.CanvasTexture(canvas);
          const mat = new THREE.MeshPhongMaterial({
            map: tex,
            transparent: true,
            opacity: 0.95,
            specular: new THREE.Color(0xffffff),
            shininess: 40,
            side: THREE.DoubleSide,
          });
          resolve(mat);
        })
        .catch(reject);
    };

    img.onerror = () => reject(new Error(`Failed to load globe mask: ${MASK_URL}`));
  });
}
