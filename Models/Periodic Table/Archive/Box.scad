/* [Box Dimensions] */
// Width and height of the box face (mm)
box_size = 133.35; // 5.25 inches = 133.35 mm
// Depth of the box (mm)
box_depth = 76.2; // 3 inches = 76.2 mm
// Thickness of the box walls (mm)
wall_thickness = 4;

/* [Card Slot] */
// Width of the card to insert (mm)
card_width = 120;
// Height of the card slot (mm)
card_slot_height = 2;
// Depth of the card slot (how far it extends into the box) (mm)
card_slot_depth = 20;
// Clearance for the card (makes the slot slightly larger) (mm)
card_clearance = 0.5;

/* [Connection System] */
// Enable interlocking system
enable_interlocking = true;
// Inset from edge for the lip/indentation (mm)
lip_inset = 3;
// Height of the lip for vertical stacking (mm)
lip_height = 5;
// Clearance for the connections (mm)
connection_clearance = 0.3;
// Width of the lip on each side (mm)
lip_width = 10;

/* [Display Options] */
// Show example card in the slot
show_example_card = true;
// Show the box with transparency
transparent_view = false;
// Show boxes stacked in a demo (0=none, 1=horizontal, 2=vertical, 3=both)
stacking_demo = 0;

/* [Hidden] */
// Small value for ensuring proper differences and unions
epsilon = 0.01;

// Main box module
module periodic_element_box() {
    color(transparent_view ? "LightGreen" : "Green", transparent_view ? 0.5 : 1)
    difference() {
        union() {
            // Outer box
            cube([box_size, box_size, box_depth]);
            
            // Add interlocking lip system if enabled
            if (enable_interlocking) {
                // Left side lip
                translate([lip_inset, 0, box_depth - lip_height])
                    cube([lip_width, box_size, lip_height]);
                
                // Right side lip
                translate([box_size - lip_inset - lip_width, 0, box_depth - lip_height])
                    cube([lip_width, box_size, lip_height]);
                
                // Back side lip (adjust position to avoid interfering with other lips)
                translate([lip_inset + lip_width, box_size - lip_inset - lip_width, box_depth - lip_height])
                    cube([box_size - 2*(lip_inset + lip_width), lip_width, lip_height]);
            }
        }
        
        // Inner hollow space (leaving wall thickness on all sides)
        translate([wall_thickness, wall_thickness, wall_thickness])
            cube([
                box_size - 2 * wall_thickness, 
                box_size - 2 * wall_thickness, 
                box_depth - wall_thickness + epsilon
            ]);
        
        // Front opening
        translate([wall_thickness, wall_thickness, wall_thickness])
            cube([
                box_size - 2 * wall_thickness, 
                wall_thickness + epsilon, 
                box_depth - wall_thickness
            ]);
        
        // Card slot on right side face, positioned closer to back
        translate([
            box_size - wall_thickness,  // Right face
            wall_thickness + card_clearance,  // Closer to the back wall
            wall_thickness  // Center vertically
        ])
            cube([
                wall_thickness + epsilon,  // Cut through side wall
                card_width + card_clearance * 2,  // Width of slot
                card_slot_height  // Height of slot
            ]);
            
        // Horizontal card channel inside, aligned with new slot position
        translate([
            box_size - wall_thickness - card_slot_depth,  // Extend inward from right face
            wall_thickness + card_clearance,  // Match slot position closer to back
            wall_thickness  // Same vertical position
        ])
            cube([
                card_slot_depth,  // How deep the channel goes
                card_width + card_clearance * 2,  // Same width as slot
                card_slot_height  // Same height as slot
            ]);
        
        // Add indentations for interlocking with box below
        if (enable_interlocking) {
            // Left side indentation
            translate([lip_inset - connection_clearance, -epsilon, 0])
                cube([
                    lip_width + 2*connection_clearance, 
                    box_size + 2*epsilon, 
                    lip_height + connection_clearance
                ]);
            
            // Right side indentation
            translate([box_size - lip_inset - lip_width - connection_clearance, -epsilon, 0])
                cube([
                    lip_width + 2*connection_clearance, 
                    box_size + 2*epsilon, 
                    lip_height + connection_clearance
                ]);
            
            // Back side indentation
            translate([lip_inset + lip_width - connection_clearance, 
                      box_size - lip_inset - lip_width - connection_clearance, 
                      0])
                cube([
                    box_size - 2*(lip_inset + lip_width) + 2*connection_clearance, 
                    lip_width + 2*connection_clearance, 
                    lip_height + connection_clearance
                ]);
        }
    }
}

// Example card to show in the slot
module example_card() {
    if (show_example_card) {
        color("LightBlue", 0.7)
        translate([
            box_size - wall_thickness - card_slot_depth/2, 
            wall_thickness + card_clearance + (card_width + card_clearance*2)/2, 
            wall_thickness + card_slot_height/2
        ])
            cube([card_slot_depth * 0.8, card_width, 0.5], center=true);
    }
}

// Module to demonstrate boxes stacked horizontally (side by side)
module horizontal_stack_demo() {
    periodic_element_box();
    example_card();
    
    translate([box_size, 0, 0]) {
        periodic_element_box();
        example_card();
    }
}

// Module to demonstrate boxes stacked vertically (on top of each other)
module vertical_stack_demo() {
    periodic_element_box();
    example_card();
    
    translate([0, 0, box_depth]) {
        periodic_element_box();
        example_card();
    }
}

// Module to demonstrate boxes stacked both horizontally and vertically
module grid_stack_demo() {
    periodic_element_box();
    example_card();
    
    translate([box_size, 0, 0]) {
        periodic_element_box();
        example_card();
    }
    
    translate([0, 0, box_depth]) {
        periodic_element_box();
        example_card();
    }
    
    translate([box_size, 0, box_depth]) {
        periodic_element_box();
        example_card();
    }
}

// Render based on demo selection
if (stacking_demo == 1) {
    horizontal_stack_demo();
} else if (stacking_demo == 2) {
    vertical_stack_demo();
} else if (stacking_demo == 3) {
    grid_stack_demo();
} else {
    // Default view of single box
    periodic_element_box();
    example_card();
}