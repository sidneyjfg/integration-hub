import path from 'path'

export default function filtrarPorIgnoreEndFile(
  files: string[],
  ignoreEnv?: string
): string[] {
  if (!ignoreEnv?.trim()) return files

  const ignores = ignoreEnv
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)

  if (!ignores.length) return files

  return files.filter(file => {
    const name = path.basename(file).toLowerCase()
    return !ignores.some(ignore => name.includes(ignore))
  })
}
