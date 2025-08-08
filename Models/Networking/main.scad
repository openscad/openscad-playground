// Network Equipment Rack System
// Custom rack system for network equipment including POE switches and patch panels

// Parameters
// Basic dimensions
rack_width = 120;        // Width of the rack
rack_depth = 80;         // Depth of the rack  
rack_height = 100;       // Height of the rack
wall_thickness = 2;      // Wall thickness

// Equipment parameters
poe_switch_width = 100;  // Width of POE switch cutout
poe_switch_height = 25;  // Height of POE switch cutout
patch_panel_width = 100; // Width of patch panel cutout
patch_panel_height = 20; // Height of patch panel cutout

// Ventilation
vent_hole_size = 3;      // Size of ventilation holes
vent_spacing = 8;        // Spacing between vent holes

module networking_rack() {
    difference() {
        // Main rack body
        cube([rack_width, rack_depth, rack_height]);
        
        // Interior hollow
        translate([wall_thickness, wall_thickness, wall_thickness])
            cube([rack_width - 2*wall_thickness, 
                  rack_depth - 2*wall_thickness, 
                  rack_height]);
        
        // POE switch cutout (front)
        translate([(rack_width - poe_switch_width)/2, -1, 20])
            cube([poe_switch_width, wall_thickness + 2, poe_switch_height]);
            
        // Patch panel cutout (front) 
        translate([(rack_width - patch_panel_width)/2, -1, 50])
            cube([patch_panel_width, wall_thickness + 2, patch_panel_height]);
            
        // Cable management holes (back)
        translate([rack_width/4, rack_depth - wall_thickness - 1, 30])
            cube([10, wall_thickness + 2, 8]);
        translate([3*rack_width/4 - 10, rack_depth - wall_thickness - 1, 30])
            cube([10, wall_thickness + 2, 8]);
            
        // Ventilation holes (sides)
        for (x = [15 : vent_spacing : rack_width - 15]) {
            for (z = [15 : vent_spacing : rack_height - 15]) {
                // Left side vents
                translate([-1, rack_depth/3, z])
                    rotate([0, 90, 0])
                        cylinder(d=vent_hole_size, h=wall_thickness + 2, $fn=8);
                // Right side vents        
                translate([rack_width - wall_thickness - 1, rack_depth/3, z])
                    rotate([0, 90, 0])
                        cylinder(d=vent_hole_size, h=wall_thickness + 2, $fn=8);
            }
        }
    }
    
    // Internal shelves
    translate([wall_thickness, wall_thickness, 20 + poe_switch_height + 2])
        cube([rack_width - 2*wall_thickness, rack_depth - 2*wall_thickness, 2]);
    
    translate([wall_thickness, wall_thickness, 50 + patch_panel_height + 2])
        cube([rack_width - 2*wall_thickness, rack_depth - 2*wall_thickness, 2]);
}

// Main object
networking_rack();