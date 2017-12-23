lodash.math
===========

[Lo-dash](http://lodash.com) extension providing math / stats operations on collections.

It's based on [underscore.math](https://github.com/Delapouite/underscore.math) which itself is based on [Mootools Array.Math](https://github.com/arian/Array.Math)

## Available methods:

- average (mean)
- gcd
- lcm
- median
- mode
- movingAverage
- power
- product
- round
- scale
- slope
- sort
- stdDeviation (sigma)
- sum
- transpose
- variance
- weightedAverage
- zscore

## F.A.Q

What is the difference with the underscore version?

This library uses the implicit chaining capabilities of Lodash.


Released under MIT license

## NodeJS usage:

var _ = require('lodash');  
require('lodash-math')(_);

_.range(15).mean();

### or

A lodash will be prodived if none is given.  It will not corrupt the main module.  
var _math = require('lodash-math')();

### or

Other _ providers can be used.  
var _ = require('underscore');  
require('lodash-math')(_);
_.mode([1,2,2.2,3,4,3],Math.round);  //Yields [2,3]
