# Glimpse — feature plan

Ephemeral photo-sharing feature for the student dashboard app. A user uploads a photo that stays visible to all users for 12 hours. Other users view Glimpses one at a time in a swipeable, fanned card stack — swiping in either direction permanently burns that photo for that viewer, so each person can only see any given Glimpse once.

---

## 1. Core rules (confirmed)

| Rule | Behavior |
|---|---|
| Visibility window | 12 hours, anchored to `createdAt` in a fixed reference clock (UTC) — not the viewer's local time, so the window can't drift or appear to expire early/late across timezones |
| View limit per viewer | Exactly once. Swiping left or right — either direction — burns it permanently for that viewer |
| Tray ordering | Newest upload appears at the top / front of the tray. Re-sorts live as new Glimpses come in |
| Ring/seen state | None. An uploader's avatar sits in a viewer's tray only while that viewer still has at least one unburned Glimpse from them. Once the viewer burns all of them, that uploader's avatar is removed from their tray entirely — no grayed-out or "seen" variant |
| Rate limiting | None. No cap on how many Glimpses a user can have active at once |
| Reactions | One of love / happy / sad / angry. Single-select — picking a new one replaces the old, tapping the active one clears it |
| Uploader visibility | Live view count only. No viewer identities shown anywhere |
| Caption | Optional, ≤25 characters, set at upload time, not editable afterward |
| Early removal | Only via manual delete by the uploader. Nothing else ends a Glimpse before its 12-hour window |

---

## 2. Data model

**Glimpse**
```
id            string
uploaderId    string
imageUrl      string
caption       string | null      (≤25 chars)
createdAt     timestamp (UTC)
viewCount     integer            (starts at 0)
reactionCounts  { love, happy, sad, angry }   (all start at 0)
```

**GlimpseView** — one row per (glimpse, viewer) pair, written the moment a viewer burns it
```
glimpseId     string
viewerId      string
viewedAt      timestamp (UTC)
reaction      "love" | "happy" | "sad" | "angry" | null
```

A Glimpse is "active" for the whole app while `now - createdAt < 12h`. A Glimpse is "active for a specific viewer" when it's active AND no `GlimpseView` row exists yet for `(glimpseId, viewerId)`.

---

## 3. Core functions

Pseudocode-level logic for every operation the feature needs. These aren't tied to a specific backend, just the shape of what each one does and checks.

### 3.1 `createGlimpse(uploaderId, imageBlob, caption)`
Called when the uploader taps the checkmark to confirm upload.
```
function createGlimpse(uploaderId, imageBlob, caption):
    assert caption.length <= 25
    imageUrl = uploadImageToStorage(imageBlob)
    glimpse = {
        id: generateId(),
        uploaderId: uploaderId,
        imageUrl: imageUrl,
        caption: caption or null,
        createdAt: nowUTC(),
        viewCount: 0,
        reactionCounts: { love: 0, happy: 0, sad: 0, angry: 0 }
    }
    saveGlimpse(glimpse)
    return glimpse
```
No expiry job needs to run at creation time — expiry is handled entirely by filtering on read (see 3.3).

### 3.2 `deleteGlimpse(glimpseId, requesterId)`
Called from the uploader's detail view.
```
function deleteGlimpse(glimpseId, requesterId):
    glimpse = getGlimpse(glimpseId)
    if glimpse.uploaderId != requesterId:
        reject("not authorized")
    deleteGlimpseRecord(glimpseId)
    deleteAllGlimpseViews(glimpseId)
    return success
```

### 3.3 `getTrayForViewer(viewerId)`
Builds the tray the viewer sees at the top of the dashboard.
```
function getTrayForViewer(viewerId):
    activeGlimpses = allGlimpses.filter(g => nowUTC() - g.createdAt < 12h)
    unburned = activeGlimpses.filter(g => not exists GlimpseView(g.id, viewerId))

    grouped = groupBy(unburned, g => g.uploaderId)

    tray = []
    for each (uploaderId, glimpsesForUploader) in grouped:
        newestCreatedAt = max(glimpsesForUploader.map(g => g.createdAt))
        tray.push({ uploaderId, newestCreatedAt, count: glimpsesForUploader.length })

    sort tray by newestCreatedAt DESCENDING   // newest upload first, per confirmed rule
    return tray
```
Because this recomputes from scratch on every read, "newest on top" and "disappears once fully burned" both fall out naturally — there's no separate state to maintain or clean up.

