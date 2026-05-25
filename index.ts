/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import MicrosoftAuth from './lib/auth/microsoft.js'
import YggdrasilAuth from './lib/auth/yggdrasil.js'
import AzAuth from './lib/auth/azuriom.js'
import CrackAuth from './lib/auth/crack.js'
import Skin from './lib/skin/skin.js'
import Bootstrap from './lib/bootstrap/bootstrap.js'
import Maintenance from './lib/maintenance/maintenance.js'
import News from './lib/news/news.js'
import Background from './lib/background/background.js'
import ServerStatus from './lib/serverstatus/serverstatus.js'
import Java from './lib/java/java.js'
import Launcher from './lib/launcher/launcher.js'
import Profiles from './lib/profile/profile.js'
import Stats from './lib/stats/stats.js'

type EMLLib = {
  MicrosoftAuth: typeof MicrosoftAuth
  YggdrasilAuth: typeof YggdrasilAuth
  AzAuth: typeof AzAuth
  CrackAuth: typeof CrackAuth
  Skin: typeof Skin
  Bootstraps: typeof Bootstrap
  Bootstrap: typeof Bootstrap
  Maintenance: typeof Maintenance
  News: typeof News
  Background: typeof Background
  Profiles: typeof Profiles
  ServerStatus: typeof ServerStatus
  Java: typeof Java
  Launcher: typeof Launcher
  Stats: typeof Stats
}

export type * from './types/account.js'
export type * from './types/skin.js'
export type * from './types/background.js'
export type * from './types/bootstrap.js'
export type * from './types/config.js'
export type * from './types/errors.js'
export type * from './types/events.js'
export type * from './types/file.js'
export type * from './types/maintenance.js'
export type * from './types/manifest.js'
export type * from './types/news.js'
export type * from './types/profile.js'
export type * from './types/status.js'
export type * from './types/stats.js'

/**
 * Authenticate a user with Microsoft.
 *
 * **Attention!** Using this class requires Electron. Use `npm i electron` to install it.
 */
export { MicrosoftAuth }

/**
 * Authenticate a user with an [Yggdrasil-compatible](https://minecraft.wiki/w/Yggdrasil) server.
 *
 * **Attention!** While Yggdrasil has been deprecated by Mojang/Microsoft, the API is maintained by
 * a community who wants to keep the protocol alive. Usage of a custom authentication server may or
 * may not violate Minecraft's Terms of Service: make sure to validate your player's Minecraft
 * ownership!
 */
export { YggdrasilAuth }

/**
 * Authenticate a user with [Azuriom](https://azuriom.com/).
 */
export { AzAuth }

/**
 * Authenticate a user with a crack account.
 * @deprecated This auth method is not secure, use it only for testing purposes or for local
 * servers!
 */
export { CrackAuth }

/**
 * Manage the player's skin, avatar and cape.
 */
export { Skin }

/**
 * @deprecated Use `Bootstrap` instead.
 */
export { Bootstrap as Bootstraps }

/**
 * Update your Launcher.
 *
 * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
 */
export { Bootstrap }

/**
 * Manage the Maintenance of the Launcher.
 *
 * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
 */
export { Maintenance }

/**
 * Manage the News of the Launcher.
 *
 * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
 */
export { News }

/**
 * Manage the background of the Launcher.
 *
 * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
 */
export { Background }

/**
 * Get the profiles from the EML AdminTool.
 *
 * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
 */
export { Profiles }

/**
 * Get the status of a Minecraft server.
 */
export { ServerStatus }

/**
 * Download Java for Minecraft.
 *
 * You should not use this class if you launch Minecraft with `java.install: 'auto'` in
 * the configuration.
 */
export { Java }

/**
 * Launch Minecraft.
 */
export { Launcher }

/**
 * Send stats about the Launcher to EML AdminTool. Ensure to initialize this class only **once**
 * in your Launcher. Don't forget to call the `initialize` method.
 *
 * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
 *
 * ---
 *
 * Note for European users:
 *
 * This class is compliant with the [GDPR](https://gdpr-info.eu/), and does not send any
 * personally identifiable information to EML. However, it does send some anonymous usage
 * statistics to help you improve your Launcher.
 */
export { Stats }

