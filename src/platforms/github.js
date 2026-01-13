const core = require('@actions/core');
const github = require('@actions/github');
const { getFileInfo } = require('../utils/fileHandler');

/**
 * Publishes a new release to a GitHub repository with optional release assets.
 * 
 * This function creates a formal GitHub Release associated with a specific git tag,
 * and optionally uploads multiple asset files to the created release. It leverages
 * the Octokit REST client to interact with the GitHub API, and integrates with
 * GitHub Actions core to provide logging and failure reporting.
 * 
 * @async
 * @function publishGitHubRelease
 * @param {Object} options - Configuration options for creating the GitHub Release
 * @param {string} options.token - GitHub personal access token (PAT) with repo scope permissions
 * @param {string} options.tag - The git tag name to associate with the release (e.g., "v1.0.0")
 * @param {string} options.releaseName - Human-readable display name for the release
 * @param {string} options.body - Markdown-formatted release notes/description for the release
 * @param {boolean} options.draft - Whether the release should be a draft (unpublished)
 * @param {boolean} options.prerelease - Whether the release should be marked as a prerelease
 * @param {string[]} [options.assetFiles] - Array of file paths to upload as release assets
 * @returns {Promise<Object>} Promise resolving to the full GitHub Release API response data
 * @throws {Error} Throws an error if the GitHub API request fails or asset upload encounters issues
 */
async function publishGitHubRelease({
    token,
    tag,
    releaseName,
    body,
    draft,
    prerelease,
    assetFiles
}) {
    try {
        // Log the initialization of the GitHub Release publishing process
        core.info('Initializing GitHub Release publishing process...');
        
        // Initialize Octokit client with the provided GitHub token for API authentication
        core.info(`Creating Octokit client instance with provided authentication token`);
        const octokit = github.getOctokit(token);
        
        // Extract repository owner and name from the current GitHub Actions context
        const { owner, repo } = github.context.repo;
        core.info(`Extracted repository context - Owner: ${owner}, Repository: ${repo}`);

        // Log the release configuration before making the API request
        core.info(`Preparing to create GitHub Release with the following configuration:`);
        core.info(`  - Tag Name: ${tag}`);
        core.info(`  - Release Name: ${releaseName}`);
        core.info(`  - Draft Status: ${draft ? 'Enabled' : 'Disabled'}`);
        core.info(`  - Prerelease Status: ${prerelease ? 'Enabled' : 'Disabled'}`);
        core.info(`  - Number of Assets to Upload: ${assetFiles.length}`);

        // Create the formal GitHub Release via the REST API
        core.info(`Initiating GitHub Release creation for tag: ${tag}`);
        const releaseResponse = await octokit.rest.repos.createRelease({
            owner,
            repo,
            tag_name: tag,
            name: releaseName,
            body,
            draft,
            prerelease
        });

        // Extract and log the created release ID and URL
        const releaseId = releaseResponse.data.id;
        const releaseUrl = releaseResponse.data.html_url;
        core.info(`Successfully created GitHub Release - ID: ${releaseId}, URL: ${releaseUrl}`);

        // Process and upload all specified release assets if the asset list is not empty
        if (assetFiles.length > 0) {
            core.info(`Starting processing of ${assetFiles.length} release asset(s)`);
            
            for (const [index, filePath] of assetFiles.entries()) {
                core.info(`Processing asset ${index + 1}/${assetFiles.length}: ${filePath}`);
                
                // Retrieve file metadata and content using the external file handler utility
                core.info(`Fetching file information for asset: ${filePath}`);
                const fileInfo = await getFileInfo(filePath);
                
                // Skip the asset if file information retrieval fails
                if (!fileInfo) {
                    core.warning(`Skipping asset ${filePath} - Failed to retrieve valid file information`);
                    continue;
                }
                
                core.info(`Initiating upload of asset: ${fileInfo.name} (Size: ${Buffer.byteLength(fileInfo.content)} bytes)`);
                
                // Upload the asset to the previously created GitHub Release
                await octokit.rest.repos.uploadReleaseAsset({
                    owner,
                    repo,
                    release_id: releaseId,
                    name: fileInfo.name,
                    data: fileInfo.content
                });
                
                core.info(`Successfully uploaded asset ${index + 1}/${assetFiles.length}: ${fileInfo.name}`);
            }
            
            core.info(`Completed processing of all ${assetFiles.length} release asset(s)`);
        } else {
            core.info(`No release assets specified - Skipping asset upload step`);
        }

        // Return the full release response data for further processing by the caller
        core.info(`GitHub Release publishing process completed successfully`);
        return releaseResponse.data;
        
    } catch (error) {
        // Log the fatal error and set the GitHub Actions workflow status to failed
        const errorMessage = `GitHub Release publication failed: ${error.message}`;
        core.error(errorMessage);
        core.setFailed(errorMessage);
        
        // Re-throw the error to allow upstream callers to handle it if necessary
        throw error;
    }
}

module.exports = { publishGitHubRelease };
