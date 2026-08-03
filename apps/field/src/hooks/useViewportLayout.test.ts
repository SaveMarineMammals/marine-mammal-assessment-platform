import { describe, expect, it } from 'vitest';
import { resolveViewportLayout } from './useViewportLayout.js';

describe('resolveViewportLayout', () => {
  it('uses portrait shell and compact top bar on narrow portrait phones', () => {
    expect(resolveViewportLayout(true, true)).toEqual({ shell: 'portrait', compact: true });
  });

  it('uses portrait shell without compact mode on wider portrait tablets', () => {
    expect(resolveViewportLayout(true, false)).toEqual({ shell: 'portrait', compact: false });
  });

  it('uses landscape shell on tablet landscape widths', () => {
    expect(resolveViewportLayout(false, false)).toEqual({ shell: 'landscape', compact: false });
  });

  it('does not use compact mode when landscape shell is active', () => {
    expect(resolveViewportLayout(false, true)).toEqual({ shell: 'landscape', compact: false });
  });
});
