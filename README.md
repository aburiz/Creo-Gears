# Gearforge

A local gear design workbench for exploring gear pairs and exporting geometry for 3D printing and Creo reference workflows. React, TypeScript, Three.js, React Three Fiber, and Vite. No backend or account required.

## Run

Requires Node.js 22.12+ (tested with Node 23).

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. On Windows, use `npm.cmd` if PowerShell blocks npm scripts.

```sh
npm run build
npm run preview
npm test
npm run test:browser
```

Browser checks use installed Microsoft Edge through Playwright. Geometry tests run without a browser. Build output is in `dist/`.

## Close the app

1. In the terminal running `npm run dev` (or `npm run preview`), press **Ctrl+C** to stop the local server. If Windows asks `Terminate batch job (Y/N)?`, type **Y** and press Enter.
2. Close the Gearforge browser tab. Closing the tab alone does not stop the server.

Browser autosave keeps your latest design on the same browser and local address. Use **Save project** to download a JSON backup before closing, especially before clearing browser data.

To reopen it, run `npm run dev` from this folder and open the local URL printed in the terminal.

## Use

1. Choose one of nine families: spur, helical, herringbone, straight bevel, spiral bevel, internal, rack and pinion, worm drive, or wheel-led worm drive.
2. Select gear A or B in the editor, assembly list, or 3D view. Edit module, teeth, face width, bore (ring wall for internal gears; backing depth for racks), pressure angle, and helix where applicable.
3. Snap to mesh matches the driven gear's module and pressure angle to the driver, sets opposing helix hands where appropriate, and uses nominal center distance. Turn off auto-position to apply a center offset.
4. Manufacturing controls apply total pair backlash, bore diameter allowance, root clearance, and uniform shrink compensation to the preview and exports. Process and material are metadata; presets are starting values, not engineering specifications.
5. Play or scrub the driver to inspect ideal ratio-based motion. Run mesh test to sweep supported tooth profiles across one engagement cycle. When overlap is detected, jump to its first sampled phase.
6. Export the selected part at its local origin, or both parts in nominal assembled positions. Exports use the zero-rotation configuration, independently of playback. Save/open JSON to transfer complete projects. Browser autosave retains the last project on this origin. Undo/redo retains the last 40 edits during the session.

## Geometry and checks

Parallel-axis gear profiles use sampled involute flanks. Root transitions are simplified radial transitions and arcs; generated hob trochoids and undercut relief are not modeled. Normal module is converted to transverse module for parallel helical families. Straight and double helices are produced by twisting sampled sections.

Straight bevels use ideal spherical involute flanks, a shared pitch-cone apex, radial cone face width, flat central blank faces, spherical tooth-end surfaces, and a cylindrical bore. Their mating rotation is opposed at the tooth-count ratio. Width is limited to min(R/3, 10m), and small-end bore breakthrough prevents export. A 3D volumetric sampling check tests 48 engagement phases at three cone distances around the contact region; it is not a continuous mesh collision proof or cutter simulation. Root transitions remain simplified. Spiral bevels now share the corrected blank and use opposite-hand logarithmic twists of the tooth sections; these remain concept geometry rather than generated cutter envelopes. Worms remain concept geometry. Hypoid, cycloidal, harmonic, noncircular gears, planetary assemblies, and custom shaft angles are not implemented.

Fit checks catch mismatched modules/pressure angles, opposing helix requirements, nominal ring/pinion tooth-count clearance, small bore walls, and undercut risk. Parallel-axis mesh tests use polygon intersection and containment at 48 phases and axial slices. Straight bevels use the spherical volume sampling described above. These checks do not certify continuous collision-free operation, contact pattern, torque, deflection, wear, efficiency, or printable minimum feature size. Spiral bevel and worm interference checking is not implemented.

Shrink compensation scales exported parts, including bores. Mounting center distances are nominal and must be scaled consistently. Individual material and process choices do not change geometry until allowances are adjusted or a starting-value preset is applied.

## Creo and exports

- **STL:** binary closed triangle meshes, coordinates in mm. STL itself has no unit metadata; select mm in your slicer/importer. Creo treats it as faceted geometry.
- **DXF:** closed 2D polylines with millimetre units, outer profile and bore/inner ring boundary. Use as a sketch and extrude for straight spur, internal, or rack geometry. DXF does not contain face width, cone taper, or helices.
- **STEP:** AP214 faceted B-reps with closed triangle shells and millimetre units. This is not analytical involute geometry or a native Creo feature tree. Both parts are separate B-reps in one shape representation, not a constraint-bearing CAD assembly.

Native Creo import has **not** been verified. Faceted STEP support and import results depend on Creo version and configuration. For editable CAD features, import a DXF sketch and construct the corresponding native features in Creo.

References: [PTC tessellated imports](https://support.ptc.com/help/creo/creo_pma/r13/usascii/data_exchange/interface/About_Tessellated_Files.html), [PTC STEP import](https://support.ptc.com/help/creo/creo_pma/r2027/usascii/data_exchange/interface/To_Import_Part_and_Assembly_STEP_Files.html), and [KHK gear dimensions](https://khkgears.net/new/gear_knowledge/gear_technical_reference/calculation_gear_dimensions.html).

All project data and exports stay in your browser/on your device. Fonts are requested from Google Fonts, with local sans-serif fallbacks. No design data is sent with those font requests.
