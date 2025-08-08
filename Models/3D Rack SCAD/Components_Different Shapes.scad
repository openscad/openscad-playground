include <BOSL2/std.scad>
include <BOSL2/joiners.scad>

/*[Rack Dimensions]*/
rack_width = 201;
rack_depth = 222.4;
rack_height = 134;
section_height = 9.4;

/*[Back Support Configuration]*/
// Amount of back support to keep (how much of the back to preserve)
back_support_depth = 30;  // [10:1:100] Amount of back material to keep
// Enable/disable back support
enable_back_support = false;  // [true,false]

/*[Plate Configuration]*/
// Number of plates (minimum 1)
num_plates = 3;  // [1:10] // Customize min and max as needed

/*[Hole Configuration]*/
hole_diameter = 26.3;     // [1.0:1.0:100.0] Diameter of holes
num_holes_x = 0;        // Number of holes in X direction (0 for auto-calculate)
num_holes_y = 0;        // Number of holes in Y direction (0 for auto-calculate)
hole_spacing = 9.8;       // Spacing between holes in mm (only when hole count is specified)

// Shape type for holes
hole_shape = "circle"; // [circle, square, svg]
// File path for custom SVG (only used if hole_shape is "svg")
svg_file = "";  // Leave empty for default shapes
// Enable alternating SVG orientation
enable_alternating = true;  // [true,false]
// Rotation angle for alternating shapes
alternating_angle = 180;  // [-360:5:360] Rotation angle for alternating shapes


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
// New tolerance parameter
dovetail_tolerance = 0.3; // [0.0:0.05:1.0] Tolerance for dovetail joints

/*[Handle Configuration]*/
handle_width = support_thickness;  // Match support thickness
handle_height = 50;               // Height of handle extension
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

/*[Inlay Configuration]*/
// Tolerance for the inlay fit
inlay_tolerance = 0.2;  // [0.0:0.05:1.0] Tolerance for number inlays
// Height offset to ensure good adhesion
height_offset = 0.2;    // [0.0:0.1:1.0] Extra height for better adhesion

/*[Component Selection]*/
// Combo box to select which component to render
component_selection = "assembly"; // [assembly:Assembly, bottom_rack:Bottom Rack, combined_rack:Combined Rack, vertical_support:Vertical Support, number_inlays:Number Inlays]

/* Function, module, and layout definitions remain the same until the main rendering switch */

/* Main rendering switch based on selected component */
if (component_selection == "assembly") {
    assembly();
} else if (component_selection == "bottom_rack") {
    bottom_rack();
} else if (component_selection == "combined_rack") {
    combined_rack();
} else if (component_selection == "vertical_support") {
    vertical_support();
} else if (component_selection == "number_inlays") {
    number_inlays();
}
//--------------------------//
// Derived Dovetail Parameters
//--------------------------//
// Calculate delta to maintain dovetail angle
delta_dovetail = dovetail_back_width - dovetail_width;

// Adjusted dimensions for male dovetail
male_dovetail_width = dovetail_width - dovetail_tolerance;
male_dovetail_height = dovetail_height - dovetail_tolerance;
male_dovetail_back_width = male_dovetail_width + delta_dovetail;

// Adjusted dimensions for female dovetail
female_dovetail_width = dovetail_width + dovetail_tolerance;
female_dovetail_height = dovetail_height + dovetail_tolerance;
female_dovetail_back_width = female_dovetail_width + delta_dovetail;

// Adjusted opening width for partial dovetail cut
dovetail_opening_width = section_height + dovetail_tolerance; // Width of center opening
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

// Modified create_hole_shape module with alternating support and default parameters
module create_hole_shape(size, height, x_index=0, y_index=0) {
    if (hole_shape == "circle") {
        cylinder(h=height, d=size, center=true);
    } 
    else if (hole_shape == "square") {
        cube([size, size, height], center=true);
    }
    else if (hole_shape == "svg") {
        if (svg_file != "") {
            // Convert indices to numbers explicitly and use let() for cleaner calculation
            let(
                x = x_index * 1,  // Force conversion to number
                y = y_index * 1,  // Force conversion to number
                should_rotate = enable_alternating && ((x + y) % 2 == 1),
                rotation_angle = should_rotate ? alternating_angle : 0
            )
            rotate([0, 0, rotation_angle])
                linear_extrude(height=height, center=true)
                    scale([size/100, size/100]) // Normalize to hole size
                        import(svg_file, center=true);
        } else {
            // Fallback to circle if no SVG file specified
            cylinder(h=height, d=size, center=true);
        }
    }
}

