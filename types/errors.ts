/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

/**
 * The error class for EMLLib.
 */
export class EMLLibError extends Error {
  code: ErrorCode
  message: any

  constructor(code: ErrorCode, message: any) {
    super(message)
    this.code = code
  }
}

export const ErrorType = {
  MODULE_NOT_FOUND: 'MODULE_NOT_FOUND',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  TWOFA_CODE_REQUIRED: 'TWOFA_CODE_REQUIRED',
  AUTH_ERROR: 'AUTH_ERROR',
  AUTH_CANCELLED: 'AUTH_CANCELLED',
  HASH_ERROR: 'HASH_ERROR',
  DOWNLOAD_ERROR: 'DOWNLOAD_ERROR',
  UNKNOWN_OS: 'UNKNOWN_OS',
  FETCH_ERROR: 'FETCH_ERROR',
  NET_ERROR: 'NET_ERROR',
  FILE_ERROR: 'FILE_ERROR',
  EXEC_ERROR: 'EXEC_ERROR',
  JAVA_ERROR: 'JAVA_ERROR',
  PATCHER_ERROR: 'PATCHER_ERROR',
  MINECRAFT_ERROR: 'MINECRAFT_ERROR'
} as const

export type ErrorCode =
  | typeof ErrorType.MODULE_NOT_FOUND
  | typeof ErrorType.UNKNOWN_ERROR
  | typeof ErrorType.TWOFA_CODE_REQUIRED
  | typeof ErrorType.AUTH_ERROR
  | typeof ErrorType.AUTH_CANCELLED
  | typeof ErrorType.DOWNLOAD_ERROR
  | typeof ErrorType.HASH_ERROR
  | typeof ErrorType.UNKNOWN_OS
  | typeof ErrorType.NET_ERROR
  | typeof ErrorType.FETCH_ERROR
  | typeof ErrorType.FILE_ERROR
  | typeof ErrorType.EXEC_ERROR
  | typeof ErrorType.JAVA_ERROR
  | typeof ErrorType.PATCHER_ERROR
  | typeof ErrorType.MINECRAFT_ERROR

