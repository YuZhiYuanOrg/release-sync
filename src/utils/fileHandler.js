const core = require('@actions/core');
const fs = require('fs').promises;
const fsExtra = require('fs-extra');
const path = require('path');
const glob = require('glob');

/**
 * 解析资产文件路径（支持通配符、逗号分隔多文件）
 * @param {string} assetInput Action输入的asset-files参数
 * @returns {Array<string>} 解析后的绝对文件路径数组
 */
function resolveAssetFiles(assetInput) {
  if (!assetInput) return [];

  return assetInput
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .flatMap(pattern => {
      // 处理通配符（如./dist/*.zip）
      return glob.sync(pattern, { absolute: true, nodir: true });
    })
    .filter((filePath, index, self) => {
      // 去重
      const isUnique = self.indexOf(filePath) === index;
      // 验证文件是否存在（同步验证，避免异步嵌套）
      const fileExists = fsExtra.existsSync(filePath);
      if (!fileExists) {
        core.warning(`资产文件不存在，已跳过：${filePath}`);
      }
      return isUnique && fileExists;
    });
}

/**
 * 获取文件信息（文件名、文件大小、读取文件内容）
 * @param {string} filePath 文件绝对路径
 * @returns {Object} 文件信息（name: 文件名, size: 文件大小, content: 文件二进制内容）
 */
async function getFileInfo(filePath) {
  try {
    const fileName = path.basename(filePath);
    const fileStat = await fs.stat(filePath);
    const fileContent = await fs.readFile(filePath);

    return {
      name: fileName,
      size: fileStat.size,
      content: fileContent
    };
  } catch (error) {
    core.warning(`获取文件信息失败，已跳过：${filePath}，错误：${error.message}`);
    return null;
  }
}

module.exports = {
  resolveAssetFiles,
  getFileInfo
};
