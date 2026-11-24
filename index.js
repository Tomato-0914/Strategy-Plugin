import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { pluginPath, pluginName, pluginVer } from './components/info.js'
import { configManager } from './model/setting.js'

if (!global.segment) {
  try {
    global.segment = (await import('oicq')).segment
  } catch {}
}

// 按 config 中的日志开关初始化插件日志
await configManager.getLogConfig().catch(() => {})

const appDir = path.join(pluginPath, 'apps')
const files = fs.readdirSync(appDir).filter(file => file.endsWith('.js'))

const ret = await Promise.allSettled(
  files.map(file => import(pathToFileURL(path.join(appDir, file)).href))
)

const apps = {}
files.forEach((file, i) => {
  const name = file.replace('.js', '')
  if (ret[i].status !== 'fulfilled') {
    logger.error(`[${pluginName}] 载入 ${name} 失败`)
    logger.error(ret[i].reason)
    return
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
})

logger.info(`[${pluginName}] v${pluginVer} 初始化完成，载入 ${Object.keys(apps).length} 个模块`)

export { apps }
