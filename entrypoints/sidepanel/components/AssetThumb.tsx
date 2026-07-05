/**
 * Small inline thumbnail for a screenshot or annotation timeline row.
 *
 * Loads the asset blob from IndexedDB by id, turns it into an object URL, and
 * revokes it on unmount. Renders nothing until the blob resolves, so the row
 * stays clean if the asset is missing.
 */
import React, { useEffect, useState } from 'react';
import { getAsset } from '@/lib/storage';

export function AssetThumb({
  assetId,
  alt,
}: {
  assetId: string | undefined;
  alt: string;
}): React.JSX.Element | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void getAsset(assetId).then((asset) => {
      if (cancelled || !asset) return;
      objectUrl = URL.createObjectURL(asset.blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  if (!assetId || !url) return null;
  return <img className="tl-thumb" src={url} alt={alt} loading="lazy" />;
}
