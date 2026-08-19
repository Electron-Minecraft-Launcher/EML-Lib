export interface MinecraftManifest {
  arguments?: {
    game: (string | Argument)[]
    jvm: (string | Argument)[]
  }
  assetIndex: {
    id: string
    sha1: string
    size: number
    totalSize: number
    url: string
  }
  assets: string
  complianceLevel: number
  downloads: {
    client: {
      sha1: string
      size: number
      url: string
    }
    client_mappings?: {
      sha1: string
      size: number
      url: string
    }
    server: {
      sha1: string
      size: number
      url: string
    }
    server_mappings?: {
      sha1: string
      size: number
      url: string
    }
  }
  id: string
  javaVersion?: {
    component: string
    majorVersion: number
  }
  libraries: {
    downloads: {
      artifact?: Artifact
      classifiers?: {
        'natives-linux'?: Artifact
        'natives-osx'?: Artifact
        'natives-windows'?: Artifact
        'natives-windows-32'?: Artifact
        'native-windows-64'?: Artifact
      }
    }
    extract?: { exclude: string[] }
    name?: string
    natives?: { windows?: string; osx?: string; linux?: string }
    rules: { action: 'allow' | 'disallow'; os?: { name: 'windows' | 'osx' | 'linux' } }[]
    /**
     * Old Forge or Fabric/Quilt.
     */
    url?: string
    /**
     * Old Forge or Fabric/Quilt.
     */
    size?: number
    /**
     * Old Forge or Fabric/Quilt.
     */
    sha1?: string
    /**
     * Old Forge or Fabric/Quilt.
     */
    clientreq?: boolean
    /**
     * Old Forge or Fabric/Quilt.
     */
    serverreq?: boolean,
    /**
     * Old Forge.
     */
    checksums?: string[]
  }[]
  logging: {
    client: {
      argument: string
      file: {
        id: string
        sha1: string
        size: number
        url: string
      }
      type: string
    }
  }
  mainClass: string
  minecraftArguments?: string
  minimumLauncherVersion: number
  releaseTime: string
  time: string
  type: string
  processArguments?: string
}

export interface Artifact {
  path?: string
  sha1: string
  size: number
  url: string
}

export interface Assets {
  objects: {
    [key: string]: {
      hash: string
      size: number
      url?: string
    }
  }
}

export interface Argument {
  rules: { action: 'allow' | 'disallow'; features: { [key: string]: boolean } }[]
  value: string | string[]
}

