import { useState } from 'react'

export function usePagination(defaultPageSize = 20) {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(defaultPageSize)

  const reset = () => setPage(1)

  return { page, pageSize, setPage, reset, skip: (page - 1) * pageSize }
}
