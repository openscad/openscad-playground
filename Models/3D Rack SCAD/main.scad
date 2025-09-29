include <BOSL2/std.scad>
include <BOSL2/joiners.scad>

/*[Rack Dimensions]*/
rack_width = 201;
rack_depth = 222.4;
rack_height = 184;
section_height = 9.4;

/*[Plate Configuration]*/
// Number of plates (minimum 1)
num_plates = 3;  // [1:10] // Customize min and max as needed

/*[Hole Configuration]*/
hole_diameter = 16;     //// [1.0:1.0:100.0] Diameter of holes
num_holes_x = 0;        // Number of holes in X direction (0 for auto-calculate)
num_holes_y = 0;        // Number of holes in Y direction (0 for auto-calculate)
hole_spacing = 9.8;       // Spacing between holes in mm (only when hole count is specified)


/*[Hole Numbering Configuration]*/
// Enable hole numbering
enable_numbers = true;  // [true,false]
// Numbering direction
number_direction = "left_to_right"; // [left_to_right,right_to_left,front_to_back,back_to_front]
// Enable middle dot markers
enable_center_dots = true;  // [true,false]
// Depth of number indents
number_depth = 3;  // [0.5:0.1:4]
// Scale of numbers
number_scale = 1;  // [0.5:0.1:3]
// Rotation of numbers (degrees)
number_rotation = 0;  // [-180:5:180]
// Number spacing from hole edge
number_spacing = 3;  // [2:0.5:10]
// Vertical offset for numbers to prevent cutoff
number_vertical_offset = 1;  // [0:0.5:5]

/*[Dovetail Configuration]*/
dovetail_width = 15;
dovetail_height = 4;
dovetail_back_width = 18;
support_thickness = 14.3;

/*[Handle Configuration]*/
handle_width = support_thickness;  // Match support thickness
handle_height = 60;               // Height of handle extension
handle_depth = rack_depth;                // Total depth/thickness of handle block
slot_width = 150;                  // Width of the single slot
slot_height = 36;                 // Height of the slot
slot_corner_radius = 6;           // Radius for slot corners
corner_radius = 5;                // Radius for handle corners

/*[Vertical Support Dovetail Configuration]*/
dovetail_spacing = 60;      // Spacing between dovetails
dovetail_start_height = 10; // Height of first dovetail from bottom
dovetail_count = num_plates + 1;  // One more dovetail than plates for secure assembly

/*[Margin and Depth Configuration]*/
side_margin = 30;     // Larger margin for sides with dovetails
front_margin = 15;    // Smaller margin for front/back edges without dovetails
bottom_depth = 7;

/*[Component Selection]*/
// Combo box to select which component to render
component_selection = "assembly"; // [assembly:Assembly, bottom_rack:Bottom Rack, combined_rack:Combined Rack, vertical_support:Vertical Support]

/* Function, module, and layout definitions remain the same as in the original code */

/* Main rendering switch based on selected component */
if (component_selection == "assembly") {
    assembly();
} else if (component_selection == "bottom_rack") {
    bottom_rack();
} else if (component_selection == "combined_rack") {
    combined_rack();
} else if (component_selection == "vertical_support") {
    vertical_support();
}

//--------------------------//
// Derived Dovetail Parameters
//--------------------------//
dovetail_opening_width = section_height + 0.3; // Width of center opening
dovetail_cut_depth = dovetail_height + 4;      // Depth of the front face cut

//--------------------------//
// Hole Layout Calculation
//--------------------------//
// Function to calculate hole layout based on parameters
function calc_hole_layout() =
    let(
        // Available space
        avail_width = rack_width - 2*side_margin,
        avail_depth = rack_depth - 2*front_margin,
        
        // Calculate holes and spacing based on input parameters
        cols = (num_holes_x > 0) ? num_holes_x : floor((avail_width + hole_spacing) / (hole_diameter + hole_spacing)),
        rows = (num_holes_y > 0) ? num_holes_y : floor((avail_depth + hole_spacing) / (hole_diameter + hole_spacing)),
        
        // Calculate actual spacing
        spacing_x = (num_holes_x > 0 && hole_spacing > 0) ? hole_spacing :
                   (cols <= 1) ? 0 : (avail_width - cols * hole_diameter) / (cols - 1),
        spacing_y = (num_holes_y > 0 && hole_spacing > 0) ? hole_spacing :
                   (rows <= 1) ? 0 : (avail_depth - rows * hole_diameter) / (rows - 1)
    )
    [cols, rows, spacing_x, spacing_y];

