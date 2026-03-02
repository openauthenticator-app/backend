import { H3Error } from 'h3'

export class AppError extends H3Error {
  public readonly errorCode: string

  constructor(
    message: string,
    errorCode: string | typeof AppError,
    statusCode: number = 500,
  ) {
    super(message)
    this.errorCode = typeof errorCode === 'string' ? errorCode : AppError.getErrorCodeFromClass(errorCode)
    this.statusCode = statusCode
  }

  public static getErrorCodeFromClass(cls: typeof AppError): string {
    let name = cls.name
    name = name[0].toLowerCase() + name.substring(1)
    if (name.endsWith('Error')) {
      return name.substring(0, name.length - 'Error'.length)
    }
    return name
  }
}
