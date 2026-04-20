import Module from 'node:module'

export function clearModules(modulePaths: string[]): void {
  for (const modulePath of modulePaths) {
    try {
      delete require.cache[require.resolve(modulePath)]
    } catch {
      // Ignore modules that were not loaded yet.
    }
  }
}

export function requireWithMocks<T>(
  entryPath: string,
  mocks: Record<string, unknown>
): T {
  const originalLoad = (Module as any)._load

  ;(Module as any)._load = function patchedLoad(
    request: string,
    parent: NodeModule | undefined,
    isMain: boolean
  ) {
    const resolved = (Module as any)._resolveFilename(request, parent, isMain)

    if (resolved in mocks) {
      return mocks[resolved]
    }

    return originalLoad.apply(this, arguments as any)
  }

  try {
    return require(entryPath) as T
  } finally {
    ;(Module as any)._load = originalLoad
  }
}
