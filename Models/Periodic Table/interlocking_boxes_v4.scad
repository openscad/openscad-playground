echo(version=version(4.0));
//comments: Version 2 adds anti-"elephant foot" scaling at bottom of dovetail sections
//comments: Version 3 added rounded bottom, dovetail suppression, and ability to render a 0 box units width
//comments: Version 4 added notation to the bottom that records dovetail size and box size
//comments: Version 5 added card slot feature for inserting labels or cards
/* [Size] */
//Box unit size in mm. This defines the size of 1 'unit' for your box.
BoxUnits = 40;
//Box Height in mm
BoxHeight = 40;
//Box Wall Thickness in mm
BoxWall = 1;
//Box Floor Thickness in mm
BoxFloor = 2;
//Box Width in units
BoxWidthUnits = 0;
BoxWidth = (BoxWidthUnits>0) ? BoxWidthUnits * BoxUnits : BoxWall*2;


//Box Length in units
BoxLengthUnits = 6;
BoxLength = BoxLengthUnits * BoxUnits;


//Fit Factor. Greater factor = looser fit
FitFactor = 0.18;  // [0:0.01:0.4]
RoundedBottom = "EW"; // [N:None, EW:East-West, NS:North-South]

/* [Walls] */
//North Wall open or closed
NorthWallOpen = 0; // [0:Closed, 1:Open]
//South Wall open or closed
SouthWallOpen = 0; // [0:Closed, 1:Open]

/* [Dovetail] */
//Set True to suppress female dovetails
SuppressFemaleDT = 1; // [1:True, 0:False]
//Set True to suppress male dovetails
SuppressMaleDT = 0; // [1:True, 0:False]
//Dovetail inside length in mm
DTInsideLength = 1.1;
//Dovetail angle in degrees
DTAngle = 45;
//Dovetail width in mm
DTWidth = 1.5;

/* [Card Slot] */
//Enable card slot for label or identification
EnableCardSlot = true; // [true:Enabled, false:Disabled]
//Width of the card to insert (mm)
CardWidth = 30;
//Height of the card slot (mm)
CardSlotHeight = 2;
//Depth of the card slot (how far it extends into the box) (mm)
CardSlotDepth = 15;
//Clearance for the card (makes the slot slightly larger) (mm)
CardClearance = 0.5;
//Vertical position of the card slot from bottom (mm)
CardSlotYPos = 10;
//Which side to place the card slot (0=None, 1=South, 2=North, 3=Both)
CardSlotSide = 1; // [0:None, 1:South, 2:North, 3:Both]

/* [Hidden] */
//This helps calculate the length of the 'long' side of the dovetail
DTx=tan(DTAngle)*DTWidth;
//This polygon defines the dovetail shape
DTShape = [[0,0],[DTInsideLength/2,0],[DTInsideLength/2+DTx,DTWidth],[-DTInsideLength/2-DTx,DTWidth],[-DTInsideLength/2,0]];

// Small value for ensuring proper differences and unions
epsilon = 0.01;

//build text for bottom
DTTxt=str("DT:",DTWidth,"x",DTInsideLength);
SizeTxt=str(BoxUnits,"x",BoxHeight,"x",BoxWall);

//this section defines a module for creating a "rounded" bottom to the box, useful when storing small parts
module RoundBottom(width, length, height){    
    translate([0,length,0])rotate([90,0,0])
    linear_extrude(length, center=false)
    
    difference() {
        translate([-width/2,0,0])square([width,height/2],center=false);
        translate([0,height/2,0])resize([width,height]) circle(d=width*10);
    }
}



union(){
    //creates and transforms rounded bottom
    if (RoundedBottom=="EW") {
    translate([0,(BoxWidth/2)+BoxWall,BoxFloor])
    rotate([0,0,-90])
    RoundBottom(BoxWidth-DTWidth-(BoxWall),BoxLength-DTWidth-BoxWall,2*(BoxHeight-BoxFloor));
    }

