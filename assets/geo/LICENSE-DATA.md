# Licences for the map data in `assets/geo/`

**The repository's MIT licence covers its code. It does not cover these files.**

These fourteen GeoJSON layers are map data with their own licences, and one of them
(ODbL) has a share-alike clause that MIT cannot satisfy. Anyone who copies,
serves or builds on this folder must keep this notice with it and give the
attributions below.

Every feature in every file also carries its own `license` and `source`
properties, so the licence travels with the data even if this file does not.

---

## What is here, and under what terms

### OpenStreetMap, under ODbL 1.0

`kuwait_land`, `islands`, `governorates_land`, `governorates_land_osm2023`,
`international_land_boundaries`, `areas_land`, `water_bodies`,
`protected_areas`, `settlements`.

> © OpenStreetMap contributors. Open Database License (ODbL) 1.0.
> <https://www.openstreetmap.org/copyright> ·
> <https://opendatacommons.org/licenses/odbl/1-0/>

Three obligations, all of which this repository meets:

- **Attribution.** Any map drawn from these layers is a "produced work" and must
  credit *© OpenStreetMap contributors*. `js/ksat-layers.js` adds that to the
  Leaflet attribution control on every map that loads a layer, and it cannot be
  turned off separately from the layer.
- **Share-alike.** Any database derived from these files stays under ODbL. It
  cannot be relicensed MIT, CC BY or all-rights-reserved.
- **Keep it open.** Anyone who receives these files must be able to get the data
  or the method. Both: the files are in this folder, and they were built by the
  scripts in the `kuwait-geodata` package from the OpenStreetMap Geofabrik GCC
  extract.

`governorates_land_osm2023` additionally derives from geoBoundaries gbOpen,
itself built from OpenStreetMap. Same licence.

### GeoNames, under CC BY 4.0

Twenty features in `water_bodies` and the Arabic names on eighty-seven features
in `settlements`.

> GeoNames, <https://www.geonames.org>, CC BY 4.0.

### Kuwait Environment Public Authority: published coordinates

`protected_areas_epa`.

The polygons join the vertex coordinates that each EPA reserve page publishes,
in the published order. Nothing is drawn, smoothed or inferred. EPA states no
licence; the coordinates are reproduced as published legal boundary facts with
the page cited on every feature.

> Reserve boundaries: Environment Public Authority, State of Kuwait
> (epa.gov.kw), as published. **Not a survey.**

**These are not survey boundaries and should not be presented as if they were.**
Only three of the polygons match both areas EPA states for the same reserve, and
one reserve's published vertex has a lost decimal point that was deliberately
**not** corrected. If EPA objects to the reproduction, delete this one file;
nothing else depends on it.

### Marine Regions maritime zones, under CC BY 4.0

`eez`, `territorial_sea_12nm`, `contiguous_zone_24nm`, `maritime_boundaries`.

> Flanders Marine Institute (2023). Maritime Boundaries Geodatabase, version 12:
> Exclusive Economic Zones (<https://doi.org/10.14284/632>), Territorial Seas
> 12 NM v4 (<https://doi.org/10.14284/633>), Contiguous Zones 24 NM v4.
> <https://www.marineregions.org/> - clipped and re-attributed for this package.

**These lines have no legal value.** Marine Regions says so themselves. They are
12 and 24 nautical mile buffers and median lines, not agreed boundaries.
Kuwait-Iran is undelimited; beyond boundary point 162 Kuwait-Iraq is
undemarcated. Do not use them for legal, resource or navigational purposes.

> **Go to the source for anything that matters.** The Flanders Marine Institute
> asks users "not to make our products available for download elsewhere and to
> always refer to marineregions.org for the most up-to-date products and
> services." CC BY 4.0 permits the redistribution, and this project made a
> deliberate decision to include the files so the workspace has a sea layer at
> all. The request behind it is still a good one: these are a snapshot taken on
> 2026-09-23 and they will go stale. For current data, and for anything with a
> consequence, go to <https://www.marineregions.org/>.

## What is deliberately NOT here

**WDPA / Protected Planet** data, whose terms forbid redistribution in whole or
in part. `protected_areas_epa` links to protectedplanet.net instead.

---

## Where the attribution appears

`js/ksat-layers.js` adds to the Leaflet attribution control, on any map that
loads a layer:

    Boundaries © OpenStreetMap contributors (ODbL) · Places: GeoNames (CC BY 4.0)
    · Maritime zones: Marine Regions (CC BY 4.0), no legal value
    · Reserves: Kuwait EPA, as published

Do not remove that line while these layers are in use. It is the licence
condition, not decoration.

---

## Provenance

Built 2026-09-23 by the `kuwait-geodata` package from sources retrieved that
day. The simplified web copies here were generated from full-resolution
originals; `web_bundle_index.csv` in that package records the simplification
tolerance and the maximum deviation for each file (10-25 m for everything in
this folder).

The originals, the build scripts, the QA reports and the source registers are
**not** in this repository. They are the record, not a web asset.