### 3.4 `openGlimpseStack(viewerId, uploaderId)`
Called when the viewer taps an avatar in the tray.
```
function openGlimpseStack(viewerId, uploaderId):
    active = allGlimpses.filter(g =>
        g.uploaderId == uploaderId and
        nowUTC() - g.createdAt < 12h and
        not exists GlimpseView(g.id, viewerId)
    )
    sort active by createdAt ASCENDING   // oldest-first within one uploader's queue, so a session feels chronological
    return active
```

### 3.5 `burnGlimpseView(glimpseId, viewerId)`
Called the instant a swipe passes the distance threshold, in either direction.
```
function burnGlimpseView(glimpseId, viewerId):
    if exists GlimpseView(glimpseId, viewerId):
        return   // already burned, no-op — guards against double-fire from a fast double swipe

    createGlimpseView({ glimpseId, viewerId, viewedAt: nowUTC(), reaction: null })
    incrementViewCount(glimpseId)
```
This fires immediately on swipe completion, independent of whether the viewer reacted first. Reacting does not require burning, but burning is permanent regardless of whether a reaction was left.

### 3.6 `reactToGlimpse(glimpseId, viewerId, reactionType)`
Called when the viewer taps a reaction icon on the current front card, before or after the swipe that will burn it.
```
function reactToGlimpse(glimpseId, viewerId, reactionType):
    view = getOrCreateGlimpseView(glimpseId, viewerId)   // may not be burned yet — reacting doesn't burn on its own
    previous = view.reaction

    if previous == reactionType:
        view.reaction = null
        decrementReactionCount(glimpseId, reactionType)
    else:
        if previous != null:
            decrementReactionCount(glimpseId, previous)
        view.reaction = reactionType
        incrementReactionCount(glimpseId, reactionType)

    saveGlimpseView(view)
```
Note the distinction from 3.5: reacting alone does **not** burn the Glimpse. A viewer can react and then keep looking (position stays put) — burning only happens on an actual swipe gesture. This matches the UI you approved, where the reaction panel sits under the avatar independent of the swipe action.

### 3.7 `getGlimpseDetail(glimpseId, requesterId)`
Called for the uploader's own detail view.
```
function getGlimpseDetail(glimpseId, requesterId):
    glimpse = getGlimpse(glimpseId)
    if glimpse.uploaderId != requesterId:
        reject("not authorized")
    return {
        imageUrl: glimpse.imageUrl,
        caption: glimpse.caption,
        viewCount: glimpse.viewCount,
        reactionCounts: glimpse.reactionCounts
    }
```
No viewer identities are ever returned by this function, by design.

### 3.8 Expiry — no background job needed
Because "active" is defined purely as `now - createdAt < 12h`, every read function above (3.3, 3.4) already excludes expired Glimpses automatically. A lightweight cleanup job can run periodically (e.g. hourly) purely to physically delete rows older than, say, 48 hours — that's a storage-hygiene task, not something the feature's correctness depends on.
```
function cleanupExpiredGlimpses():   // optional, storage hygiene only
    for glimpse in allGlimpses:
        if nowUTC() - glimpse.createdAt > 48h:
            deleteGlimpseRecord(glimpse.id)
            deleteAllGlimpseViews(glimpse.id)
```

---

## 4. Uploader-side flow and UI

### 4.1 States (single screen, state machine)
```
[idle/live viewfinder]
        | tap shutter
        v
[captured, not yet uploaded] -----tap cross----> back to [idle/live viewfinder]  (discarded, nothing saved)
        | tap caption button -> inline 25-char field, does not change state
        | tap checkmark
        v
createGlimpse() called
        v
back to [idle/live viewfinder]
```

