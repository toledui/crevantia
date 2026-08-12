import Image from 'next/image';

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand-lockup${light ? ' brand-light' : ''}`} aria-label="Crevantia">
      <Image className="brand-image" src="/branding/logo-crevantia.png" alt="Crevantia" width={1600} height={416} priority />
    </div>
  );
}
