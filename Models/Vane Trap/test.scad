/*
    OpenSCAD Model for a Bug Trap Panel
    Modified to match the provided outline image:
    - Octagonal shape with angled corners
    - Single tab on left side with holes
    - Centered connecting slot that goes through the tab and halfway across body
    - Off-center closed slot within the material
    - Proportions adjusted to match the outline
*/

// ============== Configurable Parameters ==============

// Overall dimensions of the panel
panel_width = 200; // Total width including tab
panel_height = 120; // Total height at the widest point (increased for better proportions)
material_thickness = 3; // Thickness of the material

// Tab dimensions (only on left side)
tab_width = 20; // Slightly wider for better proportion
tab_height = 40; // Taller to match outline
hole_diameter = 8; // Slightly larger holes
hole_spacing = 20; // More spacing between holes

// Main body dimensions (excluding tab)
body_width = panel_width - tab_width; // Body width after the tab

// Slot dimensions
center_slot_length = body_width * 0.6; // Extends from tab through 60% across body
center_slot_height = material_thickness + 0.5; // Slightly wider slot
off_center_slot_length = 100; // Length of the closed off-center slot
off_center_slot_height = material_thickness + 0.5;
off_center_slot_y_offset = 25; // Position above center

// Octagonal shape parameters (more cuts for better match to outline)
corner_cut_length = 30; // Length of diagonal cuts
corner_cut_angle = 30; // Angle of the cuts


// ============== Module Definition ==============

module bug_trap_panel() {
    // Use linear_extrude to give the 2D shape thickness
    linear_extrude(height = material_thickness, center = true) {
        // Use difference to cut out the slots and holes
        difference() {
            // 1. The main outer polygon shape with octagonal body and single tab on left
            polygon(points = [
                // Start from top-left tab and go clockwise
                [0, tab_height/2], // Top of left tab
                [tab_width, tab_height/2], // End of left tab top
                
                // Octagonal body - going clockwise from top-left
                [tab_width + corner_cut_length, panel_height/2], // Top left angled edge start
                [panel_width - corner_cut_length, panel_height/2], // Top edge
                [panel_width, panel_height/2 - corner_cut_length], // Top right angled edge
                [panel_width, -(panel_height/2 - corner_cut_length)], // Right edge
                [panel_width - corner_cut_length, -panel_height/2], // Bottom right angled edge
                [tab_width + corner_cut_length, -panel_height/2], // Bottom edge
                [tab_width, -panel_height/2 + corner_cut_length], // Bottom left angled area
                
                // Left tab bottom
                [tab_width, -tab_height/2],
                [0, -tab_height/2] // Bottom of left tab
            ]);

            // 2. The shapes to subtract (slots and holes)
            
            // Centered connecting slot (goes through tab and partway across body)
            translate([center_slot_length/2, 0, 0]) {
                square([center_slot_length, center_slot_height], center=true);
            }
            
            // Off-center closed slot (contained within the body material)
            translate([tab_width + off_center_slot_length/2 + 10, off_center_slot_y_offset, 0]) {
                square([off_center_slot_length, off_center_slot_height], center=true);
            }
            
            // Holes in the left tab
            translate([tab_width/2, hole_spacing/2, 0]) {
                circle(d = hole_diameter);
            }
            translate([tab_width/2, -hole_spacing/2, 0]) {
                circle(d = hole_diameter);
            }
        }
    }
}


// ============== Instantiation ==============

// Show a single panel by default
bug_trap_panel();


/*
// --- Assembly View ---
// Uncomment the block below to see how two panels would interlock.
// The centered slot allows one panel to slide halfway into another,
// while the off-center slot provides additional functionality.

module assembly() {
    // First panel
    bug_trap_panel();
    
    // Second panel, rotated 180 degrees and positioned to interlock
    translate([panel_width/2, 0, material_thickness + 1]) {
        rotate([0, 180, 0]) {
            bug_trap_panel();
        }
    }
}

// assembly(); // Uncomment this line to show the assembly
*/