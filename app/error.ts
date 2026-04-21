import { HTTPError } from 'nitro/h3'

export class AppError extends HTTPError {
  public readonly errorCode: string

  constructor(
    message: string,
    errorCode: string | typeof AppError,
    statusCode: number = 500,
  ) {
    super(
      message,
      {
        status: statusCode,
      },
    )
    this.errorCode = AppError.getErrorCodeFromClass(errorCode)
  }

  public static getErrorCodeFromClass(cls: string | typeof AppError): string {
    let name = typeof cls === 'string' ? cls : cls.name
    name = (name[0] ?? '').toLowerCase() + name.substring(1)
    if (name.endsWith('Error')) {
      return name.substring(0, name.length - 'Error'.length)
    }
    return name
  }
}
