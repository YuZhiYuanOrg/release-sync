# Release Sync Action

A lightweight and reliable GitHub Action to synchronize release assets between GitHub Release and Gitee Release. This action automates the process of uploading your build artifacts to both platforms with minimal configuration.

## 🚀 Key Features
- **Dual Platform Support**: Upload release assets to both GitHub Release and Gitee Release in one workflow
- **Automatic Release Creation**: Creates a new release if the specified tag doesn't have one (GitHub only; Gitee requires existing tag)
- **Wildcard Support**: Upload multiple files using wildcards (e.g., `dist/*`, `build/*.zip`)
- **Configurable Metadata**: Customize release name, description, and tag for both platforms
- **Secure Authentication**: Uses platform-specific personal access tokens (PAT) for secure API calls

## 📦 Prerequisites
1. **Gitee Personal Access Token (PAT)**: 
   - Create a PAT from [Gitee Settings](https://gitee.com/profile/personal_access_tokens) with `repo` permission
   - Store the token as a GitHub Secret (e.g., `GITEE_TOKEN`) in your repository
2. **GitHub Token**: 
   - The default `GITHUB_TOKEN` (provided by GitHub Actions) is sufficient for most use cases
   - Custom PAT is optional for advanced permissions
3. **Gitee Tag Requirement**: 
   - Ensure the target tag exists in your Gitee repository (Gitee API requires an existing tag to create a release)

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
        uses: actions/checkout@v4

      # Optional: Build your project to generate release assets
      - name: Build Release Assets
        run: |
          mkdir -p dist
          echo "Sample release asset" > dist/release-v${{ github.ref_name }}.txt
          zip -r dist/release-package-${{ github.ref_name }}.zip dist/

      - name: Sync Release Assets
        uses: YuZhiYuanOrg/release-sync@v1  # Replace with your actual action path/version
        with:
          # Required Gitee configuration
          gitee_token: ${{ secrets.GITEE_TOKEN }}
          gitee_owner: 'your-gitee-username'       # e.g., "YuZhiYuanOrg"
          gitee_repo: 'your-gitee-repository'      # e.g., "release-sync-demo"
          
          # Release metadata (optional customization)
          tag_name: ${{ github.ref_name }}         # Auto-use the pushed tag name
          release_name: "Release ${{ github.ref_name }}"
          body: |
            ## What's New in ${{ github.ref_name }}
            - Feature 1: Add new sync functionality
            - Bug Fix: Resolve Gitee upload timeout issue
          
          # Assets to upload (supports wildcards)
          files: |
            dist/*.txt
            dist/*.zip
          
          # Optional GitHub token (default: ${{ github.token }})
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## ⚙️ Input Parameters
| Input | Required | Description | Default Value |
|-------|----------|-------------|---------------|
| `gitee_token` | ✅ | Gitee personal access token (requires repo permission) | N/A |
| `gitee_owner` | ✅ | Gitee repository owner (username/organization name) | N/A |
| `gitee_repo` | ✅ | Gitee repository name | N/A |
| `tag_name` | ✅ | Release tag name (e.g., v1.0.0) | `${{ github.ref_name }}` |
| `release_name` | ✅ | Display name for the release | `${{ github.ref_name }}` |
| `body` | ❌ | Release description content (supports Markdown) | `Auto release by GitHub Action` |
| `files` | ✅ | Path to files to upload (supports wildcards, e.g., dist/*) | N/A |
| `github_token` | ❌ | GitHub personal access token | `${{ github.token }}` |

### File Path Syntax Examples
- Single file: `dist/app-v1.0.0.zip`
- Multiple files (wildcard): `dist/*`
- Multiple paths (multi-line):
  ```
  dist/*.zip
  dist/*.tar.gz
  docs/release-notes.md
  ```

## 📝 Important Notes
1. **Gitee Tag Requirement**: The action will fail if the specified `tag_name` does not exist in your Gitee repository. Push the tag to Gitee before running the action:
   ```bash
   git push gitee <tag-name>
   ```
2. **File Size Limits**: 
   - GitHub: 2GB per asset (soft limit, larger files require Git LFS)
   - Gitee: 100MB per asset (check Gitee's latest limits for updates)
3. **Idempotent Execution**: Running the action multiple times for the same tag will reuse existing releases (no duplicate releases) and overwrite existing assets with the same name.
4. **Rate Limits**: Both GitHub and Gitee have API rate limits - ensure your workflow runs comply with platform limits (especially for large-scale releases).

## 🚨 Troubleshooting
- **Gitee Authentication Failed**: Verify your Gitee PAT has `repo` permission and the secret is correctly configured in GitHub.
- **File Not Found**: Check the `files` path (use absolute paths or relative paths from the workflow working directory).
- **Gitee Release Creation Failed**: Confirm the tag exists in Gitee and the PAT has write access to the repository.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing
Contributions are welcome! Feel free to open issues or submit pull requests to improve functionality, fix bugs, or add documentation.

## 📞 Support
If you encounter issues or have questions, please open an issue in the [GitHub Repository](https://github.com/YuZhiYuanOrg/release-sync) (replace with your actual repo URL).
