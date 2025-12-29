import { H3Error } from 'h3'

export class AppError extends H3Error {
  constructor(message: string, statusCode: number = 500) {
    super(message)
    this.statusCode = statusCode
  }
}
