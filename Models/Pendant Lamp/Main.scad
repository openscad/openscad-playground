include <BOSL2/std.scad>

// Parameters
radius = 100;
thickness = 0.8;
pleat_gap = 2.8;       // [0:0.1:7]
pleat_height = 1.2;
pleat_offset = -1;     // [-2:0.1:2]
opening_diameter = 80; // Diameter of top and bottom openings
edge_radius = 0.5;
shade_depth = 15;      // How far the shade holder extends inward
shade_thickness = 2;   // Thickness of the shade holder ring
top_brim = false;      // Option to enable/disable top brim
bottom_brim = true;    // Option to enable/disable bottom brim
pleats_inside = false; // Option to put pleats on the inside (true) or outside (false)
$fn = 100;

module pleatedSphere(radius, thickness, pleat_gap, pleat_height, pleat_offset, 
                    opening_diameter, edge_radius, shade_depth, shade_thickness,
                    top_brim, bottom_brim, pleats_inside) {
    opening_radius = opening_diameter / 2;
    opening_angle = asin(opening_radius / radius);
    
    if (pleats_inside) {
        // Version 1: First create hollow sphere, then add pleats inside
        union() {
            // First create hollow sphere shell with openings
            difference() {
                // Outer sphere
                sphere(r=radius);
                
                // Hollow interior by subtracting a smaller sphere
                sphere(r=radius - thickness);
                
                // Create the top and bottom openings
                // Top opening
                translate([0, 0, 0])
                    cylinder(h=radius + thickness, r=opening_radius);
                    
                // Bottom opening
                translate([0, 0, -(radius + thickness)])
                    cylinder(h=radius + thickness, r=opening_radius);
            }
            
            // Now add the pleats as rings on the inside
            for (z = [-radius:pleat_gap:radius]) {
                r_slice = sqrt(max(0, radius * radius - z * z));
                
                // Calculate the radius at this z-height
                current_radius = sqrt(max(0, radius * radius - z * z));
                
                // Only add pleats if they're not near the openings
                if (current_radius > opening_radius + pleat_height*2) {
                    translate([0, 0, z]) 
                        rotate_extrude()
                            translate([r_slice + pleat_offset, 0, 0])
                                circle(r=pleat_height);
                }
            }
            
            // Add top shade holder ring (optional)
            if (top_brim) {
                translate([0, 0, radius * cos(opening_angle)])
                    rotate_extrude()
                        translate([opening_radius - shade_thickness/2, 0, 0])
                            polygon([
                                [-shade_thickness/2, 0],
                                [shade_thickness/2, 0],
                                [shade_thickness/2, -shade_depth],
                                [-shade_thickness/2, -shade_depth]
                            ]);
            }
            
            // Add bottom shade holder ring (optional)
            if (bottom_brim) {
                translate([0, 0, -radius * cos(opening_angle)])
                    rotate_extrude()
                        translate([opening_radius - shade_thickness/2, 0, 0])
                            polygon([
                                [-shade_thickness/2, 0],
                                [shade_thickness/2, 0],
                                [shade_thickness/2, shade_depth],
                                [-shade_thickness/2, shade_depth]
                            ]);
            }
        }
    } else {
        // Version 2: First make pleated exterior, then hollow out
        union() {
            // Main sphere with pleats and hollow interior
            difference() {
                union() {
                    // Outer pleated surface
                    difference() {
                        union() {
                            // Base sphere shell
                            sphere(r=radius);
                            
                            // Add the pleats as rings to the outside
                            for (z = [-radius:pleat_gap:radius]) {
                                r_slice = sqrt(max(0, radius * radius - z * z));
                                // Calculate the radius at this z-height
                                current_radius = sqrt(max(0, radius * radius - z * z));
                                
                                // Only add pleats if they're not near the openings
                                if (current_radius > opening_radius + pleat_height*2) {
                                    translate([0, 0, z]) 
                                        rotate_extrude()
                                            translate([r_slice + pleat_offset, 0, 0])
                                                circle(r=pleat_height);
                                }
                            }
                        }
                        
                        // Create the top and bottom openings
                        // Top opening
                        translate([0, 0, 0])
                            cylinder(h=radius + thickness, r=opening_radius);
                            
                        // Bottom opening
                        translate([0, 0, -(radius + thickness)])
                            cylinder(h=radius + thickness, r=opening_radius);
                    }
                }
                
                // Create hollow interior by subtracting a smaller sphere
                sphere(r=radius - thickness);
            }
            
            // Add top shade holder ring (optional)
            if (top_brim) {
                translate([0, 0, radius * cos(opening_angle)])
                    rotate_extrude()
                        translate([opening_radius - shade_thickness/2, 0, 0])
                            polygon([
                                [-shade_thickness/2, 0],
                                [shade_thickness/2, 0],
                                [shade_thickness/2, -shade_depth],
                                [-shade_thickness/2, -shade_depth]
                            ]);
            }
            
            // Add bottom shade holder ring (optional)
            if (bottom_brim) {
                translate([0, 0, -radius * cos(opening_angle)])
                    rotate_extrude()
                        translate([opening_radius - shade_thickness/2, 0, 0])
                            polygon([
                                [-shade_thickness/2, 0],
                                [shade_thickness/2, 0],
                                [shade_thickness/2, shade_depth],
                                [-shade_thickness/2, shade_depth]
                            ]);
            }
        }
    }
}

// Create the pleated sphere with chosen options
pleatedSphere(radius, thickness, pleat_gap, pleat_height, pleat_offset, 
             opening_diameter, edge_radius, shade_depth, shade_thickness,
             top_brim, bottom_brim, pleats_inside);