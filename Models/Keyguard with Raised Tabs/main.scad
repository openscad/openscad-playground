// Written by Volksswitch <www.volksswitch.org>
//
// To the extent possible under law, the author(s) have dedicated all
// copyright and related and neighboring rights to this software to the
// public domain worldwide. This software is distributed without any
// warranty.
//
// You should have received a copy of the CC0 Public Domain Dedication along with this software.
// If not, see <http://creativecommons.org/publicdomain/zero/1.0/>.
//
// keyguard.scad would not have been possible without the generous help of the following therapists and makers:
//	Justus Reynolds, Angela Albrigo, Kerri Hindinger, Sarah Winn, Matthew Provost, Jamie Cain Nimtz, Ron VanArsdale, 
//  Michael O Daly, Duane Dominick (JDD Printing), Joanne Roybal, Melissa Hoffmann, Annette M. A. Cooprider, 
//  Ashley Larisey, Janel Comerford, Joy Hyzny
//
//
// Version History:
//
// Version 2: added support for clip-on straps as a mounting method
// Version 3: rewritten to better support portrait mode and to use cuts to create openings to the screen surface rather than defining rails
//				fixed bug in where padding appeared - put it around the grid rather than around the screen
//				increased the depth of Velcro cut-outs to 3 mm, which roughly translates to 2 mm when printed
//				cut for home button is now made at 90 deg. to not encroach on the grid on tablets with narrow borders
// Version 4: added support for circular cut-outs and the option to specify the shape of the cut-outs
//              added support for covering one or more cells
//              added support for merging a cell cut-out and the next cell cut-out
// Version 5: can print out a plug for one of the cells in the keyguard by choosing "cell cover" in the 
//				Special Actions and Settings>generate pull-down
//				can add a fudge factor to the height and width of the tablet to accommodate filaments that shrink slightly when printing
//				can add add padding around the screen to make the keyguard stronger without affecting the grid and bars to account for cases
//                 that go right up to the edge of the screen
// Version 6: can control the slope of the edges of a message/command bar
// Version 7: moved padding options to Grid Layout section of the user interface to clarify that these affect only the grid region of the screen
//              changed the width of the right border of the iPad 5th generation tablet to match width of the left border
//              made some variable value changes so that it is easier to see the choices selected in the Thingiverse Customizer
//              changed cover_home_button and cover_camera to expose_home_button and expose_camera because the original options were confusing
// Version 8: reduced the maximum slide-in tab width from 30 mm to 10 mm
//            added the ability to merge circular cells horizontally and to merge both rectangular and circular cells vertically
// Version 9: added support rounding the corners of the keyguards, when they are placed in a case, to accommodate
//            cases that have rounded corners on their openings
//            combined functionality for both grid-based and free-form keyguards into a single designer
//	          can now create cell openings that are rounded-rectangles
//            can limit the borders of a keyguard to the size of the screen for testing layouts
// Version 10: reduced some code complexity by using the hull() command on hot dogs and rounded rectangles
//             removed options to compensate for height and width shrinkage, upon testing they are too simplistic and keyguards don't 
//                do well with annealing anyway
//             changed "raised tab thickness" to "preferred raised tab thickness" because the raised tab can't be thicker than the
//                keyguard or it won't slice properly - the keyguard will be raised off the print surface by the bottoms of the four
//                raised tabs
// Version 11: added support for iPad 6th Generation, iPad Pro 11-inch, and iPad Pro 12.9 inch 3rd Generation
//             added ability to offset the screen from one side of the case toward the other
//             fixed bug that caused rounded case corners not to appear in portrait mode
//             added ability to create outside corners on hybrid and freeform keyguards
//             added ability to change the width of slide-in and raised tabs and their relative location (changed the meaning of 
//                "width" as well)
// Version 12: extended the upper end of the padding options to 100 mm after seeing a GoTalk Now 2-button layout
//             minor corrections to a couple of iPad Air 2 measurements
//             added support for swapping the camera/home button sides
//             added support for sloped sides on outer arcs
// Version 13: added support for text engraving
// Version 14: added option to control the number of facets used in circles and arcs - the original value was 360 and the default is now
//                 40 which should greatly improve rendering times and eliminate issues for laptops with limited memory
//             separated the tablet data from the statement that selects the data to use with the intent of making it easier to update
//                 and change the data in Excel
//             migrated from using Apple's statement of "active area" dimension to calculating the size of the screen based on number 
//                 of pixels and pixel size - active area dimensions seemed to overestimate the size of the screen - also assume a single
//                 value for number of vertical pixels in a screen shot and therefore a single value for pixel to mm conversion based
//                 on the stated pixel size
//             added the ability to engrave text on the bottom of the keyguard
//             added support for a separate data file to hold cut information that sits outside of the screen area, will always
//                 be measured in millimeters and will always be measured from the lower left corner of the case opening - so now 
//                 there are two files for defining cuts: one for within the screen area and one for outside of the screen
// Version 15: added support for Nova Chat 10 (does not support exposing the camera)
//             cleaned up the logic around when to cut for home and camera to account for lack of a home button or camera on the
//                 face of the tablet
//             added support for additive features like bumps, walls and ridges
//             fixed bug with height and width compensation for tight cases 
//             added support for using clip-on straps with cases
//             added support for printing clips
//             added support for hiding and exposing the status bar at the top of the screen
// Version 16: changed code to use offset() command to create rounded corners rather than cutting the corners
//			   added a small chamfer to the top edge of the keyguard to reduce the chance of injury
//             changed code to add case and screen cuts "after" adding compensation for tight cases
//			   added support for the NOVAchat 10.5 (does not support exposing the camera)
//             changed filename extension of case_cuts and screen_cuts files from .scad to .info to reduce confusion about what is the 
//                main OpenSCAD program
// Version 17: changed code that creates rounded corner slide-in tabs to use the offset() command because original code was confusing the
//                Thingiverse Customizer
//             fixed bug that prevented adding bumps, ridges and walls in the case_openings.info file
//             added acknowledgements for all those who helped bring keyguard.scad to life
// Version 18: added support for splitting the keyguard into two halves for printing on smaller 3D printers
//             put small chamfer at the top edge of all openings including the home button opening
//                  - it's only visible with large edge slopes like 90 degrees
//             separated circle from hotdog when specifying screen and case openings
//             added minimal error checking for data in screen_openings.info and case_openings.info
//             fixed bug when placing additions from case_openings.info
//             moved pedestals for clip-on straps inward slightly to account for chamfer on the outside edge of keyguard
//             fixed bug that produced a static width for the vertical clip-on strap slots
// Version 19: changed upper limits on command and message bars from 25 mm to 40 mm to support large tablets
//             fixed bug that was exposed when adding height and width compensation to the keyguard for tight fitting cases with
//                  very large corner radii
//             made all radii, including those on the outer corners of the keyguard sensitive to the value of "smoothness_of_circles_and_arcs"
//             fixed a bug that clipped the underside of a clip-on pedestal when it is adjacent to a bar
// Version 20: added support for the iPad Air 3 and the Surface Pro 4
// Version 21: fixed bug involving clip-on straps and split keyguards
//			   fixed bug where cut for vertical clip-on strap (no case) was a different depth than the horizontal strap cuts
//             updated pixel sizes of 0.960 mm/pixel to a more accurate value of 0.962 mm/pixel
//             extended the upper bound for added thickness for tight cases from 15 mm to 20 mm
// Version 22: added number of horizontal pixels to the data for each tablet to properly support portrait mode for free-form and hybrid tablets
//             fixed several bugs associated with creating portrait free-form and hybrid tablets
// Version 23: allow raised tabs as thin as 1 mm
//             accounted for thin walls when using clip-on straps
//             added support for the NOVAchat 12
// Version 24: added support for the iPad 7th generation and iPad Mini 5
//	           changed all iPad data to use calculated screen size measurements rather than values of Active Area from Apple
//             added support for bold, italic, and bold-italic font styles to top and bottom text
// Version 25: added support for NovaChat 5 and 8
//             changed dimensions for NovaChat 10 based on feedback from Saltillo
//             added support for all Microsoft Surface tablets
//             fixed bugs with trim to screen and height and width compensation for tight cases
// Version 26: changed name of Surface Pro 2017 to Surface Pro 5
//             added support for the Fujitsu Stylistic Q665 (used in the Grid Pad 11 system)
//             added check for a zero mm/px corner radius used with a cut for a rounded rectangle and changes shape to a rectangle
//             fixed bugs associated with adding height and width compensation for tight cases
//             fixed bugs associated with trimming the keyguard to the size of the screen
//             fixed code so a zero width wall wouldn't appear between the message and command bar if both are exposed
//             modified outer arcs so that their chamfers would match the chamfers of other shapes in size
//             changed option for "slide_in_tab_thickness" to "preferred_slide_in_tab_thickness" and set actual thickness of tab to 
//                 depend on rail height minus outer chamfer
// Version 27: added support for Surface Pro 7 and Surface Pro X
//             added support for negative padding values
//             added support for dovetail joints, for a more reliable joint, when splitting a keyguard to print on a smaller printer
// Version 28: added support for independent widths for horizontal and vertical rails
//             added support for the Accent 1400 (AC14-20 & AC14-30) system
//             added support for systems (like the Accent) for which there is no tablet sizing information
//             added support for non-rectangular perimeters
//             added support for creating both loose and tight dovetail joints
//Version 29: extended tablet data to support non-iPad-style tablets by allowing for cameras and home buttons to be located on the
//                 long edge of the tablet and to have non-circular shapes
//            added support for clip-on straps to attach to long edge of keyguard, short edge, or both
//            added support for tablet-specific corner radii
//Version 30: added clip-on strap mounting pedestals and slide-in tabs to list of items that can be added to a keyguard in the 
//                  case_additions.info file - to make it possible to have a pedestals and tabs outside of the normal keyguard region 
//                  and into the case_additions regions
//            added support for two different "mini" clips - clips that don't wrap around to the underside of the tablet/case so that
//                   the clip won't interfere with the tablet mount
//            extended the spur of the clip an additional mm to better engage the slot in the pedestal
//            changed the width of the slots in clips to be a function of the clip width
//            added support for independently setting the widths of horizontal and vertical clips
//            fixed a bug with rounded-rectangle case additions when the corner radius is 0
//            fixed several bugs associated with creating cell covers
//Version 31: added support for Amazon Fire HD 8 (10th generation)
//            added support for the Accent 1000, the Dynavox 1-12+, and updated camera/home button info for NovaChat 8
//            changed camera and home button locations to be measured from the edge of the screen rather than the edge of the tablet
//            added support for cutting out the entire screen area - primarily to support validating dimensions for new tablets
//            fixed bug that improperly calculated trimming of towers for clips
//            refactored code associated with unequal case opening dimensions
//            added support for tablets where the screen doesn't sit exactly in the middle of the glass
//Version 32: added support for Dynavox Indi
//            added support for engraved and embossed SVG images
//Version 33: added support for Apple iPad models: iPad 8th generation, iPad Pro 12.9-inch 4th Generation, and iPad Air 4
//            fixed home button location and widened the camera opening for the iPad Pro 12.9-inch 3rd Generation
//            fixed bug in "swap camera and home button" when home button is not located on the face of the tablet
//            turned off creation of camera opening and home button opening if tablet is a system that requires a case
//Version 34: fixed bug in vridgef and hridge features
//			  added support for ridges around cells
//            removed support for walls in screen/case openings.info files
//Version 35: enlarged the opening for the home button in the Accent 1000 to make it easier to reach
//            added support for generating SVG/DXF files for laser-cutting a keyguard
//            limited slide-in tab length to 10 mm rather than 20 mm and set the minimum to 4 mm (exactly 3.175 mm for a
//                    laser-cut keyguard
//Version 36: fixed bug that allowed you to choose a mounting method other than slide-in tabs and no mount for a laser-cut keyguards
//            fixed bug that put a chamfer on outer arcs when type of keyguard is Laser-Cut
//            added support for displaying an SVG version of a screenshot below the keyguard
//            changed rules for shape of opening in laser cut keyguards to allow for circles and rounded rectangles with larger corner radii
//            changed rules to allow for SVG generation of first layer of 3D-Printed type of keyguard - used when testing fit of keyguard to screenshot
//Version 37: moved the home button location further from the edge of the screen and increased the height and width of the home button for
//                    the Accent 1000
//            fixed a bug associated with circular openings and cell ridges when changing rail widths
//            added support for the Fujitsu Stylistic 616 which is exactly like the Fujitsu Stylistic 665 and associated both with the GridPad
//            fixed bug that prevented height/width compensation from working with unequal left/bottom case openings
//            added support for adding height/width compensation to one side of the keyguard at a time
//            added a virtual tablet called "blank" that can be used to specify an arbitrary-sized keyguard - largely for laser-cutting
//            changed labels for "unit of measure" and "starting corner for measurements" to reinforce that they only apply to screen openings
//            added option to ignore Laser-Cutting best practices when creating a laser-cut keyguard
//            added ability to trim keyguard to an arbitrary rectangle by specifying the lower left and upper right coordinates relative to the
//                     lower left corner of the case opening
//            added the ability to use a large rectangle or rounded rectangle as an overall case addition
//            added temporary support for the Chat Fusion 10 from PRC/Saltillo, need verification of screen dimensions and camera/home button data
//            changed the x,y anchor point location for manual clip-on strap pedestals
//            fixed bug where engraved SVG images wouldn't rotate
//            added the ability to control the depth of an engraved svg image
//Version 38: added support for the Accent 800
//            fixed options to add compensation for tight cases to use case opening size rather than screen size
//Version 39: added support for the iPad Pro 12.9-inch 5th Generation, iPad Mini 6th Generation, iPad 9th Generation, iPad Pro 11-inch 2nd
//            Generation and iPad Pro 11-inch 3rd Generation
//Version 40: removed "trim_to_rectangle_lower_left" and "trim_to_rectangle_upper_right" from "Special Actions and Settings" section because
//            we can't remember why we added them in the first place and they weren't working predictably.  (The code was kept in place and
//            commented out in case it becomes useful again.) 
//            added support for "Braille inserts".
//Version 41: screen_openings.info is now ignored if the tablet type is "blank", extended functionality associated with "Braille inserts"
//            added "trim_to_rectangle_lower_left" and "trim_to_rectangle_upper_right" back to "Special Actions and Settings" section
//            setting rows and/or columns to 0 will fill in all grid cuts/openings in a grid-based keyguard
//            added support for the Grid Pad 13
//            added the ability to engrave or emboss ttext and control the depth of the engraving/embossing using the "corner radius" field
//            added the ability to put slide-in tabs along the long edge of the keyguard
//Version 42: fixed and modified the behavior of the slide-in tab case additions to disconnect them from the Customizer pane
//            fixed a problem with manually located clip-on strap pedestals
//            fixed a problem with crescent moon case additions
//            generalized the concept of a "Braille insert" to be a generic "cell insert" - just no Braille text and no opening to create 
//                     a "cell cover"
//			  added support to cut out case-opening region of the keyguard to print case-additions separately
//            added support for a DIY "screen protector" or a keyguard "frame" that allows for "friction-fitting" the keyguard
//            widened all camera opening diameters by at least 1.5 mm to make keyguard placement easier
//Version 43: fixed bug that didn't show slide in tabs when keyguard was split
//            added pixel and millimeter measures directly to info files for use in placing openings and additions
//            added support for inputing app layout measurements directly in pixels for greater accuracy
//            removed bar size measurements from the padding_and_bar_size.xlsx file and change its name to padding_size.xlsx
//Version 44: added support for tablet openings (at this time just ASL sensor openings) by introducing a new .info file
//            expanded the camera opening 2.5 mm wider for iPad 7/8/9 to accommodate the ASL sensor in gen 7 and 8
//            reduced camera angle by 5 degrees
//            widened option for raised-tabs to 60 mm
//            modified raised tabs code to better support tabs with only a ramp portion and no flat portion
//            added support for controling the angle of the ramp portion of the raised tab.
//            replaced the two GridPad Fujitsu tablet types with a single GridPad 12   
//            added support for snap-in attachments to keyguard frames
//Version 45: added support to allow horizontal tabs to be different in length from vertical tabs
//            fixed bug to make the tablet coordinate system sensitive to the unequal case opening settings
//            fixed bug in "cut_case_openings" subroutine that was missing a second argument
//            refactored design to make screen elements and tablet elements insensitive to changes in unequal case opening settings
//            removed protection if manually placed clip-on strap pedestals extend into the screen
//            now able to add raised tabs and clip-on strap mounts to a keyguard frame
//            the keyguard frame customization UI has been redesigned
//            reduced the lower limit for the length of slide-in tabs and shelf depth
//            keyguard tightness of fit is now a general value and not just tied to keyguard frame systems
//            refactored the edge compensation code
//            changed the extension of .info files to .txt for compatibility with Printables.com
//Version 46: added support for changing the angle of the bottom edge of rectangular cell openings to provide better visual and manual
//                     access to small cell openings
//            removed reference to "wall" in .txt files becacause it is no longer supported
//            moved most variable calculations from the .txt files to the designer
//Version 47: changed the default size of the case opening and the keyguard in a keyguard frame to better match an iPad 9 and make more
//                      sense when exploring the features of a keyguard frame   
//            added support for rectangular magnets in raised tabs
//            fixed bug in some renderings of slide-in tabs that were weakly attached to the rest of the keyguard
//            fixed bug with slide-in tabs that may result in non-manifold renderings
//            added support for symmetrical camera and home button openings so the keyguard can easily be rotated if the tablet is rotated
//Version 48: fixed bug associated with setting the slope of the bottom edge of a rectangular opening
//            added support for iPad Air 5
//            added support for non-rectangular cell inserts
//            fixed bug in specification of cell insert recess
//            added support for an externally defined new tablet
//Version 49: fixed bug when generating first layer of a keyguard with slide-in tabs
//            added support for variable sloped opening edges for rounded rectangles, hotdogs and circles
//            added ability to change the slopes of the top and bottom edges of cell openings to provide added visibility into cell openings
//                      when looking at tablet at small or very large angle
//            added support for selecting rounded rectangle corners for bars for greater strength
//            small clean-up on trim to screen function
//            cleaned up implementation of edge compensation for tight cases
//            added support for iPad 10, iPad Pro 11 - 4th gen, and iPad Pro 12.9 - 6th gen
//Version 50: send error message to the console if certain a cut is invalid (e.g., rounded rectangle with oversized corner radius)
//            refactored the approach to the compensation for tight cases
//            refactored the approach to portrait orientation
//            added support for these Microsoft Surface tablets: Pro 8, Pro 9 and Go 3
//            added support for the Amazon Fire HD 10 Plus tablet
//            eliminated the "shape of opening" option and now treat all shapes as variants of a rounded-rectangle
//            reorganized the Grid Layout section into two sections to simplify access to the most common options
//            made bar corner radii dependent on whether contiguous bars are exposed
//            increased the top-end number of pixels for setting the app layout from 2000 to 3000 to support very large tablets in portrait
//                      orientation
//Version 51: combined the screen_opengins.txt, case_openings.txt, and case_additions.txt files into a single file called openings and additions.txt
//            eliminated the need for the tablet_openings.txt file by moving that information into the program
//            added ALS openings for the iPad 1,2,3,5,6 and the iPad Mini 6
//            eliminated the need for the other_tablet.txt file by adding a pair of options in the Special Actions and Settings section.
//Version 52: updated generate>Customizer settings to properly report on Grid Settings
//            updated variables exposed in openings_and_additions.txt to be independent of the settings in the Free-form and Hybrid
//                       Keyguard Settings section
//            removed all code associated with a "Lite" version
//            fixed bug with opening corner radius shapes
//            fixed bugs when slide in tabs and raised tabs are used along with negative tightness of fit values
//            fixed bug when clip-on straps require no pedestal
//Version 53: made the dimensions of the bars independent of any settings in the Free-form and Hybrid Keyguard Settings section
//            changed the color associated with SVG/DXF generated images so they didn't look as much like every rendered keyguard
//            widenend the camera-related cuts associated with a laser-cut keyguard to account for the fact that they can't be sloped,
//                        Home Button, ALS, and cuts created in the TXT file remain unchanged
//            added logic to provide an error message if trying to create a laser-cut keyguard frame or a laser-cut keyguard that goes in a
//                        keyguard frame
//            removed the guardrails from almost all numeric inputs - gets rid of the sliders which are very difficult to use and creates a more
//                        compact UI
//            added additional checks to ensure that App Layout measurements using pixels are internally consistent
//Version 54: added limits for the value of the app layout pixel values because it is the only way to enter values larger than 999
//Version 55: bug fix in the generation of DXF/SVG models
//Version 56: added support for adding a slopped edge to the sides of the Home Button opening to provide easier manual access and made it
//                         the default
//            cleaned up extraneous ALS instruction for iPad 10
//            added support for the TobiiDynavox I-110 (thanks Tee Jay!)
//            fixed bug associated with the size of the camera opening with laser-cut designs
//            added support for mounting posts for systems like the PRC Via Pro
//            moved edge compensation options from Grid Special Settings to Tablet Case section
//            added support for post-based mounting of the keyguard in a keyguard frame
//            added designer version number to Customizer Settings
//            added ability to expose Ambient Light Sensors (or not), exposed by default
//            for visualization of the keyguard and frame together, put [999] in the "other tablet pixel sizes box and generate the keyguard frame
//            made "Shelf" an official keyguard mounting method rather than allowing it only for keyguard frames
//            added the ability to split a keyguard frame
//Version 57: changed the default value of the mini tab height from 2 mm to 1 mm
//            fixed bug in the creation of cell inserts
//            fixed several bugs in the creation of a keyguards mounted to a keyguard frame with posts
//            added support for zero-width rails
//            fixed a minor bug in the creation of posts as a mounting method
//Version 58: fixed bug that prevented generating "first layer for SVG/DXF files" when "type of keyguard" is set to "3D-Printed"
//            ignoring the home button edge slope if add symmetric openings is set to yes
//            added support for the Amazon Fire Max 11
//            prevented symmetric camera/home button openings when using a keyguard frame
//Version 59: added support for horizontal and vertical rail widths, compensation for tight cases to the txt files
//            added support for top/bottom/left/right padding, compensation for tight cases to the txt files
//            added support for angling the display of the keyguard at fixed angles for evaluating keyguard thickness along with screenshot
//            added support for NovaChat 8.5
//            added support for NovaChat 5.3 and 5.4
//            modified the "posts" mounting method to utilize a round post all the way across the top of the keyguard if both the status bar
//                  and the upper message bar are hidden
//            made a similar modification to the posts mounting option for a keyguard frame
//            added support for subtracting plastic from the outer edge of a keyguard like the ability to add plastic
//            fixed bug that swapped the t3 and t4 triangles
//            putting a "#" in the ID column for a screen opening, case opening, or case addition, it will be highlighted in red in the display
//Version 60: added the ability to set the height of the grid region of the keyguard to one height (preferred rail height) and the rest of the 
//					keyguard to a greater height (keyguard height)
//            fixed bug in the emboss/engrave feature
//Version 61: belatedly added keyguard_thickness to the settings displayed when choosing to generate Customizer Settings
//            added support for horizontal and vertical alignment of ttext and btext
//            set the default preferred rail height to 4 mm to match the default keyguard thickness
//Version 62: fixed how "preferred rail height" is reported when generating Customizer Settings
//            fixed bug with recurved edges of slide-in tabs with a length value less than 3 mm
//            rested horizontal and vertical ridges on the bottom of the keyguard and adjust the total height to match
//            added a ridge arc to support manual ridges around merged cells
//            added cell_width (cw), cell_height (ch), and cell corner radius (ccr) to the variables that can be used in the 
//                  openings_and_additions.txt file
//            added height_of_ridge (hor) and thickness_of_ridge (tor) for use in the openings_and_additions.txt file
//            fixed the double-entry of NovaChat 8.5 in the "type of tablet" pull-down list in the Customizer
//            fixed the values for the Posts Info section when generating Customizer Settings
//            added support for the iPad Pro 11-inch (M4), iPad Pro 13-inch (M4), iPad Air 11-inch (M2), and iPad Air 13-inch (M2)
//            fixed a bug where a groove appeared in the bar region even if the associated bar was of zero height
//            fixed some bugs with the creation of posts
//            fixed the camera location on the earlier iPad Pros
//Version 63: cleaned up some artifacts that appear with manual ridge arcs when the ridge thickness is set to larger than 7 mm
//            added minimal support for all 23 Samsung tablets introduced since 2020 (support doesn't include openings for cameras or buttons
//                  on the face of the tablet)
//            changed naming of Accent tablets to match what appears on the PRC website
//            added an entry for Grid Pad 11
//            fixed bugs when adding symetric home button and camera openings
//            corrected the data for the Accent 1400-30
//            fixed bug that allowed laser-cut keyguards to have cells with non-90 degree top and bottom slopes
//            fixed bug that allowed the keyguard shelf to be thicker than the keyguard itself
//            fixed bug that allowed cell inserts to be created via laser-cutting
//            fixed bug that allowed the mini tabs for post mounting to be higher than the thickness of the keyguard
//Version 64: distinguished between two different Accent 1400-30 tablets that impacts their pixel count differences
//Version 65: updated Accent 1400-30a data based on pixel count information from PRC
//            added support for the Accent 1000-20
//            fixed bug when there's an uneven case opening and the keyguard thickness exceeds the rail height
//            fixed bug associated with ALS locations when tablet is oriented in portrait mode
//            added support for engraving/embossing text from within the Customizer
//            exposed the default left and bottom case opening values to make it easier to determine the unequal left/bottom of case value
//            added support for a ridge that can be rotated at any angle, not just horizontal and vertical
//            added support for customization of the slope (chamfer) around the edge of the keyguard
//            added support for customization of the slope (chamfer) at the top edge of a cell (also affects the chamfer on bars)
//            added support for r/rr/c/hd cuts that don't go all the way through the keyguard by putting a number in the "other" column
//            fixed bug that prevented using home button edge slope with keyguard frames
//Version 66: changed the default value of case_width = 220 in Clip-on Strap Info to 275 so a generated horizontal clip would look realistic
//            added support for directly choosing circular openings and moved several of the grid layout options to grid special settings
//            fixed bug that allowed the keyguard thickness of an acrylic keyguard to be other than 3.175 mm thick
//            added support for rectangular and rounded rectangular shapes that are anchored in the center
//            changed section name from "Type of Keyguard" to "Keyguard Basics" to reinforce that this is the section to start with
//            removed some unused modules to clean up the code
//            refactored the creation of a 2D image from a 3D design to avoid arbitrary lines in the SVG file that mess up the laser cut
//            fixed bug in handling svg, ridge, ttext, and btext rotation and other options in the openings_and_additions.txt file
//            added support for the iPad Mini 7 (A17 Pro)
//            fixed bug where echoes of case additions leaked through to keyguards in keyguard frames
//            fixed bug involving keyguard frames and keyguards where the preferred rail height is less than the keyguard thickness
//            moved the generate instruction out of Special Actions and Settings and into Keyguard Basics
//            added support for manual slide-in tab and clip-on strap mounts to keyguard frames
//Version 67: circular cuts in the openings_and_additions.txt file get their diameter from the "height" column, not the "width" column
//            fixed a bug in the generation of the first layer of a laser-cut design that made circles too large
//            the user interface for grid design has changed to set the height and width of rectangular openings directly rather than
//                  indirectly via the widths of the horizontal and vertical rails - this resulted in changing the names of several
//                  options: rail slope > cell edge slope,  preferred rail height > screen area thickness, and
//                  split_line > split_line_location
//            fixed a bug that had slide-in tab thickness depending on the thickness of the rails
//            changed the name of the Grid Layout section to Grid Info for consistency with other sections
//            added grid width in millimeters (gwm), grid height in millimeters (ghm), and keyguard thickness (kt) to the variables available
//                  for use in the openings_and_additions.txt file
//            fixed bug where edge compensation failed to take the cell edge slope into account when determining how much to reduce cell size
//            replaced the "add rounded corners for strength" option with a "bar corner radius option" for simplicity
//            fixed bug involving one slot for a snap-in tab responding to changes in uequal bottom of case opening
//
//
//
//
//
//




//------------------------------------------------------------------
// User Inputs
//------------------------------------------------------------------

/*[Keyguard Basics]*/
type_of_keyguard = "3D-Printed"; // [3D-Printed,Laser-Cut]
//not for use with 3D-Printed keyguards
keyguard_thickness = 4;
//cannot exceed the keyguard thickness
screen_area_thickness = 4;

generate = "keyguard"; //[keyguard,first half of keyguard,second half of keyguard,horizontal clip,vertical clip,horizontal mini clip1,vertical mini clip1,horizontal mini clip2,vertical mini clip2,keyguard frame,keyguard frame - split,cell insert,first layer for SVG/DXF file,Customizer settings]


/*[Tablet]*/
type_of_tablet = "iPad 9th generation"; //[iPad, iPad2, iPad 3rd generation, iPad 4th generation, iPad 5th generation,iPad 6th generation, iPad 7th generation, iPad 8th generation, iPad 9th generation, iPad 10th generation, iPad Pro 9.7-inch, iPad Pro 10.5-inch, iPad Pro 11-inch 1st Generation, iPad Pro 11-inch 2nd Generation, iPad Pro 11-inch 3rd Generation, iPad Pro 11-inch 4th Generation, iPad Pro 11-inch M4, iPad Pro 12.9-inch 1st Generation, iPad Pro 12.9-inch 2nd Generation, iPad Pro 12.9-inch 3rd Generation, iPad Pro 12.9-inch 4th Generation, iPad Pro 12.9-inch 5th Generation, iPad Pro 12.9-inch 6th Generation, iPad Pro 13-inch M4, iPad mini, iPad mini 2, iPad mini 3, iPad mini 4, iPad mini 5, iPad mini 6, iPad mini 7 A17 Pro, iPad Air, iPad Air 2, iPad Air 3, iPad Air 4, iPad Air 5, iPad Air 11-inch M2, iPad Air 13-inch M2, Dynavox I-12+, Dynavox Indi, TobiiDynavox I-110, NovaChat 5, NovaChat 5.3, NovaChat 5.4, NovaChat 8.5, NovaChat 10, NovaChat 12, Chat Fusion 10, Surface 2, Surface 3, Surface Pro 3, Surface Pro 4, Surface Pro 5, Surface Pro 6, Surface Pro 7, Surface Pro 8, Surface Pro 9, Surface Pro X, Surface Go, Surface Go 3, Accent 800, Accent 1000-20, Accent 1000-30, Accent 1000-40, Accent 1400-20, Accent 1400-30a, Accent 1400-30b, GridPad 11, GridPad 12, GridPad 13, Samsung Galaxy Tab A 8.4, Samsung Galaxy Tab A7 10.4, Samsung Galaxy Tab A7 Lite, Samsung Galaxy Tab A8, Samsung Galaxy Tab A9, Samsung Galaxy Tab A9+, Samsung Galaxy Tab Active 5, Samsung Galaxy Tab Active3, Samsung Galaxy Tab Active4 Pro, Samsung Galaxy Tab S6, Samsung Galaxy Tab S6 Lite, Samsung Galaxy Tab S7, Samsung Galaxy Tab S7 FE, Samsung Galaxy Tab S7+, Samsung Galaxy Tab S8, Samsung Galaxy Tab S8 Ultra, Samsung Galaxy Tab S8+, Samsung Galaxy Tab S9, Samsung Galaxy Tab S9 FE, Samsung Galaxy Tab S9 FE+, Samsung Galaxy Tab S9 Ultra, Samsung Galaxy Tab S9+, Amazon Fire HD 7, Amazon Fire HD 8, Amazon Fire HD 8 Plus, Amazon Fire HD 10, Amazon Fire HD 10 Plus, Amazon Fire Max 11, blank, other tablet]
orientation = "landscape"; //[portrait,landscape]
expose_home_button = "yes"; //[yes,no]
home_button_edge_slope = 30; //[30:90]
expose_camera = "yes"; //[yes,no]
swap_camera_and_home_button = "no"; //[yes,no]
//cannot be used with unequal case opening sides or with keyguard frames
add_symmetric_openings = "no"; //[yes,no]
expose_ambient_light_sensors = "yes"; //[yes,no]


/*[Tablet Case]*/
have_a_case = "yes"; //[yes,no]
height_of_opening_in_case = 175;
width_of_opening_in_case = 245;
case_opening_corner_radius = 5;
top_edge_compensation_for_tight_cases = 0;
bottom_edge_compensation_for_tight_cases = 0;
left_edge_compensation_for_tight_cases = 0;
right_edge_compensation_for_tight_cases = 0;


/*[App Layout in px]*/
bottom_of_status_bar = 0; //[0:10000]
bottom_of_upper_message_bar = 0; //[0:10000]
bottom_of_upper_command_bar = 0; //[0:10000]
top_of_lower_message_bar = 0; //[0:10000]
top_of_lower_command_bar = 0; //[0:10000]


/*[App Layout in mm]*/
status_bar_height = 0;
upper_message_bar_height = 0;
upper_command_bar_height = 0;
lower_message_bar_height = 0;
lower_command_bar_height = 0;


/*[Bar Info]*/
expose_status_bar = "no"; //[yes,no]
expose_upper_message_bar = "no"; //[yes,no]
expose_upper_command_bar = "no"; //[yes,no]
expose_lower_message_bar = "no"; //[yes,no]
expose_lower_command_bar = "no"; //[yes,no]
bar_edge_slope = 90; //[30:90]
bar_corner_radius = 2; // [0:5]


/*[Grid Info]*/
number_of_rows = 3;
number_of_columns = 4;
cell_shape = "rectangular"; // [rectangular,circular]
cell_height = 25;
cell_width = 25;
cell_corner_radius = 3;
cell_diameter = 15;


/*[Grid Special Settings]*/
cell_edge_slope = 90; //[30:90]
// example: [3, 6, 12] be sure to use brackets
cover_these_cells = [];
// example: [5, 8] merges cells 5&6 and 8&9, be sure to use brackets
merge_cells_horizontally_starting_at = [];
// example: [3, 4] merges cell 3 & the cell above and cell 4 & the cell above, be sure to use brackets
merge_cells_vertically_starting_at = [];
// example: [3, 6, 12] be sure to use brackets
add_a_ridge_around_these_cells = [];
height_of_ridge = 2;
thickness_of_ridge = 2;
cell_top_edge_slope = 90; //[30:90]
cell_bottom_edge_slope = 90; //[30:90]
top_padding = 0;
bottom_padding = 0;
left_padding = 0;
right_padding = 0;


/*[Mounting Method]*/
mounting_method = "No Mount"; // [No Mount,Suction Cups,Velcro,Screw-on Straps,Clip-on Straps,Posts,Shelf,Slide-in Tabs,Raised Tabs]


/*[Velcro Info]*/
velcro_size = 1; // [1:10mm -3/8 in- Dots, 2:16mm -5/8 in- Dots, 3:20mm -3/4 in- Dots, 4:3/8 in Squares, 5:5/8 in Squares, 6:3/4 in Squares]


/*[Clip-on Straps Info]*/
clip_locations="horizontal only"; //[horizontal only, vertical only, horizontal and vertical]
horizontal_clip_width=20;
vertical_clip_width=20;
distance_between_horizontal_clips=60;
distance_between_vertical_clips=40;
case_width = 275;
case_height = 220;
case_thickness = 15;
clip_bottom_length = 35;
case_to_screen_depth = 5;
unequal_left_side_of_case = 0;
unequal_bottom_side_of_case = 0;


/*[Posts Info]*/
post_diameter = 4;
post_length = 5;
mount_to_top_of_opening_distance = 5;
notch_in_post = "yes"; // [yes,no]
add_mini_tabs = "no"; // [yes,no]
mini_tab_width = 10;
mini_tab_length = 2;
mini_tab_inset_distance = 20;
mini_tab_height = 1;


/*[Shelf Info]*/
shelf_thickness = 2;
shelf_depth = 3;


/*[Slide-in Tabs Info]*/
slide_in_tab_locations="horizontal only"; //[horizontal only, vertical only, horizontal and vertical]
preferred_slide_in_tab_thickness = 2;
horizontal_slide_in_tab_length = 4;
vertical_slide_in_tab_length = 4;
horizontal_slide_in_tab_width=20;
vertical_slide_in_tab_width=20;
distance_between_horizontal_slide_in_tabs=60;
distance_between_vertical_slide_in_tabs=60;


/*[Raised Tabs Info]*/
raised_tab_height=6;
raised_tab_length=8;
raised_tab_width=20;
preferred_raised_tab_thickness=2; // [2:4]
starting_height = 0;
ramp_angle = 30; // [0:60]
distance_between_raised_tabs=60;
embed_magnets = "no"; // [yes, no]
use_velcro_dots = "no"; // [yes, no]
magnet_size = "20 x 8 x 1.5"; // [20 x 8 x 1.5, 40 x 10 x 2]


/*[Keyguard Frame Info]*/
have_a_keyguard_frame = "no"; //[yes,no]
keyguard_frame_thickness = 5;
keyguard_height = 160;
keyguard_width = 210;
keyguard_corner_radius = 2;
mount_keyguard_with = "snap-in tabs"; //[snap-in tabs, posts]
snap_in_tab_on_top_edge_of_keyguard = "yes"; // [yes,no]
snap_in_tab_on_bottom_edge_of_keyguard = "yes"; // [yes,no]
//the larger the number the tighter the fit
post_tightness_of_fit = 0; //[-10:10]


