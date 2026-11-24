import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 插件基础信息
 * 所有路径都由本文件位置推算，插件目录叫什么名字都能正常工作
 */

/** 插件根目录（绝对路径） */
export const pluginPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 插件目录名，例如 Strategy-Plugin，用于 #更新<目录名> */
export const pluginDir = path.basename(pluginPath)

/** 插件中文名，用于日志与回复 */
export const pluginName = '攻略插件'

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

/** 插件版本：取 CHANGELOG.md 第一个版本号，读不到再用 package.json */
export const pluginVer = (() => {
  try {
    const log = fs.readFileSync(path.join(pluginPath, 'CHANGELOG.md'), 'utf8')
    const ret = /^#\s*([0-9.]+)\s*$/m.exec(log)
    if (ret) return ret[1]
  } catch {}
  return readJson(path.join(pluginPath, 'package.json')).version || '0.0.0'
})()

/** 云崽本体信息 */
const yzPkg = readJson(path.join(process.cwd(), 'package.json'))
export const yzInfo = {
  name: yzPkg.name || 'Yunzai',
  version: yzPkg.version || ''
}
