const core = require('@actions/core');
const axios = require('axios');
const FormData = require('form-data');
const { getFileInfo } = require('../utils/fileHandler');

/**
 * Gitee Release发布方法（基于Gitee Open API）
 * @param {Object} params 发布参数
 * @param {string} params.token Gitee私人令牌
 * @param {string} params.owner Gitee仓库所有者（用户名/组织名）
 * @param {string} params.repo Gitee仓库名
 * @param {string} params.tag 标签名（如v1.0.0）
 * @param {string} params.releaseName Release名称
 * @param {string} params.body Release描述内容
 * @param {boolean} params.draft 是否草稿
 * @param {Array<string>} params.assetFiles 资产文件绝对路径数组
 */
async function publishGiteeRelease({
  token,
  owner,
  repo,
  tag,
  releaseName,
  body,
  draft = false,
  assetFiles = []
}) {
  try {
    core.info('开始发布Gitee Release...');
    const baseUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}`;
    const headers = { Authorization: `token ${token}` };

    // 1. 检查标签是否存在
    await axios.get(`${baseUrl}/tags/${tag}`, { headers });

    // 2. 创建Gitee Release
    const releaseResponse = await axios.post(
      `${baseUrl}/releases`,
      {
        tag_name: tag,
        name: releaseName,
        body,
        draft
      },
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      }
    );
    const releaseId = releaseResponse.data.id;
    core.info(`Gitee Release创建成功：${releaseResponse.data.html_url}`);

    // 3. 上传资产文件（如果有，Gitee需要先获取上传地址，再提交文件）
    if (assetFiles.length > 0) {
      core.info(`开始上传${assetFiles.length}个Gitee Release资产文件...`);
      for (const filePath of assetFiles) {
        const fileInfo = await getFileInfo(filePath);
        if (!fileInfo) continue;

        // 3.1 获取Gitee资产上传地址
        const uploadUrlResponse = await axios.post(
          `${baseUrl}/releases/${releaseId}/assets/upload`,
          { name: fileInfo.name },
          { headers }
        );
        const uploadUrl = uploadUrlResponse.data.upload_url;

        // 3.2 提交文件到上传地址（Gitee要求multipart/form-data格式）
        const formData = new FormData();
        formData.append('file', fileInfo.content, {
          filename: fileInfo.name,
          knownLength: fileInfo.size
        });

        await axios.post(uploadUrl, formData, {
          headers: formData.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });
        core.info(`Gitee资产文件上传成功：${fileInfo.name}`);
      }
    }

    return releaseResponse.data;
  } catch (error) {
    core.setFailed(`Gitee Release发布失败：${error.response?.data?.message || error.message}`);
    throw error;
  }
}

module.exports = { publishGiteeRelease };
