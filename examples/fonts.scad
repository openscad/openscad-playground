include <BOSL2/std.scad>
include <BOSL2/structs.scad>

script="Arabic"; // [Arabic,Armenian,Balinese,Bengali,Devanagari,English,Ethiopic,Georgian,Gujarati,Gurmukhi,Hebrew,Javanese,Kannada,Khmer,Lao,Mongolian,Myanmar,Oriya,Sinhala,Tamil,Thai,Tibetan,Tifinagh]

style="Regular"; // [Regular,Bold,Italic]

fonts=[
    "Noto Naskh Arabic",
    // "Noto Naskh Arabic:style=Bold",
    "Noto Sans",
    // "Noto Sans:style=Bold",
    // "Noto Sans:style=Italic",
    "Noto SansArmenian",
    // "Noto SansArmenian:style=Bold",
    "Noto SansBalinese",
    "Noto SansBengali",
    // "Noto SansBengali:style=Bold",
    "Noto Sans CJK TC",
    "Noto SansDevanagari",
    // "Noto SansDevanagari:style=Bold",
    "Noto SansEthiopic",
    // "Noto SansEthiopic:style=Bold",
    "Noto SansGeorgian",
    // "Noto SansGeorgian:style=Bold",
    "Noto SansGujarati",
    // "Noto SansGujarati:style=Bold",
    "Noto SansGurmukhi",
    // "Noto SansGurmukhi:style=Bold",
    "Noto SansHebrew",
    // "Noto SansHebrew:style=Bold",
    "Noto SansJavanese",
    "Noto SansKannada",
    // "Noto SansKannada:style=Bold",
    "Noto SansKhmer",
    // "Noto SansKhmer:style=Bold",
    "Noto SansLao",
    // "Noto SansLao:style=Bold",
    "Noto SansMongolian",
    "Noto SansMyanmar",
    // "Noto SansMyanmar:style=Bold",
    "Noto SansOriya",
    // "Noto SansOriya:style=Bold",
    "Noto SansSinhala",
    // "Noto SansSinhala:style=Bold",
    "Noto SansTamil",
    // "Noto SansTamil:style=Bold",
    "Noto SansThai",
    // "Noto SansThai:style=Bold",
    "Noto SansTibetan",
    // "Noto SansTibetan:style=Bold",
    "Noto SansTifinagh",
];

function pick_font(language, i=0) =
    i < 0 || i > len(fonts)
        ? "Noto Sans" + str(i)
        : is_undef(str_find(fonts[i], language))
            ? pick_font(language, i=i+1)
            : fonts[i];

font = pick_font(script);

greeting = struct_val([
    ["Arabic", "سلام"],
    ["Armenian", "Բարև"],
    ["Balinese", "ᬒᬁᬓᬭ"],
    ["Bengali", "নমস্কার"],
    // ["CJK TC": "你好"],
    ["Devanagari", "नमस्ते"],
    ["English", "Hello"],
    ["Ethiopic", "ሰላም"],
    ["Georgian", "გამარჯობა"],
    ["Gujarati", "નમસ્તે"],
    ["Gurmukhi", "ਸਤ ਸ੍ਰੀ ਅਕਾਲ"],
    ["Hebrew", "שלום"],
    ["Javanese", "ꦱꦸꦒꦼꦁꦫꦮꦸꦃ"],
    ["Kannada", "ನಮಸ್ಕಾರ"],
    ["Khmer", "សួស្តី"],
    ["Lao", "ສະບາຍດີ"],
    ["Mongolian", "ᠰᠠᠶᠢᠨ ᠪᠠᠶᠢᠨᠠ ᠣᠣ"],
    ["Myanmar", "မင်္ဂလာပါ"],
    ["Oriya", "ନମସ୍କାର"],
    ["Sinhala", "ආයුබෝවන්"],
    ["Tamil", "வணக்கம்"],
    ["Thai", "สวัสดี"],
    ["Tibetan", "བཀྲ་ཤིས་བདེ་ལེགས།"],
    ["Tifinagh", "ⴰⵣⵓⵍ"],
], script, "Hello");

direction = struct_val([
  ["Arabic", "rtl"],
  ["Hebrew", "rtl"],
], script, "ltr");

echo(greeting=greeting,
    font=font,
    script=script, 
    direction=direction,
    style=style);

color("gray")
    translate([0, debug ? -60 : -20, 0])
    linear_extrude(1)
        text(
            greeting,
            font=str(font, ":style=", style),
            direction=direction,
            script=script,
            halign="center",
            valign="center");

// You can find the original for the following example in the file explorer above,
// under openscad / examples / Basic / CSG-modules.scad

// CSG-modules.scad - Basic usage of modules, if, color, $fs/$fa

// Change this to false to remove the helper geometry
debug = true;

// Global resolution
$fs=$preview ? 1 : 0.1;  // Don't generate smaller facets than 0.1 mm
$fa=$preview ? 15 : 5;    // Don't generate larger angles than 5 degrees

rotate([-90, 0, 0]) {
  // Main geometry
  difference() {
      intersection() {
          body();
          intersector();
      }
      holes();
  }

  // Helpers
  if (debug) helpers();
}

// Core geometric primitives.
// These can be modified to create variations of the final object

module body() {
    color("Blue") sphere(10);
}

module intersector() {
    color("Red") cube(15, center=true);
}

module holeObject() {
    color("Lime") cylinder(h=20, r=5, center=true);
}

// Various modules for visualizing intermediate components

module intersected() {
    intersection() {
        body();
        intersector();
    }
}

module holeA() rotate([0,90,0]) holeObject();
module holeB() rotate([90,0,0]) holeObject();
module holeC() holeObject();

module holes() {
    union() {
        holeA();
        holeB();
        holeC();
    }
}

module helpers() {
    // Inner module since it's only needed inside helpers
    module line() color("White") cylinder(r=1, h=10, center=true);

    scale(0.5) {
        translate([-30,0,-40]) {
            intersected();
            translate([-15,0,-35]) body();
            translate([15,0,-35]) intersector();
            translate([-7.5,0,-17.5]) rotate([0,30,0]) line();
            translate([7.5,0,-17.5]) rotate([0,-30,0]) line();
        }
        translate([30,0,-40]) {
            holes();
            translate([-10,0,-35]) holeA();
            translate([10,0,-35]) holeB();
            translate([30,0,-35]) holeC();
            translate([5,0,-17.5]) rotate([0,-20,0]) line();
            translate([-5,0,-17.5]) rotate([0,30,0]) line();
            translate([15,0,-17.5]) rotate([0,-45,0]) line();
        }
        translate([-20,0,-22.5]) rotate([0,45,0]) line();
        translate([20,0,-22.5]) rotate([0,-45,0]) line();
    }
}

echo(version=version());
// Written by Marius Kintel <marius@kintel.net>
//
// To the extent possible under law, the author(s) have dedicated all
// copyright and related and neighboring rights to this software to the
// public domain worldwide. This software is distributed without any
// warranty.
//
// You should have received a copy of the CC0 Public Domain
// Dedication along with this software.
// If not, see <http://creativecommons.org/publicdomain/zero/1.0/>.
