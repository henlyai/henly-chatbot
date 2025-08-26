import { useEffect, useRef } from 'react';

interface DebugLifecycleOptions {
  componentName: string;
  trackDeps?: any[];
  trackProps?: Record<string, any>;
  trackState?: Record<string, any>;
}

export function useDebugReactLifecycle({
  componentName,
  trackDeps = [],
  trackProps = {},
  trackState = {}
}: DebugLifecycleOptions) {
  const mountTimeRef = useRef(Date.now());
  const renderCountRef = useRef(0);
  const previousDepsRef = useRef<any[]>([]);
  const previousPropsRef = useRef<Record<string, any>>({});
  const previousStateRef = useRef<Record<string, any>>({});

  // Track renders
  renderCountRef.current += 1;
  
  useEffect(() => {
    const mountTime = new Date().toISOString();
    console.log(`🔄 [${componentName}] MOUNTED at ${mountTime}`, {
      renderCount: renderCountRef.current,
      initialProps: trackProps,
      initialState: trackState,
      initialDeps: trackDeps
    });

    return () => {
      const unmountTime = new Date().toISOString();
      const duration = Date.now() - mountTimeRef.current;
      console.log(`💀 [${componentName}] UNMOUNTED at ${unmountTime}`, {
        totalRenders: renderCountRef.current,
        duration: `${duration}ms`
      });
    };
  }, [componentName]);

  // Track dependency changes
  useEffect(() => {
    const currentDeps = trackDeps;
    const previousDeps = previousDepsRef.current;
    
    if (previousDeps.length > 0) {
      const changes = currentDeps.map((dep, index) => ({
        index,
        previous: previousDeps[index],
        current: dep,
        changed: previousDeps[index] !== dep
      })).filter(change => change.changed);

      if (changes.length > 0) {
        console.log(`📊 [${componentName}] DEPENDENCY CHANGES (Render #${renderCountRef.current}):`, changes);
      }
    }
    
    previousDepsRef.current = [...currentDeps];
  }, trackDeps);

  // Track prop changes
  useEffect(() => {
    const currentProps = trackProps;
    const previousProps = previousPropsRef.current;
    
    const propChanges = Object.keys(currentProps).filter(
      key => previousProps[key] !== currentProps[key]
    ).map(key => ({
      prop: key,
      previous: previousProps[key],
      current: currentProps[key]
    }));

    if (propChanges.length > 0 && Object.keys(previousProps).length > 0) {
      console.log(`🎯 [${componentName}] PROP CHANGES (Render #${renderCountRef.current}):`, propChanges);
    }
    
    previousPropsRef.current = { ...currentProps };
  }, Object.values(trackProps));

  // Track state changes
  useEffect(() => {
    const currentState = trackState;
    const previousState = previousStateRef.current;
    
    const stateChanges = Object.keys(currentState).filter(
      key => previousState[key] !== currentState[key]
    ).map(key => ({
      state: key,
      previous: previousState[key],
      current: currentState[key]
    }));

    if (stateChanges.length > 0 && Object.keys(previousState).length > 0) {
      console.log(`🏠 [${componentName}] STATE CHANGES (Render #${renderCountRef.current}):`, stateChanges);
    }
    
    previousStateRef.current = { ...currentState };
  }, Object.values(trackState));

  // Log every render
  console.log(`🔄 [${componentName}] RENDER #${renderCountRef.current}`);
} 