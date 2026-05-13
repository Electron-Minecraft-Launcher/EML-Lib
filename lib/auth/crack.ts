/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { createHash } from 'node:crypto'
import { Account } from '../../types/account.js'
import { EMLLibError, ErrorType } from './../../types/errors.js'
import { AuthEvents } from '../../types/events.js'
import EventEmitter from '../utils/events.js'

export default class CrackAuth extends EventEmitter<AuthEvents> {
  /**
   * Authenticate a user with a crack account.
   * @deprecated This auth method is not secure, use it only for testing purposes or for local 
   * servers!
   */
  constructor() {
    super()
  }

  /**
   * Authenticate a user with a crack account.
   * @param username The username of the user.
   * @returns The account information.
   * @deprecated This auth method is not secure, use it only for testing purposes or for local
   * servers!
   */
  auth(username: string): Account {
    if (/^[a-zA-Z0-9_]+$/gm.test(username) && username.length > 2) {
      const uuid = this.getOfflineUUID(username)
      this.emit('auth_success', { name: username })
      return {
        name: username,
        uuid: uuid,
        clientToken: uuid,
        accessToken: uuid,
        meta: {
          online: false,
          type: 'crack'
        }
      } as Account
    } else {
      this.emit('auth_error', { message: 'Invalid username' })
      throw new EMLLibError(ErrorType.AUTH_ERROR, 'Invalid username')
    }
  }

  private getOfflineUUID(username: string): string {
    const hash = createHash('md5').update(`OfflinePlayer:${username}`).digest()

    hash[6] = (hash[6] & 0x0f) | 0x30
    hash[8] = (hash[8] & 0x3f) | 0x80

    return [
      hash.toString('hex', 0, 4),
      hash.toString('hex', 4, 6),
      hash.toString('hex', 6, 8),
      hash.toString('hex', 8, 10),
      hash.toString('hex', 10, 16)
    ].join('-')
  }
}
