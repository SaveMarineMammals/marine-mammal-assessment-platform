import { useEffect, useState } from 'react';

/** Shell layout: portrait uses top + bottom nav; landscape uses header tabs. */
export type ViewportShell = 'portrait' | 'landscape';

/** Compact utilities hide labels and use a two-row top bar on narrow portrait shells. */
export type ViewportLayout = {
  shell: ViewportShell;
  compact: boolean;
};

export const PORTRAIT_SHELL_QUERY = '(orientation: portrait), (max-width: 767px)';
export const COMPACT_TOP_BAR_QUERY = '(max-width: 639px)';

export function resolveViewportLayout(
  portraitShell: boolean,
  compactWidth: boolean,
): ViewportLayout {
  const compact = portraitShell && compactWidth;
  return {
    shell: portraitShell ? 'portrait' : 'landscape',
    compact,
  };
}

function readLayout(): ViewportLayout {
  if (typeof window === 'undefined') {
    return { shell: 'portrait', compact: true };
  }

  return resolveViewportLayout(
    window.matchMedia(PORTRAIT_SHELL_QUERY).matches,
    window.matchMedia(COMPACT_TOP_BAR_QUERY).matches,
  );
}

export function useViewportLayout(): ViewportLayout {
  const [layout, setLayout] = useState<ViewportLayout>(() => readLayout());

  useEffect(() => {
    const portraitMedia = window.matchMedia(PORTRAIT_SHELL_QUERY);
    const compactMedia = window.matchMedia(COMPACT_TOP_BAR_QUERY);

    const update = () => setLayout(readLayout());

    update();
    portraitMedia.addEventListener('change', update);
    compactMedia.addEventListener('change', update);
    return () => {
      portraitMedia.removeEventListener('change', update);
      compactMedia.removeEventListener('change', update);
    };
  }, []);

  return layout;
}

/** @deprecated Use useViewportLayout().shell */
export type OrientationLayout = ViewportShell;

/** @deprecated Use useViewportLayout */
export function useOrientationLayout(): ViewportShell {
  return useViewportLayout().shell;
}
