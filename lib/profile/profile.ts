/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { Account } from '../../types/account.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import { IProfile } from '../../types/profile.js'

export default class Profile {
  private readonly url: string
  private readonly tokens: Map<string, string> = new Map()

  /**
   * Get the profiles from the EML AdminTool.
   *
   * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
   *
   * @param url The URL of your EML AdminTool website.
   * @param account (Deprecated, provide the account in the `getProfiles()` method instead)
   */
  constructor(url: string, account?: Account) {
    this.url = `${url}/api`
  }

  /**
   * Get the profiles from the EML AdminTool.
   * @param account The account to use for authentication, to display any hidden profiles.
   * @returns The list of Profile objects.
   */
  async getProfiles(account?: Account): Promise<IProfile[]>

  /**
   * Get the profiles from the EML AdminTool.
   * @param slug The slug of the protected profile you want to access. You need to authenticate
   * against the profile first using the `auth()` method.
   * @returns The list of Profile objects.
   */
  async getProfiles(slug?: string): Promise<IProfile[]>

  /**
   * Get the profiles from the EML AdminTool.
   * @param account The account to use for authentication, to display any hidden profiles.
   * @param slug The slug of the protected profile you want to access. You need to authenticate
   * against the profile first using the `auth()` method.
   * @returns The list of Profile objects.
   */
  async getProfiles(account: Account, slug: string): Promise<IProfile[]>

  async getProfiles(arg1?: Account | string, arg2?: string): Promise<IProfile[]> {
    try {
      const headers: HeadersInit = this.setHeader(arg1, arg2)
      const req = await fetch(`${this.url}/profiles`, { headers })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching profiles: HTTP ${req.status} ${errorText}`)
      }
      const data: { success: boolean; message?: string, profiles: IProfile[] } = await req.json()

      if (!data.success) {
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching profiles: ${data.message ?? 'Unknown error'}`)
      }

      return data.profiles ?? []
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching profiles: ${err instanceof Error ? err.message : err}`)
    }
  }

  /**
   * Authenticate against a protected profile.
   *
   * **Note:** The returned token is stored in memory and will be used for subsequent requests to the
   * EML AdminTool. You do not need to manually manage the token.
   *
   * @param slug The slug of the profile to authenticate against.
   * @param password The password for the profile.
   * @returns An object containing the slug and the authentication token.
   */
  async auth(slug: string, password: string) {
    try {
      const headers: HeadersInit = { Authorization: `Basic ${Buffer.from(`${slug}:${password}`).toString('base64')}` }
      const req = await fetch(`${this.url}/profiles/${slug}/auth`, { method: 'POST', headers })

      if (!req.ok) {
        const errorText = await req.text()
        if (req.status === 429) {
          throw new EMLLibError(
            ErrorType.TOO_MANY_REQUESTS,
            `Too many requests authenticating against profile '${slug}', try again later: HTTP ${req.status} ${errorText}`
          )
        }
        throw new EMLLibError(ErrorType.AUTH_ERROR, `Profile authentication failed: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      if (!data.success || !data.token) {
        throw new EMLLibError(ErrorType.AUTH_ERROR, `Profile authentication failed: ${data.message ?? 'Unknown error'}`)
      }

      this.tokens.set(slug, data.token)

      return {
        slug: slug,
        token: data.token
      }
    } catch (err) {
      const error =
        err instanceof EMLLibError
          ? err
          : new EMLLibError(ErrorType.AUTH_ERROR, `Profile authentication failed: ${err instanceof Error ? err.message : err}`)
      throw error
    }
  }

  private setHeader(arg1?: Account | string, arg2?: string): HeadersInit {
    if (typeof arg1 === 'object') {
      if (arg2) {
        return { pseudo: arg1.name, Authorization: `Bearer ${this.tokens.get(arg2)}` }
      }
      return { pseudo: arg1.name }
    }

    if (typeof arg1 === 'string') {
      const token = this.tokens.get(arg1)
      if (!token) {
        throw new EMLLibError(ErrorType.AUTH_ERROR, `No authentication token found for profile slug: ${arg1}`)
      }
      return { Authorization: `Bearer ${token}` }
    }

    return {}
  }
}

