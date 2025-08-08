// Blue Vane Trap – modular, BOSL2 edition
// Author: Claude (2025‑06‑13)
// ---------------------------------------------------------------------------
//  This script produces three different views that you can toggle with the
//  PART selector:   "vanes"     – the two flat vanes that slot together
//                                    (print two‑up, flat on the bed)
//                   "funnel"    – the threaded funnel with four keyed slots
//                                    (print threads up, with supports)
//                   "assembly"  – fully assembled trap for visualization only
// ---------------------------------------------------------------------------
//  The design is meant for standard *wide‑mouth* Mason jars (86 mm Ø threads).
//  All dimensions are consciously kept as variables so you can adapt to
//  regular‑mouth jars or other containers.
// ---------------------------------------------------------------------------

// =====================[  Libraries  ]=====================
include <BOSL2/std.scad>;          // solids, hull(), etc.
include <BOSL2/threading.scad>;    // screw_thread() helper

// ====================[  Configuration  ]==================
PART               = "assembly"; // "vanes", "funnel", "assembly"
$fn                = 100;        // smoothness for cylinders/cones
slop               = 0.15;       // printing clearance everywhere (mm)

// Mason‑jar thread region (wide mouth)
jar_thread_od      = 86.6;       // outer diameter of male thread (mm)
jar_thread_pitch   = 3.175;      // 8 TPI → 3.175 mm pitch
jar_thread_len     = 8;          // height of threaded region (mm)

// Funnel body
funnel_top_od      = 120;        // outer diameter of top rim (mm)
funnel_bot_od      = 50;         // outer diameter of bottom (jar entrance) (mm)
funnel_height      = 40;         // height of funnel cone (mm)
funnel_wall        = 2;          // wall thickness (mm)

// Vanes (two identical pieces that slot at 90 °)
vane_h             = 140;        // overall height (mm)
vane_w             = 130;        // overall width  (mm)
vane_t             = 2;          // thickness (mm)
slot_clearance     = 0.25;       // additional play for the interlock (mm)
vane_slot_w        = vane_t + slot_clearance;             // width of slot
vane_slot_d        = vane_h/2;                           // depth of slot (half height)

// Keyed sockets in funnel rim (where the crossed vanes sit)
key_depth          = vane_t + 1.0;   // radial depth of notch (mm)
key_width          = vane_w/2 + 4;   // circumferential length (mm)
key_height         = vane_t + 6;     // vertical height of key slot (mm)

// =====================[  Top‑Level  ]====================
if (PART == "vanes")                    vane_assembly();
else if (PART == "funnel")             funnel_only();
else                                    complete_assembly();

// =====================[  Modules  ]======================

// ---- Thread helper (BOSL2) ---------------------------------------------
// Generates an *internal* (female) triangular thread mask that will be
// removed from the funnel so it can screw onto a jar.
module make_jar_threads() {
    screw_thread(
        d       = jar_thread_od + 0.3,      // little extra room
        l       = jar_thread_len + 2,       // poke through for difference()
        pitch   = jar_thread_pitch,
        internal= true,
        anchor  = BOTTOM
    );
}

// ---- Funnel -------------------------------------------------------------
module funnel_only() {
    difference() {
        // cone shell (union of two slices → hull)
        funnel_shell();

        // hollow centre
        translate([0,0,0])
            funnel_interior();

        // internal jar threads
        translate([0,0,-0.1])
            make_jar_threads();

        // four vane sockets (difference cut‑outs)
        for (ang=[0,90,180,270])
            rotate([0,0,ang])
                translate([0, (funnel_top_od/2)-0.1, funnel_height-key_height])
                    cube([key_width, key_depth, key_height], center=true);
    }
}

// Funnel shell (outer cone)
module funnel_shell() {
    hull() {
        translate([0,0,0])
            cylinder(d=funnel_top_od, h=0.5);
        translate([0,0,funnel_height])
            cylinder(d=funnel_bot_od + 2*funnel_wall, h=0.5);
    }
    // Collar with extra meat for the threads
    translate([0,0,-jar_thread_len])
        cylinder(d=jar_thread_od + 2*funnel_wall, h=jar_thread_len);
}

// Funnel interior cavity (inner cone)
module funnel_interior() {
    hull() {
        // top opening (subtract inner diameter)
        translate([0,0,0])
            cylinder(d=funnel_top_od - 2*funnel_wall, h=0.5);
        // bottom opening (jar entrance)
        translate([0,0,funnel_height])
            cylinder(d=funnel_bot_od, h=0.5);
    }
}

// ---- Vane  --------------------------------------------------------------
module single_vane(cross=false) {
    difference() {
        // simple rectangle for reliability; fancy flower edges removed for speed
        translate([0,0,vane_h/2])
            cube([vane_t, vane_w, vane_h], center=true);
        // slot for intersecting vane (vertical)
        translate([0, 0, vane_slot_d/2])
            cube([vane_slot_w, vane_w+2, vane_slot_d], center=true);
    }
    // If cross == true, add the horizontal slot (i.e., the second vane)
    if (cross) {
        difference() {
            translate([0,0,vane_h/2])
                cube([vane_t, vane_w, vane_h], center=true);
            translate([0, 0, vane_h - vane_slot_d/2])
                cube([vane_slot_w, vane_w+2, vane_slot_d], center=true);
        }
    }
}

// Assembly of the two perpendicular vanes
module vane_assembly() {
    single_vane();
    rotate([0,0,90]) single_vane();
}

// ---- Complete Assembly --------------------------------------------------
module complete_assembly() {
    funnel_only();
    // move the vane cross so its centre sits flush with the key slots
    translate([0,0,funnel_height - key_height/2])
        vane_assembly();
}
