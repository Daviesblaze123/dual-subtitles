# Dual Subtitles (DE / EN)

A free Chrome extension for learning German with YouTube. It shows each German
subtitle line with its English translation directly underneath, lets you click
any German word to see what it means, and collects sentences and words in a
vocab list you can export to Anki or Excel.

Translation runs on your own computer with Chrome's built-in translator, so
there are no API keys, no accounts and no costs.

## Requirements

- **Desktop Chrome, version 138 or newer** (Windows, macOS or Linux). Check the
  version at `chrome://settings/help`. It does not work on phones or tablets.
- On first use, Chrome downloads a small German → English language model
  (once, needs internet). After that, translation works offline.
- The video needs German subtitles (written or auto-generated).

## Install ("Load unpacked")

1. Download this folder (or `git clone` it) and keep it somewhere permanent.
   Chrome loads the extension from this folder every time it starts.
2. Open `chrome://extensions` in Chrome.
3. Switch on **Developer mode** (top right).
4. Click **Load unpacked** and select the `dual-subtitles` folder (the one
   containing `manifest.json`).
5. Optional: click the puzzle icon in the toolbar and pin **Dual Subtitles**.

To update later, replace the folder's files (or `git pull`) and click the ↻
reload button on the extension's card in `chrome://extensions`.

## How to use

1. Open a YouTube video with German subtitles. A short message in the top left
   of the player tells you whether German subtitles were found.
2. The first time, click **Enable English translation** under the subtitle to
   download the language model.
3. **Click a German word** to see its translation. The video pauses; click
   anywhere else (or press Esc) to close the popup. Use **Save word** to add it
   to your list.
4. **Save a sentence** with the ☆ button on the subtitle box (hover over it)
   or press **Alt+S** (Option+S on a Mac). You can change the shortcut at
   `chrome://extensions/shortcuts`.
5. Click the extension icon to switch the subtitles **on/off**, see your vocab
   list, delete items, and **Export CSV**.
6. Under **Display** in the same menu: choose the **font size** (S–XL), the
   **position** (bottom, higher or top) and whether to **show the English**
   line. Hiding English is a good way to test yourself; clicking a word still
   shows its translation. Changes apply immediately.

## Using the CSV file

The file is UTF-8 with these columns: German, English, Type, Context, Video,
Link, Saved at.

- **Anki:** File → Import, choose the file, separator "Comma". Map German to
  Front and English to Back. The first row is the column names, so delete
  the "German / English" card it creates (or remove that row before importing).
- **Excel:** double-click the file. If everything ends up in one column (common
  with German or European settings), use Data → From Text/CSV instead and pick
  "Comma" as the delimiter.

## Troubleshooting

| Message | What to do |
| --- | --- |
| "this video has no German subtitles" | The video has no German track. Try another video. |
| "could not load the German subtitles" | Reload the page. If it keeps happening, YouTube may have changed its page and the extension needs an update. |
| "English translation needs desktop Chrome 138 or newer" | Update Chrome, or use a desktop computer. German subtitles still work. |
| "Chrome cannot translate German → English on this device" | Your device doesn't support the built-in translator. German subtitles still work. |
| Download stuck at 0% | Check your internet connection and free disk space, then reload the page. |

## Privacy

Everything stays in your browser. The vocab list is stored locally
(`chrome.storage.local`) and is never uploaded. The extension has no server,
no tracking and no keys. Chrome itself downloads the translation model once.

## Project structure

```
manifest.json        Extension configuration
src/inject.js        Runs inside YouTube's page: reads the caption track list
                     and picks up the caption file the player downloads
src/captions.js      Finds the German track and turns it into timed lines
src/translator.js    Chrome's on-device Translator (German → English) + cache
src/overlay.js       Draws the subtitles and word popup on the video
src/vocab.js         Vocab list storage (shared with the popup)
src/settings.js      Display settings storage (shared with the popup)
src/content.js       Connects everything on the YouTube page
src/content.css      Styles for the overlay
src/background.js    Forwards the Alt+S shortcut to the YouTube tab
popup/               The extension popup: on/off toggle, vocab list, CSV export
icons/               Toolbar icons
```
