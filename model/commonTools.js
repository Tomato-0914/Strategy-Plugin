import fs from 'node:fs'
import path from 'node:path'
import common from '../../../lib/common/common.js'
import { pluginPath, pluginName, pluginVer, yzInfo } from '../components/info.js'
import cfg from './config.js'

const fetch = globalThis.fetch || (await import('node-fetch')).default

class CommonTools {
  /**
   * GET 请求并解析 JSON，失败返回 false
   * @param {string} url
   */
  async getFetchData (url) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
      if (!res.ok) return false
      return await res.json()
    } catch (err) {
      logger.warn(`[${pluginName}] 请求失败 ${url}：${err.message}`)
      return false
    }
  }

  /**
   * 下载文件。先写入临时文件，成功后再改名，避免留下半张图
   * @param {string} url
   * @param {string} file 保存路径
   * @returns {Promise<boolean>}
   */
  async download (url, file) {
    const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) })
      if (!res.ok) {
        logger.warn(`[${pluginName}] 下载失败 HTTP ${res.status}：${url}`)
        return false
      }
      const buf = Buffer.from(await res.arrayBuffer())
      if (!buf.length) return false
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(tmp, buf)
      fs.renameSync(tmp, file)
      return true
    } catch (err) {
      logger.warn(`[${pluginName}] 下载异常 ${url}：${err.message}`)
      fs.rmSync(tmp, { force: true })
      return false
    }
  }

  /** puppeteer 渲染参数 */
  getRenderData (parent, model, data) {
    return {
      tplFile: `${pluginPath}/resources/html/${parent}/${model}.html`,
      pluResPath: `${pluginPath}/resources/`,
      watermark: `Created By ${yzInfo.name} ${yzInfo.version} & ${pluginName} ${pluginVer}`,
      quality: 100,
      ...data
    }
  }

  /**
   * 多条消息：开启合并转发时打包成转发消息，否则拼接
   * @param {object} e
   * @param {Array} data
   * @param {string} title
   * @param {boolean} force 强制合并转发
   */
  async makeMsg (e, data = [], title = '', force = false) {
    if (data.length === 1) return data[0]
    if (Number(cfg.config.forwardMsg) || force) return await common.makeForwardMsg(e, data, title)
    return [title, ...data]
  }
}

export default new CommonTools()
