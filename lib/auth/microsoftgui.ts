/**
 * @license MIT
 * @copyright Copyright (c) 2025, GoldFrite
 */

import type { BrowserWindow } from 'electron'
import { EMLLibError, ErrorType } from '../../types/errors'

export default class MicrosoftAuthGui {
  private readonly clientId: string
  private readonly mainWindow: BrowserWindow
  private window: BrowserWindow | undefined

  constructor(mainWindow: BrowserWindow, clientId: string) {
    this.clientId = clientId
    this.mainWindow = mainWindow
  }

  async openWindow(): Promise<any> {
    let electron
    try {
      electron = await import('electron')
    } catch {
      throw new EMLLibError(
        ErrorType.MODULE_NOT_FOUND,
        '`electron` module is not installed. Please install it with `npm i electron` to use Microsoft authentication.'
      )
    }

    this.window = new electron.BrowserWindow({
      parent: this.mainWindow,
      modal: true,
      width: 630,
      height: 650,
      resizable: false,
      minimizable: false,
      center: true,
      webPreferences: {
        devTools: true
      }
    })

    await new Promise((resolve: any) => {
      electron.app.whenReady().then(() => {
        electron.session.defaultSession.cookies.get({ domain: 'live.com' }).then((cookies) => {
          for (let cookie of cookies) {
            let cookieUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain!.replace(/$\./, '') + cookie.path}`
            electron.session.defaultSession.cookies.remove(cookieUrl, cookie.name)
          }
        })
        return resolve()
      })
    })

    return new Promise((resolve) => {
      electron.app.whenReady().then(() => {
        this.window!.setMenu(null)
        this.window!.loadURL(
          `https://login.live.com/oauth20_authorize.srf?client_id=${this.clientId}&response_type=code&redirect_uri=https://login.live.com/oauth20_desktop.srf&scope=XboxLive.signin%20offline_access&cobrandid=8058f65d-ce06-4c30-9559-473c9275a65d&prompt=select_account`
        )

        let loading = false

        this.window!.on('close', () => {
          if (!loading) resolve('cancel')
        })

        this.window!.webContents.on('did-finish-load', () => {
          const location = this.window!.webContents.getURL()
          if (location.startsWith('https://login.live.com/oauth20_desktop.srf')) {
            const urlParams = new URLSearchParams(location.substr(location.indexOf('?') + 1)).get('code')
            if (urlParams) {
              resolve(urlParams)
              loading = true
            } else {
              resolve('cancel')
            }
            try {
              this.window!.close()
            } catch (err) {
              console.error('Failed to close window!', err)
            }
          }
        })
      })
    })
  }
}

