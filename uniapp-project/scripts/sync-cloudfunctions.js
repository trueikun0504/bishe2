const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const sourceCloudfunctions = path.join(projectRoot, 'cloudfunctions')
const targetProjects = [
  path.join(projectRoot, 'dist', 'build', 'mp-weixin'),
  path.join(projectRoot, 'dist', 'dev', 'mp-weixin'),
]

function ensureProjectConfig(projectDir) {
  const configPath = path.join(projectDir, 'project.config.json')
  if (!fs.existsSync(configPath)) {
    return
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  if (config.cloudfunctionRoot === 'cloudfunctions') {
    return
  }

  config.cloudfunctionRoot = 'cloudfunctions'
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function syncCloudfunctionsTo(projectDir) {
  if (!fs.existsSync(projectDir) || !fs.existsSync(sourceCloudfunctions)) {
    return
  }

  const targetCloudfunctions = path.join(projectDir, 'cloudfunctions')
  fs.mkdirSync(projectDir, { recursive: true })
  fs.cpSync(sourceCloudfunctions, targetCloudfunctions, { recursive: true, force: true })
  ensureProjectConfig(projectDir)
}

targetProjects.forEach(syncCloudfunctionsTo)
