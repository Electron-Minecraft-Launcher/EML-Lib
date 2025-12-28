/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 * @copyright Copyright (c) 2020, Nick Krecklow
 */

import * as net from 'node:net'
import type { ServerStatus as ServerStatus_ } from '../../types/status'
import { EMLLibError, ErrorType } from '../../types/errors'
import BufferWriter from './bufferwriter'
import BufferReader from './bufferreader'

/**
 * Get the status of a Minecraft server.
 */
export default class ServerStatus {
  private readonly ip: string
  private readonly port: number
  private readonly protocol: 'modern' | '1.6' | '1.4-1.5' | 'Beta1.8-1.3'
  private readonly pvn: number
  private readonly timeout: number

  /**
   * **Attention!** This class may not work for some Minecraft servers (Minecraft 1.4 and below, or
   * servers with a specific configuration). If you encounter any problems, please [open an
   * issue](https://github.com/Electron-Minecraft-Launcher/EML-Lib-v2/issues).
   * @param ip Your Minecraft Server's IP or Host (eg. `'172.65.236.36'` or `'mc.hypixel.net'`).
   * @param port [Optional: default is `25565`] Your Minecraft Server's main port (eg. `25565`).
   * @param protocol [Optional: default is `'modern'`] The Minecraft protocol (eg. `'modern'`
   * for 13w41a/1.7 and above, `'1.6'` for from 13w16a/1.6 to 13w39b/1.6.4, and `'1.4-1.5'` for from
   * 12w32a/1.4 to 1.5.2).
   * @param pvn [Optional: default is `-1`] The Minecraft protocol version (eg. `754` for 1.16.4).
   * This parameter is optional, but it is recommended to use it for better compatibility. You can
   * find the protocol version of your Minecraft version [here](https://minecraft.wiki/w/Minecraft_Wiki:Projects/wiki.vg_merge/Protocol_version_numbers).
   * @param timeout [Optional: default is `5`] The timeout in seconds.
   */
  constructor(ip: string, port: number = 25565, protocol: 'modern' | '1.6' | '1.4-1.5' = 'modern', pvn: number = -1, timeout: number = 5) {
    this.ip = ip
    this.port = port
    this.protocol = protocol
    this.pvn = pvn
    this.timeout = timeout
  }

  /**
   * Get the status of the Minecraft server.
   * @returns The Server status.
   */
  async getStatus(): Promise<ServerStatus_> {
    return new Promise((resolve, reject) => {
      const bufWriter = new BufferWriter()
      const start = Date.now()
      let socket = net.createConnection(this.port, this.ip)
      socket.setNoDelay(true)

      const timeout = setTimeout(() => {
        reject(new EMLLibError(ErrorType.NET_ERROR, 'Connection timed out'))
      }, this.timeout * 1000)

      socket.on('connect', () => {
        if (this.protocol === 'modern') {
          const buf = bufWriter.concat([
            bufWriter.writeVarInt(0),
            bufWriter.writeVarInt(this.pvn),
            bufWriter.writeVarInt(this.ip.length),
            bufWriter.writeString(this.ip),
            bufWriter.writeUShort(this.port),
            bufWriter.writeVarInt(1)
          ])
          socket.write(buf)

          const req = bufWriter.concat([bufWriter.writeVarInt(0)])
          socket.write(req)
        } else if (this.protocol === '1.6') {
          const buf = Buffer.concat([
            bufWriter.writeByte(0xfe),
            bufWriter.writeByte(1),
            bufWriter.writeByte(0xfa),
            bufWriter.writeShort(11),
            bufWriter.writeStringUTF16BE('MC|PingHost'),
            bufWriter.writeShort(7 + 2 * this.ip.length),
            bufWriter.writeByte(this.pvn),
            bufWriter.writeShort(2 * this.ip.length),
            bufWriter.writeStringUTF16BE(this.ip),
            bufWriter.writeInt(this.port)
          ])
          socket.write(buf)
        } else if (this.protocol === '1.4-1.5') {
          const buf = Buffer.concat([bufWriter.writeByte(0xfe), bufWriter.writeByte(1)])
          socket.write(buf)
        } else {
          reject(new EMLLibError(ErrorType.NET_ERROR, 'Unsupported protocol version'))
        }
      })

      let incomingBuf = Buffer.alloc(0)

      socket.on('data', (data) => {
        const ping = Date.now() - start
        const chunk = typeof data === 'string' ? Buffer.from(data) : data
        incomingBuf = Buffer.concat([incomingBuf, chunk])

        if (incomingBuf.length < 5) {
          return
        }

        if (this.protocol === 'modern') {
          const bufReader = new BufferReader(incomingBuf)
          const length = bufReader.readVarInt()

          if (incomingBuf.length - bufReader.getOffset() < length) {
            return
          }

          if (bufReader.readVarInt() === 0) {
            try {
              const json = JSON.parse(bufReader.readString())
              resolve({
                ping: ping,
                version: json.version.name,
                motd:
                  typeof json.description === 'object' && json.description.text
                    ? json.description.text
                    : typeof json.description === 'string'
                      ? json.description
                      : '',
                players: { max: json.players.max, online: json.players.online }
              })
              socket.destroy()
              clearTimeout(timeout)
            } catch (err) {
              reject(new EMLLibError(ErrorType.NET_ERROR, `Received invalid response: ${err}`))
              socket.destroy()
              clearTimeout(timeout)
            }
          } else {
            reject(new EMLLibError(ErrorType.NET_ERROR, `Received unexpected packet`))
            socket.destroy()
            clearTimeout(timeout)
          }
        } else {
          if (incomingBuf.readUInt8(0) === 0xff) {
            const bufReader = new BufferReader(incomingBuf)
            const fields = bufReader.readStringUTF16BE().split('\u0000')

            if (fields[0] !== '§1') {
              reject(new EMLLibError(ErrorType.NET_ERROR, `Received invalid response: the first field is not '§1'`))
              socket.destroy()
              clearTimeout(timeout)
            }

            resolve({
              ping: ping,
              version: fields[2],
              motd: fields[3],
              players: { max: +fields[5], online: +fields[4] }
            })
            socket.destroy()
            clearTimeout(timeout)
          } else {
            reject(new EMLLibError(ErrorType.NET_ERROR, `Received invalid response: wrong packet identifier`))
            socket.destroy()
            clearTimeout(timeout)
          }
        }
      })

      socket.on('error', (err) => reject(new EMLLibError(ErrorType.NET_ERROR, err)))
    })
  }
}
