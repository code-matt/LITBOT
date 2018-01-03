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
    this.baseCoin = null

    this.initContrib()
    this.get24hr()
    setInterval(this.get24hr, 30000)
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
        this.baseCoin = new Coin(allCoins.find(coin => coin.symbol === this.baseConversion))
        allCoins.forEach(coinData => {
          if (coinData.symbol.substr(3) === this.baseUnit) {
            this.coins.set(coinData.symbol, new Coin(coinData, this.baseCoin))
          }
        })
        this.renderDashboard()
        this.firstGet = true
      } else {
        this.updateCoins(allCoins)
      }
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
    let vertRow = 0
    this.getCoinKeys('priceChangePercent').forEach((symbol, index) => {
      if (index < 66) {
        if (index && !(index % 12)) {
          vertRow += 2
        }
        this.grid.set(vertRow, (index % 6) * 2, 2, 2, contrib.markdown,
          {
            markdown: this.coins.get(symbol).outputInfo()
          }
        )
      }
    })
    screen.render()
  }

  getCoinKeys (sortBy) {
    if (sortBy) {
      return Array.from(this.coins.keys()).sort((a, b) => {
        return Number(this.coins.get(a).state[sortBy]) - Number(this.coins.get(b).state[sortBy])
      })
    } else {
      return Array.from(this.coins.keys())
    }
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
}

class Coin {
  constructor (initialState, baseCoin) {
    this.state = initialState
    this.baseCoin = baseCoin
  }

  setState (nextState) {
    this.state = Object.assign(this.state, nextState)
  }

  outputInfo () {
    return (
      `${this.state.symbol}
          24 Hour high: ${(Number(this.state.highPrice) * Number(this.baseCoin.state.lastPrice)).toFixed(2)}
          24 Hour low: ${(Number(this.state.lowPrice) * Number(this.baseCoin.state.lastPrice)).toFixed(2)}
          Aprox USD Price: ${(Number(this.state.lastPrice) * Number(this.baseCoin.state.lastPrice)).toFixed(2)}
          Price Change %: ${this.state.priceChangePercent}
      `
    )
  }
}

new RippleBot()
