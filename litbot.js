require('dotenv').config()
var talib = require('talib')
console.log("TALib Version: " + talib.version)
const binance = require('node-binance-api')

class RippleBot {
  constructor () {
    this.init = this.init.bind(this)

    binance.options({
      'APIKEY': process.env.BINANCE_PUBLIC_KEY,
      'APISECRET': process.env.BINANCE_SECRET_KEY
    })
    console.log('Initiating LitBot!')
    this.init().then(done => {
      console.log('done!')
    })
  }

  init () {
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

  bollengerWat () {

  }
}

new RippleBot()
