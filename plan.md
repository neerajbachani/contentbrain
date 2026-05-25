# Plan: Canvas Thumbnail Fix + UI Redesign

## Problem 1: X thumbnails missing
When content is added via ContextTab "Save to Canvas", `ogImage` is never set.
- `ContextTab.tsx` calls `api.inspirations.$post({ json: { rawContent, sourcePlatform } })` — no `ogImage`
- `inspirations.ts` POST accepts `ogImage` from body but it's null — passes straight to DB
- Fix: in POST handler, if `ogImage` is null and `sourceUrl` is a Twitter/X URL → call `getLinkPreview(sourceUrl)`

## Problem 2: Canvas UI is broken with numColumns=2
- Fixed 2-column grid breaks when thumbnail heights vary — tall image cards vs tiny text cards
- Tags inside `ScrollView` nested in `FlatList` causes RN warnings
- Platform labels show raw values ("twitter") not pretty names
- Delete is visible icon in header — clutters card, easy to accidentally tap

---

## Step 1 — Fix thumbnail pipeline (inspirations.ts)

**File:** `packages/web/src/api/routes/inspirations.ts`

In the POST handler, after extracting `ogImage` from body:
```ts
// After: let { rawContent, sourceUrl, sourcePlatform, type, title, ogImage } = body;
// Add before the insert:
if (!ogImage && sourceUrl && (sourceUrl.includes("twitter.com") || sourceUrl.includes("x.com"))) {
  try {
    const preview = await getLinkPreview(sourceUrl);
    if (preview.imageUrl) ogImage = preview.imageUrl;
  } catch {}
}
```

Import `getLinkPreview` from `../services/linkPreview/ogScraper`.

Also update `ContextTab.tsx` — when saving to canvas, if the parent inspiration has a `sourceUrl`, pass it along so the server can fetch the image.

---

## Step 2 — Canvas UI Redesign (canvas.tsx)

### Layout change
- Remove `numColumns={2}` → single-column list
- Cards WITH `ogImage`: full-width, image on top (height: 180, rounded top corners), content below
- Cards WITHOUT `ogImage`: compact row — platform icon + title + 1-line summary + tags inline

### Visual improvements
- Left accent border (4px) per platform: twitter=`#1D9BF0`, reddit=`#FF4500`, instagram=`#E1306C`, youtube=`#FF0000`, news=`#6366F1`, custom/text=`#444440`
- Pretty platform label: "twitter" → "Twitter / X", "reddit" → "Reddit", "instagram" → "Instagram", "youtube" → "YouTube", "blog"/"news" → "News", else "Custom"
- Tags: remove nested `ScrollView`, render max 3 tag pills inline with `flexWrap: "wrap"`
- Delete button: moved out of card header → small ghost icon in top-right corner, smaller (14px), no label
- Remix button: full-width at bottom of card (flex: 1)
- Multi-select: card gets `borderColor: colors.accent, borderWidth: 2` + checkmark overlay on image (top-right of image, white circle with ✓)

### InspirationCard redesign (pseudocode)
```
<Pressable style={[card, leftBorder(platform), isSelected && cardSelected]}>
  {ogImage && (
    <View>
      <Image style={imageStyle} />
      {isSelected && <SelectedOverlay />}  // absolute top-right ✓
    </View>
  )}
  <View style={cardBody}>
    <View style={cardHeader}>
      <PlatformIcon /> <PlatformLabel />   // left
      <TrashIcon size=14 />                // right
    </View>
    <Text numberOfLines={2}>{title}</Text>
    {summary && <Text numberOfLines={2}>{summary}</Text>}
    <TagRow tags={tags.slice(0,3)} />      // flex wrap, no ScrollView
    <RemixBtn />                           // full-width
    {isSelected && !ogImage && <SelectedBadge />}
  </View>
</Pressable>
```

---

## Step 3 — Push to GitHub
```
git add -A && git commit -m "fix: X thumbnail pipeline + canvas UI redesign (single column, platform accents, image cards)"
git push origin main
```

---

## Files to touch
1. `packages/web/src/api/routes/inspirations.ts` — add ogImage fallback via getLinkPreview
2. `packages/mobile/app/(tabs)/canvas.tsx` — full card + layout redesign
3. `packages/mobile/components/ContextTab.tsx` — pass sourceUrl when saving to canvas (minor)
