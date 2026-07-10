/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { IStatProvider, StatProvider } from '../../index.js'
import { Account } from '../../types/account.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import { AuthEvents } from '../../types/events.js'
import EventEmitter from '../utils/events.js'

export default class AzAuth extends EventEmitter<AuthEvents> implements IStatProvider {
  public readonly statType: StatProvider = 'AUTH_AZAUTH'
  private readonly url: string

  /**
   * Authenticate a user with [Azuriom](https://azuriom.com/).
   * @param url The URL of your Azuriom website (e.g., https://yourwebsite.com).
   */
  constructor(url: string) {
    super()
    if (url.endsWith('/')) url = url.slice(0, -1)
    this.url = url
  }

  /**
   * Authenticate a user with Azuriom.
   * @param username The username or email of the user.
   * @param password The password of the user.
   * @param twoFACode [Optional] The 2FA code if the user has 2FA enabled.
   * @returns The account information.
   */
  async auth(username: string, password: string, twoFACode?: string): Promise<Account> {
    try {
      const req = await fetch(`${this.url}/api/auth/authenticate`, {
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

      this.emit('auth_success', { name: data.username })
      return {
        name: data.username,
        uuid: data.uuid,
        clientToken: data.uuid,
        accessToken: data.access_token,
        userProperties: {},
        meta: {
          online: false,
          type: 'azuriom',
          url: this.url
        }
      } as Account
    } catch (err: unknown) {
      const error = err instanceof EMLLibError ? err : new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth authentication failed: ${err instanceof Error ? err.message : err}`)
      this.emit('auth_error', { message: error.message })
      throw error
    }
  }

  /**
   * Verify a user with Azuriom.
   * @param user The user account to verify.
   * @returns The renewed account information.
   */
  async verify(user: Account): Promise<Account> {
    try {
      const req = await fetch(`${this.url}/api/auth/verify`, {
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

      this.emit('validate_success', { name: user.name })
      return {
        name: data.username,
        uuid: data.uuid,
        accessToken: data.accessToken,
        clientToken: data.clientToken,
        userProperties: {},
        meta: {
          online: false,
          type: 'azuriom',
          url: this.url
        }
      } as Account
    } catch (err: unknown) {
      const error = err instanceof EMLLibError ? err : new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth verify failed: ${err instanceof Error ? err.message : err}`)
      this.emit('validate_error', { message: error.message })
      throw error
    }
  }

  /**
   * Logout a user from Azuriom.
   * @param user The user account to logout.
   */
  async logout(user: Account): Promise<void> {
    try {
      const req = await fetch(`${this.url}/api/auth/logout`, {
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

      this.emit('logout_success', { name: user.name })
    } catch (err: unknown) {
      const error = err instanceof EMLLibError ? err : new EMLLibError(ErrorType.AUTH_ERROR, `AzAuth logout failed: ${err instanceof Error ? err.message : err}`)
      this.emit('logout_error', { message: error.message })
      throw error
    }
  }
}
