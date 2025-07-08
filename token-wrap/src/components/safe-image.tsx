import Image from 'next/image';

interface SafeImageProps {
  src?: string;
  alt?: string;
  width: number;
  height: number;
  className?: string;
}

export function SafeImage({ src, alt = '', width, height, className = '' }: SafeImageProps) {
  if (!src) {
    return (
      <div
        className={`bg-muted flex items-center justify-center rounded-full ${className}`}
        style={{ width, height }}
      >
        <span className="text-muted-foreground text-xs">
          {alt ? alt.charAt(0).toUpperCase() : '?'}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={(e) => {
        // Hide the image on error, fallback will be shown
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';

        // Create fallback element
        const fallback = document.createElement('div');
        fallback.className = `bg-muted flex items-center justify-center rounded-full ${className}`;
        fallback.style.width = `${width}px`;
        fallback.style.height = `${height}px`;
        fallback.innerHTML = `<span class="text-muted-foreground text-xs">${alt ? alt.charAt(0).toUpperCase() : '?'}</span>`;

        // Replace the image with fallback
        target.parentNode?.replaceChild(fallback, target);
      }}
    />
  );
}
