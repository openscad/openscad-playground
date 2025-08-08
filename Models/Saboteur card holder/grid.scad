// Saboteur Card Grid - Single Horizontal Card Holder with Center Cutout and Repositioned Connectors
// For cards of size 56mm × 87mm (positioned horizontally)

/* Parameters */
// Card dimensions (horizontal orientation)
card_width = 87;  // Card width when placed horizontally
card_height = 56; // Card height when placed horizontally

// Tile parameters
card_clearance = 0.5; // Clearance for easy card removal
wall_thickness = 2.2; // Thickness of walls
base_height = 1.2;    // Height of the base
wall_height = 2.5;    // Height of walls above the base
border_width = 5;     // Width of the border that supports the card

// Connector parameters
connector_height = 3;
connector_width = 6;
connector_depth = 3;
connector_tolerance = 0.3;
// Additional vertical offset for top and bottom connectors to keep card access clear
connector_gap = 2;

// Total dimensions of a single tile
total_width = card_width + 2 * card_clearance;
total_height = card_height + 2 * card_clearance;
total_depth = base_height + wall_height;

// Module for a single card holder with center cutout
module card_frame() {
    difference() {
        // Outer frame
        cube([total_width + 2*wall_thickness, 
              total_height + 2*wall_thickness, 
              total_depth]);
        
        // Inner cutout for card - only cutting down from the top, leaving a lip
        translate([wall_thickness, wall_thickness, base_height]) {
            cube([total_width, total_height, wall_height + 1]);
        }
        
        // Center cutout to save material
        translate([wall_thickness + border_width, 
                   wall_thickness + border_width, 
                   0]) {
            cube([total_width - 2*border_width, 
                  total_height - 2*border_width, 
                  total_depth]);
        }
        
        // Cutout for card access/removal at the bottom edge
        translate([wall_thickness + total_width/2 - 15, wall_thickness + total_height, 0]) {
            cube([30, wall_thickness, total_depth + 1]);
        }
        
        // Cutout for card access/removal at the top edge
        translate([wall_thickness + total_width/2 - 15, 0, 0]) {
            cube([30, wall_thickness, total_depth + 1]);
        }
    }
}

// Module for a male connector tab (protruding)
module male_connector() {
    cube([connector_width, connector_depth, connector_height]);
}

// Module for a female connector socket (recessed)
module female_connector() {
    cube([connector_width + connector_tolerance, 
          connector_depth + connector_tolerance, 
          connector_height + connector_tolerance]);
}

// Module for a complete single tile with connectors on all sides.
// The top and bottom connectors are shifted vertically by connector_gap to clear the card access cutouts.
module tile() {
    difference() {
        union() {
            // Base card frame
            card_frame();
            
            // Male connectors on all four sides
            // Right center (unchanged)
            translate([total_width + 2*wall_thickness, 
                      wall_thickness + total_height/2 - connector_width/2, 
                      0])
                male_connector();
            
            // Bottom center - shifted further down by connector_gap
            translate([wall_thickness + total_width/2 - connector_width/2,
                      total_height + 2*wall_thickness + connector_gap, 
                      0])
                male_connector();
                
            // Left center (unchanged)
            translate([-connector_depth,
                      wall_thickness + total_height/2 - connector_width/2, 
                      0])
                male_connector();
                
            // Top center - shifted further up (negative Y) by connector_gap
            translate([wall_thickness + total_width/2 - connector_width/2,
                      -connector_depth - connector_gap, 
                      0])
                male_connector();
        }
        
        // Female connectors on all four sides, with matching adjustments for top and bottom.
        // Right center
        translate([total_width + 2*wall_thickness - connector_tolerance,
                  wall_thickness + total_height/2 - connector_width/2 - connector_tolerance/2, 
                  0])
            female_connector();
        
        // Bottom center
        translate([wall_thickness + total_width/2 - connector_width/2 - connector_tolerance/2,
                  total_height + 2*wall_thickness + connector_gap - connector_tolerance, 
                  0])
            female_connector();
            
        // Left center
        translate([-connector_depth - connector_tolerance,
                  wall_thickness + total_height/2 - connector_width/2 - connector_tolerance/2, 
                  0])
            female_connector();
            
        // Top center
        translate([wall_thickness + total_width/2 - connector_width/2 - connector_tolerance/2,
                  -connector_depth - connector_gap - connector_tolerance, 
                  0])
            female_connector();
    }
}

// Render a single tile
tile();

// Dimensions of a single tile (for reference)
echo("Single tile dimensions:");
echo(str("Width: ", total_width + 2*wall_thickness, " mm"));
echo(str("Height: ", total_height + 2*wall_thickness, " mm"));
echo(str("Depth: ", total_depth, " mm"));
