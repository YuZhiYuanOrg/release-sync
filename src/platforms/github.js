const core = require('@actions/core');
const github = require('@actions/github');
const { getFileInfo } = require('../utils/fileHandler');

/**
 * GitHub Release发布方法
 * @param {Object} params 发布参数
 * @param {string} params.token GitHub Token
 * @param {string} params.tag 标签名（如v1.0.0）
 * @param {string} params.releaseName Release名称
 * @param {string} params.body Release描述内容
 * @param {boolean} params.draft 是否草稿
 * @param {boolean} params.prerelease 是否预发布
 * @param {Array<string>} params.assetFiles 资产文件绝对路径数组
 */
async function publishGitHubRelease({
  token,
  tag,
  releaseName,
  body,
  draft = false,
  prerelease = false,
  assetFiles = []
}) {
  try {
    core.info('开始发布GitHub Release...');
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;

    // 1. 创建GitHub Release
    const releaseResponse = await octokit.rest.repos.createRelease({
      owner,
      repo,
      tag_name: tag,
      name: releaseName,
      body,
      draft,
      prerelease
    });
    const releaseId = releaseResponse.data.id;
    core.info(`GitHub Release创建成功：${releaseResponse.data.html_url}`);

    // 2. 上传资产文件（如果有）
    if (assetFiles.length > 0) {
      core.info(`开始上传${assetFiles.length}个GitHub Release资产文件...`);
      for (const filePath of assetFiles) {
        const fileInfo = await getFileInfo(filePath);
        if (!fileInfo) continue;

        // GitHub资产上传API（支持二进制文件）
        await octokit.rest.repos.uploadReleaseAsset({
          owner,
          repo,
          release_id: releaseId,
          name: fileInfo.name,
          data: fileInfo.content
        });
        core.info(`GitHub资产文件上传成功：${fileInfo.name}`);
      }
    }

    return releaseResponse.data;
  } catch (error) {
    core.setFailed(`GitHub Release发布失败：${error.message}`);
    throw error;
  }
}

module.exports = { publishGitHubRelease };
