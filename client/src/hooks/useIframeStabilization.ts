import { useEffect, useRef, useState } from 'react';

interface IframeStabilizationOptions {
  src?: string;
  onLoad?: () => void;
  preventHistoryPollution?: boolean;
}

export function useIframeStabilization({
  src,
  onLoad,
  preventHistoryPollution = true
}: IframeStabilizationOptions) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const previousSrcRef = useRef<string | undefined>(undefined);

  // Force iframe remount when src changes to prevent history pollution
  useEffect(() => {
    if (src && src !== previousSrcRef.current && preventHistoryPollution) {
      console.log(`🔄 [IframeStabilization] Remounting iframe due to src change:`, {
        previous: previousSrcRef.current,
        current: src,
        newKey: iframeKey + 1
      });
      
      setIframeKey(prev => prev + 1);
      setIsLoading(true);
      previousSrcRef.current = src;
    }
  }, [src, preventHistoryPollution]);

  // Handle iframe load events
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      console.log(`✅ [IframeStabilization] Iframe loaded successfully:`, {
        src: iframe.src,
        key: iframeKey
      });
      setIsLoading(false);
      onLoad?.();
    };

    const handleError = (error: Event) => {
      console.error(`❌ [IframeStabilization] Iframe load error:`, {
        src: iframe.src,
        key: iframeKey,
        error
      });
      setIsLoading(false);
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [iframeKey, onLoad]);

  // Track visibility changes for debug purposes
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log(`👁️ [IframeStabilization] Visibility changed:`, {
        hidden: document.hidden,
        visibilityState: document.visibilityState,
        iframeSrc: iframeRef.current?.src
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Track focus events for debug purposes
  useEffect(() => {
    const handleFocus = () => {
      console.log(`🎯 [IframeStabilization] Window focus gained:`, {
        iframeSrc: iframeRef.current?.src,
        iframeKey
      });
    };

    const handleBlur = () => {
      console.log(`😴 [IframeStabilization] Window focus lost:`, {
        iframeSrc: iframeRef.current?.src,
        iframeKey
      });
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [iframeKey]);

  return {
    iframeRef,
    iframeKey,
    isLoading,
    // Return stable props for iframe
    iframeProps: {
      ref: iframeRef,
      key: iframeKey, // Forces remount when key changes
      src,
      onLoad: () => setIsLoading(false)
    }
  };
} 