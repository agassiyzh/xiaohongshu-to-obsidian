# 小红书独立导入器 v2.0

一个独立的小红书笔记导入工具，支持AI智能分类，无需依赖Obsidian。

## 新特性

- 🚀 **独立运行**: 无需安装Obsidian，直接使用命令行
- 🤖 **AI智能分类**: 支持OpenAI、Anthropic 和 DeepSeek AI 进行自动分类
- 📁 **智能文件夹管理**: 自动创建分类文件夹并整理笔记
- 📸 **媒体下载**: 可选择下载图片和视频到本地
- ☁️ **S3 云存储**: 支持上传媒体到 S3 兼容存储（MinIO、Cloudflare R2、AWS S3 等）
- 🔄 **媒体替换**: 批量替换 markdown 中的媒体链接为 S3 地址
- 🧹 **媒体清理**: 自动清理孤立的媒体文件
- 💻 **命令行界面**: 支持交互模式和批量处理
- ⚙️ **灵活配置**: 支持自定义分类、AI、S3 等设置

## 安装

```bash
# 克隆项目
git clone <repository-url>
cd xiaohongshu-importer

# 安装依赖
yarn install

# 构建项目
yarn build

# 全局安装（可选）
npm install -g .
```

## 快速开始

### 1. 基本使用

```bash
# 交互式导入
npx tsx src/cli.ts import

# 直接通过URL导入
npx tsx src/cli.ts import -u "https://www.xiaohongshu.com/explore/..."

# 指定分类
npx tsx src/cli.ts import -u "URL" -c "美食"

# 下载媒体文件
npx tsx src/cli.ts import -u "URL" --download-media
```

### 2. AI分类配置

```bash
# 配置OpenAI
npx tsx src/cli.ts config --set-ai-key "your-openai-api-key" --set-ai-provider openai

# 配置Anthropic Claude
npx tsx src/cli.ts config --set-ai-key "your-anthropic-api-key" --set-ai-provider anthropic

# 配置DeepSeek
npx tsx src/cli.ts config --set-ai-key "your-deepseek-api-key" --set-ai-provider deepseek

# 交互式配置
npx tsx src/cli.ts config

# 查看当前配置
npx tsx src/cli.ts config --show
```

### 3. 交互模式

```bash
# 启动交互模式
npx tsx src/cli.ts interactive
```

## 配置说明

配置文件位置：`xhs-importer.config.json`

```json
{
  "baseFolder": "XHS Notes",
  "categories": ["美食", "旅行", "娱乐", "知识", "工作", "情感", "个人成长", "优惠", "搞笑", "育儿"],
  "downloadMedia": true,
  "s3": {
    "enabled": false,
    "provider": "minio",
    "endpoint": "http://localhost:9000",
    "bucket": "",
    "accessKey": "",
    "secretKey": "",
    "region": "us-east-1",
    "pathPrefix": "xiaohongshu/",
    "uploadStrategy": "both",
    "retry": {
      "maxRetries": 3,
      "timeout": 60000
    }
  },
  "ai": {
    "enabled": false,
    "provider": "openai",
    "apiKey": "",
    "model": "gpt-3.5-turbo",
    "systemPrompt": "自定义AI分类提示词..."
  },
  "output": {
    "includeMediaInMarkdown": true,
    "createMediaFolder": true
  }
}
```

## AI分类功能

### 支持的AI提供商

1. **OpenAI GPT**
   - 模型：gpt-3.5-turbo, gpt-4, gpt-4-turbo
   - API Key：从OpenAI平台获取

2. **Anthropic Claude**
   - 模型：claude-3-haiku, claude-3-sonnet, claude-3-opus
   - API Key：从Anthropic平台获取

3. **DeepSeek**
   - 模型：deepseek-chat, deepseek-coder
   - API Key：从DeepSeek平台获取

### 分类逻辑

AI会基于以下信息进行分类：
- 笔记标题
- 笔记内容
- 标签信息
- 媒体类型（图片/视频）

### 备用分类方案

当AI分类不可用时，系统会使用基于关键词的简单分类作为备选方案。

## 输出结构

```
XHS Notes/
├── 美食/
│   ├── [V]红烧肉教程.md
│   └── 甜品制作分享.md
├── 旅行/
│   └── 三亚旅游攻略.md
├── 媒体/
│   ├── 红烧肉教程-0.jpg
│   ├── 红烧肉教程-video-0.mp4
│   └── 三亚旅游攻略-0.jpg
└── ...
```

## 命令行选项

### import 命令 - 导入笔记

```bash
xhs-import import [options]

选项:
  -u, --url <url>            直接指定URL导入
  -c, --category <category> 强制指定分类
  -d, --download-media       下载媒体文件到本地
  --no-download-media        不下载媒体文件
  --s3                       导入时上传媒体到 S3
  --s3-only                  只上传到 S3，不保留本地文件
```

### batch 命令 - 批量导入

```bash
xhs-import batch [options]

选项:
  -f, --file <path>          从文件读取URL列表
  -u, --urls <urls>          直接指定URL（逗号分隔）
  -c, --category <category>  强制指定所有笔记的分类
  -d, --download-media       下载媒体文件
  --no-download-media        不下载媒体文件
  --force-reimport           强制重新导入已存在的笔记
  -p, --parallel <number>   并发导入数量（默认3）
```

### replace-media 命令 - 替换媒体链接