/*[Engraved/Embossed Text]*/
text = "";
//measured in millimeters
text_height = 5; //[3:20]
font_style = "normal"; //[normal,bold,italic,bold italic]
keyguard_location = "top surface"; //[top surface,bottom surface]
show_back_of_keyguard = "no"; // [yes,no]
keyguard_region = "screen region"; //[screen region,case region]
//positive numbers for embossed text, only on top surface
text_depth = -2; //[-10:10]
text_horizontal_alignment = "center"; //[left,center,right]
text_vertical_alignment = "center"; //[bottom,baseline,center,top]
text_angle = "horizontal"; // [vertical downward,horizontal,vertical upward,horizontal inverted]
//% of screen or case opening width
slide_horizontally = 0; //[0:100]
//% of screen or case opening height
slide_vertically = 0; //[0:100]


/*[Cell Inserts]*/
Braille_location = "above opening"; //[above opening, below opening, above and below opening, left of opening, right of opening, left and right of opening]
//separate Braille elements with a comma and no space
Braille_text = "";
// 10 = standard size Braille
Braille_size_multiplier = 10; //[1:30]
add_circular_opening = "yes"; //[yes,no]
diameter_of_opening = 10;
Braille_to_opening_distance = 5;
engraved_text = "";
//the larger the number the tighter the fit
insert_tightness_of_fit = 0; //[-10:10]
insert_recess = 0; // [0:3]


/*[Free-form and Hybrid Keyguard Openings]*/
//px = pixels, mm = millimeters
unit_of_measure_for_screen = "px"; //[px,mm]
//which corner is (0,0)?
starting_corner_for_screen_measurements = "upper-left"; //[upper-left, lower-left]


/*[Special Actions and Settings]*/
include_screenshot = "no"; //[yes,no]
keyguard_display_angle = 0; // [0,30,45,60,75,90]
//the larger the number the tighter the fit
keyguard_vertical_tightness_of_fit = 0; // [-20:20]
//the larger the number the tighter the fit
keyguard_horizontal_tightness_of_fit = 0; // [-20:20]
split_line_location = 0;
split_line_type = "flat"; //[flat,dovetails]
approx_dovetail_width = 4; //[3:10]
//smaller numbers are looser, larger numbers are tighter (affects first half of keyguard only)
tightness_of_dovetail_joint = 5; //[0:10]
unequal_left_side_of_case_opening = 0;
unequal_bottom_side_of_case_opening = 0;
//see instructions in Console pane
move_screenshot_horizontally = 0; // [-50:50]
//see instructions in Console pane
move_screenshot_vertically = 0; // [-50:50]
//not for use with laser-cut keyguards
keyguard_edge_chamfer = 0.7;
//not for use with laser-cut keyguards
cell_edge_chamfer = 0.7;
trim_to_screen = "no"; //[yes,no]
cut_out_screen = "no"; //[yes,no]
//assuming 0.2 mm layers for a total of 0.4 mm
first_two_layers_only = "no"; //[yes,no]
//specify the lower left coordinate (example: [10,50])
trim_to_rectangle_lower_left = [];
//specify the upper right coordinate (example: [80,125])
trim_to_rectangle_upper_right = [];
smoothness_of_circles_and_arcs = 40; //[5:360]
use_Laser_Cutting_best_practices = "yes"; // [yes,no]
//18 entries e.g., [190,140,10,150,100,20,20,20,20,5,5,5,2,10,4,4,4,10];
other_tablet_general_sizes = [];
//3 entries e.g., [1000,1500,0.100]
other_tablet_pixel_sizes = [];
//don't change this temporary setting
horizontal_rail_width = 5;
//don't change this temporary setting
vertical_rail_width = 5;
//don't change this temporary setting
preferred_rail_height = 4;
//don't change this temporary setting
rail_slope = 90; //[30:90]
//don't change this temporary setting
split_line = 0;


/*[Hidden]*/

keyguard_designer_version = 67; //************************************************************************************************


// the "true" outcome of the following line of code is for controling keyguard frame mounting options
// orientation = (generate=="keyguard frame") ? "landscape" : orientation;

fudge = 0.001;
camera_cut_angle = 50;

//laser-cut variables
acrylic_thickness = 3.175;
acrylic_slide_in_tab_thickness = (use_Laser_Cutting_best_practices=="yes") ?  1 : preferred_slide_in_tab_thickness;
horizontal_acrylic_slide_in_tab_length = (use_Laser_Cutting_best_practices=="yes") ?  acrylic_thickness : horizontal_slide_in_tab_length;
vertical_acrylic_slide_in_tab_length = (use_Laser_Cutting_best_practices=="yes") ?  acrylic_thickness : vertical_slide_in_tab_length;
acrylic_case_corner_radius = (use_Laser_Cutting_best_practices=="yes") ?  2 : case_opening_corner_radius;
sat_incl_acrylic = (type_of_keyguard=="Laser-Cut") ? acrylic_thickness : screen_area_thickness;
camera_offset_acrylic = (type_of_keyguard=="Laser-Cut") ? sat_incl_acrylic/tan(camera_cut_angle) : 0;


rs_inc_acrylic = (type_of_keyguard=="3D-Printed") ? cell_edge_slope : 90;
sat_slope_adjust = screen_area_thickness/tan(rs_inc_acrylic);

bar_edge_slope_inc_acrylic = (type_of_keyguard=="3D-Printed") ? bar_edge_slope : 90;
m_m = (type_of_keyguard=="3D-Printed")  ? mounting_method :
	(type_of_keyguard=="Laser-Cut" && mounting_method=="Slide-in Tabs") ? "Slide-in Tabs" :
	"No Mount";
hbes = (type_of_keyguard=="3D-Printed") ? home_button_edge_slope : 90;



//Tablet Parameters -- 0:Tablet Width, 1:Tablet Height, 2:Tablet Thickness, 3:Screen Width, 4:Screen Height, 
//                     5:Right Border Width, 6:Left Border Width, 7:Bottom Border Height, 8:Top Border Height, 
//                     9:Distance from edge of screen to Home Button, 10:Home Button Height, 11:Home Button Width, 12:Home Button Location,
//                     13:Distance from edge of screen to Camera, 14:Camera Height, 15:Camera Width, 16:Camera Location,
//                     17:Conversion Factors (# vertical pixels, # horizontal pixels, pixel size (mm)), 18:Tablet Corner Radius
iPad_data=[242.900,189.7,13.4,197.042,147.782,22.929,22.929,20.959,20.959,11.329,11.200,11.200,2,12.529,4.5,4.5,4,[768,1024,0.1924],10];
iPad2_data=[241.300,185.8,8.8,197.042,147.782,22.129,22.129,19.009,19.009,11.329,11.300,11.300,2,11.029,4.5,4.5,4,[768,1024,0.1924],10];
iPad3rdgeneration_data=[241.300,185.8,9.41,197.042,147.782,22.129,22.129,19.009,19.009,11.329,11.300,11.300,2,11.029,4.5,4.5,4,[1536,2048,0.0962],10];
iPad4thgeneration_data=[241.300,185.8,9.4,197.042,147.782,22.129,22.129,19.009,19.009,11.329,11.300,11.300,2,11.029,4.5,4.5,4,[1536,2048,0.0962],10];
iPad5thgeneration_data=[240.000,169.47,6.1,197.042,147.782,21.479,21.479,10.844,10.844,11.379,14.600,14.600,2,10.409,12.5,4.5,4,[1536,2048,0.0962],10];
iPad6thgeneration_data=[240.000,169.47,6.1,197.042,147.782,21.479,21.479,10.844,10.844,11.379,14.600,14.600,2,10.409,12.5,4.5,4,[1536,2048,0.0962],10];
iPad7thgeneration_data=[250.590,174.08,7.5,207.792,155.844,21.386,21.386,9.108,9.108,11.326,12.600,12.600,2,10.316,12.5,4.5,4,[1620,2160,0.0962],10];
iPad8thgeneration_data=[250.590,174.08,7.5,207.792,155.844,21.386,21.386,9.108,9.108,11.326,12.600,12.600,2,10.316,12.5,4.5,4,[1620,2160,0.0962],10];
iPad9thgeneration_data=[250.590,174.08,7.5,207.792,155.844,21.386,21.386,9.108,9.108,11.326,12.600,12.600,2,10.316,12.5,4.5,4,[1620,2160,0.0962],10];
iPad10thgeneration_data=[248.63,179.51,7.03,227.061,157.788,10.784,10.784,10.861,10.861,0,0,0,0,5.621,5.621,30,1,[1640,2360,0.0962],10];
iPadPro97inch_data=[240.000,169.47,6.1,197.042,147.782,21.479,21.479,10.844,10.844,11.379,14.600,14.600,2,10.379,4.5,4.5,4,[1536,2048,0.0962],10];
iPadPro105inch_data=[250.590,174.08,6.1,213.976,160.482,18.307,18.307,6.799,6.799,9.347,14.600,14.600,2,9.107,4.5,4.5,4,[1668,2224,0.0962],10];
iPadPro11inch1stGeneration_data=[247.640,178.52,5.953,229.755,160.482,8.943,8.943,9.019,9.019,0,0.000,0.000,2,4.573,4.5,34.5,4,[1668,2388,0.0962],10];
iPadPro11inch2ndGeneration_data=[247.640,178.52,5.953,229.755,160.482,8.943,8.943,9.019,9.019,0,0.000,0.000,2,4.573,4.5,4.5,4,[1668,2388,0.0962],10];
iPadPro11inch3rdGeneration_data=[247.640,178.52,5.953,229.755,160.482,8.943,8.943,9.019,9.019,0,0.000,0.000,2,4.573,4.5,4.5,4,[1668,2388,0.0962],10];
iPadPro11inch4thGeneration_data=[247.640,178.52,5.953,229.755,160.482,8.943,8.943,9.019,9.019,0,0.000,0.000,2,4.573,4.5,4.5,4,[1668,2388,0.0962],10];
iPadPro11inch_M4_data=[249.70,177.51,5.3,232.8333,160.4818,8.4333,8.4333,8.5141,8.5141,0,0.000,0.000,2,3.8041,3.5,42.5,1,[1668,2420,0.0962],10];
iPadPro129inch1stGeneration_data=[305.690,220.58,6.9,262.852,197.042,21.419,21.419,11.769,11.769,11.319,14.600,14.600,2,10.319,4.5,4.5,4,[2048,2732,0.0962],10];
iPadPro129inch2ndGeneration_data=[305.690,220.58,6.9,262.852,197.042,21.419,21.419,11.769,11.769,11.319,14.600,14.600,2,10.219,4.5,4.5,4,[2048,2732,0.0962],10];
iPadPro129inch3rdGeneration_data=[280.660,214.99,5.908,262.852,197.042,9.2,9.2,9.18,9.18,0,0,0,0,4.534,33,4.5,4,[2048,2732,0.0962],10];
iPadPro129inch4thGeneration_data=[280.660,214.99,5.908,262.852,197.042,9.2,9.2,9.18,9.18,0,0,0,0,4.534,33,4.5,4,[2048,2732,0.0962],10];
iPadPro129inch5thGeneration_data=[280.660,214.99,6.440,262.852,197.042,9.2,9.2,9.18,9.18,0,0,0,0,4.534,33,4.5,4,[2048,2732,0.0962],10];
iPadPro129inch6thGeneration_data=[280.660,214.99,6.440,262.852,197.042,9.2,9.2,9.18,9.18,0,0,0,0,4.534,33,4.5,4,[2048,2732,0.0962],10];
iPadPro13inch_M4_data=[281.58,215.53,5.3,264.7758,198.5818,8.4021,8.4021,8.4741,8.4741,0,0,0,0,3.7641,3.5,42,1,[2064,2752,0.0962],10];
iPadmini_data=[200.100,134.7,7.2,159.568,119.676,20.266,20.266,7.512,7.512,11,10.000,10.000,2,10,12.5,4.5,4,[768,1024,0.1558],10];
iPadmini2_data=[200.100,134.7,7.5,159.568,119.676,20.266,20.266,7.512,7.512,11,10.000,10.000,2,10,4.5,4.5,4,[1536,2048,0.0779],10];
iPadmini3_data=[200.100,134.7,7.5,159.568,119.676,20.266,20.266,7.512,7.512,11,10.000,10.000,2,10,4.5,4.5,4,[1536,2048,0.0779],10];
iPadmini4_data=[203.160,134.75,6.1,159.568,119.676,21.796,21.796,7.537,7.537,12.286,10.600,10.600,2,11.296,4.5,4.5,4,[1536,2048,0.0779],10];
iPadmini5_data=[203.160,134.75,6.1,159.568,119.676,21.796,21.796,7.537,7.537,12.286,10.600,10.600,2,10.596,4.5,4.5,4,[1536,2048,0.0779],10];
iPadmini6_data=[195.43, 134.75, 6.32, 176.5534, 115.9362, 9.438313, 9.438313, 9.406902, 9.406902, 0, 0, 0, 0, 5.058313, 6, 6, 4, [1488, 2266, 0.0779], 12];
iPadmini7_A17Pro_data=[195.43, 134.75, 6.32, 176.5534, 115.9362, 9.438313, 9.438313, 9.406902, 9.406902, 0, 0, 0, 0, 5.058313, 6, 6, 4, [1488, 2266, 0.0779], 13.15];
iPadAir_data=[240.000,169.5,7.5,197.042,147.782,21.479,21.479,10.859,10.859,11.379,10.700,10.700,2,10.379,4.5,4.5,4,[1536,2048,0.0962],10];
iPadAir2_data=[240.000,169.47,6.1,197.042,147.782,21.479,21.479,10.844,10.844,11.379,14.600,14.600,2,10.409,4,4,4,[1536,2048,0.0962],10];
iPadAir3_data=[250.590,174.08,6.1,213.976,160.482,18.307,18.307,6.799,6.799,9.347,14.600,14.600,2,8.687,4,4,4,[1668,2224,0.0962],10];
iPadAir4_data=[247.64,178.51,6.123,227.061,157.788,10.2697,10.2697,10.3561,10.3561,0,0,0,0,5.03,4.5,4.5,4,[1640,2360,0.0962],12];
iPadAir5_data=[247.64,178.51,6.123,227.061,157.788,10.2697,10.2697,10.3561,10.3561,0,0,0,0,5.03,4.5,4.5,4,[1640,2360,0.0962],12];
iPadAir11inch_M2_data=[247.64,178.52,6.123,227.0606,157.7879,10.2897,10.2897,10.3661,10.3661,0,0,0,0,5.8761,4.5,34,1,[1640,2360,0.0962],12];
iPadAir13inch_M2_data=[280.66,215.00,6.1,262.8515,197.0424,8.9042,8.9042,8.9788,8.9788,0,0,0,0,4.7588,3.5,35,1,[2048,2732,0.0962],12];
novachat_5_data=[156.200,76.2,5,121.616,68.409,17.292,17.292,3.896,3.896,0,0.000,0.000,0,0,0.000,0.000,0,[1080,1920,0.0633],5];
novachat_5_3_data=[0,0,0,112,66,0,0,0,0,0,0,0,0,0,0,0,0,[1440,2560,0.04748],0];
novachat_5_4_data=[0,0,0,112,66,0,0,0,0,0,0,0,0,0,0,0,0,[1080,1920,0.06334],0];
novachat_8_data=[198.600,134.8,5.6,162.56,121.92,18.02,18.02,6.44,6.44,8.2,16,6.5,2,11,4,4,0,[1536,2048,0.0794],5];
novachat_8_5_data=[0,0,0,172.325,107.703,0,0,0,0,0,0,0,0,0,0,0,0,[1200,1920,0.0898],0];
novachat10_data=[237.300,169,6,197.042,147.782,20.129,20.129,10.609,10.609,0,0.000,0.000,0,0,0.000,0.000,0,[1536,2048,0.0962],5];
novachat12_data=[295.600,204,8,263.255,164.534,16.172,16.172,19.733,19.733,0,0.000,0.000,0,0,0.000,0.000,0,[1600,2560,0.1028],5];
chatfusion10_data=[0,0,0,211.14,141.20,0,0,0,0,0,0.000,0.000,0,0,0.000,0.000,0,[1200,1920,0.1138],0];
surface_2_data=[275.000,173,8.9,234.462,131.885,20.269,20.269,20.558,20.558,0,0.000,0.000,0,6.24,5.000,50.000,1,[1080,1920,0.1221],5];
surface_3_data=[267.000,187,8.6,227.888,151.925,19.556,19.556,17.537,17.537,0,0.000,0.000,6.24,0,5.000,50.000,1,[1280,1920,0.1187],5];
surface_pro_3_data=[290.000,201,9.1,254,169.333,18,18,15.833,15.833,0,0.000,0.000,0,6.24,5.000,50.000,1,[1440,2160,0.1176],5];
surface_pro_4_data=[292.100,201.42,8.45,260.279,173.519,15.911,15.911,13.95,13.95,0,0.000,0.000,0,6.24,5.000,50.000,1,[1824,2736,0.0951],5];
surface_pro_5_data=[292.000,201,8.5,260.279,173.519,15.861,15.861,13.74,13.74,0,0.000,0.000,0,6.24,5.000,50.000,1,[1824,2736,0.0951],5];
surface_pro_6_data=[292.000,201,8.5,260.279,173.519,15.861,15.861,13.74,13.74,0,0.000,0.000,0,6.24,5.000,50.000,1,[1824,2736,0.0951],5];
surface_pro_7_data=[292.000,201,8.5,260.279,173.519,15.861,15.861,13.74,13.74,0,0.000,0.000,0,6.24,5.000,50.000,1,[1824,2736,0.0951],5];
surface_pro_8_data=[287,208,9.3,273.888,182.592,6.556,6.556,12.704,12.704,0,0.000,0.000,0,6.24,5.000,50.000,1,[1920,2880,0.0951],5];
surface_pro_9_data=[287,209,9.3,273.888,182.592,6.556,6.556,13.204,13.204,0,0.000,0.000,0,6.24,5.000,50.000,1,[1920,2880,0.0951],5];
surface_pro_x_data=[287,208,7.3,273.888,182.592,6.556,6.556,12.704,12.704,0,0.000,0.000,0,6.24,5.000,50.000,1,[1920,2880,0.0951],5];
surface_go_data=[245,175,8.3,210.691,140.461,17.154,17.154,17.27,17.27,0,0.000,0.000,0,0,0.000,0.000,0,[1200,1800,0.1171],5];
surface_go_3_data=[245,175,8.3,221.673,147.840,11.6635,11.6635,13.58,13.58,0,0.000,0.000,0,0,0.000,0.000,0,[1280,1920,0.1155],5];
accent_800_data=[0,0,0,172,108,0,0,0,0,8,10,10,3,9,4,4,1,[1200,1920,0.0905],0];
accent_1000_20_data=[0,0,0,216.80,135.50,0,0,0,0,10,10,10,3,11,6,6,1,[800,1280,0.16934],0];
accent_1000_30_data=[0,0,0,216.80,135.50,0,0,0,0,10,10,10,3,10,4,4,1,[1200,1920,0.1129],0];
accent_1000_40_data=[0,0,0,216.80,135.50,0,0,0,0,10,10,10,3,10,4,4,1,[1200,1920,0.1129],0];
accent_1400_20_data=[0,0,0,308.66,173.62,0,0,0,0,0,0.000,0.000,0,0,0.000,0.000,0,[1080,1920,0.1608],0];
accent_1400_30a_data=[0,0,0,310.6737,174.7539,0,0,0,0,0,0.000,0.000,0,0,0.000,0.000,0,[1440,2560,0.1214],0];
accent_1400_30b_data=[0,0,0,298.368,168,0,0,0,0,0,0.000,0.000,0,0,0.000,0.000,0,[2160,3840,0.0777],0];
amazon_fire_hd_7_data=[192,115,9.6,152.10,89.12,19.949,19.949,12.939,12.939,0,0.000,0.000,0,7,4.5,4.5,1,[600,1024,0.1485],10];
amazon_fire_hd_8_data=[202,137,9.7,172.02,107.51,14.989,14.989,14.743,14.743,0,0.000,0.000,0,7,4.5,4.5,1,[800,1280,0.1344],10];
amazon_fire_hd_8_plus_data=[202,137,9.7,172.02,107.51,14.989,14.989,14.743,14.743,0,0.000,0.000,0,7,4.5,4.5,1,[800,1280,0.1344],10];
amazon_fire_hd_10_data=[262,157,9.8,217.73,136.08,22.135,22.135,10.46,10.46,0,0.000,0.000,0,7,4.5,4.5,1,[1200,1920,0.1134],10];
amazon_fire_hd_10_plus_data=[247,166,9.2,217.73,136.08,14.635,14.635,14.96,14.96,0,0.000,0.000,0,7,4.5,4.5,1,[1200,1920,0.1134],10];
amazon_fire_max_11_data=[259.1,163.7,7.5, 238.50, 143.10, 10.30,10.30,10.30,10.30,0,0.000,0.000,0,7,4.5,4.5,1,[1200,2000,0.1192],10];
dynavox_i_12_plus_data=[288,222.5,23,246.33,184.75,21,21,13,24,0,0.000,0.000,0,14.5,5,5,1,[768,1024,0.2406],10];
dynavox_indi_data=[239,165,20,216.5,135.5,11.6,11.6,14,16,7,8,8,3,10,3.5,3.5,1,[1200,1920,0.1128],10];
tobii_i_110_data=[0, 0, 0, 216.5, 135.5, 0, 0, 0, 0, 12, 10, 10, 3, 16, 12, 40, 1, [1200, 1920, 0.1128], 0];
gridpad_11_data=[0,0,0,257.11,144.63,0,0,0,0,0,0.000,0.000,0,0,0.000,0.000,0,[1080,1920,0.1339],5];
gridpad_12_data=[294.800,192.4,11.9,257.11,144.63,18.952,18.952,23.948,23.948,0,0.000,0.000,0,0,0.000,0.000,0,[1080,1920,0.1339],5];
gridpad_13_data	= [0,0,0,295,165.94,0,0,0,0,0,0,0,0,11.5,6,6,1,[1080,1920,0.1536],0];
SamsungGalaxyTabA84_data=[202,125.2,7.1,180.622,112.889,10.689,10.689,6.156,6.156,0,0,0,0,0,0,0,0,[1200,1920,0.094074074],10];
SamsungGalaxyTabA7104_data=[247.6,157.4,7,226.786,136.071,10.407,10.407,10.664,10.664,0,0,0,0,0,0,0,0,[1200,2000,0.113392857],10];
SamsungGalaxyTabA7Lite_data=[212.5,124.7,8,190.145,113.520,11.177,11.177,5.590,5.590,0,0,0,0,0,0,0,0,[800,1340,0.141899441],10];
SamsungGalaxyTabA8_data=[246.8,161.9,6.9,225.778,141.111,10.511,10.511,10.394,10.394,0,0,0,0,0,0,0,0,[1200,1920,0.117592593],10];
SamsungGalaxyTabA9_data=[211,124.7,8,190.145,113.520,10.427,10.427,5.590,5.590,0,0,0,0,0,0,0,0,[800,1340,0.141899441],10];
SamsungGalaxyTabA9Plus_data=[257.1,168.7,6.9,236.738,147.961,10.181,10.181,10.369,10.369,0,0,0,0,0,0,0,0,[1200,1920,0.123300971],10];
SamsungGalaxyTabActive5_data=[213.8,126.8,10.1,172.325,107.703,20.737,20.737,9.548,9.548,0,0,0,0,0,0,0,0,[1200,1920,0.08975265],10];
SamsungGalaxyTabActive3_data=[213.8,126.8,9.9,172.325,107.703,20.737,20.737,9.548,9.548,0,0,0,0,0,0,0,0,[1200,1920,0.08975265],10];
SamsungGalaxyTabActive4Pro_data=[242.9,170.2,10.2,217.714,136.071,12.593,12.593,17.064,17.064,0,0,0,0,0,0,0,0,[1200,1920,0.113392857],10];
SamsungGalaxyTabS6_data=[244.5,159.5,5.7,226.564,141.603,8.968,8.968,8.949,8.949,0,0,0,0,0,0,0,0,[1600,2560,0.088501742],10];
SamsungGalaxyTabS6Lite_data=[244.5,154.3,7,226.786,136.071,8.857,8.857,9.114,9.114,0,0,0,0,0,0,0,0,[1200,2000,0.113392857],10];
SamsungGalaxyTabS7_data=[253.8,165.3,6.3,237.314,148.321,8.243,8.243,8.489,8.489,0,0,0,0,0,0,0,0,[1600,2560,0.09270073],10];
SamsungGalaxyTabS7FE_data=[284.8,185,6.3,267.588,167.243,8.606,8.606,8.879,8.879,0,0,0,0,0,0,0,0,[1600,2560,0.104526749],10];
SamsungGalaxyTabS7Plus_data=[285,185,5.7,267.368,167.296,8.816,8.816,8.852,8.852,0,0,0,0,0,0,0,0,[1752,2800,0.095488722],10];
SamsungGalaxyTabS8_data=[253.8,165.3,6.3,237.314,148.321,8.243,8.243,8.489,8.489,0,0,0,0,0,0,0,0,[1600,2560,0.09270073],10];
SamsungGalaxyTabS8Ultra_data=[326.4,208.6,5.5,313.267,195.580,6.567,6.567,6.510,6.510,0,0,0,0,0,0,0,0,[1848,2960,0.105833333],10];
SamsungGalaxyTabS8Plus_data=[285,185,5.7,267.368,167.296,8.816,8.816,8.852,8.852,0,0,0,0,0,0,0,0,[1752,2800,0.095488722],10];
SamsungGalaxyTabS9_data=[254.3,165.8,5.9,237.314,148.321,8.493,8.493,8.739,8.739,0,0,0,0,0,0,0,0,[1600,2560,0.09270073],10];
SamsungGalaxyTabS9FE_data=[254.3,165.8,6.5,235.027,146.892,9.637,9.637,9.454,9.454,0,0,0,0,0,0,0,0,[1440,2304,0.102008032],10];
SamsungGalaxyTabS9FEPlus_data=[285.4,185.4,6.5,267.588,167.243,8.906,8.906,9.079,9.079,0,0,0,0,0,0,0,0,[1600,2560,0.104526749],10];
SamsungGalaxyTabS9Ultra_data=[326.4,208.6,5.5,314.577,196.398,5.911,5.911,6.101,6.101,0,0,0,0,0,0,0,0,[1848,2960,0.106276151],10];
SamsungGalaxyTabS9Plus_data=[285.4,185.4,5.7,267.368,167.296,9.016,9.016,9.052,9.052,0,0,0,0,0,0,0,0,[1752,2800,0.095488722],10];
blank_data=[200,60,3,200,60,0,0,0,0,0,0,0,0,0,0,0,0,[60,200,1],0];
catch_all_data=[400,100,20,216.5,135.5,11.6,11.6,14,16,7,8,8,3,10,3.5,3.5,1,[1200,1920,0.1128],10];


tablet_params = 
    (type_of_tablet=="iPad")? iPad_data
  : (type_of_tablet=="iPad2")? iPad2_data
  : (type_of_tablet=="iPad 3rd generation")? iPad3rdgeneration_data
  : (type_of_tablet=="iPad 4th generation")? iPad4thgeneration_data
  : (type_of_tablet=="iPad 5th generation")? iPad5thgeneration_data
  : (type_of_tablet=="iPad 6th generation")? iPad6thgeneration_data
  : (type_of_tablet=="iPad 7th generation")? iPad7thgeneration_data
  : (type_of_tablet=="iPad 8th generation")? iPad8thgeneration_data
  : (type_of_tablet=="iPad 9th generation")? iPad9thgeneration_data
  : (type_of_tablet=="iPad 10th generation")? iPad10thgeneration_data
  : (type_of_tablet=="iPad Pro 9.7-inch")? iPadPro97inch_data
  : (type_of_tablet=="iPad Pro 10.5-inch")? iPadPro105inch_data
  : (type_of_tablet=="iPad Pro 11-inch 1st Generation")? iPadPro11inch1stGeneration_data
  : (type_of_tablet=="iPad Pro 11-inch 2nd Generation")? iPadPro11inch2ndGeneration_data
  : (type_of_tablet=="iPad Pro 11-inch 3rd Generation")? iPadPro11inch3rdGeneration_data
  : (type_of_tablet=="iPad Pro 11-inch 4th Generation")? iPadPro11inch4thGeneration_data
  : (type_of_tablet=="iPad Pro 11-inch M4")? iPadPro11inch_M4_data
  : (type_of_tablet=="iPad Pro 12.9-inch 1st Generation")? iPadPro129inch1stGeneration_data
  : (type_of_tablet=="iPad Pro 12.9-inch 2nd Generation")? iPadPro129inch2ndGeneration_data
  : (type_of_tablet=="iPad Pro 12.9-inch 3rd Generation")? iPadPro129inch3rdGeneration_data
  : (type_of_tablet=="iPad Pro 12.9-inch 4th Generation")? iPadPro129inch4thGeneration_data
  : (type_of_tablet=="iPad Pro 12.9-inch 5th Generation")? iPadPro129inch5thGeneration_data
  : (type_of_tablet=="iPad Pro 12.9-inch 6th Generation")? iPadPro129inch6thGeneration_data
  : (type_of_tablet=="iPad Pro 13-inch M4")? iPadPro13inch_M4_data
  : (type_of_tablet=="iPad mini")? iPadmini_data
  : (type_of_tablet=="iPad mini 2")? iPadmini2_data
  : (type_of_tablet=="iPad mini 3")? iPadmini3_data
  : (type_of_tablet=="iPad mini 4")? iPadmini4_data
  : (type_of_tablet=="iPad mini 5")? iPadmini5_data
  : (type_of_tablet=="iPad mini 6")? iPadmini6_data
  : (type_of_tablet=="iPad mini 7 A17 Pro")? iPadmini7_A17Pro_data
  : (type_of_tablet=="iPad Air")? iPadAir_data
  : (type_of_tablet=="iPad Air 2")? iPadAir2_data
  : (type_of_tablet=="iPad Air 3")? iPadAir3_data
  : (type_of_tablet=="iPad Air 4")? iPadAir4_data
  : (type_of_tablet=="iPad Air 5")? iPadAir5_data
  : (type_of_tablet=="iPad Air 11-inch M2")? iPadAir11inch_M2_data
  : (type_of_tablet=="iPad Air 13-inch M2")? iPadAir13inch_M2_data
  : (type_of_tablet=="NovaChat 5")? novachat_5_data
  : (type_of_tablet=="NovaChat 5.3")? novachat_5_3_data
  : (type_of_tablet=="NovaChat 5.4")? novachat_5_4_data
  : (type_of_tablet=="NovaChat 8")? novachat_8_data
  : (type_of_tablet=="NovaChat 8.5")? novachat_8_5_data
  : (type_of_tablet=="NovaChat 10")? novachat10_data
  : (type_of_tablet=="NovaChat 12")? novachat12_data
  : (type_of_tablet=="Chat Fusion 10")? chatfusion10_data
  : (type_of_tablet=="Surface 2")? surface_2_data
  : (type_of_tablet=="Surface 3")? surface_3_data
  : (type_of_tablet=="Surface Pro 3")? surface_pro_3_data
  : (type_of_tablet=="Surface Pro 4")? surface_pro_4_data
  : (type_of_tablet=="Surface Pro 5")? surface_pro_5_data
  : (type_of_tablet=="Surface Pro 6")? surface_pro_6_data
  : (type_of_tablet=="Surface Pro 7")? surface_pro_7_data
  : (type_of_tablet=="Surface Pro 8")? surface_pro_8_data
  : (type_of_tablet=="Surface Pro 9")? surface_pro_9_data
  : (type_of_tablet=="Surface Pro X")? surface_pro_x_data
  : (type_of_tablet=="Surface Go")? surface_go_data
  : (type_of_tablet=="Surface Go 3")? surface_go_3_data
  : (type_of_tablet=="Accent 800")? accent_800_data
  : (type_of_tablet=="Accent 1000-20")? accent_1000_20_data
  : (type_of_tablet=="Accent 1000-30")? accent_1000_30_data
  : (type_of_tablet=="Accent 1000-40")? accent_1000_40_data
  : (type_of_tablet=="Accent 1400-20")? accent_1400_20_data
  : (type_of_tablet=="Accent 1400-30a")? accent_1400_30a_data
  : (type_of_tablet=="Accent 1400-30b")? accent_1400_30b_data
  : (type_of_tablet=="Amazon Fire HD 7")? amazon_fire_hd_7_data
  : (type_of_tablet=="Amazon Fire HD 8")? amazon_fire_hd_8_data
  : (type_of_tablet=="Amazon Fire HD 8 Plus")? amazon_fire_hd_8_plus_data
  : (type_of_tablet=="Amazon Fire HD 10")? amazon_fire_hd_10_data
  : (type_of_tablet=="Amazon Fire HD 10 Plus")? amazon_fire_hd_10_plus_data
  : (type_of_tablet=="Amazon Fire Max 11")? amazon_fire_max_11_data
  : (type_of_tablet=="Dynavox I-12+")? dynavox_i_12_plus_data
  : (type_of_tablet=="TobiiDynavox I-110")? tobii_i_110_data
  : (type_of_tablet=="Dynavox Indi")? dynavox_indi_data
  : (type_of_tablet=="GridPad 11") ? gridpad_11_data
  : (type_of_tablet=="GridPad 12") ? gridpad_12_data
  : (type_of_tablet=="GridPad 13") ? gridpad_13_data
  : (type_of_tablet=="Samsung Galaxy Tab A 8.4")? SamsungGalaxyTabA84_data
  : (type_of_tablet=="Samsung Galaxy Tab A7 10.4")? SamsungGalaxyTabA7104_data
  : (type_of_tablet=="Samsung Galaxy Tab A7 Lite")? SamsungGalaxyTabA7Lite_data
  : (type_of_tablet=="Samsung Galaxy Tab A8")? SamsungGalaxyTabA8_data
  : (type_of_tablet=="Samsung Galaxy Tab A9")? SamsungGalaxyTabA9_data
  : (type_of_tablet=="Samsung Galaxy Tab A9+")? SamsungGalaxyTabA9Plus_data
  : (type_of_tablet=="Samsung Galaxy Tab Active 5")? SamsungGalaxyTabActive5_data
  : (type_of_tablet=="Samsung Galaxy Tab Active3")? SamsungGalaxyTabActive3_data
  : (type_of_tablet=="Samsung Galaxy Tab Active4 Pro")? SamsungGalaxyTabActive4Pro_data
  : (type_of_tablet=="Samsung Galaxy Tab S6")? SamsungGalaxyTabS6_data
  : (type_of_tablet=="Samsung Galaxy Tab S6 Lite")? SamsungGalaxyTabS6Lite_data
  : (type_of_tablet=="Samsung Galaxy Tab S7")? SamsungGalaxyTabS7_data
  : (type_of_tablet=="Samsung Galaxy Tab S7 FE")? SamsungGalaxyTabS7FE_data
  : (type_of_tablet=="Samsung Galaxy Tab S7+")? SamsungGalaxyTabS7Plus_data
  : (type_of_tablet=="Samsung Galaxy Tab S8")? SamsungGalaxyTabS8_data
  : (type_of_tablet=="Samsung Galaxy Tab S8 Ultra")? SamsungGalaxyTabS8Ultra_data
  : (type_of_tablet=="Samsung Galaxy Tab S8+")? SamsungGalaxyTabS8Plus_data
  : (type_of_tablet=="Samsung Galaxy Tab S9")? SamsungGalaxyTabS9_data
  : (type_of_tablet=="Samsung Galaxy Tab S9 FE")? SamsungGalaxyTabS9FE_data
  : (type_of_tablet=="Samsung Galaxy Tab S9 FE+")? SamsungGalaxyTabS9FEPlus_data
  : (type_of_tablet=="Samsung Galaxy Tab S9 Ultra")? SamsungGalaxyTabS9Ultra_data
  : (type_of_tablet=="Samsung Galaxy Tab S9+")? SamsungGalaxyTabS9Plus_data  : (type_of_tablet=="blank") ? blank_data
  : catch_all_data;
  
  
// Tablet variables
ot_test = (len(other_tablet_general_sizes)==18) && (len(other_tablet_pixel_sizes)==3);

st_tablet_width = (orientation=="landscape") ? tablet_params[0] : tablet_params[1];
ot_tablet_width = (orientation=="landscape") ? other_tablet_general_sizes[0] : other_tablet_general_sizes[1];
tablet_width = (type_of_tablet=="other tablet" && ot_test) ? ot_tablet_width : st_tablet_width;
tablet_width_l = (type_of_tablet=="other tablet" && ot_test) ? other_tablet_general_sizes[0] : tablet_params[0]; //in landscape mode

st_tablet_height = (orientation=="landscape") ? tablet_params[1] : tablet_params[0];
ot_tablet_height = (orientation=="landscape") ? other_tablet_general_sizes[1] : other_tablet_general_sizes[0];
tablet_height = (type_of_tablet=="other tablet" && ot_test) ? ot_tablet_height : st_tablet_height;
tablet_height_l = (type_of_tablet=="other tablet" && ot_test) ? other_tablet_general_sizes[1] : tablet_params[1]; //in landscape mode

st_tablet_corner_radius = tablet_params[18];
ot_tablet_corner_radius = other_tablet_general_sizes[18];
tablet_corner_radius = (type_of_tablet=="other tablet" && ot_test) ? ot_tablet_corner_radius : st_tablet_corner_radius;

st_tablet_thickness = tablet_params[2];
ot_tablet_thickness = other_tablet_general_sizes[2];
tablet_thickness = (type_of_tablet=="other tablet" && ot_test) ? ot_tablet_thickness : st_tablet_thickness;

st_right_border_width = (orientation=="landscape") ? tablet_params[5] : tablet_params[8];
ot_right_border_width = (orientation=="landscape") ? other_tablet_general_sizes[5] : other_tablet_general_sizes[8];
right_border_width = (type_of_tablet=="other tablet" && ot_test) ? ot_right_border_width : st_right_border_width;

