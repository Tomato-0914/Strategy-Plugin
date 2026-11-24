import plugin from '../../../lib/plugins/plugin.js'
import autoUpdate from '../model/autoUpdateStrategy.js'
import { GAME_NAME } from '../model/config.js'

/**
 * 定时自动更新指定角色的攻略图
 * 配置：resources/data/strategy/config.yaml
 *
 * 配置只在载入时读取一次，避免每条消息都重复打印日志
 */
const task = (() => {
  try {
    const config = autoUpdate.loadConfig()
    if (!config) return null
    const roles = autoUpdate.parseRoles(config.roles)
    if (!roles.length) return null
    logger.mark(`[自动更新攻略] 已注册定时任务 ${config.cron}，角色：${roles.map(r => `${GAME_NAME[r.game]}-${r.name}`).join('、')}`)
    return {
      name: '[攻略插件]自动更新攻略',
      cron: config.cron,
      fnc: () => autoUpdate.runUpdate()
    }
  } catch (err) {
    logger.error(`[自动更新攻略] 初始化定时任务失败：${err.message}`)
    return null
  }
})()

export class autoUpdateStrategy extends plugin {
  constructor () {
    super({
      name: '攻略插件:自动更新攻略',
      dsc: '定时自动更新指定角色攻略',
      event: 'message',
      priority: 7000,
      rule: []
    })
    if (task) this.task = task
  }
}
