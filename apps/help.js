import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import cfg from '../model/config.js'
import commonTools from '../model/commonTools.js'
import { pluginDir } from '../components/info.js'

/**
 * 帮助与更新
 * 帮助样式借鉴白纸插件
 */
export class strategyHelp extends plugin {
  constructor () {
    super({
      name: '攻略插件:帮助',
      dsc: '攻略插件帮助',
      event: 'message',
      priority: 5,
      rule: [
        {
          reg: '^#?攻略(插件)?帮助$',
          fnc: 'help'
        },
        {
          reg: '^#攻略(插件)?(强制)?更新$',
          fnc: 'update',
          permission: 'master'
        }
      ]
    })
  }

  async help () {
    const help = cfg.getSet('help')
    const data = commonTools.getRenderData('Help', 'help', {
      user: help.user || [],
      master: help.master || [],
      isMaster: this.e.isMaster
    })
    const img = await puppeteer.screenshot('strategyHelp', data)
    if (img) await this.reply(img)
    return true
  }

  /** 交给云崽自带的 #更新<插件目录名> 处理；攻略数据随插件一起更新 */
  async update () {
    this.e.msg = `#${this.e.msg.includes('强制') ? '强制' : ''}更新${pluginDir}`
    return false
  }
}
