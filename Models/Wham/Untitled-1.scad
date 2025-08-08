// OpenSCAD file for the 3d printed parts
$fn=32;

cd_thickness = 1;
cd_hole_radius = 7;
adapter_base_height = 10;
adapter_base_radius = 9;

top_peg_radius = 7/2;
top_peg_height = 8;

pulley_hole_radius = 8.5/2;
pulley_hole_depth = 10;
pulley_inner_height = 12;
pulley_outer_height = 18;
pulley_inner_radius = 7;
pulley_outer_radius = 15;
pulley_base_radius = pulley_outer_radius -2;
pulley_base_height = 8;
pulley_top_height = 4;
pulley_top_screw_radius = 2;
pulley_side_screw_radius = 1.5;

pulley_flange_height =  (pulley_outer_height-pulley_inner_height)/4;


// First set of modules make the 2 parts of the pulley 
module drive_pulley()
{
    difference(){
        union(){
            drive_pulley_base();
            translate([0,0,pulley_base_height]){
            drive_pulley_flange();
            // this is the central column of pulley
            cylinder($fn=64, h = pulley_outer_height, r = pulley_inner_radius, center = false);
            }
        }
        bottom_hole();
        top_hole();
        screw_holes(6,90);
        screw_holes(6,0);
    }
}

module drive_pulley_base()
{
    union(){
            cylinder(h = pulley_base_height/3*2, r = pulley_base_radius, center = false);
            translate([0,0,pulley_base_height/3*2]) cylinder(h = pulley_base_height/3, r1 = pulley_base_radius, r2=pulley_outer_radius, center = false);

    }
}

module drive_pulley_flange()
{
            cylinder(h = pulley_flange_height, r1=pulley_outer_radius, r2 = pulley_inner_radius, center=false);
}

module drive_pulley_flange_top()
{
    difference(){
        union(){
            cylinder(h = pulley_top_height, r=pulley_outer_radius);
            translate([0,0,pulley_top_height])
            drive_pulley_flange();
        }
        
        cylinder(h=20,r=pulley_top_screw_radius,center=true);
    }
}

module top_hole(){
        translate([0,0,pulley_outer_height+5])
        cylinder(h=18,r=pulley_top_screw_radius,center=true);
}

module bottom_hole()
{
 translate([0,0,-1]) cylinder(h = pulley_hole_depth+1, r = pulley_hole_radius, center = false, $fn=64);
}

module screw_holes(height,angle){
    translate([0,0,height/2]) rotate([0,90,angle])  cylinder(h = 30, r = 1.25, center = true);
}


// modules from here make the CD adapter for the top
module cd_adapter()
{
    union(){
        adapter_base();
        translate([0,0,adapter_base_height]) cd_fitting();
        translate([0,0,adapter_base_height+cd_thickness])top_peg();
    }
}

module adapter_base()
{
    cylinder(h = adapter_base_height, r = adapter_base_radius, center = false);
}

module cd_fitting()
{
 cylinder(h = cd_thickness, r = cd_hole_radius, center = false, $fn=64);
}

module top_peg()
{
 cylinder(h = top_peg_height, r = top_peg_radius, center = false, $fn=64);
}


translate([15,15,0])cd_adapter();
translate([-15,-15,0]) drive_pulley();
// Didn't need a top for the pulleyin the end - but this is it below
//translate([20,-20,0]) drive_pulley_flange_top();