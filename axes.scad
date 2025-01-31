
/* Dual Letter Blocks Illusion and Triple Letter Blocks Ambigram
   by Lyl3

Creates a series of blocks that are each shaped like two or three different letters
when viewed from two or three orthogonal viewpoints.

This codebase now handles both the dual and the triple letter block ambigrams published at:
https://www.thingiverse.com/thing:3516901
https://www.thingiverse.com/thing:3633456

The basic parameters are different for each and must be removed from the parameters section
before being published on Thingiverse in order to use the Customizer app.

DualV1.1 Reduced base $fn value from 100 to 50
DualV1.2 Resized and positioned a few special characters so that they can be printed
DualV1.3 Doesn't create post when pair of characters is spaces for both.
         Reduced base $fn value from 50 to 25 and set to 50 for the hull circles. This cuts rendering time in half.
DualV1.4 Made instructions clearer

TripV1.1 Added code to pad strings with spaces if generating all 6 permutations
TripV1.2 Override specified base height and set to zero if generating all 6 permutations
TripV1.3 Module tripleLetterString shifts any block down 0.8 mm (for 20 mm block) if it's "OOO" or "UUU"
TripV1.4 Added measurements and adjustments for *, +, @, /, and \

V2.0 Merged codebase from dual letters and triple letters into single combined codebase
     Added capability to add small characters laying flat between the blocks
     Added capability to create multiple STLs
V2.1 Fixed code to handle separate STL creation when no pad or flat characters are being created
V2.2 Added parameter to adjust thickness of flat chracters on the base
     Added parameter to select which permutation of the strings to create
     Move letter blocks and flat characters down very slightly so that model is one single part
     Separate each of the permutations so that they're easier to examine
V2.3 Added option to rotate the top letters so they can be oriented the same as the right face instead of the same as the left face.
     Removed parameter to select which permutation of the strings to create. Code is still there, but customizer doesn't present the option. Remove enclosing str function if you want the parameter presented.
V2.4 Fixed bug that allowed the base of letters with rounded bottoms to not have a flat bottomed base like they're supposed to have. 
    Added option to change width of a space character from minimal (1.2 mm) to maximal (block width), and the minimal width is now always 1.2 mm instead of scaling with the letter scaling.
V2.5 Generate letter blocks for part = 1 even if no base, since the CGAL is cached anyways.
     Added some letter blocks to the STLs for unrequested parts so that they represent what the thing is
     Increased unscaled $fn base from 25 to 40, and decreased to 20 for triple when generating all permutations

V3.0 Added an alternative font that is fatter and has a vastly better chance of making viable triple letter blocks.
     It works so well that now the default is to NOT generate all 6 permutations.
     No longer move triplet of O/U letter block down as it's no longer floating.
     The customizer now only creates a single STL, but the user can still select which part to create
      Bug: A and N generate a non-manifold block no matter what the 3rd letter is
      Fix: They both had a height of 20.417, so I set the height of the A to 20.416
      Bug: Changing align_top value from "front" to "left" broke code checking if (align_top=="left")
      Fix: Changed test to be (align_top!="right")
V3.01 Bug: K and T generate a non-manifold block no matter what the 3rd letter is
      Fix: They both had a height of 20.417, so I set the height of the K to 20.416
      All 676 pairs tested and no other problems found.
V3.02 Convert the input strings to strings in case all numbers are entered for one of them.
V3.03 Added support for a third font: Segoe UI Symbol (a Microsoft Font first available in Windows 7)
       The code is a bit of a hack and the measurements aren't correct for triple letters. The font/glyph code should be cleaned up
       Measurements for only 10 glyphs have been entered

*/

/* [Basic Parameters] */

/* --------------- Dual Letter Parameters - remove for Customizer App, comment out locally
*/
mode = 2 + 0;

all_combos = false + false;

// Letters on left side (use only UPPERCASE letters, numbers, space, or the special characters)
String1 = "DUAL WORD";
string_1 = str(String1); // Make sure a string of all digits is treated as a string and not a number

