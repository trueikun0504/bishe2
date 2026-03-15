import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

function readEnvValue(names, fallback = '') {
  const envNames = Array.isArray(names) ? names : [names]
  const envPaths = [
    path.resolve(__dirname, '.env.local'),
    path.resolve(__dirname, '.env'),
    path.resolve(__dirname, '..', '.env'),
  ]

  for (const name of envNames) {
    const processValue = String(process.env[name] || '').trim()
    if (processValue) {
      return processValue
    }

    for (const envPath of envPaths) {
      if (!fs.existsSync(envPath)) {
        continue
      }

      const content = fs.readFileSync(envPath, 'utf8')
      const match = content.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, 'm'))
      if (match && match[1]) {
        return match[1].trim()
      }
    }
  }

  return fallback
}

const cloudbaseEnv = readEnvValue('CLOUDBASE_ENV')
const apiBaseUrl = readEnvValue(['VITE_API_BASE_URL', 'API_BASE_URL'], 'http://localhost:3001')

export default defineConfig({
  define: {
    __CLOUDBASE_ENV__: JSON.stringify(cloudbaseEnv),
    __API_BASE_URL__: JSON.stringify(apiBaseUrl),
  },
  plugins: [uni()],
})
