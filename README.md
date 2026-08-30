# EML Lib

**Electron Minecraft Launcher Lib (EML Lib) is a Node.js library. It permits to authenticate, download Java and Minecraft and launch Minecraft.**

[<img src="https://img.shields.io/badge/Discord-EML-5561e6?&style=for-the-badge">](https://emlproject.com/discord/github)
[<img src="https://img.shields.io/badge/platforms-Windows%2C%20macOS%2C%20Linux-0077DA?style=for-the-badge&color=0077DA">](#platforms)
[<img src="https://img.shields.io/badge/version-2.7.3-orangered?style=for-the-badge&color=orangered">](package.json)

<p>
<center>
<a href="https://emlproject.com/discord/github">
  <img src="./.github/assets/gg.png" alt="EML AdminTool Logo" width="300"/>
</a>
</center>
</p>

---

## Features

### Authentication

EML Lib supports multiple authentication methods, including Microsoft, Azuriom, Yggdrasil and Crack. This allows you to choose the authentication method that best suits your needs and preferences.

_Read the docs for [MicrosoftAuth](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/microsoftauth), [YggdrasilAuth](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/yggdrasilauth), [AzAuth](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/azuriomauth) and [CrackAuth](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/crackauth)._

### Launching Minecraft

Choose the Minecraft version and loader that you want to launch. EML Lib supports all Minecraft versions, from Minecraft beta [^1] to the latest Minecraft snapshot, and all loaders: Vanilla, Forge, NeoForge, Fabric and Quilt, and even custom loaders.<br/>
EML Lib also allows you to use _Profiles_, which are sets of settings (such as Minecraft version, loader, mods, etc.) that you can save and reuse later.

EML Lib can automatically download and install Java to ensure that you have the correct Java version for the Minecraft version you want to launch. It also supports custom Java paths if you prefer to use your own Java installation.

To use all the capacities of EML Lib, you should set up your [EML AdminTool](https://github.com/Electron-Minecraft-Launcher/EML-AdminTool) website. It will allow you to use features such as news, bootstraps, maintenance, background, and more.

_Read the docs for [Profiles](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/profiles), [Launcher](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/launcher) and [Java](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/java)._

### Skin and cape management

EML Lib can allow your players to manage their skins and capes. It supports the official Microsoft skin and cape system, as well as custom skins and capes. Players can change their skins and capes directly from the launcher.

_Read the [docs](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/skin)._

### Bootstrap [^2]

_Bootstrap_ is a powerful feature that allows you to auto-update your launcher. It checks for updates on a specified URL and downloads and installs them automatically. This ensures that your launcher is always up to date with the latest features and bug fixes.

_Read the [docs](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/bootstrap)._

### Maintenance mode [^2]

_Maintenance_ mode is a feature that allows you to block the launcher during maintenance. When maintenance mode is enabled, users will see a message indicating that the launcher is under maintenance and will not be able to launch Minecraft until the maintenance is complete.

_Read the [docs](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/maintenance)._

### Customization [^2]

EML Lib allows you to customize the launcher with various features, including:

- **News**: Displaying news on the launcher.
- **Background**: Displaying a background image on the launcher.
- **Server status**: Displaying server information on the launcher.

_Read the docs for [News](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/news), [Background](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/background) and [ServerStatus](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/serverstatus)._

### Stats [^2]

_Stats_ is a feature that allows you to collect and send anonymized usage statistics to EML AdminTool. This helps you understand how users are interacting with your launcher and can help you improve the user experience.

_Read the [docs](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/stats)._

### Crash Reports [^2]

_Crash Reports_ is a feature that allows you to collect and send crash reports to EML AdminTool. This helps you understand what went wrong when the launcher crashes and can help you fix the issues.

_Read the [docs](https://emlproject.com/docs/eml-lib-and-launcher/api-reference/crash-reports)._

## Comparison with other solutions

There are already several Node.js libraries to launch Minecraft. Here is how EML Lib compares to the main ones.

| Solution                         | Language / License       | Actively maintained     | Auth                                 | Loaders                                         | Ecosystem                                 |
| -------------------------------- | ------------------------ | ----------------------- | ------------------------------------ | ----------------------------------------------- | ----------------------------------------- |
| **EML Lib**                      | TypeScript / MIT         | Yes                     | Microsoft, Azuriom, Yggdrasil, Crack | Vanilla, Forge, NeoForge, Fabric, Quilt, Custom | EML AdminTool, EML Template               |
| **MCLC** (Pierce01)              | JavaScript / MIT         | No (last release: 2023) | Via MSMC (external)                  | Forge only                                      | None                                      |
| **minecraft-java-core** (Luuxis) | TypeScript / Custom [^3] | Yes                     | Microsoft, Azuriom, Crack            | Vanilla, Forge, NeoForge, Fabric, Quilt, Custom | LuuxCraft Panel (paid), Selvania Launcher |
| **GMLL** (Hanro50)               | TypeScript / MIT         | No (last release: 2023) | Via MSMC (external)                  | Forge, Fabric, Quilt                            | None                                      |
| **@xmcl packages** (Voxelum)     | TypeScript / MIT         | Yes                     | — (low-level toolkit)                | All                                             | XMCL launcher                             |

### Key difference

Most existing libraries focus on _launching_ Minecraft. EML Lib focuses on _guaranteeing that every player runs exactly the expected environment_ — from authentication to file integrity, Java installation, and modpack distribution.

This is especially useful for:

- private servers that distribute a specific modpack,
- heavily modded servers where client drift causes issues,
- controlled environments where manual client edits are not acceptable.

If you do not need a backend, use agnostic mode with a [hosted JSON modpack file](https://emlproject.com/resources/modpack-json-generator). If you want a full administration dashboard, pair EML Lib with [EML AdminTool](https://github.com/Electron-Minecraft-Launcher/EML-AdminTool).

## Runtime environments & Architecture

EML Lib runs in **Node.js (`>= 18`)**. It is primarily built to power **Electron** desktop applications, but it can also be used in **standalone Node.js** (CLI tools, automation scripts, server bots) with minor limitations.

| Feature                                       |                 Standalone Node.js                 | Electron (`main` process) | Browser / Renderer |
| --------------------------------------------- | :------------------------------------------------: | :-----------------------: | :----------------: |
| **Azuriom, Yggdrasil & Crack authentication** |                         ✅                         |            ✅             |         ✅         |
| **Microsoft authentication**                  |           ❌<br />_(requires Electron)_            |            ✅             |         ❌         |
| **Launching Minecraft**                       |                         ✅                         |            ✅             |         ❌         |
| **Skin and cape management**                  |                         ✅                         |            ✅             |         ✅         |
| **Bootstrap**                                 | ❌<br />_(requires Electron and electron-updater)_ |            ✅             |         ❌         |
| **Maintenance mode**                          |                         ✅                         |            ✅             |         ✅         |
| **News**                                      |                         ✅                         |            ✅             |         ✅         |
| **Background**                                |                         ✅                         |            ✅             |         ✅         |
| **Server status**                             |                         ✅                         |            ✅             |         ❌         |
| **Stats**                                     |                         ✅                         |            ✅             |         ✅         |
| **Crash report**                              |                         ✅                         |            ✅             |         ❌         |

> [!IMPORTANT]
> **Best Practice for Electron apps:** Always instantiate EML Lib in the **Electron Main Process** (Node.js context) and bridge actions/events to your Renderer (UI) via standard IPC (`ipcMain` / `ipcRenderer`). Do not attempt to run the core launcher inside the frontend renderer.

## Installation

### Software requirements

- **Node.js** (`>= 18.0.0`): required for development and build.
- **Operating systems (development and build)**:
  - Windows 10 or 11;
  - macOS 10.15 (Catalina) or higher;
  - Linux with `glibc >= 2.28` (e.g. Ubuntu 20.04+, Debian 10+).
- **Target operating systems (end-user runtime)**:
  - Windows 7 or higher (when packaged with Electron 21/22);
  - macOS 10.13 or higher (when packaged with Electron 21/22);
  - Linux 64-bit (`glibc >= 2.28`).
- **Optional peer dependencies**: (see [above](#runtime-environments--architecture) for details)
  - `electron` (`>= 21.0.0`);
  - `electron-updater` (`>= 6.0.0`).

To get all the capacities of this Node.js library, you should set up your [EML AdminTool](https://github.com/Electron-Minecraft-Launcher/EML-AdminTool) website! Without it, some features will be unavailable (such as News, Bootstrap, etc.).

### EML Lib installation

```bash
# Core library
npm i eml-lib

# Optional peer dependencies for full Electron support
npm i electron electron-updater
```

`eml-lib` is written in TypeScript and exports its types natively.

### Template

You can use [EML Template](https://github.com/Electron-Minecraft-Launcher/EML-Template) to create a Minecraft launcher with EML Lib. It is an Electron application that uses EML Lib to launch Minecraft. It is a good starting point to create your own Minecraft launcher.

### Quick start

Quick start using [EML AdminTool](https://github.com/Electron-Minecraft-Launcher/EML-AdminTool):

```js
import EMLLib from 'eml-lib'

const launcher = new EMLLib.Launcher({
  url: 'https://at.emlproject.com', // Your EML AdminTool URL
  root: 'my-server',
  account: new EMLLib.CrackAuth().auth('GoldFrite')
})

await launcher.launch()
```

Please refer to the [docs](https://emlproject.com/docs/eml-lib-and-launcher/getting-started/set-up-environment) for more information.

## Platform compatibility

| OS and Architecture | Supported?         | Minimum version supported |
| ------------------- | ------------------ | ------------------------- |
| Windows x64         | Yes                | Windows 7                 |
| Windows arm64       | Yes                | Windows 10                |
| macOS x64           | Yes                | macOS Catalina (10.15)    |
| macOS arm64         | Yes                | macOS Big Sur (11)        |
| Linux x64           | Probably yes       | —                         |
| Linux arm64         | Probably partially | —                         |

<sup>- _Yes_ means that the library has been tested and is known to work on this platform at least for Minecraft 1.6 and above (Vanilla and modded).</sup><br />
<sup>- _Probably yes_ means that the library has not been tested on this platform, but it is expected to work for Minecraft 1.6 and above (Vanilla and modded), since the Minecraft manifests are complete for this platform.</sup><br />
<sup>- _Probably partially_ means that the library has not been tested on this platform, and it is expected to work only for some Minecraft versions (Vanilla or modded), since the Minecraft manifests are not fully complete for this platform.</sup>

</small>

> [!WARNING]
> No support will be provided for any other OS or architecture.

<details>
<summary><b>Note about the ARM architecture</b></summary>
<br>

Historically, Minecraft was developed for x86 architectures (32-bit and 64-bit), including:

- Windows PCs with Intel or AMD processors;
- Macs with Intel processors;
- x86 Linux distributions.

Since 2020, the ARM architecture has become more widespread with Apple Silicon chips (M1, M2, etc.) and Windows 11 ARM laptops. Since the game was not initially compatible, Apple and Microsoft have integrated virtualization/emulation layers (Rosetta 2 for macOS, Prism/native emulation for Windows). While this simplifies things for developers, it comes at the expense of user performance. Furthermore, Rosetta can sometimes be finicky with very old versions of Minecraft (1.12.2 and earlier), forcing launchers to resort to workarounds.

In 2022, Minecraft finally became available on ARM architecture with the release of version 1.19, enabling a native, high-performance experience. However, given the evolution of operating systems and Apple's announced phased-out support for Rosetta 2 for general applications, launchers must ensure continued access to older versions of the game. This is where EML Lib comes in: the library meticulously corrects and updates every obsolete file in a completely transparent manner.
Thanks to a system of smart patches, EML Lib allows Minecraft to run natively on all Macs (Intel and Apple Silicon), from version 1.6 to the latest! A few trade-offs remain, such as minor bugs when resizing the window or incompatibilities with certain older, unupdated mods.

As for Windows 11 ARM, EML Lib has made the strategic choice to rely on the built-in x64 emulation for older versions. Extremely efficient on Windows, this approach guarantees maximum stability and full compatibility with the mod ecosystem.

##

</details>

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to this project.

## Important information

- This is not an official library from Mojang Studios, Microsoft, Electron or Node.js. _Minecraft_ is a trademark of Mojang Studios.
- This Node.js library is under the `MIT` license; to get more information, please read the file `LICENSE`. It is legally obligatory to respect this license.
- If you need some help, you can join [this Discord](https://emlproject.com/discord/github).

<br/>

[^1]: Depends on the OS and the architecture. ARM architectures (such as Apple Silicon) only supports Minecraft 1.6 and above. See the [Platform compatibility](#platform-compatibility) section for more information.

[^2]: These features require the use of the [EML AdminTool](https://github.com/Electron-Minecraft-Launcher/EML-AdminTool)

[^3]: `minecraft-java-core` is distributed under a custom restrictive license. Commercial use by third parties and closed-source derivatives are prohibited. Read the LICENSE file carefully before adopting it.

