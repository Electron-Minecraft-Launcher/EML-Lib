/**
 * @license MIT
 * @copyright Copyright (c) 2026, IkyMax, GoldFrite
 */

import { Account, MultipleProfiles } from '../../types/account'
import { EMLLibError, ErrorType } from '../../types/errors'

export default class YggdrasilAuth {
  private readonly url: string

  /**
   * Authenticate a user with an [Yggdrasil-compatible](https://minecraft.wiki/w/Yggdrasil) server.
   *
   * **Attention!** While Yggdrasil has been deprecated by Mojang/Microsoft, the API is maintained by a community
   * who wants to keep the protocol alive. Usage of a custom authentication server may or may not violate
   * Minecraft's Terms of Service: make sure to validate your player's Minecraft ownership!
   * @param url The URL to the Yggdrasil-compatible server.
   */
  constructor(url: string) {
    if (url.endsWith('/')) url = url.slice(0, -1)
    this.url = url
  }

  /**
   * Authenticate a user with Yggdrasil.
   * @param username The username, email or player name of the user.
   * @param password The password of the user.
   * @returns The account information.
   */
  async auth(username: string, password: string) {
    try {
      const req = await fetch(`${this.url}/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agent: { name: 'Minecraft', version: 1 },
          username,
          password,
          requestUser: true
        })
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `Yggdrasil authentication failed: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      if (!data.selectedProfile) {
        return {
          needsProfileSelection: true,
          availableProfiles: data.availableProfiles,
          userProperties: data.user?.properties ?? {},
          accessToken: data.accessToken,
          clientToken: data.clientToken,
          url: this.url
        } as MultipleProfiles
      }

      return {
        name: data.selectedProfile.name,
        uuid: data.selectedProfile.id,
        clientToken: data.clientToken,
        accessToken: data.accessToken,
        userProperties: data.user?.properties ?? {},
        meta: {
          online: false,
          type: 'yggdrasil',
          url: this.url
        }
      } as Account
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Yggdrasil authentication failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  /**
   * Select a profile for a user with multiple profiles. This method is used when the `YggdrasilAuth.auth` method returns a `MultipleProfiles` object.
   * @param profiles The multiple profiles information returned by the `YggdrasilAuth.auth` method.
   * @param select The profile to select, either by ID or name. If both are provided, ID will be used.
   * @return The account information with the selected profile.
   */
  selectProfile(profiles: MultipleProfiles, select: { id?: string; name?: string }) {
    if (!select.id && !select.name) {
      throw new EMLLibError(ErrorType.AUTH_ERROR, 'Yggdrasil profile selection failed: no profile ID or name provided')
    }

    const profile = select.id
      ? profiles.availableProfiles.find((p) => p.id === select.id)
      : profiles.availableProfiles.find((p) => p.name === select.name)

    if (!profile) {
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Yggdrasil profile selection failed: profile with ID/name ${select.id ?? select.name} not found`)
    }

    return {
      name: profile.name,
      uuid: profile.id,
      clientToken: profiles.clientToken,
      accessToken: profiles.accessToken,
      availableProfiles: profiles.availableProfiles,
      userProperties: profiles.userProperties,
      meta: {
        online: false,
        type: 'yggdrasil',
        url: profiles.url
      }
    } as Account
  }

  /**
   * Validate a user's access token with Yggdrasil. This method will check if the token is still valid.
   * @param user The user account to validate.
   * @returns True if the token is valid, false otherwise (then you should call `YggdrasilAuth.refresh`).
   */
  async validate(user: Account) {
    try {
      const req = await fetch(`${this.url}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: user.accessToken,
          clientToken: user.clientToken
        })
      })

      return req.ok
    } catch {
      return false
    }
  }

  /**
   * Refresh the Yggdrasil user.
   * @param user The user account or credentials to refresh.
   * @returns The renewed account information.
   */
  async refresh(user: Account) {
    try {
      const req = await fetch(`${this.url}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accessToken: user.accessToken,
          clientToken: user.clientToken,
          requestUser: true
        })
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `Yggdrasil refresh failed: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      let selectedProfile
      if (!data.selectedProfile) {
        const res = {
          needsProfileSelection: true,
          availableProfiles: data.availableProfiles,
          userProperties: data.user?.properties ?? {},
          accessToken: data.accessToken,
          clientToken: data.clientToken,
          url: this.url
        } as MultipleProfiles
        selectedProfile = this.selectProfile(res, { id: user.uuid, name: user.name })
      } else {
        selectedProfile = data.selectedProfile
      }

      return {
        name: selectedProfile.name,
        uuid: selectedProfile.id,
        clientToken: data.clientToken,
        accessToken: data.accessToken,
        userProperties: data.user?.properties ?? {},
        meta: {
          online: false,
          type: 'yggdrasil',
          url: this.url
        }
      } as Account
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Yggdrasil refresh failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  /**
   * Logout a user from Yggdrasil.
   * @remarks This method use `invalidate`. `invalidate` is preferred over `signout` as `signout` invalidates
   * all sessions and `invalidate` invalidates only the current one.
   * @param user The user account to logout.
   */
  async logout(user: Account) {
    try {
      const req = await fetch(`${this.url}/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accessToken: user.accessToken
        })
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `Yggdrasil logout failed: HTTP ${req.status} ${errorText}`)
      }
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Yggdrasil logout failed: ${err instanceof Error ? err.message : err}`)
    }
  }
}

