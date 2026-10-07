export interface ProtagonistState {
  id: string;
  index: string;
  name: string;
  hindiSubtitle: string;
  title: string;
  location: string;
  imageUrl: string;
  defaultLeftEyeUV: [number, number];
  defaultRightEyeUV: [number, number];
  description: string;
  stats: {
    reflexSync: string;
    thermalOutput: string;
    streetCred: string;
  };
}

export interface FlamePreset {
  id: string;
  label: string;
  primaryHex: string;
  secondaryHex: string;
  primaryRGB: [number, number, number];
  secondaryRGB: [number, number, number];
}

export interface PaperTearModeInfo {
  id: number;
  name: string;
  hindiDesc: string;
  shortLabel: string;
}

export const PROTAGONIST_STATES: ProtagonistState[] = [
  {
    id: 'sovereign',
    index: '01',
    name: 'Aryan Vance — Street Sovereign',
    hindiSubtitle: 'हाइपर-रियल स्टेट · शांत से ज्वाला तक',
    title: 'calm_hyperreal',
    location: 'Sector 04 · Vice Harbour',
    imageUrl: '/src/assets/images/boy_hyperreal_calm_1791396562014.jpg',
    defaultLeftEyeUV: [0.395, 0.555],
    defaultRightEyeUV: [0.605, 0.555],
    description:
      'High-relief 3D facial displacement sculpt. Move your cursor across the viewport to wake his gaze and ignite molten ocular flames.',
    stats: {
      reflexSync: '99.4% Neural Lock',
      thermalOutput: '1,420 K Ocular Surge',
      streetCred: 'Level IX Syndicate',
    },
  },
  {
    id: 'inferno',
    index: '02',
    name: 'Aryan Vance — Inferno Overdrive',
    hindiSubtitle: 'अग्नि दृष्टि · रौद्र रूप',
    title: 'inferno_overdrive',
    location: 'Redline Foundry · Core District',
    imageUrl: '/src/assets/images/boy_hyperreal_inferno_1791396579546.jpg',
    defaultLeftEyeUV: [0.395, 0.555],
    defaultRightEyeUV: [0.605, 0.555],
    description:
      'Unleashed thermal overdrive revealed behind the torn poster layer. Volumetric embers and magma veins surge with every cursor velocity spike.',
    stats: {
      reflexSync: '100% Overclocked',
      thermalOutput: '2,850 K Plasma Core',
      streetCred: 'Apex Most Wanted',
    },
  },
  {
    id: 'noir',
    index: '03',
    name: 'Aryan Vance — Nocturnal Phantom',
    hindiSubtitle: 'रात्रि ऑप्स · रेन शैडो',
    title: 'nocturnal_noir',
    location: 'Monsoon Expressway · Midnight',
    imageUrl: '/src/assets/images/boy_hyperreal_noir_1791396593254.jpg',
    defaultLeftEyeUV: [0.395, 0.555],
    defaultRightEyeUV: [0.605, 0.555],
    description:
      'Rain-slicked chiaroscuro street state. Rip through the fibrous paper layers via the Remote Transition deck or claw-drag directly on the 3D mesh.',
    stats: {
      reflexSync: '98.9% Stealth Track',
      thermalOutput: '1,980 K Crimson Arc',
      streetCred: 'Ghost Protocol',
    },
  },
];

export const URBAN_WALL_BG = '/src/assets/images/urban_wall_poster_bg_1791396607947.jpg';

export const FLAME_PRESETS: FlamePreset[] = [
  {
    id: 'magma',
    label: 'Hellfire Magma',
    primaryHex: '#FF3B00',
    secondaryHex: '#FFAE00',
    primaryRGB: [1.0, 0.23, 0.0],
    secondaryRGB: [1.0, 0.68, 0.0],
  },
  {
    id: 'crimson',
    label: 'Crimson Laser',
    primaryHex: '#FF003C',
    secondaryHex: '#FF758F',
    primaryRGB: [1.0, 0.0, 0.235],
    secondaryRGB: [1.0, 0.46, 0.56],
  },
  {
    id: 'plasma',
    label: 'Cyan Plasma',
    primaryHex: '#00B4D8',
    secondaryHex: '#90E0EF',
    primaryRGB: [0.0, 0.71, 0.85],
    secondaryRGB: [0.56, 0.88, 0.94],
  },
  {
    id: 'solar',
    label: 'Solar Gold',
    primaryHex: '#F59E0B',
    secondaryHex: '#FEF08A',
    primaryRGB: [0.96, 0.62, 0.04],
    secondaryRGB: [1.0, 0.94, 0.54],
  },
];