// Letters on right side (use only UPPERCASE letters, numbers, space, or the special characters)
String2 = "ILLUSION";
string_2 = str(String2); // Make sure a string of all digits is treated as a string and not a number

string_3 = str("");

// Scale of letters (1 = letters 20 mm tall and spaced 22.2 mm apart if spacing is set to 0% below )
letterScaling = 1.5; // [0.5:0.01:10.0]

// Additional spacing between letters (% of letter width, none needed, can be negative)
additionalSpacing = 0.0; // [-10.0:0.1:30.0]

// Height of base (mm) 
baseHeight = 3.0; // [0.0:0.01:30.0]
padHeight = (all_combos == true) ? 0 : baseHeight;

// The width of a space character can't be 0 because the paired character on the other face of the block wouldn't show. By default it's set to 1.2 mm, which is a minimal width for acceptable strength. You can change this to full block width if you prefer. 
width_of_space_character = "minimal - 1.2 mm"; // [minimal - 1.2 mm,maximal - full block width]
// --------------- End of Dual Letter Parameters




/* [Additional Parameters] */

// Where should small characters laying flat between each block be added to the base? 
add_base_characters_where = "nowhere"; // [nowhere,front,back,front and back]
// Put them in a vector so they can share the same code: index 0 = front, index 1 = back
tinyLocations = [(add_base_characters_where == "front" || add_base_characters_where == "front and back") ? true: false,
                 (add_base_characters_where == "back" || add_base_characters_where == "front and back") ? true: false];

// What characters should be added to the base? (Multiple characters allowed, defaults to heart if nothing specified, will cycle through the characters for each location)
what_base_characters = "";
baseChars =  (what_base_characters == " " || what_base_characters == "" || what_base_characters == undef) ? chr(9829): what_base_characters;

// How should the characters added to the base be rotated?
rotate_base_characters = -1; // [0:No rotation, -1:Angled in, 1:Angled out, 2:Random]
rotateBaseChars = (rotate_base_characters != 0 ) ? true: false;

// How much should they be rotated (specifies maximum angle if random rotation is selected)
rotation_angle = 30; // [0:5:180]


/* [Advanced Parameters] */

// Which part would you like to create? (If you're doing multi-extrusion, you can create the parts separately. You'll have to run the customizer multiple times, once for each part)
createPart = 4; // [1:Letter blocks Only, 2:Base only, 3:Small flat characters only, 4:Everything]

// Thickness adjustment ratio for the small flat characters on the base (default is half the thickness of the base)
BaseCharactersThickness = 1.0;  //[0.5:0.1:10]

/* [Hidden] */
fudge = 0.00001;                               // 
letterWidth = 18.4;                            // enough space for the W
letterHeight = 21.37;                          // height of typical letter in chosen font size, could be larger
blockSize = (mode == 2) ? letterWidth : 20;
blockHeight = (mode == 2) ? 21.37 : blockSize; 
myScale = letterScaling * 20 / blockHeight;    // adjust scaling so that selected scale is based on nice even number
minWidth = (mode == 3 || width_of_space_character == "minimal - 1.2 mm") ? 1.2/myScale : blockSize;      // width of block for a space character

spacingRatio = 1+(additionalSpacing/100); //
blockWidth = sqrt(2*blockSize*blockSize);           // hypotenuse of the block sides
padWidth = blockWidth * 1.1;                        // additional 10% around the blocks
defaultSpacing = (mode == 2) ? 0.9 : 1.05;          // Default is 10% closer for dual and 5% farther for triple
blockSpace = blockWidth * (defaultSpacing+(additionalSpacing/100)); 
adjustedPadHeight = padHeight / myScale;      // adjust pad height before being scaled with the letters

StringLeft = (mode == 2 || which_faces[0] == "L") ? string_1 : (which_faces[1] == "L") ? string_2 : string_3;
StringRight = (mode == 2 || which_faces[1] == "R") ? string_2 : (which_faces[2] == "R") ? string_3 : string_1;
StringTop =   (mode == 2 || which_faces[2] == "T") ? string_3 : (which_faces[0] == "T") ? string_1 : string_2;