/**
 * ## Electron Minecraft Launcher Lib
 * ### A Node.js library to build your Minecraft launcher easily with Electron.
 *
 * ---
 *
 * **Requirements:**
 * - Node.js 18 or higher: see [Node.js](https://nodejs.org/);
 * - Electron 20 or higher _if you use Microsoft Authentication_: please install it with
 * `npm i electron`.
 *
 * **Recommandations:**
 * - Always use this library from the `main` process of Electron, and forward events to the
 * `renderer` process using IPC if needed.
 * - To get all the capacities of this Node.js library, you should set up your
 * [EML AdminTool](https://emlproject.com/docs/eml-admintool/system-requirements) instance!
 * - If you don't want to set up EML AdminTool, you can use our [modpack generator](https://emlproject.pages.dev/resources/modpack-json-generator/)
 * to generate an EML Lib-compatible modpack.
 *
 * ---
 *
 * Basic usage example:
 * ```ts
 * import { app, BrowserWindow } from 'electron'
 * import { MicrosoftAuth, Launcher } from 'eml-lib'
 *
 * app.whenReady().then(start)
 *
 * async function start() {
 *   const mainWindow = new BrowserWindow()
 *
 *   // 1. Authenticate
 *   const account = await (new MicrosoftAuth(mainWindow)).auth()
 *
 *   // 2. Setup launcher
 *   const launcher = new Launcher({
 *     url: 'https://at.emlproject.com',
 *     root: 'goldfrite',
 *     account: account,
 *     memory: { min: 2048, max: 1024 },
 *   })
 *
 *   // 3. Launch
 *   await launcher.launch()
 * }
 * ```
 *
 * ---
 *
 * [EML Website](https://emlproject.com/) —
 * [Docs](https://emlproject.com/docs/eml-lib-and-launcher/getting-started/set-up-environment) —
 * [GitHub](https://github.com/Electron-Minecraft-Launcher/EML-Lib) —
 * [NPM](https://www.npmjs.com/package/eml-lib)
 *
 * ---
 *
 * @version 2.3.7
 * @license MIT — See the `LICENSE` file for more information
 * @copyright Copyright (c) 2026, GoldFrite and contributors
 */
const EMLLib = {
  /**
   * Authenticate a user with Microsoft.
   *
   * **Attention!** Using this class requires Electron. Use `npm i electron` to install it.
   */
  MicrosoftAuth,

  /**
   * Authenticate a user with an [Yggdrasil-compatible](https://minecraft.wiki/w/Yggdrasil) server.
   *
   * **Attention!** While Yggdrasil has been deprecated by Mojang/Microsoft, the API is maintained
   * by a community who wants to keep the protocol alive. Usage of a custom authentication server
   * may or may not violate Minecraft's Terms of Service: make sure to validate your player's
   * Minecraft ownership!
   */
  YggdrasilAuth,

  /**
   * Authenticate a user with [Azuriom](https://azuriom.com/).
   */
  AzAuth,

  /**
   * Authenticate a user with a crack account.
   * @deprecated This auth method is not secure, use it only for testing purposes or for local
   * servers!
   */
  CrackAuth,

  /**
   * Manage the player's skin, avatar and cape.
   */
  Skin,

  /**
   * @deprecated Use `Bootstrap` instead.
   */
  Bootstraps: Bootstrap,

  /**
   * Update your Launcher.
   *
   * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
   */
  Bootstrap,

  /**
   * Manage the Maintenance of the Launcher.
   *
   * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
   */
  Maintenance,

  /**
   * Manage the News of the Launcher.
   *
   * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
   */
  News,

  /**
   * Manage the background of the Launcher.
   *
   * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
   */
  Background,

  /**
   * Get the profiles from the EML AdminTool.
   *
   * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
   */
  Profiles,

  /**
   * Get the status of a Minecraft server.
   */
  ServerStatus,

  /**
   * Download Java for Minecraft.
   *
   * You should not use this class if you launch Minecraft with `java.install: 'auto'` in the
   * configuration.
   */
  Java,

  /**
   * Launch Minecraft.
   */
  Launcher,

  /**
   * Send stats about the Launcher to EML AdminTool. Ensure to initialize this class only **once**
   * in your Launcher. Don't forget to call the `initialize` method.
   *
   * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
   *
   * ---
   *
   * Note for European users:
   *
   * This class is compliant with the [GDPR](https://gdpr-info.eu/), and does not send any
   * personally identifiable information to EML. However, it does send some anonymous usage
   * statistics to help you improve your Launcher.
   */
  Stats
} as EMLLib

export default EMLLib
