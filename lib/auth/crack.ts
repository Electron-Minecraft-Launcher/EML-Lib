/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { Account } from '../../types/account'
import { EMLLibError, ErrorType } from './../../types/errors'
import { v4 } from 'uuid'

export default class CrackAuth {
  /**
   * Authenticate a user with a crack account.
   * @param username The username of the user.
   * @returns The account information.
   * @deprecated This auth method is not secure, use it only for testing purposes or for local servers!
   */
  auth(username: string) {
    if (/^[a-zA-Z0-9_]+$/gm.test(username) && username.length > 2) {
      const uuid = v4()
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
      throw new EMLLibError(ErrorType.AUTH_ERROR, 'Invalid username')
    }
  }
}