// Settings for the small letters laying flat on the base
// The sizing and spacing fudges were chosen to approximately center it between the letter blocks
tinyFactor = 2.3;                                     // The inverse of the scaling for the small letters
tinyShifts = [-padWidth/2+1.4*letterHeight/tinyFactor/2, padWidth/2-1.4*letterHeight/tinyFactor/2];

maxStringLength = max(len(string_1),len(string_2),len(string_3));

BaseCharsRotation = (rotate_base_characters == 2) ? 
                     rands(-rotation_angle,rotation_angle,2*(maxStringLength-1))
                     : concat(
                         [for (r = [1 : 1 : (maxStringLength-1)/2]) -rotation_angle*rotate_base_characters],
                         [for (r = [1 : 1 : (maxStringLength-1)%2]) 0],
                         [for (r = [1 : 1 : (maxStringLength-1)/2]) rotation_angle*rotate_base_characters],
                         [for (r = [1 : 1 : (maxStringLength-1)/2]) -rotation_angle*rotate_base_characters],
                         [for (r = [1 : 1 : (maxStringLength-1)%2]) 0],
                         [for (r = [1 : 1 : (maxStringLength-1)/2]) rotation_angle*rotate_base_characters]);
//echo (BaseCharsRotation);
                     
// Lower resolution for triple letters when all permutations being generated                         
$fn = letterScaling * ((mode == 3 && all_combos) ? 20 : 40);

/*
$vpt = [-75,75,0];
$vpr = [90,0,45];
$vpd = 1000;
*/

/* 
Thingiverse customizer can't handle these characters even in comments
so the chr function must be used to enter them
*/
specialCharacters = chr([9829, 9824, 9830, 9827, 9834, 9835, 9792, 9794, 8592, 8594, 960]);
//echo("Special characters:", specialCharacters);  // Uncomment to see what the characters are
                         
specialSymbols = chr([127794, 127795, 127804, 127809, 127863, 127865, 127866, 128008, 128021, 128076]);
//echo("Special symbols:", specialSymbols);  // Uncomment to see what the symbols are
                         
letterIDs = str("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$&<>*+@/\\", specialCharacters, specialSymbols);
letterIDsOverp = str("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$&<>*+@/\\", specialCharacters);
letterIDsRubik = str("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$&<>*+@/\\");
letterIDsSegoe = str(specialSymbols);
glyphLists = [letterIDsOverp, letterIDsRubik, letterIDsSegoe];
                         
/*
Measurements, scaling, and positioning for characters for
fontName = "Overpass Mono:style=Bold";
fontSize = 22;

                       A       B       C       D       E      F      G      H      I       J       K      L       M
                       N       O       P       Q       R      S      T      U      V       W       X      Y       Z
                       0       1       2       3       4      5      6      7      8       9
                       $       &       <       >       *      +      @      /      \
                       heart   spade   diamond club    note1  note2  female male   left    right   pi
*/
// Glyph width
letterWidthsOverp =   [17.40,  14.78,  15.17,  15.203, 14.35, 14.41, 15.54, 14.17, 12.58,  13.92,  15.60, 13.494, 14.17,
                       14.17,  16.21,  14.68,  16.21,  14.38, 14.68, 16.06, 14.44, 17.40,  18.01,  16.61, 16.18,  14.44,
                       15.48,  14.17,  14.32,  14.62,  16.49, 14.47, 15.33, 14.53, 15.51,  15.05,
                       14.59,  18.35,  14.35,  14.35,  14.26, 14.35, 17.00, 15.60, 15.60,
                       15.75,  15.75,  15.75,  16.06,  12.61, 14.29, 12.03, 12.03, 16.67,  16.67,  18.01];
