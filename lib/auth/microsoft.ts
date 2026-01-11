/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
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
    try {
      const userCode = await new MicrosoftAuthGui(this.mainWindow, this.clientId).openWindow()
      if (userCode == 'cancel') throw new EMLLibError(ErrorType.AUTH_CANCELLED, 'User cancelled the login')

      const req = await fetch('https://login.live.com/oauth20_token.srf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `client_id=${this.clientId}&code=${userCode}&grant_type=authorization_code&redirect_uri=https://login.live.com/oauth20_desktop.srf`
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `Microsoft auth failed: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      return await this.getAccount(data)
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Microsoft authentication failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  /**
   * Validate a user's access token with Microsoft. This method will check if the token is still valid.
   * @param user The user account to validate.
   * @returns True if the token is valid, false otherwise (then you should call `MicrosoftAuth.refresh`).
   */
  async validate(user: Account) {
    try {
      const req = await fetch('https://api.minecraftservices.com/minecraft/profile', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${user.accessToken}`
        }
      })

      return req.ok
    } catch {
      return false
    }
  }

  /**
   * Refresh a user with Microsoft. This method will renew the user's token.
   * @param user The user account to refresh.
   * @returns The refreshed account information.
   */
  async refresh(user: Account) {
    try {
      const req = await fetch('https://login.live.com/oauth20_token.srf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `client_id=${this.clientId}&grant_type=refresh_token&refresh_token=${user.refreshToken}`
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `Microsoft auth refresh failed: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      return await this.getAccount(data)
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Microsoft auth refresh failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  private async getAccount(authInfo: any) {
    try {
      const xblReq = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
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

      if (!xblReq.ok) {
        const errorText = await xblReq.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `Xbox Live authentication failed: HTTP ${xblReq.status} ${errorText}`)
      }
      const xblData = await xblReq.json()

      const xstsReq = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          Properties: {
            SandboxId: 'RETAIL',
            UserTokens: [xblData.Token]
          },
          RelyingParty: 'rp://api.minecraftservices.com/',
          TokenType: 'JWT'
        })
      })

      if (!xstsReq.ok) {
        const errorText = await xstsReq.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `XSTS authentication failed: HTTP ${xstsReq.status} ${errorText}. Check Xbox privacy settings.`)
      }
      const xstsData = await xstsReq.json()

      const mcauthReq = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityToken: `XBL3.0 x=${xblData.DisplayClaims.xui[0].uhs};${xstsData.Token}` })
      })

      if (!mcauthReq.ok) {
        const errorText = await mcauthReq.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `Minecraft authentication with Xbox failed: HTTP ${mcauthReq.status} ${errorText}`)
      }
      const mcauthData = await mcauthReq.json()

      const mcgameReq = await fetch('https://api.minecraftservices.com/entitlements/mcstore', {
        method: 'GET',
        headers: { Authorization: `Bearer ${mcauthData.access_token}` }
      })

      if (!mcgameReq.ok) {
        const errorText = await mcgameReq.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `Minecraft game ownership check failed: HTTP ${mcgameReq.status} ${errorText}`)
      }
      const mcgameData = await mcgameReq.json()

      if (!mcgameData.items.some((i: any) => i.name == 'product_minecraft' || i.name == 'game_minecraft')) {
        throw new EMLLibError(ErrorType.AUTH_ERROR, 'Minecraft not owned')
      }

      const profile = await this.getProfile(mcauthData)

      return {
        name: profile.name,
        uuid: profile.uuid,
        accessToken: mcauthData.access_token,
        clientToken: this.getUuid(),
        refreshToken: authInfo.refresh_token,
        userProperties: {},
        meta: {
          online: true,
          type: 'msa'
        }
      } as Account
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Microsoft authentication failed: ${(err as Error).message}`)
    }
  }

  private async getProfile(mcLogin: any) {
    try {
      const profileReq = await fetch('https://api.minecraftservices.com/minecraft/profile', {
        method: 'GET',
        headers: { Authorization: `Bearer ${mcLogin.access_token}` }
      })

      if (!profileReq.ok) {
        const errorText = await profileReq.text()
        throw new EMLLibError(ErrorType.AUTH_ERROR, `Profile request failed: HTTP ${profileReq.status} ${errorText}`)
      }
      const profileData = await profileReq.json()

      if (profileData.error) {
        throw new EMLLibError(ErrorType.AUTH_ERROR, `Profile error: ${profileData.errorMessage ?? 'unknown'}`)
      }

      return {
        uuid: profileData.id,
        name: profileData.name
      }
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Getting profile failed: ${(err as Error).message}`)
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
