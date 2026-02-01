/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import MicrosoftAuth from './lib/auth/microsoft'
import AzAuth from './lib/auth/azuriom'
import CrackAuth from './lib/auth/crack'
import Bootstraps from './lib/bootstraps/bootstraps'
import Maintenance from './lib/maintenance/maintenance'
import News from './lib/news/news'
import Background from './lib/background/background'
import ServerStatus from './lib/serverstatus/serverstatus'
import Java from './lib/java/java'
import Launcher from './lib/launcher/launcher'

export type * from './types/account'
export type * from './types/background'
export type * from './types/bootstraps'
export type * from './types/config'
export type * from './types/errors'
export type * from './types/events'
export type * from './types/file'
export type * from './types/maintenance'
export type * from './types/manifest'
export type * from './types/news'
export type * from './types/status'

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
 * Authenticate a user with a crack account.
 * @deprecated This auth method is not secure, use it only for testing purposes or for local servers!
 */
export { CrackAuth }

/**
 * Update your Launcher.
 *
 * **Attention!** This class only works with the EML AdminTool. Please do not use it without the AdminTool.
 * @workInProgress
 */
export { Bootstraps }

/**
 * Manage the Maintenance of the Launcher.
 *
 * **Attention!** This class only works with the EML AdminTool. Please do not use it without the AdminTool.
 */
export { Maintenance }

/**
 * Manage the News of the Launcher.
 *
 * **Attention!** This class only works with the EML AdminTool. Please do not use it without the AdminTool.
 */
export { News }

/**
 * Manage the background of the Launcher.
 *
 * **Attention!** This class only works with the EML AdminTool. Please do not use it without the AdminTool.
 */
export { Background }

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
 * @workInProgress
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
 * - If you don't want to use the EML AdminTool, you should rather use the
 * [Minecraft Launcher Core](https://npmjs.com/package/minecraft-launcher-core) library.
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
 * @version 2.0.0-beta.20
 * @license MIT — See the `LICENSE` file for more information
 * @copyright Copyright (c) 2026, GoldFrite
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
   * Authenticate a user with a crack account.
   * @deprecated This auth method is not secure, use it only for testing purposes or for local servers!
   */
  CrackAuth,

  /**
   * Update your Launcher.
   *
   * **Attention!** This class only works with the EML AdminTool. Please do not use it without the AdminTool.
   * @workInProgress
   */
  Bootstraps,

  /**
   * Manage the Maintenance of the Launcher.
   *
   * **Attention!** This class only works with the EML AdminTool. Please do not use it without the AdminTool.
   */
  Maintenance,

  /**
   * Manage the News of the Launcher.
   *
   * **Attention!** This class only works with the EML AdminTool. Please do not use it without the AdminTool.
   */
  News,

  /**
   * Manage the background of the Launcher.
   *
   * **Attention!** This class only works with the EML AdminTool. Please do not use it without the AdminTool.
   */
  Background,

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
   * @workInProgress
   */
  Launcher
}

export default EMLLib