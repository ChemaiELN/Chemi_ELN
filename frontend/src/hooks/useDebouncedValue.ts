import { useEffect, useState } from 'react'

/**
 * Debounce a value that drives a server request.
 *
 * The inventory list pages send their search box straight into the request
 * params, so an undebounced box fired one query per keystroke and the
 * responses could land out of order, leaving the table on the wrong result
 * set. Bind the input to the raw state and pass the debounced value to the
 * loader:
 *
 *   const [searchInput, setSearchInput] = useState('')
 *   const search = useDebouncedValue(searchInput, 300)
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
