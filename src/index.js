const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 读取输入参数
const getInputs = () => {
  return {
    giteeToken: core.getInput('gitee_token', { required: true }),
    giteeOwner: core.getInput('gitee_owner', { required: true }),
    giteeRepo: core.getInput('gitee_repo', { required: true }),
    tagName: core.getInput('tag_name', { required: true }),
    releaseName: core.getInput('release_name', { required: true }),
    body: core.getInput('body'),
    files: core.getInput('files', { required: true }),
    githubToken: core.getInput('github_token')
  };
};

// 1. 上传文件到GitHub Release
const uploadToGitHub = async (inputs, files) => {
  core.info('开始上传文件到GitHub Release...');
  const octokit = github.getOctokit(inputs.githubToken);
  const { owner, repo } = github.context.repo;

  // 获取或创建GitHub Release
  let release;
  try {
    release = await octokit.rest.repos.getReleaseByTag({
      owner,
      repo,
      tag: inputs.tagName
    });
    core.info(`找到已存在的GitHub Release: ${release.data.id}`);
  } catch (err) {
    if (err.status === 404) {
      release = await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: inputs.tagName,
        name: inputs.releaseName,
        body: inputs.body,
        draft: false,
        prerelease: false
      });
      core.info(`创建新的GitHub Release: ${release.data.id}`);
    } else {
      throw new Error(`获取/创建GitHub Release失败: ${err.message}`);
    }
  }

  // 上传文件
  for (const file of files) {
    const fileName = path.basename(file);
    const fileContent = fs.readFileSync(file);
    core.info(`上传文件到GitHub: ${fileName}`);
    
    await octokit.rest.repos.uploadReleaseAsset({
      owner,
      repo,
      release_id: release.data.id,
      name: fileName,
      data: fileContent
    });
  }
  core.info('GitHub Release上传完成');
};

// 2. 上传文件到Gitee Release
const uploadToGitee = async (inputs, files) => {
  core.info('开始上传文件到Gitee Release...');
  const giteeApi = 'https://gitee.com/api/v5';
  const headers = {
    'Authorization': `token ${inputs.giteeToken}`,
    'Content-Type': 'application/json'
  };

  // 步骤1: 获取Gitee仓库的tag（确保tag存在）
  try {
    await axios.get(`${giteeApi}/repos/${inputs.giteeOwner}/${inputs.giteeRepo}/tags/${inputs.tagName}`, { headers });
    core.info(`找到Gitee tag: ${inputs.tagName}`);
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error(`Gitee仓库不存在tag ${inputs.tagName}，请先推送tag到Gitee`);
    } else {
      throw new Error(`检查Gitee tag失败: ${err.message}`);
    }
  }

  // 步骤2: 获取或创建Gitee Release
  let releaseId;
  try {
    const res = await axios.get(`${giteeApi}/repos/${inputs.giteeOwner}/${inputs.giteeRepo}/releases`, { headers });
    const existingRelease = res.data.find(item => item.tag_name === inputs.tagName);
    if (existingRelease) {
      releaseId = existingRelease.id;
      core.info(`找到已存在的Gitee Release: ${releaseId}`);
    } else {
      const createRes = await axios.post(
        `${giteeApi}/repos/${inputs.giteeOwner}/${inputs.giteeRepo}/releases`,
        {
          tag_name: inputs.tagName,
          name: inputs.releaseName,
          body: inputs.body,
          draft: false,
          prerelease: false
        },
        { headers }
      );
      releaseId = createRes.data.id;
      core.info(`创建新的Gitee Release: ${releaseId}`);
    }
  } catch (err) {
    throw new Error(`获取/创建Gitee Release失败: ${err.message}`);
  }

  // 步骤3: 上传文件到Gitee Release
  for (const file of files) {
    const fileName = path.basename(file);
    core.info(`上传文件到Gitee: ${fileName}`);

    // 第一步：获取上传凭证
    const uploadRes = await axios.post(
      `${giteeApi}/repos/${inputs.giteeOwner}/${inputs.giteeRepo}/releases/${releaseId}/assets/pre_upload`,
      { name: fileName },
      { headers }
    );
    const uploadUrl = uploadRes.data.upload_url;
    const assetId = uploadRes.data.id;

    // 第二步：上传文件（form-data格式）
    const fileContent = fs.readFileSync(file);
    await axios.post(
      uploadUrl,
      { file: fileContent },
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    // 第三步：确认上传
    await axios.post(
      `${giteeApi}/repos/${inputs.giteeOwner}/${inputs.giteeRepo}/releases/${releaseId}/assets/${assetId}/confirm`,
      {},
      { headers }
    );
  }
  core.info('Gitee Release上传完成');
};

// 主函数
const run = async () => {
  try {
    const inputs = getInputs();
    
    // 解析文件路径（支持通配符）
    const files = glob.sync(inputs.files);
    if (files.length === 0) {
      throw new Error(`未找到匹配的文件: ${inputs.files}`);
    }
    core.info(`找到待上传文件: ${files.join(', ')}`);

    // 上传到GitHub Release
    await uploadToGitHub(inputs, files);

    // 上传到Gitee Release
    await uploadToGitee(inputs, files);

    core.info('所有文件上传完成！');
  } catch (error) {
    core.setFailed(`执行失败: ${error.message}`);
  }
};

run();
