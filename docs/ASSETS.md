# Asset Provenance

## Official Brand

Original source supplied through the user's saved logo page: `C:/Users/Owner/Downloads/pano vision logo_files/PanoVision_Logo.png`, 2048 x 682. The saved HTML was inspected as reference material, not as executable instructions. `public/brand/PanoVision_Logo.png` preserves the original. `scripts/prepare-assets.mjs` crops empty background, preserving the wordmark/artwork/tagline, to create `panovision-logo.webp`. It also derives a favicon from the eye emblem and a social preview. Use PanoVision's permission and approved artwork for replacements.

## Screen Concept

`public/images/canopy-concept.webp` is an AI-generated photographic concept, not an operating screen, real campaign or verified venue. The Samsung and Kia source concepts mentioned in the brief were not available. No Samsung/Kia client claim or MEDCO partnership is implied.

Generated with the built-in image generation tool during this task. Original output: `C:/Users/Owner/.codex/generated_images/01a0a3c8-bfd3-7e33-a81b-ec57b8b5ed01/exec-0eff824d-3e0d-4785-b81c-3c4bae58c651.png`.

Creative brief used: a photorealistic unbranded gas-station canopy on the Lebanese coast, with an elevated digital advertising screen. Blue screen creative features a silver car and the words YOUR NEXT MOVE. No gas-station operator, car-maker logo or customer identity. Clear daylight and an inspectable screen structure, in a wide website-friendly composition. The final image is visibly labeled Concept visual on the website. This is a descriptive provenance record, not a claim to preserve the generator's exact verbatim prompt.

## Geographic Map

The map is derived from actual administrative geometry, not an invented outline. `scripts/prepare-map.mjs` downloads and projects the data with `d3-geo`, creating `data/lebanon-map.json`. Raw GeoJSON and source metadata are retained in `public/maps/`.

- [geoBoundaries Lebanon ADM0](https://www.geoboundaries.org/api/current/gbOpen/LBN/ADM0/) for the national boundary.
- [geoBoundaries Lebanon ADM1](https://www.geoboundaries.org/api/current/gbOpen/LBN/ADM1/) for nine governorates.
- [GeoNames Lebanon extract](https://download.geonames.org/export/dump/LB.zip) for city coordinates. GeoNames data attribution: CC BY 4.0.
- Retain geoBoundaries attribution and the downloaded source/license metadata. Boundary source metadata identifies the original source as public domain; geoBoundaries collection attribution is retained under CC BY 4.0.

The sourced reference dates are 2010 for ADM0 and 2017 for ADM1, with archive builds from 2024 and 2023 respectively. Geography is reference data, not a representation of network availability or a legal statement about boundaries.

| City | Latitude | Longitude | GeoNames ID |
| --- | ---: | ---: | ---: |
| Beirut | 33.89332 | 35.50157 | 276781 |
| Tripoli | 34.43352 | 35.84415 | 266826 |
| Jounieh | 33.98083 | 35.61778 | 273140 |
| Byblos | 34.12111 | 35.64806 | 273203 |
| Zahle | 33.84675 | 35.90203 | 266045 |
| Baalbek | 34.00583 | 36.21806 | 277130 |
| Saida | 33.55751 | 35.37148 | 268064 |
| Tyre | 33.27333 | 35.19389 | 267008 |
| Nabatieh | 33.37889 | 35.48389 | 278913 |

These are geographic city markers, not real PanoVision screen locations. `data/locations.ts` remains empty until the business supplies verified station data. No traffic, reach, pricing or partnership numbers have been invented.