st_left_border_width = (orientation=="landscape") ? tablet_params[6] : tablet_params[7];
ot_left_border_width = (orientation=="landscape") ? other_tablet_general_sizes[6] : other_tablet_general_sizes[7];
left_border_width = (type_of_tablet=="other tablet" && ot_test) ? ot_left_border_width : st_left_border_width;

st_top_border_height = (orientation=="landscape") ? tablet_params[8] : tablet_params[6];
ot_top_border_height = (orientation=="landscape") ? other_tablet_general_sizes[8] : other_tablet_general_sizes[6];
top_border_height = (type_of_tablet=="other tablet" && ot_test) ? ot_top_border_height : st_top_border_height;

st_bottom_border_height = (orientation=="landscape") ? tablet_params[7] : tablet_params[5];
ot_bottom_border_height = (orientation=="landscape") ? other_tablet_general_sizes[7] : other_tablet_general_sizes[5];
bottom_border_height = (type_of_tablet=="other tablet" && ot_test) ? ot_bottom_border_height : st_bottom_border_height;

st_distance_from_screen_to_home_button = tablet_params[9];
ot_distance_from_screen_to_home_button = other_tablet_general_sizes[9];
distance_from_screen_to_home_button = (type_of_tablet=="other tablet" && ot_test) ? ot_distance_from_screen_to_home_button : st_distance_from_screen_to_home_button;

st_home_button_height = (orientation=="landscape") ? tablet_params[10] : tablet_params[11];
ot_home_button_height = (orientation=="landscape") ? other_tablet_general_sizes[10] : other_tablet_general_sizes[11];
home_button_height = (type_of_tablet=="other tablet" && ot_test) ? ot_home_button_height : st_home_button_height;

st_home_button_width = (orientation=="landscape") ? tablet_params[11] : tablet_params[10];
ot_home_button_width = (orientation=="landscape") ? other_tablet_general_sizes[11] : other_tablet_general_sizes[10];
home_button_width = (type_of_tablet=="other tablet" && ot_test) ? ot_home_button_width : st_home_button_width;

st_hb_loc = tablet_params[12];
ot_hb_loc = other_tablet_general_sizes[12];
st_home_loc = (orientation=="landscape") ? st_hb_loc : search(st_hb_loc,[0,4,1,2,3])[0];
ot_home_loc = (orientation=="landscape") ? ot_hb_loc : search(ot_hb_loc,[0,4,1,2,3])[0];
home_loc = (type_of_tablet=="other tablet" && ot_test) ? ot_home_loc : st_home_loc;

st_distance_from_screen_to_camera = tablet_params[13];
ot_distance_from_screen_to_camera = other_tablet_general_sizes[13];
distance_from_screen_to_camera = (type_of_tablet=="other tablet" && ot_test) ? ot_distance_from_screen_to_camera : st_distance_from_screen_to_camera;

st_camera_height = (orientation=="landscape") ? tablet_params[14] : tablet_params[15];
ot_camera_height = (orientation=="landscape") ? other_tablet_general_sizes[14] : other_tablet_general_sizes[15];
camera_height = (type_of_tablet=="other tablet" && ot_test) ? ot_camera_height : st_camera_height;

st_camera_width = (orientation=="landscape") ? tablet_params[15] : tablet_params[14];
ot_camera_width = (orientation=="landscape") ? other_tablet_general_sizes[15] : other_tablet_general_sizes[14];
camera_width = (type_of_tablet=="other tablet" && ot_test) ? ot_camera_width : st_camera_width;

st_c_loc = tablet_params[16];
ot_c_loc = other_tablet_general_sizes[16];
st_cam_loc = (orientation=="landscape") ? st_c_loc : search(st_c_loc,[0,4,1,2,3])[0];
ot_cam_loc = (orientation=="landscape") ? ot_c_loc : search(ot_c_loc,[0,4,1,2,3])[0];
cam_loc = (type_of_tablet=="other tablet" && ot_test) ? ot_cam_loc : st_cam_loc;

swap=[0,3,4,1,2];
home_button_location = (swap_camera_and_home_button=="no") ? home_loc : swap[home_loc];
camera_location = (swap_camera_and_home_button=="no") ? cam_loc : swap[cam_loc];

case_opening_corner_radius_incl_acrylic = (type_of_keyguard=="3D-Printed") ? case_opening_corner_radius : max(case_opening_corner_radius,acrylic_case_corner_radius);


// Case and Screen variables
coh = (have_a_case == "yes") ? height_of_opening_in_case : 0;
cow = (have_a_case == "yes") ? width_of_opening_in_case : 0;
cocr = case_opening_corner_radius_incl_acrylic;

vtf = keyguard_vertical_tightness_of_fit/10;
htf = keyguard_horizontal_tightness_of_fit/10;

//overall keyguard measurements - not, necessarily, the size of the keyguard opening in a keyguard frame
kw = (have_a_case == "no") ? tablet_width : 
				(have_a_keyguard_frame=="no") ? cow+htf :
												keyguard_width+htf;
kh = (have_a_case == "no") ? tablet_height : 
				(have_a_keyguard_frame=="no") ? coh+vtf :
												keyguard_height+vtf;
kcr = (have_a_case == "no") ? tablet_corner_radius : 
				(have_a_keyguard_frame=="no") ? case_opening_corner_radius_incl_acrylic :
												keyguard_corner_radius;

st_screen_width = (orientation=="landscape") ? tablet_params[3] : tablet_params[4];
ot_screen_width = (orientation=="landscape") ? other_tablet_general_sizes[3] : other_tablet_general_sizes[4];
screen_width = (type_of_tablet=="other tablet" && ot_test) ? ot_screen_width : st_screen_width;
swm = screen_width;

st_screen_height = (orientation=="landscape") ? tablet_params[4] : tablet_params[3];
ot_screen_height = (orientation=="landscape") ? other_tablet_general_sizes[4] : other_tablet_general_sizes[3];
screen_height = (type_of_tablet=="other tablet" && ot_test) ? ot_screen_height : st_screen_height;
shm = screen_height;

st_ps = tablet_params[17]; //pixel settings
ot_ps = (ot_test) ? other_tablet_pixel_sizes : [0,0,0]; //pixel settings

ps = (type_of_tablet=="other tablet") ? ot_ps : st_ps; //pixel settings
shp = (orientation=="landscape") ? ps[0] : ps[1]; // screen height in pixels
swp = (orientation=="landscape") ? ps[1] : ps[0]; // screen width in pixels
mpp =  ps[2]; // millimeters per pixel
ppm = 1/mpp; // pixels per millimeter

lec = (have_a_keyguard_frame!="yes") ? left_edge_compensation_for_tight_cases : 0;
rec = (have_a_keyguard_frame!="yes") ? right_edge_compensation_for_tight_cases : 0;
bec = (have_a_keyguard_frame!="yes") ? bottom_edge_compensation_for_tight_cases : 0;
tec = (have_a_keyguard_frame!="yes") ? top_edge_compensation_for_tight_cases : 0;

case_even_left = (have_a_case == "yes") ? (cow-swm)/2 : 0;
case_even_bottom = (have_a_case == "yes") ? (coh-shm)/2 : 0;

unequal_left_side_offset = (have_a_case == "no" || (have_a_keyguard_frame=="yes" && generate=="keyguard")) ? 0 :
							(unequal_left_side_of_case_opening>0) ? unequal_left_side_of_case_opening-case_even_left : 0;
unequal_bottom_side_offset =  (have_a_case == "no" ) ? 0 :
							(unequal_bottom_side_of_case_opening>0) ? unequal_bottom_side_of_case_opening-case_even_bottom : 0;

msh = move_screenshot_horizontally/10;
if (msh != 0){
	slide_h = round(case_even_left + msh);
	echo();
	echo(str("Set 'unequal left side of case opening' to ", slide_h, " then set 'move screen horizontally' to 0"));
	echo();
}
msv = move_screenshot_vertically/10;
if (msv != 0){
	slide_v = round(case_even_bottom + msv);
	echo();
	echo(str("Set 'unequal bottom side of case opening' to ", slide_v, " then set 'move screen vertically' to 0"));
	echo();
}
							
// origin location variables
tablet_x0 = -tablet_width/2;
tablet_y0 = -tablet_height/2;

case_x0 = -cow/2;
case_y0 = -coh/2;

screen_x0 = -swm/2;
screen_y0 = -shm/2;

keyguard_frame_x0 = (have_a_case == "no") ? 0 : 
					(have_a_keyguard_frame=="yes") ? case_x0 : 0;
keyguard_frame_y0 = (have_a_case == "no") ? 0 :
					(have_a_keyguard_frame=="yes") ? case_y0 : 0;

keyguard_x0 = (have_a_case == "no") ? tablet_x0 : -kw/2;
keyguard_y0 = (have_a_case == "no") ? tablet_y0 : -kh/2;

generate_keyguard = generate=="keyguard" || generate=="first half of keyguard" || generate=="second half of keyguard" || generate=="first layer for SVG/DXF file";


// origin location abbreviations
tx0 = tablet_x0;
ty0 = tablet_y0;

cox0 = case_x0;
coy0 = case_y0;

kx0 = keyguard_x0;
ky0 = keyguard_y0;

kfx0 = keyguard_frame_x0;
kfy0 = keyguard_frame_y0;

sx0 = screen_x0;
sy0 = screen_y0;


//** Variables for use in txt files and here
//tablet and case variables
	th = (orientation=="landscape") ? tablet_height : tablet_width;	// height of tablet in millimeters
	tw = (orientation=="landscape") ? tablet_width : tablet_height;	// width of tablet in millimeters
	tcr	= tablet_corner_radius;	// tablet corner radius in millimeters
	sch = swap_camera_and_home_button; // boolean, is camera on right and home button on left
	sxo = (sch=="no") ? 1 : -1; // sign of x offset
	syo = (sch=="no") ? 1 : -1; // sign of y offset
	
	xtls = (sch=="no") ? 0: tablet_width_l; // x location of the left side of the tablet adjusted for swapping camera and home button
	xtrs = (sch=="no") ? tablet_width_l: 0; // x location of the right side of the tablet adjusted for swapping camera and home button
	ytbs = (sch=="no") ? 0: tablet_height_l; // y location of the bottom side of the tablet adjusted for swapping the camera and home button
	ytts = (sch=="no") ? tablet_height_l: 0; // y location of the top side of the tablet adjusted for swapping the camera and home button
	
	w = (generate_keyguard) ? kw : cow;  //width of the opening independent of whether this is a keyguard or a keyguard frame
	h = (generate_keyguard) ? kh : coh;  //height of the opening independent of whether this is a keyguard or a keyguard frame

	xols = (sch=="no") ? 0 : w; // x location of the left side of the case opening adjusted for swapping camera and home button
	xors = (sch=="no") ? w : 0; // x location of the right side of the case opening adjusted for swapping camera and home button
	yobs = (sch=="no") ? 0 : h; // y location of the bottom side of the case opening adjusted for swapping the camera and home button
	yots = (sch=="no") ? h : 0; // y location of the top side of the case opening adjusted for swapping the camera and home button
	
	lcow = (cow-swm)/2; // the default width of the left side of case opening when in landscape mode
	bcoh = (coh-shm)/2; // the default height of the bottom side of case opening when in landscape mode

//screen variables
	//is it true that the app measurements been provided in pixels based on a screenshot?
	px_measurements = ((bottom_of_status_bar>0 || bottom_of_upper_message_bar>0 || bottom_of_upper_command_bar>0 || top_of_lower_message_bar>0 ||
		top_of_lower_command_bar>0) && ((bottom_of_status_bar>=bottom_of_upper_message_bar && bottom_of_upper_message_bar>=bottom_of_upper_command_bar && bottom_of_upper_command_bar>=top_of_lower_message_bar && top_of_lower_message_bar>=top_of_lower_command_bar) || (bottom_of_status_bar<=bottom_of_upper_message_bar && bottom_of_upper_message_bar<=bottom_of_upper_command_bar && bottom_of_upper_command_bar<=top_of_lower_message_bar && top_of_lower_message_bar<=top_of_lower_command_bar))); 
	
	//if app measurements been provided in pixels have they been taken from the top or bottom of the screenshot?
	px_measurements_start = (bottom_of_status_bar < top_of_lower_command_bar) ? "top" : "bottom";
	
	nc = number_of_columns;
	nr = number_of_rows;
	
	//the following values depend on the setting in the Freeform and hybrid Openings section
	sh = (unit_of_measure_for_screen=="px") ? shp : shm;
	sw = (unit_of_measure_for_screen=="px") ? swp : swm;
	
// app variables - used in opentings_and_additions.txt file

	sbbp = bottom_of_status_bar; //status bar bottom in pixels
	umbbp = bottom_of_upper_message_bar; //upper message bar bottom in pixels
	ucbbp = bottom_of_upper_command_bar; //upper command bar bottom in pixels
	lmbtp = top_of_lower_message_bar; //top of lower message bar in pixels
	lcbtp = top_of_lower_command_bar; //top of lower command bar in pixels
	lmbbp = top_of_lower_command_bar; //lower message bar bottom in pixels
	lcbbp = (px_measurements_start=="top") ?  shp : 0; //lower command bar bottom in pixels
	

	sbhp = (px_measurements_start=="top") ? sbbp : shp - sbbp; // height of status bar in pixels
	umbhp = (px_measurements_start=="top") ? umbbp - sbbp : sbbp - umbbp; // height of upper message bar in pixels
	ucbhp = (px_measurements_start=="top") ? ucbbp - umbbp : umbbp - ucbbp; // height of upper command bar in pixels
	lmbhp = (px_measurements_start=="top") ? lcbtp - lmbtp : lmbtp - lcbtp; // height of lower message bar in pixels
	lcbhp = (px_measurements_start=="top") ? shp - lcbtp : lcbtp; // height of lower command bar in pixelscel
	
	sbh = (px_measurements && unit_of_measure_for_screen=="px") ? sbhp :
	      (px_measurements && unit_of_measure_for_screen=="mm") ? sbhp * mpp : 
		  (!px_measurements && unit_of_measure_for_screen=="mm") ? status_bar_height : 
		  status_bar_height * ppm; // status bar height
	umbh = (px_measurements && unit_of_measure_for_screen=="px") ? umbhp :
	      (px_measurements && unit_of_measure_for_screen=="mm") ? umbhp * mpp : 
		  (!px_measurements && unit_of_measure_for_screen=="mm") ? upper_message_bar_height : 
		  upper_message_bar_height * ppm; //  upper message bar height
	ucbh = (px_measurements && unit_of_measure_for_screen=="px") ? ucbhp :
	      (px_measurements && unit_of_measure_for_screen=="mm") ? ucbhp * mpp : 
		  (!px_measurements && unit_of_measure_for_screen=="mm") ? upper_command_bar_height : 
		  upper_command_bar_height * ppm; // command bar height
	lmbh = (px_measurements && unit_of_measure_for_screen=="px") ? lmbhp :
	      (px_measurements && unit_of_measure_for_screen=="mm") ? lmbhp * mpp : 
		  (!px_measurements && unit_of_measure_for_screen=="mm") ? lower_message_bar_height : 
		  lower_message_bar_height * ppm; // lower message bar height
	lcbh = (px_measurements && unit_of_measure_for_screen=="px") ? lcbhp :
	      (px_measurements && unit_of_measure_for_screen=="mm") ? lcbhp * mpp : 
		  (!px_measurements && unit_of_measure_for_screen=="mm") ? lower_command_bar_height : 
		  lower_command_bar_height * ppm; // lower command bar height


	sbb = (starting_corner_for_screen_measurements=="upper-left") ? sbh : sh - (sbh); //status bar bottom
	umbb = (starting_corner_for_screen_measurements=="upper-left") ?  sbh + umbh : sh - (sbh + umbh); // upper message bar bottom
	ucbb = (starting_corner_for_screen_measurements=="upper-left") ? sbh + umbh + ucbh : sh - (sbh + umbh + ucbh); // upper command bar bottom
	lmbt = (starting_corner_for_screen_measurements=="upper-left") ? sh - lcbh - lmbh : lcbh + lmbh; // lower message bar top
	lmbb = (starting_corner_for_screen_measurements=="upper-left") ? sh - lcbh : lcbh; // lower message bar bottom
	lcbb = (starting_corner_for_screen_measurements=="upper-left") ? sh : 0; // lower command bar bottom

	hloc = home_loc;  // home button location: 1,2,3,4 (adjusted for orientation)
	hbd = distance_from_screen_to_home_button;
	hbh = home_button_height;
	hbw = home_button_width;
	cloc = cam_loc;  // camera location: 1,2,3,4 (adjusted for orientation)
	cmd = distance_from_screen_to_camera;
	cmh = camera_height;
	cmw = camera_width;
	
// variables for laying out the bars and the grid - all in millimeters
sbhm = (px_measurements) ? sbhp * mpp : status_bar_height; // status bar height
umbhm = (px_measurements) ? umbhp * mpp : upper_message_bar_height; // upper message bar height
ucbhm = (px_measurements) ? ucbhp * mpp : upper_command_bar_height; // upper command bar height
lmbhm = (px_measurements) ? lmbhp * mpp : lower_message_bar_height; /// lower message bar height
lcbhm = (px_measurements) ? lcbhp * mpp : lower_command_bar_height; /// lower command bar height

sbbm = (px_measurements_start=="top") ? sbhm : shm - (sbhm); //status bar bottom
umbbm = (px_measurements_start=="top") ?  sbhm + umbhm : shm - (sbhm + umbhm); // upper message bar bottom
ucbbm = (px_measurements_start=="top") ? sbhm + umbhm + ucbhm : shm - (sbhm + umbhm + ucbhm); // upper command bar bottom
lmbtm = (px_measurements_start=="top") ? shm - lcbhm - lmbhm : lcbhm + lmbhm; // lower message bar top in millimeters
lmbbm = (px_measurements_start=="top") ? shm - lcbhm : lcbhm; // lower message bar bottom
lcbbm = (px_measurements_start=="top") ? shm : 0; // lower command bar bottom

bar_width = swm - lec - rec;

sbh_adjust = (tec>0) ? sbhm - tec : sbhm;
umbh_adjust = (tec>sbhm) ? umbhm - (tec - sbhm) : umbhm;
ucbh_adjust = (tec>sbhm+umbhm) ? ucbhm - (tec - sbhm - umbhm) : ucbhm;
lmbh_adjust = (bec>lcbhm) ? lmbhm - (bec - lcbhm) : lmbhm;
lcbh_adjust = (bec>0) ? lcbhm - bec : lcbhm;

bcr = bar_corner_radius;


//Grid variables in millimeters
grid_width = swm - left_padding - right_padding;
grid_height = shm - sbhm - umbhm - ucbhm - top_padding - bottom_padding - lmbhm - lcbhm;

grid_x0 = screen_x0 + left_padding;
grid_y0 = screen_y0 + bottom_padding + lmbhm + lcbhm;

	gw = (unit_of_measure_for_screen=="mm") ? grid_width : grid_width * ppm;
	gh = (unit_of_measure_for_screen=="mm") ? grid_height : grid_height * ppm;
	gt = ucbb;  // grid top
	gb = lmbt;  // grid bottom
	
	gwm = grid_width;  // grid width in millimeters
	ghm = grid_height;  // grid height in millimeters
	
	tp = (px_measurements) ? top_padding * ppm : top_padding; // top padding for txt files
	bp = (px_measurements) ? bottom_padding * ppm : bottom_padding; // bottom padding for txt files
	lp = (px_measurements) ? left_padding * ppm : left_padding; // left padding for txt files
	rp = (px_measurements) ? right_padding * ppm : right_padding; // right padding for txt files
		
chamfer_angle_stop = 45;

//next instruction doesn't allow for acrylic sheets that are other than 3.15 mm thick - but only impacts display of keyguard since laser cutting uses
//   only the first layer for SVG/DXF file export
kt = (type_of_keyguard=="Laser-Cut") ? 3.175: 
     (have_a_keyguard_frame=="yes" && keyguard_thickness > keyguard_frame_thickness) ? keyguard_frame_thickness :
	 keyguard_thickness;
	 
//misc variables
kec = (keyguard_thickness > keyguard_edge_chamfer) ? keyguard_edge_chamfer : keyguard_thickness -.1;
chamfer_slices = keyguard_edge_chamfer/.2;
chamfer_slice_size = .2;

$fn=smoothness_of_circles_and_arcs;



//handle the instance where a system like an Accent
system_with_no_case = ((tablet_width==0) || (tablet_height == 0)) && (have_a_case=="no");

//cell variables
column_count = (system_with_no_case || cut_out_screen == "yes") ? 0 : number_of_columns;
row_count = (system_with_no_case || cut_out_screen == "yes") ? 0 : number_of_rows;

max_cell_width = grid_width/column_count;
max_cell_height = grid_height/row_count;
minimum__acrylic_rail_width = (use_Laser_Cutting_best_practices=="no") ?  1 : 2;
hrw = grid_width/number_of_columns - cell_width;
vrw = grid_height/number_of_rows - cell_height;

// this module should go away after "n" releases or "m" months when people have had a chance to move beyond 66- versions
echo_upgrade_recommendations(cell_width,cell_height,cell_edge_slope,screen_area_thickness);

	cw = cell_width;
	ch = cell_height;
	ccr = cell_corner_radius;
	
	hor = height_of_ridge;
	tor = thickness_of_ridge;

min_actual_cell_dim = min(cell_width,cell_height);
acrylic_cell_corner_radius = max(min_actual_cell_dim/10,cell_corner_radius);
first_ocr = (type_of_keyguard=="Laser-Cut" && use_Laser_Cutting_best_practices=="yes") ? acrylic_cell_corner_radius : cell_corner_radius;
ocr = min(first_ocr, min_actual_cell_dim/2);

sata = sat_incl_acrylic;
sat = min(kt,sata); // thiness of the grid and bar region of the keyguard which can't exceed the overall keyguard Thickness

horizontal_slide_in_tab_length_incl_acrylic = (type_of_keyguard=="3D-Printed") ? horizontal_slide_in_tab_length : horizontal_acrylic_slide_in_tab_length;
vertical_slide_in_tab_length_incl_acrylic = (type_of_keyguard=="3D-Printed") ? vertical_slide_in_tab_length : vertical_acrylic_slide_in_tab_length;
slide_in_tab_thickness = (type_of_keyguard=="3D-Printed") ? min(kt-0.65, preferred_slide_in_tab_thickness) : acrylic_slide_in_tab_thickness;

col_first_trim = (lec>left_padding+vrw/2) ? lec - left_padding - vrw/2 : 0;
col_last_trim = (rec>right_padding+vrw/2) ? rec - right_padding - vrw/2 : 0;
row_first_trim = (bec>bottom_padding+lmbhm+lcbhm+hrw/2) ? bec - bottom_padding - lmbhm - lcbhm - hrw/2 : 0;
row_last_trim = (tec>top_padding+sbhm+umbhm+ucbhm+hrw/2) ? tec - top_padding - sbhm- umbhm- ucbhm - hrw/2 : 0;

cts = (type_of_keyguard=="Laser-Cut") ? 90 :
		(type_of_keyguard=="3D-Printed" && cell_top_edge_slope == 90) ? cell_edge_slope : cell_top_edge_slope;  
cbs = (type_of_keyguard=="Laser-Cut") ? 90 :
		(type_of_keyguard=="3D-Printed" && cell_bottom_edge_slope == 90) ? cell_edge_slope : cell_bottom_edge_slope;  
		
cec = (sat > cell_edge_chamfer) ? cell_edge_chamfer : sat-.1;


//home button and camera location variables
home_x_loc = (home_button_location==1) ? screen_x0+swm/2 
	: (home_button_location==2) ? screen_x0+swm+distance_from_screen_to_home_button 
	: (home_button_location==3) ? screen_x0+swm/2 
	: screen_x0-distance_from_screen_to_home_button;

home_y_loc = (home_button_location==1) ? screen_y0+shm+distance_from_screen_to_home_button 
	: (home_button_location==2) ? screen_y0+shm/2
	: (home_button_location==3) ? screen_y0-distance_from_screen_to_home_button 
	: screen_y0+shm/2 ;
	
cam_x_loc = (camera_location==1) ? screen_x0+swm/2 
	: (camera_location==2) ? screen_x0+swm+distance_from_screen_to_camera 
	: (camera_location==3) ? screen_x0+swm/2 
	: screen_x0-distance_from_screen_to_camera ;
	
cam_y_loc = (camera_location==1) ? screen_y0+shm+distance_from_screen_to_camera 
	: (camera_location==2) ? screen_y0+shm/2 
	: (camera_location==3) ? screen_y0-distance_from_screen_to_camera 
	: screen_y0+shm/2;

//velcro variables
velcro_diameter = 
    (velcro_size==1)? 10
  : (velcro_size==2)? 16
  : (velcro_size==3)? 20
  : (velcro_size==4)? 10
  : (velcro_size==5)? 16
  : 20;
  
strap_cut_to_depth = 9.25 - 3.1 - 3.5; // length of bolt - thickness of acrylic mount - height of nut


// general case mount veriables
ulos = unequal_left_side_offset;
ulbs = unequal_bottom_side_offset;


//clip-on strap variables
horizontal_pedestal_width = horizontal_clip_width + 10;
vertical_pedestal_width = vertical_clip_width + 10;

horizontal_slot_width = horizontal_clip_width+2;
vertical_slot_width = vertical_clip_width+2;

pedestal_height = (have_a_case=="no")? 0 : 
				  (have_a_keyguard_frame=="no") ? max(case_to_screen_depth - kt,0) :
				  max(case_to_screen_depth - keyguard_frame_thickness,0);
vertical_offset = (have_a_keyguard_frame=="no") ? kt/2 + pedestal_height-3+fudge : // bottom of cut for clip-on strap
												  keyguard_frame_thickness/2 + pedestal_height-3+fudge;


// slide-in tab variables

// raised-tab variables

//shelf variables
st = (have_a_keyguard_frame=="no") ? min(shelf_thickness,keyguard_thickness) : min(shelf_thickness,keyguard_frame_thickness);

// bar variables

// keyguard frame variables
groove_size = 1.2;
groove_width = 30;
snap_in_size = .8;
snap_in_width = 25;
//post length should be between 3 and 5
post_len = (((width_of_opening_in_case - kw)/2 - 3) < 3) ? 3 : 5;

//Braille and cell insert variables
bsm = Braille_size_multiplier/10; //Braille size multiplier
braille_a = " abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
braille_d = [0,32,40,48,52,36,56,60,44,24,28,34,42,50,54,38,58,62,46,26,30,35,43,29,51,55,39,32,40,48,52,36,56,60,44,24,28,34,42,50,54,38,58,62,46,26,30,35,43,29,51,55,39];
insert_thickness = sat-insert_recess;
e_t = engraved_text;

// // // //Blissymbol parameter from customizer
// // // //concept must match STL filename (without the .stl)
// // // Bliss_concept = "";

// // // //Blissymbol variables
// // // apos2 = search("'", Bliss_concept)[0];
// // // bycw = apos2 == undef ? Bliss_concept :
	 // // // apos2 > 0 ?
		// // // strcat(concat(substr(Bliss_concept,0,apos2),substr(Bliss_concept,apos2 + 1))):
		// // // "";
// // // path = (Bliss_concept !="") ? "Bliss concepts/" : "";
// // // filename = (Bliss_concept !="") ? bycw : "";
// // // path_and_filename = (path != "" && filename != "") ? str(path,filename,".stl") : "";

///**** these next two lines should be derivable or replaced by values above
case_thick = (have_a_case=="no")? tablet_thickness+kt : case_thickness+max(kt-case_to_screen_depth,0);

