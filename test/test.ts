import EMLLib from '../index'
import { app, BrowserWindow } from 'electron'

async function main() {
  app.whenReady().then(async () => {
    const mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    })

    mainWindow.loadURL('data:text/html,<h1>EMLLib Test</h1><p>Check the console for output.</p>')

    const msAuth = new EMLLib.MicrosoftAuth(mainWindow)
    try {
      const account = await msAuth.auth()
      console.log('Authenticated account:', account)
    } catch (err) {
      console.error('Authentication error:', err)
    }

    app.quit()
  })
}

async function _main() {
  const launcher = new EMLLib.Launcher({
    url: 'http://localhost:5173',
    serverId: 'goldfrite',
    account: new EMLLib.CrackAuth().auth('GoldFrite'),
    cleaning: {
      clean: true
    }
  })

  try {
    launcher.on('launch_compute_download', () => console.log('\nComputing download...'))

    launcher.on('launch_download', (download) => console.log(`\nDownloading ${download.total.amount} files (${download.total.size} B).`))
    // launcher.on('download_progress', (progress) => console.log(progress.type, `=> Downloaded ${progress.downloaded.size} / ${progress.total.size} B`))
    launcher.on('download_error', (error) => console.error(error.type, `=> Error downloading ${error.filename}: ${error.message}`))
    launcher.on('download_end', (info) => console.log(`Downloaded ${info.downloaded.amount} files.`))

    launcher.on('launch_install_loader', (loader) => console.log(`\nInstalling loader ${loader.type} ${loader.loaderVersion}...`))

    launcher.on('launch_extract_natives', () => console.log('\nExtracting natives...'))
    launcher.on('extract_progress', (progress) => console.log(`Extracted ${progress.filename}.`))
    launcher.on('extract_end', (info) => console.log(`Extracted ${info.amount} files.`))

    launcher.on('launch_copy_assets', () => console.log('\nCopying assets...'))
    launcher.on('copy_progress', (progress) => console.log(`Copyed ${progress.filename} to ${progress.dest}.`))
    launcher.on('copy_end', (info) => console.log(`Copied ${info.amount} files.`))

    launcher.on('launch_patch_loader', () => console.log('\nPatching loader...'))
    launcher.on('patch_progress', (progress) => console.log(`Patched ${progress.filename}.`))
    launcher.on('patch_error', (error) => console.error(`Error patching ${error.filename}: ${error.message}`))
    launcher.on('patch_end', (info) => console.log(`Patched ${info.amount} files.`))

    launcher.on('launch_check_java', () => console.log('\nChecking Java...'))
    launcher.on('java_info', (info) => console.log(`Using Java ${info.version} ${info.arch}`))

    launcher.on('launch_clean', () => console.log('\nCleaning game directory...'))
    launcher.on('clean_progress', (progress) => console.log(`Cleaned ${progress.filename}.`))
    launcher.on('clean_end', (info) => console.log(`Cleaned ${info.amount} files.`))

    launcher.on('launch_launch', (info) =>
      console.log(`\nLaunching Minecraft ${info.version} (${info.type}${info.loaderVersion ? ` ${info.loaderVersion}` : ''})...`)
    )
    launcher.on('launch_data', (message) => console.log(message))
    launcher.on('launch_close', (code) => console.log(`Closed with code ${code}.`))

    // launcher.on('launch_debug', (message) => console.log(`Debug: ${message}\n`))
    // launcher.on('patch_debug', (message) => console.log(`Debug: ${message}`))

    await launcher.launch()
  } catch (error) {
    console.error('err', error)
  }
}

_main()

