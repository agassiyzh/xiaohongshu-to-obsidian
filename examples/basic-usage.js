/**
 * 基本使用示例
 */

const { XHSStandaloneImporter } = require('../dist/index.js');

async function basicExample() {
  // 创建导入器实例
  const importer = new XHSStandaloneImporter();

  // 初始化
  await importer.initialize();

  try {
    // 示例1: 从分享文本导入（使用AI分类）
    console.log('=== 示例1: AI分类导入 ===');
    const shareText = '64 不叫小黄了发布了一篇小红书笔记，快来看看吧！ http://xhslink.com/a/abc123';

    const result1 = await importer.importFromShareText(shareText, {
      downloadMedia: true
    });

    console.log('导入结果:', result1);

    // 示例2: 强制指定分类
    console.log('\n=== 示例2: 强制分类导入 ===');
    const result2 = await importer.importFromShareText(shareText, {
      downloadMedia: false,
      forceCategory: '美食'
    });

    console.log('导入结果:', result2);

    // 示例3: 直接从URL导入
    console.log('\n=== 示例3: 直接URL导入 ===');
    const url = 'https://www.xiaohongshu.com/explore/xyz789';
    const result3 = await importer.importFromUrl(url, {
      downloadMedia: true
    });

    console.log('导入结果:', result3);

  } catch (error) {
    console.error('导入失败:', error.message);
  }
}

async function configExample() {
  const importer = new XHSStandaloneImporter();
  await importer.initialize();

  // 查看当前配置
  console.log('当前配置:', await importer.getConfig());

  // 更新配置
  await importer.updateConfig({
    ai: {
      enabled: true,
      provider: 'openai',
      apiKey: 'your-openai-api-key-here',
      model: 'gpt-3.5-turbo'
    }
  });

  // 查看可用分类
  console.log('可用分类:', await importer.getCategories());
}

// 运行示例
if (require.main === module) {
  basicExample().catch(console.error);
  // configExample().catch(console.error);
}

module.exports = { basicExample, configExample };
