# 我的计算器喵~

面向高中生的数学 / 化学计算与公式输入工具。纯静态、无后端、无追踪、离线可用，一键部署 GitHub Pages。

- **精确值优先**：`1/2+1/3` 给 `5/6`，sin60° 给 `√3/2`，方程给精确根，不拿近似糊弄
- **错误说人话**：指出错在哪，不蹦 `undefined`、`NaN`
- **化学只建议不强改**：配平给出最小整数系数预览，确认才应用，可撤销
- **复制即用**：结果、公式、化学式复制为带上标纯文本（H₂O、SO₄²⁻），粘进 Word / 微信 / AI 不乱码
- **数据在本机**：不上传、无埋点，导出 JSON 备份即可换设备

功能：数学计算器（四则 / 分数 / 根式 / 三角 / 方程与方程组）、公式编辑器（LaTeX 实时预览 + 高中公式库）、105+ 符号面板、化学（配平 / 浓度 / pH / 相对分子质量）、函数绘图、9 款主题（毛玻璃默认，支持第三方导入，白名单校验零代码执行）。

## 开发

```bash
npm install / npm run dev / npm test / npm run typecheck / npm run build / npm run preview
```

技术栈：Vite · React · TypeScript(strict) · zustand · KaTeX。数学与化学引擎均为自研，主包 ≈83 KB gzip。

## 部署

推送到 `main` 由 Actions 自动测试 → 构建 → 发布；首次在 Settings → Pages → Source 选 **GitHub Actions**。

## 许可证

MIT
