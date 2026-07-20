# Delivery And Quality Gates

## Delivery Folder

Keep final files separate from working renders and caches.

Recommended structure:

```text
project-name/
  project.json
  01_brief/
  02_writing/
  03_shots/
  04_assets/
    references/
    generated/
    asset_manifest.csv
  05_deliverables/
  99_work/
```

Only `05_deliverables` and approved assets should be copied into a client-facing package. A full internal package may also include the brief, shot CSV, prompt archive, and manifest.

## Timing Gate

- Segment durations sum to total runtime.
- Shot time ranges are ordered, contiguous, and non-negative.
- Spoken text fits the available time at the chosen delivery speed.
- Holds for titles, product shots, maps, or instructions are long enough to read.
- The ending has enough duration for the intended emotional or brand finish.

## Story And Editorial Gate

- Every segment has one clear job.
- Repeated shots add escalation, contrast, proof, or rhythm.
- Geography and screen direction remain legible.
- Transitions name a visual or audio relationship.
- The first and final frames serve the platform and project goal.

## Continuity Gate

- Recurring subjects use stable asset IDs.
- Character faces, wardrobe, handedness, damage, props, and state variants match.
- Location layout, light direction, weather, and time progress consistently.
- Effects obey their defined source, color, interaction, and dissipation.
- Asset files marked `done` exist and were visually inspected.

## Prompt Gate

- Prompts describe temporal action, not only static appearance.
- Camera movement and subject movement are physically compatible.
- Consolidated prompt intervals sum to clip duration.
- Audio language and no-music or music instructions are explicit.
- Global style locks and shot prompts do not contradict each other.
- Exclusions target relevant failure modes.

## Asset Gate

- The asset manifest and files agree.
- Filenames begin with stable IDs.
- Character and product sheets reveal enough information for reuse.
- Scene assets establish layout and scale, not only atmosphere.
- Contact sheets are derived overviews and are not counted as new creative assets.
- When generation stopped early, ungenerated items are visibly marked and no shot silently depends on them.

## Document Gate

When creating a Word document:

1. Use the documents skill.
2. Apply the supplied template or create a restrained production layout.
3. Use real heading styles, descriptive tables, readable type, and image alt text.
4. Render the complete document to page images and inspect every page.
5. Check for clipping, overlap, orphaned headings, nearly blank spill pages, missing glyphs, broken tables, and distorted images.
6. Run the document accessibility audit and resolve high and medium findings.
7. Test the `.docx` as a ZIP archive or reopen it through a structured parser.

Do not place a long prompt in a narrow table cell when a full-width text block would be more readable.

## Archive Gate

- Include only intended files.
- Avoid temporary render folders, caches, duplicate generations, and hidden metadata folders.
- Verify the archive can be extracted and filenames preserve Unicode where used.
- Report asset count, shot count, document page count, and any intentionally deferred items.

## Completion Report

Keep the final message concise. Provide direct links to the primary document and package, then state:

- runtime and shot count
- number of completed assets
- prompt-only or deferred assets
- checks performed
- anything not completed or not tested
