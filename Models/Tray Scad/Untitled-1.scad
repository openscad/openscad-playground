// Tube Rack with Parameters

// Parameters
module tube_rack(
    base_length = 150,   // Length of the rack
    base_width = 100,    // Width of the rack
    base_height = 50,    // Height of the rack
    hole_diameter = 20,  // Diameter of the tube holes
    hole_depth = 10,     // Depth of the tube holes
    rows = 4,            // Number of rows of holes
    columns = 4,         // Number of columns of holes
    row_spacing = 30,    // Spacing between rows
    column_spacing = 30, // Spacing between columns
    center_hole = true,  // Checkbox for center hole
    center_hole_diameter = 40 // Diameter of the center hole
) {
    // Base
    difference() {
        // Base block
        cube([base_length, base_width, base_height], center = false);

        // Holes for tubes
        for (row = [0:rows - 1]) {
            for (col = [0:columns - 1]) {
                translate([
                    (col + 0.5) * column_spacing,
                    (row + 0.5) * row_spacing,
                    base_height - hole_depth
                ])
                cylinder(h = hole_depth, d = hole_diameter, center = false);
            }
        }

        // Optional center hole
        if (center_hole) {
            translate([base_length / 2, base_width / 2, base_height - hole_depth])
                cylinder(h = base_height, d = center_hole_diameter, center = false);
        }
    }
}

// Call the tube_rack module
tube_rack(
    base_length = 150,
    base_width = 100,
    base_height = 50,
    hole_diameter = 20,
    hole_depth = 10,
    rows = 4,
    columns = 4,
    row_spacing = 30,
    column_spacing = 30,
    center_hole = true,
    center_hole_diameter = 40
);
