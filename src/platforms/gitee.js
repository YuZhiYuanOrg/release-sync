const axios = require('axios');
const FormData = require('form-data');
const { getFileInfo } = require('../utils/fileHandler');

/**
 * Publishes a new release on Gitee with optional asset file attachments.
 * 
 * This function performs the following steps in sequence:
 * 1. Checks if the specified tag exists; creates it if not found (404 error).
 * 2. Creates a new release associated with the target tag.
 * 3. Retrieves the newly created release ID (required for asset uploads).
 * 4. Uploads all specified asset files to the release (if assetFiles is provided and non-empty).
 * 
 * @async
 * @function publishGiteeRelease
 * @param {Object} options - Configuration options for publishing the Gitee release
 * @param {string} options.token - Gitee personal access token for API authentication
 * @param {string} options.owner - Gitee repository owner (username or organization name)
 * @param {string} options.repo - Gitee repository name (without the owner prefix)
 * @param {string} options.tag - Tag name associated with the release (e.g., "v1.0.0")
 * @param {string} options.releaseName - Display name/title of the release
 * @param {string} options.body - Release description/notes (supports Markdown)
 * @param {boolean} options.prerelease - Flag indicating if the release is a pre-release (beta/alpha)
 * @param {string} options.targetCommitish - Git commit SHA or branch name to associate the tag/release with
 * @param {string[]} [options.assetFiles] - Optional array of file paths to upload as release assets
 * @throws {Error} Throws an error if any step of the release/asset upload process fails (non-404 tag errors, release creation failures, etc.)
 */
async function publishGiteeRelease({
    token,
    owner,
    repo,
    tag,
    releaseName,
    body,
    prerelease,
    targetCommitish,
    assetFiles
}) {
    try {
        // Base URL for Gitee repository API endpoints
        const baseUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}`;
        console.log(`[INFO] Starting Gitee release publication process - Owner: ${owner}, Repo: ${repo}, Tag: ${tag}`);

        // Step 1: Check if the target tag exists; create it if it does not
        try {
            console.log(`[INFO] Checking if tag "${tag}" already exists in repository ${owner}/${repo}`);
            await axios.get(`${baseUrl}/tags/${tag}`, {
                params: { access_token: token },
                timeout: 30000,
                headers: {
                    'User-Agent': 'Release Sync'
                }
            });
            console.log(`[INFO] Tag "${tag}" already exists, skipping tag creation`);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log(`[WARN] Tag "${tag}" not found (404), proceeding to create new tag`);
                
                const tagData = new FormData();
                tagData.append('access_token', token);
                tagData.append('tag_name', tag);
                tagData.append('refs', targetCommitish);

                const tagHeaders = {
                    ...tagData.getHeaders(),
                    'User-Agent': 'Release Sync',
                    'Accept': 'application/json'
                };

                console.log(`[INFO] Sending request to create tag "${tag}" pointing to commit/branch "${targetCommitish}"`);
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
                console.log(`[SUCCESS] Tag "${tag}" has been created successfully`);
            } else {
                console.error(`[ERROR] Failed to check or create tag "${tag}": ${error.message || 'Unknown error occurred'}`);
                throw error;
            }
        }

        // Step 2: Prepare form data for release creation
        const formData = new FormData();
        formData.append('tag_name', tag);
        formData.append('name', releaseName);
        formData.append('body', body);
        formData.append('prerelease', prerelease.toString());
        formData.append('target_commitish', targetCommitish);

        const headers = {
            ...formData.getHeaders(),
            'User-Agent': 'Release Sync',
            'Accept': 'application/json'
        };

        const releaseUrl = `${baseUrl}/releases?access_token=${encodeURIComponent(token)}`;
        
        // Step 3: Create the new release on Gitee
        try {
            console.log(`[INFO] Sending request to create release "${releaseName}" for tag "${tag}"`);
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
            console.log(`[SUCCESS] Release "${releaseName}" has been created successfully`);
        } catch (releaseError) {
            console.error(`[ERROR] Failed to create release "${releaseName}": ${releaseError.message || 'Unknown release creation error'}`);
            throw releaseError;
        }

        // Step 4: Upload asset files to the release (if assetFiles is provided and non-empty)
        if (assetFiles && assetFiles.length > 0) {
            console.log(`[INFO] Found ${assetFiles.length} asset file(s) to upload, starting asset upload process`);
            let releaseId;

            // Retrieve the release ID (required for attaching assets)
            try {
                console.log(`[INFO] Retrieving release ID for tag "${tag}"`);
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
                    console.log(`[INFO] Successfully retrieved release ID: ${releaseId} for tag "${tag}"`);
                } else {
                    throw new Error('Failed to retrieve a valid Release ID from Gitee API response');
                }
            } catch (getReleaseError) {
                console.error(`[ERROR] Failed to retrieve release ID for tag "${tag}": ${getReleaseError.message || 'Unknown error'}`);
                throw getReleaseError;
            }

            // Track asset upload statistics
            let successCount = 0;
            let skipCount = 0;
            let failCount = 0;

            // Iterate through all asset files and upload them one by one
            for (let i = 0; i < assetFiles.length; i++) {
                const filePath = assetFiles[i];
                console.log(`[INFO] Processing asset file ${i + 1}/${assetFiles.length}: ${filePath}`);

                try {
                    const fileInfo = await getFileInfo(filePath);

                    if (!fileInfo) {
                        console.warn(`[WARN] No valid file information retrieved for "${filePath}", skipping this file`);
                        skipCount++;
                        continue;
                    }

                    // Prepare form data for asset upload
                    const uploadFormData = new FormData();
                    uploadFormData.append('access_token', token);
                    uploadFormData.append('file', fileInfo.content, {
                        filename: fileInfo.name,
                        knownLength: fileInfo.size
                    });

                    const uploadHeaders = {
                        ...uploadFormData.getHeaders(),
                        'User-Agent': 'Release Sync',
                        'Accept': 'application/json'
                    };

                    // Upload the asset file to the release
                    console.log(`[INFO] Uploading asset file "${fileInfo.name}" (${fileInfo.size} bytes) to release ${releaseId}`);
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
                    
                    successCount++;
                    console.log(`[SUCCESS] Asset file "${fileInfo.name}" has been uploaded successfully`);
                } catch (uploadError) {
                    failCount++;
                    console.error(`[ERROR] Failed to upload asset file "${filePath}": ${uploadError.message || 'Unknown upload error'}`);
                    continue;
                }
            }

            // Log final asset upload statistics
            console.log(`[SUMMARY] Asset upload process completed - Success: ${successCount}, Skipped: ${skipCount}, Failed: ${failCount}`);
        } else {
            console.log(`[INFO] No asset files provided, skipping asset upload process`);
        }

        console.log(`[SUCCESS] Gitee release publication process completed successfully for tag "${tag}"`);
    } catch (error) {
        console.error(`[FATAL] Gitee release publication process failed: ${error.message || 'Unknown fatal error'}`);
        throw error;
    }
}

module.exports = { publishGiteeRelease };
