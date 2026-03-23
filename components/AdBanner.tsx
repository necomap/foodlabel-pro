'use client';
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface AdBannerProps {
  slot: string;
  format?: 'auto' | 'rectangle' | 'horizontal';
  className?: string;
}

export default function AdBanner({ slot, format = 'auto', className = '' }: AdBannerProps) {
  const { data: session } = useSession();
  const adRef = useRef<HTMLModElement>(null);
  const initialized = useRef(false);

  // プレミアム・管理者は広告非表示
  const plan = (session?.user as any)?.plan;
  if (plan === 'premium' || plan === 'admin') return null;

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      const adsbygoogle = (window as any).adsbygoogle;
      if (adsbygoogle) {
        adsbygoogle.push({});
      }
    } catch (e) {
      console.error('AdSense error:', e);
    }
  }, []);

  return (
    <div className={`ad-banner ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-2277926623752174"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
