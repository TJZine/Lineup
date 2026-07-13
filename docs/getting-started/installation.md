# Installation Guide

This guide covers the installation of Lineup on your LG Smart TV.

> [!NOTE]
> Lineup does not currently publish a prebuilt IPK on GitHub Releases or the LG
> Content Store. Installation requires Developer Mode and an IPK built from source
> or, when available, a short-lived GitHub Actions artifact.

## Prerequisites

- **PC or Mac** with internet access
- **LG Smart TV** (2021+ / webOS 6.0+) connected to the same network
- **LG Developer Account** (Free, create at [webostv.developer.lge.com](https://webostv.developer.lge.com))

## Step 1: Install Developer Mode App on TV

1. Turn on your LG TV.
2. Open the **LG Content Store**.
3. Search for **"Developer Mode"**.
4. Install the application.

## Step 2: Enable Developer Mode

1. Open the **Developer Mode** app on your TV.
2. Log in with your LG Developer Account credentials.
3. Toggle **Dev Mode Status** to **ON**.
4. Your TV will restart.

## Step 3: Obtain the Lineup IPK

### Option A: Build from Source (Recommended)

This is the reliable path because it does not depend on a temporary CI artifact.
Install Git, Node `>=22.12.0` (or use the repo-pinned version with `nvm`), and the
webOS CLI used by Lineup's packaging workflow:

```bash
git clone https://github.com/TJZine/Lineup.git
cd Lineup
nvm install
npm ci
npm install -g @webos-tools/cli@3.2.5
npm run package:webos
```

If you do not use `nvm`, install a supported Node version and omit `nvm install`.
The packaging command prints the exact output path. The IPK is written as:

```text
packages/com.lineup.app_<VERSION>_all.ipk
```

### Option B: Download a Short-Lived GitHub Actions Artifact

A successful push to `main` may provide the same verified package for seven days:

1. Sign in to GitHub and open the [Lineup CI workflow](https://github.com/TJZine/Lineup/actions/workflows/ci.yml).
2. Select a successful run whose event is **Push** and branch is **main**.
3. Confirm the run's commit is the Lineup revision you intend to install.
4. In the run's **Artifacts** section, download `webos-ipk`.
5. Extract the downloaded archive to obtain `com.lineup.app_<VERSION>_all.ipk`.

GitHub Actions artifacts are retained for seven days, may require a GitHub sign-in,
and are not a durable release channel. If `webos-ipk` is absent or expired, build
from source instead.

## Step 4: Install Lineup via PC

We recommend using the webOS TV CLI tools, but for easier installation, you can use the **webOS Dev Manager** desktop app.

### Option A: webOS Dev Manager

1. Download [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop/releases) for your OS.
2. Open the application.
3. Click **Add Device** and follow the prompts:
   - Enter the **Passphrase** shown in the TV's Developer Mode app.
   - Enter the **IP Address** shown in the TV's Developer Mode app.
4. Once connected, drag and drop the `com.lineup.app_<VERSION>_all.ipk` file obtained in Step 3 into the window.
5. Click **Install**.

### Option B: Command Line Interface (Advanced)

If you are a developer and have the webOS SDK installed:

```bash
# 1. Register your TV
ares-setup-device

# 2. Complete the interactive setup with your TV's IP
# (Select 'add', enter name, ip, etc.)

# 3. Install the application
# Example source-build path; use the exact path printed by package:webos.
ares-install --device my-tv packages/com.lineup.app_1.0.0_all.ipk
```

For an Actions download, replace the example source-build path with the extracted
IPK's path. The version in the filename may differ from `1.0.0`.

## Step 5: First Launch

1. Press the **Home** button on your remote.
2. Scroll to the end of your app list to find **Lineup**.
3. Launch the app.

## Next Steps

Now that Lineup is installed, let's set it up.

👉 **[Proceed to Quick Start](quick-start.md)**
