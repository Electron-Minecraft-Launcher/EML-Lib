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
