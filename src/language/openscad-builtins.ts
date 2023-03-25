// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

export default `
  $fa=undef;
  $fs=undef;
  $fn=undef;
  $t=undef;

  $preview=undef;

  // shows rotation
  $vpr=undef;
  // shows translation (i.e. won't be affected by rotate and zoom)
  $vpt=undef;
  // shows the FOV of the view [Note: Requires version 2021.01]
  $vpf=undef;
  // shows the camera distance [Note: Requires version 2015.03]
  $vpd=undef;

  PI=undef;

  function abs(x) = x;
  function acos(x) = x;
  function asin(x) = x;
  function atan(x) = x;
  function atan2(y, x) = x;
  function ceil(x) = x;
  function chr(x) = 0;
  function len(assignments) = $children;
  function let(x) = x;
  function ln(x) = x;
  function log(x) = x;
  function lookup(key, array) = x;
  function max(values) = x;
  function min(values) = x;
  function sqrt(x) = x;
  function tan(degrees) = x;
  function rands(min_value, max_value, value_count, seed_value=undef) = x;
  function search(match_value, string_or_vector, num_returns_per_match=1, index_col_num=0) = x;
  function ord(x) = x;
  function round(x) = x;
  function sign(x) = x;
  function sin(degrees) = x;
  function str(values) = x;
  function norm(x) = x;
  function pow(base, exponent) = x;
  function concat(values) = x;
  function cos(degrees) = x;
  function cross(a, b) = x;
  function floor(x) = x;
  function exp(x) = x;
  function chr(x) = x;
  function is_undef(x) = x;
  function is_list(x) = x;
  function is_num(x) = x;
  function is_bool(x) = x;
  function is_string(x) = x;
  function is_function(x) = x;

  function version() = '';
  function version_num() = 0;

  $parent_modules=0;
  module parent_module(n) {}

  module children() {}

  module render(convexity=undef) {}
  module surface(file, center=false, invert=false, convexity=undef) {}

  function assert(condition, message=undef) = children();
  module assert(condition, message=undef) children();

  module cube(size, center=false) {}
  module sphere(r, d=undef, $fa, $fs, $fn) {}
  module cylinder(h, r, r1=undef, r2, d, d1, d2, center=false, $fa, $fs, $fn) {}
  module polyhedron(points, faces, convexity=undef) {}

  module square(size, center=false) {}
  module circle(r, d=undef, $fa, $fs, $fn) {}
  module polygon(points, paths, convexity=undef) {}
  module linear_extrude(height, center=false, twist=undef, slices=undef, scale=undef, convexity=undef) children();
  module rotate_extrude(degrees, convexity=undef, $fa, $fs, $fn) children();

  module scale(v) children();
  module resize(newsize, auto=false) children();
  module rotate(a, v=undef) children();
  module translate(v) children();
  module mirror(v) children();
  module multmatrix(m) children();

  module color(c, alpha) children();

  module offset(r, delta=undef, chamfer) children();

  module minkowski() children();
  module union() children();
  module difference() children();
  module intersection() children();
  module hull() children();

  module children() {}

  // module for(i=undef) children();

  module import(file, convexity=undef, $fn, $fa, $fs) {}
`;