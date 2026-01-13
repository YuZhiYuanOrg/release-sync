/**
 * Module for publishing software releases to code hosting platforms (GitHub and Gitee).
 */

// Import release publishing functions from the corresponding platform-specific modules
const { publishGitHubRelease } = require('./github');
const { publishGiteeRelease } = require('./gitee');

// Export platform-specific release publishing functions for external module invocation
module.exports = {
    /**
     * Publish a software release to the GitHub platform.
     */
    github: publishGitHubRelease,
    
    /**
     * Publish a software release to the Gitee platform.
     */
    gitee: publishGiteeRelease
};
