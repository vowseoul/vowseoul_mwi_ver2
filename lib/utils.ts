import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper to parse hex to RGB
function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  try {
    const cleanHex = hex.trim().replace(/^#/, '');
    if (cleanHex.length === 3) {
      const r = parseInt(cleanHex[0] + cleanHex[0], 16);
      const g = parseInt(cleanHex[1] + cleanHex[1], 16);
      const b = parseInt(cleanHex[2] + cleanHex[2], 16);
      return { r, g, b };
    } else if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.slice(0, 2), 16);
      const g = parseInt(cleanHex.slice(2, 4), 16);
      const b = parseInt(cleanHex.slice(4, 6), 16);
      return { r, g, b };
    }
  } catch (e) {
    console.error('Error parsing hex to rgb:', e);
  }
  return null;
}

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

// Convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const kVal = k(n);
    const color = l - a * Math.max(Math.min(kVal - 3, 9 - kVal, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Main helper function to get a legible color
export function getLegibleColor(bgColor: string, targetColor: string, isText: boolean = true): string {
  if (!bgColor || !targetColor) return targetColor;

  const bgRgb = hexToRgb(bgColor);
  const targetRgb = hexToRgb(targetColor);

  if (!bgRgb || !targetRgb) return targetColor;

  // Calculate relative luminance Y = 0.299*R + 0.587*G + 0.114*B
  const bgY = 0.299 * bgRgb.r + 0.587 * bgRgb.g + 0.114 * bgRgb.b;
  const bgHsl = rgbToHsl(bgRgb.r, bgRgb.g, bgRgb.b);
  const targetHsl = rgbToHsl(targetRgb.r, targetRgb.g, targetRgb.b);

  let { h, s, l } = targetHsl;
  const isBgLight = bgY > 128;

  if (isBgLight) {
    // Light background: the text/accent must be sufficiently dark
    if (isText) {
      // For main text: we want low lightness (high contrast)
      // If the target lightness is too high (close to bg), bring it down
      const maxL = Math.max(15, bgHsl.l - 50); // Need at least 50% lightness difference
      if (l > maxL) {
        l = Math.min(l, maxL);
      }
      // Also clamp absolute lightness for readability (no light grey text)
      if (l > 30) l = 25;
    } else {
      // For accents/secondary text: we want reasonable contrast
      const maxL = Math.max(25, bgHsl.l - 35);
      if (l > maxL) {
        l = Math.min(l, maxL);
      }
      if (l > 45) l = 40;
    }
  } else {
    // Dark background: the text/accent must be sufficiently light
    if (isText) {
      // For main text: we want high lightness
      const minL = Math.min(85, bgHsl.l + 50);
      if (l < minL) {
        l = Math.max(l, minL);
      }
      if (l < 80) l = 85;
    } else {
      // For accents: we want reasonable contrast
      const minL = Math.min(70, bgHsl.l + 35);
      if (l < minL) {
        l = Math.max(l, minL);
      }
      if (l < 60) l = 65;
    }
  }

  // Preserve some saturation if it's too gray and we want a colorful contrast,
  // or clamp if it's too neon.
  if (targetHsl.s > 10 && s < 10) {
    s = targetHsl.s;
  }

  return hslToHex(h, s, l);
}
