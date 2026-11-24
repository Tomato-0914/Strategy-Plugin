import path from 'node:path'
import cfg, { GAME_NAME } from './config.js'
import RoleGuide from './roleGuide.js'
import { logger } from './setting.js'

/** 定时更新配置：resources/data/strategy/config.yaml */
const CONFIG_FILE = path.join(cfg.res, 'strategy/config.yaml')

const GAME_MAP = { gs: 'gs', 原神: 'gs', sr: 'sr', 星铁: 'sr', zzz: 'zzz', 绝区零: 'zzz' }

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 定时重新下载指定角色的攻略图（新角色上线后攻略会更新几轮）
 */
class AutoUpdateStrategy {
  /** 读取配置，没有 cron 时返回 null */
  loadConfig () {
    const config = cfg.readYaml(CONFIG_FILE)
    if (!config?.cron) return null
    return config
  }

  /**
   * { gs: [胡桃], sr: [流萤], zzz: [艾莲] } → [{ game, name }]
   */
  parseRoles (roles) {
    if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return []
    const ret = []
    for (const [key, names] of Object.entries(roles)) {
      const game = GAME_MAP[key]
      if (!game) {
        logger.mark(`[自动更新攻略] 未知游戏类型：${key}，跳过`)
        continue
      }
      if (!Array.isArray(names)) continue
      for (const name of names) {
        if (typeof name === 'string' && name.trim()) ret.push({ game, name: name.trim() })
      }
    }
    return ret
  }

  /** 每次执行时重新读取配置，修改名单无需重启 */
  async runUpdate () {
    const roles = this.parseRoles(this.loadConfig()?.roles)
    if (!roles.length) {
      logger.mark('[自动更新攻略] 没有需要更新的角色，跳过')
      return
    }

    logger.mark(`[自动更新攻略] 开始更新 ${roles.length} 个角色：${roles.map(r => `${GAME_NAME[r.game]}/${r.name}`).join('、')}`)

    let success = 0
    for (let i = 0; i < roles.length; i++) {
      const { game, name } = roles[i]
      try {
        if (await this.updateRole(game, name)) success++
      } catch (err) {
        logger.error(`[自动更新攻略] ${GAME_NAME[game]}/${name} 更新异常：${err.message}`)
      }
      // 角色之间间隔 5 秒，避免请求过于密集
      if (i < roles.length - 1) await sleep(5000)
    }

    logger.mark(`[自动更新攻略] 更新完毕，成功 ${success} 个，失败 ${roles.length - success} 个`)
  }

  async updateRole (game, name) {
    const logFnc = `[自动更新攻略][${GAME_NAME[game]}][${name}]`
    const fakeE = { reply: async () => true, logFnc }
    const guide = new RoleGuide(fakeE, game)

    // 只记日志，不发消息
    guide.replyStrategies = async (msg, roleName) => {
      if (!msg?.length) {
        logger.mark(`${logFnc} 暂无攻略数据或下载失败`)
        return null
      }
      logger.mark(`${logFnc} 已更新 ${msg.length} 张攻略图`)
      return msg
    }

    const ret = await guide.getGuide(name, true)
    if (ret === false) logger.mark(`${logFnc} 无法识别角色名`)
    return !!ret
  }
}

export default new AutoUpdateStrategy()
