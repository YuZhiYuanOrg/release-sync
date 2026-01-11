const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

/**
 * Gitee Release发布方法（基于Gitee Open API）
 * @param {Object} params 发布参数
 * @param {string} params.token Gitee私人令牌
 * @param {string} params.owner Gitee仓库所有者（用户名/组织名）
 * @param {string} params.repo Gitee仓库名
 * @param {string} params.tag 标签名（如v1.0.0）
 * @param {string} params.releaseName Release名称
 * @param {string} params.body Release描述内容
 * @param {boolean} params.prerelease 是否为预览版本
 * @param {string} params.targetCommitish 分支名称或commit SHA，默认master分支
 * @param {Array<string>} params.assetFiles 资产文件绝对路径数组
 */
async function publishGiteeRelease({
    token,
    owner,
    repo,
    tag,
    releaseName,
    body,
    prerelease,
    targetCommitish = "master",
    assetFiles
}) {
    try {
        const baseUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}`;

        // 1. 检查标签是否存在，不存在则创建
        try {
            await axios.get(`${baseUrl}/tags/${tag}`, {
                params: { access_token: token },
                timeout: 30000,
                headers: {
                    'User-Agent': 'Release Sync'
                }
            });
        } catch (error) {
            if (error.response && error.response.status === 404) {
                // 准备创建标签的参数
                const tagData = new FormData();
                tagData.append('access_token', token);
                tagData.append('tag_name', tag);
                tagData.append('refs', targetCommitish);

                // 创建标签的请求头
                const tagHeaders = {
                    ...tagData.getHeaders(),
                    'User-Agent': 'Release Sync',
                    'Accept': 'application/json'
                };

                // 发送创建标签请求
                await axios.post(
                    `${baseUrl}/tags`,
                    tagData,
                    {
                        headers: tagHeaders,
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                        timeout: 60000
                    }
                );
            } else {
                throw error;
            }
        }

        // 2. 创建Gitee Release
        const formData = new FormData();
        formData.append('tag_name', tag);
        formData.append('name', releaseName);
        formData.append('body', body);
        formData.append('prerelease', prerelease.toString());
        formData.append('target_commitish', targetCommitish);

        // 构建请求头
        const headers = {
            ...formData.getHeaders(),
            'User-Agent': 'Release Sync',
            'Accept': 'application/json'
        };

        // 发送创建Release请求
        const releaseUrl = `${baseUrl}/releases?access_token=${encodeURIComponent(token)}`;
        await axios.post(
            releaseUrl,
            formData,
            {
                headers: headers,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 60000
            }
        );

        // 3. 上传资产文件（如有）
        if (assetFiles.length > 0) {
            // 根据Tag名称获取Release ID
            let releaseId;
            const getReleaseResponse = await axios.get(
                `${baseUrl}/releases/tags/${encodeURIComponent(tag)}`,
                {
                    params: { access_token: token },
                    headers: {
                        'User-Agent': 'Release Sync',
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            if (getReleaseResponse.data && getReleaseResponse.data.id) {
                releaseId = getReleaseResponse.data.id;
            } else {
                throw new Error('无法获取有效的Release ID');
            }

            // 批量上传资产文件
            for (let i = 0; i < assetFiles.length; i++) {
                const filePath = assetFiles[i];
                
                // 跳过不存在的文件
                if (!fs.existsSync(filePath)) {
                    continue;
                }

                // 读取文件信息和内容
                const fileStats = fs.statSync(filePath);
                const fileContent = fs.readFileSync(filePath);
                const fileName = path.basename(filePath);

                // 准备上传表单数据
                const uploadFormData = new FormData();
                uploadFormData.append('access_token', token);
                uploadFormData.append('file', fileContent, {
                    filename: fileName,
                    knownLength: fileStats.size
                });

                // 构建上传请求头
                const uploadHeaders = {
                    ...uploadFormData.getHeaders(),
                    'User-Agent': 'Release Sync',
                    'Accept': 'application/json'
                };

                // 发送文件上传请求
                try {
                    await axios.post(
                        `${baseUrl}/releases/${releaseId}/attach_files`,
                        uploadFormData,
                        {
                            headers: uploadHeaders,
                            maxContentLength: Infinity,
                            maxBodyLength: Infinity,
                            timeout: 300000
                        }
                    );
                } catch (uploadError) {
                    // 单个文件上传失败不中断整体流程，继续处理下一个文件
                    continue;
                }
            }
        }
    } catch (error) {
        throw error;
    }
}

module.exports = { publishGiteeRelease };
