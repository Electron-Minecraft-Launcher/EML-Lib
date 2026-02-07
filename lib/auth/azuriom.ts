/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { Account } from '../../types/account'
import { EMLLibError, ErrorType } from '../../types/errors'

export default class AzAuth {
  private readonly url: string

  /**
   * Authenticate a user with [Azuriom](https://azuriom.com/).
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
    try {
      const req = await fetch(`${this.url}/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: username,
          password: password,
          code: twoFACode
        })
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth authentication failed: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      if (data.status == 'pending' && data.reason == '2fa') {
        throw new EMLLibError(ErrorType.TWOFA_CODE_REQUIRED, '2FA code required')
      }

      if (data.status == 'error') {
        throw new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth authentication failed: ${data.reason}`)
      }

      return {
        name: data.username,
        uuid: data.uuid,
        clientToken: data.uuid,
        accessToken: data.access_token,
        userProperties: {},
        meta: {
          online: false,
          type: 'azuriom'
        }
      } as Account
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth authentication failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  /**
   * Verify a user with Azuriom.
   * @param user The user account to verify.
   * @returns The renewed account information.
   */
  async verify(user: Account) {
    try {
      const req = await fetch(`${this.url}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_token: user.accessToken
        })
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth verify failed: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      if (data.status == 'error') {
        throw new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth verify failed: ${data.reason}`)
      }

      return {
        name: data.username,
        uuid: data.uuid,
        accessToken: data.accessToken,
        clientToken: data.clientToken,
        userProperties: {},
        meta: {
          online: false,
          type: 'azuriom'
        }
      } as Account
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth verify failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  /**
   * Logout a user from Azuriom.
   * @param user The user account to logout.
   */
  async logout(user: Account) {
    try {
      const req = await fetch(`${this.url}/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_token: user.accessToken
        })
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth logout failed: HTTP ${req.status} ${errorText}`)
      }
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth logout failed: ${err instanceof Error ? err.message : err}`)
    }
  }
}

