# Frequently Asked Questions

- [General](#general)
- [Content & Channels](#content--channels)
- [Technical](#technical)

## General

### Is Lineup free?

Yes, Lineup is open-source and free to use under the Apache License 2.0[^1].

### Do I need a Plex Pass?

No! Lineup works with free Plex accounts. However, some advanced Plex features (like Hardware Transcoding[^2] on the server side) require Plex Pass, which helps performance.

### Can I watch outside my home network?

Yes, as long as your Plex server is configured for "Remote Access"[^3].

## Content & Channels

### Why can't I fast forward?

Lineup simulates linear TV. Just like broadcast television, you can't skip ahead of the "live" broadcast time.

> [!NOTE]
> Seeking, fast-forward, and rewind are intentionally disabled to preserve the live TV experience.

### The channel says "Off Air". Why?

This means there is no content scheduled for the current time. This happens if:

- You used a schedule with gaps.
- The channel filters resulted in zero matching items.

> [!TIP]
> Edit the channel and click **Save** to regenerate the schedule, which often resolves this issue.

### Can I use my friend's server?

Yes. If their server is shared with your Plex account, it will appear in the server list.

### How do I enable subtitles?

Go to **Settings → Audio & Subtitles → Subtitle Mode** and choose a mode. See the [Subtitles guide](docs/user-guide/subtitles.md) for details on each mode.

### How do I create many channels at once?

Use the **Channel Setup Builder** during initial setup. It can auto-generate hundreds of channels from your libraries based on genres, collections, and more. See [Channel Management](docs/user-guide/channels.md#channel-setup-builder-step-2) for details.

## Technical

### Why is the installation so complicated?

LG requires "Developer Mode" for sideloading apps that aren't on the official LG Content Store. We hope to publish to the store in the future!

### Does it support Dolby Vision?

It depends on your TV model. Lineup hands the stream directly to the TV's native player. If the file is direct-playable and the TV supports it, yes. For Dolby Vision MKV files that show dark letterbox bars, enable **Smart HDR10 Fallback** in Settings → HDR / Dolby Vision. See [Troubleshooting](docs/user-guide/troubleshooting.md#dolby-vision-mkv-shows-dark-letterbox-bars) for details.

---

## Still have questions?

- 💬 Ask in [GitHub Discussions](https://github.com/TJZine/Lineup/discussions)
- 🐛 Report bugs via [Issue Tracker](https://github.com/TJZine/Lineup/issues)
 

---

[^1]: See [LICENSE](LICENSE) for full terms (Apache License 2.0).
[^2]: Hardware Transcoding uses your server's GPU to convert video formats, reducing CPU load and improving performance.
[^3]: Configure Remote Access in Plex Settings → Remote Access. See [Plex documentation](https://support.plex.tv/articles/200289506-remote-access/) for details.
