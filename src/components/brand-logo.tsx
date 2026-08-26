import Image from "next/image";

export function BrandLogo({ className, priority = false }: { className: string; priority?: boolean }) {
  return <span className={className} aria-hidden="true">
    <Image className="brand-logo-image" src="/brand-logo.png" alt="" width={96} height={96} sizes="48px" priority={priority} suppressHydrationWarning />
  </span>;
}
