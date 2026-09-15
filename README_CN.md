# Attu Fusion

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![中文](https://img.shields.io/badge/README-中文-blue.svg)](./README_CN.md)

Attu Fusion 是基于 [Attu 2.5.12](https://github.com/zilliztech/attu) 的非官方社区二次开发项目，提供一个支持多个向量数据库后端和可扩展 embedding Provider 的可视化工作台。本项目与 Zilliz 没有关联，也不代表 Zilliz 的官方立场。

项目保留 Attu 原有的 Milvus 管理能力，并增加后端 Provider 抽象，目前支持 Milvus 和腾讯云 VectorDB；外部文本可以通过阿里云百炼生成 Dense、Sparse 或 Dense + Sparse 向量后进行检索。

## 项目身份与归属声明

- 上游项目：[zilliztech/attu](https://github.com/zilliztech/attu)，版本 2.5.12。
- 项目名称：**Attu Fusion**；建议仓库名：**`attu-fusion`**。
- 本仓库是二次开发衍生作品，保留上游版权和许可证，详见 [LICENSE](./LICENSE)；项目归属说明见 [NOTICE.md](./NOTICE.md)。
- “Attu”“Milvus”“Tencent Cloud VectorDB”“Alibaba Cloud Bailian”分别属于其权利人使用的名称或商标，本项目是独立社区项目。
- 新增代码和文档默认遵循本仓库许可证，除非文件另有说明。

## 目录

- [功能特性](#功能特性)
- [架构说明](#架构说明)
- [项目身份与归属声明](#项目身份与归属声明)
- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [安装指南](#安装指南)
  - [兼容性](#兼容性)
  - [从 Docker 运行 Attu](#从-docker-运行-attu)
  - [在 Kubernetes 中运行 Attu](#在-kubernetes-中运行-attu)
  - [在 nginx 代理后运行 Attu](#在-nginx-代理后运行-attu)
  - [安装桌面应用程序](#安装桌面应用程序)
- [开发](#开发)
- [贡献](#贡献)
- [常见问题](#常见问题)
- [更多截图](#更多截图)
- [使用示例](#使用示例)
- [Milvus 相关链接](#milvus-相关链接)
- [社区](#社区)
- [安全策略](./SECURITY.md)

<div style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px;">
  <div style="flex: 1; min-width: 300px;">
    <h4>首页视图</h4>
    <img src="./.github/images/connect.png" width="100%" alt="attu home view" />
  </div>
  <div style="flex: 1; min-width: 300px;">
    <h4>数据浏览器</h4>
    <img src="./.github/images/screenshot.png" width="100%" alt="attu data explorer" />
  </div>
  <div style="flex: 1; min-width: 300px;">
    <h4>集合管理</h4>
    <img src="./.github/images/data_explorer.png" width="100%" alt="attu data explorer" />
  </div>
  <div style="flex: 1; min-width: 300px;">
    <h4>创建集合</h4>
    <img src="./.github/images/create_collection.png" width="100%" alt="attu create collection dialog" />
  </div>
  <div style="flex: 1; min-width: 300px;">
    <h4>集合树</h4>
    <img src="./.github/images/collections.png" width="100%" alt="attu collections" />
  </div>
  <div style="flex: 1; min-width: 300px;">
    <h4>集合概览</h4>
    <img src="./.github/images/collection_overview.png" width="100%" alt="attu collection view" />
  </div>
  <div style="flex: 1; min-width: 300px;">
    <h4>数据视图</h4>
    <img src="./.github/images/data_preview.png" width="100%" alt="attu data view" />
  </div>
  <div style="flex: 1; min-width: 300px;">
    <h4>向量搜索</h4>
    <img src="./.github/images/vector_search.png" width="100%" alt="attu vector search" />
  </div>
  <div style="flex: 1; min-width: 300px;">
    <h4>系统视图</h4>
    <img src="./.github/images/system_view.png" width="100%" alt="attu system view" />
  </div>
  <div style="flex: 1; min-width: 300px;">
    <h4>角色图表（浅色）</h4>
    <img src="./.github/images/role_chart.png" width="100%" alt="attu role chart" />
  </div>
  <div style="flex: 1; min-width: 300px;">
    <h4>角色图表（深色）</h4>
    <img src="./.github/images/role_chart_night.png" width="100%" alt="attu role chart" />
  </div>
</div>
<br />

## 功能特性

Attu Fusion 是一个通过用户友好的图形界面管理和操作向量数据库的系统，提供以下功能：

- **数据库、集合和分区管理：** 只需点击几下鼠标即可高效地组织和管理您的数据库、集合和分区，帮助用户快速构建和导航 Milvus 设置。
- **向量的插入、索引和查询：** 通过简单的图形界面无缝插入、索引和查询向量，使用户能够高效地处理向量数据。
- **执行向量搜索：** 只需点击几下鼠标即可进行高性能的向量搜索，快速找到相似项，帮助用户迅速进行功能验证。
- **用户和角色管理：** 管理用户和角色，以确保安全和受控的访问权限，使用户能够快速管理权限和安全设置。
- **查看系统拓扑：** 可视化系统架构以实现更好的监督和管理，使用户能够迅速了解和优化他们的系统设置。
- **多后端：** 在同一个连接入口中使用 Milvus 和腾讯云 VectorDB。
- **多向量 Provider：** 根据 Provider、模型和维度生成 Dense、Sparse 或 Dense + Sparse 向量。
- **Provider 感知检索：** 支持内置文本、外部文本 embedding 和纯向量输入，并适配后端混合检索。

## 架构说明

前端通过 Provider 无关的接口访问 API 服务。后端适配器实现集合、文档、索引和检索流程，embedding Provider 实现模型发现和向量生成；数据库差异被封装在适配器内部，页面可以统一提供内置文本、外部文本和纯向量三种输入方式。

当前实现包含 Milvus、腾讯云 VectorDB 和阿里云百炼。详见 [embedding 文档](./doc/embedding.md) 和 [腾讯云 VectorDB 说明](./doc/TCVECTORDB.md)。

## 系统要求

- Docker 20.10.0 或更高版本
- Kubernetes 1.19 或更高版本（如果使用 K8s 部署）
- 现代网页浏览器（Chrome、Firefox、Safari、Edge）
- 桌面应用程序要求：
  - Windows 10/11
  - macOS 10.15 或更高版本
  - Linux（Ubuntu 20.04 或更高版本）

## 快速开始

1. 启动 Milvus 服务器（如果尚未运行）：
```bash
docker run -d --name milvus_standalone -p 19530:19530 -p 9091:9091 milvusdb/milvus:latest
```

2. 启动 Attu：
```bash
docker run -p 8000:3000 -e MILVUS_URL=localhost:19530 zilliz/attu:v2.5
```

3. 打开浏览器并访问 `http://localhost:8000`

本仓库已支持腾讯云 VectorDB。在连接页面选择“腾讯 VectorDB”，填写 endpoint、账号和 API Key 即可。浏览器通过 Attu 后端访问腾讯云，因此运行 Attu 后端的机器必须能够访问 VectorDB 地址。

### 本地启动本仓库

环境要求：Node.js 20 或更高版本、npm；如果需要本地测试 Milvus，还需要 Docker。首次安装两个工作区的依赖：

```bash
npm run install:all
```

分别在两个终端启动后端和前端：

```bash
# 终端 1
npm run start:server

# 终端 2
npm run start:client
```

打开 `http://localhost:3001`。Vite 会将 `/api` 和 WebSocket 请求代理到 `http://localhost:3000`。Windows 可以执行 `powershell -ExecutionPolicy Bypass -File scripts/start-dev.ps1` 一次启动两个进程；关闭前端后脚本会停止后端。macOS/Linux 使用 `./scripts/start-dev.sh`。

如果需要让同一网络中的其他机器访问开发页面，Windows 执行 `powershell -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -ClientHost 0.0.0.0`；macOS/Linux 执行 `ATTU_CLIENT_HOST=0.0.0.0 ./scripts/start-dev.sh`。后端默认监听 3000 端口。

执行 `npm run build:all` 可以构建前端和后端。生产方式运行前，将 `client/build` 复制为 `server/build`，然后执行 `npm --prefix server run start:prod`。Dockerfile 已经自动完成这一步。

构建并运行本地镜像：

```bash
docker build -t attu-fusion:dev .
docker run --rm -p 8000:3000 \
  -e DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/api/v1 \
  attu-fusion:dev
```

### 阿里云百炼向量生成

外部文本和向量生成目前使用阿里云百炼。API Key 只在当前编辑器会话中使用，不会保存到浏览器或数据库。后端默认请求北京地域接口；如果使用业务空间地址，启动后端前设置 `DASHSCOPE_BASE_URL`：

```bash
DASHSCOPE_BASE_URL=https://YOUR_WORKSPACE_ID.cn-beijing.maas.aliyuncs.com/api/v1 npm run start:server
```

API Key 的 IP 白名单必须包含运行 Attu 后端的机器或容器的公网出口 IP。若看到 `403 AccessDenied` 和 `IP access denied by API-Key restriction`，请先更新百炼白名单。模型支持时，页面可生成 Dense、Sparse 和 Dense + Sparse 三种结果。

## 安装指南

在开始之前，请确保您已在 [Zilliz Cloud](https://cloud.zilliz.com/signup) 或 [您自己的服务器](https://milvus.io/docs/install_standalone-docker.md) 上安装了 Milvus。

### 兼容性

| Milvus 版本 | 推荐的 Attu 版本                                                   |
| ----------- | ------------------------------------------------------------------ |
| 2.5.x       | [v2.5.10](https://github.com/zilliztech/attu/releases/tag/v2.5.10) |
| 2.4.x       | [v2.4.12](https://github.com/zilliztech/attu/releases/tag/v2.4.12) |
| 2.3.x       | [v2.3.5](https://github.com/zilliztech/attu/releases/tag/v2.3.5)   |
| 2.2.x       | [v2.2.8](https://github.com/zilliztech/attu/releases/tag/v2.2.8)   |
| 2.1.x       | [v2.2.2](https://github.com/zilliztech/attu/releases/tag/v2.2.2)   |

### 从 Docker 运行 Attu

以下是运行 Attu 容器的步骤：

```bash
docker run -p 8000:3000 -e MILVUS_URL={milvus server IP}:19530 zilliz/attu:v2.5
```

确保 Attu 容器可以访问 Milvus IP 地址。启动容器后，在您的浏览器中输入 `http://{ Attu IP }:8000` 以查看 Attu GUI。

#### 运行 Attu Docker 的可选环境变量

| 参数             | 示例                 | 必填 | 描述                       |
| :--------------- | :------------------- | :--: | -------------------------- |
| MILVUS_URL       | 192.168.0.1:19530    |  否  | 可选，Milvus 服务器 URL    |
| DATABASE         | your database        |  否  | 可选，默认数据库名称       |
| ATTU_LOG_LEVEL   | info                 |  否  | 可选，设置 Attu 的日志级别 |
| ROOT_CERT_PATH   | /path/to/root/cert   |  否  | 可选，根证书的路径         |
| PRIVATE_KEY_PATH | /path/to/private/key |  否  | 可选，私钥的路径           |
| CERT_CHAIN_PATH  | /path/to/cert/chain  |  否  | 可选，证书链的路径         |
| SERVER_NAME      | your_server_name     |  否  | 可选，您的服务器名称       |
| SERVER_PORT      | Server listen port   |  否  | 可选，默认 3000            |

> 请注意，`MILVUS_URL` 应为 Attu Docker 容器可访问的地址，因此 "127.0.0.1" 或 "localhost" 将无法使用。

#### Attu SSL 示例

```bash
docker run -p 8000:3000 \
-v /your-tls-file-path:/app/tls \
-e ATTU_LOG_LEVEL=info  \
-e ROOT_CERT_PATH=/app/tls/ca.pem \
-e PRIVATE_KEY_PATH=/app/tls/client.key \
-e CERT_CHAIN_PATH=/app/tls/client.pem \
-e SERVER_NAME=your_server_name \
zilliz/attu:v2.5
```

#### 自定义服务器端口示例

_此命令允许您使用主机网络运行 Docker 容器，指定服务器监听的自定义端口_

```bash
docker run --network host \
-v /your-tls-file-path:/app/tls \
-e ATTU_LOG_LEVEL=info  \
-e SERVER_NAME=your_server_name \
-e SERVER_PORT=8080 \
zilliz/attu:v2.5
```

### 在 Kubernetes 中运行 Attu

在开始之前，请确保您已在 [K8's 集群](https://milvus.io/docs/install_cluster-milvusoperator.md) 中安装并运行了 Milvus。请注意，Attu 仅支持 Milvus 2.x。

以下是运行 Attu 容器的步骤：

```bash
kubectl apply -f https://raw.githubusercontent.com/zilliztech/attu/main/attu-k8s-deploy.yaml
```

确保 Attu pod 可以访问 Milvus 服务。在提供的示例中，这将直接连接到 `my-release-milvus:19530`。根据 Milvus 服务名称更改此设置。实现这一目标的更灵活方法是引入 `ConfigMap`。详见此 [示例]("https://raw.githubusercontent.com/zilliztech/attu/main/examples/attu-k8s-deploy-ConfigMap.yaml")。

### 在 nginx 代理后运行 Attu

[在 nginx 代理后运行 Attu](https://github.com/zilliztech/attu/blob/main/doc/use-attu-behind-proxy.md)

### 安装桌面应用程序

如果您更喜欢使用桌面应用程序，可以下载 [Attu 的桌面版本](https://github.com/zilliztech/attu/releases/)。

> 注意：
>
> - Mac M 芯片安装应用失败：attu.app 已损坏，无法打开。

```shell
  sudo xattr -rd com.apple.quarantine /Applications/attu.app
```

## 开发

### 前提条件

- Node.js 16.x 或更高版本
- Yarn 包管理器
- Docker（用于本地开发）

### 设置开发环境

1. 克隆仓库：
```bash
git clone https://github.com/zilliztech/attu.git
cd attu
```

2. 安装依赖：
```bash
yarn install
```

3. 启动开发服务器：
```bash
yarn start
```

### 本地构建 Docker 镜像

- 开发版：`yarn run build:dev`
- 发布版：`yarn run build:release`

### 运行测试

```bash
yarn test
```

## 贡献

我们欢迎社区贡献！在提交拉取请求之前，请阅读我们的[贡献指南](CONTRIBUTING.md)。

### 行为准则

请阅读我们的[行为准则](CODE_OF_CONDUCT.md)，以保持我们的社区友好和受人尊敬。

## 常见问题

- 无法登录系统
  > 确保 Milvus 服务器的 IP 地址可以从 Attu 容器访问。[#161](https://github.com/zilliztech/attu/issues/161)
- 如果遇到在 Mac OS 上安装桌面应用的问题，请参考[安装桌面应用程序](#安装桌面应用程序)下的说明。
- 如何更新 Attu？
  > 对于 Docker 用户，只需拉取最新镜像并重启容器。对于桌面用户，从我们的[发布页面](https://github.com/zilliztech/attu/releases)下载最新版本。
- 如何备份我的 Attu 配置？
  > Attu 配置存储在浏览器的本地存储中。您可以从设置页面导出它们。

## 使用示例

[Milvus Typescript 示例](https://github.com/zilliztech/zilliz-cloud-typescript-example)：此仓库提供了一些基于 Next.js 的简单 React 应用程序。

| 名称                                                                                                                         | 演示                                              | 模型                  |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------- |
| [semantic-search-example](https://github.com/zilliztech/zilliz-cloud-typescript-example/tree/master/semantic-search-example) | https://zilliz-semantic-search-example.vercel.app | all-MiniLM-L6-v2      |
| [semantic-image-search](https://github.com/zilliztech/zilliz-cloud-typescript-example/tree/master/semantic-image-search)     |                                                   | clip-vit-base-patch16 |
| [semantic-image-search-client](https://github.com/zilliztech/zilliz-cloud-typescript-example/tree/master/semantic-image-search-client) | https://zilliz-semantic-image-search-client.vercel.app | clip-vit-base-patch16 |

## Milvus 相关链接

以下是一些有助于您入门 Milvus 的资源：

- [Milvus 文档](https://milvus.io/docs)：在这里，您可以找到有关如何使用 Milvus 的详细信息，包括安装说明、教程和 API 文档。
- [Milvus Python SDK](https://github.com/milvus-io/pymilvus)：Python SDK 允许您使用 Python 进行 Milvus 交互。它提供了一个简单直观的界面来创建和查询向量。
- [Milvus Java SDK](https://github.com/milvus-io/milvus-sdk-java)：Java SDK 类似于 Python SDK，但专为 Java 开发人员设计。它也提供了一个简单直观的界面来创建和查询向量。
- [Milvus Go SDK](https://github.com/milvus-io/milvus-sdk-go)：Go SDK 提供了 Milvus 的 Go API。如果您是 Go 开发人员，这是适合您的 SDK。
- [Milvus Node SDK](https://github.com/milvus-io/milvus-sdk-node)：Node SDK 提供了 Milvus 的 Node.js API。如果您是 Node.js 开发人员，这是适合您的 SDK。
- [Feder](https://github.com/zilliztech/feder)：Feder 是一个 JavaScript 工具，旨在帮助理解嵌入向量。

## 社区

💬 加入我们充满活力的 Milvus 社区，在那里您可以分享知识、提问并参与有意义的对话。这不仅仅是编码，更是与志同道合的人们交流。点击下面的链接立即加入！

<a href="https://discord.com/invite/8uyFbECzPX"><img style="display:block; margin: '8px';" src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0b5061df29d55a92d945_full_logo_blurple_RGB.svg" alt="license"/></a>

## 许可证

Attu Fusion 采用 [Apache License 2.0](LICENSE) 许可证。上游归属信息请参阅 [NOTICE.md](./NOTICE.md)。

## 更新日志

查看我们的 [CHANGELOG.md](CHANGELOG.md) 了解版本之间的变更。
