import { rateLimit } from '~/utils/ratelimit'
import { SuccessObject } from '~/utils/utils'
import { isEncryptedTotp, isPlainObject, isValidTimestamp, isValidUUID } from '~/utils/validation'
import { AppError, areEncryptedTotpsEqual, TotpBucket, type UserEvent, type UUID } from '~/app'
import { defineHandler, type H3Event, readValidatedBody } from 'nitro/h3'

const validateBody = (body: unknown) => Array.isArray(body) && body.every(operation =>
  isPlainObject(operation)
  && typeof operation.uuid === 'string'
  && isValidUUID(operation.uuid)
  && (operation.kind === 'set' || operation.kind === 'delete')
  && isPlainObject(operation.payload))

const maxCount = 100

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    const userEvent = event as UserEvent
    const bucket = TotpBucket.of(userEvent.context.user)
    const operations = await readValidatedBody<H3Event, PushOperation[]>(event, validateBody)
    const compacted = compactOperations(operations)
    const results = await bucket.edit((vault) => {
      const results: PushOperationResult[] = []
      const { active, deleted: tombstones } = vault.data
      let count = 0

      const applySet = (totpUuid: UUID, totp: unknown): OperationError | null => {
        if (!isEncryptedTotp(totp)) {
          return ['invalidTotp', 'Invalid encrypted TOTP.']
        }
        const existing = active[totpUuid]
        if (existing && existing.updatedAt > totp.updatedAt) {
          return ['invalidUpdateTimestamp', 'Encrypted TOTP is older than the currently stored one.']
        }
        const tombstone = tombstones[totpUuid]
        if (tombstone && tombstone.deletedAt >= totp.updatedAt) {
          return ['deletedTotp', 'A TOTP with the same UUID has been deleted more recently.']
        }
        if (existing && areEncryptedTotpsEqual(existing, totp)) {
          return null
        }
        vault.set(totpUuid, totp)
        return null
      }

      const applyDelete = (totpUuid: UUID, deletedAt: unknown): OperationError | null => {
        if (!isValidTimestamp(deletedAt)) {
          return ['invalidDeleteTimestamp', 'Invalid delete timestamp : must be a number.']
        }
        const existing = active[totpUuid]
        if (existing && existing.updatedAt > deletedAt) {
          return ['invalidDeleteTimestamp', 'Currently stored TOTP is newer than the one you are trying to delete.']
        }
        const tombstone = tombstones[totpUuid]
        if (!tombstone || tombstone.deletedAt < deletedAt) {
          vault.delete(totpUuid, deletedAt)
        }
        return null
      }

      for (const operation of compacted) {
        const apply = operation.kind === 'set' ? applySet : applyDelete
        for (const [totpUuid, value] of Object.entries(operation.payload)) {
          const pushResult = (errorCode: string | null = null, errorDetails: string | null = null) => results.push({
            operationUuid: operation.uuid,
            totpUuid,
            errorCode,
            errorDetails,
          })
          if (!isValidUUID(totpUuid)) {
            pushResult('invalidUuid', 'Invalid UUID.')
            continue
          }
          if (++count > maxCount) {
            pushResult('maxOperationsCountExceeded', 'Maximum number of operations exceeded.')
            continue
          }
          try {
            const error = apply(totpUuid as UUID, value)
            pushResult(...(error ?? []))
          }
          catch (error) {
            pushResult(
              error instanceof AppError ? error.errorCode : 'genericError',
              error instanceof Error ? error.message : `${error}`,
            )
          }
        }
      }
      return results
    })
    return SuccessObject.fromData(results).toResponse(event)
  },
})

interface PushOperation {
  uuid: string
  kind: 'set' | 'delete'
  payload: Record<string, unknown>
}

/**
 * Only keeps the latest operation for each TOTP UUID.
 */
function compactOperations(operations: PushOperation[]): PushOperation[] {
  const processed = new Set<string>()
  const outReversed: PushOperation[] = []
  for (let i = operations.length - 1; i >= 0; i--) {
    const operation = operations[i]!
    const payload: Record<string, unknown> = {}
    for (const [uuid, value] of Object.entries(operation.payload)) {
      if (!processed.has(uuid)) {
        processed.add(uuid)
        payload[uuid] = value
      }
    }
    if (Object.keys(payload).length > 0) {
      outReversed.push({ ...operation, payload })
    }
  }
  return outReversed.reverse()
}

type OperationError = [PushOperationResultError, string]

interface PushOperationResult {
  operationUuid: string
  totpUuid: string
  errorCode: PushOperationResultError | string | null
  errorDetails: string | null
}

type PushOperationResultError = 'invalidUuid' | 'invalidTotp' | 'invalidUpdateTimestamp' | 'maxOperationsCountExceeded' | 'deletedTotp' | 'invalidDeleteTimestamp' | 'genericError'
