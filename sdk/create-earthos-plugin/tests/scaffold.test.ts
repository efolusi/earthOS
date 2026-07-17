import { describe, expect, it } from 'vitest';
import { templates } from '../templates.mjs';

describe('create-earthos-plugin templates', () => {
  it('substitutes names and produces the mandated file shape', () => {
    const files = templates('aurora-oval', 'AuroraOval');
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        'package.json',
        'src/plugin.ts',
        'src/provider.ts',
        'src/renderer.tsx',
        'src/settings.ts',
        'src/types.ts',
        'src/index.ts',
        'tests/contract.test.ts',
        'README.md',
      ]),
    );
    expect(files['package.json']).toContain('earthos-plugin-aurora-oval');
    expect(files['src/plugin.ts']).toContain("id: 'aurora-oval'");
    expect(files['src/provider.ts']).toContain('class AuroraOvalProvider');
    expect(files['src/renderer.tsx']).not.toContain('__NAME__');
    const pkg = JSON.parse(files['package.json']!);
    expect(pkg.keywords).toContain('earthos-plugin');
    expect(pkg.dependencies).not.toHaveProperty('three');
    expect(pkg.peerDependencies).toHaveProperty('three');
  });
});
