class PNG {
  async decodeSkin(buffer: Uint8Array): Promise<{ width: number; height: number; data: Uint8Array }> {
    let offset = 8
    let width = 0
    let height = 0
    const idatChunks: Uint8Array[] = []
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

    while (offset < buffer.length) {
      const length = view.getUint32(offset)
      const type = String.fromCharCode(...buffer.subarray(offset + 4, offset + 8))

      if (type === 'IHDR') {
        width = view.getUint32(offset + 8)
        height = view.getUint32(offset + 12)
      } else if (type === 'IDAT') {
        idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length))
      } else if (type === 'IEND') {
        break
      }
      offset += 12 + length
    }

    const totalIdat = new Uint8Array(idatChunks.reduce((acc, c) => acc + c.length, 0))
    let cur = 0
    for (const chunk of idatChunks) {
      totalIdat.set(chunk, cur)
      cur += chunk.length
    }

    const uncompressed = await this.inflate(totalIdat)
    const rawRgba = new Uint8Array(width * height * 4)
    const stride = width * 4
    let srcPos = 0

    for (let y = 0; y < height; y++) {
      const filterType = uncompressed[srcPos++]
      const lineStart = y * stride

      for (let x = 0; x < stride; x++) {
        const val = uncompressed[srcPos++]
        const a = x >= 4 ? rawRgba[lineStart + x - 4] : 0
        const b = y > 0 ? rawRgba[lineStart - stride + x] : 0
        const c = y > 0 && x >= 4 ? rawRgba[lineStart - stride + x - 4] : 0

        if (filterType === 0) rawRgba[lineStart + x] = val
        else if (filterType === 1) rawRgba[lineStart + x] = (val + a) & 0xff
        else if (filterType === 2) rawRgba[lineStart + x] = (val + b) & 0xff
        else if (filterType === 3) rawRgba[lineStart + x] = (val + Math.floor((a + b) / 2)) & 0xff
        else if (filterType === 4) {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          rawRgba[lineStart + x] = (val + pr) & 0xff
        }
      }
    }

    return { width, height, data: rawRgba }
  }

  async encodeRGBA(data: Uint8Array, width: number, height: number): Promise<Uint8Array> {
    const rawScanlines = new Uint8Array(height * (1 + width * 4))
    let srcIdx = 0
    let dstIdx = 0

    for (let y = 0; y < height; y++) {
      rawScanlines[dstIdx++] = 0
      for (let x = 0; x < width * 4; x++) {
        rawScanlines[dstIdx++] = data[srcIdx++]
      }
    }

    const compressed = await this.deflate(rawScanlines)

    const ihdr = new Uint8Array(13)
    const dv = new DataView(ihdr.buffer)
    dv.setUint32(0, width)
    dv.setUint32(4, height)
    ihdr[8] = 8
    ihdr[9] = 6

    const ihdrChunk = this.makeChunk('IHDR', ihdr)
    const idatChunk = this.makeChunk('IDAT', compressed)
    const iendChunk = this.makeChunk('IEND', new Uint8Array(0))

    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const result = new Uint8Array(8 + ihdrChunk.length + idatChunk.length + iendChunk.length)

    result.set(signature, 0)
    result.set(ihdrChunk, 8)
    result.set(idatChunk, 8 + ihdrChunk.length)
    result.set(iendChunk, 8 + ihdrChunk.length + idatChunk.length)

    return result
  }

  private async inflate(data: Uint8Array): Promise<Uint8Array> {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const zlib = await import('node:zlib')
      return new Uint8Array(zlib.inflateSync(data))
    }
    const ds = new (globalThis as any).DecompressionStream('deflate')
    const writer = ds.writable.getWriter()
    writer.write(data)
    writer.close()
    const buffer = await new Response(ds.readable).arrayBuffer()
    return new Uint8Array(buffer)
  }

  private async deflate(data: Uint8Array): Promise<Uint8Array> {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const zlib = await import('node:zlib')
      return new Uint8Array(zlib.deflateSync(data))
    }
    const cs = new (globalThis as any).CompressionStream('deflate')
    const writer = cs.writable.getWriter()
    writer.write(data)
    writer.close()
    const buffer = await new Response(cs.readable).arrayBuffer()
    return new Uint8Array(buffer)
  }

  private makeChunk(type: string, data: Uint8Array): Uint8Array {
    const chunk = new Uint8Array(12 + data.length)
    const dv = new DataView(chunk.buffer)
    dv.setUint32(0, data.length)
    for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i)
    chunk.set(data, 8)
    dv.setUint32(8 + data.length, this.crc32(chunk.subarray(4, 8 + data.length)))
    return chunk
  }

  private crc32(buf: Uint8Array): number {
    let crc = -1
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i]
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
      }
    }
    return (crc ^ -1) >>> 0
  }
}

export default new PNG()
