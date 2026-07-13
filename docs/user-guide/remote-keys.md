# Remote Control Reference

Lineup is designed for the standard LG Magic Remote and also supports basic IR
remotes. The keyboard equivalents below are useful during browser development.

## Direct Button Mapping

These commands apply whenever the active modal or recovery flow allows background
commands.

| LG Remote Button | Keyboard Key | Action |
| --- | --- | --- |
| **D-Pad** | Arrow keys | Move focus or navigate the active Player, Mini Guide, EPG, or modal context |
| **OK / Wheel Click** | Enter | Activate the focused control; see the context table below when no control is focused |
| **Back** | Backspace / Esc | Close or leave the active context; see the context table below |
| **Guide** | `G` | Open or close the EPG |
| **Green** | F2 | Open or close the EPG as a Guide fallback |
| **Yellow** | F3 | Open Settings from the Player or EPG |
| **Red** | F1 | Toggle the Now Playing information overlay |
| **Info** | `I` | Open server selection, or return to sign-in when no authenticated server session exists |
| **Blue** | F4 | Same server-selection action as Info |
| **CH +** | Page Up | Previous channel in the Player; page up in the Mini Guide or EPG |
| **CH -** | Page Down | Next channel in the Player; page down in the Mini Guide or EPG |
| **Play / Pause** | — | Play or pause through the remote's media keys |
| **Rewind / Fast Forward** | — | Seek backward or forward by the configured seek interval |
| **Stop** | — | Stop playback |
| **0-9** | 0-9 | Enter a channel number |

## Context Routing

| Context | D-Pad / OK | Back | CH + / CH - |
| --- | --- | --- | --- |
| **Player, no overlay open** | Up opens the Mini Guide. Down or OK opens Player controls. | Opens Exit confirmation. | Previous channel / next channel. |
| **Player controls visible** | Navigate and activate the focused playback action. | Hides Player controls. | Previous channel / next channel. |
| **Now Playing information** | OK closes Now Playing and opens Playback Options at Subtitles. | Closes Now Playing. | No channel action while the modal is open. |
| **Mini Guide** | Up/Down navigates, OK tunes, Right opens the full EPG. | Hides the Mini Guide. | Page up / page down. |
| **EPG** | Arrows navigate, OK tunes, Play returns focus to now. | Steps back or closes the EPG according to its current view. | Page up / page down. |
| **Standard modal** | Navigate and activate the focused action. | Closes the modal when its policy permits dismissal. | No background channel action. |
| **Protected recovery modal** | Only D-Pad and OK are accepted. | Suppressed. | Suppressed. |

Long-press **Back** closes open overlays and returns to the Player unless a protected
modal owns input.

## Magic Remote Pointer

> [!TIP]
> The Magic Remote pointer works like a mouse—click any visible button or EPG grid
> item directly.

Pointer clicks use the same actions as focusing a control and pressing OK.
