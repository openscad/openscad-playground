// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

export default `/*
  Hello there!

  If you're new to OpenSCAD, please learn the basics here:
  https://openscad.org/documentation.html

  There are lots of amazing libraries in the OpenSCAD ecosystem
  (see this list: https://openscad.org/libraries.html).

  Some of these libraries are bundled with this playground
  (search for "demo" or "example" in the file explorer above)
  and can be included directly from your models.

  Any bugs (this is an Alpha!) or ideas of features?
  https://github.com/openscad/openscad-playground/issues/new
*/

// Click on Render or hit F6 to do a fine-grained rendering.
$fn=$preview ? 20 : 100;

translate([-24,0,0]) {
  union() {
    cube(15, center=true);
    sphere(10);
  }
}

intersection() {
  cube(15, center=true);
  sphere(10);
}

translate([24,0,0]) {
  difference() {
    cube(15, center=true);
    sphere(10);
  }
}

translate([0, -30, -12])
  linear_extrude(1)
    text("OpenSCAD Playground", halign="center", valign="center");
`