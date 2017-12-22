'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bollingerBands = require('bollinger-bands');

var _bollingerBands2 = _interopRequireDefault(_bollingerBands);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

require('dotenv').config();
var binance = require('node-binance-api');

var RippleBot = function () {
  function RippleBot() {
    _classCallCheck(this, RippleBot);

    this.displayRippleStats = this.displayRippleStats.bind(this);
    this.buildBollingerBands = this.buildBollingerBands.bind(this);

    binance.options({
      'APIKEY': process.env.BINANCE_PUBLIC_KEY,
      'APISECRET': process.env.BINANCE_SECRET_KEY
    });
    console.log('Initiating LitBot!');
    // this.displayRippleStats().then(done => {
    //   console.log('done!')
    // })
    this.buildBollingerBands().then(function (done) {
      console.log('done!');
    });
  }

  _createClass(RippleBot, [{
    key: 'displayRippleStats',
    value: function displayRippleStats() {
      return new Promise(function (resolve, reject) {
        var thingsToDo = 2;
        var XRPUSDT = void 0,
            XRPETH = void 0,
            ETHUSDT = void 0,
            XRPPrice = void 0,
            XRPBalance = void 0;

        binance.prices(function (ticker) {
          ETHUSDT = ticker.ETHUSDT;
          XRPETH = ticker.XRPETH;
          console.log('Price of Ripple - Ethereum: ', XRPETH);
          console.log('Etherium price - USDT: ', ETHUSDT);
          thingsToDo -= 1;
          if (!thingsToDo) {
            resolve(true);
          }
        });
        binance.balance(function (balances) {
          XRPBalance = balances.XRP.available;
          XRPPrice = ETHUSDT * XRPETH;
          XRPUSDT = XRPBalance * XRPPrice;
          console.log('XRP balance: ', XRPBalance);
          console.log('XRP (aprox) USD value: ', XRPPrice);
          console.log('Your XRP (aprox) USD value: ', XRPUSDT);
          thingsToDo -= 1;
          if (!thingsToDo) {
            resolve(true);
          }
        });
      });
    }
  }, {
    key: 'buildBollingerBands',
    value: function buildBollingerBands() {
      return new Promise(function (resolve, reject) {
        var thingsToDo = 1;
        var closingPriceArr = [];
        binance.candlesticks('XRPBTC', '2h', function (ticks) {
          ticks.forEach(function (tick) {
            closingPriceArr.push(Number(tick[4])); // pushing in the close price for that minute
          });
          thingsToDo -= 1;
          if (!thingsToDo) {
            // console.log(closingPriceArr)
            var band = (0, _bollingerBands2.default)(closingPriceArr, 20, 2);
            console.log(band.upper);
            resolve(true);
          }
        });
      });
    }
  }]);

  return RippleBot;
}();

new RippleBot();
