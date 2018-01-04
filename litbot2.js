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
    this.winners = []
    this.losers = []
    this.sortWinnersAndLosers = this.sortWinnersAndLosers.bind(this)
    this.get24hr = this.get24hr.bind(this)
    this.updatePrices = this.updatePrices.bind(this)
    this.updateCoins = this.updateCoins.bind(this)
    this.renderDashboard = this.renderDashboard.bind(this)
    this.initContrib = this.initContrib.bind(this)
    this.getCoinKeys = this.getCoinKeys.bind(this)
    this.updateCandlesticks = this.updateCandlesticks.bind(this)

    this.baseUnit = 'BTC'
    this.baseConversion = 'BTCUSDT'
    this.baseCoin = null

    this.initContrib()
    this.get24hr()
    // setInterval(this.get24hr, 30000)
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
            this.coins.set(coinData.symbol, new Coin(coinData, this.baseCoin, this.grid))
          }
        })
        this.sortWinnersAndLosers()
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
  }

  renderDashboard () {
    this.losers.forEach((coin, index) => {
      coin.draw(index)
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
        this.prices = ticker
      })
    } catch (err) {
      console.log('GET PRICES HAS AN ERROR')
    }
  }

  updateCandlesticks () {
    binance.websockets.candlesticks(this.losers.map(coin => coin.state.symbol), '1m', (candlesticks) => {
      let { e: eventType, E: eventTime, s: symbol, k: ticks } = candlesticks
      let { o: open, h: high, l: low, c: close, v: volume, n: trades, i: interval, x: isFinal, q: quoteVolume, V: buyVolume, Q: quoteBuyVolume } = ticks
      this.coins.get(symbol).addCandlestick({
        eventTime,
        open,
        high,
        low,
        close,
        volume
      })
      this.renderDashboard()
    })
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
    this.losers = _.take(this.getCoinKeys('priceChangePercent').map(symbol => this.coins.get(symbol)), 12)
    this.updateCandlesticks()
  }
}

class Coin {
  constructor (initialState, baseCoin, grid) {
    this.state = initialState
    this.grid = grid
    this.baseCoin = baseCoin
    this.candlesticks = []
    this.init = false // every Coin needs to have its first ws candlesticks tick come in before we can start rendering.
                      // Render a loading screen while that is taking place.. or a N/A graph ?

    this.addCandlestick = this.addCandlestick.bind(this)
    this.draw = this.draw.bind(this)
    this.drawInfo = this.drawInfo.bind(this)
    this.drawGraph = this.drawGraph.bind(this)
    this.drawGraphNA = this.drawGraphNA.bind(this)
  }

  setState (nextState) {
    this.state = Object.assign(this.state, nextState)
  }

  addCandlestick (candlestick) {
    this.candlesticks.push(candlestick)
    if (this.candlesticks.length) {
      this.init = true
    }
  }

  draw (index) {
    // if (index && !(index % 12)) {
    //   vertRow += 2
    // }
    // (index % 6) * 2
    let col = 0
    let row = index * 2
    if (index >= 6) {
      col = 6
      row = index % 6
    }
    this.drawInfo(row, col)
    if (this.init) {
      this.drawGraph(row, col)
    } else {
      this.drawGraphNA(row, col)
    }
  }

  drawInfo (row, col) {
    let info =
      `${this.state.symbol}
          24 Hour high: ${(Number(this.state.highPrice) * Number(this.baseCoin.state.lastPrice)).toFixed(2)}
          24 Hour low: ${(Number(this.state.lowPrice) * Number(this.baseCoin.state.lastPrice)).toFixed(2)}
          Aprox USD Price: ${(Number(this.state.lastPrice) * Number(this.baseCoin.state.lastPrice)).toFixed(2)}
          Price Change %: ${this.state.priceChangePercent}
      `
    this.grid.set(row, col, 2, 2, contrib.markdown,
      {
        markdown: info
      }
    )
  }

  drawGraph (row, col) {
    let candleSticksMapped = this.candlesticks.map(candlestick => Number(candlestick.close))
    let data = {
      title: 'Closing Price',
      x: Array.apply(null, {length: candleSticksMapped.length}).map(Number.call, Number).map(String),
      y: candleSticksMapped
    }
    this.grid.set(row, col + 2, 2, 4, contrib.line,
      {
        style: {
          line: 'yellow',
          text: 'green',
          baseline: 'black'
        },
        yLength: 10,
        xLabelPadding: 3,
        xPadding: 5,
        label: `${this.state.symbol} 1m candlesticks`,
        minY: _.minBy(candleSticksMapped) - 0.00000002,
        maxY: _.maxBy(candleSticksMapped) + 0.00000002,
        numYLabels: 7,
        data: data,
        showLegend: false,
        legend: {width: 20}
      }
    )
  }

  drawGraphNA (row, col) {
    this.grid.set(row, col + 2, 2, 4, contrib.markdown,
      {
        markdown: `N/A. Candlestick data for this symbol has not come in yet.`
      }
    )
  }
}

new RippleBot()
// let vertRow = 0
// this.getCoinKeys('priceChangePercent').forEach((symbol, index) => {
//   if (index < 66) {
// if (index && !(index % 12)) {
//   vertRow += 2
// }
//     this.grid.set(vertRow, (index % 6) * 2, 2, 2, contrib.markdown,
//       {
//         markdown: this.coins.get(symbol).outputInfo()
//       }
//     )
//   }
// })
