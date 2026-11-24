import fs from 'node:fs'
import path from 'node:path'
import _ from 'lodash'
import cfg, { GAME_DIR, GAME_NAME } from './config.js'
import commonTools from './commonTools.js'
import { logger } from './setting.js'

const _path = process.cwd()
const IMG_EXT = ['jpg', 'png', 'webp', 'jpeg']

/** 米游社合集接口 */
const MYS_COLLECTION_API = 'https://bbs-api.mihoyo.com/post/wapi/getPostFullInCollection?&gids=2&order_type=2&collection_id='

/** 图鉴插件（Atlas）材料图目录 */
const ATLAS_DIR = {
  gs: ['Genshin-Atlas/material for role'],
  sr: ['star-rail-atlas/material for role', 'star-rail-atlas/guide for role'],
  zzz: ['zzz-atlas/material for role']
}

/** 有图鉴材料图时跳过的攻略源（内容与材料图重复） */
const ATLAS_EXCLUDE = {
  sr: ['听语惊花'],
  zzz: ['角色材料']
}

/** 没找到攻略图的记录，期间不再重复请求米游社（#更新xx攻略 不受影响） */
const missCache = new Map()
const MISS_TTL = 6 * 60 * 60 * 1000

/** 读取 json，带 mtime 缓存，文件更新后自动重新读取 */
const jsonCache = new Map()
function readJsonCached (file) {
  try {
    const mtime = fs.statSync(file).mtimeMs
    const hit = jsonCache.get(file)
    if (hit && hit.mtime === mtime) return hit.data
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    jsonCache.set(file, { mtime, data })
    return data
  } catch (err) {
    if (err.code !== 'ENOENT') logger.warn(`读取 ${file} 失败：${err.message}`)
    return null
  }
}

/** 加载 genshin 插件的 gsCfg（可选依赖） */
let gsCfg
async function getGsCfg () {
  if (gsCfg === undefined) {
    try {
      gsCfg = (await import('../../genshin/model/gsCfg.js')).default
    } catch {
      gsCfg = null
    }
  }
  return gsCfg
}

export default class RoleGuide {
  /**
   * @param {object} e 消息事件
   * @param {'gs'|'sr'|'zzz'} game
   */
  constructor (e, game = 'gs') {
    this.e = e
    this.game = GAME_DIR[game] ? game : 'gs'
    this.gameDir = GAME_DIR[this.game]
    this.cachePath = path.join(cfg.data, 'roleGuides')
    this.addOnsPath = path.join(this.cachePath, 'add_ons')
  }

  get logFnc () {
    return this.e?.logFnc || ''
  }

  /** OSS 图片处理参数（热加载） */
  get oss () {
    return cfg.config.ossParams || ''
  }