export const PAPER_TEAR_MODES: PaperTearModeInfo[] = [
  {
    id: 0,
    name: 'Diagonal Slash Rip',
    hindiDesc: 'तिरछा कागज़ फाड़ ट्रांज़िशन',
    shortLabel: 'Diagonal Rip',
  },
  {
    id: 1,
    name: 'Center Eye Burst',
    hindiDesc: 'आँखों के बीच से पेपर ब्लास्ट',
    shortLabel: 'Eye Burst Rip',
  },
  {
    id: 2,
    name: 'Vertical Poster Peel',
    hindiDesc: 'ऊपर से नीचे पोस्टर पील',
    shortLabel: 'Vertical Peel',
  },
  {
    id: 3,
    name: 'Horizontal Claw Tear',
    hindiDesc: 'आड़ा पंजा पेपर फाड़',
    shortLabel: 'Claw Rip',
  },
];

/**
 * Automatically scans a frontal portrait image to refine the exact UV coordinates
 * of the left and right pupils/irises so that the 3D eye fire aligns accurately.
 */
export function detectPortraitEyeUVs(
  img: HTMLImageElement
): { leftEye: [number, number]; rightEye: [number, number] } {
  const fallback = {
    leftEye: [0.395, 0.555] as [number, number],
    rightEye: [0.605, 0.555] as [number, number],
  };

  try {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;

    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const getLuma = (x: number, y: number) => {
      const idx = (y * size + x) * 4;
      return (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
    };

    // In a frontal portrait, eyes sit in canvas Y [0.34 .. 0.52] (which is UV Y [0.48 .. 0.66])
    // Eyes have strong horizontal edge gradients (dark iris/lash line next to sclera/skin)
    let bestRowY = Math.floor(size * 0.435);
    let maxRowScore = -1;

    const minY = Math.floor(size * 0.35);
    const maxY = Math.floor(size * 0.52);

    for (let y = minY; y <= maxY; y++) {
      let rowScore = 0;
      for (let x = Math.floor(size * 0.32); x <= Math.floor(size * 0.68); x++) {
        // Ignore the exact nose centerline [0.47 .. 0.53]
        const normX = x / size;
        if (normX > 0.46 && normX < 0.54) continue;

        const c = getLuma(x, y);
        const up = getLuma(x, Math.max(0, y - 2));
        const down = getLuma(x, Math.min(size - 1, y + 2));
        const left = getLuma(Math.max(0, x - 2), y);
        const right = getLuma(Math.min(size - 1, x + 2), y);

        const localContrast = Math.abs(c - up) + Math.abs(c - down) + Math.abs(c - left) + Math.abs(c - right);
        // Dark pupil/iris preference weighted with high local contrast
        const darkness = 1.0 - c;
        rowScore += localContrast * (0.6 + darkness * 0.9);
      }

      if (rowScore > maxRowScore) {
        maxRowScore = rowScore;
        bestRowY = y;
      }
    }

    // Now find the left eye center X in [0.33 .. 0.45] around bestRowY
    let bestLeftX = Math.floor(size * 0.395);
    let maxLeftScore = -1;
    for (let x = Math.floor(size * 0.34); x <= Math.floor(size * 0.45); x++) {
      let score = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const y = Math.min(size - 1, Math.max(0, bestRowY + dy));
        const c = getLuma(x, y);
        const gx = Math.abs(getLuma(x + 2, y) - getLuma(x - 2, y));
        const gy = Math.abs(getLuma(x, y + 2) - getLuma(x, y - 2));
        score += (1.0 - c) * 1.2 + (gx + gy) * 1.5;
      }
      if (score > maxLeftScore) {
        maxLeftScore = score;
        bestLeftX = x;
      }
    }

    // Mirror-guided search for right eye X in [0.55 .. 0.66]
    const mirroredRightX = size - bestLeftX;
    let bestRightX = mirroredRightX;
    let maxRightScore = -1;
    for (let x = Math.floor(size * 0.55); x <= Math.floor(size * 0.66); x++) {
      let score = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const y = Math.min(size - 1, Math.max(0, bestRowY + dy));
        const c = getLuma(x, y);
        const gx = Math.abs(getLuma(x + 2, y) - getLuma(x - 2, y));
        const gy = Math.abs(getLuma(x, y + 2) - getLuma(x, y - 2));
        const symmetryBonus = Math.exp(-Math.pow((x - mirroredRightX) / 4.0, 2.0)) * 0.6;
        score += (1.0 - c) * 1.2 + (gx + gy) * 1.5 + symmetryBonus;
      }
      if (score > maxRightScore) {
        maxRightScore = score;
        bestRightX = x;
      }
    }

    // Convert canvas (x, y) to Three.js UV where v = 1.0 - (y / size)
    const uvY = 1.0 - bestRowY / size;
    const leftUvX = bestLeftX / size;
    const rightUvX = bestRightX / size;

    return {
      leftEye: [
        Math.max(0.33, Math.min(0.46, leftUvX)),
        Math.max(0.48, Math.min(0.64, uvY)),
      ],
      rightEye: [
        Math.max(0.54, Math.min(0.67, rightUvX)),
        Math.max(0.48, Math.min(0.64, uvY)),
      ],
    };
  } catch {
    return fallback;
  }
}