// Get calculated values
calculated = calc_hole_layout();
cols = calculated[0];
rows = calculated[1];
hole_spacing_x = calculated[2];
hole_spacing_y = calculated[3];


// Helper module for creating rounded rectangle slot
module rounded_slot(width, height, depth, radius) {
    // Create a rounded rectangle slot that goes through the entire depth
    hull() {
        // Place four cylinders at each corner of the rectangle
        translate([-width/2 + radius, -height/2 + radius, 0])
            cylinder(r=radius, h=depth, center=false);
        
        translate([width/2 - radius, -height/2 + radius, 0])
            cylinder(r=radius, h=depth, center=false);
        
        translate([-width/2 + radius, height/2 - radius, 0])
            cylinder(r=radius, h=depth, center=false);
        
        translate([width/2 - radius, height/2 - radius, 0])
            cylinder(r=radius, h=depth, center=false);
    }
}



// Modified bottom_dimples module with calculated holes
module bottom_dimples() {
    translate([-rack_width/2 + side_margin + hole_diameter/2, 
              -rack_depth/2 + front_margin + hole_diameter/2, 
              section_height - bottom_depth])
    for(x = [0:cols-1]) {
        for(y = [0:rows-1]) {
            translate([x*(hole_diameter + hole_spacing_x), 
                      y*(hole_diameter + hole_spacing_y), 
                      0])
            cylinder(h=bottom_depth, d1=hole_diameter, d2=hole_diameter*0.9);
        }
    }
}

// Modified tube_holes module with calculated holes
module tube_holes() {
    translate([-rack_width/2 + side_margin + hole_diameter/2, 
              -rack_depth/2 + front_margin + hole_diameter/2, 
              0])
    for(x = [0:cols-1]) {
        for(y = [0:rows-1]) {
            translate([x*(hole_diameter + hole_spacing_x), 
                      y*(hole_diameter + hole_spacing_y), 
                      0])
            cylinder(h=section_height*3, d=hole_diameter, center=true);
        }
    }
}

// Part 1: Bottom Rack with Dimples (without dovetails passing through)
module bottom_rack() {
    difference() {
        // Main body with bottom dimples and attached dovetails
        cuboid([rack_width, rack_depth, section_height], anchor=CENTER) {
            // Left side male dovetail
            attach(LEFT)
                dovetail("male", slide=rack_depth, width=dovetail_width, height=dovetail_height, back_width=dovetail_back_width, spin=90);

            // Right side male dovetail
            attach(RIGHT)
                dovetail("male", slide=rack_depth, width=dovetail_width, height=dovetail_height, back_width=dovetail_back_width, spin=90);
        }
        // Subtract bottom dimples
        bottom_dimples();
    }
}

// Part 2: Combined Middle and Top Rack with Through Holes
// Function to get hole number based on direction and position
function get_hole_number(x, y, total_x, total_y) =
    let(
        total_holes = total_x * total_y,
        left_to_right_num = y * total_x + x + 1,
        right_to_left_num = y * total_x + (total_x - x),
        front_to_back_num = x * total_y + y + 1,
        back_to_front_num = x * total_y + (total_y - y)
    )
    number_direction == "left_to_right" ? left_to_right_num :
    number_direction == "right_to_left" ? right_to_left_num :
    number_direction == "front_to_back" ? front_to_back_num :
    back_to_front_num;

// Modified module to add numbered indents with improved spacing
module numbered_tube_holes() {
    translate([-rack_width/2 + side_margin + hole_diameter/2, 
              -rack_depth/2 + front_margin + hole_diameter/2, 
              0]) {
        for(x = [0:cols-1]) {
            for(y = [0:rows-1]) {
                translate([x*(hole_diameter + hole_spacing_x), 
                          y*(hole_diameter + hole_spacing_y), 
                          0]) {
                    // Main hole
                    cylinder(h=section_height*3, d=hole_diameter, center=true);
                    
                    // Number indent with improved spacing
                    if (enable_numbers) {
                        hole_number = get_hole_number(x, y, cols, rows);
                        number_width = len(str(hole_number)) * 4 * number_scale; // Approximate width of number
                        
                        translate([0, 
                                 -hole_diameter/2 - number_spacing - number_width/2, 
                                 section_height/2 - number_depth + number_vertical_offset])
                            rotate([0, 0, number_rotation])
                                scale([number_scale, number_scale, 1])
                                    linear_extrude(number_depth + 0.01)
                                        text(str(hole_number), 
                                             halign="center", 
                                             valign="center",
                                             size=8);
                    }
                    
                    // Center dot marker
                    if (enable_center_dots) {
                        translate([0, 0, section_height/2 - number_depth])
                            cylinder(h=number_depth + 0.01, d=2);
                    }
                }
            }
        }
    }
}

