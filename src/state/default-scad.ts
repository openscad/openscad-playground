// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

export default `
rotate([90, 0, 0]) {
	translate([-50, 0, 50])
  linear_extrude(10)
    text("hello world!");
        
}
cube(40, center=true);
translate([10, 10, 10])
	cube(40, center=true);

// This demo includes many libraries:
//
// include <BOSL2/std.scad>
// translate([-100, 0, 0])
//   spheroid(d=100, style="icosa", $fn=20);
`