// Modified tube_holes module to ensure indices are numbers
module tube_holes() {
    translate([-rack_width/2 + side_margin + hole_diameter/2, 
              -rack_depth/2 + front_margin + hole_diameter/2, 
              0])
    for(x = [0:1:cols-1]) {  // Added step value of 1 to ensure numeric
        for(y = [0:1:rows-1]) {  // Added step value of 1 to ensure numeric
            translate([x*(hole_diameter + hole_spacing_x), 
                      y*(hole_diameter + hole_spacing_y), 
                      0])
            create_hole_shape(hole_diameter, section_height*3, x, y);
        }
    }
}

// Modified bottom_dimples module to ensure indices are numbers
module bottom_dimples() {
    translate([-rack_width/2 + side_margin + hole_diameter/2, 
              -rack_depth/2 + front_margin + hole_diameter/2, 
              section_height - bottom_depth])
    for(x = [0:1:cols-1]) {  // Added step value of 1 to ensure numeric
        for(y = [0:1:rows-1]) {  // Added step value of 1 to ensure numeric
            translate([x*(hole_diameter + hole_spacing_x), 
                      y*(hole_diameter + hole_spacing_y), 
                      0]) {
                if (hole_shape == "circle") {
                    cylinder(h=bottom_depth, d1=hole_diameter, d2=hole_diameter*0.9);
                } else {
                    scale([1, 1, bottom_depth/(hole_diameter/2)])
                        create_hole_shape(hole_diameter, hole_diameter/2, x, y);
                }
            }
        }
    }
}

