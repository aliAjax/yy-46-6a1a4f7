# 政府机关公文流转系统

一个保留静态部署方式的原生HTML、CSS、JavaScript示例项目。页面入口仍是`index.html`，业务脚本仍通过普通`<script>`标签加载。

## 开发环境

- Node.js 18或更高版本
- 无需安装重型前端框架

## 本地预览

```bash
npm run dev
```

默认地址是`http://localhost:4173`。需要更换端口时可以使用：

```bash
PORT=3000 npm run dev
```

## 数据逻辑测试

```bash
npm test
```

测试使用Node内置`node:test`和`vm`加载`js/data.js`，每个测试都会创建独立的内存版`localStorage`，不会读写浏览器或其他测试用例中的本地数据。

## 语法和基础结构检查

```bash
npm run lint
```

该命令会对`js/data.js`、`js/app.js`执行Node语法检查，并检查静态入口是否仍加载必要的CSS和JS文件。

## 静态部署

部署时继续发布以下静态文件即可：

- `index.html`
- `css/`
- `js/`

`package.json`、`scripts/`和`tests/`只服务于本地开发、测试和质量检查，不改变现有静态部署方式。
