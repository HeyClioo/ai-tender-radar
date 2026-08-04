# Contributing

感谢参与。这个项目优先保持简单：公开站点只负责浏览，数据发布脚本只负责生成可验证的公开快照。

## 提交前检查

```bash
npm run validate
```

请不要提交以下内容：

- `.env`、Cookie、Access Token、App Secret
- 浏览器 profile、SQLite 状态库和运行日志
- 未经字段裁剪的原始抓取响应
- 绕过验证码或反爬校验的代码

数据变更请使用 `scripts/publish-snapshot.mjs`，不要手工修改 `data/dates.json`。
