/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { Account } from '../../types/account'
import { EMLLibError, ErrorType } from '../../types/errors'

/**
 * Authenticate a user with [Azuriom](https://azuriom.com/).
 */
export default class AzAuth {
  private readonly url: string

  /**
   * @param url The URL of your Azuriom website.
   */
  constructor(url: string) {
    if (url.endsWith('/')) url = url.slice(0, -1)
    this.url = `${url}/api/auth`
  }

  /**
   * Authenticate a user with Azuriom.
   * @param username The username or email of the user.
   * @param password The password of the user.
   * @param twoFACode [Optional] The 2FA code if the user has 2FA enabled.
   * @returns The account information.
   */
  async auth(username: string, password: string, twoFACode?: string) {
    const res = await fetch(`${this.url}/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: username,
        password: password,
        code: twoFACode
      })
    }).then((res: any) => res.json())

    if (res.status == 'pending' && res.reason == '2fa') {
      throw new EMLLibError(ErrorType.TWOFA_CODE_REQUIRED, '2FA code required')
    }

    if (res.status == 'error') {
      throw new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth authentication failed: ${res.reason}`)
    }

    return {
      name: res.username,
      uuid: res.uuid,
      clientToken: res.uuid,
      accessToken: res.access_token,
      userProperties: {},
      meta: {
        online: false,
        type: 'azuriom'
      }
    } as Account
  }

  /**
   * Verify a user with Azuriom.
   * @param user The user account to verify.
   * @returns The renewed account information.
   */
  async verify(user: Account) {
    const res = await fetch(`${this.url}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_token: user.accessToken
      })
    }).then((res: any) => res.json())

    if (res.status == 'error') {
      throw new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth verify failed: ${res.reason}`)
    }

    return {
      name: res.username,
      uuid: res.uuid,
      accessToken: res.accessToken,
      clientToken: res.clientToken,
      userProperties: {},
      meta: {
        online: false,
        type: 'azuriom'
      }
    } as Account
  }

  /**
   * Logout a user from Azuriom.
   * @param user The user account to logout.
   */
  async logout(user: Account) {
    await fetch(`${this.url}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_token: user.accessToken
      })
    })
  }
}
