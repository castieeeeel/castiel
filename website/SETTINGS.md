#meta

This page contains settings for configuring SilverBullet and its Plugs. Changing any of these will go into effect immediately in most cases except `indexPage` which requires a page reload.

```yaml
# Initial page to load when launching SB, can contain template variables
indexPage: "[[SilverBullet]]"
libraries:
# The "Core" library is recommended for all users
- source: "[[!silverbullet.md/Library/Core/*]]"
  # You can exclude items from the import using exclude (also supports wildcards):
  # exclude:
  # - [[!silverbullet.md/Table of Contents]]
  # - [[!silverbullet.md/Library/Core/Widget/*]]

## UI TWEAKS
# Hide the sync button
hideSyncButton: false
# Hide the edit button (available on mobile only)
hideEditButton: true # defaults to 'false'

# Configure the shown action buttons (top right bar)
actionButtons:
- icon: home # Use any icon from https://feathericons.com
  command: "{[Navigate: Home]}"
  description: "Go to the index page"
- icon: activity
  description: "What's new"
  command: '{[Navigate: To Page]("CHANGELOG")}'
- icon: message-circle
  description: "Community"
  command: '{[Navigate: To URL]("https://community.silverbullet.md")}'
- icon: book
  command: "{[Navigate: Page Picker]}"
  description: Open page
- icon: terminal
  command: "{[Open Command Palette]}"
  description: Run command
#- icon: arrow-left
#  command: "{[Navigate: Back in History]}"
#  description: "Go to the previous page"
#  mobile: true # Only show on mobile devices, set to false to show only on desktop

# Override keyboard shortcuts and command priority
shortcuts:
- command: "Navigate: Center Cursor" # But a command name is also supported
  key: "Alt-x"
- command: "{[Upload: File]}"
  priority: 1 # Make sure this appears at the top of the list in the command palette

# Defines files to ignore in a format compatible with .gitignore
spaceIgnore: |
   dist
   largefolder
   *.mp4

# Defines the maximum size of a file you can upload to the space (in MiB)
maximumAttachmentSize: 10

# Add alternative names to emoji picker
emoji:
  aliases:
    smile: 😀
    sweat_smile: 😅
```
