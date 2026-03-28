/**
 * Image component that prefers WebP source when available,
 * falling back to the original JPEG/PNG URL.
 */
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
        <img src={src} alt={alt} className={className} loading={loading} />
      </picture>
    );
  }
  return <img src={src} alt={alt} className={className} loading={loading} />;
}
