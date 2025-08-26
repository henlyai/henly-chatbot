import { useEffect, useState } from 'react';

interface IframeDetectionResult {
  isInIframe: boolean;
  parentOrigin: string | null;
}

export function useIframeDetection(): IframeDetectionResult {
  const [detection, setDetection] = useState<IframeDetectionResult>({
    isInIframe: false,
    parentOrigin: null,
  });

  useEffect(() => {
    const detectIframe = () => {
      try {
        // Primary iframe detection
        const isInIframe = window.self !== window.top;
        
        let parentOrigin: string | null = null;

        if (isInIframe) {
          try {
            // Try to access parent origin
            parentOrigin = window.parent.location.origin;
          } catch (error) {
            // Cross-origin restrictions - try referrer as fallback
            if (document.referrer) {
              try {
                parentOrigin = new URL(document.referrer).origin;
              } catch (e) {
                parentOrigin = null;
              }
            }
          }
        }

        setDetection({
          isInIframe,
          parentOrigin,
        });

        // Log detection for debugging
        console.log('🖼️ Iframe Detection (Step 1):', {
          isInIframe,
          parentOrigin,
          referrer: document.referrer,
          location: window.location.href,
        });
      } catch (error) {
        console.error('Error detecting iframe context:', error);
      }
    };

    detectIframe();
  }, []);

  return detection;
}

export default useIframeDetection; 