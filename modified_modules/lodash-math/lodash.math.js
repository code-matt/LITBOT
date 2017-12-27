(function () {
  
  function mixin_loader(lodash) {
    var math = {};
    if(this) {
      this.math = math;
    }
    if(!lodash) {    
      lodash = require('lodash').runInContext();
    }
   
    function objKey2Array(obj,key) {
      var arr;
      if (lodash.isArray(obj) && typeof obj[0] === 'number') {
        arr = obj;
      } else {
        key = key || 'value';
        arr = lodash.pluck(obj, key);
      }
      return arr;
    }
    
    math.weightedAverage = function(values,weights) {
      var weightSum=lodash.sum(weights);
      weights = lodash.map(weights,function(weight) {
        return weight/weightSum;
      });
      return lodash.sum(
              lodash.map(
               lodash.zip(values,weights),
               function(pair) {
                return pair[0]*pair[1];
               }));
    };
    
    // Product
    // math.product([1,2,3,4,5,6])
    //   => 720 aka 6!
    math.product = function(obj, key) {
      var arr=objKey2Array(obj, key),
       product=1;
      for(var i=0;i<arr.length;++i) {
        product*=arr[i];
      }
      return product;
    };

    // Greatest common divisor
    // math.gcd([4,6,12])
    //   => 2
    math.gcd = function(obj, key) {
      var arr = objKey2Array(obj, key);
      if(arr.length == 2) {
        var n=arr[0],
         m=arr[1];
        if (n === 0) {
          return m;
        }
        while (m) {if (n > m) {n -= m;} else {m -= n;}}
        return n;
      }
      else {
        var arrCopy=arr.slice();
        return math.gcd(arrCopy.splice(0,1),arr);
      }
    };
    
    // Least common multiple
    // math.lcm([3,4,2])
    //   => 12
    math.lcm = function(obj, key) {
      var array = objKey2Array(obj, key),
       n = array.length,
       a = Math.abs(array[0]);
      for(var i = 1; i < n; ++i) {
        var b = Math.abs(array[i]),
         c = a;
        while (a && b) {
          if(a > b) {
            a%=b;
          }
          else {
            b%=a;
          }
        }
        a = Math.abs(c * array[i]) / (a + b);
      }
      return a;
    };
    
    // Arithmetic mean
    // math.mean([1,2,3])
    //   => 2
    math.mean = math.ave = math.average = function(obj, key) {
      try { 
        return internalSum(obj, key) / lodash.size(obj);
      }
      catch(e) {
        //Overflow or underflow.  Let's break things up a bit
        var arr = objKey2Array(obj,key);
        if(arr.length<4) {
          //Breaking things down further won't help if we are chunking the way we are.
          //We need to do this manually;
          if(arr.length === 2) {
            //We are down to two numbers and those two numbers can't be summed.
            //How to average numbers without summing and using the alu less.
            return arr[0]+(arr[1]-arr[0])/2;
          }
          if(arr.length === 3) {
            //Reducing alu usage is not so easy with three.
            return arr[0]/3 + arr[1]/3 + arr[2]/3;
          }
        }
        //To simplify things we need to chunk this thing as a mutiple of the length (no remainder at end) so we don't need weighted averages.
        //To reduce the likelyhood of another overflow we want to get close to the square root of the length.
        //This minimizes the largest grouping we have to average.
        var chunkSize=Math.ceil(Math.sqrt(arr.length));
        while(arr.length % chunkSize) {
          --chunkSize;
        }
        if(chunkSize != 1) {
          return math.mean(
                  lodash.map(
                   lodash.chunk(arr, chunkSize),
                   math.mean));
        }
        else {
          //We have a prime length.  We can't break it into multiple even chunks other than of length one which gets us nowhere.
          //We need to do a weighted average of smaller sets;
          //For now split the array in roughly two and take a weighted average of their averages.
          //Copy arr
          var arrCopy = arr.concat();
          //Weighted average of the two halves.  Floored halfway point is >>> 1.
          //Mutate the array while we get that slice so that we can just pass it again.
          //Weighted average is of form [values],[weights];
          return math.weightedAverage(
           [ math.mean(arrCopy.splice(0,arrCopy.length >>> 1 )),
             math.mean(arrCopy)],
           [arr.length-arrCopy.length,arrCopy.length]);
        }
      }
    };

    // math.median([1,2,3,4])
    //   => 2.5
    //   TODO {}, [{}]
    math.median = function(arr) {
      arr = arr.slice(0); // create copy
      var middle = (arr.length + 1) / 2,
        sorted = math.sort(arr);
      return (sorted.length % 2) ? sorted[middle - 1] : (sorted[middle - 1.5] + sorted[middle - 0.5]) / 2;
    };

    // Mode / Modes
    // math.mode([2,2,3,3,15,4])
    //   => [2,3]
    // optionalFunction should return a string and can control clustering.
    math.mode = math.modes = function(array,optionalFunction) {
      var clusterFunction = optionalFunction || function(a) { return a.toString(); }
      var max = 0,
       mode = [],
       counted = lodash.countBy(array,clusterFunction);
       max = lodash.max(lodash.values(counted));
      lodash.forIn(counted, function(v,k){
        if(v === max) {
          mode.push(parseFloat(k));
        }
      });
      return mode;
    };
    
    // Power, exponent
    // math.pow(2,3)
    //   => 8
    math.pow = math.power = function(x, n) {
      if (lodash.isNumber(x)) {
        return Math.pow(x, n);
      }
      if (lodash.isArray(x)) {
        return lodash.map(x, function(i) { return lodash.pow(i, n); });
      }
    };

    // Round
    // math.round(12345.6789, 2)
    //   => 12345.68
    math.round = function(number, decimals) {
      return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
    };

    // Scale to max value
    // math.scale(1,[2,5,10])
    //   => [ 0.2, 0.5, 1]
    math.scale = function(arr, max) {
      max = max || 1;
      var max0 = lodash.max(arr);
      return lodash.map(arr, function(i) { return i * (max / max0); });
    };

    // Slope between two points
    // math.slope([0,0],[1,2])
    //   => 2
    math.slope = function(x, y) {
      return (y[1] - x[1]) / (y[0] - x[0]);
    };

    // Numeric sort
    // math.sort([3,1,2])
    //   => [1,2,3]
    math.sort = function(arr) {
      return lodash.sortBy(arr, lodash.identity);
    };

     // math.stdDeviation([1,2,3])
    //   => 0.816496580927726
    math.stdDeviation = math.sigma = function(arr) {
      return Math.sqrt(lodash.variance(arr));
    };

    // Sum of array
    // math.sum([1,2,3])
    //   => 6
    // math.sum([{b: 4},{b: 5},{b: 6}], 'b')
    //   => 15
    var internalSum = function(obj, key) {
      var arr = objKey2Array(obj,key),
       val = 0;
      for (var i = 0; i < arr.length; i++) {
        var nextValue = arr[i]-0;
        if(val > 0 && nextValue > Number.MAX_VALUE - val) {
          throw new Error('Overflow');
        }
        if(val < 0 && nextValue < Number.MIN_VALUE - val) {
          throw new Error('Underflow');
        }
        val += nextValue;
      }
      return val;
    };
    
    if(lodash.sum === undefined) {
     math.sum = internalSum;
    }

    // math.transpose(([1,2,3], [4,5,6], [7,8,9]])
    //   => [[1,4,7], [2,5,8], [3,6,9]]
    math.transpose = function(arr) {
      var trans = [];
      lodash.each(arr, function(row, y){
        lodash.each(row, function(col, x){
          if (!trans[x]) trans[x] = [];
          trans[x][y] = col;
        });
      });
      return trans;
    };

    // math.variance([1,2,3])
    //   => 2/3
    math.variance = function(arr) {
      var mean = lodash.mean(arr),
        variance = function(x) { return lodash.pow( x - mean, 2); };
      return lodash(arr).map(variance).mean().value();
    };

    // Standard score, assuming normal distribution
    // math.zscore([1,2,3])
    //   => [-1.224744871391589, 0, 1.224744871391589]
    math.zscore = function(obj, key) {
      var arr = objKey2Array(obj,key);

      var mean = lodash.mean(arr),
          sigma = lodash.stdDeviation(arr),
          zscore = function(d) { return (d - mean) / sigma; };
      return lodash.map(arr, zscore);
    };

    // math.movingAvg([1,2,3,4,5], 3);
    //   => [2,3,4]
    math.movingAvg = math.movingAverage = function(arr, size) {
      var win, i, newarr = [];
      for(i = size-1; i <= arr.length; i++) {
        win = arr.slice(i - size, i);
        if (win.length === size) {
          newarr.push(lodash.mean(win));
        }
      }
      return newarr;
    };
    
    math.shannon = function(obj,key) {
     var array = objKey2Array(obj,key),
      counts = lodash.values(lodash.countBy(array));
     return (Math.log(array.length) - lodash.sum(lodash.map(counts,function (n) {
                                                               return n*Math.log(n);
                                      }))/array.length
            )/Math.log(2);
    };
    
    //More safe with huge data sequences.
    //This is more theoretical because x*ln|x| is nearly linear.
    //As long as you don't have data with ~10^305 symbols you're good to use the faster one.
    //Well log10(number of symbols) + log10(number of kinds of symbols) should stay a margin away from 305 or we will go over 10^308 somewhere. 
    math.shannon2 = function(obj,key) {
     var array = objKey2Array(obj,key),
      counts = lodash.values(lodash.countBy(array));
     return -lodash.sum(
       lodash.map(
         lodash.map(
           counts,
           function(item) {
             return item/array.length;
           }),
         function(item) {
           return item*Math.log(item)/Math.log(2);
         }));
    };
    
    math.shannonMinimumBits = function(obj,key) {
     var array = objKey2Array(obj,key),
      counts = lodash.values(lodash.countBy(array));
     return (array.length*Math.log(array.length) - lodash.sum(lodash.map(counts,function (n) {
                                                               return n*Math.log(n);
                                                   }))
            )/Math.log(2);
    };
    

    // add methods to Underscore.js namespace
    
    lodash.mixin(math);
    return lodash;
  }

  if(typeof window !== 'undefined') {
    mixin_loader(_);
  }
  else {
    module.exports = mixin_loader;
  }
})();