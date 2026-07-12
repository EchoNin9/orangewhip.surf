/**
 * Image component that prefers WebP source when available,
 * falling back to the original JPEG/PNG URL.
 */

// A missing file (e.g. store hero shots not uploaded yet) degrades to the
// container's background instead of a broken-image icon.
function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.visibility = "hidden";
}

export function OptimizedImg({
  webpSrc,
  src,
  alt = "",
  className,
  loading,
}: {
  webpSrc?: string;
  src: string;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  if (webpSrc) {
    return (
      <picture>
        <source srcSet={webpSrc} type="image/webp" />
        <img src={src} alt={alt} className={className} loading={loading} onError={hideOnError} />
      </picture>
    );
  }
  return <img src={src} alt={alt} className={className} loading={loading} onError={hideOnError} />;
}
