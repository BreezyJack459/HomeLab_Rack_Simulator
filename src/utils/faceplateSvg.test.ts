import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deviceCatalog } from '../data/deviceCatalog';
import type { DeviceTemplate } from '../types/rack';
import {
  getFaceplateArtifact,
  getFaceplateSvg,
  getFaceplateTexture,
  getHitRegions,
  loadHandTracedSvg,
  parseHitRegionsFromSvg,
  SVG_CACHE,
  TEXTURE_CACHE,
} from './faceplateSvg';

beforeEach(() => {
  SVG_CACHE.clear();
  TEXTURE_CACHE.clear();
});

function makeTemplate(partial: Partial<DeviceTemplate> = {}): DeviceTemplate {
  return {
    id: 'tpl-test',
    category: 'server',
    name: 'Test Server',
    defaultU: 1,
    depthMm: 400,
    widthType: '19in',
    weightKg: 5,
    powerW: 100,
    heatLevel: 2,
    ports: {},
    color: '#334155',
    description: 'A test device template',
    ...partial,
  } as DeviceTemplate;
}

describe('getFaceplateArtifact', () => {
  it('returns an image artifact for a PNG faceplate path', () => {
    const template = makeTemplate({
      faceplate: { front: '/faceplates/device-front.png' },
    });
    const artifact = getFaceplateArtifact(template, 'front');
    expect(artifact.kind).toBe('image');
    if (artifact.kind === 'image') {
      expect(artifact.path).toBe('/faceplates/device-front.png');
    }
  });

  it('returns an image artifact for a JPEG faceplate path', () => {
    const template = makeTemplate({
      faceplate: { rear: '/faceplates/device-rear.jpg' },
    });
    const artifact = getFaceplateArtifact(template, 'rear');
    expect(artifact.kind).toBe('image');
    if (artifact.kind === 'image') {
      expect(artifact.path).toBe('/faceplates/device-rear.jpg');
    }
  });

  it('returns an SVG artifact for a procedural faceplate', () => {
    const template = makeTemplate({
      category: 'switch',
      ports: { ethernet: 8 },
    });
    const artifact = getFaceplateArtifact(template, 'front');
    expect(artifact.kind).toBe('svg');
    if (artifact.kind === 'svg') {
      expect(artifact.svg).toContain('<svg');
      expect(artifact.svg).toContain('</svg>');
    }
  });

  it('returns an SVG artifact for a hand-traced SVG path', () => {
    const template = makeTemplate({
      faceplate: { front: '/src/assets/faceplates/mikrotik-crs305.front.svg' },
    });
    const artifact = getFaceplateArtifact(template, 'front');
    expect(artifact.kind).toBe('svg');
    if (artifact.kind === 'svg') {
      expect(artifact.svg).toContain('<svg');
      expect(artifact.svg).toContain('MikroTik CRS305');
    }
  });
});

describe('catalog faceplate references', () => {
  for (const template of deviceCatalog) {
    if (!template.faceplate) continue;
    for (const face of ['front', 'rear'] as const) {
      const path = template.faceplate[face];
      if (!path) continue;

      const lower = path.toLowerCase();
      const isRaster =
        lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
      const isSvg = lower.endsWith('.svg');

      it(`${template.id} ${face} faceplate resolves (${path})`, () => {
        const artifact = getFaceplateArtifact(template, face);
        expect(artifact).toBeDefined();
        if (isRaster) {
          expect(artifact.kind).toBe('image');
        } else if (isSvg) {
          expect(artifact.kind).toBe('svg');
          if (artifact.kind === 'svg') {
            expect(artifact.svg.startsWith('<svg')).toBe(true);
          }
        }
      });
    }
  }
});

describe('getFaceplateSvg', () => {
  it('returns a valid SVG string for a procedural device', () => {
    const template = makeTemplate({
      category: 'switch',
      ports: { ethernet: 8 },
    });
    const svg = getFaceplateSvg(template, 'front');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('ethernet');
  });

  it('falls back to a procedural SVG when the faceplate artifact is a raster image', () => {
    const template = makeTemplate({
      faceplate: { front: '/faceplates/device-front.png' },
    });
    const svg = getFaceplateSvg(template, 'front');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
  });
});

