// 统一导出所有平台的发布方法，扩展新平台只需在这里新增
const { publishGitHubRelease } = require('./github');
const { publishGiteeRelease } = require('./gitee');

module.exports = {
  github: publishGitHubRelease,
  gitee: publishGiteeRelease
  // 扩展示例：gitlab: publishGitLabRelease（新增gitlab.js后加这里）
};