  /** 攻略作者 json：resources/data/strategy/<作者>.json → { 作者: { GameDir: [{name, link}] } } */
  getStrategyLists () {
    const dir = path.join(cfg.res, 'strategy')
    if (!fs.existsSync(dir)) return {}
    const ret = {}
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const json = readJsonCached(path.join(dir, file))
      if (!json || typeof json !== 'object') continue
      for (const [author, games] of Object.entries(json)) {
        const list = games?.[this.gameDir]
        if (Array.isArray(list)) ret[author] = list.filter(v => v?.name)
      }
    }
    return ret
  }

  /**
   * 角色名解析：别名表 → 攻略 json 中的角色名 → genshin 插件角色表（仅原神）
   * 认不出的名字返回 false，交给其他插件处理
   */
  async getRoleName (name) {
    name = name.trim()
    if (!name) return false

    const alias = readJsonCached(path.join(cfg.res, 'alias', `${this.game}alias.json`)) || {}
    for (const [key, list] of Object.entries(alias)) {
      if (!key) continue
      if (key === name || (Array.isArray(list) && list.includes(name))) return key
    }

    const lists = this.getStrategyLists()
    if (_.some(lists, list => list.some(v => v.name === name))) return name

    if (this.game === 'gs') {
      const role = (await getGsCfg())?.getRole?.(name)
      if (role?.name) return role.name
    }
    return false
  }

  /**
   * 查询角色攻略
   * @param {string} name 用户输入的角色名
   * @param {boolean} isUpdate 是否强制重新下载
   * @param {number} page 按钮模式下显示第几张（从 1 开始）
   * @returns 待发送的消息；认不出角色返回 false；没有攻略图时已回复提示，返回 null
   */
  async getGuide (name, isUpdate = false, page = 1) {
    const roleName = await this.getRoleName(name)
    if (!roleName) return false

    /** [{ label: 按钮文字, file: 图片路径 }] */
    const items = []

    // 图鉴插件材料图
    const atlas = this.findAtlas(roleName)
    let sources = cfg.getGuideSources(this.game)
    if (atlas) {
      items.push({ label: '图鉴材料', file: atlas })
      sources = sources.filter(v => !(ATLAS_EXCLUDE[this.game] || []).includes(v.source))
    }

    // 自制图包（add_ons）优先于同名攻略源
    const addOns = this.findAddOns(roleName)
    const addOnAuthors = addOns.map(v => v.author)
    sources = sources.filter(v => !addOnAuthors.includes(v.source))

    // 每个攻略源：已缓存 / 需要下载 / 近期没找到（跳过）
    const tasks = sources.map(author => {
      const file = path.join(this.cachePath, author.source, this.gameDir, `${roleName}.jpg`)
      const missKey = `${this.game}:${author.source}:${roleName}`
      if (fs.existsSync(file) && !isUpdate) return { author, file, state: 'cached' }
      if (!isUpdate && Date.now() - (missCache.get(missKey) || 0) < MISS_TTL) return { author, file, state: 'skip' }
      return { author, file, missKey, state: 'download' }
    })

    const downloads = tasks.filter(v => v.state === 'download')
    if (downloads.length) {
      // 下载要等一会儿，先告诉用户已经收到指令
      await this.e.reply(`正在${isUpdate ? '更新' : '下载'}【${roleName}】的攻略图，请稍候~`, false, { recallMsg: 30 })
      // 最多同时下载 4 个，发送顺序仍按攻略源顺序
      for (const chunk of _.chunk(downloads, 4)) {
        await Promise.all(chunk.map(async task => {
          task.ok = await this.getImg(roleName, task.author, task.file)
          if (task.ok) missCache.delete(task.missKey)
          else missCache.set(task.missKey, Date.now())
        }))
      }
    }

    for (const task of tasks) {
      if (task.state === 'cached' || task.ok) items.push({ label: task.author.source, file: task.file })
    }
    items.push(...addOns.map(v => ({ label: v.author, file: v.file })))

    return await this.replyStrategies(_.uniqBy(items, 'file'), roleName, page)
  }

  /**
   * @param {{label: string, file: string}[]} items 攻略图
   * @param {string} name 角色名
   * @param {number} page 按钮模式下显示第几张
   */
  async replyStrategies (items, name, page = 1) {
    if (_.isEmpty(items)) {
      await this.e.reply(`${GAME_NAME[this.game]}暂无角色【${name}】的攻略图\n可以稍后发送【#更新${name}攻略】重试`, false, { at: false, recallMsg: 30 })
      return null
    }
    if (this.useButton()) return this.makeButtonMsg(items, name, page)

    const imgs = items.map(v => segment.image(`file://${v.file}`))
    return await commonTools.makeMsg(this.e, imgs, `${GAME_NAME[this.game]} ${name} 攻略\n图片来自米游社各攻略作者，仅供学习交流`)
  }

  /**
   * 是否使用「单张图 + 作者按钮」的形式发送
   * 官方机器人（QQBot 适配器）不支持合并转发，默认改用按钮切换作者
   */
  useButton () {
    const mode = cfg.config.buttonMode ?? 'auto'
    if (mode === true || mode === 'always') return true
    if (mode === false || mode === 'off') return false
    const ids = [this.e?.bot?.adapter?.id, this.e?.bot?.adapter?.name, this.e?.adapter_id, this.e?.adapter_name, this.e?.adapter]
    return ids.includes('QQBot') && typeof segment.button === 'function'
  }

  /** 一张攻略图 + 所有作者的按钮，点按钮发送 #角色攻略N 切换到第 N 张 */
  makeButtonMsg (items, name, page = 1) {
    const idx = _.clamp(Number(page) || 1, 1, items.length) - 1
    const prefix = { gs: '#', sr: '#星铁', zzz: '#绝区零' }[this.game]
    const buttons = items.map((v, i) => ({
      text: `${i === idx ? '▶ ' : ''}${v.label}`,
      callback: `${prefix}${name}攻略${i + 1}`
    }))

    const msg = [
      `${name}攻略 ${idx + 1}/${items.length} · ${items[idx].label}`,
      segment.image(`file://${items[idx].file}`)
    ]
    // 每行 4 个，最多 5 行
    if (items.length > 1) msg.push(segment.button(..._.chunk(buttons, 4).slice(0, 5)))
    return msg
  }

  /** 图鉴插件（plugins/Atlas 或 plugins/atlas）中的材料图 */
  findAtlas (name) {
    for (const plugin of ['Atlas', 'atlas']) {
      for (const dir of ATLAS_DIR[this.game] || []) {
        for (const ext of ['png', 'jpg', 'webp']) {
          const file = path.join(_path, 'plugins', plugin, dir, `${name}.${ext}`)
          if (fs.existsSync(file)) return file
        }
      }
    }
    return null
  }

  /**
   * 自制图包：data/roleGuides/add_ons/<作者>/<GameDir>/<角色>.jpg
   * 原神图包也可以不建 GenshinImpact 目录，直接放在 add_ons/<作者>/<角色>.jpg
   */
  findAddOns (name) {
    if (!fs.existsSync(this.addOnsPath)) return []
    const ret = []
    for (const author of fs.readdirSync(this.addOnsPath)) {
      const dirs = [path.join(this.addOnsPath, author, this.gameDir)]
      if (this.game === 'gs') dirs.push(path.join(this.addOnsPath, author))
      const file = dirs
        .flatMap(dir => IMG_EXT.map(ext => path.join(dir, `${name}.${ext}`)))
        .find(f => fs.existsSync(f))
      if (file) ret.push({ author, file })
    }
    return ret
  }

  /** 给米游社图床链接加上 OSS 压缩参数 */
  withOss (url) {
    if (!this.oss || url.includes('?')) return url
    return /miyoushe\.com|mihoyo\.com/.test(url) ? url + this.oss : url
  }

  /**
   * 下载攻略图
   * 1. 先从 resources/data/strategy/<作者>.json 中找图片链接
   * 2. 找不到或下载失败，再从米游社合集接口抓取
   * @param {string} name 角色名
   * @param {{source: string, collection_id: number[]}} author 攻略源
   * @param {string} file 保存路径
   */
  async getImg (name, author, file) {
    const link = this.findLocalLink(name, author.source)
    if (link) {
      logger.mark(`${this.logFnc} 下载 ${author.source}-${name} 攻略图（本地数据）`)
      if (await commonTools.download(this.withOss(link), file)) return true
      logger.warn(`${this.logFnc} 本地数据链接下载失败，改用米游社接口：${link}`)
    }

    const url = await this.findMysLink(name, author)
    if (!url) return false

    logger.mark(`${this.logFnc} 下载 ${author.source}-${name} 攻略图（米游社）`)
    if (!await commonTools.download(this.withOss(url), file)) return false
    return true
  }

  /** 在攻略作者 json 中查找链接：先精确匹配，再唯一的包含匹配 */
  findLocalLink (name, source) {
    const list = this.getStrategyLists()[source]
    if (!list) return null
    let entry = list.find(v => v.name === name && v.link)
    if (!entry) {
      const fuzzy = list.filter(v => v.link && v.name.includes(name))
      if (fuzzy.length === 1) entry = fuzzy[0]
    }
    return entry?.link || null
  }

  /** 从米游社合集中查找角色攻略图 */
  async findMysLink (name, author) {
    if (_.isEmpty(author.collection_id)) {
      logger.mark(`${this.logFnc} 攻略源 ${author.source} 未配置合集 ID，跳过`)
      return null
    }

    const res = await Promise.all(author.collection_id.map(id => commonTools.getFetchData(MYS_COLLECTION_API + id)))
    const posts = _.flatten(res.map(v => v?.data?.posts || []))

    const topicHit = []
    for (const val of posts) {
      const subject = val?.post?.subject || ''
      // OH是姜姜呀 的合集是一帖多角色，按【角色名】定位图片
      if (author.collection_id.includes(341523)) {
        const content = (val?.post?.structured_content || '').replace(/\\\/\{\}/g, '')
        if (!content.includes(name + '】')) continue
        const imgId = new RegExp(_.escapeRegExp(name) + '】.*?image\\\\?":\\\\?"(.*?)\\\\?"').exec(content)?.[1]
        const img = _.find(val.image_list, v => v.image_id === imgId)
        if (img?.url) return img.url
        continue
      }
      if (subject.includes(name)) return this.getMax(val.image_list)
      if (_.map(val.topics, 'name').includes(name)) topicHit.push(this.getMax(val.image_list))
    }

    if (topicHit[0]) return topicHit[0]
    logger.mark(`${this.logFnc} 暂无 ${name} 攻略（${author.source}）`)
    return null
  }

  getMax (imgs = []) {
    return _.maxBy(imgs, v => Number(v.size))?.url
  }
}
