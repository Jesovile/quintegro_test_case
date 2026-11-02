import { readFileSync } from 'node:fs'
import path from 'node:path'

export type UserKey = 'john' | 'jane'

// Credentials are read from the project README so they are not duplicated in the tests
const readme = readFileSync(path.resolve(__dirname, '../../README.md'), 'utf8')

const pick = (login: string) => {
  const match = new RegExp(`login:\\s*"${login}",\\s*password:\\s*"([^"]+)"`).exec(readme)
  if (!match) throw new Error(`No credentials for ${login} in README.md`)
  return { login, password: match[1] }
}

export const USERS: Record<UserKey, { login: string; password: string }> = {
  john: pick('john.doe'),
  jane: pick('jane.smith')
}
