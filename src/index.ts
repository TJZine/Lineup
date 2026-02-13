import './styles/tokens.css';
import './styles/themes.css';
import './styles/video.css';
import './modules/ui/epg/styles.css';
import './modules/ui/now-playing-info/styles.css';
import './modules/ui/player-osd/styles.css';
import './modules/ui/mini-guide/styles.css';
import './modules/ui/channel-transition/styles.css';
import './modules/ui/playback-options/styles.css';
import './modules/ui/settings/styles.css';
import './modules/ui/profile-select/styles.css';
import './modules/ui/server-select/styles.css';
import './modules/ui/audio-setup/styles.css';
import './modules/ui/channel-setup/styles.css';
import './styles/shell.css';

import { installRetuneBootstrap } from './bootstrap';

// Backward-compat exports for integration/debug harnesses that import from the entrypoint.
export { app, bootstrap, cleanup } from './bootstrap';

installRetuneBootstrap();
