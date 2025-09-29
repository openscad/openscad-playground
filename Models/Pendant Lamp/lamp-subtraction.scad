// BOSL2 not required for this model; remove dependency to simplify rendering

// Parameters
radius = 100;
thickness = 3;
pleat_gap = 5;
pleat_height = 1.5;
opening_angle = 30;
edge_radius = 0.5;  // Radius for the rounded edges
$fn = 100;

module pleatedSphere(radius, thickness, pleat_gap, pleat_height, opening_angle, edge_radius) {
    difference() {
        // Outer sphere with rounded edges
        hull() {
            sphere(r=radius - edge_radius);
            rotate_extrude()
            translate([radius - edge_radius, 0, 0])
            circle(r=edge_radius);
        }
        
        // These operations create the hollow interior and openings
        union() {
            // Interior hollow
            sphere(r=radius - thickness);
            
            // Top opening cone with rounded edge
            hull() {
                translate([0, 0, edge_radius])
                cylinder(h=radius + thickness - edge_radius, 
                        r1=edge_radius, 
                        r2=radius*sin(opening_angle));
                translate([0, 0, 0])
                cylinder(h=edge_radius,
                        r1=0,
                        r2=edge_radius);
            }
            
            // Bottom opening cone with rounded edge
            hull() {
                translate([0, 0, -(radius + thickness)])
                cylinder(h=radius + thickness - edge_radius,
                        r2=edge_radius,
                        r1=radius*sin(opening_angle));
                translate([0, 0, -edge_radius])
                cylinder(h=edge_radius,
                        r2=0,
                        r1=edge_radius);
            }
        }
        
        // Cut the pleats with rounded edges
        for (z = [-radius:pleat_gap:radius]) {
            r_slice = sqrt(max(0, radius * radius - z * z));
            translate([0, 0, z])
            rotate_extrude()
            translate([r_slice, 0, 0])
            circle(r=pleat_height);
        }
    }
}

// Create the pleated sphere
pleatedSphere(radius, thickness, pleat_gap, pleat_height, opening_angle, edge_radius);
