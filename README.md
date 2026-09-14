# Copilot Anywhere in channels

An interactive concept for capturing an in-person conversation with Copilot notetaking, publishing the completed conversation to a Teams channel, and using its notes in later channel questions.

## Try it

Open the [live prototype](https://nimishgargcmd.github.io/Copilot-Anywhere-in-Channels/), or open `index.html` locally in a browser. No build, package installation, backend, or account is required to run the prototype locally.

1. Open the channel's meeting menu and choose **Take notes with Copilot**.
2. End notetaking, then close the saved screen to return to the channel post.
3. Open the conversation and select **View recap** to explore its notes, summary, speakers, and transcript. In-person notetaking has no video player.
4. Open Copilot and ask **Where should the notes live?** The sample answer cites the original in-person notes.

## Simulation and data

All conversations, decisions, transcription, speaker attribution, and Copilot responses are sample content. No microphone is accessed, no audio is captured, and nothing is posted to Teams. Web, attachments, file search, and voice are not connected. The prototype is not an official released product.

Sessions, replies, and custom summaries are saved in the browser's local storage. Each visitor has independent demo data. Copied session links only resolve in browsers that already have that session's data; they do not share content with another visitor. **Reset demo** restores the initial sample.

Do not enter confidential information. This demo and its source code are public; existing team/person labels are retained with the owner's approval. Reference screenshots and surrounding internal documents are intentionally excluded from Git via a root-level file allowlist.

## Hosting

GitHub Pages publishes the repository root from the `main` branch. The repository and website are public with the owner's approval. Pushing changes to `main` triggers a Pages deployment; no application build step is required.

All runtime assets are bundled alongside `index.html`; the site works at a domain root or under a repository subpath.

## Checks

With Node.js installed:

```sh
node --check channel-app.js
node --test model.test.cjs
```

## Assets

Lucide 0.468.0 is vendored in `lucide.min.js` with its upstream license header. The Copilot SVG is copied from the existing prototype asset. Sample portraits were originally downloaded from pravatar.cc. Microsoft product names and marks remain their owners' property. Review asset usage before broader distribution; no additional rights are granted by this repository.