# Release Sync
A lightweight and reliable GitHub Action to synchronize release assets between GitHub Release and Gitee Release.

## 🚀 Key Features
- **Flexible Platform Selection**: Specify target platforms (GitHub/Gitee) to synchronize releases (support single or dual platform)
- **Automatic Release Creation**: Creates a new release if the specified tag doesn't have one
- **Draft & Pre-release Support**: Mark releases as draft (maintainer-only visible) or pre-release (unstable version flag)
- **Wildcard Support**: Upload multiple files using wildcards (e.g., `dist/*`, `build/*.zip`)
- **Configurable Metadata**: Customize release name, description, tag, and Gitee target commit/branch for both platforms
- **Secure Authentication**: Uses platform-specific personal access tokens (PAT) for secure API calls
- **Gitee Commit Association**: Specify the target branch or commit SHA that the Gitee release points to

## 📦 Prerequisites
1. **Gitee Personal Access Token (PAT) (Optional)**: 
   - Required **only if you need to sync to Gitee**
   - Create a PAT from [Gitee Settings](https://gitee.com/profile/personal_access_tokens) with `repo` permission
   - Store the token as a GitHub Secret (e.g., `GITEE_TOKEN`) in your repository
2. **GitHub Token (Optional)**: 
   - The default `GITHUB_TOKEN` (provided by GitHub Actions) is sufficient for most use cases
   - Custom PAT is optional for advanced permissions
   - Required **only if you need to sync to GitHub**

## 🛠 Usage
Add this action to your GitHub Workflow file (e.g., `.github/workflows/release-sync.yml`):

```yaml
name: Sync Release to GitHub & Gitee
on:
  push:
    tags:
      - 'v*'  # Trigger on tag pushes (e.g., v1.0.0, v2.1.5)

jobs:
  release-sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v6

      # Optional: Build your project to generate release assets
      - name: Build Release Assets
        run: |
          mkdir -p dist
          echo "Sample release asset" > dist/release-v${{ github.ref_name }}.txt
          zip -r dist/release-package-${{ github.ref_name }}.zip dist/

      - name: Sync Release Assets
        uses: YuZhiYuanOrg/release-sync@v1
        with:
          # Required: Target platforms (default: github,gitee)
          platforms: 'github,gitee'
          
          # Required: Release core metadata
          tag: ${{ github.ref_name }}
          release-name: "Release ${{ github.ref_name }}"
          
          # Optional: Release advanced configuration
          release-body: |
            ## What's New in ${{ github.ref_name }}
            - Feature 1: Add new sync functionality
            - Bug Fix: Resolve Gitee upload timeout issue
          draft: 'false'
          prerelease: 'false'
          
          # Optional: Gitee configuration (required if platforms include 'gitee')
          gitee-token: ${{ secrets.GITEE_TOKEN }}
          gitee-owner: 'your-gitee-username'       # e.g., "YuZhiYuanOrg"
          gitee-repo: 'your-gitee-repository'      # e.g., "release-sync-demo"
          gitee-target-commitish: 'main'           # Default: master, adjust if your default branch is main
          
          # Optional: Assets to upload (supports wildcards, spaces or multi-line separation)
          asset-files: |
            dist/*.txt
            dist/*.zip
          
          # Optional: GitHub token (default: ${{ github.token }})
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## ⚙️ Input Parameters
| Input | Required | Description | Default Value |
|-------|----------|-------------|---------------|
| `platforms` | ✅ | Target platforms to synchronize releases to, separated by commas (supported values: `github`, `gitee`) | `github,gitee` |
| `tag` | ✅ | Unique tag name for the release (e.g., v1.0.0) | `${{ github.ref_name }}` |
| `release-name` | ✅ | Human-readable display name for the release | `${{ github.ref_name }}` |
| `release-body` | ❌ | Detailed release notes content, supporting Markdown format | `Auto release by Release Sync` |
| `draft` | ❌ | Boolean flag (lowercase) to mark the release as a draft (maintainer-only visible) | `false` |
| `prerelease` | ❌ | Boolean flag (lowercase) to mark the release as a pre-release (unstable version) | `false` |
| `github-token` | ❌ | GitHub personal access token for authentication | `${{ github.token }}` |
| `gitee-token` | ❌ | Gitee personal access token with "repo" permission (required if `platforms` includes `gitee`) | N/A |
| `gitee-owner` | ❌ | Owner identifier of the target Gitee repository (required if `platforms` includes `gitee`) | N/A |
| `gitee-repo` | ❌ | Name of the target Gitee repository (required if `platforms` includes `gitee`) | N/A |
| `gitee-target-commitish` | ❌ | Target branch or commit SHA that the Gitee release points to | `master` |
| `asset-files` | ❌ | File path(s) or wildcard patterns for assets to upload, supporting spaces separation or multi-line configuration | N/A |

### Asset File Path Syntax Examples
- Single file: `dist/app-v1.0.0.zip`
- Multiple files (wildcard, space-separated): `dist/*.zip dist/*.tar.gz`
- Multiple paths (multi-line, more readable):
  ```
  dist/*.zip
  dist/*.tar.gz
  docs/release-notes.md
  ```
- All files in a directory: `dist/*`

## 📝 Important Notes
1. **Platform Configuration Logic**:
   - If you only need to sync to GitHub, set `platforms: 'github'` and omit all `gitee-*` parameters
   - If you only need to sync to Gitee, set `platforms: 'gitee'` and ensure all required `gitee-*` parameters are provided
2. **Gitee Default Branch Adjustment**: The default `gitee-target-commitish` is `master`. If your Gitee repository's default branch is `main` (or other names), manually specify this parameter to avoid association failures.
3. **File Size Limits**: 
   - GitHub: 2GB per asset (soft limit, larger files require Git LFS)
   - Gitee: 100MB per asset (check Gitee's latest limits for updates)
4. **Idempotent Execution**: Running the action multiple times for the same tag will reuse existing releases (no duplicate releases) and overwrite existing assets with the same name.
5. **Draft & Pre-release Behavior**:
   - `draft: 'true'`: Releases will not be publicly visible (only accessible to repository maintainers)
   - `prerelease: 'true'`: Releases will be marked as unstable and excluded from "latest release" listings
6. **Rate Limits**: Both GitHub and Gitee have API rate limits - ensure your workflow runs comply with platform limits (especially for large-scale releases).

## 🚨 Troubleshooting
- **Gitee Authentication Failed**: Verify your Gitee PAT has `repo` permission, the secret is correctly configured in GitHub, and `platforms` includes `gitee` (if needed).
- **File Not Found**: Check the `asset-files` path (use absolute paths or relative paths from the workflow working directory).
- **Gitee Release Creation Failed**: Confirm the tag exists in Gitee, the PAT has write access to the repository, and `gitee-target-commitish` corresponds to an existing branch/commit.
- **Draft/Pre-release Not Taking Effect**: Ensure the parameter value is lowercase (`true`/`false`) - uppercase or other formats (e.g., `True`, `1`) are not supported.
- **Platform Sync Skipped Unexpectedly**: Double-check the `platforms` parameter format (comma-separated, no spaces, supported values only: `github`, `gitee`).

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing
Contributions are welcome! Feel free to open issues or submit pull requests to improve functionality, fix bugs, or add documentation.

## 📞 Support
If you encounter issues or have questions, please open an issue in the [GitHub Repository](https://github.com/YuZhiYuanOrg/release-sync).
