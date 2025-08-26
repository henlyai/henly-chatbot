import { useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys, Time, dataService } from 'librechat-data-provider';
import { logger } from '~/utils';

export const useHealthCheck = (isAuthenticated = false) => {
  const queryClient = useQueryClient();
  const isInitialized = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const focusHandlerRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    console.log(`🏥 [HealthCheck] useEffect triggered:`, {
      isAuthenticated,
      isInitialized: isInitialized.current,
      timestamp: new Date().toISOString()
    });

    // Only start health check if authenticated
    if (!isAuthenticated) {
      console.log(`🔒 [HealthCheck] Skipping - not authenticated`);
      return;
    }

    // Prevent multiple initializations
    if (isInitialized.current) {
      return;
    }
    isInitialized.current = true;

    // Use a longer delay to ensure all rendering is complete
    const initTimer = setTimeout(() => {
      const performHealthCheck = async () => {
        try {
          await queryClient.fetchQuery([QueryKeys.health], () => dataService.healthCheck(), {
            retry: false,
            cacheTime: Time.FIVE_MINUTES, // Cache for 5 minutes instead of immediate invalidation
            staleTime: Time.TWO_MINUTES,  // Consider fresh for 2 minutes
          });
        } catch (error) {
          console.error('Health check failed:', error);
        }
      };

      // Initial check
      performHealthCheck();

      // Set up interval for recurring checks
      intervalRef.current = setInterval(performHealthCheck, Time.TEN_MINUTES);

      // Detect if we're running in an iframe
      const isInIframe = window !== window.top;
      
      console.log(`🖼️ [HealthCheck] Step 2B: Iframe context detected:`, isInIframe);
      
      if (isInIframe) {
        // STEP 2B: Completely disable health check in iframe context to prevent refresh
        console.log(`📱 [HealthCheck] Disabling health check in iframe context to prevent refresh`);
        // Do nothing - no event listeners, no health checks
        return;
      } else {
        // Standard window focus behavior for non-iframe context
        const handleWindowFocus = async () => {
          const queryState = queryClient.getQueryState([QueryKeys.health]);

          // Don't run health check on focus if we have recent data
          if (queryState?.dataUpdatedAt) {
            const lastUpdated = new Date(queryState.dataUpdatedAt);
            const thirtyMinutesAgo = new Date(Date.now() - Time.THIRTY_MINUTES);

            // Only check if health data is older than 30 minutes
            if (lastUpdated >= thirtyMinutesAgo) {
              return;
            }
          }

          await performHealthCheck();
        };

        focusHandlerRef.current = handleWindowFocus;
        window.addEventListener('focus', handleWindowFocus);
      }
    }, 500);

    return () => {
      clearTimeout(initTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Remove event listener if it was added
      if (focusHandlerRef.current) {
        const isInIframe = window !== window.top;
        if (isInIframe) {
          document.removeEventListener('visibilitychange', focusHandlerRef.current);
        } else {
          window.removeEventListener('focus', focusHandlerRef.current);
        }
        focusHandlerRef.current = null;
      }
    };
  }, [isAuthenticated, queryClient]);
};

export const useInteractionHealthCheck = () => {
  const queryClient = useQueryClient();
  const lastInteractionTimeRef = useRef(Date.now());

  const checkHealthOnInteraction = useCallback(() => {
    const currentTime = Date.now();
    if (currentTime - lastInteractionTimeRef.current > Time.FIVE_MINUTES) {
      logger.log(
        'Checking health on interaction. Time elapsed:',
        currentTime - lastInteractionTimeRef.current,
      );
      queryClient.invalidateQueries([QueryKeys.health]);
      lastInteractionTimeRef.current = currentTime;
    }
  }, [queryClient]);

  return checkHealthOnInteraction;
};