// Glyph height
letterHeightsOverp =  [21.37,  21.37,  22.04,  21.37,  21.37, 21.37, 22.10, 21.37, 21.37,  21.74,  21.37, 21.37,  21.37,
                       21.37,  22.10,  21.37,  21.74,  21.37, 22.10, 21.37, 21.74, 21.37,  21.37,  21.37, 21.37,  21.37,
                       22.10,  21.40,  21.74,  22.10,  21.37, 21.74, 22.10, 21.37, 22.10,  22.10,
                       26.87,  22.10,  14.62,  14.62,  14.17, 14.35, 22.10, 25.70, 25.70,
                       20.30,  20.61,  20.76,  20.61,  20.88, 25.22, 21.74, 22.10, 12.79,  12.79,  16.30];
// Glyph left side bearing
letterXShiftsOverp =  [0.808,  3.15,   1.71,   3.052,  3.23,  3.22,  1.69,  3.27,  4.95,   3.60,   2.97,  3.438,  3.27,
                       3.27,   1.62,   3.16,   1.62,   3.22,  2.80,  1.71,  3.04,  0.81,   0.44,   1.32,  1.62,   3.04,
                       2.17,   3.27,   2.86,   2.885,  1.48,  3,     2.27,  2.94,  2.12,   2.47,
                       2.89,   0.265,  3.105,  3.105,  3.21,  3.1,   1.04,  2.0,   0.5,
                       1.94,   1.94,   1.94,   1.71,   4.94,  1.28,  5.63,  5.63,  1.1,    1.464,  0.44];
// Amount to move the letter in the Y dimension - usually to give the letter a flat bottom and reduce the overhang a bit
letterYShiftsOverp =  [0,      0,      0,      0,      0,     0,     0,     0,     0,      0,      0,     0,      0,
                       0,      0,      0,      0,      0,     0,     0,     0,     0,      0,      0,     0,      0,
                       0,      0,      0,      0,      0,     0,     0,     0,     0,      0,                  
                       2.137,  0,      -4.4,   -4.555, -6.15, -4.6,  0.0,   3.08,  3.08,
                       -2.0,   0,      -2.0,   0,     -1.0,   2.3,   0,     0,     -10.55, -10.55, -0.099]; 
// Amount to scale the letter in Y dimension to fit the letter in the block, typically because it's been moved from the above setting
// and to give it a slightly flattened top (1.6 mm wide top layer when scaled to 0.5)
letterYResizesOverp = [1,      1,      1.015,  1,      1,     1,     1.016, 1,     1,      1.017,  1,     1,      1,
                       1,      1.016,  1,      1,      1,     1.016, 1,     1.017, 1,      1,      1,     1,      1,
                       1.016,  1,      1,      1.016,  1,     1.017, 1.016, 1,     1.016,  1.016,                  
                       1,      1.015,  1,      1,      1.15,  1,     1.016, 1,     1,
                       1.1,    1,      1.1,    1,      1.025, 1.025, 1,     1,     1.2,    1.2,    1.05]; 



/*
Measurements, scaling, and positioning for characters for
fontName = "Rubik Mono One:style=Regular";
fontSize = 21;
                       A       B       C       D       E       F       G       H       I       J       K       L       M
                       N       O       P       Q       R       S       T       U       V       W       X       Y       Z
                       0       1       2       3       4       5       6       7       8       9
                       $       &       <       >       *       +       @       /       \
*/
// Glyph width
letterWidthsRubik =   [23.509, 21.030, 21.612, 20.942, 20.009, 20.125, 21.992, 21.000, 20.066, 21.612, 21.876, 18.609, 22.400,
                       20.009, 21.700, 20.679, 21.700, 21.380, 21.030, 21.700, 21.292, 22.926, 23.859, 21.846, 22.635, 20.300,
                       19.542, 19.512, 19.163, 20.183, 21.029, 19.716, 19.571, 18.404, 20.125, 19.571,
                       21.029, 22.196, 14.029, 14.030, 12.628, 16.855, 24.210, 16.510, 16.510];                  
