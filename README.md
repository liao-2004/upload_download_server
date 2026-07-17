# my_server — 文件管理（前后端分离）

一个前后端分离的文件管理应用：网页上传文件、创建文本文件、保存到服务器、在线查看、下载到本地、删除。

- **前端**：Vue 3 + Vite（本目录）
- **后端**：Node.js + Express + Multer（`server/` 目录），文件存储在 `server/storage/`

## 目录结构

```
my_server/
├── server/            # Express 后端
│   ├── index.js       # 全部接口
│   ├── package.json
│   └── storage/       # 上传/创建的文件保存在这里（自动生成）
├── src/
│   ├── api/files.js   # 前端接口封装
│   └── views/HomeView.vue  # 文件管理界面
└── vite.config.js     # /api 代理到后端 3000 端口
```

## 运行方式

需要开**两个终端**，先后端后前端。

### 1. 启动后端（终端 A）

```sh
cd server
npm install
npm start        # 或 npm run dev（--watch 自动重启）
```

后端监听 http://localhost:3000

### 2. 启动前端（终端 B）

```sh
npm install
npm run dev
```

打开 Vite 提示的地址（默认 http://localhost:5173）。前端 `/api` 请求会自动代理到后端，无需处理跨域。

> 注意：前端 Vite 8 要求 Node 22+。若本机 Node 版本较低，前端可能装不上或跑不起来，但后端只需 Node 18+ 即可独立运行和测试。

## 后端接口

| 方法   | 路径                          | 说明                     |
| ------ | ----------------------------- | ------------------------ |
| GET    | `/api/files`                  | 文件列表                 |
| POST   | `/api/files/upload`           | 上传文件（表单字段 `file`，可多选） |
| POST   | `/api/files`                  | 创建文本文件 `{name, content}` |
| GET    | `/api/files/:name/content`    | 查看文本内容             |
| GET    | `/api/files/:name/download`   | 下载文件                 |
| DELETE | `/api/files/:name`            | 删除文件                 |

### 安全与限制

- 文件名只取 `basename`，并校验解析后仍在 `storage/` 内，防止 `../` 路径穿越。
- 上传单文件上限 100MB，一次最多 20 个。
- 在线查看仅限文本，超过 5MB 提示下载查看。
- 同名文件上传时自动追加 `(1)`、`(2)` 等，创建时返回 409。

---

以下为 Vite 模板原始说明：

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).
