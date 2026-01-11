const core = require('@actions/core');
const platforms = require('./platforms');
const { resolveAssetFiles } = require('./utils/fileHandler');

async function main() {
  try {
    // ========== 1. 读取Action输入参数 ==========
    // 要同步的平台（逗号分隔，如github,gitee 或仅github）
    const syncPlatforms = core.getInput('sync-platforms', { required: true })
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean); // 过滤空值
    
    // 通用Release配置
    const tag = core.getInput('tag', { required: true });
    const releaseName = core.getInput('release-name', { required: true });
    const body = core.getInput('release-body', { required: false }) || '';
    const draft = core.getBooleanInput('draft', { required: false }) || false;
    const prerelease = core.getBooleanInput('prerelease', { required: false }) || false;
    // 新增：解析资产文件
    const assetInput = core.getInput('asset-files', { required: false });
    const assetFiles = resolveAssetFiles(assetInput);

    // 各平台专属配置
    const githubToken = core.getInput('github-token', { required: false });
    const giteeToken = core.getInput('gitee-token', { required: false });
    const giteeOwner = core.getInput('gitee-owner', { required: false });
    const giteeRepo = core.getInput('gitee-repo', { required: false });

    // ========== 2. 验证平台配置 ==========
    for (const platform of syncPlatforms) {
      if (!platforms[platform]) {
        core.setFailed(`不支持的平台：${platform}，请检查sync-platforms输入`);
        return;
      }
      // 验证对应平台的必填配置
      if (platform === 'github' && !githubToken) {
        core.setFailed('同步GitHub时，必须提供github-token参数');
        return;
      }
      if (platform === 'gitee' && (!giteeToken || !giteeOwner || !giteeRepo)) {
        core.setFailed('同步Gitee时，必须提供gitee-token、gitee-owner、gitee-repo参数');
        return;
      }
    }

    // ========== 3. 按平台执行发布 ==========
    for (const platform of syncPlatforms) {
      core.info(`开始处理平台：${platform}`);
      switch (platform) {
        case 'github':
          await platforms.github({
            token: githubToken,
            tag,
            releaseName,
            body,
            draft,
            prerelease,
            assetFiles // 传递资产文件
          });
          break;
        case 'gitee':
          await platforms.gitee({
            token: giteeToken,
            owner: giteeOwner,
            repo: giteeRepo,
            tag,
            releaseName,
            body,
            draft,
            assetFiles // 传递资产文件
          });
          break;
        // 扩展新平台：新增case即可（如gitlab）
        // case 'gitlab':
        //   await platforms.gitlab({...});
        //   break;
        default:
          core.warning(`跳过未实现的平台：${platform}`);
      }
    }

    core.info('所有指定平台的Release同步（含资产文件）完成！');
  } catch (error) {
    core.setFailed(`Release同步失败：${error.message}`);
  }
}

// 执行主流程
main();
