require('dotenv').config()
var talib = require('talib')
console.log('TALib Version: ' + talib.version)
const binance = require('node-binance-api')
var _ = require('lodash')
require('lodash-math')(_)

class RippleBot {
  constructor () {
    // this line below is a hack to force this node process to stay open until closed.
    setInterval(() => {}, Number.POSITIVE_INFINITY)

    this.calcMyXRPBalanceAndValue = this.calcMyXRPBalanceAndValue.bind(this)
    this.averageDirectionalMovement = this.averageDirectionalMovement.bind(this)
    this.calculateAROON = this.calculateAROON.bind(this)
    this.fullCalculation = this.fullCalculation.bind(this)
    this.buyHoldSellDecision = this.buyHoldSellDecision.bind(this)
    this.updatePrices = this.updatePrices.bind(this)
    this.reportProgress = this.reportProgress.bind(this)
    this.doBuy = this.doBuy.bind(this)
    this.doSell = this.doSell.bind(this)

    binance.options({
      'APIKEY': process.env.BINANCE_PUBLIC_KEY,
      'APISECRET': process.env.BINANCE_SECRET_KEY
    })
    console.log('Initiating LitBot!')
    this.fullCalculation(true)
    setInterval(() => this.fullCalculation(false), 30000)

    this.prices = null
    this._XRP = 0 // start with 0 ripple.. bot decides when to make the first buy
    this._BTC = 0.05 // start with 0.05 BTC
    this._valueBTC = 15000 // keeping this a constant for now to make things less of a headache.
                           // for us to see how much money the bot made or lost.
  }

  fullCalculation () {
    this.updatePrices().then(done => {
      this.calculateAROON('5m').then(done => {
        this.averageDirectionalMovement('5m').then(done => {
          this.buyHoldSellDecision().then(done => {
            this.reportProgress()
          })
        })
      })
    })
  }

  updatePrices () {
    return new Promise((resolve, reject) => {
      binance.prices((ticker) => {
        this.prices = ticker // this.ticket.XRPETH for example
        resolve(true)
      })
    })
  }

  buyHoldSellDecision () {
    return new Promise((resolve, reject) => {
      resolve(true)
    })
  }

  reportProgress () {
    console.log(`
      LITBOT PROGRESS REPORT:
      ....
      ....
    `)
  }

  doBuy (amount) {

  }

  doSell (amount) {
    
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
  averageDirectionalMovement (timePeriod) {
    return new Promise((resolve, reject) => {
      let thingsToDo = 1
      let open = []
      let close = []
      let high = []
      let low = []
      let volume = []
      binance.candlesticks('XRPETH', timePeriod, (ticks) => {
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
          optInTimePeriod: 9
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

  calculateAROON (timePeriod) {
    return new Promise((resolve, reject) => {
      let thingsToDo = 1
      let open = []
      let close = []
      let high = []
      let low = []
      let volume = []
      binance.candlesticks('XRPETH', timePeriod, (ticks) => {
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
          optInTimePeriod: 9
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
