require('dotenv').config()
var talib = require('talib')
console.log('TALib Version: ' + talib.version)
const binance = require('node-binance-api')
var _ = require('lodash')
require('./modified_modules/lodash-math')(_)

var blessed = require('blessed')
var contrib = require('./modified_modules/blessed-contrib')
var screen = blessed.screen()

var scale = require('scale-number-range')
var ema = require('exponential-moving-average')

var fs = require('fs')
if (!fs.existsSync('log.json')) {
  var filepath = 'log.json'
  let content = JSON.stringify({
    buySellLog: []
  })
  fs.writeFile(filepath, content, (err) => {
    console.log('logfile generated')
  })
}
require('events').EventEmitter.defaultMaxListeners = 300

// import Coin from './classes/Coin'
// import { setInterval } from 'timers';

// const LITBOT_LOG_LENGTH = 4
// const POLLING_INTERVAL = 1

// const MARK_COUNT_SHORT = 10
// const MARK_TIME_PERIOD_SHORT = 1

// const MARK_COUNT_LONG = 8
// const MARK_TIME_PERIOD_LONG = 15

class RippleBot {
  constructor () {
    // this line below is a hack to force this node process to stay open until closed.
    setInterval(() => {}, Number.POSITIVE_INFINITY)
    this.firstGet = false
    this.coins = new Map()
    this.sortWinnersAndLosers = this.sortWinnersAndLosers.bind(this)
    this.get24hr = this.get24hr.bind(this)
    this.updatePrices = this.updatePrices.bind(this)
    this.updateCoins = this.updateCoins.bind(this)
    this.renderDashboard = this.renderDashboard.bind(this)
    this.initContrib = this.initContrib.bind(this)
    this.getCoinKeys = this.getCoinKeys.bind(this)

    this.baseUnit = 'BTC'
    this.baseConversion = 'BTCUSDT'
    this.baseCoin

    this.get24hr()
    setInterval(this.get24hr, 5000)
    this.initContrib()
  }

  initContrib () {
    this.grid = new contrib.grid({rows: 12, cols: 12, screen: screen})

    screen.key(['escape', 'q', 'C-c'], function (ch, key) {
      return process.exit(0)
    })
  }

  get24hr () {
    binance.prevDay(false, (allCoins, symbol) => {
      if (!this.firstGet) {
        this.baseCoin = new Coin(allCoins[this.baseConversion])
        allCoins.forEach(coinData => {
          if (coinData.symbol.substr(3) === this.baseUnit) {
            this.coins.set(coinData.symbol, new Coin(coinData))
          }
        })
        this.firstGet = true
      } else {
        this.updateCoins(allCoins)
      }
      this.renderDashboard()
    })
  }

  updateCoins (allCoins) {
    allCoins.forEach(coinData => {
      if (coinData.symbol.substr(3) === this.baseUnit) {
        this.coins.get(coinData.symbol).setState(coinData)
      }
    })
    this.renderDashboard()
  }

  renderDashboard () {
    Array.from(this.coins.keys()).forEach((symbol, index) => {
      if (index < 144) {
        this.grid.set(Math.ceil(index / 12), 0, 1, 1, contrib.markdown,
          {
            markdown: this.coins.get(symbol).outputInfo()
          }
        )
      }
    })
    screen.render()
  }

  getCoinKeys () {
    return Array.from(this.coins.keys())
  }

  updatePrices () {
    try {
      binance.prices((ticker) => {
        // this.tick += 1
        // let time = Date.now()
        this.prices = ticker
        // this.addPriceToPool(this.prices[this.symbol], time)
        // resolve(true)
      })
    } catch (err) {
      console.log('GET PRICES HAS AN ERROR')
    }
  }

  parseLog () {
    return new Promise((resolve, reject) => {
      fs.readFile('log.json', 'utf8', (err, data) => {
        resolve(JSON.parse(data).buySellLog)
      })
    })
  }

  writeLog (data) {
    fs.writeFile('log.json', JSON.stringify(data), (err) => {})
  }

  sortWinnersAndLosers () {

  }

  calculateAndDraw () {
    // this.calculateEMAShort().then(done => {
    //   this.calculateEMALong().then(done => {
    //     if (this.litbotLoading) {
    //       this.renderLoading()
    //     } else {
    //       this.calculateROC()
    //       this.buyHoldSellDecision().then(done => {
    //         this.renderDashboard()
    //       })
    //     }
    //   })
    // })
  }
}

class Coin {
  constructor (initialState) {
    this.state = initialState
  }

  setState (nextState) {
    this.state = Object.assign(this.state, nextState)
  }

  outputInfo () {
    return (
      `
        24 Hour high: 
      `
    )
  }
}

new RippleBot()
