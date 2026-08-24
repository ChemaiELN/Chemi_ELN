import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { authenticate } from '../../middleware/auth.middleware'
import { NotFoundError } from '../../utils/errors'
import { sequelize } from '../../database/connection'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination, parseSort } from '../../utils/response'
import { InvStorageLocation, InvStorageLocationLab, InvBatch } from '../../models/index'
import { Lab } from '../../models/Lab.model'

const storageLocationsRouter = Router()

// GET /storage-locations — list all with lab associations
storageLocationsRouter.get('/storage-locations', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, active_only } = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (active_only === 'true') where.isActive = true
    // Search runs in SQL (it used to filter the already-fetched array, which
    // cannot work once the query is paged). Lab names live on a join table, so
    // they are matched separately: find labs whose name matches, then the
    // storage-location ids mapped to those labs, and OR that id list in
    // alongside the plain name/description match.
    if (search) {
      const matchingLabs = await Lab.findAll({ where: { name: { [Op.iLike]: `%${search}%` } }, attributes: ['id'] })
      const matchingLabIds = matchingLabs.map((l) => l.id)
      const matchingLocationIds = matchingLabIds.length
        ? [...new Set((await InvStorageLocationLab.findAll({ where: { labId: matchingLabIds } })).map((m) => m.storageLocationId))]
        : []

      ;(where as any)[Op.or as any] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        ...(matchingLocationIds.length ? [{ id: { [Op.in]: matchingLocationIds } }] : []),
      ]
    }

    const paged = wantsPagination(req.query)
    const { page, limit, offset } = parsePagination(req.query, 10)
    const { rows, count } = await InvStorageLocation.findAndCountAll({
      where,
      order: parseSort(req.query as Record<string, unknown>, InvStorageLocation, [['createdAt', 'DESC']]) as any,
      ...(paged ? { limit, offset } : {}),
    })

    // Attach full lab details (id/code/name) for each location — the frontend
    // table renders lab tags by name, not just the raw join-table IDs.
    const ids = rows.map((r) => r.id)
    const labMappings = ids.length
      ? await InvStorageLocationLab.findAll({ where: { storageLocationId: ids } })
      : []
    const labIds = [...new Set(labMappings.map((m) => m.labId))]
    const labRecords = labIds.length ? await Lab.findAll({ where: { id: labIds } }) : []
    const labById: Record<string, { id: string; code: string; name: string }> = {}
    for (const l of labRecords) labById[l.id] = { id: l.id, code: l.code, name: l.name }
    const labsByLocation: Record<number, { id: string; code: string; name: string }[]> = {}
    for (const m of labMappings) {
      if (!labsByLocation[m.storageLocationId]) labsByLocation[m.storageLocationId] = []
      const lab = labById[m.labId]
      if (lab) labsByLocation[m.storageLocationId].push(lab)
    }

    // Batches don't carry a storage-location FK — `location` is a free-text
    // field on inv_batches that's expected to match a location's name.
    const names = rows.map((r) => r.name)
    const batchCounts = names.length
      ? await InvBatch.findAll({
        where: { location: { [Op.in]: names } },
        attributes: ['location', [InvBatch.sequelize!.fn('COUNT', InvBatch.sequelize!.col('id')), 'count']],
        group: ['location'],
        raw: true,
      }) as unknown as { location: string; count: string }[]
      : []
    const batchCountByName: Record<string, number> = {}
    for (const b of batchCounts) batchCountByName[b.location] = Number(b.count)

    const data = rows.map((r) => ({
      ...r.toJSON(),
      labs: labsByLocation[r.id] ?? [],
      labIds: (labsByLocation[r.id] ?? []).map((l) => l.id),
      batchCount: batchCountByName[r.name] ?? 0,
    }))

    if (!paged) {
      res.json(successResponse('Storage locations retrieved successfully.', data))
      return
    }
    res.json(listResponse('Storage locations retrieved successfully.', data, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// POST /storage-locations — create with optional labIds
storageLocationsRouter.post('/storage-locations', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, isActive, labIds } = req.body
    const row = await InvStorageLocation.create({
      name,
      description: description ?? null,
      isActive: isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    if (Array.isArray(labIds) && labIds.length > 0) {
      await InvStorageLocationLab.bulkCreate(
        labIds.map((labId: string) => ({ storageLocationId: row.id, labId })),
      )
    }

    const result = { ...row.toJSON(), labIds: labIds ?? [] }
    res.status(201).json(successResponse('Storage location created successfully.', result))
  } catch (err) {
    next(err)
  }
})

// GET /storage-locations/:id — get one with lab associations
storageLocationsRouter.get('/storage-locations/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvStorageLocation.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Storage location')
    const mappings = await InvStorageLocationLab.findAll({ where: { storageLocationId: row.id } })
    const labs = mappings.length ? await Lab.findAll({ where: { id: mappings.map((m) => m.labId) } }) : []
    const result = {
      ...row.toJSON(),
      labs: labs.map((l) => ({ id: l.id, code: l.code, name: l.name })),
      labIds: labs.map((l) => l.id),
    }
    res.json(successResponse('Storage location retrieved successfully.', result))
  } catch (err) {
    next(err)
  }
})

// PATCH /storage-locations/:id — update, sync labIds if provided
storageLocationsRouter.patch('/storage-locations/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvStorageLocation.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Storage location')
    const { name, description, isActive, labIds } = req.body
    await row.update({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    })

    if (Array.isArray(labIds)) {
      await InvStorageLocationLab.destroy({ where: { storageLocationId: row.id } })
      if (labIds.length > 0) {
        await InvStorageLocationLab.bulkCreate(
          labIds.map((labId: string) => ({ storageLocationId: row.id, labId })),
        )
      }
    }

    const mappings = await InvStorageLocationLab.findAll({ where: { storageLocationId: row.id } })
    const labs = mappings.length ? await Lab.findAll({ where: { id: mappings.map((m) => m.labId) } }) : []
    const result = {
      ...row.toJSON(),
      labs: labs.map((l) => ({ id: l.id, code: l.code, name: l.name })),
      labIds: labs.map((l) => l.id),
    }
    res.json(successResponse('Storage location updated successfully.', result))
  } catch (err) {
    next(err)
  }
})

// PATCH /storage-locations/:id/toggle — toggle isActive
storageLocationsRouter.patch('/storage-locations/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvStorageLocation.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Storage location')
    await row.update({ isActive: !row.isActive })
    res.json(successResponse('Storage location toggled successfully.', row))
  } catch (err) {
    next(err)
  }
})

// DELETE /storage-locations/:id — destroy
storageLocationsRouter.delete('/storage-locations/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvStorageLocation.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Storage location')
    await InvStorageLocationLab.destroy({ where: { storageLocationId: row.id } })
    await row.destroy()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default storageLocationsRouter
