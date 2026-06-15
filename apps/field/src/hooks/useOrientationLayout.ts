import { useEffect, useState } from 'react';

export type OrientationLayout = 'portrait' | 'landscape';

const PORTRAIT_QUERY = '(orientation: portrait)';

export function useOrientationLayout(): OrientationLayout {
  const [layout, setLayout] = useState<OrientationLayout>(() =>
    typeof window !== 'undefined' && window.matchMedia(PORTRAIT_QUERY).matches
      ? 'portrait'
      : 'landscape',
  );

  useEffect(() => {
    const media = window.matchMedia(PORTRAIT_QUERY);

    const update = () => {
      setLayout(media.matches ? 'portrait' : 'landscape');
    };

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return layout;
}