// Glyph height
letterHeightsRubik =  [20.416, 20.417, 21.001, 20.417, 20.417, 20.417, 21.001, 20.417, 20.417, 20.709, 20.416, 20.417, 20.417,
                       20.417, 21.001, 20.417, 22.605, 20.417, 21.001, 20.417, 20.709, 20.417, 20.417, 20.417, 20.417, 20.417,
                       21.001, 20.417, 20.709, 20.709, 20.417, 20.709, 20.709, 20.417, 21.001, 20.709,
                       26.105, 21.146, 19.601, 19.601, 11.404, 16.159, 23.801, 25.375, 25.375]; 
// Glyph left side bearing
letterXShiftsRubik =  [0.62,   2.35,   1.70,   2.11,   2.62,   2.89,   1.53,   1.80,   2.35,   0.73,   2.45,   4.38,   1.06,
                       2.30,   1.42,   3.55,   1.39,   2.48,   1.72,   1.42,   1.64,   0.80,   0.48,   1.33,   0.95,   2.24,
                       2.68,   3.17,   3.13,   2.40,   1.83,   2.57,   2.89,   3.77,   2.34,   2.59,
                       1.80,   1.86,   6.86,   8.52,   9.65,   4.70,   0.24,   5.01,   5.01];
// Amount to move the letter in the Y dimension - usually to give the letter a flat bottom and reduce the overhang a bit
letterYShiftsRubik =  [0,      -0.15,  -0.07,  -0.195, 0,      0,      -0.11,  0,      0,      -0.11,  0,      0,      0,
                       0,      -0.19,  0,      0.00,   0,      -0.205, 0,      -0.205, 0,      0,      0,      0,      0,
                       0,      0,      0,      0,      0,      0,      0,      0,      0,      0,                  
                       2.12,   0,      -1.9,   -1.9,  -19.9,  -2.60,  1.37,   1.93,   1.93]; 
// Amount to scale the letter in Y dimension to fit the letter in the block, typically because it's been moved from the above setting
// and to give it a slightly flattened top (1.6 mm wide top layer when scaled to 0.5)
letterYResizesRubik = [1,      1.008,  1.0202,  1.01,   1,      1,      1.0225,   1,      1,      1.02,   1,      1,      1,
                       1,      1.0265, 1,      1.0965,  1,     1.027,  1,      1.025,  1,      1,      1,      1,      1,
                       1.0162,  1,      1.0025,  1.016,  1,      1.017,  1.016,  1,      1.016,  1.016,                  
                       1,      1.025,  1.135,   1.135,   1.105,   1,      1.016,  1,      1];
                       

/*
Measurements, scaling, and positioning for characters for
fontName = "Segoe UI Symbol:style=Regular";
fontSize = 20;
                       evergreen-tree deciduous-tree blossom maple-leaf wine-glass tropical-drink beer-mug cat dog ok-hand-sign
*/
// Glyph width
letterWidthsSegoe =   [23.192, 17.224, 24.887, 27.748, 12.979, 18.798, 18.690, 19.788, 27.695, 21.957];                  
// Glyph height
letterHeightsSegoe =  [26.922, 26.922, 24.128, 29.440, 26.944, 28.560, 28.672, 23.789, 21.944, 25.335]; 
// Glyph left side bearing
//letterXShiftsSegoe =  [1.97];
letterXShiftsSegoe =  [1.82, 5.50, 1.06, 0.00, 10.49, 5.94, 4.47, 3.30, 0.00, 2.63];
// Amount to move the letter in the Y dimension - usually to give the letter a flat bottom and reduce the overhang a bit
letterYShiftsSegoe =  [1.85, 2.32, 1.43, 3.53, 0.00, 0.00, 0.00, 1.2, 1.33, 1.6]; 
// Amount to scale the letter in Y dimension to fit the letter in the block, typically because it's been moved from the above setting
// and to give it a slightly flattened top (1.6 mm wide top layer when scaled to 0.5)
letterYResizesSegoe = [1.02, 1.01, 1.01, 1.01, 1.00, 1.00, 1.00, 1.01, 1.03, 1.02];
                       

