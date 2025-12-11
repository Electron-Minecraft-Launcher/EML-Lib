/**
 * @license MIT
 * @copyright Copyright (c) 2025, IkyMax
 */

import { Account } from '../../types/account'
import { EMLLibError, ErrorType } from '../../types/errors'
import { v4 } from 'uuid'

/**
 * Authenticate a user with an yggdrasil-compatible server (Based on [Authlib-Injector](https://github-com.translate.goog/yushijinhun/authlib-injector/wiki/Yggdrasil-%E6%9C%8D%E5%8A%A1%E7%AB%AF%E6%8A%80%E6%9C%AF%E8%A7%84%E8%8C%83?_x_tr_sl=zh-CN&_x_tr_tl=en&_x_tr_hl=es&_x_tr_pto=wapp) and [original yggdrasil](https://minecraft.wiki/w/Yggdrasil) specs).
 */
export default class Yggdrasil {
  private readonly url: string

  /**
   * @param url The Authlib-Injector Metadata URL of your Yggdrasil server.
   */
  constructor(url: string) {
    if (url.endsWith('/')) url = url.slice(0, -1)
    this.url = `${url}/authserver`
  }

  /**
   * generates a clientToken for an specific user
   */
  async clientGen(): Promise<string> {
  return v4();
}

  /**
   * Authenticate a user with Yggdrasil.
   * @param username The username, email or player name of the user.
   * @param password The password of the user.
   * in the future, this method is going to be superseded by an OIDC flow
   * @returns The account information.
   */
  
  async authenticate(username: string, password: string): Promise<Account | { needsProfileSelection: true; availableProfiles: any[]; accessToken: string; clientToken: string }> {
    const res = await fetch(`${this.url}/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent: { name: 'Minecraft', version: 1 },
        username: username,
        password: password,
        clientToken: v4(),
        requestUser: true
      })
    }).then((res: any) => res.json())

    if (res.status == 'error') {
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Yggdrasil authentication failed: ${res.reason}`)
    }

    if (!res.selectedProfile) {
      return {
        needsProfileSelection: true,
        availableProfiles: res.availableProfiles,
        accessToken: res.accessToken,
        clientToken: res.clientToken
      }
    }

    return {
      name: res.selectedProfile.name,
      uuid: res.selectedProfile.id,
      clientToken: res.clientToken,
      accessToken: res.accessToken,
      availableProfiles: res.availableProfiles,
      userProperties: res.user?.properties ?? [],
      meta: {
        online: false,
        type: 'yggdrasil'
      }
    } as Account
  }

  /**
   * Validate a user with Yggdrasil.
   * @param user The user account to validate.
   * @returns The renewed account information.
   */
  async validate(user: Account): Promise<Account> {
    const res = await fetch(`${this.url}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: user.accessToken,
          clientToken: user.clientToken
        })
    })
    if (res.status === 204) {
        return user;
    }
    
    if (res.status === 403) {
        try {
            return await this.refresh(user);
        
        } catch (err: any) {
            throw new EMLLibError(
                ErrorType.AUTH_ERROR,
                `Yggdrasil validate failed: ${err.message ?? err}`
            )
        }
    }
    throw new EMLLibError(
        ErrorType.AUTH_ERROR,
        `Yggdrasil validate failed: unexpected status ${res.status}`
    )
}

  /**
   * Refresh the Yggdrasil user.
   * @param user The user account or credentials to refresh.
   * @param selectedProfile Optional profile selection for multi-profile accounts.
   * @returns The renewed account information.
   */
  async refresh(
    user: Account | { accessToken: string; clientToken: string },
    selectedProfile?: { id: string; name: string }
  ): Promise<Account> {
    const payload: any = {
      accessToken: user.accessToken,
      clientToken: user.clientToken,
      requestUser: true
    }

    if (selectedProfile) {
      payload.selectedProfile = selectedProfile
    }

    const res = await fetch(`${this.url}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).then((res: any) => res.json())

    if (res.status == 'error') {
      throw new EMLLibError(ErrorType.AUTH_ERROR, `Yggdrasil refresh failed: ${res.reason}`)
    }

    return {
      name: res.selectedProfile.name,
      uuid: res.selectedProfile.id,
      clientToken: res.clientToken,
      accessToken: res.accessToken,
      availableProfiles: res.availableProfiles,
      userProperties: res.user?.properties ?? [],
      meta: {
        online: false,
        type: 'yggdrasil'
      }
    } as Account
  }

  /**
   * Logout a user from Yggdrasil.
   * invalidate is preferred over sign out as sign out invalidates all sessions
   * and invalidate only the current one.
   * @param user The user account to logout.
   */
  async logout(user: Account) {
    await fetch(`${this.url}/invalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessToken: user.accessToken,
        clientToken: user.clientToken
      })
    })
  }
}
