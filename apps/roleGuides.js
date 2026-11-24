import plugin from '../../../lib/plugins/plugin.js'
import fs from 'node:fs'
import path from 'node:path'
import cfg from '../model/config.js'
import RoleGuide from '../model/roleGuide.js'

const reg = /^[#*%]?(原神|星铁|绝区零)?(更新)?(\S+?)(?:攻略|一图流)(\d{1,2})?$/

/**
 * 角色攻略
 * priority 为 5，会优先于其他插件的【xx攻略】；
 * 只处理认得出的角色名，认不出的会交给其他插件
 */
export class roleGuides extends plugin {
  constructor () {
    super({
      name: '攻略插件:角色攻略',
      dsc: '米游社角色攻略一图流',
      event: 'message',
      priority: 5,
      rule: [
        {
          reg: reg.source,
          fnc: 'roleGuide'
        }
      ]
    })
  }

  async init () {
    fs.mkdirSync(path.join(cfg.data, 'roleGuides/add_ons'), { recursive: true })
  }

  async roleGuide () {
    const match = reg.exec(this.e.msg?.trim() || '')
    if (!match) return false
    const [, gameName, isUpdate, roleName, page] = match

    const msg = await new RoleGuide(this.e, this.getGame(gameName)).getGuide(roleName, !!isUpdate, Number(page) || 1)
    if (msg === false) return false
    if (msg) await this.e.reply(msg)
    return true
  }

  /** 判断游戏：显式前缀 > 云崽识别结果（* 星铁、% 绝区零） */
  getGame (gameName) {
    const map = { 原神: 'gs', 星铁: 'sr', 绝区零: 'zzz' }
    if (gameName) return map[gameName]
    const raw = String(this.e.original_msg || this.e.raw_message || this.e.msg || '').trim()
    if (this.e.game === 'zzz' || raw.startsWith('%')) return 'zzz'
    if (this.e.game === 'sr' || this.e.isSr || raw.startsWith('*')) return 'sr'
    return 'gs'
  }
}
