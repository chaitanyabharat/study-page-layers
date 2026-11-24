# Reviewing a page-layer component

Use this checklist when you sign off a component, as an experiment or as reviewed. It takes about 15 minutes for a typical component. The automatic scanner has already blocked the dangerous patterns, so your job is to check what the code is *for*.

## Who can review

- **Reviewers** are the people listed in `governance/people.json`: trained content-team reviewers, and engineering.
- **Never the author.** You can't review a component you wrote. The tools refuse it.
- **Exceptions need engineering.** If a component lists exceptions to the rules (`allow`), only engineering can sign it off.
- **High-risk pages need engineering.** Pages for members, or in member areas, only use components signed by engineering.

## The steps

1. **Experiment.** A reviewer approves the component as an experiment. It then runs for up to 20% of readers, on low-risk pages only, for 30 days. After that it stops by itself.
2. **Reviewed.** Look at the experiment's results, such as clicks, errors and complaints, then promote it to reviewed. It becomes available to all readers on low-risk pages.
3. **Engineering sign-off.** Needed only if the component should run on high-risk pages.

Any change to a component's files means a new review: publishing refuses changed files.

## Checklist

**What it does**
- The description says what the component does, in one sentence, and the code does that and nothing else.
- It reads facts from the page and adds to it. It doesn't remove or rewrite article content.
- If it fails, the page still works. Try it with the component switched off.

**Each "to check" item from the scanner** (open "Scan" in the dashboard). Explain each one in your review note.
- *Run-time HTML (innerHTML).* Only the component's own fixed markup or icons may go in, never text from the address bar, the reader, or another site.
- *Run-time addresses.* Where can the request go? Only the page's own site or the CDN.
- *Run-time storage keys.* They keep the agreed prefix (`study-`, `enh-`, `pl-`, `page-layers`).
- *Navigation.* It only reloads the page or moves within it.
- *Workers.* What does the worker run? It should be the component's own code.
- *Key presses.* It reacts to specific keys, such as Esc or arrow keys, and never records what people type.

**People**
- It works with a keyboard, has visible focus, and gives screen readers names for its controls.
- It respects "reduce motion".
- It has a `data-cname` on new controls, so analytics can see it.

**Weight**
- It's under the size limit (8 KB gzipped per component), and it doesn't load anything big before someone asks for it.

## Writing the review note

The note goes in the history. One or two sentences on what you checked, and how you settled each scanner item. For example: "Adds a back-to-top link. The HTML is a fixed label, with no network or storage. Keyboard and focus checked."
