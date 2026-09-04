# Assessment Data Upload

**Owner:** Chris Geiser · **Date:** September 3, 2026 · **Decision needed by:** [TBD] · **PRD:** [PRD.md](PRD.md)

## Decision needed

Approve building the remaining half of the assessment-upload feature (server submit pipeline, upload history, and replacement of prior uploads) and assign it to a team, or keep the current prototype as a review-only demo. A yes also needs a call on standing up a hosted backend so stakeholders can exercise a real warehouse load instead of the browser-stubbed one.

## The problem

Districts assess early literacy with five different products (DIBELS, i-Ready, STAR, VALLSS, Amira), and their files reach us by hand: a coordinator exports and emails, an Ignite analyst cleans and loads. That path costs about 4 hours per district per assessment cycle and 360+ analyst hours per year, and it grows with each district because every vendor shapes its columns differently.

## The bet

A self-serve upload flow in the School Portal that detects the assessment type, maps columns to one canonical schema, validates every row with a specific message, lets the coordinator fix errors in the browser, and submits clean rows for loading.

## Outcome

OST-333 (https://ignite-reading.atlassian.net/browse/OST-333). Target: 5 hours of analyst time saved per week.

## Cost

The P1 core is built (upload, detect, map, validate, fix inline) with 118 passing tests and a live demo. Remaining: the async submit pipeline, upload history, replace/dedup, and a final quality pass, roughly the effort of the work done so far. Team: [TBD, likely Chihuahua or Moorhen, or Démarche]. Timeline: [TBD]. Non-obvious costs: a hosted backend and Postgres for the real pipeline, Data Engineering's time to swap the stub warehouse loader for Snowflake, and two config additions (an overall-score field and a performance-level field) across all five assessment types.

## Risks and trade-offs

The shared validation engine commits the stack to TypeScript end to end; a backend in another language means maintaining two copies of the rules. Whether district exports include a performance-level column is unknown, which blocks one of the two config additions. The internal component kit is a private repo this build cannot install yet, so the prototype reproduces the kit locally and the port to real kit components is deferred work.

## Not doing

The CX operations dashboard, reporting views on loaded data, email notifications, the production warehouse and auth integrations, mobile layouts, and automated PII auditing.

## Status

Prototype live at https://chris-geiser.github.io/assessment-upload/ (browser-only, synthetic data, one-click sample files). Code at https://github.com/chris-geiser/assessment-upload.
