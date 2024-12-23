module arrow(length=30, shaft_radius=1, head_radius=2, head_length=5) {
    cylinder(h=length-head_length, r=shaft_radius, center=false);

    translate([0, 0, length-head_length])
        cylinder(h=head_length, r1=head_radius, r2=0, center=false);
}

color("red")
    rotate([0, 90, 0])
        arrow();

color("green")
    rotate([-90, 0, 0])
        arrow();

color("blue")
    rotate([0, 0, 90])
        arrow();

module letter(text)
    linear_extrude(1) text(text, halign="center", valign="center");

letter_dist = 38;
union() {
    color("red")
        translate([letter_dist, 0, 0])
            rotate([45, 0, 45])
                letter("X");
    color("green")
        rotate([0, 0, 90])
            translate([letter_dist, 0, 0])
                rotate([45, 0, -45])
                    letter("Y");
    color("blue")
        rotate([0, -90, 0])
            translate([letter_dist, 0, 0])
                rotate([90+45, 0, 0])
                    rotate([0, 0, -90])
                        letter("Z");
}

color("grey")
    cube(10, center=true);

color([0, 0, 0, $preview ? 0.05 : 0])
    sphere(r=43);
