# PAVO OMR fixture suite v1

Original PAVO answer sheets rendered from the shared template geometry, then
"photographed" with camera-like transformations. No third-party forms are used.

- `fixtures.json` and `templates/` are generated from
  `__tests__/fixtures/omrCases.ts` and `src/domain/omr.ts`.
- `images/` holds half-size previews of each rendered photo.
- `measurements/` holds what the real OpenCV engine
  (`modules/pavo-omr/core`) measured on each photo.

`npm test` classifies the committed measurements with the production rules.
After changing the engine, the template geometry, or the cases, regenerate
everything (needs a JDK 21, for example Android Studio's bundled one):

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run omr:fixtures
```

Fixtures are synthetic. They do not replace the physical paper-scanner
acceptance checks described in the main README.