### 4.2 Camera screen (idle state)
- Full-bleed 1:1 square viewfinder, dark background, centered aperture icon and "Tap the shutter to capture" hint
- Large circular shutter button below the frame — light circle, dark ring border, sits on the page background (not on the dark frame)
- Folder icon, bottom-right corner of the frame — opens the file manager

### 4.3 Post-capture state
- Frame now shows the captured photo
- Caption button, top-left of the frame — translucent pill on top of the image; tapping it swaps to an inline text input with a live "n/25" counter
- Shutter button morphs into a solid dark circle with a white checkmark (confirm/upload)
- A smaller bordered gray circle with an "x" sits beside it (discard, returns to idle with nothing saved)

### 4.4 File manager
- Back arrow, top-left, returns to the camera
- 3-column grid of the uploader's own currently-active Glimpses, most recent first
- Each thumbnail carries a small translucent view-count badge in its corner
- Empty state: dashed-border card, "No glimpses uploaded yet"
- Tapping a thumbnail opens the detail view

### 4.5 Detail view (uploader's own Glimpse)
- Back arrow, top-left, returns to the file manager
- Full-size square image with caption overlaid (if set)
- Amber highlight card: "Total views" label, large view count number — same visual treatment as the exam countdown card on the dashboard, since this is the single most important number on the screen
- Bordered row of four reaction counts (love / happy / sad / angry), icon + number each, no names
- Full-width delete button, danger-tinted, removes the Glimpse immediately (calls 3.2) and returns to the file manager

---

## 5. Viewer-side flow and UI

### 5.1 States (viewer session)
```
[dashboard tray]  -- built by getTrayForViewer() --
        | tap an avatar
        v
[stack open, front card = oldest unburned Glimpse from that uploader]  -- built by openGlimpseStack() --
        | swipe left or right, past threshold
        v
burnGlimpseView() called  -->  card animates off-screen
        |
        v
   more unburned in this stack? ---- yes ----> next card becomes front, repeat
        |
        no
        v
[end-of-stack state: "that's all for now"]
        | tap/dismiss
        v
back to [dashboard tray]  (re-built — this uploader is now gone if fully burned)
```

### 5.2 Tray
- Horizontal row of avatars at the top of the dashboard, ordered newest-upload-first (3.3)
- No progress rings, no seen/unseen visual distinction beyond presence/absence in the row

### 5.3 Swipeable viewer
- Full-screen, square 1:1 front card, centered
- Two fanned ghost cards behind it — one tilted and offset left, one tilted and offset right — signaling more content in the queue
- Position indicator below the stack ("2 of 4")
- Bottom-left of the front card: uploader's avatar (circular, bordered)
- Directly below the avatar: reaction panel — four icons, single-select (3.6), does not by itself advance or burn the card
- Top-right of the front card: eye icon + live view count
- Swipe gesture (either direction, past a distance threshold): triggers 3.5, animates the card off-screen with rotation and fade, next card in the fanned stack becomes the new front card
- Below-threshold release: card springs back to center, nothing burned

### 5.4 Empty state
- If the tray is empty (nobody has an active Glimpse), or a stack runs out mid-session, show only the fanned glass card outlines with a quiet "No glimpses right now" message — no avatar, no reaction panel, no swipe handling attached

---

## 6. Why a few things are built the way they are

- **Filtering on read instead of a background expiry job** keeps the 12-hour rule bulletproof — there's no separate "mark as expired" step that could fall out of sync with the actual timestamp. A Glimpse is active if and only if the math says so, every single time it's queried.
- **Reacting and burning are separate actions** (3.5 vs 3.6) because the UI lets someone tap a reaction before deciding whether to swipe on — collapsing them into one action would force a reaction the moment someone glances at a photo, which isn't how the swipe-to-burn mechanic was designed to feel.
- **The tray has no persisted "seen" state** — per your call, it's computed fresh from `GlimpseView` records on every read, so there's nothing to reset, migrate, or accidentally leave stale when a new Glimpse comes in from someone the viewer had previously fully burned.

