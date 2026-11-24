# Strategy-Plugin 攻略插件

Yunzai-Bot V3（Miao-Yunzai / TRSS-Yunzai）插件，发送原神、崩坏：星穹铁道、绝区零的**角色攻略一图流**。

基于 [mora-plugin](https://gitee.com/Rrrrrrray/mora-plugin)（作者 Rrrrrrray）及其 [fork](https://gitcode.com/jiuyixian/mora-plugin)（维护 jiu）修改，感谢原作者。

## 安装

在 Yunzai 根目录执行：

```bash
git clone --depth=1 https://github.com/Tomato-0914/Strategy-Plugin.git ./plugins/Strategy-Plugin/
```

插件目录名可以随意，不影响使用。攻略数据已包含在插件内，无需另外下载资源包。

依赖：
- 原神角色名识别会用到 `genshin` 插件（没有也能用，只是认不出别名表以外的叫法）
- 卡池查询需要 `genshin` 插件和 `miao-plugin`
- 如装了图鉴插件（`plugins/Atlas`），会额外发送角色材料图

## 指令

| 功能 | 指令 | 说明 |
| :---: | --- | --- |
| 角色攻略 | `#钟离攻略` `#钟离一图流` | 原神 |
| | `*流萤攻略` `#星铁流萤攻略` | 星铁 |
| | `%艾莲攻略` `#绝区零艾莲攻略` | 绝区零 |
| | `#更新钟离攻略` | 重新下载该角色的攻略图 |
| 卡池详情 | `#雷神卡池` `#薙刀复刻` `#星铁黄泉卡池` | UP 卡池详情、未复刻天数 |
| 深渊版本 | `#5.0深渊` `#5.0剧诗` `#3.2混沌` `#3.2虚构` | 各版本怪物，图片来自 [JIUXJIU/Abyss](https://cnb.cool/JIUXJIU/Abyss) |
| 历代12层 | `#历代12层` `#历代12-3` | 最低输出量，图源 NGA `@妮可少年` |
| 帮助 | `#攻略帮助` | |
| 更新（主人） | `#攻略更新` `#攻略强制更新` | 更新插件，攻略数据一起更新 |

角色攻略指令优先级较高（priority 5），会覆盖其他插件的同名指令；认不出的角色名会交给其他插件处理。

## 攻略从哪里来

1. `resources/data/strategy/<作者>.json` 中记录的图片链接（优先）
2. 找不到时，按 `config/*RoleGuides.yaml` 里的米游社合集 ID 抓取
3. 下载的图缓存在 `data/roleGuides/<作者>/<游戏>/<角色>.jpg`，发送 `#更新xx攻略` 可重新下载

`resources/data/strategy/config.yaml` 中可以配置定时任务，在新角色上线后自动刷新其攻略图。

### 数据格式

```jsonc
// resources/data/strategy/HoYo青枫.json
{
  "HoYo青枫": {
    "GenshinImpact": [{ "name": "钟离", "link": "https://upload-bbs.miyoushe.com/..." }],
    "StarRail": [],
    "ZenlessZoneZero": []
  }
}
```

角色别名在 `resources/data/alias/{gs,sr,zzz}alias.json`，格式为 `{ "正式名": ["别名1", "别名2"] }`。

## 自定义

- **攻略源**：把 `config/default/roleGuides.yaml`（星铁 `srRoleGuides.yaml`、绝区零 `zzzRoleGuides.yaml`）复制到 `config/user/` 修改，或在锅巴面板中关闭「使用默认攻略源」后编辑。列表顺序就是发送顺序。
- **自制图包**：放在 `data/roleGuides/add_ons/<作者>/<游戏目录>/<角色名>.jpg`
  - 游戏目录：`GenshinImpact`、`StarRail`、`ZenlessZoneZero`（原神也可以直接放在 `<作者>/` 下）
  - 与攻略源同名的作者，以图包为准
- **其他设置**（合并转发、日志、图片压缩参数）：`config/user/config.yaml` 或锅巴面板

## 免责声明

1. 仅供交流学习，请勿用于任何以盈利为目的的场景
2. 攻略图片版权归各攻略作者所有，如有侵权请联系删除

## 致谢

| 来源 | 贡献 |
| :---: | --- |
| [Rrrrrrray](https://gitee.com/Rrrrrrray/mora-plugin) | mora-plugin 原作者 |
| [jiu](https://gitcode.com/jiuyixian/mora-plugin) | mora-plugin fork、攻略数据整理、深渊图库 |
| [HoYo青枫](https://www.miyoushe.com/ys/accountCenter/postList?id=285802042)、[Asgater](https://www.miyoushe.com/ys/accountCenter/postList?id=79695828)、[猫冬](https://www.miyoushe.com/ys/accountCenter/postList?id=74019947)、[关蝎](https://www.miyoushe.com/ys/accountCenter/postList?id=82386584)、[地底Tv](https://www.miyoushe.com/ys/accountCenter/postList?id=83147658)、[祖安水稻公主](https://www.miyoushe.com/ys/accountCenter/postList?id=159938966)、[祈鸢ya](https://www.miyoushe.com/ys/accountCenter/postList?id=137101761)、[星穹中心](https://www.miyoushe.com/ys/accountCenter/postList?id=368830308)、[让我摸个鱼吧Moyu](https://www.miyoushe.com/ys/accountCenter/postList?id=352759746)、[小橙子阿](https://www.miyoushe.com/ys/accountCenter/postList?id=73603011)、[紫罗兰打烊啦](https://www.miyoushe.com/ys/accountCenter/postList?id=279259320) 等米游社攻略作者 | 角色攻略一图流 |
| [妮可少年](https://bbs.nga.cn/read.php?tid=31508898) | 历代深渊最低输出量 |
| 云崽、喵喵插件、图鉴插件、白纸插件 | 参考代码 |

## 许可

[GPL-3.0](./LICENSE)，与原项目一致。
