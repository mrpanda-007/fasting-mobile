# Deploy the privacy policy

The policy page is at `docs/privacy-policy/index.html`. The included GitHub Actions workflow publishes the `docs` directory whenever a change is pushed to `master`.

## One-time GitHub setup

1. Push this repository to `https://github.com/mrpanda-007/fasting-mobile`.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Push or manually run the **Deploy privacy policy** workflow from the Actions tab.

The public policy address will be:

`https://mrpanda-007.github.io/fasting-mobile/privacy-policy/`

Paste that HTTPS address into the Privacy policy field in Google Play Console. If the GitHub account, repository name, or Pages custom domain changes, update the policy URL in Play Console.

## Play Console data-safety answers for the current build

Based on the current source code, the app does not collect or share user data: fasting and preference data stays on-device, and notifications are local. Select the equivalent of **No** for data collection and sharing. Recheck this answer and this policy before every release, especially if you add an account, analytics, crash reporting, cloud backup/sync, advertising, or a third-party SDK that handles data.

Google Play requires the Data safety form and the policy to match the app's actual data practices. The policy must also be linked in the Play listing and be available inside the app.
