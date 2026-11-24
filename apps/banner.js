import plugin from '../../../lib/plugins/plugin.js'
import Banner from '../model/banner.js'

const reg = /^#(原神|星铁|绝区零)?(\S+?)(祈愿|卡池|复刻)$/

/**
 * UP 卡池详情（依赖 genshin 插件与 miao-plugin 的卡池数据）
 */
export class banner extends plugin {
  constructor () {
    super({
      name: '攻略插件:卡池详情',
      dsc: '角色/武器 UP 卡池详情',
      event: 'message',
      priority: 5,
      rule: [
        {
          reg: reg.source,
          fnc: 'bannerCount'
        }
      ]
    })
  }

  async bannerCount () {
    const match = reg.exec(this.e.msg?.trim() || '')
    if (!match) return false
    const [, gameName, name] = match

    const game = { 原神: 'gs', 星铁: 'sr', 绝区零: 'zzz' }[gameName] ||
      (this.e.game === 'zzz' ? 'zzz' : (this.e.game === 'sr' || this.e.isSr) ? 'sr' : 'gs')

    const msg = await new Banner(this.e, game).searchBanners(name)
    if (!msg) return false

    await this.e.reply(msg)
    return true
  }
}