    //creates rounded bottom oriented North-South
    if (RoundedBottom=="NS") {
    translate([(BoxLength/2)-BoxWall,DTWidth+BoxWall/2,BoxFloor])
    rotate([0,0,0])
    RoundBottom(BoxLength-DTWidth-(BoxWall),BoxWidth-DTWidth-BoxWall,2*(BoxHeight-BoxFloor));
    }

    //Creates main box,without round bottom
    difference(){
        
    union(){
        //main box
    cube([BoxLength,BoxWidth,BoxHeight], center=false);

        //male dovetails
    if (!SuppressMaleDT) {    
    for (i=[1:BoxLengthUnits])
    translate([(i-1)*BoxUnits+(BoxUnits/2),BoxWidth,0])
        //in 2 sections. first section is slightly scaled down to counter "elephant foot"
        union(){
            linear_extrude(height=1, center=false)
                scale([1-(2*FitFactor),1-(2*FitFactor),1])
                union(){        
                    //this adds a slight offset to the male dovetail for a looser fit
                    translate([-DTInsideLength/2,0,0])
                    square([DTInsideLength,DTWidth]);
                    //main dovetail shape
                    translate([0,DTWidth*FitFactor*2,0])
                    polygon(DTShape);
                };
            translate([0,0,1])
            linear_extrude(height=BoxHeight-1, center=false)
                    union(){
                    //this adds a slight offset to the male dovetail for a looser fit
                    translate([-DTInsideLength/2,0,0])
                    square([DTInsideLength,DTWidth]);
                    //main dovetail shape
                    translate([0,DTWidth*FitFactor*2,0])
                    polygon(DTShape);
                    };
        }        
    }
    if ((BoxWidthUnits>0)&&(!SuppressMaleDT) ) {
        for (i=[1:BoxWidthUnits]) {
            translate([0,(i-1)*BoxUnits+(BoxUnits/2),0])
                //in 2 sections. first section is slightly scaled down to counter "elephant foot"
                rotate([0,0,90])
                union(){
                    linear_extrude(height=1, center=false)				//1mm high anti-elephant foot section
                        scale([1-(2*FitFactor),1-(2*FitFactor),1])
                        union(){        
                            //this adds a slight offset to the male dovetail for a looser fit
                            translate([-DTInsideLength/2,0,0])
                            square([DTInsideLength,DTWidth]);
                            //main dovetail shape
                            translate([0,DTWidth*FitFactor*2,0])
                            polygon(DTShape);
                        };
                    translate([0,0,1])
                    linear_extrude(height=BoxHeight-1, center=false)
                        union(){
                            //male dovetail offset
                            translate([-DTInsideLength/2,0,0])
                            square([DTInsideLength,DTWidth]);
                            //main dovetail shape
                            translate([0,DTWidth*FitFactor*2,0])
                            polygon(DTShape);
                        };
                }
        }
    }
    }
    //female dovetails
    if (!SuppressFemaleDT) {
    for (i=[1:BoxLengthUnits])
        union(){
            translate([(i-1)*BoxUnits+(BoxUnits/2),0,0])
                scale([1+FitFactor,1+FitFactor,1])
                linear_extrude(height=BoxHeight, center=false)
                polygon(DTShape);
        
            //added a second dovetail cutout at the bottom, scaled up to counter "elephant foot" when printed
            translate([(i-1)*BoxUnits+(BoxUnits/2),0,0])
                scale([1+(3*FitFactor),1+(3*FitFactor),1])
                linear_extrude(height=1, center=false)
                polygon(DTShape);					
        }

    for (i=[1:BoxWidthUnits])
        union(){
            translate([BoxLength,(i-1)*BoxUnits+(BoxUnits/2),0])
                rotate([0,0,90])
                    scale([1+FitFactor,1+FitFactor,1])
                        linear_extrude(height=BoxHeight, center=false)
                            polygon(DTShape);
            //added a second dovetail cutout at the bottom, scaled up to counter "elephant foot" when printed
            translate([BoxLength,(i-1)*BoxUnits+(BoxUnits/2),0])
                rotate([0,0,90])
                    scale([1+(3*FitFactor),1+(3*FitFactor),1])
                        linear_extrude(height=1, center=false)
                            polygon(DTShape);	
        }
    }
    //carves out main box
    translate([BoxWall,DTWidth+BoxWall,BoxFloor])
        cube([BoxLength-(2*BoxWall)-DTWidth, (BoxWidth-(2*BoxWall)-DTWidth), BoxHeight]);

    if (NorthWallOpen)
        translate([-DTWidth*(1+FitFactor+FitFactor),BoxWall+DTWidth,BoxFloor], center=false)
            cube([BoxWall+(DTWidth*(1+FitFactor+FitFactor)), (BoxWidth-(2*BoxWall)-DTWidth), BoxHeight]);    

    if (SouthWallOpen)
        translate([BoxLength-(BoxWall)-DTWidth,BoxWall+DTWidth,BoxFloor], center=false)
            cube([BoxWall+DTWidth, (BoxWidth-(2*BoxWall)-DTWidth), BoxHeight]);
            
    // Add card slot on South wall (if enabled)
    if (EnableCardSlot && (CardSlotSide == 1 || CardSlotSide == 3)) {
        // Card slot on South wall
        translate([
            BoxLength,  // South face
            (BoxWidth - CardWidth) / 2,  // Center horizontally
            CardSlotYPos  // Vertical position
        ])
            cube([
                BoxWall + epsilon,  // Cut through side wall
                CardWidth + CardClearance * 2,  // Width of slot
                CardSlotHeight  // Height of slot
            ]);
            
        // Horizontal card channel inside
        translate([
            BoxLength - CardSlotDepth,  // Extend inward from South face
            (BoxWidth - CardWidth) / 2,  // Center horizontally
            CardSlotYPos  // Same vertical position
        ])
            cube([
                CardSlotDepth,  // How deep the channel goes
                CardWidth + CardClearance * 2,  // Same width as slot
                CardSlotHeight  // Same height as slot
            ]);
    }
    
    // Add card slot on North wall (if enabled)
    if (EnableCardSlot && (CardSlotSide == 2 || CardSlotSide == 3)) {
        // Card slot on North wall
        translate([
            -BoxWall,  // North face
            (BoxWidth - CardWidth) / 2,  // Center horizontally
            CardSlotYPos  // Vertical position
        ])
            cube([
                BoxWall + epsilon,  // Cut through side wall
                CardWidth + CardClearance * 2,  // Width of slot
                CardSlotHeight  // Height of slot
            ]);
            
        // Horizontal card channel inside
        translate([
            0,  // At North face
            (BoxWidth - CardWidth) / 2,  // Center horizontally
            CardSlotYPos  // Same vertical position
        ])
            cube([
                CardSlotDepth,  // How deep the channel goes
                CardWidth + CardClearance * 2,  // Same width as slot
                CardSlotHeight  // Same height as slot
            ]);
    }

    //adds info text to bottom
    translate([BoxLength/2,(BoxWidth/2)+1,1]) rotate([0,0,0]) linear_extrude(1) text(DTTxt, halign="center", valign="bottom", size=4);
    translate([BoxLength/2,BoxWidth/2,1]) rotate([0,0,0]) linear_extrude(1) text(SizeTxt, halign="center", valign="top", size=4);
    }

    //
    }

// Uncomment to show an example card in the slot
/*
// Example card to show in the slot
if (EnableCardSlot && (CardSlotSide == 1 || CardSlotSide == 3)) {
    color("LightBlue", 0.7)
    translate([
        BoxLength - CardSlotDepth/2, 
        BoxWidth/2, 
        CardSlotYPos + CardSlotHeight/2
    ])
        cube([CardSlotDepth * 0.8, CardWidth * 0.9, 0.5], center=true);
}
*/