// Modified combined_rack module to use numbered holes
module combined_rack() {
    difference() {
        // Main body of the combined rack
        cuboid([rack_width, rack_depth, section_height], anchor=CENTER) {
            // Left side male dovetail
            attach(LEFT)
                dovetail("male", slide=rack_depth, width=dovetail_width, height=dovetail_height, back_width=dovetail_back_width, spin=90);

            // Right side male dovetail
            attach(RIGHT)
                dovetail("male", slide=rack_depth, width=dovetail_width, height=dovetail_height, back_width=dovetail_back_width, spin=90);
        }
        
        // Numbered hole pattern
        numbered_tube_holes();
    }
}

// Part 3: Vertical Support with Dynamic Number of Dovetails
module vertical_support() {
    // Calculate total height needed based on number of plates
    total_height = max(rack_height, (num_plates * section_height) + dovetail_start_height + section_height);
    
    union() {
        difference() {
            // Main body of the vertical support
            cuboid([support_thickness, rack_depth, total_height], anchor=BOTTOM);
            
            // Create multiple dovetail joints with partial openings
            for(i = [0:dovetail_count-2]) {
                dovetail_z_pos = dovetail_start_height + i * dovetail_spacing;
                
                translate([0, rack_depth/2, dovetail_z_pos]) {
                    // Create the main dovetail cutout
                    rotate([0, 90, 0])
                        dovetail("female", 
                                slide=rack_depth*2, 
                                width=dovetail_width, 
                                height=dovetail_height, 
                                back_width=dovetail_back_width);
                    
                    // Add the partial opening only on the front face
                    translate([support_thickness/2 - dovetail_cut_depth/2, 0, 0])
                        cuboid([dovetail_cut_depth, 
                               rack_depth*4,
                               dovetail_opening_width], 
                               anchor=CENTER);
                }
            }
        }
        
// Add handle on top
translate([0, 0, total_height]) {
    difference() {
        // Handle body with rounded top corners only on thin sides (front and back)
        hull() {
            // Bottom part - full rectangular base
            translate([0, 0, 0])
                cuboid([handle_width, handle_depth, 0.01], anchor=BOTTOM);
            
            // Top part with rounded corners only on thin sides
            translate([0, 0, handle_height-corner_radius]) {  // Subtract corner_radius to maintain correct height
                // Add main rectangular body
                cuboid([handle_width, handle_depth-2*corner_radius, 0.01], anchor=BOTTOM);
                
                // Add rounded corners only on front and back
                translate([0, handle_depth/2-corner_radius, 0])
                    xcyl(h=handle_width, r=corner_radius, anchor=BOTTOM);
                translate([0, -handle_depth/2+corner_radius, 0])
                    xcyl(h=handle_width, r=corner_radius, anchor=BOTTOM);
            }
        }
                
        // Adjust the slot depth and ensure it goes all the way through
        translate([-10, 0, handle_height/2]) 
            rotate([0, 90, 0])
                rounded_slot(slot_height, slot_width, handle_depth*3, slot_corner_radius);
    }
}
    }
}


// Dynamic assembly based on number of plates
module assembly() {
    color("LightBlue") 
        up(dovetail_start_height)  // Raise bottom rack to align with first dovetail
            bottom_rack();
    
    // Only add combined racks if num_plates > 1
    if (num_plates > 1) {
        for(i = [1:num_plates-1]) {
            color("LightGreen") 
                up(dovetail_start_height + dovetail_spacing * i)  // Raise combined racks to align with subsequent dovetails
                    combined_rack();
        }
    }
    
    // Left support
    color("White") 
        translate([-rack_width/2, 0, 0]) 
            vertical_support();
    
    // Right support (mirrored)
    color("White") 
        translate([rack_width/2, 0, 0]) 
            mirror([1,0,0]) vertical_support();
}