# Third-party components

## Swiss Ephemeris

- Runtime: `@swisseph/browser` **1.4.0**, which bundles `@swisseph/core` **1.4.0** and Swiss Ephemeris **2.10.03**.
- Package source: https://github.com/swisseph-js/swisseph
- Underlying C source: https://github.com/aloistr/swisseph
- Vendored artifacts are copied without modification from the npm package into `public/vendor/swisseph/`. SHA-256 checksums are recorded in its `manifest.json`; `pnpm-lock.yaml` pins package integrity.
- Wrapper license: AGPL-3.0. Preserved in `licenses/swisseph-js-LICENSE.txt`.
- Swiss Ephemeris copyright: Astrodienst AG, Switzerland. Its dual-license notice is preserved in `licenses/Swiss-Ephemeris-LICENSE.txt`.
- The owner has selected AGPL-3.0 distribution for the application. Application source and build/deployment files: https://github.com/Piizeed/yan-nopphakhro. The website footer links to this source. Dependencies retain their original licenses.
- Numeric validation fixtures are produced by native `pysweph` 2.10.3.6 (Swiss Ephemeris 2.10.03), https://pypi.org/project/pysweph/. Python and this validation dependency are not needed to run the app.

## Province coordinates

- Attribution: DevelopedbyWill, **Thailand Canonical Administrative Names**, dataset v1.0.0.
- Source: https://github.com/DevelopedbyWill/thailand-canonical-admin-names
- CSV: https://github.com/DevelopedbyWill/thailand-canonical-admin-names/blob/main/data/v1.0.0/thailand-adm1-provinces-v1.0.0.csv
- License: Creative Commons Attribution 4.0 International — https://creativecommons.org/licenses/by/4.0/
- Changes: retained only the TIS province code and centroid latitude/longitude; converted these fields to a JavaScript lookup; joined with the app's existing province names. Source URL and SHA-256 are in `public/data/province-centers.source.json`.
- These are province centroids, not birth-hospital coordinates. The user can override them with exact Thai birthplace coordinates. No claim is made that all centroid points are actual inhabited birth locations.

## Fonts

- Noto Sans Thai and Noto Serif Thai, distributed via Google Fonts: https://github.com/google/fonts
- Files are self-hosted in `public/vendor/fonts` so the app does not request fonts from Google at runtime.
- SIL Open Font License 1.1. Original copyright and license text are preserved in `licenses/NotoSansThai-OFL.txt` and `licenses/NotoSerifThai-OFL.txt`.
