require('dotenv').config()
const binance = require('node-binance-api')

class RippleBot {
  constructor () {
    this.displayRippleStats = this.displayRippleStats.bind(this)
    this.buildBollingerBands = this.buildBollingerBands.bind(this)

    binance.options({
      'APIKEY': process.env.BINANCE_PUBLIC_KEY,
      'APISECRET': process.env.BINANCE_SECRET_KEY
    })
    console.log('Initiating LitBot!')
    // this.displayRippleStats().then(done => {
    //   console.log('done!')
    // })
    this.buildBollingerBands().then(done => {
      console.log('done!')
    })
  }

  displayRippleStats () {
    return new Promise((resolve, reject) => {
      let thingsToDo = 2
      let XRPUSDT, XRPETH, ETHUSDT, XRPPrice, XRPBalance

      binance.prices((ticker) => {
        ETHUSDT = ticker.ETHUSDT
        XRPETH = ticker.XRPETH
        console.log('Price of Ripple - Ethereum: ', XRPETH)
        console.log('Etherium price - USDT: ', ETHUSDT)
        thingsToDo -= 1
        if (!thingsToDo) {
          resolve(true)
        }
      })
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
  }

  buildBollingerBands () {
    return new Promise((resolve, reject) => {
      resolve(true)
    })
  }
}

new RippleBot()
