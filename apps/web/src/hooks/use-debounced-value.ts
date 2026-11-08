import { useEffect, useState } from "react";

/**
 * The value, but only once it has stopped changing for `delay` ms. For text a person is typing, so
 * a request does not go out on every key.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debounced;
}
