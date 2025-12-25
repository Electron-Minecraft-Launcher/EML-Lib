/**
 * @license MIT
 * @copyright Copyright (c) 2025, GoldFrite
 */

import type { BrowserWindow } from 'electron'
import MicrosoftAuthGui from './microsoftgui'
import { Account } from '../../types/account'
import { EMLLibError, ErrorType } from '../../types/errors'

/**
 * Authenticate a user with Microsoft.
 *
 * **Attention!** Using this class requires Electron. Use `npm i electron` to install it.
 */
export default class MicrosoftAuth {
  private readonly mainWindow: BrowserWindow
  private readonly clientId: string

  /**
   * @param mainWindow Your Electron application's main window (to create a child window for the Microsoft login).
   * @param clientId [Optional] Your Microsoft application's client ID.
   */
  constructor(mainWindow: BrowserWindow, clientId?: string) {
    this.mainWindow = mainWindow
    this.clientId = clientId ?? '00000000402b5328'
  }

  /**
   * Authenticate a user with Microsoft. This method will open a child window to login.
   * @returns The account information.
   */
  async auth() {
    let userCode = await new MicrosoftAuthGui(this.mainWindow, this.clientId).openWindow()
    if (userCode == 'cancel') throw new EMLLibError(ErrorType.AUTH_CANCELLED, 'User cancelled the login')

    const response = await fetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${this.clientId}&code=${userCode}&grant_type=authorization_code&redirect_uri=https://login.live.com/oauth20_desktop.srf`
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Error getting OAuth2 token: HTTP ${response.status} - ${errorText}`)
    }

    const res = await response.json()

    try {
      return await this.getAccount(res)
    } catch (err: unknown) {
      throw err
    }
  }

  /**
   * Validate a user's access token with Microsoft. This method will check if the token is still valid.
   * @param user The user account to validate.
   * @returns True if the token is valid, false otherwise (then you should call `MicrosoftAuth.refresh`).
   */
  async validate(user: Account) {
    try {
      const response = await fetch('https://api.minecraftservices.com/minecraft/profile', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${user.accessToken}`
        }
      })

      return response.ok
    } catch (err) {
      return false
    }
  }

  /**
   * Refresh a user with Microsoft. This method will renew the user's token.
   * @param user The user account to refresh.
   * @returns The refreshed account information.
   */
  async refresh(user: Account) {
    const response = await fetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${this.clientId}&grant_type=refresh_token&refresh_token=${user.refreshToken}`
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Error refreshing OAuth2 token: HTTP ${response.status} - ${errorText}`)
    }

    const res = await response.json()

    try {
      return await this.getAccount(res)
    } catch (err: unknown) {
      throw err
    }
  }

  private async getAccount(authInfo: any) {
    const xboxLiveRes = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
      method: 'POST',
      body: JSON.stringify({
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: 'd=' + authInfo.access_token
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT'
      }),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
    })

    if (!xboxLiveRes.ok) {
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Xbox Live Auth failed: ${xboxLiveRes.statusText}`)
    }
    const xboxLive = await xboxLiveRes.json()

    const xstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        Properties: {
          SandboxId: 'RETAIL',
          UserTokens: [xboxLive.Token]
        },
        RelyingParty: 'rp://api.minecraftservices.com/',
        TokenType: 'JWT'
      })
    })

    if (!xstsRes.ok) {
      const errJson = await xstsRes.json().catch(() => ({}))
      const errCode = errJson.XErr ?? xstsRes.status
      throw new EMLLibError(ErrorType.AUTH_ERROR, `XSTS Auth failed (Code: ${errCode}). Check Xbox account settings.`)
    }
    const xsts = await xstsRes.json()

    const launchRes = await fetch('https://api.minecraftservices.com/launcher/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xtoken: `XBL3.0 x=${xboxLive.DisplayClaims.xui[0].uhs};${xsts.Token}`, platform: 'PC_LAUNCHER' })
    })

    if (!launchRes.ok) {
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Minecraft Launcher Login failed: ${launchRes.statusText}`)
    }
    await launchRes.json()

    const mcLoginRes = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken: `XBL3.0 x=${xboxLive.DisplayClaims.xui[0].uhs};${xsts.Token}` })
    })

    if (!mcLoginRes.ok) {
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Minecraft Login failed: ${mcLoginRes.statusText}`)
    }
    const mcLogin = await mcLoginRes.json()

    const hasGameRes = await fetch('https://api.minecraftservices.com/entitlements/mcstore', {
      method: 'GET',
      headers: { Authorization: `Bearer ${mcLogin.access_token}` }
    })

    if (!hasGameRes.ok) {
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Failed to check game ownership: ${hasGameRes.statusText}`)
    }
    const hasGame = await hasGameRes.json()

    if (!hasGame.items.some((i: any) => i.name == 'product_minecraft' || i.name == 'game_minecraft')) {
      throw new EMLLibError(ErrorType.AUTH_ERROR, 'Minecraft not owned')
    }

    let profile: { uuid: any; name: any }

    try {
      profile = await this.getProfile(mcLogin)
    } catch (err: unknown) {
      throw err
    }

    return {
      name: profile.name,
      uuid: profile.uuid,
      accessToken: mcLogin.access_token,
      clientToken: this.getUuid(),
      refreshToken: authInfo.refresh_token,
      userProperties: {},
      meta: {
        online: true,
        type: 'msa'
      }
    } as Account
  }

  private async getProfile(mcLogin: any) {
    const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${mcLogin.access_token}` }
    })

    if (!profileRes.ok) {
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Error while getting the Minecraft profile: ${profileRes.statusText}`)
    }

    const profile = await profileRes.json()

    if (profile.error) throw new EMLLibError(ErrorType.AUTH_ERROR, `Profile Error: ${profile.errorMessage || 'Unknown'}`)

    return {
      uuid: profile.id,
      name: profile.name
    }
  }

  private getUuid() {
    let result = ''
    for (let i = 0; i <= 4; i++) {
      result += (Math.floor(Math.random() * 16777216) + 1048576).toString(16)
      if (i < 4) result += '-'
    }
    return result
  }
}

