require('dotenv').config()
const binance = require('node-binance-api')

class RippleBot {
  constructor () {
    this.init = this.init.bind(this)

    binance.options({
      'APIKEY': process.env.BINANCE_PUBLIC_KEY,
      'APISECRET': process.env.BINANCE_SECRET_KEY
    })
    console.log('Initiating LitBot!')
    this.init()
  }

  init () {
    let XRPUSDT
    let XRPETH
    let ETHUSDT
    binance.prices((ticker) => {
      ETHUSDT = ticker.ETHUSDT
      XRPETH = ticker.XRPETH
      console.log('Price of Ripple - Ethereum: ', XRPETH)
      console.log('Etherium price - USDT: ', ETHUSDT)
    })
    binance.balance((balances) => {
      let XRPBalance = balances.XRP.available
      let XRPPrice = ETHUSDT * XRPETH
      console.log('XRP balance: ', XRPBalance)
      console.log('XRP (aprox) USD value: ', XRPPrice)
      console.log('Your XRP (aprox) USD value: ', XRPBalance * XRPPrice)
    })
  }
}

new RippleBot()
