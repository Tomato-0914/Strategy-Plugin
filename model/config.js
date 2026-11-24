import YAML from 'yaml'
import chokidar from 'chokidar'
import fs from 'node:fs'
import path from 'node:path'
import { pluginPath } from '../components/info.js'

/** 游戏 → 资源目录名 */
export const GAME_DIR = {
  gs: 'GenshinImpact',
  sr: 'StarRail',
  zzz: 'ZenlessZoneZero'
}

/** 游戏 → 中文名 */
export const GAME_NAME = {
  gs: '原神',
  sr: '星铁',
  zzz: '绝区零'
}

/** 游戏 → 攻略源配置文件名 */
const GUIDE_FILE = {
  gs: 'roleGuides',
  sr: 'srRoleGuides',
  zzz: 'zzzRoleGuides'
}

const isTrue = v => v === true || v === 1 || v === 'true'

/**
 * 配置与路径
 * 热加载借鉴逍遥插件
 */
class Config {
  constructor () {
    this.def = path.join(pluginPath, 'config/default')
    this.user = path.join(pluginPath, 'config/user')
    /** 插件自带数据（随插件更新） */
    this.res = path.join(pluginPath, 'resources/data')
    /** 运行时缓存（攻略图等，已 gitignore） */
    this.data = path.join(pluginPath, 'data')
    this._cache = {}
    this._watchers = {}
  }

  /** 读取 yaml，不存在或解析失败返回 null */
  readYaml (file) {
    if (!fs.existsSync(file)) return null
    try {
      return YAML.parse(fs.readFileSync(file, 'utf8'))
    } catch (err) {
      logger.error(`[攻略插件] 解析 ${file} 失败：${err}`)
      return null
    }
  }

  /** 读取 config/user 或 config/default 下的配置，user 优先 */
  getSet (name) {
    const user = this.readYaml(path.join(this.user, `${name}.yaml`))
    if (user !== null && user !== undefined) return user
    return this.readYaml(path.join(this.def, `${name}.yaml`)) || {}
  }

  /** 带缓存与热加载的 config.yaml 读取 */
  get config () {
    const key = 'config'
    if (!this._cache[key]) {
      this._cache[key] = { ...this.readYaml(path.join(this.def, 'config.yaml')), ...this.readYaml(path.join(this.user, 'config.yaml')) }
      this._watch(key, [path.join(this.def, 'config.yaml'), path.join(this.user, 'config.yaml')])
    }
    return this._cache[key]
  }

  _watch (key, files) {
    if (this._watchers[key]) return
    const watcher = chokidar.watch(files, { persistent: true, ignoreInitial: true })
    watcher.on('all', () => {
      delete this._cache[key]
      logger.mark(`[攻略插件] 配置文件已重新加载：${key}`)
    })
    this._watchers[key] = watcher
  }

  /**
   * 获取某个游戏启用的攻略源，返回 [{ source, collection_id: [] }]
   * - config/user 下没有该文件，或其中 all/ALL 为 true：使用 config/default
   * - 否则使用 config/user
   * 兼容 {news, olds}、{list} 以及直接数组三种写法
   */
  getGuideSources (game) {
    const name = GUIDE_FILE[game] || GUIDE_FILE.gs
    const user = this.readYaml(path.join(this.user, `${name}.yaml`))
    const useDefault = !user || isTrue(user.all) || isTrue(user.ALL)
    const raw = useDefault ? this.readYaml(path.join(this.def, `${name}.yaml`)) : user

    let list = []
    if (Array.isArray(raw)) list = raw
    else if (raw && Array.isArray(raw.list)) list = raw.list
    else if (raw && Array.isArray(raw.news)) list = raw.news

    return list
      .filter(v => v && v.source)
      .map(v => ({
        source: String(v.source).trim(),
        collection_id: (Array.isArray(v.collection_id) ? v.collection_id : [v.collection_id])
          .map(Number)
          .filter(Boolean)
      }))
  }

  get resNotFound () {
    return '插件资源缺失，请发送【#攻略更新】更新插件后再试'
  }
}

export default new Config()
