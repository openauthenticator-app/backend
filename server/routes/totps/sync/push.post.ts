import { H3Error, H3Event } from 'h3'
import { AppError, EncryptedTotp, TotpBucket, type UserEvent, type UUID } from '~/app'

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

export default defineEventHandler(async (event: H3Event) => {
  const userEvent = event as UserEvent
  const bucket = TotpBucket.of(userEvent.context.user)
  const operations = await readValidatedBody<PushOperation[]>(event, validateBody)
  const results: PushOperationResult[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errorToDetails = (error: any) => {
    if (error instanceof H3Error) {
      return error.message
    }
    return error instanceof Error ? error.message : error.toString()
  }

  const compactedOperations = compactOperations(operations)
  for (const operation of compactedOperations) {
    switch (operation.kind) {
      case 'set':
        {
          if (!operation || typeof operation.payload !== 'object') {
            throw new InvalidOperationPayloadError()
          }
          const uuids = Object.keys(operation.payload as object)
          for (const uuid of uuids) {
            try {
              if (!isValidUUID(uuid)) {
                results.push({ uuid, errorCode: 'invalidUuid', errorDetail: 'Invalid UUID.' })
                continue
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const totp = (operation.payload as Record<string, any>)[uuid]
              if (!isEncryptedTotp(totp)) {
                results.push({ uuid, errorCode: 'invalidTotp', errorDetail: 'Invalid encrypted TOTP.' })
                continue
              }
              const existing = await bucket.get(uuid as UUID)
              if (existing && existing.updatedAt > totp.updatedAt) {
                results.push({ uuid, errorCode: 'invalidUpdateTimestamp', errorDetail: 'Encrypted TOTP is older than existing one.' })
                continue
              }
              if (existing !== totp) {
                await bucket.set(uuid as UUID, totp as EncryptedTotp)
              }
              results.push({ uuid, errorCode: null, errorDetail: null })
            }
            catch (error) {
              results.push({ uuid, errorCode: 'genericError', errorDetail: errorToDetails(error) })
            }
          }
        }
        break
      case 'delete':
        {
          if (!Array.isArray(operation.payload)) {
            throw new InvalidOperationPayloadError()
          }
          for (const uuid of operation.payload) {
            try {
              if (!isValidUUID(uuid)) {
                results.push({ uuid, errorCode: 'invalidUuid', errorDetail: 'Invalid UUID.' })
                continue
              }
              await bucket.delete(uuid)
              results.push({ uuid, errorCode: null, errorDetail: null })
            }
            catch (error) {
              results.push({ uuid, errorCode: 'genericError', errorDetail: errorToDetails(error) })
            }
          }
        }
        break
    }
  }
  return SuccessObject.fromData(results)
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

  for (let i = operations.length - 1; i >= 0; i--) {
    const operation = operations[i]
    switch (operation.kind) {
      case 'set':
        {
          const payload = operation.payload as Record<string, unknown>
          const newPayload: Record<string, unknown> = {}

          for (const [uuid, value] of Object.entries(payload)) {
            if (!processed.has(uuid)) {
              processed.add(uuid)
              newPayload[uuid] = value
            }
          }

          if (Object.keys(newPayload).length > 0) {
            outReversed.push({ ...operation, payload: newPayload })
          }
        }
        break
      case 'delete':
        {
          const payload = operation.payload as string[]
          const newPayload: string[] = []

          for (const uuid of payload) {
            if (!processed.has(uuid)) {
              processed.add(uuid)
              newPayload.push(uuid)
            }
          }

          if (newPayload.length > 0) {
            outReversed.push({ ...operation, payload: newPayload })
          }
        }
        break
    }
  }

  return outReversed.reverse()
}

interface PushOperationResult {
  uuid: string
  errorCode: PushOperationResultError | null
  errorDetail: string | null
}

type PushOperationResultError = 'invalidUuid' | 'invalidTotp' | 'invalidUpdateTimestamp' | 'genericError'

class InvalidOperationPayloadError extends AppError {
  constructor() {
    super(`Invalid operation payload.`, InvalidOperationPayloadError, 400)
  }
}
