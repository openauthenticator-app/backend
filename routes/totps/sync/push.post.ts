import { AppError, areEncryptedTotpsEqual, type EncryptedTotp, TotpBucket, type UserEvent, type UUID } from '~/app'
import { defineHandler, type H3Event, HTTPError, readValidatedBody } from 'nitro/h3'

const validateBody = (body: unknown) => {
  if (!Array.isArray(body)) {
    return false
  }
  for (const operation of body) {
    if (!operation || typeof operation !== 'object') {
      return false
    }
    if (!('uuid' in operation) || !isValidUUID(operation.uuid)) {
      return false
    }
    if (!('kind' in operation) || !['set', 'delete'].includes(operation.kind)) {
      return false
    }
    if (!('payload' in operation)) {
      return false
    }
  }
  return true
}

const maxCount = 100

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    const userEvent = event as UserEvent
    const bucket = TotpBucket.of(userEvent.context.user)
    const operations = await readValidatedBody<H3Event, PushOperation[]>(event, validateBody)
    const results: PushOperationResult[] = []
    const errorToCode = (error: unknown) => {
      if (error instanceof AppError) {
        return AppError.getErrorCodeFromClass(error.constructor.name)
      }
      return 'genericError'
    }
    const errorToDetails = (error: unknown) => {
      if (error instanceof HTTPError) {
        return error.message
      }
      return error instanceof Error ? error.message : `${error}`
    }

    const compactedOperations = compactOperations(operations)
    let count = 0
    for (const operation of compactedOperations) {
      const operationUuid = operation.uuid
      switch (operation.kind) {
        case 'set': {
          if (!operation || typeof operation.payload !== 'object') {
            throw new InvalidOperationPayloadError()
          }
          for (const [totpUuid, totp] of Object.entries(operation.payload as Record<string, unknown>)) {
            try {
              if (!isValidUUID(totpUuid)) {
                results.push({
                  operationUuid,
                  totpUuid,
                  errorCode: 'invalidUuid',
                  errorDetails: 'Invalid UUID.',
                })
                continue
              }
              if (!isEncryptedTotp(totp)) {
                results.push({
                  operationUuid,
                  totpUuid,
                  errorCode: 'invalidTotp',
                  errorDetails: 'Invalid encrypted TOTP.',
                })
                continue
              }
              count++
              if (count > maxCount) {
                results.push({
                  operationUuid,
                  totpUuid,
                  errorCode: 'maxCountExceeded',
                  errorDetails: 'Maximum number of operations exceeded.',
                })
                continue
              }
              const existing = await bucket.get(totpUuid as UUID)
              if (existing && existing.updatedAt > (totp as EncryptedTotp).updatedAt) {
                results.push({
                  operationUuid,
                  totpUuid,
                  errorCode: 'invalidUpdateTimestamp',
                  errorDetails: 'Encrypted TOTP is older than the currently stored one.',
                })
                continue
              }
              const tombstone = await bucket.getTombstone(totpUuid as UUID)
              if (tombstone && tombstone.deletedAt >= (totp as EncryptedTotp).updatedAt) {
                results.push({
                  operationUuid,
                  totpUuid,
                  errorCode: 'deletedTotp',
                  errorDetails: 'A TOTP with the same UUID has been deleted more recently.',
                })
                continue
              }
              if (!existing || !areEncryptedTotpsEqual(existing, (totp as EncryptedTotp))) {
                await bucket.set(totpUuid as UUID, totp as EncryptedTotp)
              }
              results.push({
                operationUuid,
                totpUuid,
                errorCode: null,
                errorDetails: null,
              })
            }
            catch (error) {
              results.push({
                operationUuid,
                totpUuid,
                errorCode: errorToCode(error),
                errorDetails: errorToDetails(error),
              })
            }
          }
        }
          break
        case 'delete': {
          if (!operation.payload || typeof operation.payload !== 'object' || Array.isArray(operation.payload)) {
            throw new InvalidOperationPayloadError()
          }
          for (const [totpUuid, deletedAt] of Object.entries(operation.payload as Record<string, unknown>)) {
            try {
              if (!isValidUUID(totpUuid)) {
                results.push({
                  operationUuid,
                  totpUuid,
                  errorCode: 'invalidUuid',
                  errorDetails: 'Invalid UUID.',
                })
                continue
              }
              if (typeof deletedAt !== 'number') {
                results.push({
                  operationUuid,
                  totpUuid,
                  errorCode: 'invalidDeleteTimestamp',
                  errorDetails: 'Invalid delete timestamp : must be a number.',
                })
                continue
              }
              count++
              if (count > maxCount) {
                results.push({
                  operationUuid,
                  totpUuid,
                  errorCode: 'maxCountExceeded',
                  errorDetails: 'Maximum number of operations exceeded.',
                })
                continue
              }
              const active = await bucket.get(totpUuid as UUID)
              if (active && active.updatedAt > deletedAt) {
                results.push({
                  operationUuid,
                  totpUuid,
                  errorCode: 'invalidDeleteTimestamp',
                  errorDetails: 'Currently stored TOTP is newer than the one you are trying to delete.',
                })
                continue
              }
              const tombstone = await bucket.getTombstone(totpUuid as UUID)
              if (!tombstone || tombstone.deletedAt < deletedAt) {
                await bucket.delete(totpUuid as UUID, deletedAt)
              }
              results.push({
                operationUuid,
                totpUuid,
                errorCode: null,
                errorDetails: null,
              })
            }
            catch (error) {
              results.push({
                operationUuid,
                totpUuid,
                errorCode: errorToCode(error),
                errorDetails: errorToDetails(error),
              })
            }
          }
        }
          break
      }
    }
    return SuccessObject.fromData(results).toResponse()
  },
})

interface PushOperation {
  uuid: string
  kind: 'set' | 'delete'
  payload: unknown
}

function compactOperations(operations: PushOperation[]): PushOperation[] {
  if (operations.length === 0) {
    return []
  }

  const processed = new Set<string>()
  const outReversed: PushOperation[] = []
  const compact = <T>(payload: Record<string, T>) => {
    const newPayload: Record<string, T> = {}

    for (const [uuid, value] of Object.entries(payload)) {
      if (!processed.has(uuid)) {
        processed.add(uuid)
        newPayload[uuid] = value
      }
    }

    return newPayload
  }

  for (let i = operations.length - 1; i >= 0; i--) {
    const operation = operations[i]!
    switch (operation.kind) {
      case 'set':
        {
          const newPayload = compact(operation.payload as Record<string, unknown>)
          if (Object.keys(newPayload).length > 0) {
            outReversed.push({ ...operation!, payload: newPayload })
          }
        }
        break
      case 'delete':
        {
          const newPayload = compact(operation.payload as Record<string, number>)
          if (Object.keys(newPayload).length > 0) {
            outReversed.push({ ...operation, payload: newPayload })
          }
        }
        break
    }
  }

  return outReversed.reverse()
}

interface PushOperationResult {
  operationUuid: string
  totpUuid: string
  errorCode: PushOperationResultError | string | null
  errorDetails: string | null
}

type PushOperationResultError = 'invalidUuid' | 'invalidTotp' | 'invalidUpdateTimestamp' | 'maxCountExceeded' | 'deletedTotp' | 'invalidDeleteTimestamp' | 'genericError'

class InvalidOperationPayloadError extends AppError {
  constructor() {
    super(`Invalid operation payload.`, InvalidOperationPayloadError, 400)
  }
}
