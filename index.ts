/**
 * @license MIT
 * @copyright Copyright (c) 2025, GoldFrite
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

export { MicrosoftAuth, AzAuth, CrackAuth, Bootstraps, Maintenance, News, Background, ServerStatus, Java, Launcher }

export default { MicrosoftAuth, AzAuth, CrackAuth, Bootstraps, Maintenance, News, Background, ServerStatus, Java, Launcher }

declare global {
  namespace EMLLib {
    export { MicrosoftAuth, AzAuth, CrackAuth, Bootstraps, Maintenance, News, Background, ServerStatus, Java, Launcher }
  }
}
