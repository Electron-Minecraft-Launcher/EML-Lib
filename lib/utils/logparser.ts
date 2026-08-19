class LogParser {
  private buffer = ''

  public parse(chunk: string): string[] {
    this.buffer += chunk
    const lines: string[] = []

    const eventRegex =
      /<log4j:Event logger="([^"]+)" timestamp="([^"]+)" level="([^"]+)" thread="([^"]+)">.*?<log4j:Message><!\[CDATA\[(.*?)\]\]><\/log4j:Message>(.*?)<\/log4j:Event>/gs

    let match
    let lastIndex = 0

    while ((match = eventRegex.exec(this.buffer)) !== null) {
      const rawPrefix = this.buffer.substring(lastIndex, match.index).trim()
      if (rawPrefix && !rawPrefix.startsWith('<')) {
        lines.push(rawPrefix)
      }

      const [_, logger, timestamp, level, thread, message, rest] = match

      let throwable = ''
      const throwableMatch = /<log4j:Throwable><!\[CDATA\[(.*?)\]\]><\/log4j:Throwable>/s.exec(rest)
      if (throwableMatch) throwable = `\n${throwableMatch[1].trim()}`

      const color = this.getColor(level)
      const reset = color ? '\x1b[0m' : ''
      const time = new Date(parseInt(timestamp)).toLocaleTimeString('fr-FR')

      lines.push(`${color}[${time}] [${thread}/${level}] [${logger}]: ${message.trim()}${throwable}${reset}`)
      lastIndex = eventRegex.lastIndex
    }

    this.buffer = this.buffer.substring(lastIndex)
    return lines
  }

  private getColor(level: string): string {
    switch (level) {
      case 'WARN':
        return '\x1b[33m'
      case 'ERROR':
      case 'FATAL':
        return '\x1b[31m'
      case 'DEBUG':
      case 'TRACE':
        return '\x1b[36m'
      default:
        return ''
    }
  }
}

export default new LogParser()