//currently only openings for ambient light sensors - may need to become specific to ALS if other types of openings are added - especially if they don't map to tablet models in the same way that ALS openings do
tablet_openings=[  
	/* iPad 1st generation */
	[[  "1ALS1", xtls+sxo*10.4,   ytbs+syo*94.9,   0,      2.5,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad 2nd, 3rd, & 4th generation */
	[[  "23ALS1", xtls+sxo*6.7,   ytbs+syo*92.9,   0,      2.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad 5th & 6th generation */
	[[ "56ALS1", xtls+sxo*11.07, ytbs+syo*80.34,   0,    3.5,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad 7th & 8th generation */
	[[ "78ALS1", xtls+sxo*11.03, ytbs+syo*82.64,   0,    3.5,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad 9th generation */
	// the first entry copied for consistency with ready-made-designs
	[[ "78ALS1", xtls+sxo*11.03, ytbs+syo*82.64,   0,    3.5,   "c",        60,           60,         60,          60,            0,         ],
	[ "9ALS1", xtls+sxo*11.03, ytbs+syo*21.83,   0,    3.5,   "c",        60,           60,         60,          60,            0,         ],
	[ "9ALS2", xtls+sxo*11.03, ytts-syo*21.53,   0,    3.5,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad 10th generation */
	[[ "10ALS1", xtls+sxo*35.02,      ytts-syo*4.53,   0,    3.5,   "c",        60,           60,         60,          60,            0,         ],
	[ "10ALS2", xtls+sxo*(tw-111.15), ytts-syo*5.24,   0,    3.5,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Pro 9.7-inch */
	[[ "9.7ALS1", xtls+sxo*13.55,   ytbs+syo*18.86,   0,     3.0,   "c",        60,           60,         60,          60,            0,         ],
	[ "9.7ALS2", xtls+sxo*13.55,   ytts-syo*18.86,   0,     3.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Pro 10.5-inch */
	[[ "10.5ALS1", xtls+sxo*9.62,   ytbs+syo*18.72,   0,     2.5,   "c",        60,           60,         60,          60,            0,         ],
	[ "10.5ALS2", xtls+sxo*9.62,   ytts-syo*18.72,   0,     2.5,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Pro 11, 1st & 2nd generation */
	[[ "11-12ALS1", xtls+sxo*4.37,   ytbs+syo*30.73,   0,      3.5,   "c",        60,           60,         60,          60,            0,         ],
	[ "11-12ALS2", xtls+sxo*4.37,   ytts-syo*30.73,   0,      3.5,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Pro 11, 3rd & 4th generation */
	[[ "11-34ALS1", xtls+sxo*3.60,   ytbs+syo*43.49,   0,      4.0,   "c",        60,           60,         60,          60,            0,         ],
	[ "11-34ALS2", xtls+sxo*3.60,   ytts-syo*43.49,   0,      4.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Pro 12.9, 1st generation */
	[[ "12.9-1ALS1", xtls+sxo*13.41,   ytbs+syo*18.48,   0,    2.5,   "c",        60,           60,         60,          60,            0,         ],
	[ "12.9-1ALS2", xtls+sxo*13.41,   ytts-syo*18.48,   0,    2.5,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Pro 12.9, 2nd generation */
	[[ "12.9-2ALS1", xtls+sxo*11.07,   ytbs+syo*22.38,   0,    2.5,   "c",        60,           60,         60,          60,            0,         ],
	[ "12.9-2ALS2", xtls+sxo*11.07,   ytts-syo*22.38,   0,    2.5,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Pro 12.9, 3rd generation */
	[[ "12.9-3ALS1", xtls+sxo*4.37,   ytbs+syo*30.73,   0,    3.8,   "c",        60,           60,         60,          60,            0,         ],
	[ "12.9-3ALS2", xtls+sxo*4.37,   ytts-syo*30.73,   0,    3.8,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Pro 12.9, 4th generation */
	[[ "12.9-4ALS1", xtls+sxo*3.5,   ytbs+syo*30.72,   0,    3.8,   "c",        60,           60,         60,          60,            0,         ],
	[ "12.9-4ALS2", xtls+sxo*3.5,   ytts-syo*30.72,   0,    3.8,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Pro 12.9, 5th & 6th generation */
	[[ "12.9-56ALS1", xtls+sxo*4.13,  ytbs+syo*43.49,   0,    3.8,   "c",        60,           60,         60,          60,            0,         ],
	[ "12.9-56ALS2", xtls+sxo*4.13,  ytts-syo*43.49,   0,    3.8,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Mini */
	[[ "MiniALS1", xtls+sxo*10.7,   ytts-syo*71.8,   0,      2.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Mini, 2nd & 3rd generation */
	[[ "Mini-23ALS1", xtls+sxo*10.7,   ytts-syo*71.7,   0,      2.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Mini, 4th generation */
	[[ "Mini-4ALS1", xtls+sxo*5.14,   ytbs+syo*16.46,   0,      4.0,   "c",        60,           60,         60,          60,            0,         ],
	[ "Mini-4ALS2", xtls+sxo*5.14,   ytts-syo*16.46,   0,      4.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Mini, 5th generation */
	[[ "Mini-5ALS1", xtls+sxo*13.57,   ytbs+syo*18.60,   0,      4.0,   "c",        60,           60,         60,          60,            0,         ],
	[ "Mini-5ALS2", xtls+sxo*13.57,   ytts-syo*18.60,   0,      4.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Mini, 6th, 7th A17 generation */
	[[ "Mini-67ALS1", xtls+sxo*4.38,   ytts-syo*23.99,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ],
	[ "Mini-67ALS2", xtls+sxo*16.61,   ytts-syo*3.34,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ],
	[ "Mini-67ALS3", xtrs-sxo*40.24,   ytts-syo*3.34,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Air */
	[[ "AirALS1", xtls+sxo*11.1,   ytts-syo*89.1,   0,      2.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Air, 2nd generation */
	[[ "Air-2ALS1", xtls+sxo*5.14,   ytbs+syo*16.44,   0,      2.5,   "c",        60,           60,         60,          60,            0,         ],
	[ "Air-2ALS2", xtls+sxo*5.14,   ytts-syo*16.44,   0,      2.5,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Air, 3rd generation */
	[[ "Air-3ALS1", xtls+sxo*9.62,   ytbs+syo*18.72,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ],
	[ "Air-3ALS2", xtls+sxo*9.62,   ytts-syo*18.72,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Air, 4th & 5th generation */
	[[ "Air-45ALS1", xtls+sxo*4.62,   ytbs+syo*22.13,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ],
	[  "Air-45ALS2", xtls+sxo*4.62,   ytbs+syo*51.40,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ],
	[  "Air-45ALS3", xtls+sxo*4.62,   ytts-syo*26.47,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Pro 11-inch M4 */
	[[ "Pro-11M4ALS1", xtls+sxo*4.71,   ytbs+syo*88.76,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ],
	[  "Pro-11M4ALS2", xtls+sxo*124.85,  ytts-syo*4.71,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Pro 13-inch M4 */
	[[ "Pro-13M4ALS1",   xtls+sxo*4.71,  ytbs+syo*107.76,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ],
	[  "Pro-13M4ALS2", xtls+sxo*140.79,    ytts-syo*4.71,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Air 11-inch M2 */
	[[ "Air-11M2ALS1",   xtls+sxo*4.62,   ytbs+syo*22.13,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ],
	[  "Air-11M2ALS2",   xtls+sxo*4.62,   ytbs+syo*51.40,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ],
	[  "Air-11M2ALS3", xtls+sxo*138.92,    ytts-syo*4.49,   0,      3.7,   "c",        60,           60,         60,          60,            0,         ]],

	/* iPad Air 13-inch M2 */
	[[ "Air-13M2ALS1", xtls+tw/2-sxo*94.66,   ytts-syo*4.22,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ],
	[  "Air-13M2ALS2", xtls+tw/2+sxo*15.56,   ytts-syo*4.22,   0,      3.0,   "c",        60,           60,         60,          60,            0,         ]],
];

//this tablet's openings
tto = 
    (type_of_tablet=="iPad 1st generation")? tablet_openings[0]
  : (type_of_tablet=="iPad 2nd generation")? tablet_openings[1]
  : (type_of_tablet=="iPad 3rd generation")? tablet_openings[1]
  : (type_of_tablet=="iPad 4th generation")? tablet_openings[1]
  : (type_of_tablet=="iPad 5th generation")? tablet_openings[2]  
  : (type_of_tablet=="iPad 6th generation")? tablet_openings[2]  
  : (type_of_tablet=="iPad 7th generation")? tablet_openings[3]
  : (type_of_tablet=="iPad 8th generation")? tablet_openings[3]
  : (type_of_tablet=="iPad 9th generation")? tablet_openings[4]
  : (type_of_tablet=="iPad 10th generation")? tablet_openings[5]
  : (type_of_tablet=="iPad Pro 9.7-inch")? tablet_openings[6]
  : (type_of_tablet=="iPad Pro 10.5-inch")? tablet_openings[7]
  : (type_of_tablet=="iPad Pro 11-inch 1st Generation")? tablet_openings[8]
  : (type_of_tablet=="iPad Pro 11-inch 2nd Generation")? tablet_openings[8]
  : (type_of_tablet=="iPad Pro 11-inch 3rd Generation")? tablet_openings[9]
  : (type_of_tablet=="iPad Pro 11-inch 4th Generation")? tablet_openings[9]
  : (type_of_tablet=="iPad Pro 12.9-inch 1st Generation")? tablet_openings[10]
  : (type_of_tablet=="iPad Pro 12.9-inch 2nd Generation")? tablet_openings[11]
  : (type_of_tablet=="iPad Pro 12.9-inch 3rd Generation")? tablet_openings[12]
  : (type_of_tablet=="iPad Pro 12.9-inch 4th Generation")? tablet_openings[13]
  : (type_of_tablet=="iPad Pro 12.9-inch 5th Generation")? tablet_openings[14]
  : (type_of_tablet=="iPad Pro 12.9-inch 6th Generation")? tablet_openings[14]
  : (type_of_tablet=="iPad mini")? tablet_openings[15]
  : (type_of_tablet=="iPad mini 2")? tablet_openings[16]
  : (type_of_tablet=="iPad mini 3")? tablet_openings[16]
  : (type_of_tablet=="iPad mini 4")? tablet_openings[17]
  : (type_of_tablet=="iPad mini 5")? tablet_openings[18]
  : (type_of_tablet=="iPad mini 6")? tablet_openings[19]  
  : (type_of_tablet=="iPad mini 7 A17 Pro")? tablet_openings[19] 
  : (type_of_tablet=="iPad Air")? tablet_openings[20]
  : (type_of_tablet=="iPad Air 2")? tablet_openings[21]
  : (type_of_tablet=="iPad Air 3")? tablet_openings[22]
  : (type_of_tablet=="iPad Air 4")? tablet_openings[23]
  : (type_of_tablet=="iPad Air 5")? tablet_openings[23] 
  : (type_of_tablet=="iPad Pro 11-inch M4")? tablet_openings[24] 
  : (type_of_tablet=="iPad Pro 13-inch M4")? tablet_openings[25] 
  : (type_of_tablet=="iPad Air 11-inch M2")? tablet_openings[26] 
  : (type_of_tablet=="iPad Air 13-inch M2")? tablet_openings[27] 
  : []; // all other tablets
  



include <openings_and_additions.txt>


// ----------------------Main-----------------------------
$vpd = (keyguard_display_angle>0 && orientation=="landscape") ? 500 : 
	   (keyguard_display_angle>0 && orientation=="portrait") ? 620 :
	   $vpd;
$vpt = (keyguard_display_angle>0) ? [1,1,1] : 
	   $vpt;
$vpr = (show_back_of_keyguard=="no" && keyguard_display_angle > 0) ? [90-keyguard_display_angle,0,0] :
       (show_back_of_keyguard=="yes") ? [0,180,0] : 
	   $vpr;
	   
if (system_with_no_case){
	echo();
	echo();
	text_string1 = str("The ",type_of_tablet," system requires case-opening measurements.");
	text_string2 = "Set 'have a case' to 'yes' in the Tablet Case section,";
	text_string3 = "and provide measurements for the case-opening.";
	echo("**************************************************************************************************");
	echo(text_string1);
	echo(text_string2);
	echo(text_string3);
	echo("**************************************************************************************************");
	echo();
	echo();
}
else if (type_of_keyguard=="3D-Printed" && (generate=="keyguard" || generate=="first half of keyguard" || generate=="second half of keyguard")){
	color("Turquoise")
	keyguard("no");
	
	if (include_screenshot=="yes"){
		show_screenshot(kt);
	}
}
else if (type_of_keyguard=="Laser-Cut" && generate=="keyguard" && have_a_keyguard_frame!="yes" && (mounting_method=="No Mount" || mounting_method=="Slide-in Tabs")){
	color("Khaki")
	keyguard("no");
	issues();

	if (include_screenshot=="yes"){
		show_screenshot(3.175);
	}
}
else if (type_of_keyguard=="Laser-Cut" && generate=="first layer for SVG/DXF file" && have_a_keyguard_frame!="yes" && (mounting_method=="No Mount" || mounting_method=="Slide-in Tabs")){
	color("DarkSeaGreen")
	render()
	lc_keyguard("no");
	issues();
	key_settings();

	if (include_screenshot=="yes"){
		show_screenshot(3.175);
	}
}
else if (generate=="horizontal clip"){
	if (unequal_left_side_of_case == 0){
		clip_reach = (have_a_case=="no")? 6 : (case_width-kw)/2+5;
		create_clip(clip_reach,horizontal_clip_width);
	}
	else{  //if unequal_left_side_of_case>0 then assume that there is a case
		clip_reach_left = unequal_left_side_of_case + 5;

		clip_reach_right = case_width-kw-unequal_left_side_of_case+5;

		//left side clip
		translate([-35,0,horizontal_clip_width])
		rotate([0,180,0])
		translate([0,case_thickness/2+10,0])
		create_clip(clip_reach_left,horizontal_clip_width);
		
		//right side clip
		translate([0,-case_thickness/2-10,0])
		create_clip(clip_reach_right,horizontal_clip_width);
	}
}
else if (generate=="vertical clip"){
	if (unequal_bottom_side_of_case == 0){
		clip_reach = (have_a_case=="no")? 6 : (case_height-kh)/2+5;
		create_clip(clip_reach,vertical_clip_width);
	}
	else{  //if unequal_bottom_side_of_case>0 then assume that there is a case
		clip_reach_bottom = unequal_bottom_side_of_case + 5;

		clip_reach_top = case_height-kh-unequal_bottom_side_of_case+5;

		//top side clip
		translate([-35,0,vertical_clip_width])
		rotate([0,180,0])
		translate([0,case_thickness/2+10,0])
		create_clip(clip_reach_bottom,vertical_clip_width);
		
		//bottom side clip
		translate([0,-case_thickness/2-10,0])
		create_clip(clip_reach_top,vertical_clip_width);
	}
}
else if (generate=="horizontal mini clip1"){
	if (unequal_left_side_of_case == 0){
		clip_reach = (have_a_case=="no")? 6 : (case_width-kw)/2+5;
		create_mini_clip1(clip_reach,horizontal_clip_width);
	}
	else{  //if unequal_left_side_of_case>0 then assume that there is a case
		clip_reach_left = unequal_left_side_of_case + 5;

		clip_reach_right = case_width-kw-unequal_left_side_of_case+5;

		//left side clip
		translate([-35,0,horizontal_clip_width])
		rotate([0,180,0])
		translate([0,case_thickness/2+10,0])
		create_mini_clip1(clip_reach_left,horizontal_clip_width);
		
		//right side clip
		translate([0,-case_thickness/2-10,0])
		create_mini_clip1(clip_reach_right,horizontal_clip_width);
	}
}
else if (generate=="vertical mini clip1"){
	if (unequal_bottom_side_of_case == 0){
		clip_reach = (have_a_case=="no")? 6 : (case_height-kh)/2+5;
		create_mini_clip1(clip_reach,vertical_clip_width);
	}
	else{  //if unequal_bottom_side_of_case>0 then assume that there is a case
		clip_reach_bottom = unequal_bottom_side_of_case + 5;

		clip_reach_top = case_height-kh-unequal_bottom_side_of_case+5;

		//left side clip
		translate([-35,0,vertical_clip_width,vertical_clip_width])
		rotate([0,180,0])
		translate([0,case_thickness/2+10,0])
		create_mini_clip1(clip_reach_bottom,vertical_clip_width);
		
		//right side clip
		translate([0,-case_thickness/2-10,0])
		create_mini_clip1(clip_reach_top,vertical_clip_width);
	}
}
else if (generate=="horizontal mini clip2"){
	if (unequal_left_side_of_case == 0){
		clip_reach = (have_a_case=="no")? 6 : (case_width-kw)/2+5;
		create_mini_clip2(clip_reach,horizontal_clip_width);
	}
	else{  //if unequal_left_side_of_case>0 then assume that there is a case
		clip_reach_left = unequal_left_side_of_case + 5;

		clip_reach_right = case_width-kw-unequal_left_side_of_case+5;

		//left side clip
		translate([-35,0,horizontal_clip_width])
		rotate([0,180,0])
		translate([0,case_thickness/2+10,0])
		create_mini_clip2(clip_reach_left,horizontal_clip_width);
		
		//right side clip
		translate([0,-case_thickness/2-10,0])
		create_mini_clip2(clip_reach_right,horizontal_clip_width);
	}
}
else if (generate=="vertical mini clip2"){
	if (unequal_bottom_side_of_case == 0){
		clip_reach = (have_a_case=="no")? 6 : (case_height-kh)/2+5;
		create_mini_clip2(clip_reach,vertical_clip_width);
	}
	else{  //if unequal_bottom_side_of_case>0 then assume that there is a case
		clip_reach_bottom = unequal_bottom_side_of_case + 5;

		clip_reach_top = case_height-kh-unequal_bottom_side_of_case+5;

		//left side clip
		translate([-35,0,vertical_clip_width,vertical_clip_width])
		rotate([0,180,0])
		translate([0,case_thickness/2+10,0])
		create_mini_clip2(clip_reach_bottom,vertical_clip_width);
		
		//right side clip
		translate([0,-case_thickness/2-10,0])
		create_mini_clip2(clip_reach_top,vertical_clip_width);
	}
}
else if (generate=="keyguard frame" && type_of_keyguard!="Laser-Cut"){
	color("Turquoise")
	keyguard_frame("no");
	
	//cheat code ....
	if (other_tablet_pixel_sizes == [999]){
		color("red")
		translate([0,0,-(keyguard_frame_thickness/2-kt/2)])
		keyguard("yes");
	}
	
	if (include_screenshot=="yes"){
		show_screenshot(keyguard_frame_thickness);
	}
}
else if (generate=="keyguard frame - split" && type_of_keyguard!="Laser-Cut"){
	color("Turquoise")
	{
		difference(){
			keyguard_frame("no");
			split_keyguard_frame("first");
		}	
		
		translate([-kw/2 + abs(split_line_location) + 10,(coh-kh)/2 + max(horizontal_slide_in_tab_length,vertical_slide_in_tab_length) + 10 ,0])
		difference(){
			keyguard_frame("no");
			split_keyguard_frame("second");
		}
	}

}
else if ((generate=="first half of keyguard" || generate=="second half of keyguard") && type_of_keyguard=="Laser-Cut"){
	echo();
	echo();
	echo("************ Laser-cut keyguards cannot be split ************");
	echo();
	echo();
}
else if (generate=="keyguard frame" && type_of_keyguard=="Laser-Cut"){
	echo();
	echo();
	echo("************ Laser-cut keyguard frames are not supported ************");
	echo();
	echo();
}
else if (mounting_method=="Velcro" && type_of_keyguard=="Laser-Cut"){
	echo();
	echo();
	echo("************ Laser-cut keyguards cannot have a Velcro mounting method ************");
	echo();
	echo();
}
else if (mounting_method=="Shelf" && type_of_keyguard=="Laser-Cut"){
	echo();
	echo();
	echo("************ Laser-cut keyguards cannot have a Shelf mounting method ************");
	echo();
	echo();
}
else if (mounting_method=="Suction Cups" && type_of_keyguard=="Laser-Cut"){
	echo();
	echo();
	echo("************ Laser-cut keyguards cannot have a Suction Cups mounting method ************");
	echo();
	echo();
}
else if (mounting_method=="Screw-on Straps" && type_of_keyguard=="Laser-Cut"){
	echo();
	echo();
	echo("************ Laser-cut keyguards cannot have a Screw-on Straps mounting method ************");
	echo();
	echo();
}
else if (mounting_method=="Clip-on Straps" && type_of_keyguard=="Laser-Cut"){
	echo();
	echo();
	echo("************ Laser-cut keyguards cannot have a Clip-on Straps mounting method ************");
	echo();
	echo();
}
else if (mounting_method=="Posts" && type_of_keyguard=="Laser-Cut"){
	echo();
	echo();
	echo("************ Laser-cut keyguards cannot have a Posts mounting method ************");
	echo();
	echo();
}
else if (mounting_method=="Raised Tabs" && type_of_keyguard=="Laser-Cut"){
	echo();
	echo();
	echo("************ Laser-cut keyguards cannot have a Raised Tabs mounting method ************");
	echo();
	echo();
}
else if (generate=="keyguard" && type_of_keyguard=="Laser-Cut" && have_a_keyguard_frame=="yes"){
	echo();
	echo();
	echo("************ Laser-cut keyguards, going in a keyguard frame, are not supported ************");
	echo();
	echo();
}
else if (type_of_keyguard=="3D-Printed" && generate=="first layer for SVG/DXF file"){
	echo();
	echo();
	echo("************ First layer for SVG/DXF filee is not supported for a 3D-Printed keyguard ************");
	echo();
	echo();
}
else if (generate=="cell insert" && type_of_keyguard!="Laser-Cut"){ //cell inserts
	rotation = (Braille_text=="") ? -90 : 0;
	color("LawnGreen")
	rotate([rotation,0,0])
	create_cell_insert();
}
else { //Customizer settings
	echo_settings();
}

  

// ---------------------Modules----------------------------

module keyguard(cheat){
	unequal_opening = (have_a_keyguard_frame=="no") ? [-unequal_left_side_offset,-unequal_bottom_side_offset,0] : [0,0,0];
	
	difference(){
		union(){
			difference(){
				union(){
					difference(){
						//slide case opening plastic based on unequal case opening settings
						translate(unequal_opening)
						//base keyguard with  manual  and customizer mounting points and some added plastic in case region, no grid
						difference(){
							union(){
								//base object: tablet body slab or case opening along with case additions if any that can be chamfered
								base_keyguard(kw,kh,kcr,kt,cheat);
													
								//add slide-in & raised tabs
								if (have_a_case=="yes" && have_a_keyguard_frame=="no" && (m_m=="Slide-in Tabs" || m_m=="Raised Tabs")){
									case_mounts(kt);
								}
								
								//add shelf as a mounting method
								if (have_a_case=="yes" && have_a_keyguard_frame=="no" && m_m=="Shelf" && cheat=="no") {
									shelf_height = coh+2*shelf_depth;
									shelf_width = cow+2*shelf_depth;
									shelf_corner_radius = tablet_corner_radius;
					
									translate([0 ,0,-kt/2])
									linear_extrude(height=st)
									build_addition(shelf_width, shelf_height, "crr", shelf_corner_radius);
								}
								
								// adding manual slide-in tabs and pedestals for clip-on straps
								if(have_a_case=="yes" && len(case_additions)>0){
									if (have_a_keyguard_frame=="no" || 
									   (have_a_keyguard_frame=="yes" && generate=="keyguard frame" && cheat=="no")
									   ){
									   
										add_manual_mount_slide_in_tabs(case_additions);
										
										if(type_of_keyguard!="Laser-Cut"){
											add_manual_mount_pedestals(case_additions);
										}
									}
								}
								
								//add bumps and ridges from case_openings file
								if(type_of_keyguard=="3D-Printed" && have_a_case=="yes" && have_a_keyguard_frame=="no" && len(case_openings)>0 && cheat=="no"){
									adding_plastic(case_openings,"case");
								}
								
								//add embossed text to case region
								if (text!="" && keyguard_region=="case region" && text_depth>0){
									engrave_emboss_instruction();
								}
								
								//add pedestals for clip-on straps and ensure pedestals don't extend into screen area
								if (have_a_case=="yes" && m_m=="Clip-on Straps" && 
								    !(generate=="keyguard" && have_a_keyguard_frame=="yes") &&
									!(generate=="keyguard frame" && have_a_keyguard_frame=="yes")){
									case_mounts(kt);
								}
							}
							
							//*** cut away from keyguard blank those things that will be moved when the case opening is unequal
							
							// cut case openings
							if(have_a_case=="yes" && len(case_openings)>0 && !(have_a_keyguard_frame=="yes" && generate=="keyguard") && cheat=="no"){
								cut_case_openings(case_openings,kt);
							}
							
							//add engraved text to case region
							if (text!="" && keyguard_region=="case region" && text_depth<0){
								engrave_emboss_instruction();
							}

							//add cuts for suction cups, velcro, clip-on straps and screw-on straps
							if (have_a_case=="no" && trim_to_screen=="no" && type_of_keyguard=="3D-Printed"){
								mounting_points();
							}
									
							//cut out slots for customizer added clip-on straps
							if (have_a_case=="yes" && m_m=="Clip-on Straps" && 
								    !(generate=="keyguard" && have_a_keyguard_frame=="yes") &&
									!(generate=="keyguard frame" && have_a_keyguard_frame=="yes")){
								clip_on_straps_groove();
							}							

							// add slots to manually added clip-on strap pedestals
							if(have_a_case=="yes" && len(case_additions)>0 && type_of_keyguard!="Laser-Cut" && cheat=="no"){
								cut_manual_mount_pedestal_slots(case_additions);
							}
						}
						
						//*** cut things/areas that are part of the screen area and unaffected by unequal case opening
						
						//cut out all things that enter into the screen area - can be overwritten later by things like bumps and ridges
						trim_thickness = 20;
						allow = (kt-sat>0) ? cec : 0;  //allowing for additional chamfer if the screen area is inset
						translate([0,0,kt/2+trim_thickness/2-fudge*2])
						cube([screen_width+allow*2, screen_height+allow*2, trim_thickness],center=true);
						
						// remove the screen area of the keyguard if it is thinner than the rest of the keyguard
						if(kt-sat>0){
							translate([0,0,kt/2+(kt-sat)/2-(kt-sat)+fudge])
							hole_cutter(screen_width,screen_height,90,90,90,90,0,kt-sat);
						}


						//cut bars and grid cells - which doesn't move with unequal case opening
						if (column_count>0 && row_count>0){
							translate([0,0,sat/2 - kt/2])
							bars(sat);
						}
						if (column_count>0 && row_count>0){
							translate([0,0,-fudge-(kt-sat)/2])
							bounded_cells(sat);
						}
						
						//home button and camera are cut for both case and no_case configurations
						if (have_a_keyguard_frame=="no" ){
							home_camera(kt);
							
							if(add_symmetric_openings=="yes" && unequal_left_side_offset==0 && unequal_bottom_side_offset==0){
								rotate([0,0,180])
								home_camera(kt);
							}
						}

						// make cuts associated with the tablet like ALS openings and symmetric camera/home button slots that are as deep as the keyguard
						//          - can affect slide-in tabs and raised tabs (in particular)
						if (expose_ambient_light_sensors=="yes" && len(tto)>0 && have_a_keyguard_frame=="no" ){
							cut_tablet_openings(tto,kt);
							
							if(add_symmetric_openings=="yes"){
								rotate([0,0,180])
								cut_tablet_openings(tto,kt);
							}
						}
						
						//cut screen openings
						if(len(screen_openings)>0 && type_of_tablet!="blank"){
							cut_screen_openings(screen_openings,sat);
						}
						
						// add engraved text in the screen region
						if (text!="" && keyguard_region=="screen region" && text_depth < 0){
							engrave_emboss_instruction();
						}
						 						
						//if the keyguard will be trimmed to a specific pair of x,y locations
						if (len(trim_to_rectangle_lower_left)==2 && len(trim_to_rectangle_upper_right)==2 && trim_to_screen=="no"){
							trim_to_rectangle();
						}
					}

					//*** add items screen elements  and case elements that will override screen cutouts
					
					//add cell ridges	
					if (column_count>0 && row_count>0 && type_of_keyguard=="3D-Printed"){
						cell_ridges();
					}

					//add bumps and ridges
					if(type_of_keyguard=="3D-Printed" && len(screen_openings)>0){
						adding_plastic(screen_openings,"screen");
					}
					
					// add embossed text
					if (text!="" && keyguard_region=="screen region" && text_depth > 0){
						engrave_emboss_instruction();
					}
				}
				
				//*** add cuts that should override anything added to the screen
				
//**************						
				// remove parts of keyguard frame above posts
				if(have_a_case=="yes" && have_a_keyguard_frame=="yes" && mount_keyguard_with=="posts"){
					trim_keyguard_to_bar();
				}
				
				// trim away parts of keyguard to expose posts for mounting
				if(have_a_case=="yes" && m_m=="Posts"){
					translate([0,coh/2+25-mount_to_top_of_opening_distance,0])
					cube([cow+1,50,kt+2],center=true);

					// translate([lec/2-rec/2,shm/2+25-bcr-fudge,0])
					// cube([bar_width,50,kt+2],center=true);
				}
//**************						
				
				//remove parts of keyguard outside of the screen if trimmed to screen or an arbitrary rectangle
				if (trim_to_screen == "yes"){
					trim_to_the_screen();
				}
						
				//cut away the screen region
				if (cut_out_screen == "yes"){
					cut_screen();
				}
				
			}
			
			//*** add specialized elements for special configurations - like a snap-in keyguard to a keyguard frame
			
			// add snap-in tabs
			if (have_a_keyguard_frame=="yes" && trim_to_screen == "no"){
				add_snap_ins();
			}
			
			// add mounting posts and small tabs
			if(have_a_case=="yes" && m_m=="Posts"){
				add_mounting_posts();
			}
			
			//add the posts themselves
			if(have_a_case=="yes" && have_a_keyguard_frame=="yes" && mount_keyguard_with=="posts"){
				add_keyguard_frame_posts();
			}	
		}
		//*** last minute cuts
		
		//splitting the keyguard
		if (generate=="first half of keyguard" || generate=="second half of keyguard"){
			split_keyguard();
		}
		
		//trim down to the first two layers
		if (first_two_layers_only=="yes"){
			translate([0,0,50-kt/2+0.4])
			cube([1000,1000,100],center=true);
		}
	}
}


// create 2D image of keyguard for laser cutting
module lc_keyguard(cheat){
	unequal_opening = (have_a_keyguard_frame=="no") ? [-unequal_left_side_offset,-unequal_bottom_side_offset,0] : [0,0,0];
	
	difference(){
		union(){
			difference(){
				union(){
					difference(){
						//slide case opening plastic based on unequal case opening settings
						translate(unequal_opening)
						//base keyguard with  manual  and customizer mounting points and some added plastic in case region, no grid
						difference(){ // here only for consistency with keyguard()
							union(){
								//base object: tablet body slab or case opening along with case additions if any that can be chamfered
								base_keyguard(kw,kh,kcr,0,"no");
													
								//add slide-in & raised tabs
								if (have_a_case=="yes" && have_a_keyguard_frame=="no" && (m_m=="Slide-in Tabs" || m_m=="Raised Tabs")){
									case_mounts(0);
								}
								
								// adding manual slide-in tabs and pedestals for clip-on straps
								if(have_a_case=="yes" && len(case_additions)>0 && !(have_a_keyguard_frame=="yes" && generate=="keyguard" && cheat=="no")){
									add_flex_height_shapes(case_additions);
								}
							}
							//*** cut away from keyguard blank those things that will be moved when the case opening is unequal

							// cut case openings
							if(have_a_case=="yes" && len(case_openings)>0 && !(have_a_keyguard_frame=="yes" && generate=="keyguard")){
								cut_case_openings(case_openings,0);
							}
							
							//*** cut away from keyguard blank those things that will be moved when the case opening is unequal
							
							// nothing of this type to delete for a laser-cut keyguard
							
						} // here only for consistency with keyguard()
						
						//*** cut things/areas that are part of the screen area and unaffected by unequal case opening
						
						//cut bars and grid cells - which doesn't move with unequal case opening
						if (column_count>0 && row_count>0){
							bars(0);
						}
						
						if (column_count>0 && row_count>0){
							translate([0,0,0])
							cells(0);
						}
						
						//home button and camera are cut for both case and no_case configurations
						if (have_a_keyguard_frame=="no" ){
							home_camera(0);
							
							if(add_symmetric_openings=="yes" && unequal_left_side_offset==0 && unequal_bottom_side_offset==0){
								rotate([0,0,180])
								home_camera(0);
							}
						}
					
						// make cuts associated with the tablet like ALS openings and symmetric camera/home button slots that are as deep as the keyguard
						//          - can affect slide-in tabs and raised tabs (in particular)
						if (expose_ambient_light_sensors=="yes" && len(tto)>0 && have_a_keyguard_frame=="no" ){
							cut_tablet_openings(tto,0);
							
							if(add_symmetric_openings=="yes"){
								rotate([0,0,180])
								cut_tablet_openings(tto,0);
							}
						}
						
						//cut screen openings
						if(len(screen_openings)>0 && type_of_tablet!="blank"){
							cut_screen_openings(screen_openings,0);
						}
					}
					
					//*** add items screen elements  and case elements that will override screen cutouts
					
					// nothing of this type to add for a laser-cut keyguard
					
				}
				//*** add cuts that should override anything added to the screen
				
				// nothing of this type to delete for a laser-cut keyguard
				
			}
			
			//*** add specialized elements for special configurations - like a snap-in keyguard to a keyguard frame
			
			// nothing of this type to add for a laser-cut keyguard

		}
		//*** last minute cuts
		
		// nothing of this type to delete for a laser-cut keyguard

		
	}
}


module keyguard_frame(cheat){
	if (have_a_case=="yes" && have_a_keyguard_frame=="yes"){
		difference(){
			translate([-unequal_left_side_offset,-unequal_bottom_side_offset,0])
			difference(){
				union(){
					if (m_m=="Shelf") {
						shelf_height = coh+2*shelf_depth;
						shelf_width = cow+2*shelf_depth;
						shelf_corner_radius = tablet_corner_radius;
		
						translate([0 ,0,-keyguard_frame_thickness/2])
						linear_extrude(height=st)
						build_addition(shelf_width, shelf_height, "crr", shelf_corner_radius);
					}
					base_keyguard(cow,coh,cocr,keyguard_frame_thickness,"no");

					case_mounts(keyguard_frame_thickness);
												
					if (len(case_openings)>0){
						adding_plastic(case_openings,"case");
					}
					// adding manual slide-in tabs and pedestals for clip-on straps
					if(len(case_additions)>0){
						if (have_a_keyguard_frame=="no" || 
						   (have_a_keyguard_frame=="yes" && generate=="keyguard frame" && cheat=="no")
						   ){
						   
							add_manual_mount_slide_in_tabs(case_additions);
							
							if(type_of_keyguard!="Laser-Cut"){
								add_manual_mount_pedestals(case_additions);
							}
						}
					}
					
					//add bumps and ridges from case_openings file
					// not supported

					//add engraved text
					// not supported
				}
				
				//cut case openings
				if(len(case_openings)>0){
					cut_case_openings(case_openings,keyguard_frame_thickness);
				}
				
				if (m_m=="Clip-on Straps"){
					clip_on_straps_groove();
				}
				
				// add slots to manually added clip-on strap pedestals
				if(len(case_additions)>0 && type_of_keyguard!="Laser-Cut" && cheat=="no"){
					cut_manual_mount_pedestal_slots(case_additions);
				}
			}

			// cut_out_opening for keyguard
			hole_cutter(keyguard_width,keyguard_height,90,90,90,90,kcr,keyguard_frame_thickness);
			
			//cut clip-on strap pedestals (manual or otherwise) if they extend into the space for the keyguard
			// translate([0,0,keyguard_frame_thickness/2+pedestal_height/2-fudge])
			translate([0,0,keyguard_frame_thickness/2])
			linear_extrude(height=pedestal_height+10)
			offset(r=kcr)
			square([keyguard_width+cec*2-kcr*2,keyguard_height+cec*2-kcr*2], center=true);

			// cut slots for snap-in tabs on keyguard edges
			snap_in_tab_grooves();
			
				
			//camera and home button openings
			home_camera(keyguard_frame_thickness);
			
			//tablet openings for ALS
			if(expose_ambient_light_sensors=="yes" && len(tto)>0){
				cut_tablet_openings(tto,keyguard_frame_thickness);
				
				if(add_symmetric_openings=="yes" && unequal_left_side_offset==0 && unequal_bottom_side_offset==0 && have_a_keyguard_frame=="no"){
					rotate([0,0,180])
					cut_tablet_openings(tto,keyguard_frame_thickness);
				}
			}
			
			if (mount_keyguard_with=="posts"){
				post_cl = (expose_upper_message_bar == "yes" && expose_upper_command_bar == "yes") ? shm/2-sbhm-umbhm-ucbhm :
						  (expose_upper_message_bar == "yes" && expose_upper_command_bar == "no") ? shm/2-sbhm-umbhm :	
						  shm/2-sbhm;

				translate([keyguard_width/2+post_len/2-fudge,post_cl,-keyguard_frame_thickness/2-fudge])
				add_keyguard_frame_post_slots();

				translate([keyguard_width/2+post_len/2-fudge,-post_cl,-keyguard_frame_thickness/2-fudge])
				add_keyguard_frame_post_slots();
				
				translate([-keyguard_width/2-post_len/2+fudge,post_cl,-keyguard_frame_thickness/2-fudge])
				add_keyguard_frame_post_slots();
				
				translate([-keyguard_width/2-post_len/2+fudge,-post_cl,-keyguard_frame_thickness/2-fudge])
				add_keyguard_frame_post_slots();
			}
		}
	}
}


module add_keyguard_frame_post_slots(){
	hole_dia = kt - post_tightness_of_fit/10;

	translate([0,0,(hole_dia/2)/2])
	cube([post_len+.5,hole_dia,hole_dia/2],center=true);

	translate([0,0,(hole_dia)/2])
	rotate([0,90,0])
	cylinder(d=hole_dia,h=post_len+.5,center=true);
}


module add_keyguard_frame_posts(){
	post_dia = kt;
	post_cl = (expose_upper_message_bar == "yes" && expose_upper_command_bar == "yes") ? shm/2-sbhm-umbhm-ucbhm+kt/2 :
              (expose_upper_message_bar == "yes" && expose_upper_command_bar == "no") ? shm/2-sbhm-umbhm+kt/2 :	
			  shm/2-sbhm+kt/2;
	post_l = kw+post_len*2;
	
	translate([0,post_cl-kt/2,0])
	rotate([0,90,0])
	cylinder(d=post_dia,h=post_l,center=true);
}


module trim_keyguard_to_bar(){				
	post_cl = (expose_upper_message_bar == "yes" && expose_upper_command_bar == "yes") ? shm/2-sbhm-umbhm-ucbhm :
              (expose_upper_message_bar == "yes" && expose_upper_command_bar == "no") ? shm/2-sbhm-umbhm :	
			  shm/2-sbhm;

	//remove top portion of keyguard
	translate([0,50+post_cl,0])
	cube([keyguard_width+10,100,kt+10],center=true);
}


module add_mounting_posts(){	
	p_l = (expose_status_bar=="yes" || expose_upper_message_bar=="yes") ? post_length : width_of_opening_in_case+post_length*2;
	
	bdr = (cow-swm)/2;

	post_height = coh/2 - mount_to_top_of_opening_distance;
	post_len_r = p_l + bdr + rec;
	post_len_l = p_l + bdr + lec;
	
	post_r0 = cow/2 + post_len_r/2 -bdr - rec;
	post_l0 = -cow/2 - post_len_l/2 + bdr + lec;
	
	cut_angle = 17;
	offset_angle = 38;
	ofset = post_diameter/2 * sin(offset_angle);

	if (p_l > 0){
	
		if (expose_status_bar=="yes" || expose_upper_message_bar=="yes"){
			translate([post_l0,post_height,(post_diameter-kt)/2])
			rotate([-cut_angle,0,0])
			difference(){
				rotate([0,90,0])
				cylinder(d=post_diameter,h=post_len_l,center=true);
			
				if (notch_in_post=="yes"){
					translate([-20+(p_l+bdr-lec)/2-bdr,10+ofset,0])
					cube([40,20,20],center=true);
				}
			}

			translate([post_r0,post_height,(post_diameter-kt)/2])
			rotate([-cut_angle,0,0])
			difference(){
				rotate([0,90,0])
				cylinder(d=post_diameter,h=post_len_r,center=true);
			
				if (notch_in_post=="yes"){
					translate([20-(p_l+bdr-rec)/2+bdr,10+ofset,0])
					cube([40,20,20],center=true);
				}
			}
		}
		else{
			translate([0,post_height,(post_diameter-kt)/2])
			rotate([0,90,0])
			cylinder(d=post_diameter,h=p_l,center=true);
		}
	}
	
	if(add_mini_tabs == "yes"){
		tabs = [
			[1, mini_tab_inset_distance+mini_tab_width/2,  0,  mini_tab_width,   mini_tab_length,  "rr3",  1, -999, -999, -999, -999, mini_tab_length/2],
			[2, cow-mini_tab_inset_distance-mini_tab_width/2,  0,  mini_tab_width,   mini_tab_length,  "rr3",  1, -999, -999, -999, -999, mini_tab_length/2],
		];
		
		translate([0,0,min(mini_tab_height,keyguard_thickness-2)])
		add_flex_height_shapes(tabs);
	}
}

module split_keyguard(){
	half = (generate == "first half of keyguard") ? "first" : "second";
	
	if (orientation=="landscape"){
		maskwidth = (have_a_case == "no") ? tablet_width : kw;
		maskheight = (have_a_case == "no") ? tablet_height : kh;
		
		if (split_line_location==0 && row_count > 0 && column_count > 0){
			odd_num_columns = column_count/2 - floor(column_count/2) > 0;
			max_cell_w=grid_width/column_count;
			cut_line = (odd_num_columns) ? 
				(column_count/2 + 0.5)*max_cell_w :
				(column_count/2)*max_cell_w;
			split_x0 = (generate=="first half of keyguard")?
				grid_x0+cut_line:
				grid_x0+cut_line-(maskwidth*2);
			if (split_line_type=="flat"){
				translate([maskwidth+split_x0,0,0])
				cube([maskwidth*2,maskheight*2,100],center=true);
			}
			else{
				translate([maskwidth+split_x0-1,0,0])
				difference(){
					union(){
						cube([maskwidth*2,maskheight*2,100],center=true);
						translate([maskwidth+1-fudge,0,0])
						rotate([0,0,90])
						dovetails(half);
					}
					translate([-maskwidth+1-fudge,0,0])
					rotate([0,0,90])
					dovetails(half);
				}
			}
		}
		else{
			split_x0 = (generate=="first half of keyguard")? (maskwidth*2)/2 + split_line_location : -(maskwidth*2)/2 + split_line_location;
			if (split_line_type=="flat"){
				translate([split_x0,0,0])
				cube([maskwidth*2,maskheight*2,100],center=true);
			}
			else{
				translate([split_x0-1,0,0])
				difference(){
					union(){
						cube([maskwidth*2,maskheight*2,100],center=true);
						translate([maskwidth+1-fudge,0,0])
						rotate([0,0,90])
						dovetails(half);
					}
					translate([-maskwidth+1-fudge,0,0])
					rotate([0,0,90])
					dovetails(half);
				}
			}
		}
	}
	else{
		maskwidth = (have_a_case == "no") ? tablet_width : kw;
		maskheight = (have_a_case == "no") ? tablet_height : kh;

		if (split_line_location==0 && row_count > 0 && column_count > 0){
			odd_num_rows = row_count/2 - floor(row_count/2) > 0;
			max_cell_h=grid_height/row_count;
			cut_line = (odd_num_rows) ? 
				(row_count/2 + 0.5)*max_cell_h :
				(row_count/2)*max_cell_h;
				
			split_y0 = (generate=="first half of keyguard")? -maskwidth+grid_y0+cut_line : maskwidth+grid_y0+cut_line;

			if (split_line_type=="flat"){
				translate([0,split_y0,0])
				cube([maskheight*2,maskwidth*2,100],center=true);
			}
			else{
				translate([0,split_y0+0.5,0])
				difference(){
					union(){
						cube([maskheight*2,maskwidth*2,100],center=true);
						translate([0,-maskwidth+fudge,0])
						rotate([0,0,0])
						dovetails(half);
					}
					translate([0,maskwidth+fudge,0])
					rotate([0,0,0])
					dovetails(half);
				}
			}
		}
		else{
			split_y0 = (generate=="first half of keyguard")? -(maskwidth*2)/2 + split_line_location : (maskwidth*2)/2 + split_line_location;
			if (split_line_type=="flat"){
				translate([0,split_y0,0])
				cube([maskheight*2,maskwidth*2,100],center=true);
			}
			else{
				translate([0,split_y0+1,0])
				difference(){
					union(){
						cube([maskheight*2,maskwidth*2,100],center=true);
						translate([0,-maskwidth-1+fudge,0])
						rotate([0,0,0])
						dovetails(half);
					}
					translate([0,maskwidth-1-fudge,0])
					rotate([0,0,0])
					dovetails(half);
				}
			}
		}
	}
}

module split_keyguard_frame(half){
	maskwidth = cow;
	maskheight = coh;
		
	split_x0 = (half=="first")? maskwidth + split_line_location : -maskwidth + split_line_location;
	if (split_line_type=="flat"){
		translate([split_x0,0,0])
		cube([maskwidth*2,maskheight*2,100],center=true);
	}
	else{
		translate([split_x0-1,0,0])
		difference(){
			union(){
				cube([maskwidth*2,maskheight*2,100],center=true);
				translate([maskwidth+1-fudge,0,0])
				rotate([0,0,90])
				dovetails(half);
			}
			translate([-maskwidth+1-fudge,0,0])
			rotate([0,0,90])
			dovetails(half);
		}
	}
}

module dovetails(half){
	targetIntvlLen = approx_dovetail_width*3/2;
	cutLen = (have_a_case=="no") ? tablet_height+fudge*2 : 
			 (len(case_additions)>0) ? kh*2+fudge*2 : kh+fudge*2;
	doveTailCount = floor(cutLen/(targetIntvlLen));
	intvLen=(cutLen/doveTailCount);
	doveTailWidth=(intvLen+2)/2;
	doveTailHeight = 100;
	gap = (half == "first") ? -(tightness_of_dovetail_joint - 5)/10 : 0;
	for (i=[-cutLen/2+doveTailWidth/2-1:doveTailWidth*2-2:cutLen/2]){
		translate([i,-1,-doveTailHeight/2])
		linear_extrude(height=doveTailHeight)
		polygon([[0+gap,0],[doveTailWidth-gap,0],[doveTailWidth-1-gap,2],[1+gap,2]]);
	}
}

module case_mounts(depth) {
	//add mounting points for cases
	if (m_m=="Slide-in Tabs"){
		if (depth>0){
			translate([0,0,-depth/2])
			linear_extrude(height = slide_in_tab_thickness)
			add_2d_slide_in_tabs();
		}
		else{
			add_2d_slide_in_tabs();
		}
	}
	else if (m_m=="Raised Tabs" && type_of_keyguard=="3D-Printed" && depth > 0){
		add_raised_tabs(depth);
	}
	else if (m_m=="Clip-on Straps" && type_of_keyguard=="3D-Printed" && depth > 0){
		add_clip_on_strap_pedestals(depth);
	}
}

module add_2d_slide_in_tabs() {
	h_sitlen = horizontal_slide_in_tab_length_incl_acrylic;
	v_sitlen = vertical_slide_in_tab_length_incl_acrylic;
	h_sitwid = horizontal_slide_in_tab_width;
	v_sitwid = vertical_slide_in_tab_width;
	h_sitdist = distance_between_horizontal_slide_in_tabs;
	v_sitdist = distance_between_vertical_slide_in_tabs;
		
	if(slide_in_tab_locations == "horizontal only" || slide_in_tab_locations == "horizontal and vertical"){
		left_slide_in_tab_offset = -w/2+fudge;
		
		translate([left_slide_in_tab_offset,-h_sitdist/2-h_sitwid/2+ulbs])
		mirror([1,0,0])
		create_2D_slide_in_tab(h_sitlen,h_sitwid);
		
		translate([left_slide_in_tab_offset,h_sitdist/2+h_sitwid/2+ulbs])
		mirror([1,0,0])
		create_2D_slide_in_tab(h_sitlen,h_sitwid);
		
		right_slide_in_tab_offset = w/2-fudge;
		
		translate([right_slide_in_tab_offset,-h_sitdist/2-h_sitwid/2+ulbs])
		create_2D_slide_in_tab(h_sitlen,h_sitwid);

		translate([right_slide_in_tab_offset,h_sitdist/2+h_sitwid/2+ulbs])
		create_2D_slide_in_tab(h_sitlen,h_sitwid);
	}
	if(slide_in_tab_locations == "vertical only" || slide_in_tab_locations == "horizontal and vertical"){
		bottom_slide_in_tab_offset = -h/2+fudge;
		
		translate([-v_sitdist/2-v_sitwid/2+ulos, bottom_slide_in_tab_offset])
		rotate([0,0,-90])
		create_2D_slide_in_tab(v_sitlen,v_sitwid);

		translate([v_sitdist/2+v_sitwid/2+ulos,bottom_slide_in_tab_offset])
		rotate([0,0,-90])
		create_2D_slide_in_tab(v_sitlen,v_sitwid);

		top_slide_in_tab_offset = h/2-fudge;

		translate([-v_sitdist/2-v_sitwid/2+ulos, top_slide_in_tab_offset])
		rotate([0,0,90])
		create_2D_slide_in_tab(v_sitlen,v_sitwid);

		translate([v_sitdist/2+v_sitwid/2+ulos, top_slide_in_tab_offset])
		rotate([0,0,90])
		create_2D_slide_in_tab(v_sitlen,v_sitwid);
	}
}

module create_2D_slide_in_tab(tab_length,tab_width){
	x1_offset = -tab_length/2;
	x2_offset = tab_length/2-2;
	
	translate([x2_offset,0,0])
	difference(){
		offset(r=2)
		square([tab_length,tab_width-4],center=true);
		
		translate([x1_offset,0,0])
		square([4,tab_width+2],center=true);
	}
	
	if (tab_length>=3){
		translate([1.5,tab_width/2+1.44,0])
		difference(){
			square(3,center=true);
			circle(d=3);
			
			translate([.75,0,0])
			square([1.51,3.01],center=true);
			
			translate([0,.75,0])
			square([3.01,1.51],center=true);
		}
		
		translate([1.5,-tab_width/2-1.44,0])
		difference(){
			square(3,center=true);
			circle(d=3);
			
			translate([.75,0,0])
			square([1.51,3.01],center=true);
			
			translate([0,-.75,0])
			square([3.01,1.51],center=true);
		}
	}
}

module add_clip_on_strap_pedestals(depth){
	if(clip_locations=="horizontal only" || clip_locations=="horizontal and vertical"){
		translate([-w/2+4.3, -distance_between_horizontal_clips/2-horizontal_pedestal_width/2+4+ulbs, depth/2])
		linear_extrude(height=pedestal_height,scale=.8)
		square([7,horizontal_pedestal_width],center=true);
				
		translate([-w/2+4.3 , distance_between_horizontal_clips/2+horizontal_pedestal_width/2-4+ulbs, depth/2])
		linear_extrude(height=pedestal_height,scale=.8)
		square([7,horizontal_pedestal_width],center=true);
		
		translate([w/2-4.3, -distance_between_horizontal_clips/2-horizontal_pedestal_width/2+4+ulbs, depth/2])
		linear_extrude(height=pedestal_height,scale=.8)
		square([7,horizontal_pedestal_width],center=true);
		
		translate([w/2-4.3, distance_between_horizontal_clips/2+horizontal_pedestal_width/2-4+ulbs, depth/2])
		linear_extrude(height=pedestal_height,scale=.8)
		square([7,horizontal_pedestal_width],center=true);
	}
	if(clip_locations=="vertical only" || clip_locations=="horizontal and vertical"){
		translate([-distance_between_vertical_clips/2-vertical_pedestal_width/2+4+ulos, -h/2+4.3, depth/2])
		linear_extrude(height=pedestal_height,scale=.8)
		square([vertical_pedestal_width,7],center=true);
		
		translate([distance_between_vertical_clips/2+vertical_pedestal_width/2-4+ulos, -h/2+4.3, depth/2])
		linear_extrude(height=pedestal_height,scale=.8)
		square([vertical_pedestal_width,7],center=true);
		
		translate([-distance_between_vertical_clips/2-vertical_pedestal_width/2+4+ulos, h/2-4.3, depth/2])
		linear_extrude(height=pedestal_height,scale=.8)
		square([vertical_pedestal_width,7],center=true);
		
		translate([distance_between_vertical_clips/2+vertical_pedestal_width/2-4+ulos, h/2-4.3 , depth/2])
		linear_extrude(height=pedestal_height,scale=.8)
		square([vertical_pedestal_width,7],center=true);
	}
}



module add_raised_tabs(depth) {
	s = (starting_height < depth - 1) ? starting_height : depth - 1;
	
	dim = (orientation=="landscape") ? w : h;
	r = (orientation=="landscape") ? 0 : 90;
	
	rotate([0,0,r])
	union(){
		translate([-dim/2, -raised_tab_width-distance_between_raised_tabs/2+ulbs, -depth/2+s])
		mirror([1,0,0])
		raised_tab(depth);

		translate([-dim/2, distance_between_raised_tabs/2+ulbs, -depth/2+s])
		mirror([1,0,0])
		raised_tab(depth);

		translate([dim/2, -raised_tab_width-distance_between_raised_tabs/2+ulbs, -depth/2+s])
		raised_tab(depth);
		
		translate([dim/2, distance_between_raised_tabs/2+ulbs, -depth/2+s])
		raised_tab(depth);
	}
}

module raised_tab(depth){
    a = raised_tab_length;
    b = raised_tab_height;
    s = (starting_height < depth - 1) ? starting_height : depth - 1;
    angle = ramp_angle;
    e = min((depth-s+1)*cos(angle),preferred_raised_tab_thickness);
    r_h = a * tan(angle);
        
    // magnet variables
    ml = (magnet_size=="20 x 8 x 1.5") ? 20 : 
         (magnet_size=="40 x 10 x 2") ? 40 : 
         0;
         
    mw = (magnet_size=="20 x 8 x 1.5") ? 8 : 
         (magnet_size=="40 x 10 x 2") ? 10 : 
         0;

    mh = (magnet_size=="20 x 8 x 1.5") ? 1.5 : 
         (magnet_size=="40 x 10 x 2") ? 2 : 
         0;

    // Velcro dot variables
    velcro_dot_diameter = 16;
    velcro_dot_depth = 1.3;
         
    th1 = (embed_magnets=="no" && use_velcro_dots=="no") ? e : 
          (embed_magnets=="yes") ? max(e, mh+1) :
          max(e, velcro_dot_depth+1);

    if (r_h > b){  //tread exists
        f = (sin(angle)!=0) ? (b-s)/sin(angle) : a;
        h1 = (b-s)/tan(angle);
        tangle = 90-(180-angle)/2;
        x = sin(tangle)*e;
        g = a - h1 + x;
        r = f + x;
        
        difference(){
            union(){
                difference(){
                    rotate([0,-angle,0])
                    translate([-2,0,0])
                    cube([r+2,raised_tab_width,e]);
                
                    translate([-5,-fudge,-5])
                    cube([5,raised_tab_width+2*fudge,5]);
                }
                    
                translate([h1-x-50*fudge,0,b-s])
                difference(){
                    union(){
                        cube([g-2.5,raised_tab_width,th1]);
                        
                        translate([g-2.5,2.5,0])
                        cube([2.5,raised_tab_width-5,th1]);
                        
                        translate([g-2.5,0,0])
                        difference(){
                            union(){
                                translate([0,2.5,0])
                                cylinder(h=th1,r=2.5);
                                
                                translate([0,raised_tab_width-2.5,0])
                                cylinder(h=th1,r=2.5);
                            }
                            translate([-6,-fudge,-fudge])
                            cube([6,raised_tab_width+2*fudge,th1+2*fudge]);
                        }
                    }
            
                    translate([g+fudge,0,th1/2])
                    rotate([0,-45,0])
                    cube([th1,raised_tab_width,th1]);
                }
            }
            
            if(embed_magnets=="yes"){
                translate([h1-x+2,(raised_tab_width-ml)/2,b-s+.4])
                union(){
                    cube([mw,ml+(raised_tab_width-ml)/2+1,mh]);
                    #cube([mw,ml,mh]);
                }
            }
            else if(use_velcro_dots=="yes") {
                translate([h1-x+velcro_dot_diameter/1.45,raised_tab_width/2,b-s])
                cylinder(d=velcro_dot_diameter, h=velcro_dot_depth + fudge);
            }
            
            translate([-6,-fudge,depth-s])
            cube([5,raised_tab_width+2*fudge,5]);
            
            translate([0,-fudge,e])
            rotate([0,-ramp_angle,0])
            translate([-5,0,0])
            cube([r+10,raised_tab_width+2*fudge,3]);
        }
    }
    else{ // tread doesn't exist
        h1 = a;
        f = h1/cos(angle);
        
        difference(){
            rotate([0,-angle,0])
            difference(){
                union(){
                    translate([-2,0,0])
                    cube([f+2-2.5,raised_tab_width,th1+1]);
                    
                    translate([f-2.5,2.5,0])
                    cube([2.5,raised_tab_width-5,th1+1]);
                    
                    translate([f-2.5,2.5,0])
                    cylinder(h=th1+1,r=2.5);
                
                    translate([f-2.5,raised_tab_width-2.5,0])
                    cylinder(h=th1+1,r=2.5);
                }
                
                translate([f+fudge,0,(th1+1)/2])
                rotate([0,-45,0])
                cube([th1+1,raised_tab_width,th1+1]);
                
                translate([-th1-1+2-fudge,-fudge,depth/2])
                rotate([0,-45,0])
                cube([th1+1,raised_tab_width+2*fudge,th1+1]);
                
                if(embed_magnets=="yes"){
                    translate([2,(raised_tab_width-ml)/2,.6])
                    union(){
                        cube([mw+.5,ml+(raised_tab_width-ml)/2-.5,mh+.5]);
                        #cube([mw+.5,ml,mh+.5]);
                        translate([(mw-1)/2,0,0])
                        cube([1,ml+(raised_tab_width-ml)/2+1,mh+.5]);
                    }
                }
                else if(use_velcro_dots=="yes") {
                    translate([velcro_dot_diameter,raised_tab_width/2,0])
                    cylinder(d=velcro_dot_diameter, h=velcro_dot_depth + fudge);
                }
            }
            
            translate([-5,-fudge,-5])
            cube([5,raised_tab_width+2*fudge,5]);
            
            translate([-5-1.25,-fudge,depth/2-.5])
            cube([5,raised_tab_width+2*fudge,5]);
        }
    }
}

module create_cutting_tool(rotation,diameter,thickness,slope,type){
	rotate([0,0,rotation])
	difference(){
		translate([0,0,-thickness/2-fudge/2])
		cube(size=[diameter/2+fudge*2,diameter/2+fudge*2,thickness+fudge]);
		intersection(){
			cylinder(h=thickness+fudge*4,r1=diameter/2,r2=diameter/2-(thickness/tan(slope)),center=true);
			if (type=="oa" && type_of_keyguard=="3D-Printed"){ //outer arcs are chamfered
				chamfer_circle_radius1 = diameter/2+(tan(45)*(thickness-.6)); // bottom radius
				chamfer_circle_radius2 = diameter/2 -.6; //top radius
				cylinder(h=thickness+fudge*2,r1=chamfer_circle_radius1,r2=chamfer_circle_radius2,center=true);
			}
		}
	}
}

module create_cutting_tool_2d(rotation,diameter){
	rotate([0,0,rotation])
	difference(){
		translate([0,0])
		square([diameter/2+fudge*2,diameter/2+fudge*2]);

		circle(r=diameter/2);
	}
}

module home_camera(depth){
	//deal with home button
	if (home_button_location!=0 && expose_home_button=="yes" && home_button_height > 0 && home_button_width > 0){
		translate([home_x_loc,home_y_loc,0])
		if (home_button_height==home_button_width){
			if(home_button_location==2 || home_button_location==4){
				hole_cutter(home_button_height,home_button_height,hbes,hbes,90,90,home_button_height/2,depth);
			}
			else{
				hole_cutter(home_button_height,home_button_height,90,90,hbes,hbes,home_button_height/2,depth);
			}
		}
		else{
			m = min(home_button_width,home_button_height);
			if(home_button_location==2 || home_button_location==4){
				hole_cutter(home_button_width,home_button_height,hbes,hbes,90,90,m/2,depth);
			}
			else{
				hole_cutter(home_button_width,home_button_height,90,90,hbes,hbes,m/2,depth);
			}
		}
	}
	//deal with camera
	coa = camera_offset_acrylic;
	if (camera_location!=0 && expose_camera=="yes" && camera_height > 0 && camera_width > 0){
		translate([cam_x_loc,cam_y_loc,0])
		if (camera_height==camera_width){
			if (type_of_keyguard=="3D-Printed"){
				hole_cutter(camera_height,camera_height,camera_cut_angle,camera_cut_angle,camera_cut_angle,camera_cut_angle,camera_height/2,depth);
			}
			else{
				hole_cutter(camera_height+coa*2,camera_height+coa*2,90,90,90,90,(camera_height+coa*2)/2,depth);
			}
		}
		else{
			if (type_of_keyguard=="3D-Printed"){
				m = min(camera_width,camera_height);
				hole_cutter(camera_width,camera_height,camera_cut_angle,camera_cut_angle,camera_cut_angle,camera_cut_angle,m/2,depth);
			}
			else{
				m = min(camera_width,camera_height);
				hole_cutter(camera_width+coa*2,camera_height+coa*2,90,90,90,90,(m+coa*2)/2,depth);
			}
		}
	}
}

module mounting_points(){
	if (m_m=="Suction Cups"){
		suction_cups();
	}
	else if (m_m=="Velcro"){
		velcro();
	}
	else if (m_m=="Screw-on Straps"){
		screw_on_straps();
	}
	else if (m_m=="Clip-on Straps"){
		clip_on_straps_groove();
	}
	else {
		//No Mount option
	}
}

module suction_cups(){
	major_dim = max(tablet_width,tablet_height);

	translate([-major_dim/2+left_border_width/2, 40, 0])
	cylinder(h=kt*3, d=7.5, center=true);
	translate([-major_dim/2+left_border_width/2, 40-5, 0])
	cylinder(h=kt*3, d=4.5, center=true);
	
	translate([-major_dim/2+left_border_width/2, -40, 0])
	cylinder(h=kt*3, d=7.5, center=true);
	translate([-major_dim/2+left_border_width/2, -40+5, 0])
	cylinder(h=kt*3, d=4.5, center=true);
	
	translate([major_dim/2-right_border_width/2, 40, 0])
	cylinder(h=kt*3, d=7.5, center=true);
	translate([major_dim/2-right_border_width/2, 40-5, 0])
	cylinder(h=kt*3, d=4.5, center=true);
	
	translate([major_dim/2-right_border_width/2, -40, 0])
	cylinder(h=kt*3, d=7.5, center=true);
	translate([major_dim/2-right_border_width/2, -40+5, 0])
	cylinder(h=kt*3, d=4.5, center=true);
	
	translate([-major_dim/2+left_border_width/2-5, 30.5,-kt/2+2])
	cube(size=[10,15,kt]);
	
	translate([-major_dim/2+left_border_width/2-5, -45.5,-kt/2+2])
	cube(size=[10,15,kt]);

	translate([major_dim/2-right_border_width/2-5, 30.5,-kt/2+2])
	cube(size=[10,15,kt]);
	
	translate([major_dim/2-right_border_width/2-5, -45.5,-kt/2+2])
	cube(size=[10,15,kt]);
}

module velcro(){
	major_dim = max(tablet_width,tablet_height);

	//create recessed shapes on the bottom of the surround to mount velcro
	if (m_m=="Velcro"){
		if (velcro_size<=3){ //round velcros
			translate([-major_dim/2+velcro_diameter/2+2, 30, -kt/2+.5])
			cylinder(h=2.5, d=velcro_diameter, center=true);
			
			translate([-major_dim/2+velcro_diameter/2+2, -30, -kt/2+.5])
			cylinder(h=2.5, d=velcro_diameter, center=true);
			
			translate([major_dim/2-velcro_diameter/2-2, 30, -kt/2+.5])
			cylinder(h=2.5, d=velcro_diameter, center=true);
			
			translate([major_dim/2-velcro_diameter/2-2, -30, -kt/2+.5])
			cylinder(h=2.5, d=velcro_diameter, center=true);
		}
		else{ //square velcros
			translate([-major_dim/2+velcro_diameter/2+2, 30, -kt/2+.5])
			cube(size=[velcro_diameter,velcro_diameter,2.5],center=true);
			
			translate([-major_dim/2+velcro_diameter/2+2, -30, -kt/2+.5])
			cube(size=[velcro_diameter,velcro_diameter,2.5],center=true);
			
			translate([major_dim/2-velcro_diameter/2-2, 30, -kt/2+.5])
			cube(size=[velcro_diameter,velcro_diameter,2.5],center=true);
			
			translate([major_dim/2-velcro_diameter/2-2, -30, -kt/2+.5])
			cube(size=[velcro_diameter,velcro_diameter,2.5],center=true);
		}
	}
}

module screw_on_straps(){
	major_dim = max(tablet_width,tablet_height);

	//drill holes for screw-on straps and cut slots if needed for thick keyguards
	if (strap_cut_to_depth<kt) {  //cuts slot and flanges (the cylinders) for Keyguard AT's acrylic tabs
		translate([-major_dim/2-1,34.5,-kt/2+strap_cut_to_depth])
		cube(size=[12,11,kt]);
		translate([-major_dim/2-1,34.5,-kt/2+strap_cut_to_depth])
		cylinder(h=kt,d=7,$fn=3);
		translate([-major_dim/2-1,45.5,-kt/2+strap_cut_to_depth])
		cylinder(h=kt,d=7,$fn=3);
		
		translate([-major_dim/2-1,-45.5,-kt/2+strap_cut_to_depth])
		cube(size=[12,11,kt]);
		translate([-major_dim/2-1,-45.5,-kt/2+strap_cut_to_depth])
		cylinder(h=kt,d=7,$fn=3);
		translate([-major_dim/2-1,-34.5,-kt/2+strap_cut_to_depth])
		cylinder(h=kt,d=7,$fn=3);

		translate([major_dim/2-11,34.5,-kt/2+strap_cut_to_depth])
		cube(size=[12,11,kt]);
		translate([major_dim/2,34.5,-kt/2+strap_cut_to_depth])
		rotate([0,0,180])
		cylinder(h=kt,d=7,$fn=3);
		translate([major_dim/2,45.5,-kt/2+strap_cut_to_depth])
		rotate([0,0,180])
		cylinder(h=kt,d=7,$fn=3);
		
		translate([major_dim/2-11,-45.5,-kt/2+strap_cut_to_depth])
		cube(size=[12,11,kt]);
		translate([major_dim/2,-45.5,-kt/2+strap_cut_to_depth])
		rotate([0,0,180])
		cylinder(h=kt,d=7,$fn=3);
		translate([major_dim/2,-34.5,-kt/2+strap_cut_to_depth])
		rotate([0,0,180])
		cylinder(h=kt,d=7,$fn=3);
	}
	//cut holes for screw
	translate([-major_dim/2+5.5, 40, -kt/2])
	cylinder(h=kt*3, d=6, center=true);
	
	translate([-major_dim/2+5.5, - 40, -kt/2])
	cylinder(h=kt*3, d=6, center=true);
	
	translate([major_dim/2-5.5, 40, -kt/2])
	cylinder(h=kt*3, d=6, center=true);
	
	translate([major_dim/2-5.5, -40, -kt/2])
	cylinder(h=kt*3, d=6, center=true);
}

module clip_on_straps_groove(){
	w1 = (have_a_case=="no") ? tablet_width :cow;
	h1 = (have_a_case=="no") ? tablet_height : coh;
	x0 = -w1/2;
	y0 = -h1/2;
	
	if(clip_locations=="horizontal only" || clip_locations =="horizontal and vertical"){
		translate([x0+2, -distance_between_horizontal_clips/2+ulbs, vertical_offset])
		rotate([90,0,0])
		linear_extrude(height = horizontal_slot_width)
		polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
		
		translate([x0+2, distance_between_horizontal_clips/2+horizontal_slot_width+ulbs, vertical_offset])
		rotate([90,0,0])
		linear_extrude(height = horizontal_slot_width)
		polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
		
		translate([-x0-5, -distance_between_horizontal_clips/2+ulbs, vertical_offset])
		rotate([90,0,0])
		linear_extrude(height = horizontal_slot_width)
		polygon(points=[[0,0],[3,0],[2,3],[-1,3]]);
		
		translate([-x0-5, distance_between_horizontal_clips/2+horizontal_slot_width+ulbs, vertical_offset])
		rotate([90,0,0])
		linear_extrude(height = horizontal_slot_width)
		polygon(points=[[0,0],[3,0],[2,3],[-1,3]]);
	}
	
	if(clip_locations=="vertical only" || clip_locations =="horizontal and vertical"){
		translate([-distance_between_vertical_clips/2-vertical_slot_width+ulos, y0 + 2,  vertical_offset])
		rotate([90,0,90])
		linear_extrude(height = vertical_slot_width)
		polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
		
		translate([distance_between_vertical_clips/2+ulos, y0 + 2,  vertical_offset])
		rotate([90,0,90])
		linear_extrude(height = vertical_slot_width)
		polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
		
		translate([-distance_between_vertical_clips/2+ulos, -y0 - 2,  vertical_offset])
		rotate([90,0,-90])
		linear_extrude(height = vertical_slot_width)
		polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
		
		translate([distance_between_vertical_clips/2 + vertical_slot_width+ulos, -y0 - 2,  vertical_offset])
		rotate([90,0,-90])
		linear_extrude(height = vertical_slot_width)
		polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
	}
}

module bars(depth){
	if (expose_status_bar=="yes" && expose_upper_message_bar=="no" && expose_upper_command_bar=="no" && sbh_adjust>0){
		translate([lec/2-rec/2,shm/2-sbhm+sbh_adjust/2,0])
		hole_cutter(bar_width,sbh_adjust+fudge,90,90,90,90,bcr,depth);
	}
	if (expose_status_bar=="yes" && expose_upper_message_bar=="yes" && expose_upper_command_bar=="no" && sbh_adjust+umbh_adjust>0){
		translate([lec/2-rec/2,shm/2-sbhm-umbhm+(max(sbh_adjust,0)+umbh_adjust)/2,0])
		hole_cutter(bar_width,max(sbh_adjust,0)+umbh_adjust+fudge,90,bar_edge_slope_inc_acrylic,90,90,bcr,depth);
	}

	if (expose_status_bar=="no" && expose_upper_message_bar=="yes" && expose_upper_command_bar=="yes" && umbh_adjust+ucbh_adjust>0){
		translate([lec/2-rec/2,shm/2-sbhm-umbhm-ucbhm+(max(umbh_adjust,0)+ucbh_adjust)/2,0])
		hole_cutter(bar_width,max(umbh_adjust+fudge,0)+ucbh_adjust,90,90,90,90,bcr,depth);
	}
	
	if (expose_status_bar=="yes" && expose_upper_message_bar=="yes" && expose_upper_command_bar=="yes" && sbh_adjust+umbh_adjust+ucbh_adjust>0){
		translate([lec/2-rec/2,shm/2-sbhm-umbhm-ucbhm+(max(sbh_adjust,0)+max(umbh_adjust,0)+ucbh_adjust)/2,0])
		hole_cutter(bar_width,max(sbh_adjust,0)+max(umbh_adjust,0)+ucbh_adjust+fudge,90,90,90,90,bcr,depth);
	}

	if (expose_status_bar=="no" && expose_upper_message_bar=="yes" && expose_upper_command_bar=="no" && umbh_adjust>0){
		translate([lec/2-rec/2,shm/2-sbhm-umbhm+(umbh_adjust)/2,0])
		hole_cutter(bar_width,umbh_adjust+fudge,90,bar_edge_slope_inc_acrylic,90,90,bcr,depth);
	}

	if (expose_status_bar=="no" && expose_upper_message_bar=="no" && expose_upper_command_bar=="yes" && ucbh_adjust>0){
		translate([lec/2-rec/2,shm/2-sbhm-umbhm-ucbhm+(ucbh_adjust)/2,0])
		hole_cutter(bar_width,ucbh_adjust+fudge,90,90,90,90,bcr,depth);
	}

	if (expose_status_bar=="yes" && expose_upper_message_bar=="no" && umbhm>0 && expose_upper_command_bar=="yes" && sbh_adjust+ucbh_adjust>0){
		translate([lec/2-rec/2,shm/2-sbhm+sbh_adjust/2,0])
		hole_cutter(bar_width,sbh_adjust+fudge,90,90,90,90,bcr,depth);

		translate([lec/2-rec/2,shm/2-sbhm-umbhm-ucbhm+(ucbh_adjust)/2,0])
		hole_cutter(bar_width,ucbh_adjust+fudge,90,90,90,90,bcr,depth);
	}

	if (expose_lower_message_bar=="yes" && expose_lower_command_bar=="no" && lmbh_adjust>0){
		translate([lec/2-rec/2,-shm/2+lmbh_adjust/2+max(lcbh_adjust,0)+bec,0])
		hole_cutter(bar_width,lmbh_adjust+fudge,90,bar_edge_slope_inc_acrylic,90,90,bcr,depth);
	}

	if (expose_lower_message_bar=="no" && expose_lower_command_bar=="yes" && lcbh_adjust>0){
		translate([lec/2-rec/2,-shm/2+lcbh_adjust/2+bec,0])
		hole_cutter(bar_width,lcbh_adjust+fudge,90,90,90,90,bcr,depth);
	}

	if (expose_lower_message_bar=="yes" && expose_lower_command_bar=="yes" && lmbh_adjust+lcbh_adjust>0){
		translate([lec/2-rec/2,-shm/2+(lmbh_adjust+max(lcbh_adjust,0))/2+bec,0])
		hole_cutter(bar_width,lmbh_adjust+max(lcbh_adjust,0)+fudge,90,90,90,90,bcr,depth);
	}
}

module bounded_cells(depth){
	difference(){
		cells(depth);
		
		difference(){
			// translate([grid_x0-50,grid_y0-50,-50])
			translate([grid_x0-5,grid_y0-5,-depth/2-2])
			cube([grid_width+10,grid_height+10,depth+4]);
			
			// translate([grid_x0,grid_y0,-50-2*fudge])
			translate([grid_x0+col_first_trim,grid_y0+row_first_trim,-50-2*fudge])
			cube([grid_width-col_first_trim-col_last_trim,grid_height-row_first_trim-row_last_trim,depth+100+4*fudge]);
		}
	}
}

module cells(depth){
	d = (depth > 0) ? depth+2*fudge : 0;
	grid_part_w = grid_width/number_of_columns;
	grid_part_h = grid_height/number_of_rows;
	
	cwid = (cell_shape=="rectangular") ? cell_width : cell_diameter;
	chei = (cell_shape=="rectangular") ? cell_height : cell_diameter;
	
	for (i = [0:row_count-1]){
		for (j = [0:column_count-1]){
			current_cell = j+1+i*column_count;
			cell_x = grid_x0 + j*grid_part_w + grid_part_w/2;
			cell_y = grid_y0 + i*grid_part_h + grid_part_h/2;
			
			c_x = (j==0 && column_count>1) ? cell_x + col_first_trim/2 : 
				  (j==column_count-1 && column_count > 1) ? cell_x - col_last_trim/2 :
				  (column_count==1) ? cell_x + col_first_trim/2 - col_last_trim/2 :
				   cell_x;
			c_y = (i==0 && row_count>1) ? cell_y + row_first_trim/2 : 
				  (i==row_count-1 && row_count>1) ? cell_y - row_last_trim/2 :
				  (row_count==1) ? cell_y + row_first_trim/2 - row_last_trim/2 :
				   cell_y;
			c_w = (j==0 && column_count>1) ? cwid - col_first_trim :
				  (j==column_count-1 && column_count > 1) ? cwid - col_last_trim :
				  (column_count==1) ? cwid - col_first_trim - col_last_trim :
				  cwid;
			c_h = (i==0 && i!=row_count-1) ? chei - row_first_trim :
				  (i!=0 && i==row_count-1) ? chei - row_last_trim :
				  (i==0 && i==row_count-1) ? chei - row_first_trim - row_last_trim :
				  chei;
				  
			// ignore if this cell is covered
			if (!search(current_cell,cover_these_cells)){
				// if cell is merged horizontally and rectangular
				if ((search(current_cell,merge_cells_horizontally_starting_at))&&(j!=column_count-1)){			
					translate([c_x+grid_part_w/2,c_y,0])
					hole_cutter(grid_part_w, c_h, cts,cbs,rs_inc_acrylic,rs_inc_acrylic,0,d);	
				}
				// if cell is merged vertically and rectangular
				if((search(current_cell,merge_cells_vertically_starting_at))&&(i!=row_count-1)){
					translate([c_x, c_y+grid_part_h/2, 0])
					hole_cutter(c_w, grid_part_h, cts,cbs,rs_inc_acrylic,rs_inc_acrylic,0,d);	
				}

				//clean up center pyramid if a cell is in both horizontal and vertical merge and next cell is also in the vertical merge and the cell above is in the horizontal merge
				if((search(current_cell,merge_cells_horizontally_starting_at))&&(search(current_cell,merge_cells_vertically_starting_at))&&(search(current_cell+1,merge_cells_vertically_starting_at))&&(search(current_cell+number_of_columns,merge_cells_horizontally_starting_at))){
					translate([c_x+grid_part_w/2, c_y+grid_part_h/2, 0])
					hole_cutter(grid_part_w, grid_part_h, cts,cbs,rs_inc_acrylic,rs_inc_acrylic,0,d);
				}

				//basic, no-merge cell cut these two statements will have no impact if cell has been merged, cell can be any shape
				translate([c_x,c_y,0])
				if (cell_shape=="rectangular"){
					hole_cutter(c_w+fudge,c_h+fudge,cts,cbs,rs_inc_acrylic,rs_inc_acrylic,ocr,d);
				}
				else{
					hole_cutter(cell_diameter,cell_diameter,cts,cbs,rs_inc_acrylic,rs_inc_acrylic,cell_diameter/2,d);
				}
			}
		}
	}
}

module cell_ridges(){
	grid_part_w = grid_width/number_of_columns;
	grid_part_h = grid_height/number_of_rows;
	
	cwid = (cell_shape=="rectangular") ? cell_width : cell_diameter;
	chei = (cell_shape=="rectangular") ? cell_height : cell_diameter;

	for (i = [0:row_count-1]){
		for (j = [0:column_count-1]){
			current_cell = j+1+i*column_count;
			cell_x = grid_x0 + j*grid_part_w + grid_part_w/2;
			cell_y = grid_y0 + i*grid_part_h + grid_part_h/2;

			c_x = (j==0 && column_count>1) ? cell_x + col_first_trim/2 : 
				  (j==column_count-1 && column_count > 1) ? cell_x - col_last_trim/2 :
				  (column_count==1) ? cell_x + col_first_trim/2 - col_last_trim/2 :
				   cell_x;
			c_y = (i==0 && row_count>1) ? cell_y + row_first_trim/2 : 
				  (i==row_count-1 && row_count>1) ? cell_y - row_last_trim/2 :
				  (row_count==1) ? cell_y + row_first_trim/2 - row_last_trim/2 :
				   cell_y;
			c_w = (j==0 && column_count>1) ? cwid - col_first_trim :
				  (j==column_count-1 && column_count > 1) ? cwid - col_last_trim :
				  (column_count==1) ? cwid - col_first_trim - col_last_trim :
				  cwid;
			c_h = (i==0 && i!=row_count-1) ? chei - row_first_trim :
				  (i!=0 && i==row_count-1) ? chei - row_last_trim :
				  (i==0 && i==row_count-1) ? chei - row_first_trim - row_last_trim :
				  chei;
		
			if (search(current_cell,add_a_ridge_around_these_cells)){
				slope_adjust = sat/tan(rs_inc_acrylic);

				translate([c_x,c_y,-kt/2])
				if (cell_shape=="rectangular"){
					rounded_rectangle_wall(c_w+slope_adjust*2,c_h+slope_adjust*2,ocr,thickness_of_ridge,height_of_ridge+sat);
				}
				else{
					circular_wall(cell_diameter+slope_adjust*2,thickness_of_ridge,height_of_ridge+sat);
				}
			}
		}
	}
}

module circular_wall(ID,thickness,hgt){
	rotate_extrude($fn=60)
	polygon([[ID/2,0],[ID/2+thickness,0],[ID/2+thickness,hgt-.5],[ID/2+thickness-.5,hgt],[ID/2+.5,hgt],[ID/2,hgt-.5]]);
}

module rounded_rectangle_wall(width,hgt,corner_radius,thickness,hgt2){
	rr_wall1(width,hgt,corner_radius,thickness,hgt2);
	mirror([0,1,0])
	rr_wall1(width,hgt,corner_radius,thickness,hgt2);
	
	rr_wall2(width,hgt,corner_radius,thickness,hgt2);
	mirror([1,0,0])
	rr_wall2(width,hgt,corner_radius,thickness,hgt2);

	rr_corner_wall(width,hgt,corner_radius,thickness,hgt2);
	mirror([1,0,0])
	rr_corner_wall(width,hgt,corner_radius,thickness,hgt2);
	mirror([0,1,0])
	rr_corner_wall(width,hgt,corner_radius,thickness,hgt2);
	mirror([1,0,0])
	mirror([0,1,0])
	rr_corner_wall(width,hgt,corner_radius,thickness,hgt2);
}

module rr_wall1(width,hgt,corner_radius,thickness,hgt2){
	translate([width/2-corner_radius,-hgt/2,0])
	rotate([0,0,-90])
	rotate([90,0,0])
	linear_extrude(height=width-corner_radius*2)
	polygon([[0,0],[thickness,0],[thickness,hgt2-.5],[thickness-.5,hgt2],[.5,hgt2],[0,hgt2-.5]]);
}

module rr_wall2(width,hgt,corner_radius,thickness,hgt2){
	translate([-width/2-thickness,hgt/2-corner_radius,0])
	rotate([90,0,0])
	linear_extrude(height=hgt-corner_radius*2)
	polygon([[0,0],[thickness,0],[thickness,hgt2-.5],[thickness-.5,hgt2],[.5,hgt2],[0,hgt2-.5]]);
}

module rr_corner_wall(width,hgt,corner_radius,thickness,hgt2){
	translate([width/2-corner_radius,hgt/2-corner_radius,0])
	rotate_extrude(angle=90,$fn=60)
	translate([corner_radius,0,0])
	polygon([[0,0],[thickness,0],[thickness,hgt2-.5],[thickness-.5,hgt2],[.5,hgt2],[0,hgt2-.5]]);
}

module hole_cutter(hole_width,hole_height,top_slope,bottom_slope,left_slope,right_slope,radius,depth){

	d = (type_of_keyguard=="3D-Printed") ? depth-cec : depth;
	z = (type_of_keyguard=="3D-Printed") ? -cec/2 : 0;
	
	if(depth>0 && cec>0){
		translate([0,0,z])
		union(){
			cut(hole_width,hole_height,top_slope,bottom_slope,left_slope,right_slope,radius,d);
			
			if (type_of_keyguard=="3D-Printed"){  
				l_s = (left_slope>=chamfer_angle_stop || left_slope<0) ? 45 : left_slope;
				r_s = (right_slope>=chamfer_angle_stop || right_slope<0) ? 45 : right_slope;
				t_s = (top_slope>=chamfer_angle_stop || top_slope<0) ? 45 : top_slope;
				b_s = (bottom_slope>=chamfer_angle_stop || bottom_slope<0) ? 45 : bottom_slope;
				
				left = d * tan(90-left_slope);
				right = d * tan(90-right_slope);
				top = d * tan(90-top_slope);
				bottom = d * tan(90-bottom_slope);
				w1 = hole_width+left+right;
				h1 = hole_height+top+bottom;
				
				m1 = min(hole_width,hole_height);
				m2 = min(w1,h1);
				
				rad = (radius>m1/2) ? m2/2 : 
					((hole_width==hole_height && radius<hole_width/2) || (hole_width!=hole_height) && radius!=m1/2) ? radius : m2/2;
				
				radius2 = (radius==0) ? 0 : rad;

				translate([(right-left)/2,(top-bottom)/2,d/2+cec/2])
				cut(w1,h1,t_s,b_s,l_s,r_s,radius2,cec);
			}
		}
	}
	else{
		cut(hole_width,hole_height,top_slope,bottom_slope,left_slope,right_slope,radius,d);
	}
}


module hole_cutter_2d(hole_width,hole_height,radius){
	cut_2d(hole_width,hole_height,radius);
}

module cut(cut_w, cut_h, top_angle, bottom_angle, left_angle, right_angle, radius, thick){
	$fn=60;
	th1 = thick + 2*fudge;

	radius1 = (radius==0) ? 0 : radius-fudge;
	
	left = th1 * tan(90-left_angle);
	right = th1 * tan(90-right_angle);
	top = th1 * tan(90-top_angle);
	bottom = th1 * tan(90-bottom_angle);
	w1 = cut_w+left+right;
	h1 = cut_h+top+bottom;
	m1 = min(cut_w,cut_h);
	m2 = min(w1,h1);
	
	rad = (radius>m1/2) ? m2/2 : 
		((cut_w==cut_h && radius<cut_w/2) || (cut_w!=cut_h) && radius!=m1/2) ? radius : m2/2;
	
	radius2 = (radius==0) ? 0 : rad-fudge;
	
	if (thick > 0){
		translate([0,0,-th1/2-fudge])
		hull(){
			linear_extrude(.005)
			offset(r=radius1)
			square([cut_w-2*radius1, cut_h-2*radius1], center = true);
			
			translate([-(cut_w/2-radius2)-left,-(cut_h/2-radius2)-bottom,th1])
			linear_extrude(.005)
			offset(r=radius2)
			square([cut_w-2*radius2+left+right, cut_h-2*radius2+top+bottom],center = false);
		}
	}
	else{
		offset(r=radius1)
		square([cut_w-2*radius1, cut_h-2*radius1], center = true);
	}
}


module cut_2d(cut_w, cut_h, radius){
	$fn=60;
	radius1 = (radius==0) ? 0 : radius-fudge;
	
	offset(r=radius1)
	square([cut_w-2*radius1, cut_h-2*radius1], center = true);
}


module create_cell_insert(){
	chamfer = .5;
	btod = Braille_to_opening_distance+1;
	comma_loc = search(",",Braille_text);
	word_one = (len(comma_loc)==0) ? Braille_text : 
				(Braille_text[0]== ",") ? "" : substr(Braille_text,0,comma_loc[0]);
	word_two = (len(comma_loc)==0) ? "" : substr(Braille_text,comma_loc[0]+1);
	binary_text_one = search(word_one,braille_a);
	binary_text_two = search(word_two,braille_a);

	roo = diameter_of_opening/2+2;

	// above below
	bh = bsm * 6.5; //braille height
	v = cell_height/2;

	BA = (Braille_location=="above opening" && e_t=="");
	BB = (Braille_location=="below opening" && e_t=="");
	BAB = (Braille_location=="above and below opening");
	BAE = (Braille_location=="above opening" && e_t!="");
	BBE = (Braille_location=="below opening" && e_t!="");

	elements_v = (BAB) ? bh*2+btod*2+roo*2 :
				 (BA || BB) ? bh+btod+roo*2 : 0;
	b_v = v-elements_v/2;

	z1 = (BA || BAB) ? v-bh/2-b_v :
		 (BB) ? -v+bh/2+b_v : 
		 (BBE) ? -v+(v-roo)/2 :
		 (BAE) ? v-(v-roo)/2 : 0;
		 
	z2 = (BAB) ? -v+b_v+bh/2 :
		 (BAE) ? -v+(v-roo)/2 :
		 (BBE) ? v-(v-roo)/2 : 0;
		 
	o_z = (BAB || BAE || BBE) ? 0 : 
		  (BA) ? -v+roo+b_v :
		  (BB) ? v-roo-b_v : 0;

	//left right
	hacw = cell_width/2;

	BL = (Braille_location=="left of opening" && e_t=="");
	BR = (Braille_location=="right of opening" && e_t=="");
	BLR = (Braille_location=="left and right of opening");
	BLE = (Braille_location=="left of opening" && e_t!="");
	BRE = (Braille_location=="right of opening" && e_t!="");

	braille_letters1 = len(word_one);
	braille_letters2 = len(word_two);
	base_braille_width1 = (braille_letters1 == 1) ? 4 : (braille_letters1-1)*6.1 + 4;
	base_braille_width2 = (braille_letters2 == 1) ? 4 : (braille_letters2-1)*6.1 + 4;
	w1 = bsm * base_braille_width1;
	w2 = bsm * base_braille_width2;

	elements_h = (BL || BR) ? w1+btod+roo*2 : 
				 (BLR) ? w1+w2+btod*2+roo*2 : 0;
				 
	b_h = hacw-elements_h/2;

	x1 = (BL || BLR) ? -hacw+b_h+w1/2 : 
		 (BR) ? hacw-b_h-w1/2 : 
		 (BLE) ? -hacw+(hacw-roo)/2 :
		 (BRE) ? hacw-(hacw-roo)/2 : 0;
				
	x2 = (BLR) ? hacw-b_h-w2/2 :
		 (BLE) ? hacw-(hacw-roo)/2 : 
		 (BRE) ? -hacw+(hacw-roo)/2 : 0;

	o_x = (BLE || BRE) ? 0 :
		  (BL) ? hacw-b_h-roo :
		  (BLR) ? -hacw+b_h+w1+btod+roo :
		  (BR) ? -hacw+b_h+roo : 0;
	
	s_f=insert_tightness_of_fit/10;
			
	if (BA || BB || BAB || BAE || BBE){
		difference(){
			rotate([90,0,0])
			if (cell_shape=="rectangular"){
				chamfered_shape(cell_width+s_f/2,insert_thickness,cell_height+s_f/2,chamfer,cell_corner_radius);
			}
			else{
				chamfered_shape(cell_width+s_f/2,insert_thickness,cell_height+s_f/2,chamfer,cell_corner_radius);
			}
			
			if(add_circular_opening=="yes"){
				translate([0,0,o_z])
				rotate([90,0,0])
				cylinder(r1=diameter_of_opening/2,r2=diameter_of_opening/2 + 2,h=insert_thickness+2,center=true);
			}
			
			if (BAE || BBE){
				translate([0,-.1,z2])
				add_engraved_text("center");
			}
		}

		translate([0,0,z1])
		if(word_one !="") add_braille(binary_text_one);
		
		if (BAB){			
			translate([0,0,z2])
			if(word_two !="") add_braille(binary_text_two);
		}
	}
	else {
		difference(){
			rotate([90,0,0])
			chamfered_shape(cell_width+s_f/2,insert_thickness,cell_height+s_f/2,chamfer,cell_corner_radius);
			
			if(add_circular_opening=="yes"){
				translate([o_x,0,0])
				rotate([90,0,0])
				cylinder(r1=diameter_of_opening/2,r2=diameter_of_opening/2 + 2,h=insert_thickness+2,center=true);
			}
			
			if (BLE || BRE){
				translate([x2,-.1,0])
				add_engraved_text("center");
			}
		}

		translate([x1,0,0])
		if(word_one !="") add_braille(binary_text_one);
		
		if (BLR){
			translate([x2,0,0])
			if(word_two !="") add_braille(binary_text_two);
		}

	}
	
	// // // if (Bliss_concept!=""){
		// // // Bliss_graphic();
	// // // }
	
}

module cut_screen_openings(s_o,depth){
	for(i = [0 : len(s_o)-1]){
		opening = s_o[i]; //0:ID, 1:x, 2:y, 3:width,  4:height, 5:shape, 6:top slope, 7:bottom slope, 8:left slope, 9:right slope, 10:corner_radius, 11:other
		opening_ID = opening[0];
		opening_x = opening[1];
		opening_y = opening[2];
		opening_width = (opening[3]==undef) ? 0 : opening[3];
		opening_height = opening[4];
		opening_shape = opening[5];
		opening_top_slope = (type_of_keyguard=="Laser-Cut" || (opening[6]==0 && opening_shape!="svg" && opening_shape!="ridge" && opening_shape!="ttext" && opening_shape!="btext")) ? 90 : opening[6];
		opening_bottom_slope = (type_of_keyguard=="Laser-Cut" || (opening[7]==0 && opening_shape!="svg" && opening_shape!="ridge" && opening_shape!="ttext" && opening_shape!="btext")) ? 90 : opening[7];
		opening_left_slope = (type_of_keyguard=="Laser-Cut" || (opening[8]==0 && opening_shape!="svg" && opening_shape!="ridge" && opening_shape!="ttext" && opening_shape!="btext")) ? 90 : opening[8];
		opening_right_slope = (type_of_keyguard=="Laser-Cut" || (opening[9]==0 && opening_shape!="svg" && opening_shape!="ridge" && opening_shape!="ttext" && opening_shape!="btext")) ? 90 : opening[9];
		opening_corner_radius = opening[10];
		opening_other = opening[11];
		opening_width_mm = (unit_of_measure_for_screen=="px") ? opening_width * mpp : opening_width;

		opening_height_mm = (unit_of_measure_for_screen=="px") ? opening_height * mpp : opening_height;
		opening_x_mm = (unit_of_measure_for_screen=="px") ? opening_x * mpp : opening_x;

		o_s = opening_shape;		
		o_c_r = (o_s=="oa1" || o_s=="oa2" || o_s=="oa3" || "oa4") ? opening_corner_radius : min(opening_corner_radius,min(opening_width,opening_height)/2);
		opening_corner_radius_mm = (unit_of_measure_for_screen=="px") ? o_c_r * mpp : o_c_r;
		
		if(depth>0){
			if(opening_ID!="#"){
				if (starting_corner_for_screen_measurements == "upper-left"){
					opening_y_mm = (unit_of_measure_for_screen=="px") ? (shp - opening_y) * mpp : (shm - opening_y);
					translate([sx0+opening_x_mm,sy0+opening_y_mm,0])
					cut_opening(opening_width_mm, opening_height_mm, opening_shape, opening_top_slope, opening_bottom_slope, opening_left_slope, opening_right_slope, opening_corner_radius_mm, opening_other,depth,"screen");
				}
				else{
					opening_y_mm = (unit_of_measure_for_screen=="px") ? opening_y * mpp : opening_y;
					
					translate([sx0+opening_x_mm,sy0+opening_y_mm,0])
					cut_opening(opening_width_mm, opening_height_mm, opening_shape, opening_top_slope, opening_bottom_slope, opening_left_slope, opening_right_slope, opening_corner_radius_mm, opening_other,depth,"screen");
				}
			}
			else{
				if (starting_corner_for_screen_measurements == "upper-left"){
					opening_y_mm = (unit_of_measure_for_screen=="px") ? (shp - opening_y) * mpp : (shm - opening_y);
					translate([sx0+opening_x_mm,sy0+opening_y_mm,0])
					#cut_opening(opening_width_mm, opening_height_mm, opening_shape, opening_top_slope, opening_bottom_slope, opening_left_slope, opening_right_slope, opening_corner_radius_mm, opening_other,depth,"screen");
				}
				else{
					opening_y_mm = (unit_of_measure_for_screen=="px") ? opening_y * mpp : opening_y;
					
					translate([sx0+opening_x_mm,sy0+opening_y_mm,0])
					#cut_opening(opening_width_mm, opening_height_mm, opening_shape, opening_top_slope, opening_bottom_slope, opening_left_slope, opening_right_slope, opening_corner_radius_mm, opening_other,depth,"screen");
				}
			}
		}
		else{
			if(opening_ID!="#"){
				if (starting_corner_for_screen_measurements == "upper-left"){
					opening_y_mm = (unit_of_measure_for_screen=="px") ? (shp - opening_y) * mpp : (shm - opening_y);
					translate([sx0+opening_x_mm,sy0+opening_y_mm,0])
					cut_opening_2d(opening_width_mm, opening_height_mm, opening_shape, opening_top_slope, opening_corner_radius_mm);
				}
				else{
					opening_y_mm = (unit_of_measure_for_screen=="px") ? opening_y * mpp : opening_y;
					
					translate([sx0+opening_x_mm,sy0+opening_y_mm,0])
					cut_opening_2d(opening_width_mm, opening_height_mm, opening_shape, opening_top_slope, opening_corner_radius_mm);
				}
			}
			else{
				if (starting_corner_for_screen_measurements == "upper-left"){
					opening_y_mm = (unit_of_measure_for_screen=="px") ? (shp - opening_y) * mpp : (shm - opening_y);
					translate([sx0+opening_x_mm,sy0+opening_y_mm,0])
					#cut_opening_2d(opening_width_mm, opening_height_mm, opening_shape, opening_top_slope, opening_corner_radius_mm);
				}
				else{
					opening_y_mm = (unit_of_measure_for_screen=="px") ? opening_y * mpp : opening_y;
					
					translate([sx0+opening_x_mm,sy0+opening_y_mm,0])
					#cut_opening_2d(opening_width_mm, opening_height_mm, opening_shape, opening_top_slope, opening_corner_radius_mm);
				}
			}
		}
	}
}

module cut_case_openings(c_o,depth){

	for(i = [0 : len(c_o)-1]){
		opening = c_o[i]; //0:ID, 1:x, 2:y, 3:width,  4:height, 5:shape, 6:top slope, 7:bottom slope, 8:left slope, 9:right slope, 10:corner_radius, 11:other
		opening_ID = opening[0];
		opening_x = opening[1];
		opening_y = opening[2];
		opening_width = opening[3];
		opening_height = opening[4];
		opening_shape = opening[5];
		opening_top_slope = (type_of_keyguard=="Laser-Cut" || (opening[6]==0 && opening_shape!="svg" && opening_shape!="ridge" && opening_shape!="ttext" && opening_shape!="btext")) ? 90 : opening[6];
		opening_bottom_slope = (type_of_keyguard=="Laser-Cut" || (opening[7]==0 && opening_shape!="svg" && opening_shape!="ridge" && opening_shape!="ttext" && opening_shape!="btext")) ? 90 : opening[7];
		opening_left_slope = (type_of_keyguard=="Laser-Cut" || (opening[8]==0 && opening_shape!="svg" && opening_shape!="ridge" && opening_shape!="ttext" && opening_shape!="btext")) ? 90 : opening[8];
		opening_right_slope = (type_of_keyguard=="Laser-Cut" || (opening[9]==0 && opening_shape!="svg" && opening_shape!="ridge" && opening_shape!="ttext" && opening_shape!="btext")) ? 90 : opening[9];
		opening_corner_radius = opening[10];
		opening_other = opening[11];

		translate([cox0+opening_x,coy0+opening_y,0])
		if(opening_ID!="#"){
			cut_opening(opening_width, opening_height, opening_shape, opening_top_slope, opening_bottom_slope, opening_left_slope, opening_right_slope, opening_corner_radius, opening_other,depth, "keyguard");
		}
		else{
			#cut_opening(opening_width, opening_height, opening_shape, opening_top_slope, opening_bottom_slope, opening_left_slope, opening_right_slope, opening_corner_radius, opening_other,depth, "keyguard");
		}
	}
	
}

module cut_tablet_openings(t_o,depth){

	for(i = [0 : len(t_o)-1]){
		opening = t_o[i]; //0:ID, 1:x, 2:y, 3:width,  4:height, 5:shape, 6:top slope, 7:bottom slope, 8:left slope, 9:right slope, 10:corner_radius, 11:other
		
		opening_ID = opening[0];
		opening_x = opening[1];
		opening_y = opening[2];
		opening_width = opening[3];
		opening_height = opening[4];
		opening_shape = opening[5];
		opening_top_slope = (opening[6]==0) ? 90 : opening[6];
		opening_bottom_slope = (opening[7]==0) ? 90 : opening[7];
		opening_left_slope = (opening[8]==0) ? 90 : opening[8];
		opening_right_slope = (opening[9]==0) ? 90 : opening[9];
		opening_corner_radius = opening[10];
		opening_other = opening[11];
		
		o_c_r = min(opening_corner_radius,min(opening_width,opening_height)/2);
		
		trans = (orientation=="landscape") ? [tx0+opening_x,ty0+opening_y,0] : [tx0+opening_y,-ty0-opening_x,0];
		translate(trans)
		if(opening_ID!="#"){
			cut_opening(opening_width, opening_height, opening_shape, opening_top_slope, opening_bottom_slope, opening_left_slope, opening_right_slope, o_c_r, opening_other,depth, "tablet");
		}
		else{
			#cut_opening(opening_width, opening_height, opening_shape, opening_top_slope, opening_bottom_slope, opening_left_slope, opening_right_slope, o_c_r, opening_other,depth, "tablet");
		}
	}
}

module cut_opening(cut_width, cut_height, shape, top_slope, bottom_slope, left_slope, right_slope, corner_radius, other, depth, type){
	offset = (type_of_keyguard=="3D-Printed" && is_num(other) && depth==sat) ? depth - other : 
			 (type_of_keyguard=="3D-Printed" && is_num(other) && depth==kt) ? (depth - other)/2 : 
			 0;
	dep = (type_of_keyguard=="3D-Printed" && is_num(other)) ? other : depth;

	if (shape=="r"){
		if (cut_width > 0 && cut_height > 0){
			trans = (type=="screen") ? -sat/2-kt/2+sat+offset/2 : offset;
			translate([cut_width/2,cut_height/2,trans])
			hole_cutter(cut_width,cut_height,top_slope,bottom_slope,left_slope,right_slope,0,dep);
		}
	}
	else if (shape=="cr"){
		if (cut_width > 0 && cut_height > 0){
			trans = (type=="screen") ? -sat/2-kt/2+sat+offset/2 : offset;
			translate([0,0,trans])
			hole_cutter(cut_width,cut_height,top_slope,bottom_slope,left_slope,right_slope,0,dep);
		}
	}
	else if (shape=="c"){
		if (cut_height > 0){
			if (type_of_keyguard=="3D-Printed"){
				trans = (type=="screen") ? -sat/2-kt/2+sat+offset/2 : offset;
				translate([0,0,trans])
				hole_cutter(cut_height,cut_height,top_slope,bottom_slope,left_slope,right_slope,cut_height/2,dep);
			}
			else{
				//need to accomodate ALS sensors and other circular openings if slope is non-90 degrees
				aoa = sat_incl_acrylic/tan(top_slope);
				hole_cutter(cut_height+aoa*2,cut_height+aoa*2,90,90,90,90,(cut_height+aoa*2)/2,dep);
			}
		}
	}
	else if (shape=="hd"){
		if (cut_width > 0 && cut_height > 0){
			m = min(cut_width,cut_height);
			trans = (type=="screen") ? -sat/2-kt/2+sat+offset/2 : offset;
			translate([0,0,trans])
			hole_cutter(cut_width,cut_height,top_slope,bottom_slope,left_slope,right_slope,m/2,dep);
		}
	}
	else if (shape=="rr"){
		if (cut_width > 0 && cut_height > 0){
			trans = (type=="screen") ? -sat/2-kt/2+sat+offset/2 : offset;
			translate([cut_width/2,cut_height/2,trans])
			hole_cutter(cut_width,cut_height,top_slope,bottom_slope,left_slope,right_slope,corner_radius,dep);
		}
	}	
	else if (shape=="crr"){
		if (cut_width > 0 && cut_height > 0){
			trans = (type=="screen") ? -sat/2-kt/2+sat+offset/2 : offset;
			translate([0,0,trans])
			hole_cutter(cut_width,cut_height,top_slope,bottom_slope,left_slope,right_slope,corner_radius,dep);
		}
	}	
	else if (shape=="oa1"){
		if (corner_radius > 0){
			trans = (type=="screen") ? -sat/2-kt/2+sat : 0;
			translate([-corner_radius,-corner_radius,trans])
			create_cutting_tool(0, corner_radius*2, depth+0.05, top_slope, "oa");
		}
	}
	else if (shape=="oa2"){
		if (corner_radius > 0){
			trans = (type=="screen") ? -sat/2-kt/2+sat : 0;
			translate([-corner_radius,corner_radius,trans])
			create_cutting_tool(-90, corner_radius*2, depth+0.05, top_slope, "oa");	
		}
	}
	else if (shape=="oa3"){
		if (corner_radius > 0){
			trans = (type=="screen") ? -sat/2-kt/2+sat : 0;
			translate([corner_radius,corner_radius,trans])
			create_cutting_tool(180, corner_radius*2, depth+0.05, top_slope, "oa");
		}
	}
	else if (shape=="oa4"){
		if (corner_radius > 0){
			trans = (type=="screen") ? -sat/2-kt/2+sat : 0;
			translate([corner_radius,-corner_radius,trans])
			create_cutting_tool(90, corner_radius*2, depth+0.05, top_slope, "oa");	
		}
	}
	else if (shape=="ttext" && type_of_keyguard=="3D-Printed"){
		f_s = 
			(bottom_slope==1)? "Liberation Sans:style=Bold"
		  : (bottom_slope==2)? "Liberation Sans:style=Italic"
		  : (bottom_slope==3)? "Liberation Sans:style=Bold Italic"
		  : "Liberation Sans";
		  
		// "left", "center" and "right"
		horiz = 
			(left_slope==1)? "left"
		  : (left_slope==2)? "center"
		  : (left_slope==3)? "right"
		  : "left";
		  
		// "top", "center", "baseline" and "bottom"
		vert = 
			(right_slope==1)? "bottom"
		  : (right_slope==2)? "baseline"
		  : (right_slope==3)? "center"
		  : (right_slope==4)? "top"
		  : "bottom";
		  
		// if (cut_height > 0 && corner_radius < 0){
		if (cut_height > 0){
			trans = (type=="screen") ? corner_radius-kt/2+sat-.005 : kt/2+corner_radius-fudge;
			translate([0,0,trans])
			rotate([0,0,top_slope])
			linear_extrude(height = -corner_radius+.01)
			text(str(other),font = f_s, size=cut_height,valign=vert,halign=horiz);
		}
	}
	else if (shape=="btext" && type_of_keyguard=="3D-Printed"){
		f_s = 
			(bottom_slope==1)? "Liberation Sans:style=Bold"
		  : (bottom_slope==2)? "Liberation Sans:style=Italic"
		  : (bottom_slope==3)? "Liberation Sans:style=Bold Italic"
		  : "Liberation Sans";
		  
		// "left", "center" and "right"
		horiz = 
			(left_slope==1)? "left"
		  : (left_slope==2)? "center"
		  : (left_slope==3)? "right"
		  : "left";
		  
		// "top", "center", "baseline" and "bottom"
		vert = 
			(right_slope==1)? "bottom"
		  : (right_slope==2)? "baseline"
		  : (right_slope==3)? "center"
		  : (right_slope==4)? "top"
		  : "bottom";
		if (cut_height > 0 && corner_radius < 0){
			trans = (type=="screen") ? -corner_radius-kt/2-fudge : -corner_radius-kt/2+fudge;
			translate([0,0,trans])
			rotate([0,180,0])
			rotate([0,0,top_slope])
			linear_extrude(height=-corner_radius+fudge*2)
			text(str(other),font = f_s, size=cut_height,valign=vert,halign=horiz);
		}
	}
	else if (shape=="svg" && type_of_keyguard=="3D-Printed"){
		if (cut_width > 0 && cut_height > 0 && corner_radius<0){
			trans = (type=="screen") ? corner_radius-kt/2+sat-fudge : kt/2+corner_radius;
			translate([0,0,trans])
			rotate([0,0,-top_slope])
			resize([cut_width,cut_height,-corner_radius+fudge*2])
			linear_extrude(height=1)
			offset(delta = .005)
			import(file = other,center=true);
		}
	}
}


module cut_opening_2d(cut_width, cut_height, shape, opening_top_slope, corner_radius){

	if (shape=="r"){
		if (cut_width > 0 && cut_height > 0){
			translate([cut_width/2,cut_height/2])
			hole_cutter_2d(cut_width,cut_height,0);
		}
	}
	else if (shape=="cr"){
		if (cut_width > 0 && cut_height > 0){
			translate([0,0])
			hole_cutter_2d(cut_width,cut_height,0);
		}
	}
	else if (shape=="c"){
		if (cut_height > 0){
			aoa = sat_incl_acrylic/tan(opening_top_slope);
			hole_cutter_2d(cut_height+aoa*2,cut_height+aoa*2,(cut_height+aoa*2)/2);
		}
	}
	else if (shape=="hd"){
		if (cut_width > 0 && cut_height > 0){
			m = min(cut_width,cut_height);
			translate([0,0])
			hole_cutter_2d(cut_width,cut_height,m/2);
		}
	}
	else if (shape=="rr"){
		if (cut_width > 0 && cut_height > 0){
			translate([cut_width/2,cut_height/2])
			hole_cutter_2d(cut_width,cut_height,corner_radius);
		}
	}	
	else if (shape=="crr"){
		if (cut_width > 0 && cut_height > 0){
			translate([0,0])
			hole_cutter_2d(cut_width,cut_height,corner_radius);
		}
	}	
	else if (shape=="oa1"){
		if (corner_radius > 0){
			translate([-corner_radius,-corner_radius])
			create_cutting_tool_2d(0, corner_radius*2);
		}
	}
	else if (shape=="oa2"){
		if (corner_radius > 0){
			translate([-corner_radius,corner_radius])
			create_cutting_tool_2d(-90, corner_radius*2);	
		}
	}
	else if (shape=="oa3"){
		if (corner_radius > 0){
			translate([corner_radius,corner_radius])
			create_cutting_tool_2d(180, corner_radius*2);
		}
	}
	else if (shape=="oa4"){
		if (corner_radius > 0){
			translate([corner_radius,-corner_radius])
			create_cutting_tool_2d(90, corner_radius*2);	
		}
	}
}

module adding_plastic(additions,where){
	for(i = [0 : len(additions)-1]){
		addition = additions[i]; //0:ID, 1:x, 2:y, 3:width,  4:height, 5:shape, 6:top slope, 7:bottom slope, 8:left slope, 9:right slope, 10:corner_radius, 11:other
		
		addition_ID = addition[0];
		addition_x = addition[1];
		addition_y = addition[2];
		addition_width = addition[3];
		addition_height = addition[4];
		addition_shape = addition[5];
		addition_top_slope = addition[6];
		addition_bottom_slope = addition[7];
		addition_left_slope = addition[8];
		addition_right_slope = addition[9];
		addition_corner_radius = addition[10];
		addition_other = addition[11];
		
		x0 = (where=="screen") ? sx0 : cox0;
		y0 = (where=="screen") ? sy0 : coy0;
		
		trans = (where=="screen") ? -kt/2+sat : 
		        (where=="case" && generate=="keyguard") ? kt/2 :
				keyguard_frame_thickness/2;
		
		if (addition_shape == "bump" || addition_shape == "hridge" || addition_shape == "vridge" || addition_shape == "ridge" || addition_shape == "aridge1" || addition_shape == "aridge2" || addition_shape == "aridge3" || addition_shape == "aridge4" || addition_shape == "svg" || addition_shape == "ttext") {
	
			addition_width_mm = (unit_of_measure_for_screen=="px" && where=="screen") ? addition_width * mpp : addition_width;
			addition_height_mm = (unit_of_measure_for_screen=="px" && where=="screen") ? addition_height * mpp : addition_height;
			addition_x_mm = (unit_of_measure_for_screen=="px" && where=="screen") ? addition_x * mpp : addition_x;
			addition_corner_radius_mm = (unit_of_measure_for_screen=="px" && where=="screen") ? addition_corner_radius * mpp : addition_corner_radius;
			addition_top_slope_mm = (unit_of_measure_for_screen=="px" && where=="screen") ? addition_top_slope * mpp : addition_top_slope;
			addition_bottom_slope_mm = (unit_of_measure_for_screen=="px" && where=="screen") ? addition_bottom_slope * mpp : addition_bottom_slope;

			if(addition_ID!="#"){
				if (starting_corner_for_screen_measurements == "upper-left" && where=="screen"){
					addition_y_mm = (unit_of_measure_for_screen=="px") ? (shp - addition_y) * mpp : (shm - addition_y);
					translate([x0+addition_x_mm,y0+addition_y_mm,trans-fudge])
					place_addition(addition_width_mm, addition_height_mm, addition_shape, addition_top_slope, addition_top_slope_mm, addition_bottom_slope, addition_bottom_slope_mm, addition_left_slope, addition_right_slope, addition_corner_radius_mm, addition_other);
				}
				else{
					addition_y_mm = (unit_of_measure_for_screen=="px" && where=="screen") ? addition_y * mpp : addition_y;
					
					translate([x0+addition_x_mm,y0+addition_y_mm,trans-fudge])
					place_addition(addition_width_mm, addition_height_mm, addition_shape, addition_top_slope, addition_top_slope_mm, addition_bottom_slope, addition_bottom_slope_mm, addition_left_slope, addition_right_slope, addition_corner_radius_mm, addition_other);
				}
			}
			else{
				if (starting_corner_for_screen_measurements == "upper-left" && where=="screen"){
					addition_y_mm = (unit_of_measure_for_screen=="px") ? (shp - addition_y) * mpp : (shm - addition_y);
					translate([x0+addition_x_mm,y0+addition_y_mm,trans-fudge])
					#place_addition(addition_width_mm, addition_height_mm, addition_shape, addition_top_slope, addition_top_slope_mm, addition_bottom_slope, addition_bottom_slope_mm, addition_left_slope, addition_right_slope, addition_corner_radius_mm, addition_other);
				}
				else{
					addition_y_mm = (unit_of_measure_for_screen=="px" && where=="screen") ? addition_y * mpp : addition_y;
					
					translate([x0+addition_x_mm,y0+addition_y_mm,trans-fudge])
					#place_addition(addition_width_mm, addition_height_mm, addition_shape, addition_top_slope, addition_top_slope_mm, addition_bottom_slope, addition_bottom_slope_mm, addition_left_slope, addition_right_slope, addition_corner_radius_mm, addition_other);
				}
			}
		}
	}
}

module place_addition(addition_width, addition_height, shape, top_slope, top_slope_mm, bottom_slope, bottom_slope_mm, left_slope, right_slope, corner_radius, other){
	if (shape=="bump"){
		if(addition_width>0){
			difference(){
				sphere(d=addition_width,$fn=40);
				translate([0,0,-addition_width])
				cube([addition_width*2, addition_width*2,addition_width*2],center=true);
			}
		}
	}
	else if (shape=="hridge"){
		if(addition_width>=1 && bottom_slope_mm>=1 && top_slope_mm>=.5){
			ridge(addition_width, bottom_slope_mm, top_slope_mm,0);
		}
	}	
	else if (shape=="vridge"){
		if(addition_height>=1 && bottom_slope_mm>=1 && top_slope_mm>=.5){
			ridge(addition_height, bottom_slope_mm, top_slope_mm,90);
		}
	}
	else if (shape=="ridge"){
		if(addition_width>=1 && bottom_slope_mm>=1 && top_slope_mm>=.5){
			ridge(addition_width, bottom_slope_mm, top_slope_mm,left_slope);
		}
	}
	else if (shape=="aridge1"){
		if(corner_radius>=1 && bottom_slope>=1 && top_slope>=.5){
			adj = corner_radius;
			translate([-adj,-adj,0])
			rotate([0,0,0])
			aridge(corner_radius, bottom_slope, top_slope);
		}
	}
	else if (shape=="aridge2"){
		if(corner_radius>=1 && bottom_slope>=1 && top_slope>=.5){
			adj = corner_radius;
			translate([-adj,adj,0])
			rotate([0,0,-90])
			aridge(corner_radius, bottom_slope, top_slope);
		}
	}
	else if (shape=="aridge3"){
		if(corner_radius>=1 && bottom_slope>=1 && top_slope>=.5){
			adj = corner_radius;
			translate([adj,adj,0])
			rotate([0,0,180])
			aridge(corner_radius, bottom_slope, top_slope);
		}
	}
	else if (shape=="aridge4"){
		if(corner_radius>=1 && bottom_slope>=1 && top_slope>=.5){
			adj = corner_radius;
			translate([adj,-adj,0])
			rotate([0,0,90])
			aridge(corner_radius, bottom_slope, top_slope);
		}
	}
	else if (shape=="svg"){
		if(addition_height>0 && addition_width>0 && corner_radius>0){
			rotate([0,0,-top_slope])
			resize([addition_width,addition_height,corner_radius])
			linear_extrude(height=corner_radius)
			offset(delta = .005)
			import(file = other,center=true);
		}
	}	
	else if (shape=="ttext"){
		f_s = 
			(bottom_slope==1)? "Liberation Sans:style=Bold"
		  : (bottom_slope==2)? "Liberation Sans:style=Italic"
		  : (bottom_slope==3)? "Liberation Sans:style=Bold Italic"
		  : "Liberation Sans";
		  
		// "left", "center" and "right"
		horiz = 
			(left_slope==1)? "left"
		  : (left_slope==2)? "center"
		  : (left_slope==3)? "right"
		  : "left";
		  
		// "top", "center", "baseline" and "bottom"
		vert = 
			(right_slope==1)? "bottom"
		  : (right_slope==2)? "baseline"
		  : (right_slope==3)? "center"
		  : (right_slope==4)? "top"
		  : "bottom";
		  
		if(addition_height>0 && corner_radius>0){
			rotate([0,0,top_slope])
			linear_extrude(height=corner_radius)
			text(str(other),font = f_s, size=addition_height,valign=vert,halign=horiz);
		}
	}	
}

module hridge(length, thickness, hi,rot){
	hite = hi + sata;
	rotate([0,0,rot])
	translate([0,-thickness/2,-sata])
	difference(){
		translate([0,0,0])
		rotate([90,0,0])
		rotate([0,90,0])
		linear_extrude(height=length)
		polygon([[0,0],[thickness,0],[thickness,hite-.5],[thickness-.5,hite],[.5,hite],[0,hite-.5]]);
		
		translate([0-fudge,thickness,hite-.5+fudge])
		rotate([90,0,0])
		linear_extrude(height=thickness)
		polygon([[0,0],[.5,.5],[0,.5]]);
	
		translate([length+fudge,thickness,hite-.5+fudge])
		rotate([90,0,0])
		linear_extrude(height=thickness)
		polygon([[0,0],[-.5,.5],[0,.5]]);
	}
}

module vridge(length, thickness, hi){
	hite = hi + sata;
	translate([thickness/2,0,-sata])
	difference(){
		rotate([0,0,180])
		rotate([90,0,0])
		linear_extrude(height=length)
		polygon([[0,0],[thickness,0],[thickness,hite-.5],[thickness-.5,hite],[.5,hite],[0,hite-.5]]);
		
		translate([0,length+fudge,hite-.5+fudge])
		rotate([0,0,-90])
		rotate([90,0,0])
		linear_extrude(height=thickness)
		polygon([[0,0],[.5,.5],[0,.5]]);
	
		translate([0,0-fudge,hite-.5+fudge])
		rotate([0,0,-90])
		rotate([90,0,0])
		linear_extrude(height=thickness)
		polygon([[0,0],[-.5,.5],[0,.5]]);
	}
}

module ridge(length, thickness, hi,rot){
	hite = hi + sata;
	rotate([0,0,rot])
	translate([0,-thickness/2,-sata])
	difference(){
		translate([0,0,0])
		rotate([90,0,0])
		rotate([0,90,0])
		linear_extrude(height=length)
		polygon([[0,0],[thickness,0],[thickness,hite-.5],[thickness-.5,hite],[.5,hite],[0,hite-.5]]);
		
		translate([0-fudge,thickness,hite-.5+fudge])
		rotate([90,0,0])
		linear_extrude(height=thickness)
		polygon([[0,0],[.5,.5],[0,.5]]);
	
		translate([length+fudge,thickness,hite-.5+fudge])
		rotate([90,0,0])
		linear_extrude(height=thickness)
		polygon([[0,0],[-.5,.5],[0,.5]]);
	}
}

module aridge(radius, thickness, hi){
	hite = hi + sata;
	translate([-1,-1,-sata])
	difference(){
		translate([-thickness+1,-thickness+1,0])
		rounded_rectangle_wall((radius+thickness)*2,(radius+thickness)*2,radius,thickness,hite);
	
		translate([0,-(radius+thickness)*2,hite/2])
		cube([(radius+thickness)*8,(radius+thickness)*4,hite+2],center=true);
		
		translate([-(radius+thickness)*2,0,hite/2])
		cube([(radius+thickness)*4,(radius+thickness)*8,hite+2],center=true);
	}
}

module create_clip(clip_reach,clip_width){
	base_thickness = 4;
	clip_thickness = 3;
	strap_cut = clip_width-4;

	difference(){
		union(){
			//base leg
			translate([-clip_bottom_length,-base_thickness,0])
			cube([clip_bottom_length+clip_thickness,base_thickness,clip_width]);

			//vertical leg
			translate([0,0,0])
			cube([clip_thickness,case_thick,clip_width]);

			//reach leg
			translate([-clip_reach,case_thick,0])
			cube([clip_reach+clip_thickness,clip_thickness,clip_width]);

			//spur
			translate([-clip_reach,case_thick,0])
			linear_extrude(height = clip_width)
			polygon(points=[[0,0],[1,-3],[3,-3],[2,0]]);
		}

		//chamfers for short edges of reach leg
		translate([clip_thickness-2,case_thick+clip_thickness-2,-fudge])
		linear_extrude(height = clip_width + fudge*2)
		polygon(points=[[0,2.1],[2.1,2.1],[2.1,0]]);
		translate([-clip_reach-fudge,case_thick+clip_thickness-2,-fudge])
		linear_extrude(height = clip_width + fudge*2)
		polygon(points=[[0,0],[0,2.1],[2.1,2.1]]);

		//chamfers for vertical leg
		translate([1,-base_thickness-fudge,2])
		rotate([-90,0,0])
		linear_extrude(height = base_thickness+case_thick+clip_thickness + fudge*2)
		polygon(points=[[0,2.1],[2.1,2.1],[2.1,0]]);
		translate([1,-base_thickness-fudge,clip_width+fudge])
		rotate([-90,0,0])
		linear_extrude(height = base_thickness+case_thick+clip_thickness + fudge*2)
		polygon(points=[[0,0],[2.1,0],[2.1,2.1]]);

		//chamfers for long edges of reach leg
		translate([-clip_reach,case_thick+clip_thickness-2,2-fudge])
		rotate([0,90,0])
		linear_extrude(height = clip_reach+clip_thickness + fudge*2)
		polygon(points=[[0,2.1],[2.1,2.1],[2.1,0]]);
		translate([clip_thickness,case_thick+clip_thickness+fudge,clip_width-2])
		rotate([0,-90,0])
		linear_extrude(height = clip_reach+clip_thickness + fudge*2)
		polygon(points=[[0,0],[2.1,0],[2.1,-2.1]]);
		
		//recess for bumper
		if (clip_bottom_length>=30){
			translate([-8+clip_thickness,-base_thickness+1,clip_width/2])
			rotate([90,0,0])
			cylinder(d=11,h=1.05);
		}

		//slots for strap
		translate([-clip_bottom_length+7.5-fudge,0,clip_width/2])
		union(){
			translate([0,-5,0])
			cube([15,2,strap_cut],center=true);
			
			translate([0,0,0])
			cube([15,2,strap_cut],center=true);
			
			translate([-2.5,-3,0])
			cube([5,6,strap_cut],center=true);
			
			translate([5,-3,0])
			cube([5,6,strap_cut],center=true);
		}
	}
}

module create_mini_clip1(clip_reach,clip_width){
	base_thickness = 4;
	clip_thickness = 5;
	strap_cut = clip_width-4;

	difference(){
		union(){
			//vertical leg
			translate([0,0,0])
			cube([clip_thickness,case_thick,clip_width]);

			//reach leg
			translate([-clip_reach,case_thick,0])
			cube([clip_reach+clip_thickness,clip_thickness,clip_width]);

			//spur
			translate([-clip_reach,case_thick,0])
			linear_extrude(height = clip_width)
			polygon(points=[[0,0],[1,-3],[3,-3],[2,0]]);
		}

		//chamfers for short edges of reach leg
		translate([clip_thickness-2,case_thick+clip_thickness-2,-fudge])
		linear_extrude(height = clip_width + fudge*2)
		polygon(points=[[0,2.1],[2.1,2.1],[2.1,0]]);
		translate([-clip_reach-fudge,case_thick+clip_thickness-2,-fudge])
		linear_extrude(height = clip_width + fudge*2)
		polygon(points=[[0,0],[0,2.1],[2.1,2.1]]);

		//chamfers for vertical leg
		translate([3,-base_thickness-fudge,2])
		rotate([-90,0,0])
		linear_extrude(height = base_thickness+case_thick+clip_thickness + fudge*2)
		polygon(points=[[0,2.1],[2.1,2.1],[2.1,0]]);
		translate([3,-base_thickness-fudge,clip_width+fudge])
		rotate([-90,0,0])
		linear_extrude(height = base_thickness+case_thick+clip_thickness + fudge*2)
		polygon(points=[[0,0],[2.1,0],[2.1,2.1]]);

		//chamfers for long edges of reach leg
		translate([-clip_reach,case_thick+clip_thickness-2,2-fudge])
		rotate([0,90,0])
		linear_extrude(height = clip_reach+clip_thickness + fudge*2)
		polygon(points=[[0,2.1],[2.1,2.1],[2.1,0]]);
		translate([clip_thickness,case_thick+clip_thickness+fudge,clip_width-2])
		rotate([0,-90,0])
		linear_extrude(height = clip_reach+clip_thickness + fudge*2)
		polygon(points=[[0,0],[2.1,0],[2.1,-2.1]]);
		
		//slots for strap
		translate([-1+fudge,7.5-fudge,clip_width/2])
		rotate([0,0,90])
		union(){
			translate([0,-1,0])
			cube([15,2,strap_cut],center=true);
			
			translate([-2.5,-3,0])
			cube([5,6,strap_cut],center=true);
			
			translate([5,-3,0])
			cube([5,6,strap_cut],center=true);
		}
	}
}

module create_mini_clip2(clip_reach,clip_width){
	base_thickness = 4;
	clip_thickness = 5;
	strap_cut = clip_width-4;

	difference(){
		union(){
			//reach leg
			translate([-clip_reach,case_thick,0])
			cube([clip_reach+clip_thickness,clip_thickness,clip_width]);

			//spur
			translate([-clip_reach,case_thick,0])
			linear_extrude(height = clip_width)
			polygon(points=[[0,0],[1,-3],[3,-3],[2,0]]);
		}

		//chamfers for short edges of reach leg
		translate([clip_thickness-2,case_thick+clip_thickness-2,-fudge])
		linear_extrude(height = clip_width + fudge*2)
		polygon(points=[[0,2.1],[2.1,2.1],[2.1,0]]);
		translate([-clip_reach-fudge,case_thick+clip_thickness-2,-fudge])
		linear_extrude(height = clip_width + fudge*2)
		polygon(points=[[0,0],[0,2.1],[2.1,2.1]]);

		//chamfers for vertical leg
		translate([3,-base_thickness-fudge,2])
		rotate([-90,0,0])
		linear_extrude(height = base_thickness+case_thick+clip_thickness + fudge*2)
		polygon(points=[[0,2.1],[2.1,2.1],[2.1,0]]);
		translate([3,-base_thickness-fudge,clip_width+fudge])
		rotate([-90,0,0])
		linear_extrude(height = base_thickness+case_thick+clip_thickness + fudge*2)
		polygon(points=[[0,0],[2.1,0],[2.1,2.1]]);

		//chamfers for long edges of reach leg
		translate([-clip_reach,case_thick+clip_thickness-2,2-fudge])
		rotate([0,90,0])
		linear_extrude(height = clip_reach+clip_thickness + fudge*2)
		polygon(points=[[0,2.1],[2.1,2.1],[2.1,0]]);
		translate([clip_thickness,case_thick+clip_thickness+fudge,clip_width-2])
		rotate([0,-90,0])
		linear_extrude(height = clip_reach+clip_thickness + fudge*2)
		polygon(points=[[0,0],[2.1,0],[2.1,-2.1]]);
		
		//slots for strap
		translate([-2.4,case_thickness-1+fudge,clip_width/2])
		rotate([180,180,0])
		union(){
			translate([0,-1,0])
			cube([15,2,strap_cut],center=true);
			
			translate([-2.5,-3,0])
			cube([5,6,strap_cut],center=true);
			
			translate([5,-3,0])
			cube([5,6,strap_cut],center=true);
		}
	}
}

module base_keyguard(wid,hei,crad,thickness,cheat){
	difference(){
		if (have_a_case=="no"){
			difference(){
				translate([0,0,-thickness/2])
				case_opening_blank(tablet_width,tablet_height,tablet_corner_radius,thickness,cheat);
				
				if (type_of_keyguard=="3D-Printed"){  //add chamfer
					translate([0,0,-thickness/2+fudge])
					for (i = [1:1:chamfer_slices]) { 
						chamfer_slice(i,tablet_width,tablet_height,tablet_corner_radius,thickness,cheat);
					}
				}
			}
		}
		else{
			difference(){
				translate([0,0,-thickness/2])
				case_opening_blank(wid,hei,crad,thickness,cheat);
				
				if (type_of_keyguard=="3D-Printed"){  //add chamfer
					translate([0,0,-thickness/2+fudge])
					for (i = [1:1:chamfer_slices]) { 
						chamfer_slice(i,wid,hei,crad,thickness,cheat);
					}
				}
			}
		}
		
			// if(kt>sat){
				// sunk_h = screen_height - tec - bec + 2;
				// sunk_w = screen_width - lec - rec + 2;
				
				// y_offset =  -tec/2 + bec/2 ;
				// x_offset = lec/2 - rec/2;
				// z_offset = thickness/2+fudge - (thickness-sat+fudge)/2;

				// translate([x_offset+unequal_left_side_offset,y_offset-fudge/2+unequal_bottom_side_offset,z_offset])
				// hole_cutter(sunk_w,sunk_h+fudge,90,90,90,90,3,thickness-sat+fudge);
			// }
		// }
		// if(thickness>sat){
			// sunk_h = screen_height - tec - bec;
			// sunk_w = screen_width - lec - rec;
			// y_offset = -tec/2 + bec/2 ;
			// x_offset = lec/2 - rec/2;
			// z_offset = thickness/2+fudge - (thickness-sat+fudge)/2;
			
			// ulso = (cheat=="no") ? unequal_left_side_offset : 0;
			// ubso = (cheat=="no") ? unequal_bottom_side_offset : 0;
			
			
			// left_offset = x_offset+ ulso;
			// bottom_offset = y_offset + ubso;

			// if ((generate=="keyguard" || generate=="first half of keyguard" || generate=="second half of keyguard") && cheat=="no"){
				// translate([left_offset,bottom_offset,z_offset])
				// hole_cutter(sunk_w+fudge*2,sunk_h+fudge*2,90,90,90,90,fudge*2,thickness-sat+fudge);
			// }
			// else if (have_a_keyguard_frame=="yes" && generate=="keyguard frame" && cheat=="yes"){
				// intersection(){
						// translate([left_offset,bottom_offset,0])
						// hole_cutter(keyguard_width,keyguard_height,90,90,90,90,kcr,thickness);
					
						// translate([left_offset,bottom_offset,z_offset])
						// hole_cutter(sunk_w+fudge*2,sunk_h+fudge*2,90,90,90,90,fudge*2,thickness-sat+fudge);
				// }
			// }
		// }
	}
}

module chamfer_slice(layer,width,height,corner_radius,thickness, cheat){
	slice_width = chamfer_slice_size*(chamfer_slices-layer+1);
	slice_height = thickness-chamfer_slice_size*layer;
	
	translate([0,0,slice_height])
	linear_extrude(height=chamfer_slice_size+fudge)
	difference(){
		offset(delta=fudge)
		case_opening_blank_2d(width,height,corner_radius,cheat);

		offset(delta=-slice_width)
		case_opening_blank_2d(width,height,corner_radius,cheat);
	}
}

module case_opening_blank(width,heigt,corner_radius,thickness,cheat){
	if (thickness > 0){
		linear_extrude(height=thickness)
		case_opening_blank_2d(width,heigt,corner_radius,cheat);
	}
	else{ //to be laser cut
		case_opening_blank_2d(width,heigt,corner_radius,cheat);
	}
}

module case_opening_blank_2d(shape_x,shape_y,corner_radius,cheat){
	difference(){
		union(){
			//core keyguard
			offset(r=corner_radius)
			square([shape_x-corner_radius*2,shape_y-corner_radius*2],center=true);
			
			if(add_symmetric_openings=="no" && !(generate=="keyguard" && have_a_keyguard_frame=="yes") && have_a_case=="yes" && trim_to_screen=="no" && len(case_additions)>0 && cheat=="no"){
				add_case_full_height_shapes(case_additions,"add");
			}
		}
	
		if(add_symmetric_openings=="no" && !(generate=="keyguard" && have_a_keyguard_frame=="yes") && have_a_case=="yes" && trim_to_screen=="no" && len(case_additions)>0 && cheat=="no"){
			add_case_full_height_shapes(case_additions,"sub");
		}
	
	}
}

module add_case_full_height_shapes(c_a,type){
	x0 = (generate_keyguard) ? kx0 : case_x0;
	y0 = (generate_keyguard) ? ky0 : case_y0;
	
	for(i = [0 : len(c_a)-1]){
		addition = c_a[i]; //0:ID, 1:x, 2:y, 3:width,  4:height, 5:shape, 6:thickness, 7:trim_above, 8:trim_below, 9:trim_to_right, 10:trim_to_left, 11:corner_radius, 12:other
			
		addition_ID = addition[0];		
		addition_x = addition[1];
		addition_y = addition[2];
		addition_width = addition[3];
		addition_height = addition[4];
		addition_shape = addition[5];
		addition_thickness = addition[6];
		addition_trim_above = addition[7];
		addition_trim_below = addition[8];
		addition_trim_to_right = addition[9];
		addition_trim_to_left = addition[10];
		addition_corner_radius = addition[11];
		
		if(addition_shape != undef){
			if(addition_ID!="#"){
				if(type=="add" && search("-",addition_shape)==[]){
					if(addition_thickness==0){
						difference(){
							translate([x0+addition_x ,y0+addition_y])
							build_addition(addition_width, addition_height, addition_shape, addition_corner_radius);

							if (addition_trim_below > -999){
								translate([0,-kh+addition_trim_below])
								square([kw*2,kh*2],center=true);
							}
							if (addition_trim_above > -999){
								translate([0,kh+addition_trim_above])
								square([kw*2,kh*2],center=true);
							}
							if (addition_trim_to_right > -999){
								translate([addition_trim_to_right,0])
								square([kw*2,kh*2],center=true);
							}
							if (addition_trim_to_left > -999){
								translate([-kw+addition_trim_to_left,0])
								square([kw*2,kh*2],center=true);
							}
						}
					}
				}
				
				if(type=="sub" && search("-",addition_shape)!=[]){
					translate([x0+addition_x ,y0+addition_y])
					build_addition(addition_width, addition_height, addition_shape, addition_corner_radius);
				}
			}
			else{
				if(type=="add" && search("-",addition_shape)==[]){
					if(addition_thickness==0){
						difference(){
							translate([x0+addition_x ,y0+addition_y])
							#build_addition(addition_width, addition_height, addition_shape, addition_corner_radius);

							if (addition_trim_below > -999){
								translate([0,-kh+addition_trim_below])
								square([kw*2,kh*2],center=true);
							}
							if (addition_trim_above > -999){
								translate([0,kh+addition_trim_above])
								square([kw*2,kh*2],center=true);
							}
							if (addition_trim_to_right > -999){
								translate([addition_trim_to_right,0])
								square([kw*2,kh*2],center=true);
							}
							if (addition_trim_to_left > -999){
								translate([-kw+addition_trim_to_left,0])
								square([kw*2,kh*2],center=true);
							}
						}
					}
				}
				
				if(type=="sub" && search("-",addition_shape)!=[]){
					translate([x0+addition_x ,y0+addition_y])
					#build_addition(addition_width, addition_height, addition_shape, addition_corner_radius);
				}
			}
		}
	}
}


module build_addition(addition_width, addition_height, addition_shape, addition_corner_radius){
	if (addition_shape=="r" || addition_shape=="-r"){
		if (addition_width > 0 && addition_height > 0){
			square([addition_width,addition_height]);
		}
	}
	else if (addition_shape=="cr" || addition_shape=="-cr"){
		if (addition_width > 0 && addition_height > 0){
			square([addition_width,addition_height],center=true);
		}
	}
	else if (addition_shape=="r1" || addition_shape=="-r3"){
		if (addition_width > 0 && addition_height > 0){
			translate([0,addition_height/2-fudge])
			square([addition_width,addition_height],center=true);
		}
	}
	else if (addition_shape=="r2" || addition_shape=="-r4"){
		if (addition_width > 0 && addition_height > 0){
			translate([addition_width/2-fudge,0])
			square([addition_width,addition_height],center=true);
		}
	}
	else if (addition_shape=="r3" || addition_shape=="-r1"){
		if (addition_width > 0 && addition_height > 0){
			translate([0,-addition_height/2+fudge])
			square([addition_width,addition_height],center=true);
		}
	}
	else if (addition_shape=="r4" || addition_shape=="-r2"){
		if (addition_width > 0 && addition_height > 0){
			translate([-addition_width/2+fudge,0])
			square([addition_width,addition_height],center=true);
		}
	}
	else if (addition_shape=="c" || addition_shape=="-c"){
		if (addition_height > 0){
			circle(d=addition_height);
		}
	}
	else if (addition_shape=="t1" || addition_shape=="-t1"){
		translate([-fudge,-fudge])
		if (addition_width > 0 && addition_height > 0){
			polygon([[0,0],[addition_width,0],[0,addition_height]]);
		}
	}
	else if (addition_shape=="t2" || addition_shape=="-t2"){
		translate([-fudge,fudge])
		if (addition_width > 0 && addition_height > 0){
			polygon([[0,0],[addition_width,0],[0,-addition_height]]);
		}
	}
	else if (addition_shape=="t4" || addition_shape=="-t4"){
		translate([fudge,-fudge])
		if (addition_width > 0 && addition_height > 0){
			polygon([[0,0],[-addition_width,0],[0,addition_height]]);
		}
	}
	else if (addition_shape=="t3" || addition_shape=="-t3"){
		translate([fudge,fudge])
		if (addition_width > 0 && addition_height > 0){
			polygon([[0,0],[-addition_width,0],[0,-addition_height]]);
		}
	}
	else if (addition_shape=="f1" || addition_shape=="-f1"){
		translate([-fudge,-fudge])
		if (addition_width > 0){
			difference(){
				translate([0,0])
				square([addition_width,addition_width]);
				translate([addition_width,addition_width])
				circle(r=addition_width);
			}
		}
	}
	else if (addition_shape=="f2" || addition_shape=="-f2"){
		translate([-fudge,fudge])
		if (addition_width > 0){
			difference(){
				translate([0,-addition_width])
				square([addition_width,addition_width]);
				translate([addition_width,-addition_width])
				circle(r=addition_width);
			}
		}
	}
	else if (addition_shape=="f3" || addition_shape=="-f3"){
		translate([fudge,fudge])
		if (addition_width > 0){
			difference(){
				translate([-addition_width,-addition_width])
				square([addition_width,addition_width]);
				translate([-addition_width,-addition_width])
				circle(r=addition_width);
			}
		}
	}
	else if (addition_shape=="f4" || addition_shape=="-f4"){
		translate([fudge,-fudge])
		if (addition_width > 0){
			difference(){
				translate([-addition_width,0])
				square([addition_width,addition_width]);
				translate([-addition_width,addition_width])
				circle(r=addition_width);
			}
		}
	}
	else if (addition_shape=="cm1" || addition_shape=="-cm3"){
		if (addition_width > 0 && addition_height > 0){
			$fn=360;

			d1 = addition_height;
			d2 = addition_width/2;
			Cx = (d2*d2)/(2*d1) - d1/2;
			radius = Cx + d1;

			translate([0,-fudge])
			rotate([0,0,90])
			difference(){
				translate([-Cx,0])
				circle(r=radius);

				translate([-radius*2-10,-radius-5-fudge])
				square([radius*2+10,radius*2+10]);
				
			}
		}
	}
	else if (addition_shape=="cm2" || addition_shape=="-cm4"){
		if (addition_width > 0 && addition_height > 0){
			$fn=360;

			d1 = addition_width;
			d2 = addition_height/2;
			Cx = (d2*d2)/(2*d1) - d1/2;
			radius = Cx + d1;
			
			translate([-fudge,0])
			difference(){
				translate([-Cx,0])
				circle(r=radius);

				translate([-radius*2-10-fudge,-radius-5])
				square([radius*2+10,radius*2+10]);
			}
		}
	}
	else if (addition_shape=="cm3" || addition_shape=="-cm1"){
		if (addition_width > 0 && addition_height > 0){
			$fn=360;

			d1 = addition_height;
			d2 = addition_width/2;
			Cx = (d2*d2)/(2*d1) - d1/2;
			radius = Cx + d1;

			translate([0,fudge])
			rotate([0,0,-90])
			difference(){
				translate([-Cx,0])
				circle(r=radius);

				translate([-radius*2-10,-radius-5+fudge])
				square([radius*2+10,radius*2+10]);
				
			}
		}
	}
	else if (addition_shape=="cm4" || addition_shape=="-cm2"){
		if (addition_width > 0 && addition_height > 0){
			$fn=360;

			d1 = addition_width;
			d2 = addition_height/2;
			Cx = (d2*d2)/(2*d1) - d1/2;
			radius = Cx + d1;

			translate([fudge,0])
			difference(){
				translate([Cx,0])
				circle(r=radius);

				translate([0+fudge,-radius-5])
				square([radius*2+10,radius*2+10]);
			}
		}
	}
	else if (addition_shape=="rr" || addition_shape=="-rr"){
		if (addition_width > 0 && addition_height > 0){
			translate([addition_corner_radius,addition_corner_radius])
			offset(r=addition_corner_radius)
			square([addition_width-addition_corner_radius*2,addition_height-addition_corner_radius*2]);
		}
	}
	else if (addition_shape=="crr" || addition_shape=="-crr"){
		if (addition_width > 0 && addition_height > 0){
			offset(r=addition_corner_radius)
			square([addition_width-addition_corner_radius*2,addition_height-addition_corner_radius*2],center=true);
		}
	}
	else if (addition_shape=="rr1" || addition_shape=="-rr3"){
		rotate([0,0,0])
		translate([0,-fudge])
		if (addition_width > 0 && addition_height > 0){
			half_rounded_rectangle(addition_height,addition_width,addition_corner_radius);
		}
	}
	else if (addition_shape=="rr2" || addition_shape=="-rr4"){
		translate([-fudge,0])
		rotate([0,0,-90])
		if (addition_width > 0 && addition_height > 0){
			half_rounded_rectangle(addition_width,addition_height,addition_corner_radius);
		}
	}
	else if (addition_shape=="rr3" || addition_shape=="-rr1"){
		translate([0,fudge])
		rotate([0,0,180])
		if (addition_width > 0 && addition_height > 0){
			half_rounded_rectangle(addition_height,addition_width,addition_corner_radius);
		}
	}		
	else if (addition_shape=="rr4" || addition_shape=="-rr2"){
		translate([fudge,0])
		rotate([0,0,90])
		if (addition_width > 0 && addition_height > 0){
			half_rounded_rectangle(addition_width,addition_height,addition_corner_radius);
		}
	}
}

module half_rounded_rectangle(h1,w1,cr){
	difference(){
        translate([-w1/2,0,0])
        square([w1,h1]);
        
        translate([-w1/2+cr-fudge,h1-cr+fudge,0])
        difference(){
			square(size=cr*2,center=true);
            circle(cr);
            translate([0,-cr/2-fudge,0])
            square([(cr+fudge)*2,cr+fudge],center=true);
            
            translate([cr/2+fudge,0,0])
            square([cr+fudge,(cr+fudge)*2],center=true);
		}

        translate([w1/2-cr+fudge,h1-cr+fudge,0])
        difference(){
			square(size=cr*2,center=true);
            circle(cr);
            translate([0,-cr/2-fudge,0])
            square([(cr+fudge)*2,cr+fudge],center=true);
            
            translate([-cr/2-fudge,0,0])
            square([cr+fudge,(cr+fudge)*2],center=true);
		}
    }
}

module add_flex_height_shapes(c_a){
	if (len(c_a)>0){
		for(i = [0 : len(c_a)-1]){
			addition = c_a[i]; //0:ID, 1:x, 2:y, 3:width,  4:height, 5:shape, 6:thickness, 7:trim_above, 8:trim_below, 9:trim_to_right, 10:trim_to_left, 11:corner_radius, 12:other

			addition_ID = addition[0];
			addition_x = addition[1];
			addition_y = addition[2];
			addition_width = addition[3];
			addition_height = addition[4];
			addition_thickness = (type_of_keyguard=="Laser-Cut" && generate=="first layer for SVG/DXF file") ? 0 : addition[6];
			addition_shape = addition[5];
			addition_trim_above = addition[7];
			addition_trim_below = addition[8];
			addition_trim_to_right = addition[9];
			addition_trim_to_left = addition[10];
			addition_corner_radius = addition[11];

			if(addition_thickness>0){
				translate([0,0,-kt/2])
				linear_extrude(height=addition_thickness)
				if(addition_ID=="#"){
						#build_trimmed_addition(addition_x,addition_y,addition_width, addition_height, addition_shape, addition_trim_above, addition_trim_below, addition_trim_to_right, addition_trim_to_left,addition_corner_radius);
				}
				else{
						build_trimmed_addition(addition_x,addition_y,addition_width, addition_height, addition_shape, addition_trim_above, addition_trim_below, addition_trim_to_right, addition_trim_to_left,addition_corner_radius);
				}
			}
			else{
				if(addition_ID=="#"){
						#build_trimmed_addition(addition_x,addition_y,addition_width, addition_height, addition_shape, addition_trim_above, addition_trim_below, addition_trim_to_right, addition_trim_to_left,addition_corner_radius);
				}
				else{
						build_trimmed_addition(addition_x,addition_y,addition_width, addition_height, addition_shape, addition_trim_above, addition_trim_below, addition_trim_to_right, addition_trim_to_left,addition_corner_radius);
				}
			}
		}
	}
}

module build_trimmed_addition(addition_x,addition_y,addition_width, addition_height, addition_shape, addition_trim_above, addition_trim_below, addition_trim_to_right, addition_trim_to_left,addition_corner_radius){
	x0 = (generate_keyguard) ? kx0 : case_x0;
	y0 = (generate_keyguard) ? ky0 : case_y0;
	
	difference(){
		translate([x0+addition_x ,y0+addition_y])
		build_addition(addition_width, addition_height, addition_shape, addition_corner_radius);

		if (addition_trim_below > -999){
			translate([0,-kh+addition_trim_below])
			square([kw*2,kh*2],center=true);
		}
		if (addition_trim_above > -999){
			translate([0,kh+addition_trim_above])
			square([kw*2,kh*2],center=true);
		}
		if (addition_trim_to_right > -999){
			translate([addition_trim_to_right,0])
			square([kw*2,kh*2],center=true);
		}
		if (addition_trim_to_left > -999){
			translate([-kw+addition_trim_to_left,0])
			square([kw*2,kh*2],center=true);
		}
	}
}


module add_case_cylinders(case_posts){
	x0 = (generate_keyguard) ? kx0 : case_x0;
	y0 = (generate_keyguard) ? ky0 : case_y0;
	
	for(i = [0 : len(case_posts)-1]){
		addition = case_posts[i]; //0:ID, 1:x, 2:y, 3:width,  4:height, 5:shape, 6:thickness, 7:trim_above, 8:trim_below, 9:trim_to_right, 10:trim_to_left, 11:corner_radius, 12:other
		
		addition_x = addition[1];
		addition_y = addition[2];
		addition_width = addition[3];
		addition_height = addition[4];
		s = addition[5];
		addition_shape = ((s=="rr1" || s=="rr2" || s=="rr3" || s=="rr4")  && addition[11]==0) ? "r" : s;
		addition_thickness = addition[6];
			
		translate([addition_x,addition_y])
		if (addition_shape=="cyl1"){
			if (addition_width > 0){
				translate([x0,y0+addition_width/2-fudge,-kt/2+addition_thickness/2+addition_height])
				rotate([0,0,90])
				rotate([0,90,0])
				cylinder(d=addition_thickness,h=addition_width,center=true);
			}
		}
		else if (addition_shape=="cyl2"){
			if (addition_width > 0){
				translate([x0+addition_width/2-fudge,y0,-kt/2+addition_thickness/2+addition_height])
				rotate([0,90,0])
				cylinder(d=addition_thickness,h=addition_width,center=true);
			}
		}
		else if (addition_shape=="cyl3"){
			if (addition_width > 0){
				translate([x0,y0-addition_width/2+fudge,-kt/2+addition_thickness/2+addition_height])
				rotate([0,0,90])
				rotate([0,90,0])
				cylinder(d=addition_thickness,h=addition_width,center=true);
			}
		}
		else if (addition_shape=="cyl4"){
			if (addition_width > 0){
				translate([x0-addition_width/2+fudge,y0,-kt/2+addition_thickness/2+addition_height])
				rotate([0,90,0])
				cylinder(d=addition_thickness,h=addition_width,center=true);
			}
		}
	}
}
module add_manual_mount_slide_in_tabs(c_a){
	x0 = (generate_keyguard) ? kx0 : case_x0;
	y0 = (generate_keyguard) ? ky0 : case_y0;
	
	for(i = [0 : len(c_a)-1]){
		addition = c_a[i]; //0:ID, 1:x, 2:y, 3:width,  4:height, 5:shape, 6:thickness, 7:trim_above, 8:trim_below, 9:trim_to_right, 10:trim_to_left, 11:corner_radius, 12:other
		
		addition_ID = addition[0];
		addition_x = addition[1];
		addition_y = addition[2];
		addition_width = addition[3];
		addition_height = addition[4];
		s = addition[5];
		addition_shape = ((s=="rr1" || s=="rr2" || s=="rr3" || s=="rr4")  && addition[11]==0) ? "r" : s;
		addition_thickness = addition[6];
		addition_corner_radius = addition[11];
			
		translate([addition_x,addition_y])
		if(addition_ID!="#"){
			if (addition_shape=="rr1"){
				translate([x0,y0,-kt/2])
				linear_extrude(height=addition_thickness)
				rotate([0,0,0])
				translate([0,-fudge])
				if (addition_width > 0 && addition_height > 0){
					half_rounded_rectangle(addition_height,addition_width,addition_corner_radius);
				}
			}
			else if (addition_shape=="rr2"){
				translate([x0,y0,-kt/2])
				linear_extrude(height=addition_thickness)
				translate([-fudge,0])
				rotate([0,0,-90])
				if (addition_width > 0 && addition_height > 0){
					half_rounded_rectangle(addition_width,addition_height,addition_corner_radius);
				}
}
			else if (addition_shape=="rr3"){
				translate([x0,y0,-kt/2])
				linear_extrude(height=addition_thickness)
				translate([0,fudge])
				rotate([0,0,180])
				if (addition_width > 0 && addition_height > 0){
					half_rounded_rectangle(addition_height,addition_width,addition_corner_radius);
				}
			}
			else if (addition_shape=="rr4"){
				translate([x0,y0,-kt/2])
				linear_extrude(height=addition_thickness)
				translate([fudge,0])
				rotate([0,0,90])
				if (addition_width > 0 && addition_height > 0){
					half_rounded_rectangle(addition_width,addition_height,addition_corner_radius);
				}
			}
		}
		else{
			if (addition_shape=="rr1"){
				translate([x0,y0,-kt/2])
				#linear_extrude(height=addition_thickness)
				rotate([0,0,0])
				translate([0,-fudge])
				if (addition_width > 0 && addition_height > 0){
					half_rounded_rectangle(addition_height,addition_width,addition_corner_radius);
				}
			}
			else if (addition_shape=="rr2"){
				translate([x0,y0,-kt/2])
				#linear_extrude(height=addition_thickness)
				translate([-fudge,0])
				rotate([0,0,-90])
				if (addition_width > 0 && addition_height > 0){
					half_rounded_rectangle(addition_width,addition_height,addition_corner_radius);
				}
}
			else if (addition_shape=="rr3"){
				translate([x0,y0,-kt/2])
				#linear_extrude(height=addition_thickness)
				translate([0,fudge])
				rotate([0,0,180])
				if (addition_width > 0 && addition_height > 0){
					half_rounded_rectangle(addition_height,addition_width,addition_corner_radius);
				}
			}
			else if (addition_shape=="rr4"){
				translate([x0,y0,-kt/2])
				#linear_extrude(height=addition_thickness)
				translate([fudge,0])
				rotate([0,0,90])
				if (addition_width > 0 && addition_height > 0){
					half_rounded_rectangle(addition_width,addition_height,addition_corner_radius);
				}
			}
		}
	}
}

module add_manual_mount_pedestals(c_a){
	x0 = (generate_keyguard) ? kx0 : case_x0;
	y0 = (generate_keyguard) ? ky0 : case_y0;
	
	for(i = [0 : len(c_a)-1]){
		addition = c_a[i]; //0:ID, 1:x, 2:y, 3:width,  4:height, 5:shape, 6:thickness, 7:trim_above, 8:trim_below, 9:trim_to_right, 10:trim_to_left, 11:corner_radius, 12:other
		
		addition_ID = addition[0];
		addition_x = addition[1];
		addition_y = addition[2];
		s = addition[5];
		addition_shape = ((s=="rr1" || s=="rr2" || s=="rr3" || s=="rr4")  && addition[11]==0) ? "r" : s;
			
		translate([addition_x,addition_y])
		if(addition_ID!="#"){
			if(addition_shape=="ped1"){
				translate([x0,y0-4.5,kt/2])
				rotate([0,0,-90])
				linear_extrude(height=pedestal_height,scale=.8)
				square([7,vertical_pedestal_width],center=true);
			}
			else if(addition_shape=="ped2"){
				translate([x0-4.5,y0,kt/2])
				rotate([0,0,0])
				linear_extrude(height=pedestal_height,scale=.8)
				square([7,horizontal_pedestal_width],center=true);
			}
			else if(addition_shape=="ped3"){
				translate([x0,y0+4.5,kt/2])
				rotate([0,0,-90])
				linear_extrude(height=pedestal_height,scale=.8)
				square([7,vertical_pedestal_width],center=true);
			}
			else if(addition_shape=="ped4"){
				translate([x0+4.5,y0,kt/2])
				rotate([0,0,0])
				linear_extrude(height=pedestal_height,scale=.8)
				square([7,horizontal_pedestal_width],center=true);
			}
		}
		else{
			if(addition_shape=="ped1"){
				translate([x0,y0-4.5,kt/2])
				rotate([0,0,-90])
				#linear_extrude(height=pedestal_height,scale=.8)
				square([7,vertical_pedestal_width],center=true);
			}
			else if(addition_shape=="ped2"){
				translate([x0-4.5,y0,kt/2])
				rotate([0,0,0])
				#linear_extrude(height=pedestal_height,scale=.8)
				square([7,horizontal_pedestal_width],center=true);
			}
			else if(addition_shape=="ped3"){
				translate([x0,y0+4.5,kt/2])
				rotate([0,0,-90])
				#linear_extrude(height=pedestal_height,scale=.8)
				square([7,vertical_pedestal_width],center=true);
			}
			else if(addition_shape=="ped4"){
				translate([x0+4.5,y0,kt/2])
				rotate([0,0,0])
				#linear_extrude(height=pedestal_height,scale=.8)
				square([7,horizontal_pedestal_width],center=true);
			}
		}
	}
}

module cut_manual_mount_pedestal_slots(c_a){
	x0 = (generate_keyguard) ? kx0 : case_x0;
	y0 = (generate_keyguard) ? ky0 : case_y0;
	
	for(i = [0 : len(c_a)-1]){
		addition = c_a[i]; //0:ID, 1:x, 2:y, 3:width,  4:height, 5:shape, 6:thickness, 7:trim_above, 8:trim_below, 9:trim_to_right, 10:trim_to_left, 11:corner_radius, 12:other
		
		addition_ID = addition[0];
		addition_x = addition[1];
		addition_y = addition[2];
		s = addition[5];
		addition_shape = ((s=="rr1" || s=="rr2" || s=="rr3" || s=="rr4")  && addition[11]==0) ? "r" : s;
			
		translate([x0+addition_x,y0+addition_y])
		if(addition_ID!="#"){
			if(addition_shape=="ped1"){
				translate([vertical_slot_width/2,-1.25-kec,vertical_offset])
				rotate([90,0,-90])
				linear_extrude(height = vertical_slot_width)
				polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
			}
			else if(addition_shape=="ped3"){
				translate([-vertical_slot_width/2,1.25+kec,vertical_offset])
				rotate([90,0,90])
				linear_extrude(height = vertical_slot_width)
				polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
			}
			else if(addition_shape=="ped2"){
				translate([-kec-1.25,-horizontal_slot_width/2,vertical_offset])
				rotate([90,0,180])
				linear_extrude(height = horizontal_slot_width)
				polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
			}
			else if(addition_shape=="ped4"){
				translate([kec+1.25,horizontal_slot_width/2,vertical_offset])
				rotate([90,0,0])
				linear_extrude(height = horizontal_slot_width)
				polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
			}
		}
		else{
			if(addition_shape=="ped1"){
				translate([vertical_slot_width/2,-1.25-kec,vertical_offset])
				rotate([90,0,-90])
				#linear_extrude(height = vertical_slot_width)
				polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
			}
			else if(addition_shape=="ped3"){
				translate([-vertical_slot_width/2,1.25+kec,vertical_offset])
				rotate([90,0,90])
				#linear_extrude(height = vertical_slot_width)
				polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
			}
			else if(addition_shape=="ped2"){
				translate([-kec-1.25,-horizontal_slot_width/2,vertical_offset])
				rotate([90,0,180])
				#linear_extrude(height = horizontal_slot_width)
				polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
			}
			else if(addition_shape=="ped4"){
				translate([kec+1.25,horizontal_slot_width/2,vertical_offset])
				rotate([90,0,0])
				#linear_extrude(height = horizontal_slot_width)
				polygon(points=[[0,0],[3,0],[4,3],[1,3]]);
			}
		}
	}
}
 

module trim_to_the_screen(){
	difference(){
		cube([1000,1000,100],true);
		cube([swm-2*fudge,shm-2*fudge,100+fudge*4],true);
	}
}

module trim_to_rectangle(){
	x0 = (generate_keyguard) ? kx0 : case_x0;
	y0 = (generate_keyguard) ? ky0 : case_y0;
	
	major_dim = (have_a_case=="no") ? max(tablet_width,tablet_height) : max(kw,kh);
	minor_dim = (have_a_case=="no") ? min(tablet_width,tablet_height): min(kw,kh);
	
	x1 = trim_to_rectangle_lower_left[0];
	y1 = trim_to_rectangle_lower_left[1];
	x2 = trim_to_rectangle_upper_right[0];
	y2 = trim_to_rectangle_upper_right[1];
	
	w1=x2-x1;
	h1=y2-y1;
	
	translate([x0+w1/2+x1,y0+h1/2+y1,0])
	difference(){
		final_rotation = (orientation=="landscape") ? [0,0,0] : [0,0,-90];
		
		rotate(final_rotation)
		cube([major_dim*3,minor_dim*3,kt+fudge*2],true);
		
		cube([w1-fudge,h1-fudge,kt+fudge*4],true);
	}
}

module cut_screen(){
	translate([screen_x0,screen_y0,-kt/2-fudge])
	cube([swm,shm,100]);
}

module snap_in_tab_grooves(){
	if (mount_keyguard_with=="snap-in tabs"){
		translate([keyguard_width/2-fudge,0,-keyguard_frame_thickness/2+kt/2])
		make_snap_ins(groove_size,groove_width);
		
		translate([-keyguard_width/2+fudge,0,-keyguard_frame_thickness/2+kt/2])
		rotate([0,0,180])
		make_snap_ins(groove_size,groove_width);

		translate([keyguard_width/2+.6,0,-keyguard_frame_thickness/2+kt/2-.05-fudge])
		cube([snap_in_size+.5,2,kt-.5],center=true);
	
		translate([-keyguard_width/2-.6,0,-keyguard_frame_thickness/2+kt/2-.05-fudge])
		cube([snap_in_size+.5,2,kt-.5],center=true);
	}

	translate([0,keyguard_height/2-fudge,-keyguard_frame_thickness/2+kt/2])
	rotate([0,0,90])
	make_snap_ins(groove_size,groove_width);

	translate([0,keyguard_height/2+.6,-keyguard_frame_thickness/2+kt/2-.05-fudge])
	cube([2,snap_in_size+.5,kt-.5],center=true);
		
	translate([0,-keyguard_height/2+fudge,-keyguard_frame_thickness/2+kt/2])
	rotate([0,0,-90])
	make_snap_ins(groove_size,groove_width);
	
	translate([0,-keyguard_height/2-.6,-keyguard_frame_thickness/2+kt/2-.05-fudge])
	cube([2,snap_in_size+.5,kt-.5],center=true);
}


module add_snap_ins(){
	if (mount_keyguard_with=="snap-in tabs"){
		translate([kw/2,0,0])
		make_snap_ins(snap_in_size,snap_in_width);
		translate([kw/2+.4,0,-.5])
		cube([snap_in_size,1.5,kt-1],center=true);
		
		translate([-kw/2,0,0])
		rotate([0,0,180])
		make_snap_ins(snap_in_size,snap_in_width);
		translate([-kw/2-.4,0,-.5])
		cube([snap_in_size,1.5,kt-1],center=true);
	}
	
	if(snap_in_tab_on_bottom_edge_of_keyguard=="yes" || mount_keyguard_with=="posts"){
		translate([0,-kh/2,0])
		rotate([0,0,-90])
		make_snap_ins(snap_in_size,snap_in_width);
		
		if(mount_keyguard_with=="snap-in tabs"){
			translate([0,-kh/2-.4,-.5])
			cube([1.5,snap_in_size,kt-1],center=true);
		}
	}

	if(snap_in_tab_on_top_edge_of_keyguard=="yes" && mount_keyguard_with=="snap-in tabs"){
		translate([0,kh/2,0])
		rotate([0,0,90])
		make_snap_ins(snap_in_size,snap_in_width);
		translate([0,kh/2+.4,-.5])
		cube([1.5,snap_in_size,kt-1],center=true);
	}
}

module make_snap_ins(size,width){
	rotate([-90,0,0])
	translate([0,0,-width/2])
	linear_extrude(height=width)
	polygon([[0,-size],[size,0],[0,size]]);
}


module show_screenshot(thickness){
	color("DarkMagenta",.5)
	translate([msh,msv,-thickness/2-0.5])
	resize([swm,shm,0])
	offset(delta = .005)
	import(file = "screenshot.svg",center=true);
}

module engrave_emboss_instruction(){
	x_start = (keyguard_region=="screen region") ? slide_horizontally/100 * swm : slide_horizontally/100 * cow;
	x = (keyguard_location == "top surface") ? x_start : -x_start;
	y = (keyguard_region=="screen region") ? slide_vertically/100 * shm : slide_vertically/100 * coh;
	
	x0 = (keyguard_region=="screen region" && keyguard_location == "top surface") ? sx0 :
	     (keyguard_region=="screen region" && keyguard_location == "bottom surface") ? -sx0 :
		 (keyguard_region=="case region" && keyguard_location == "top surface") ? cox0 :
		 -cox0;
		 
	t_height = text_height;
	shape = (keyguard_location == "top surface") ? "ttext" : "btext";
	top_slope = (text_angle=="vertical downward") ? -90 : 
	              (text_angle=="horizontal") ? 0 :
	              (text_angle=="vertical upward") ? 90 :
				  180;
	bottom_slope = (font_style=="normal") ? 0 :
	               (font_style=="bold") ? 1 :
				   (font_style=="italic") ? 2 :
				   3;
	left_slope = (text_horizontal_alignment=="left") ? 1 : 
	             (text_horizontal_alignment=="center") ? 2 :
				 3;
	right_slope = (text_vertical_alignment=="bottom") ? 1 : 
	              (text_vertical_alignment=="baseline") ? 2 :
	              (text_vertical_alignment=="center") ? 3 :
				  4;
	corner_radius = (type_of_keyguard=="Laser-Cut" && text_depth > 0) ? 0 : text_depth;
	other = text;
	depth = sat;
	
	if (keyguard_region=="screen region"){
		if (corner_radius > 0){
			translate([x0+x,sy0+y,sat-kt/2-fudge])
			#place_addition(10, t_height, shape, top_slope, top_slope, bottom_slope, bottom_slope, left_slope, right_slope, corner_radius, other);
		}
		else{
			translate([x0+x,sy0+y,fudge])
			#cut_opening(0, t_height, shape, top_slope, bottom_slope, left_slope, right_slope, corner_radius, other, depth*2,"screen");
		}
	}
	else{
		if (corner_radius > 0){
			translate([x0+x,coy0+y,kt/2-fudge])
			#place_addition(0, t_height, shape, top_slope, top_slope, bottom_slope, bottom_slope, left_slope, right_slope, corner_radius, other);
		}
		else{
			translate([x0+x,coy0+y,-fudge])
			#cut_opening(0, t_height, shape, top_slope, bottom_slope, left_slope, right_slope, corner_radius, other, depth+fudge*2,"case");
		}
	}
}

module echo_settings(){
	echo();
	echo(keyguard_designer_version=keyguard_designer_version);
	echo();
	echo();
	echo("Customizer Settings");
	echo();
	echo();

	echo("---- Keyguard Basics ----");
		if (type_of_keyguard != "3D-Printed") echo(type_of_keyguard = type_of_keyguard);
		if (keyguard_thickness != 4) echo(keyguard_thickness = keyguard_thickness);
		if (screen_area_thickness != 4) echo(screen_area_thickness = screen_area_thickness);
		echo();
		echo();

	echo("---- Tablet ----");
		if (type_of_tablet != "iPad 9th generation") echo(type_of_tablet = type_of_tablet);
		if (orientation != "landscape") echo(orientation = orientation);
		if (expose_home_button != "yes") echo(expose_home_button = expose_home_button);
		if (home_button_edge_slope!= 30) echo(home_button_edge_slope = home_button_edge_slope);
		if (expose_camera != "yes") echo(expose_camera = expose_camera);
		if (swap_camera_and_home_button != "no") echo(swap_camera_and_home_button = swap_camera_and_home_button);
		if (add_symmetric_openings != "no") echo(add_symmetric_openings = add_symmetric_openings);
		if (expose_ambient_light_sensors != "yes") echo(expose_ambient_light_sensors = expose_ambient_light_sensors);
		echo();
		echo();

	echo("---- Tablet Case ----");
		if (have_a_case != "yes") echo(have_a_case = have_a_case);
		if (height_of_opening_in_case != 175) echo(height_of_opening_in_case = height_of_opening_in_case);
		if (width_of_opening_in_case != 245) echo(width_of_opening_in_case = width_of_opening_in_case);
		if (case_opening_corner_radius != 5) echo(case_opening_corner_radius = case_opening_corner_radius);
		if (top_edge_compensation_for_tight_cases != 0) echo(top_edge_compensation_for_tight_cases = top_edge_compensation_for_tight_cases);
		if (bottom_edge_compensation_for_tight_cases != 0) echo(bottom_edge_compensation_for_tight_cases = bottom_edge_compensation_for_tight_cases);
		if (left_edge_compensation_for_tight_cases != 0) echo(left_edge_compensation_for_tight_cases = left_edge_compensation_for_tight_cases);
		if (right_edge_compensation_for_tight_cases != 0) echo(right_edge_compensation_for_tight_cases = right_edge_compensation_for_tight_cases);
		echo();
		echo();

	echo("---- App Layout in px ----");
		if (bottom_of_status_bar != 0) echo(bottom_of_status_bar = bottom_of_status_bar);
		if (bottom_of_upper_message_bar != 0) echo(bottom_of_upper_message_bar = bottom_of_upper_message_bar);
		if (bottom_of_upper_command_bar != 0) echo(bottom_of_upper_command_bar = bottom_of_upper_command_bar);
		if (top_of_lower_message_bar != 0) echo(top_of_lower_message_bar = top_of_lower_message_bar);
		if (top_of_lower_command_bar != 0) echo(top_of_lower_command_bar = top_of_lower_command_bar);
		echo();
		echo();

	echo("---- App Layout in mm ----");
		if (status_bar_height != 0) echo(status_bar_height = status_bar_height);
		if (upper_message_bar_height != 0) echo(upper_message_bar_height = upper_message_bar_height);
		if (upper_command_bar_height != 0) echo(upper_command_bar_height = upper_command_bar_height);
		if (lower_message_bar_height != 0) echo(lower_message_bar_height = lower_message_bar_height);
		if (lower_command_bar_height != 0) echo(lower_command_bar_height = lower_command_bar_height);
		echo();
		echo();

	echo("---- Bar Info ----");
		if (expose_status_bar != "no") echo(expose_status_bar = expose_status_bar);
		if (expose_upper_message_bar != "no") echo(expose_upper_message_bar = expose_upper_message_bar);
		if (expose_upper_command_bar != "no") echo(expose_upper_command_bar = expose_upper_command_bar);
		if (expose_lower_message_bar != "no") echo(expose_lower_message_bar = expose_lower_message_bar);
		if (expose_lower_command_bar != "no") echo(expose_lower_command_bar = expose_lower_command_bar);
		if (bar_edge_slope != 90) echo(bar_edge_slope = bar_edge_slope);
		if (bar_corner_radius != 2) echo(bar_corner_radius = bar_corner_radius);
		echo();
		echo();

	echo("---- Grid Info ----");
		if (number_of_rows != 3) echo(number_of_rows = number_of_rows);
		if (number_of_columns != 4) echo(number_of_columns = number_of_columns);
		if (cell_shape != "rectangular") echo(cell_shape = cell_shape);
		if (cell_height != 25) echo(cell_height = cell_height);
		if (cell_width != 25) echo(cell_width = cell_width);
		if (cell_corner_radius != 3) echo(cell_corner_radius = cell_corner_radius);
		if (cell_diameter != 15) echo(cell_diameter = cell_diameter);
		echo();
		echo();
	
	echo("---- Grid Special Settings ----");
		if (cell_edge_slope != 90) echo(cell_edge_slope = cell_edge_slope);
		if (cover_these_cells != []) echo(cover_these_cells = cover_these_cells);
		if (merge_cells_horizontally_starting_at != []) echo(merge_cells_horizontally_starting_at = merge_cells_horizontally_starting_at);
		if (merge_cells_vertically_starting_at != []) echo(merge_cells_vertically_starting_at = merge_cells_vertically_starting_at);
		if (add_a_ridge_around_these_cells != []) echo(add_a_ridge_around_these_cells = add_a_ridge_around_these_cells);
		if (height_of_ridge != 2) echo(height_of_ridge = height_of_ridge);
		if (thickness_of_ridge != 2) echo(thickness_of_ridge = thickness_of_ridge);
		if (cell_top_edge_slope != 90) echo(cell_top_edge_slope = cell_top_edge_slope);
		if (cell_bottom_edge_slope != 90) echo(cell_bottom_edge_slope = cell_bottom_edge_slope);
		if (top_padding != 0) echo(top_padding = top_padding);
		if (bottom_padding != 0) echo(bottom_padding = bottom_padding);
		if (left_padding != 0) echo(left_padding = left_padding);
		if (right_padding != 0) echo(right_padding = right_padding);
		echo();
		echo();

	echo("---- Mounting Method ----");
		if (mounting_method != "No Mount") echo(mounting_method = mounting_method);
		echo();
		echo();

	if(mounting_method=="Velcro"){
		echo("---- Velcro Info ----");
		if (velcro_size != 1) echo(velcro_size = velcro_size);
		echo();
		echo();
	}
	else if(mounting_method=="Clip-on Straps"){
		echo("---- Clip-on Straps Info ----");
		if (clip_locations != "horizontal only") echo(clip_locations= clip_locations);
		if (horizontal_clip_width != 20) echo(horizontal_clip_width= horizontal_clip_width);
		if (vertical_clip_width != 20) echo(vertical_clip_width= vertical_clip_width);
		if (distance_between_horizontal_clips != 60) echo(distance_between_horizontal_clips= distance_between_horizontal_clips);
		if (distance_between_vertical_clips != 40) echo(distance_between_vertical_clips= distance_between_vertical_clips);
		if (case_width != 220) echo(case_width = case_width);
		if (case_height != 220) echo(case_height = case_height);
		if (case_thickness != 15) echo(case_thickness = case_thickness);
		if (clip_bottom_length != 35) echo(clip_bottom_length = clip_bottom_length);
		if (case_to_screen_depth != 5) echo(case_to_screen_depth = case_to_screen_depth);
		if (unequal_left_side_of_case != 0) echo(unequal_left_side_of_case = unequal_left_side_of_case);
		if (unequal_bottom_side_of_case != 0) echo(unequal_bottom_side_of_case = unequal_bottom_side_of_case);
		echo();
		echo();
	}
	else if(mounting_method=="Posts"){
		echo("---- Posts Info ----");
		if (post_diameter != 4) echo(post_diameter= post_diameter);
		if (post_length != 5) echo(post_length= post_length);
		if (mount_to_top_of_opening_distance != 5) echo(mount_to_top_of_opening_distance= mount_to_top_of_opening_distance);
		if (notch_in_post != "yes") echo(notch_in_post= notch_in_post);
		if (add_mini_tabs != "no") echo(add_mini_tabs= add_mini_tabs);
		if (mini_tab_width != 10) echo(mini_tab_width= mini_tab_width);
		if (mini_tab_length != 2) echo(mini_tab_length= mini_tab_length);
		if (mini_tab_inset_distance != 20) echo(mini_tab_inset_distance= mini_tab_inset_distance);
		if (mini_tab_height != 1) echo(mini_tab_height= mini_tab_height);
		echo();
		echo();
	}
	else if(mounting_method=="Shelf"){
		echo("---- Shelf Info ----");
		if (shelf_thickness != 2) echo(shelf_thickness = shelf_thickness);
		if (shelf_depth != 3) echo(shelf_depth = shelf_depth);
		echo();
		echo();
	}
	else if(mounting_method=="Slide-in Tabs"){
		echo("---- Slide-in Tabs Info ----");
		if (slide_in_tab_locations != "horizontal only") echo(slide_in_tab_locations= slide_in_tab_locations);
		if (preferred_slide_in_tab_thickness != 2) echo(preferred_slide_in_tab_thickness = preferred_slide_in_tab_thickness);
		if (horizontal_slide_in_tab_length != 4) echo(horizontal_slide_in_tab_length = horizontal_slide_in_tab_length);
		if (vertical_slide_in_tab_length != 4) echo(vertical_slide_in_tab_length = vertical_slide_in_tab_length);
		if (horizontal_slide_in_tab_width != 20) echo(horizontal_slide_in_tab_width= horizontal_slide_in_tab_width);
		if (vertical_slide_in_tab_width != 20) echo(vertical_slide_in_tab_width= vertical_slide_in_tab_width);
		if (distance_between_horizontal_slide_in_tabs != 60) echo(distance_between_horizontal_slide_in_tabs= distance_between_horizontal_slide_in_tabs);
		if (distance_between_vertical_slide_in_tabs != 60) echo(distance_between_vertical_slide_in_tabs= distance_between_vertical_slide_in_tabs);
		echo();
		echo();
	}
	else if(mounting_method=="Raised Tabs"){
		echo("---- Raised Tabs Info ----");
		if (raised_tab_height != 6) echo(raised_tab_height= raised_tab_height);
		if (raised_tab_length != 8) echo(raised_tab_length= raised_tab_length);
		if (raised_tab_width != 20) echo(raised_tab_width= raised_tab_width);
		if (preferred_raised_tab_thickness != 2) echo(preferred_raised_tab_thickness= preferred_raised_tab_thickness);
		if (starting_height != 0) echo(starting_height = starting_height);
		if (ramp_angle != 30) echo(ramp_angle = ramp_angle);
		if (distance_between_raised_tabs != 60) echo(distance_between_raised_tabs= distance_between_raised_tabs);
		if (embed_magnets != "no") echo(embed_magnets = embed_magnets);
		if (magnet_size != "20 x 8 x 1.5") echo(magnet_size = magnet_size);
		echo();
		echo();
	}
	else{
		//No Mount
	}

	echo("---- Keyguard Frame Info ----");
		if (have_a_keyguard_frame != "no") echo(have_a_keyguard_frame = have_a_keyguard_frame);
		if (keyguard_frame_thickness != 5) echo(keyguard_frame_thickness = keyguard_frame_thickness);
		if (keyguard_height != 160) echo(keyguard_height = keyguard_height);
		if (keyguard_width != 210) echo(keyguard_width = keyguard_width);
		if (keyguard_corner_radius != 2) echo(keyguard_corner_radius = keyguard_corner_radius);
		if (mount_keyguard_with != "snap-in tabs") echo(mount_keyguard_with = mount_keyguard_with);
		if (snap_in_tab_on_top_edge_of_keyguard != "yes") echo(snap_in_tab_on_top_edge_of_keyguard = snap_in_tab_on_top_edge_of_keyguard);
		if (snap_in_tab_on_bottom_edge_of_keyguard != "yes") echo(snap_in_tab_on_bottom_edge_of_keyguard = snap_in_tab_on_bottom_edge_of_keyguard);
		if (post_tightness_of_fit != 0) echo(post_tightness_of_fit = post_tightness_of_fit);
		echo();
		echo();

	echo("---- Engraved/Embossed Text ----");
		if (text != "") echo(text = text);
		if (text_height != 5) echo(text_height = text_height);
		if (font_style != "normal") echo(font_style = font_style);
		if (keyguard_location != "top surface") echo(keyguard_location = keyguard_location);
		if (show_back_of_keyguard != "no") echo(show_back_of_keyguard = show_back_of_keyguard);
		if (keyguard_region != "screen region") echo(keyguard_region = keyguard_region);
		if (text_depth != -2) echo(text_depth = text_depth);
		if (text_horizontal_alignment != "center") echo(text_horizontal_alignment = text_horizontal_alignment);
		if (text_vertical_alignment != "center") echo(text_vertical_alignment = text_vertical_alignment);
		if (text_angle != "horizontal") echo(text_angle = text_angle);
		if (slide_horizontally != 0) echo(slide_horizontallyslide_horizontally = slide_horizontally);
		if (slide_vertically != 0) echo(slide_vertically = slide_vertically);
		echo();
		echo();

	echo("---- Cell Inserts ----");
		if (Braille_location != "above opening") echo(Braille_location = Braille_location);
		if (Braille_text != "") echo(Braille_text = Braille_text);
		if (Braille_size_multiplier != 10) echo(Braille_size_multiplier = Braille_size_multiplier);
		if (add_circular_opening != "yes") echo(add_circular_opening = add_circular_opening);
		if (diameter_of_opening != 10) echo(diameter_of_opening = diameter_of_opening);
		if (Braille_to_opening_distance != 5) echo(Braille_to_opening_distance = Braille_to_opening_distance);
		if (engraved_text != "") echo(engraved_text = engraved_text);
		if (insert_tightness_of_fit != 0) echo(insert_tightness_of_fit = insert_tightness_of_fit);
		if (insert_recess != 0) echo(insert_recess = insert_recess);
		echo();
		echo();

	echo("---- Free-form and Hybrid Keyguard Openings ----");
		if (unit_of_measure_for_screen != "px") echo(unit_of_measure_for_screen = unit_of_measure_for_screen);
		if (starting_corner_for_screen_measurements != "upper-left") echo(starting_corner_for_screen_measurements = starting_corner_for_screen_measurements);
		echo();
		echo();

	echo("---- Special Actions and Settings ----");
		if (include_screenshot != "no") echo(include_screenshot = include_screenshot);
		if (keyguard_display_angle != 0) echo(keyguard_display_angle = keyguard_display_angle);
		if (keyguard_vertical_tightness_of_fit != 0) echo(keyguard_vertical_tightness_of_fit = keyguard_vertical_tightness_of_fit);
		if (keyguard_horizontal_tightness_of_fit != 0) echo(keyguard_horizontal_tightness_of_fit = keyguard_horizontal_tightness_of_fit);
		if (split_line_location != 0) echo(split_line_location = split_line_location);
		if (split_line_type != "flat") echo(split_line_type = split_line_type);
		if (approx_dovetail_width != 4) echo(approx_dovetail_width = approx_dovetail_width);
		if (tightness_of_dovetail_joint != 5) echo(tightness_of_dovetail_joint = tightness_of_dovetail_joint);
		if (unequal_left_side_of_case_opening != 0) echo(unequal_left_side_of_case_opening = unequal_left_side_of_case_opening);
		if (unequal_bottom_side_of_case_opening != 0) echo(unequal_bottom_side_of_case_opening = unequal_bottom_side_of_case_opening);
		if (move_screenshot_horizontally != 0) echo(move_screenshot_horizontally = move_screenshot_horizontally);
		if (move_screenshot_vertically != 0) echo(move_screenshot_vertically = move_screenshot_vertically);
		if (keyguard_edge_chamfer != 0.7) echo(keyguard_edge_chamfer = keyguard_edge_chamfer);
		if (cell_edge_chamfer != 0.7) echo(cell_edge_chamfer = cell_edge_chamfer);
		if (trim_to_screen != "no") echo(trim_to_screen = trim_to_screen);
		if (cut_out_screen != "no") echo(cut_out_screen = cut_out_screen);
		if (first_two_layers_only != "no") echo(first_two_layers_only = first_two_layers_only);
		if (trim_to_rectangle_lower_left != []) echo(trim_to_rectangle_lower_left = trim_to_rectangle_lower_left);
		if (trim_to_rectangle_upper_right != []) echo(trim_to_rectangle_upper_right = trim_to_rectangle_upper_right);
		if (smoothness_of_circles_and_arcs != 40) echo(smoothness_of_circles_and_arcs = smoothness_of_circles_and_arcs);
		if (use_Laser_Cutting_best_practices != "yes") echo(use_Laser_Cutting_best_practices = use_Laser_Cutting_best_practices);
		if (other_tablet_general_sizes != []) echo(other_tablet_general_sizes = other_tablet_general_sizes);
		if (other_tablet_pixel_sizes != []) echo(other_tablet_pixel_sizes = other_tablet_pixel_sizes);
		echo();
		echo();
}

module issues(){
	if(have_a_case=="yes"){
		perimeter1 = (kh - shm)/2;
		perimeter1_offset = (expose_status_bar=="yes" && sbhm>0) ? 0 :
							(expose_upper_message_bar=="yes" && umbhm>0) ? sbhm :
							(expose_upper_command_bar=="yes" && ucbhm>0) ? sbhm + umbhm :
							sbhm + umbhm+ucbhm+hrw/2+top_padding-unequal_bottom_side_offset;
		top_perimeter = max(perimeter1+perimeter1_offset,top_edge_compensation_for_tight_cases);
		
		perimeter3 = (kh - shm)/2;
		perimeter3_offset = (expose_lower_command_bar=="yes" && lcbhm>0) ? 0 :
							(expose_lower_message_bar=="yes" && lmbhm>0) ? lcbhm :
							lcbhm+lmbhm+hrw/2+bottom_padding+unequal_bottom_side_offset;
		bottom_perimeter = max(perimeter3+perimeter3_offset,bottom_edge_compensation_for_tight_cases);
		
		perimeter2 = (kw - swm)/2;
		perimeter2_offset = (expose_status_bar=="yes" && sbhm>0) ? 0 :
							(expose_upper_message_bar=="yes" && umbhm>0) ? 0 :
							(expose_upper_command_bar=="yes" && ucbhm>0) ? 0 :
							(expose_lower_command_bar=="yes" && lcbhm>0) ? 0 :
							(expose_lower_message_bar=="yes" && lmbhm>0) ? 0 :
							vrw/2+right_padding-unequal_left_side_offset;
		right_perimeter = max(perimeter2+perimeter2_offset,right_edge_compensation_for_tight_cases);
		
		perimeter4 = (kw - swm)/2;
		perimeter4_offset = (expose_status_bar=="yes" && sbhm>0) ? 0 :
							(expose_upper_message_bar=="yes" && umbhm>0) ? 0 :
							(expose_upper_command_bar=="yes" && ucbhm>0) ? 0 :
							(expose_lower_command_bar=="yes" && lcbhm>0) ? 0 :
							(expose_lower_message_bar=="yes" && lmbhm>0) ? 0 :
							vrw/2+left_padding+unequal_left_side_offset;
		left_perimeter = max(perimeter4+perimeter4_offset,left_edge_compensation_for_tight_cases);
		

		if(top_perimeter<minimum__acrylic_rail_width) echo(str("!!!!!!! ISSUE !!!!!!! -- The top perimeter rail is: ", top_perimeter, " mm wide."));
		if(bottom_perimeter<minimum__acrylic_rail_width) echo(str("!!!!!!! ISSUE !!!!!!! -- The bottom perimeter rail is: ", bottom_perimeter, " mm wide."));
		if(right_perimeter<minimum__acrylic_rail_width) echo(str("!!!!!!! ISSUE !!!!!!! -- The right side perimeter rail is: ", right_perimeter, " mm wide."));
		if(left_perimeter<minimum__acrylic_rail_width) echo(str("!!!!!!! ISSUE !!!!!!! -- The left side perimeter rail is: ", left_perimeter, " mm wide."));
	}
}

module key_settings(){
	echo(str("******* SETTING ******** -- type of tablet: ", type_of_tablet));
	echo(str("******* SETTING ******** -- use Laser Cutting best practices: ", use_Laser_Cutting_best_practices));
	echo(str("******* SETTING ******** -- orientation: ", orientation));
	echo(str("******* SETTING ******** -- have a case? ", have_a_case));
	if(have_a_case=="yes"){
		echo(str("******* SETTING ******** -- height of opening in case: ", kh, " mm."));
		echo(str("******* SETTING ******** -- width of opening in case: ", kw, " mm."));
	}
	echo(str("******* SETTING ******** -- number of columns: ", number_of_columns));
	echo(str("******* SETTING ******** -- number of rows: ", number_of_rows));
	echo(str("******* SETTING ******** -- vertical rail width: ", vrw, " mm."));
	echo(str("******* SETTING ******** -- horizontal rail width: ", hrw, " mm."));
	echo(str("******* SETTING ******** -- mounting method: ", m_m));
	if(m_m=="Slide-in Tabs"){
		echo(str("******* SETTING ******** -- horizontal slide-in tab length: ", horizontal_slide_in_tab_length_incl_acrylic, " mm."));
		echo(str("******* SETTING ******** -- vertical slide-in tab length: ", vertical_slide_in_tab_length_incl_acrylic, " mm."));
		echo(str("******* SETTING ******** -- slide-in tab width: ", horizontal_slide_in_tab_width, " mm."));
	}
	echo();
	echo();
	
	echo(str("******* SETTING ******** -- number of custom screen openings: ",len(screen_openings)));
	echo(str("******* SETTING ******** -- number of custom case opeings: ",len(case_openings)));
	echo(str("******* SETTING ******** -- number of custom case additions: ",len(case_additions)));
	echo();
	echo();
}

module chamfered_cuboid (x, y, z, c){
	intersection(){	
		translate([0,0,-z/2])
		linear_extrude(height=z)
		offset(delta=c, chamfer=true)
		square([x-2*c,y-2*c],center=true);

		rotate([0,90,0])
		translate([0,0,-x/2])
		linear_extrude(height=x)
		offset(delta=c, chamfer=true)
		square([z-2*c,y-2*c],center=true);

		rotate([90,0,0])
		translate([0,0,-y/2])
		linear_extrude(height=y)
		offset(delta=c, chamfer=true)
		square([x-2*c,z-2*c],center=true);
	}
}

module chamfered_shape(x, y, z, c, cr){
	if (cell_shape=="rectangular"){
		hull(){
			translate([0,0,(y-c*2)/2+c])
			linear_extrude(height=.005)
			offset(r=cr-c)
			square([x-2*(cr),z-2*(cr)],center=true);

			translate([0,0,-(y-c*2)/2])
			linear_extrude(height=y-c*2)
			offset(r=cr)
			square([x-2*cr,z-2*cr],center=true);
			
			translate([0,0,-(y-c*2)/2-c])
			linear_extrude(height=.005)
			offset(r=cr-c)
			square([x-2*(cr),z-2*(cr)],center=true);
		}
	}
	else{
			hull(){
			translate([0,0,(y-c*2)/2+c])
			linear_extrude(height=.005)
			offset(r=-c)
			circle(d=x);

			translate([0,0,-(y-c*2)/2])
			linear_extrude(height=y-c*2)
			circle(d=x);
			
			translate([0,0,-(y-c*2)/2-c])
			linear_extrude(height=.005)
			offset(r=-c)
			circle(d=x);
		}
	}
}

module add_braille(word){
	translate([0,-sat/2,0])
	rotate([90,0,0])
	word_flat(word);
}

module word_flat(word){
	translate([(-6.1*(len(word)-1)/2)*bsm,0,0])
	for(i=[0:len(word)-1]){
	   translate([6.1*i*bsm,0,0])
	   braille_by_row(braille_d[word[i]]);
	}
}
module braille_by_row(decimal){
	b1 = decimal%2;
	b1a = floor(decimal/2);
	b2 = b1a%2;
	b2a = floor(b1a/2);
	b3 = b2a%2;
	b3a = floor(b2a/2);
	b4 = b3a%2;
	b4a = floor(b3a/2);
	b5 = b4a%2;
	b5a = floor(b4a/2);
	b6 = b5a%2;
	b=[b6,b5,b4,b3,b2,b1];

	dots_letter(b);
}

module dots_letter(b){
	$fn=20;

	if (b[0]==1){
		translate([-1.25*bsm,2.5*bsm,0])
		sphere(d=1.5*bsm);
	}
	if (b[1]==1){
		translate([1.25*bsm,2.5*bsm,0])
		sphere(d=1.5*bsm);
	}
	if (b[2]==1){
		translate([-1.25*bsm,0,0])
		sphere(d=1.5*bsm);
	}
	if (b[3]==1){
		translate([1.25*bsm,0,0])
		sphere(d=1.5*bsm);
	}
	if (b[4]==1){
		translate([-1.25*bsm,-2.5*bsm,0])
		sphere(d=1.5*bsm);
	}
	if (b[5]==1){
		translate([1.25*bsm,-2.5*bsm,0])
		sphere(d=1.5*bsm);
	}
}

module add_engraved_text(alignment){
	fs = "Liberation Sans:style=Bold";
	t_h = 8*bsm;
	translate([0,-insert_thickness/2++1-fudge,0])
	rotate([90,0,0])
	linear_extrude(height=1)
	text(str(e_t),font=fs,size=t_h,valign="center",halign=alignment);
}

module echo_upgrade_recommendations(cell_w,cell_h,cell_es,scn_a_t){

	r_hrw_o = (type_of_keyguard=="3D-Printed") ? horizontal_rail_width : max(horizontal_rail_width,minimum__acrylic_rail_width);
	r_vrw_o = (type_of_keyguard=="3D-Printed") ? vertical_rail_width : max(vertical_rail_width,minimum__acrylic_rail_width);
	c_hrw_o = (grid_height-cell_diameter*row_count)/(row_count+1);
	c_vrw_o = (grid_width-cell_diameter*column_count)/(column_count+1);
	hrw_o = (cell_shape=="rectangular") ? r_hrw_o : c_hrw_o;
	vrw_o = (cell_shape=="rectangular") ? r_vrw_o : c_vrw_o;
	actual_cell_width_o = max_cell_width-vrw_o;
	actual_cell_height_o = max_cell_height-hrw_o;

	cell_width_o = (cell_shape=="rectangular") ? round(actual_cell_width_o) : cell_diameter;
	cell_height_o = (cell_shape=="rectangular") ? round(actual_cell_height_o) : cell_diameter;

echo();
echo();
echo();
	if(cell_height_o!=cell_h && cell_h==25 && row_count!=0 && column_count!=0){
		echo(str("If you have just upgraded the designer from version 66 or before, consider changing 'cell height' in 'Grid Info' to ",cell_height_o));
	}
	if(cell_width_o!=cell_w && cell_w==25 && row_count!=0 && column_count!=0){
		echo(str("If you have just upgraded the designer from version 66 or before, consider changing 'cell width' in 'Grid Info' to ",cell_width_o));
	}
	
	if(preferred_rail_height!=scn_a_t && scn_a_t==4 && type_of_tablet!="blank"){
		echo(str("If you have just upgraded the designer from version 66 or before, consider changing 'screen area thickness' in 'Keyguard Basics'to ", preferred_rail_height));
	}

	if(rail_slope!=cell_es && cell_es==90 && row_count!=0 && column_count!=0){
		echo(str("If you have just upgraded the designer from version 66 or before, consider changing 'cell edge slope' in 'Grid Special Settings' to ", rail_slope));
	}	
	
	if(split_line!=split_line_location && split_line_location==0){
		echo(str("If you have just upgraded the designer from version 66 or before, consider changing 'split_line_location' in 'Special Actions and Settings' to ", split_line));
	}	
echo();
echo();
	
}


// // // module Bliss_graphic(){
	// // // chamfer = .5;
	// // // s_f=insert_tightness_of_fit/10;
	
	// // // if (path_and_filename != ""){		
		// // // difference(){
			// // // translate([0,2+insert_recess/2,0])
			// // // rotate([90,0,0])
			// // // import(file = path_and_filename,center=true);
			
			// // // translate([0,insert_thickness,0])
			// // // rotate([90,0,0])
			// // // chamfered_shape(cell_width+s_f/2,insert_thickness,cell_height+s_f/2,chamfer,cell_corner_radius);
		// // // }
	// // // }
// // // }



// Uncomment this bloc to see how to use this library.
/*
// strToInt(string [,base])

// Resume : Converts a number in string.
// string : The string you wants to converts.
// base (optional) : The base conversion of the number : 2 for binay, 10 for decimal (default), 16 for hexadecimal.
echo("*** strToInt() ***");
echo(strToInt("491585"));
echo(strToInt("01110", 2));
echo(strToInt("D5A4", 16));
echo(strToInt("-15"));
echo(strToInt("-5") + strToInt("10") + 5);

// strcat(vector [,insert])

// Resume : Concatenates a vector of words into a string.
// vector : A vector of string.
// insert (optional) : A string which will added between each words.
echo("*** strcat() ***");
v_data = ["OpenScad", "is", "a", "free", "CAD", "software."];
echo(strcat(v_data)); // ECHO: "OpenScadisafreeCADsoftware."
echo(strcat(v_data, " ")); // ECHO: "OpenScad is a free CAD software."

// substr(str, pos [,length])

// Resume : Substract a substring from a bigger string.
// str : The original string
// pos : The index of the position where the substring will begin.
// length (optional) : The length of the substring. If not specified, the substring will continue until the end of the string.
echo("*** substr() ***");
str = "OpenScad is a free CAD software.";
echo(str); // ECHO: "OpenScad is a free CAD software."
echo(substr(str, 0, 11)); // ECHO: "OpenScad is"
echo(substr(str, 12)); // ECHO: "a free CAD software."
echo(substr(str, 12, 10)); // ECHO: "a free CAD"

// fill(string, occurrences)

// Resume : Fill a string with several characters (or strings).
// string : the character or string which will be copied.
// occurrences : The number of occurences of the string.
echo("*** Fill() ***");
echo(fill("0", 4)); // ECHO: "0000"
echo(fill("hey", 3)); // ECHO: "heyheyhey"

// getsplit(string, index [,separator])

// Resume : Split a string in several words.
// string : The original string.
// index : The index of the word to get.
// separator : The separator which cut the string (default is " ").
// Note : Nowadays it's impossible to get a vector of words because we can't append data in a vector.
echo("*** getsplit() ***");
echo(getsplit(str)); // ECHO: "OpenScad"
echo(getsplit(str, 3)); // ECHO: "free"
echo(getsplit("123, 456, 789", 1, ", ")); // ECHO: "456"
*/


// function strToInt(str, base=10, i=0, nb=0) = (str[0] == "-") ? -1*_strToInt(str, base, 1) : _strToInt(str, base);
// function _strToInt(str, base, i=0, nb=0) = (i == len(str)) ? nb : nb+_strToInt(str, base, i+1, search(str[i],"0123456789ABCDEF")[0]*pow(base,len(str)-i-1));

// function strcat(v, car="") = _strcat(v, len(v)-1, car, 0);
// function _strcat(v, i, car, s) = (i==s ? v[i] : str(_strcat(v, i-1, car, s), str(car,v[i]) ));

function substr(data, i, length=0) = (length == 0) ? _substr(data, i, len(data)) : _substr(data, i, length+i);
function _substr(str, i, j, out="") = (i==j) ? out : str(str[i], _substr(str, i+1, j, out));

// function fill(car, nb_occ, out="") = (nb_occ == 0) ? out : str(fill(car, nb_occ-1, out), car);

// function getsplit(str, index=0, char=" ") = (index==0) ? substr(str, 0, search(char, str)[0]) : getsplit(   substr(str, search(char, str)[0]+1)   , index-1, char);



