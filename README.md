# Unstuck House landing page (Cohort 01)

Built from `04-landing-page.docx`. Three files, no build step, no dependencies.

```
index.html    structure + all copy
styles.css    design system + animations
main.js       reveal animations, FAQ, form validation, submit
```

Open `index.html` directly, or serve it: `python3 -m http.server 8000`.

## Wiring it up

Both live at the top of `main.js`:

| What | Where | Default |
| --- | --- | --- |
| Form endpoint | `FORM_ENDPOINT` | `null` (demo mode: validates, shows the confirmation, sends nothing) |

Set `FORM_ENDPOINT` to anything that accepts a JSON `POST` (Formspree, a Google Apps
Script web app, your own API). The payload is every form field by `name`, plus
`submitted_at`, `cohort`, and `call_slot` (a readable string like
`"Thu 30 Jul, evening (4–8 IST)"`).

**The reel.** `youtube.com/shorts/7zG1b49aCGI`, embedded in the hero from
`youtube-nocookie.com`, muted, autoplaying, looping, captions on.
To swap it, change the video id in **two** places in the iframe `src`: the path and
the `playlist=` parameter (YouTube needs the second one to loop a single video).

While it plays, the only control on the player is our own play/pause button. Two
things make that true, and both matter if you touch that markup:

- `.reel__shield` sits over the iframe and the iframe is `pointer-events: none`, so
  YouTube's hover chrome (title, channel, share, watch-later) never fires.
- `main.js` skips redundant API commands. Every `postMessage` to the player makes it
  flash its UI, so re-sending `playVideo` to an already-playing video is what puts the
  chrome back on screen. Don't remove that guard.

**Known limit:** once *paused*, YouTube draws its own title bar and prev/play/next
cluster inside the iframe. That is cross-origin, so no CSS or script on this page can
suppress it. The only way to hide it is to cover the player, which was tried and
rejected in favour of leaving the paused frame visible.

**Contact links.** The footer has `hello@unstuckhouse.com` and two `href="#"`
placeholders for Instagram and X.

## Design

Paper (`#F4EFE7`) and ink (`#17130E`) with a single terracotta accent (`#C2512A`).
Instrument Serif for display, Inter for everything else, both from Google Fonts with
system fallbacks. All colours and spacing are custom properties at the top of
`styles.css`.

## Animations

Deliberately quiet. Nothing bounces, nothing slides in from the side.

- Hero lines rise out of a mask on load, staggered
- Sections fade up on scroll (`IntersectionObserver`), siblings cascade
- The two big statements reveal word by word
- The day timeline fills its dots as it enters view; step numbers fill in
- `₹30,000` counts up once
- Scroll progress hairline at the top
- Sticky mobile CTA slides up past the hero and hides once the form is on screen
- Buttons wipe to terracotta on hover, arrow nudges right
- Fine paper grain drifts across the hero
- The reel's play/pause button fades in on hover and stays up while paused; the reel
  itself pauses when scrolled out of view and resumes when it comes back

Every one of these is disabled under `prefers-reduced-motion: reduce`, and the page is
fully readable with JavaScript off.

## Notes on the deck

Two things worth a decision:

1. **"Six questions"** appears in the hero of the application section and in step 1,
   but the field table in the deck lists eleven. Both are as written in the deck.
   Change the copy or cut fields, your call.
2. **The interview picker** ("Book your 15") was added on request. The deck says the
   calendar link should go out *only* to applicants you want to interview, so this is
   built as a **preference** (a day plus a time window, saved with the application),
   not a live booking that burns a real slot.

The seat counter from the build notes was left out.

The reel is a third-party iframe, so it's the one thing on the page that needs the
network. If YouTube is blocked or slow, the frame stays dark ink. Nothing else on the
page depends on it.