describe('getHitRegions', () => {
  it('returns one region per port slot for a switch', () => {
    const template = makeTemplate({
      category: 'switch',
      ports: { ethernet: 8 },
    });
    const regions = getHitRegions(template, 'front');
    expect(regions.length).toBe(8);
    expect(regions.every((r) => r.type === 'ethernet')).toBe(true);
    expect(regions[0].index).toBe(0);
    expect(regions[7].index).toBe(7);
  });

  it('returns mixed-type regions matching the port layout', () => {
    const template = makeTemplate({
      category: 'server',
      ports: { ethernet: 2, power: 2 },
    });
    const regions = getHitRegions(template, 'rear');
    expect(regions.length).toBe(4);
    expect(regions.filter((r) => r.type === 'ethernet').length).toBe(2);
    expect(regions.filter((r) => r.type === 'power').length).toBe(2);
  });

  it('returns empty hit regions for hand-traced SVG faceplates (deferred)', () => {
    const template = makeTemplate({
      faceplate: { front: '/src/assets/faceplates/mikrotik-crs305.front.svg' },
    });
    const regions = getHitRegions(template, 'front');
    expect(regions).toEqual([]);
  });

  it('labels regions with port type and 1-based index', () => {
    const template = makeTemplate({
      category: 'switch',
      ports: { ethernet: 2 },
    });
    const regions = getHitRegions(template, 'front');
    expect(regions[0].label).toBe('ethernet 1');
    expect(regions[1].label).toBe('ethernet 2');
  });
});

describe('loadHandTracedSvg', () => {
  it('returns the raw SVG content for a known hand-traced faceplate', () => {
    const svg = loadHandTracedSvg('/src/assets/faceplates/mikrotik-crs305.front.svg');
    expect(svg).toContain('<svg');
    expect(svg).toContain('MikroTik CRS305');
  });

  it('throws when the requested SVG is not vendored', () => {
    expect(() => loadHandTracedSvg('/src/assets/faceplates/missing.svg')).toThrow(
      'Faceplate SVG not found: /src/assets/faceplates/missing.svg'
    );
  });

  it.each([
    '/src/assets/faceplates/mikrotik-crs305.front.svg',
    '/src/assets/faceplates/apc-smt750rm1u.rear.svg',
    '/src/assets/faceplates/server-rear.svg',
  ])('resolves the vendored SVG %s', (path) => {
    const svg = loadHandTracedSvg(path);
    expect(svg.startsWith('<svg')).toBe(true);
  });
});

describe('parseHitRegionsFromSvg', () => {
  it('returns an empty array', () => {
    expect(parseHitRegionsFromSvg('<svg></svg>')).toEqual([]);
  });
});

describe('missing hand-traced SVG fallback', () => {
  it('falls back to a procedural SVG when the referenced SVG is not bundled', () => {
    const template = makeTemplate({
      category: 'switch',
      ports: { ethernet: 4 },
      faceplate: { front: '/src/assets/faceplates/not-bundled.svg' },
    });
    const artifact = getFaceplateArtifact(template, 'front');
    expect(artifact.kind).toBe('svg');
    if (artifact.kind === 'svg') {
      expect(artifact.svg.startsWith('<svg')).toBe(true);
    }
  });

  it('falls back to layout hit regions when the referenced SVG is not bundled', () => {
    const template = makeTemplate({
      category: 'switch',
      ports: { ethernet: 4 },
      faceplate: { front: '/src/assets/faceplates/not-bundled.svg' },
    });
    const regions = getHitRegions(template, 'front');
    expect(regions).toHaveLength(4);
    expect(regions.every((r) => r.type === 'ethernet')).toBe(true);
  });
});

