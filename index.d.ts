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
 * [EML AdminTool `v2.0.0--beta.4`](https://github.com/Electron-Minecraft-Launcher/EML-AdminTool-v2) website!
 * - If you don't want to use the EML AdminTool, you should rather use the
 * [Minecraft Launcher Core](https://npmjs.com/package/minecraft-launcher-core) library.
 *
 * ---
 * 
 * [Wiki](https://github.com/Electron-Minecraft-Launcher/EML-Lib/wiki) —
 * [GitHub](https://github.com/Electron-Minecraft-Launcher/EML-Lib-v2) —
 * [NPM](https://www.npmjs.com/package/eml-lib) —
 * [EML Website](https://electron-minecraft-launcher.ml)
 *
 * ---
 *
 * @version 2.0.0-beta.4
 * @license MIT — See the `LICENSE` file for more information
 * @copyright Copyright (c) 2024, GoldFrite
 */

declare namespace EMLLib {
  export { MicrosoftAuth, AzAuth, CrackAuth, Bootstraps, Maintenance, News, Background, ServerStatus, Java, Launcher }
}

export { default as MicrosoftAuth } from './lib/auth/microsoft'
export { default as AzAuth } from './lib/auth/azuriom'
export { default as CrackAuth } from './lib/auth/crack'
export { default as Bootstrap } from './lib/bootstraps/bootstraps'
export { default as Maintenance } from './lib/maintenance/maintenance'
export { default as News } from './lib/news/news'
export { default as Background } from './lib/background/background'
export { default as ServerStatus } from './lib/serverstatus/serverstatus'
export { default as Java } from './lib/java/java'
export { default as Launcher } from './lib/launcher/launcher'
export default EMLLib
