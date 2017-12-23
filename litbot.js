require('dotenv').config()
var talib = require('talib')
console.log('TALib Version: ' + talib.version)
const binance = require('node-binance-api')
var _ = require('lodash')
require('lodash-math')(_)

class RippleBot {
  constructor () {
    this.calcMyXRPBalanceAndValue = this.calcMyXRPBalanceAndValue.bind(this)
    this.averageDirectionalMovement = this.averageDirectionalMovement.bind(this)
    this.calculateAROON = this.calculateAROON.bind(this)

    binance.options({
      'APIKEY': process.env.BINANCE_PUBLIC_KEY,
      'APISECRET': process.env.BINANCE_SECRET_KEY
    })
    console.log('Initiating LitBot!')
    this.calcMyXRPBalanceAndValue().then(done => {
      this.calculateAROON().then(done => {
        this.averageDirectionalMovement().then(done => {
          console.log('done!')
        })
      })
    })
  }

  calcMyXRPBalanceAndValue () {
    return new Promise((resolve, reject) => {
      let thingsToDo = 2
      let XRPUSDT, XRPETH, ETHUSDT, XRPPrice, XRPBalance

      binance.prices((ticker) => {
        ETHUSDT = ticker.ETHUSDT
        XRPETH = ticker.XRPETH
        console.log('Price of Ripple - Ethereum: ', XRPETH)
        console.log('Etherium price - USDT: ', ETHUSDT)
        thingsToDo -= 1
        binance.balance((balances) => {
          XRPBalance = balances.XRP.available
          XRPPrice = ETHUSDT * XRPETH
          XRPUSDT = XRPBalance * XRPPrice
          console.log('XRP balance: ', XRPBalance)
          console.log('XRP (aprox) USD value: ', XRPPrice)
          console.log('Your XRP (aprox) USD value: ', XRPUSDT)
          thingsToDo -= 1
          if (!thingsToDo) {
            resolve(true)
          }
        })
      })
    })
  }
  // This tells us how strong the trend is. Not weather the trend is up or down.
  // http://www.swing-trade-stocks.com/ADX-indicator.html I have read if its 20 or lower,
  // that means its a weak trend. I still don't get how this helps :p
  averageDirectionalMovement () {
    return new Promise((resolve, reject) => {
      let thingsToDo = 1
      let open = []
      let close = []
      let high = []
      let low = []
      let volume = []
      binance.candlesticks('XRPETH', '5m', (ticks) => {
        ticks.forEach(tick => {
          // [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored]
          open.push(Number(tick[1]))
          close.push(Number(tick[4]))
          high.push(Number(tick[2]))
          low.push(Number(tick[3]))
          volume.push(Number(tick[5]))
        })
        talib.execute({
          name: 'ADX',
          startIdx: 0,
          endIdx: close.length - 1,
          high: high,
          low: low,
          close: close,
          optInTimePeriod: 5
        }, (err, result) => {
          let avgTrendStregnth = _.movingAvg(_.takeRight(result.result.outReal, 20), 20)
          console.log('The stregnth of the current trend is:', avgTrendStregnth[0])
          // console.log(talib.explain("ADX"), { depth:3 }) // <-- SUPER HELPFUL.. kinda. Change the .explain to whatever
          // calculation you want to learn about from here: http://ta-lib.org/function.html
          thingsToDo -= 1
          if (!thingsToDo) {
            resolve(true)
          }
        })
      })
    })
  }

  calculateAROON () {
    return new Promise((resolve, reject) => {
      let thingsToDo = 1
      let open = []
      let close = []
      let high = []
      let low = []
      let volume = []
      binance.candlesticks('XRPETH', '5m', (ticks) => {
        ticks.forEach(tick => {
          // [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored]
          open.push(Number(tick[1]))
          close.push(Number(tick[4]))
          high.push(Number(tick[2]))
          low.push(Number(tick[3]))
          volume.push(Number(tick[5]))
        })
        talib.execute({
          name: 'AROON',
          startIdx: 0,
          endIdx: close.length - 1,
          inReal: close,
          high: high,
          low: low,
          close: close,
          optInNbDevUp: 2,
          optInNbDevDn: 2,
          optInMAType: 0,
          volume: volume,
          optInTimePeriod: 5
        }, (err, result) => {
          console.log('Moving Average AROON:')
          let arr = result.result.outAroonDown
          let movingAvgDown = _.movingAvg(_.takeRight(arr, 20), 20)

          let arr2 = result.result.outAroonUp
          let movingAvgUp = _.movingAvg(_.takeRight(arr2, 20), 20)
          console.log('AROON DOWN MOVING AVERAGE', movingAvgDown[0])
          console.log('AROON UP MOVING AVERAGE', movingAvgUp[0])
          
          if (movingAvgDown[0] > movingAvgUp[0]) {
            console.log('Buying is not advised right now. Sell! Sell! Sell!')
          } else {
            console.log('Buy! Buy! Buy!')
          }
          // console.log(talib.explain("AROON"), { depth:3 }) // <-- SUPER HELPFUL.. kinda. Change the .explain to whatever
          // calculation you want to learn about from here: http://ta-lib.org/function.html
          thingsToDo -= 1
          if (!thingsToDo) {
            resolve(true)
          }
        })
      })
    })
  }
}

new RippleBot()
