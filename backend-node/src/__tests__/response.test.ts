/**
 * Unit tests for response helpers and error classes.
 */
import { successResponse, listResponse, parsePagination, buildPagination } from '../utils/response'
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors'

// The frontend client returns res.json() with no envelope unwrapping, matching the
// original FastAPI backend's bare payloads — see frontend/src/api/client.ts.
describe('successResponse', () => {
  it('returns the payload bare, with no envelope', () => {
    const r = successResponse('OK', { id: 1 })
    expect(r).toEqual({ id: 1 })
  })

  it('passes arrays through unchanged', () => {
    const r = successResponse('OK', [1, 2])
    expect(r).toEqual([1, 2])
  })

  it('merges extra keys into an object payload', () => {
    const r = successResponse('OK', { id: 1 }, { total: 5 })
    expect(r).toEqual({ id: 1, total: 5 })
  })

  it('works with null data', () => {
    const r = successResponse('Done', null)
    expect(r).toBeNull()
  })
})

describe('listResponse', () => {
  it('returns the FastAPI {items, total} shape', () => {
    const r = listResponse('Things', [1, 2], { page: 1, limit: 10, total: 2, totalPages: 1 })
    expect(r.items).toEqual([1, 2])
    expect(r.total).toBe(2)
  })

  it('emits both pageSize and page_size for frontend casing differences', () => {
    const r = listResponse('Things', [1], { page: 2, limit: 10, total: 1, totalPages: 1 })
    expect(r.pageSize).toBe(10)
    expect(r.page_size).toBe(10)
  })
})

describe('parsePagination', () => {
  it('defaults to page=1 limit=20', () => {
    const p = parsePagination({})
    expect(p.page).toBe(1)
    expect(p.limit).toBe(20)
    expect(p.offset).toBe(0)
  })

  it('parses page and limit from query', () => {
    const p = parsePagination({ page: '3', limit: '5' })
    expect(p.page).toBe(3)
    expect(p.limit).toBe(5)
    expect(p.offset).toBe(10)
  })

  // The frontend sends FastAPI-style `skip` rather than `page`.
  it('honours skip as an absolute offset and derives page from it', () => {
    const p = parsePagination({ skip: '20', limit: '10' })
    expect(p.offset).toBe(20)
    expect(p.limit).toBe(10)
    expect(p.page).toBe(3)
  })

  it('treats skip=0 as the first page', () => {
    const p = parsePagination({ skip: '0', limit: '10' })
    expect(p.offset).toBe(0)
    expect(p.page).toBe(1)
  })

  it('prefers skip over page when both are present', () => {
    const p = parsePagination({ skip: '30', page: '9', limit: '10' })
    expect(p.offset).toBe(30)
  })

  it('clamps limit to 1000', () => {
    const p = parsePagination({ limit: '9999' })
    expect(p.limit).toBeLessThanOrEqual(1000)
  })
})

describe('buildPagination', () => {
  it('calculates pages correctly', () => {
    const p = buildPagination(2, 10, 25)
    expect(p.totalPages).toBe(3)
    expect(p.page).toBe(2)
    expect(p.total).toBe(25)
  })
})

describe('Error classes', () => {
  it('NotFoundError has status 404', () => {
    const e = new NotFoundError('Widget')
    expect(e.statusCode).toBe(404)
    expect(e.message).toBe('Widget not found.')
  })

  it('NotFoundError does not double-append "not found"', () => {
    expect(new NotFoundError('Material not found').message).toBe('Material not found.')
    expect(new NotFoundError('Material not found.').message).toBe('Material not found.')
  })

  it('BadRequestError has status 400', () => {
    const e = new BadRequestError('Bad input')
    expect(e.statusCode).toBe(400)
  })

  it('ForbiddenError has status 403', () => {
    const e = new ForbiddenError()
    expect(e.statusCode).toBe(403)
  })

  it('ConflictError has status 409', () => {
    const e = new ConflictError('Already exists')
    expect(e.statusCode).toBe(409)
  })
})