// Part 1: Bottom Rack with Dimples (without dovetails passing through)
module bottom_rack() {
    difference() {
        // Main body with bottom dimples
        cuboid([rack_width, rack_depth, section_height], anchor=CENTER) {
            // Left side male dovetail - only on front portion if back support enabled
            if (enable_back_support) {
                translate([0, (back_support_depth/2), 0])
                    attach(LEFT)
                        dovetail("male", 
                                slide=rack_depth - back_support_depth, 
                                width=male_dovetail_width, 
                                height=male_dovetail_height, 
                                back_width=male_dovetail_back_width, 
                                spin=90);
            } else {
                attach(LEFT)
                    dovetail("male", 
                            slide=rack_depth, 
                            width=male_dovetail_width, 
                            height=male_dovetail_height, 
                            back_width=male_dovetail_back_width, 
                            spin=90);
            }

            // Right side male dovetail - only on front portion if back support enabled
            if (enable_back_support) {
                translate([0, (back_support_depth/2), 0])
                    attach(RIGHT)
                        dovetail("male", 
                                slide=rack_depth - back_support_depth, 
                                width=male_dovetail_width, 
                                height=male_dovetail_height, 
                                back_width=male_dovetail_back_width, 
                                spin=90);
            } else {
                attach(RIGHT)
                    dovetail("male", 
                            slide=rack_depth, 
                            width=male_dovetail_width, 
                            height=male_dovetail_height, 
                            back_width=male_dovetail_back_width, 
                            spin=90);
            }
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

// Modified numbered_tube_holes module to include alternating pattern
module numbered_tube_holes() {
    translate([-rack_width/2 + side_margin + hole_diameter/2, 
              -rack_depth/2 + front_margin + hole_diameter/2, 
              0]) {
        for(x = [0:1:cols-1]) {
            for(y = [0:1:rows-1]) {
                translate([x*(hole_diameter + hole_spacing_x), 
                          y*(hole_diameter + hole_spacing_y), 
                          0]) {
                    // Main hole with custom shape and alternating pattern
                    create_hole_shape(hole_diameter, section_height*3, x, y);
                    
                    // Number indent
                    if (enable_numbers) {
                        hole_number = get_hole_number(x, y, cols, rows);
                        number_width = len(str(hole_number)) * 4 * number_scale;
                        
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
            // Left side male dovetail - only on front portion if back support enabled
            if (enable_back_support) {
                translate([0, (back_support_depth/2), 0])
                    attach(LEFT)
                        dovetail("male", 
                                slide=rack_depth - back_support_depth, 
                                width=male_dovetail_width, 
                                height=male_dovetail_height, 
                                back_width=male_dovetail_back_width, 
                                spin=90);
            } else {
                attach(LEFT)
                    dovetail("male", 
                            slide=rack_depth, 
                            width=male_dovetail_width, 
                            height=male_dovetail_height, 
                            back_width=male_dovetail_back_width, 
                            spin=90);
            }

            // Right side male dovetail - only on front portion if back support enabled
            if (enable_back_support) {
                translate([0, (back_support_depth/2), 0])
                    attach(RIGHT)
                        dovetail("male", 
                                slide=rack_depth - back_support_depth, 
                                width=male_dovetail_width, 
                                height=male_dovetail_height, 
                                back_width=male_dovetail_back_width, 
                                spin=90);
            } else {
                attach(RIGHT)
                    dovetail("male", 
                            slide=rack_depth, 
                            width=male_dovetail_width, 
                            height=male_dovetail_height, 
                            back_width=male_dovetail_back_width, 
                            spin=90);
            }
        }
        
        // Numbered hole pattern
        numbered_tube_holes();
    }
}

// Part 3: Vertical Support with Dynamic Number of Dovetails
module vertical_support() {
    // Calculate total height needed based on number of plates
    total_height = max(rack_height, (num_plates * section_height) + dovetail_start_height + section_height);
    
    difference() {
        union() {
            // Main body of the vertical support
            cuboid([support_thickness, rack_depth, total_height], anchor=BOTTOM);
            
            // Add handle on top
            translate([0, 0, total_height]) {
                // Handle body with rounded top corners only on thin sides (front and back)
                hull() {
                    // Bottom part - full rectangular base
                    translate([0, 0, 0])
                        cuboid([handle_width, handle_depth, 0.01], anchor=BOTTOM);
                    
                    // Top part with rounded corners only on thin sides
                    translate([0, 0, handle_height-corner_radius]) {
                        // Add main rectangular body
                        cuboid([handle_width, handle_depth-2*corner_radius, 0.01], anchor=BOTTOM);
                        
                        // Add rounded corners only on front and back
                        translate([0, handle_depth/2-corner_radius, 0])
                            xcyl(h=handle_width, r=corner_radius, anchor=BOTTOM);
                        translate([0, -handle_depth/2+corner_radius, 0])
                            xcyl(h=handle_width, r=corner_radius, anchor=BOTTOM);
                    }
                }
            }
        }
        
        // Cut handle slot
        translate([-support_thickness/2, 0, total_height + handle_height/2]) 
            rotate([0, 90, 0])
                rounded_slot(slot_height, slot_width, support_thickness, slot_corner_radius);
        
        // Create multiple dovetail joints with partial openings
        for(i = [0:dovetail_count-2]) {
            dovetail_z_pos = dovetail_start_height + i * dovetail_spacing;
            
            translate([0, 0, dovetail_z_pos]) {
                if (enable_back_support) {
                    // Cut dovetail from the front, preserving the back portion
                    translate([0, ((rack_depth) - (rack_depth - back_support_depth))/2, 0])
                        rotate([0, 90, 0])
                            dovetail("female", 
                                    slide=rack_depth - back_support_depth, 
                                    width=female_dovetail_width, 
                                    height=female_dovetail_height, 
                                    back_width=female_dovetail_back_width);
                    
                    // Add the partial opening aligned with the dovetail at the front
                    //translate([support_thickness/2 - dovetail_cut_depth/2, 
                            //ack_depth/2 - (rack_depth - back_support_depth)/2, 0])
                    translate([support_thickness/2 - dovetail_cut_depth/2, 0, 0])
                        cuboid([dovetail_cut_depth, 
                               rack_depth,
                               dovetail_opening_width], 
                               anchor=CENTER);
                } else {
                    // Cut through entire body when back support is disabled
                    translate([0, 0, 0])
                        rotate([0, 90, 0])
                            dovetail("female", 
                                    slide=rack_depth, 
                                    width=female_dovetail_width, 
                                    height=female_dovetail_height, 
                                    back_width=female_dovetail_back_width);
                    
                    // Add the partial opening for the full depth
                    translate([support_thickness/2 - dovetail_cut_depth/2, 0, 0])
                        cuboid([dovetail_cut_depth, 
                               rack_depth,
                               dovetail_opening_width], 
                               anchor=CENTER);
                }
            }
        }
    }
}

// Add new module for number inlays
module number_inlay(number) {
    adjusted_depth = number_depth + height_offset;
    
    // Create the number with tolerance adjustment
    linear_extrude(adjusted_depth)
        offset(r=inlay_tolerance)
            text(str(number), 
                 size=8 * number_scale,
                 halign="center",
                 valign="center");
}

// Module to create all number inlays
module number_inlays() {
    translate([-rack_width/2 + side_margin + hole_diameter/2, 
              -rack_depth/2 + front_margin + hole_diameter/2, 
              0]) {
        for(x = [0:cols-1]) {
            for(y = [0:rows-1]) {
                hole_number = get_hole_number(x, y, cols, rows);
                number_width = len(str(hole_number)) * 4 * number_scale;
                
                translate([x*(hole_diameter + hole_spacing_x), 
                         y*(hole_diameter + hole_spacing_y) - hole_diameter/2 - number_spacing - number_width/2, 
                         section_height/2 - number_depth + number_vertical_offset])
                    rotate([0, 0, number_rotation])
                        number_inlay(hole_number);
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