```bash
xhs-import replace-media <directory> [options]

选项:
  -p, --preview              预览模式（查看哪些链接需要替换）
  --dry-run                  模拟替换（不实际修改）
  --execute                  执行替换
  --filter <filter>         过滤条件 (type:image, type:video)
  --backup                   替换前创建备份
  --force                    强制重新上传已存在的文件
  --continue-on-error        遇到错误继续处理
```

### cleanup-media 命令 - 清理孤立媒体

```bash
xhs-import cleanup-media <directory> [options]

选项:
  -p, --preview              预览模式（查看将被删除的文件）
  --dry-run                  模拟删除（不实际删除）
  --execute                  执行删除
```

### config 命令 - 配置管理

```bash
xhs-import config [options]

选项:
  --show                     显示当前配置
  --show-s3                  显示 S3 配置
  --set-ai-key <key>         设置 AI API 密钥
  --set-ai-provider <provider> 设置 AI 提供商 (openai/anthropic/deepseek)
  --set-base-folder <folder> 设置基础文件夹
  --enable-ai                启用 AI 分类
  --disable-ai               禁用 AI 分类
  --enable-s3                启用 S3 上传
  --disable-s3               禁用 S3 上传
  --set-s3-endpoint <url>    设置 S3 endpoint
  --set-s3-bucket <name>     设置 S3 bucket
  --set-s3-access-key <key> 设置 S3 access key
  --set-s3-secret-key <key> 设置 S3 secret key
  --set-s3-provider <provider> 设置 S3 provider (aws/minio/aliyun/tencent)
  --set-s3-region <region>   设置 S3 region
  --set-s3-path-prefix <prefix> 设置 S3 路径前缀
  --set-s3-strategy <strategy> 设置上传策略 (s3-only/local-only/both)
```

### 其他命令

```bash
xhs-import categories      # 显示可用分类
xhs-import history         # 查看导入历史
xhs-import history --export <file>  # 导出历史到 CSV
xhs-import interactive     # 启动交互模式
xhs-import --help          # 显示帮助信息
xhs-import --version       # 显示版本信息
```

## S3 配置指南

### 支持的存储服务

- **MinIO** - 自建 S3 兼容存储
- **Cloudflare R2** - 无出口流量费用
- **AWS S3** - Amazon S3
- **阿里云 OSS** - 阿里云对象存储
- **腾讯云 COS** - 腾讯云对象存储

### 配置示例

```bash
# MinIO / RustFS
xhs-import config --enable-s3 \
  --set-s3-endpoint http://localhost:9000 \
  --set-s3-bucket mybucket \
  --set-s3-access-key mykey \
  --set-s3-secret-key mysecret \
  --set-s3-provider minio

# Cloudflare R2
xhs-import config --enable-s3 \
  --set-s3-endpoint https://<account-id>.r2.cloudflarestorage.com \
  --set-s3-bucket mybucket \
  --set-s3-access-key mykey \
  --set-s3-secret-key mysecret \
  --set-s3-provider aws \
  --set-s3-region auto
```

### 使用流程

1. **配置 S3**
   ```bash
   xhs-import config --enable-s3 --set-s3-endpoint ... --set-s3-bucket ... --set-s3-access-key ... --set-s3-secret-key ...
   ```

2. **导入时上传**
   ```bash
   xhs-import import --url <url> --s3
   ```

3. **替换现有 markdown 中的链接**
   ```bash
   xhs-import replace-media ./XHS\ Notes --preview  # 预览
   xhs-import replace-media ./XHS\ Notes --execute  # 执行替换
   ```

4. **清理孤立媒体文件**
   ```bash
   xhs-import cleanup-media ./XHS\ Notes --preview  # 预览
   xhs-import cleanup-media ./XHS\ Notes --execute  # 执行删除
   ```

## 开发

```bash
# 开发模式（监听文件变化）
yarn dev

# 构建
yarn build

# 测试
yarn test
```

## 注意事项

1. **API限制**: 使用AI分类功能需要相应的API密钥，请注意API使用限制和费用
2. **网络访问**: 需要能够访问小红书网站和AI服务API
3. **存储空间**: 下载媒体文件会占用额外的存储空间
4. **合规使用**: 请遵守相关网站的使用条款和版权规定

## 故障排除

### 常见问题

1. **"No valid Xiaohongshu URL found"**
   - 确保粘贴的文本包含有效的小红书链接
   - 检查链接格式是否正确

2. **"AI categorization failed"**
   - 检查API密钥是否正确设置
   - 确认网络连接正常
   - 检查API配额是否充足

3. **"Failed to download media"**
   - 检查网络连接
   - 确认媒体链接是否有效
   - 检查磁盘空间是否充足

### 调试模式

可以通过环境变量启用详细日志：

```bash
DEBUG=1 xhs-import import -u "URL"
```

## 许可证

MIT License

## 更新日志

### v2.1.0
- 新增 S3 云存储支持（MinIO、Cloudflare R2、AWS S3 等）
- 新增 replace-media 命令：批量替换 markdown 中的媒体链接为 S3 地址
- 新增 cleanup-media 命令：清理孤立的媒体文件
- 支持导入时直接上传到 S3

### v2.0.0
- 完全重构为独立应用
- 添加 AI 智能分类功能
- 支持 OpenAI、Anthropic 和 DeepSeek
- 新增命令行界面
- 改进文件组织结构