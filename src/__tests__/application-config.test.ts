import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import applicationConfig from 'src/application-config';

describe('application manifest', () => {
  it('is valid', () => {
    expect(applicationConfig.errors).toEqual([]);
    expect(applicationConfig.success).toBe(true);
  });

  // The build does not check local asset paths, so a missing file would reach the marketplace listing.
  it('references only asset files that exist', () => {
    const { logo, galleryImages = [] } = applicationConfig.config;
    const assetPaths = [logo, ...galleryImages];

    expect(assetPaths.length).toBeGreaterThan(0);
    expect(assetPaths.filter((assetPath) => !existsSync(join(process.cwd(), String(assetPath))))).toEqual([]);
  });
});
