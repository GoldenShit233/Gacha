# 模拟抽卡 (Gacha Demo)

这是一个轻量的可扩展抽卡示例项目，特点：

- 分文件（html, js, css, pools 模块化）
- 本地存储抽卡记录与累计消耗
- 实现保底（pity）: 从 `pityStart` 次数后，每次增加 `pityIncrementPerDraw` 的 ％ 点数
- 支持每个卡池独立设置价格、保底、最大抽取限制与首抽特殊规则
- 点击抽卡后有确认与动画（箱子上升、卡片逐个翻开、skip 按钮跳过动画）

目录说明：

- `index.html` 主页面
- `css/styles.css` 样式
- `js/main.js` 主逻辑与 PoolManager
- `pools/*/pool.js` 每个卡池的模块化配置
- `icon/` 公用素材图标

重要假设与默认值：

- 若卡池未给出 `probabilities`，默认使用：{6:2%,5:12%,4:30%,3:30%,2:18%,1:8%}。示例中 `main4code` 设为 6（表示代码里把4级标为6）。
- `pityIncrementPerDraw` 单位为百分比（例如 0.5 表示 0.5%）
- 若 item 的 `weight` 留空或全为 0，会在该等级内等概率抽取。

如何扩展卡池：

1. 在 `pools/` 下创建新文件夹，例如 `pools/event1/`。
2. 新建 `pool.js`，实现并调用 `window.PoolManager.register(cfg)`，cfg 为卡池配置对象（参考 `pools/newbie/pool.js`）。
3. 可在 `icon/` 放置贴图，并在 `items` 中使用相对路径。

启动：直接用浏览器打开 `index.html` 即可（本地文件）。

如需我继续改进（更丰富的动画、权重编辑器、导出记录、服务端同步等），告诉我想要的方向。
