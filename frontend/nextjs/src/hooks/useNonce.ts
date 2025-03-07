'use client';

import { useState, useEffect } from 'react';

export function useNonce(): string {
  const [nonce, setNonce] = useState<string>('');

  useEffect(() => {
    // Get the nonce from the response headers
    const nonce = document.head.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') || '';
    setNonce(nonce);
  }, []);

  return nonce;
}
