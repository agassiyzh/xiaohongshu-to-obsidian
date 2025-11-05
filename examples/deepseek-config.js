/**
 * DeepSeek AI 配置示例
 */

const { XHSStandaloneImporter } = require('../dist/index.js');

async function deepSeekExample() {
  const importer = new XHSStandaloneImporter();

  // 初始化
  await importer.initialize();

  // 配置 DeepSeek
  await importer.updateConfig({
    ai: {
      enabled: true,
      provider: 'deepseek',
      apiKey: 'your-deepseek-api-key-here',
      model: 'deepseek-chat'
    }
  });

  console.log('DeepSeek AI 配置完成！');

  // 测试分类
  const testNote = {
    title: '家常红烧肉做法',
    content: '今天给大家分享一道经典的家常菜红烧肉的做法...',
    tags: ['美食', '烹饪', '家常菜'],
    isVideo: false
  };

  console.log('配置信息:', await importer.getConfig());
  console.log('可用分类:', await importer.getCategories());
}

// 运行示例
if (require.main === module) {
  deepSeekExample().catch(console.error);
}

module.exports = { deepSeekExample };
