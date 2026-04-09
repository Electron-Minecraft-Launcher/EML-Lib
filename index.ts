/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import MicrosoftAuth from './lib/auth/microsoft.js'
import AzAuth from './lib/auth/azuriom.js'
import CrackAuth from './lib/auth/crack.js'
import YggdrasilAuth from './lib/auth/yggdrasil.js'
import Bootstraps from './lib/bootstraps/bootstraps.js'
import Maintenance from './lib/maintenance/maintenance.js'
import News from './lib/news/news.js'
import Background from './lib/background/background.js'
import ServerStatus from './lib/serverstatus/serverstatus.js'
import Java from './lib/java/java.js'
import Launcher from './lib/launcher/launcher.js'
import Profiles from './lib/profiles/profiles.js'

type EMLLib = {
  MicrosoftAuth: typeof MicrosoftAuth
  AzAuth: typeof AzAuth
  CrackAuth: typeof CrackAuth
  YggdrasilAuth: typeof YggdrasilAuth
  Bootstraps: typeof Bootstraps
  Maintenance: typeof Maintenance
  News: typeof News
  Background: typeof Background
  Profiles: typeof Profiles
  ServerStatus: typeof ServerStatus
  Java: typeof Java
  Launcher: typeof Launcher
}

export type * from './types/account.js'
export type * from './types/background.js'
export type * from './types/bootstraps.js'
export type * from './types/config.js'
export type * from './types/errors.js'
export type * from './types/events.js'
export type * from './types/file.js'
export type * from './types/maintenance.js'
export type * from './types/manifest.js'
export type * from './types/news.js'
export type * from './types/profile.js'
export type * from './types/status.js'

/**
 * Authenticate a user with Microsoft.
 *
 * **Attention!** Using this class requires Electron. Use `npm i electron` to install it.
 */
export { MicrosoftAuth }

/**
 * Authenticate a user with [Azuriom](https://azuriom.com/).
 */
export { AzAuth }

/**
 * Authenticate a user with an [Yggdrasil-compatible](https://minecraft.wiki/w/Yggdrasil) server.
 * 
 * **Attention!** While Yggdrasil has been deprecated by Mojang/Microsoft, the API is maintained by a community 
 * who wants to keep the protocol alive. Usage of a custom authentication server may or may not violate 
 * Minecraft's Terms of Service: make sure to validate your player's Minecraft ownership!
 */
export { YggdrasilAuth }

/**
 * Authenticate a user with a crack account.
 * @deprecated This auth method is not secure, use it only for testing purposes or for local servers!
 */
export { CrackAuth }

/**
 * Update your Launcher.
 *
 * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
 * @workInProgress
 */
export { Bootstraps }

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
 * ## Electron Minecraft Launcher Lib
 * ### Create your Electron Minecraft Launcher easily.
 *
 * ---
 *
 * **Requirements:**
 * - Node.js 15.14.0 or higher: see [Node.js](https://nodejs.org/);
 * - Electron 15.0.0 or higher: please install it with `npm i electron` _if you use
 * Microsoft Authentication_.
 *
 * **Recommandations:**
 * - To get all the capacities of this Node.js library, you must set up your
 * [EML AdminTool](https://github.com/Electron-Minecraft-Launcher/EML-AdminTool) website!
 * - If you don't want to set up EML AdminTool, you can use our [modpack generator](https://emlproject.pages.dev/resources/modpack-generator/) 
 * to generate an EML Lib-compatible modpack.
 *
 * ---
 *
 * [Docs](https://emlproject.pages.dev/docs/set-up-environment) —
 * [GitHub](https://github.com/Electron-Minecraft-Launcher/EML-Lib) —
 * [NPM](https://www.npmjs.com/package/eml-lib) —
 * [EML Website](https://electron-minecraft-launcher.ml)
 *
 * ---
 *
 * @version 2.2.0
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
   * Authenticate a user with [Azuriom](https://azuriom.com/).
   */
  AzAuth,

  /**
    * Authenticate a user with an [Yggdrasil-compatible](https://minecraft.wiki/w/Yggdrasil) server.
 * 
 * **Attention!** While Yggdrasil has been deprecated by Mojang/Microsoft, the API is maintained by a community 
 * who wants to keep the protocol alive. Usage of a custom authentication server may or may not violate 
 * Minecraft's Terms of Service: make sure to validate your player's Minecraft ownership!
   */
  YggdrasilAuth,

  /**
   * Authenticate a user with a crack account.
   * @deprecated This auth method is not secure, use it only for testing purposes or for local servers!
   */
  CrackAuth,

  /**
   * Update your Launcher.
   *
   * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
   */
  Bootstraps,

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
   * You should not use this class if you launch Minecraft with `java.install: 'auto'` in
   * the configuration.
   */
  Java,

  /**
   * Launch Minecraft.
   */
  Launcher
} as EMLLib


export default EMLLib