fontName = ["Overpass Mono:style=Bold", "Rubik Mono One:style=Regular", "Segoe UI Symbol:style=Regular"];
fontSize = [22, 21, 20];

// Which font to use:
// for dual letter blocks, use Overpass Mono
// for triple letter blocks, use Rubik Mono One whenever the glyph is available in the font
// use Segoe UI Symbol for special symbols (font not available in Thingiverse customizer)
useFontNumber = (mode == 2) ?
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 
                 0, 0, 0, 0, 0, 0, 0, 0, 0,
                 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] :
                 [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
                 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
                 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
                 1, 1, 1, 1, 1, 1, 1, 1, 1,
                 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
                      
letterWidths = [letterWidthsOverp, letterWidthsRubik, letterWidthsSegoe];
letterHeights = [letterHeightsOverp, letterHeightsRubik, letterHeightsSegoe];
letterXShifts = [letterXShiftsOverp, letterXShiftsRubik, letterXShiftsSegoe];
letterYShifts = [letterYShiftsOverp, letterYShiftsRubik, letterYShiftsSegoe];
letterYResizes = [letterYResizesOverp, letterYResizesRubik, letterYResizesSegoe];

//tripleLetterBlock (" ", "*", " ");
function whichFont (letter) = ((search(letter,letterIDs)[0])==undef ? 0 : useFontNumber[search(letter,letterIDs)[0]]);

function width (letter) = ((search(letter,letterIDs)[0])==undef ? blockSize : letterWidths[whichFont(letter)][search(letter,glyphLists[whichFont(letter)])[0]]);
function scaleX (letter) = blockSize / ((search(letter,letterIDs)[0])==undef || (mode == 2 && whichFont(letter) ==0) ? blockSize : letterWidths[whichFont(letter)][search(letter,glyphLists[whichFont(letter)])[0]]);
function scaleY (letter) = blockHeight / ((search(letter,letterIDs)[0])==undef ? blockHeight : letterHeights[whichFont(letter)][search(letter,glyphLists[whichFont(letter)])[0]]);
function shiftX (letter) = (search(letter,letterIDs)[0])==undef  || (mode == 2 && whichFont(letter) ==0) ? 0 : -(letterXShifts[whichFont(letter)][search(letter,glyphLists[whichFont(letter)])[0]]);
function shiftY (letter) = (search(letter,letterIDs)[0])==undef ? 0 : letterYShifts[whichFont(letter)][search(letter,glyphLists[whichFont(letter)])[0]];
function resizeY (letter) = (search(letter,letterIDs)[0])==undef ? 1 : letterYResizes[whichFont(letter)][search(letter,glyphLists[whichFont(letter)])[0]];

echo (glyphLists);

module extrudeLetter (letter) {
  if (letter != " " && letter != undef)
    scale([1,resizeY(letter),1])                      // Some characters need to be resized because they're too short or too tall
    translate ([shiftX(letter),shiftY(letter),0])     // After scaling to fill the cube, move it into the cube
    scale ([scaleX(letter),scaleY(letter),1])         // Scale the character to fill the cube
    linear_extrude(blockSize, convexity =4 
  ) text (letter, size=fontSize[whichFont(letter)], font=fontName[whichFont(letter)]);
  else
    if (mode == 2)
      translate ([(blockSize-minWidth)/2,0,0]) 
        cube([minWidth,blockHeight,blockSize]);
    else 
      cube([blockSize,blockSize,blockSize]);    
}
    
module tripleLetterBlock (letter1, letter2, letter3) {
  if ((letter1 != " " && letter1 != undef) || (letter2 != " " && letter2 != undef) || (letter3 != " " && letter3 != undef))
  intersection() {
//  union() {     // Change intersection to union and use highlight/debug modifer on letter of interest to see scaling & positioning
    cube([blockSize,blockSize,blockHeight]);          // cube needed to ensure flat bottomed characters
    translate ([0,blockSize, 0]) rotate([90,0,0])   // left face: move it to orthogonally into position
      extrudeLetter (letter1);
    rotate([90,0,90])                               // right face: rotate to correct orientation
      extrudeLetter (letter2);
    if (mode == 3) {
      translate ([(align_top!="right")?0:blockSize,0,0]) rotate([0,0,(align_top!="right")?0:90])      
        extrudeLetter (letter3);                      // top face is already oriented and position correctly
    }
  }
}

module tripleLetterString (string1, string2, string3, codeMessage) {
  stringLength = max(len(string1),len(string2),len(string3));

  // Create the sequence of letter blocks
  if (codeMessage || createPart == 4 || createPart == 1)
      translate([- (blockSpace*(stringLength-1)/2) - blockWidth/2, 0, adjustedPadHeight-fudge])
        for (i = [0:stringLength-1]) {
          color("BLUE") translate ([i*blockSpace, 0, 0])
            rotate ([0,0,-45]) tripleLetterBlock (string1[i], string2[i], string3[i]);
        }
  // Create a base for the letters
  if (!codeMessage && ((createPart == 2 || createPart == 4) && padHeight != 0))
      translate([-blockSpace*(stringLength-1)/2,0,0])
        color("BLACK") linear_extrude (adjustedPadHeight) hull() {
          translate([blockSpace*(stringLength-1),0,0]) circle(d=padWidth, $fn=50*letterScaling);
           circle(d=padWidth, $fn=50*letterScaling);
        }

  // Add in the small characters flat on the base
  if (!codeMessage && ((createPart == 3 || createPart == 4) && padHeight != 0))
      for (tl=[0:1]) {
        if (tinyLocations[tl] && padHeight != 0) {
          translate([-(blockSpace*(stringLength)/2), tinyShifts[tl], adjustedPadHeight-fudge])
          for (i = [1:1:stringLength-1]) {
            color("red")
              translate ([i*blockSpace,0, 0])
                rotate ([0,0,(rotateBaseChars) ? BaseCharsRotation[tl*(stringLength-1)+i-1]:0])
                  linear_extrude(BaseCharactersThickness*adjustedPadHeight/2)
                    text (baseChars[(tl*(tinyLocations[0]? 1:0)*(stringLength-1)+i-1)%len(baseChars)], size=fontSize[0]/tinyFactor, font=fontName[0], valign="center", halign="center");
            }
          }
      }

}

/* Example and testing values go here
string_1 = "ABCDEFGHIJKLM";
string_2 = "NOPQRSTUVWXYZ";

string_1 = "0123456789";
string_2 = "9876543210";

string_1 = "EEEEEEEEEEEE";
string_2 = chr([36, 60, 62, 9829, 9824, 9830, 9827, 9834, 9835, 8592, 8594, 960]);

string_1 = "GOOD";
string_2 = "LUCK";
string_3 = "GRAD";

string_1 = str("I",chr(9829),"U");
string_2 = "MOM";
string_3 = str("I",chr(9829),"U");

string_1 = str(chr(9829),"M");
string_2 = "UM";
string_3 = "IO";

string_1 = "LUCK";
string_2 = "BABE";
string_3 = "GOOD";

string_1 = "TRIPLE";
string_2 = "TRIPLE";
string_3 = "TRIPLE";

all_combos = false;
padHeight = 0;
tripleLetterBlock ("B", "E", "G");
// Use next two lines to find the dimensions of a glyph: enter letter, create STL, measure STL
glyph = "A";
linear_extrude(blockSize) text (glyph, size=fontSize[whichFont(glyph)], font=fontName[whichFont(glyph)]);
*/

/*
*/
scale ([myScale,myScale,myScale]) 
if (all_combos == true ) {
  translate ([0,-7.5*padWidth,0]) tripleLetterString (StringLeft, StringRight, StringTop);
  translate ([0,-4.5*padWidth,0]) tripleLetterString (StringLeft, StringTop,   StringRight);
  translate ([0,-1.5*padWidth,0]) tripleLetterString (StringRight, StringLeft, StringTop);
  translate ([0, 1.5*padWidth,0]) tripleLetterString (StringRight, StringTop,   StringLeft);
  translate ([0, 4.5*padWidth,0]) tripleLetterString (StringTop,   StringLeft, StringRight);
  translate ([0, 7.5*padWidth,0]) tripleLetterString (StringTop,   StringRight, StringLeft);
} else
  tripleLetterString (StringLeft,StringRight,StringTop,false);

// Make sure each STL created by the Thingiverse Customizer has some content
//if (createPart == 1 && padHeight == 0)
//  linear_extrude (1) text ("No base added. View model with all parts.", size=fontSize/4, font=fontName, $fn=10);
if (createPart == 2 && padHeight == 0) {
   if (mode == 2) 
      scale ([0.7,0.7,0.7]) translate([46,18,0]) tripleLetterString ("DUAL","WORD",StringTop,true);
   if (mode == 3) 
      scale ([0.37,0.37,0.37]) translate([83,30,0]) tripleLetterString ("TRIPLE","TRIPLE","TRIPLE",true);
  linear_extrude (1) text ("No base added.", size=fontSize[0]/4, font=fontName[0], $fn=10);
}
if (createPart == 3 && (!tinyLocations[0] && !tinyLocations[1] || padHeight == 0)) {
   if (mode == 2) 
      scale ([1.26,1.26,1.26]) translate([46,18,0]) tripleLetterString ("DUAL","WORD",StringTop,true);
   if (mode == 3) 
      scale ([0.66,0.66,0.66]) translate([83,24,0]) tripleLetterString ("TRIPLE","TRIPLE","TRIPLE",true);
  linear_extrude (1) text ("No flat characters added.", size=fontSize[0]/4, font=fontName[0], $fn=10);
}


/* --------------- Triple Letter Parameters - remove for Customizer App, comment out locally
mode = 3 + 0;
// Generate all 6 permutations (LRT, LTR, RLT, RTL, TLR, TRL) of letter/word orientations?
all_permutations = "no"; // [yes,no]
all_combos = (all_permutations == "yes") ? true: false;

// If generating a single permutation, which faces are the strings below specifying?  (this parameter may be useful when running locally so that you can easily cycle through each of the permutations)
which_faces = str("LRT"); // [LRT:1- left-right-top, LTR:2- left-top-right, RLT:3- right-left-top, RTL:4- right-top-left, TLR:5- top-left-right, TRL:6- top-right-left]

//The top letters can be oriented in one of two ways. Do you want to vertically align the top letters with the left letters or with the right letters?
align_top = "left"; // [left,right]

// Characters on the LEFT block faces unless generating all six permutations. Use only UPPERCASE letters, numbers, space, or the special characters.
String1 = "LETTER";
string_1 = str(String1); // Make sure a string of all digits is treated as a string and not a number

// Characters on the RIGHT block faces unless generating all six permutations. Use only UPPERCASE letters, numbers, space, or the special characters.
String2 = "BLOCKS";
string_2 = str(String2); // Make sure a string of all digits is treated as a string and not a number

// Characters on the TOP block faces unless generating all six permutations. Use only UPPERCASE letters, numbers, space, or the special characters.
String3 = "TRIPLE";
string_3 = str(String3); // Make sure a string of all digits is treated as a string and not a number

// Scale of letters (1 = letters 20 mm tall and spaced 28.28 mm apart if spacing is set to 0% below )
letterScaling = 1.0; // [0.5:0.01:10.0]

// Additional spacing between letters (% of letter width, none needed, can be negative)
additionalSpacing = 0.0; // [-10.0:0.1:30.0]

// Height of base (mm) - setting ignored and overridden to zero if generating all 6 permutations
baseHeight = 2.0; // [0.0:0.01:30.0]
padHeight = (all_combos == true) ? 0 : baseHeight;
// --------------- End of Triple Letter Parameters
*/




