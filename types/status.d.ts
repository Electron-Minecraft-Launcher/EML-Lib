export interface IServerStatus {
  /**
   * The ping of the server, in ms.
   */
  ping: number
  /**
   * The Minecraft version of the server. Note that the version format could be unusual if your server
   * is modded (such as `'1.16.5-Forge-36.1.0'`), has plugins, is a snapshot/pre-release version (such
   * as `'20w45a'`), or accepts multiple client versions (such as `1.8.x-1.16.x` or
   * `'Requires MC 1.8 / 1.21'`).
   */
  version: string
  /**
   * The MOTD of the server.
   *
   * **Attention**:
   * - The MOTD may contain formatting codes (such as `§6` for gold color). You can use a library
   * like [@sfirew/minecraft-motd-parser](https://www.npmjs.com/package/@sfirew/minecraft-motd-parser) 
   * to parse them.
   * - The MOTD may be incomplete or incorrect for some servers, especially modded servers. This is
   * because the server may use a custom MOTD format that is not compatible with the standard format
   * used by EML-Lib. If you encounter any problems, please [open an issue](https://github.com/Electron-Minecraft-Launcher/EML-Lib/issues)
   * and provide the server IP and port.
   */
  motd: string
  players: {
    /**
     * The maximum number of players that can join the server.
     */
    max: number
    /**
     * The number of players currently online.
     */
    online: number
  }
}