describe('getFaceplateTexture', () => {
  const mockContext = {
    drawImage: vi.fn(),
  };

  let originalImage: typeof Image;

  beforeEach(() => {
    originalImage = globalThis.Image;
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this._src;
      }
    } as unknown as typeof Image;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockContext as unknown as CanvasRenderingContext2D
    );
  });

  afterEach(() => {
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
    mockContext.drawImage.mockClear();
  });

  it('returns a canvas and a ready promise', async () => {
    const template = makeTemplate({ category: 'switch', ports: { ethernet: 4 } });
    const texture = getFaceplateTexture(template, 'front');
    expect(texture.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(texture.ready).toBeInstanceOf(Promise);
    await expect(texture.ready).resolves.toBeUndefined();
  });

  it('rejects through the ready promise when the 2D context is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      null as unknown as CanvasRenderingContext2D
    );
    const template = makeTemplate({ category: 'switch', ports: { ethernet: 4 } });
    const texture = getFaceplateTexture(template, 'front');
    await expect(texture.ready).rejects.toThrow(/2D context/);
  });

  it('revokes the object URL after a successful SVG load', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    try {
      const template = makeTemplate({ category: 'switch', ports: { ethernet: 4 } });
      const texture = getFaceplateTexture(template, 'front');
      await texture.ready;
      expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });

  it('removes the canvas from cache and rejects when loading fails', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:bad-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    globalThis.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onerror?.());
      }
      get src() {
        return this._src;
      }
    } as unknown as typeof Image;

    try {
      const template = makeTemplate({ category: 'switch', ports: { ethernet: 4 } });
      const texture = getFaceplateTexture(template, 'front');
      await expect(texture.ready).rejects.toThrow(/Failed to load faceplate texture/);
      expect(TEXTURE_CACHE.get(`${template.id}:front:2`)).toBeUndefined();
      expect(revokeSpy).toHaveBeenCalledWith('blob:bad-url');
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });

  it('retries after a failed load instead of returning a cached failed canvas', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:retry-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    let attempt = 0;
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(value: string) {
        this._src = value;
        attempt++;
        queueMicrotask(() => (attempt === 1 ? this.onerror?.() : this.onload?.()));
      }
      get src() {
        return this._src;
      }
    } as unknown as typeof Image;

    try {
      const template = makeTemplate({ category: 'switch', ports: { ethernet: 4 } });
      const first = getFaceplateTexture(template, 'front');
      await expect(first.ready).rejects.toThrow(/Failed to load faceplate texture/);

      const second = getFaceplateTexture(template, 'front');
      await expect(second.ready).resolves.toBeUndefined();
      expect(second.canvas).not.toBe(first.canvas);
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });

  it('shares the same pending ready promise between concurrent callers and returns a drawn canvas', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:concurrent-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    try {
      const template = makeTemplate({ category: 'switch', ports: { ethernet: 4 } });

      const first = getFaceplateTexture(template, 'front');
      const second = getFaceplateTexture(template, 'front');

      expect(second.canvas).toBe(first.canvas);
      expect(second.ready).toBe(first.ready);

      await expect(first.ready).resolves.toBeUndefined();
      await expect(second.ready).resolves.toBeUndefined();

      expect(mockContext.drawImage).toHaveBeenCalledTimes(1);

      const third = getFaceplateTexture(template, 'front');
      expect(third.canvas).toBe(first.canvas);
      await expect(third.ready).resolves.toBeUndefined();
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });

  it('rejects all concurrent waiters when loading fails and allows a retry', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:concurrent-fail-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    let attempt = 0;
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(value: string) {
        this._src = value;
        attempt++;
        queueMicrotask(() => (attempt === 1 ? this.onerror?.() : this.onload?.()));
      }
      get src() {
        return this._src;
      }
    } as unknown as typeof Image;

    try {
      const template = makeTemplate({ category: 'switch', ports: { ethernet: 4 } });

      const first = getFaceplateTexture(template, 'front');
      const second = getFaceplateTexture(template, 'front');

      expect(second.canvas).toBe(first.canvas);
      expect(second.ready).toBe(first.ready);

      // second.ready is the same promise as first.ready; both waiters reject.
      const firstError = await first.ready.catch((err: unknown) => err);
      expect(firstError).toBeInstanceOf(Error);
      expect((firstError as Error).message).toMatch(/Failed to load faceplate texture/);
      const secondError = await second.ready.catch((err: unknown) => err);
      expect(secondError).toBe(firstError);

      expect(TEXTURE_CACHE.get(`${template.id}:front:2`)).toBeUndefined();

      const retry = getFaceplateTexture(template, 'front');
      await expect(retry.ready).resolves.toBeUndefined();
      expect(retry.canvas).not.toBe(first.canvas);
      expect(retry.ready).not.toBe(first.ready);
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });
});
