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
require('events').EventEmitter.defaultMaxListeners = 100

const MARK_COUNT_LONG = 8
const MARK_COUNT_SHORT = 4
const POLLING_INTERVAL = 1
const MARK_TIME_PERIOD = 3

const LITBOT_LOG_LENGTH = 4

class RippleBot {
  constructor () {
    // this line below is a hack to force this node process to stay open until closed.
    setInterval(() => {}, Number.POSITIVE_INFINITY)

    this.calcMyXRPBalanceAndValue = this.calcMyXRPBalanceAndValue.bind(this)
    this.buyHoldSellDecision = this.buyHoldSellDecision.bind(this)
    this.updatePrices = this.updatePrices.bind(this)
    this.reportProgress = this.reportProgress.bind(this)
    this.doBuy = this.doBuy.bind(this)
    this.doSell = this.doSell.bind(this)
    this.renderDashboard = this.renderDashboard.bind(this)
    this.LITBOTLOG = this.LITBOTLOG.bind(this)
    this.calculateAndDraw = this.calculateAndDraw.bind(this)
    this.addPriceToPool = this.addPriceToPool.bind(this)
    this.recalculateMarks = this.recalculateMarks.bind(this)
    this.calculateEMA = this.calculateEMA.bind(this)
    this.calculateROC = this.calculateROC.bind(this)
    this.renderLoading = this.renderLoading.bind(this)
    this.updateBalances = this.updateBalances.bind(this)
    this.reportWallet = this.reportWallet.bind(this)
    this.finishRenderLoading = this.finishRenderLoading.bind(this)
    this.updateCandlesticks = this.updateCandlesticks.bind(this)
    this.getDepth = this.getDepth.bind(this)
    this.getPricePoolOverage = this.getPricePoolOverage.bind(this)

    this.parseLog = this.parseLog.bind(this)
    this.writeLog = this.writeLog.bind(this)

    this.AROONDOWN = 0
    this.AROONUP = 0
    this.AROON_OCCILATION = 0
    this.ADX = []
    this.DI_OCCILATION = 0
    this.PLUSDI = []
    this.MINUSDI = []
    this.chunks = [{close: 0}]
    this.tick = 0

    this.ROCBoughtAt = null

    this.movement = null

    this.parseLog().then(log => {
      this.litbotLog = log
      this.marks = []
      this.pricePool = []
      this.ranges = {
        '1h': {
          low: null,
          high: null
        },
        '24h': {
          low: null,
          high: null
        }
      }

      this.litbotLoading = true

      binance.options({
        'APIKEY': process.env.BINANCE_PUBLIC_KEY,
        'APISECRET': process.env.BINANCE_SECRET_KEY
      })
      console.log('Initiating LitBot!')

      // this.chunks = []
      this.symbol = 'XRPBTC'
      this.prettyName = 'XRP'
      this.base = 'BTCUSDT'
      this.grid = new contrib.grid({rows: 12, cols: 12, screen: screen, hideBorder: true})
      this.tree = this.grid.set(6, 11, 6, 1, contrib.tree,
        { style: { text: 'red' },
         template: { lines: true },
         label: 'LITBOT Coins and Strategies'}
      )
      this.tree.setData({
        extended: true,
        children: {
          XRPBTC: {
            extended: true,
            children: {
              ADX: {name: 'ADX MODE', test: 'test'}
            }
          }
        }
      })
      this.selected = null
      this.tree.on('select', (node) => {
        this.selected = node
      })
      this.tree.focus()
      screen.key(['tab'], (ch, key) => {
        console.log(this.selected.parent.name)
      })
      this.updatePrices(true).then(done => {

      })
      this.depth = {
        asks: [],
        buys: []
      }
      this.getDepth()
      setInterval(this.getDepth, 5000)
      setInterval(this.updatePrices, POLLING_INTERVAL * 1000)
      this.updateCandlesticks()
      setInterval(this.updateCandlesticks, 60000 * 5)

      this.prices = null
      this._XRP = 0 // start with 0 ripple.. bot decides when to make the first buy
      this._BTC = 0.05 // start with 0.05 BTC

      this.coins = ['BNB', 'BRD', 'BTC', 'POE', 'XRP']
      this.updateBalances()
      setInterval(this.updateBalances, 30000)
    })
  }

  parseLog () {
    return new Promise((resolve, reject) => {
      fs.readFile('log.json', 'utf8', (err, data) => {
        resolve(JSON.parse(data).buySellLog)
      })
    })
  }

  writeLog () {
    fs.writeFile('log.json', JSON.stringify({buySellLog: this.litbotLog}), (err) => {})
  }

  getDepth () {
    return new Promise((resolve, reject) => {
      binance.bookTickers(tickers => {
        this.depth = {
          asks: Number(tickers[this.symbol].asks),
          bids: Number(tickers[this.symbol].bids)
        }
        resolve(true)
      })
    })
  }

  calculateAndDraw () {
    this.calculateEMA().then(done => {
      if (this.litbotLoading) {
        this.renderLoading()
      } else {
        this.calculateROC()
        this.buyHoldSellDecision().then(done => {
          this.renderDashboard()
        })
      }
    })
  }

  renderLoading () {
    this.grid.set(2, 4, 6, 6, contrib.picture, {
      cols: 90,
      file: './litbotlogo.png',
      onReady: this.finishRenderLoading()
    })
  }

  finishRenderLoading () {
    this.grid.set(5, 0, 7, 12, contrib.donut,
      {
        label: '',
        radius: 30,
        arcWidth: 3,
        yPadding: 2,
        data: [
          {percent: this.marks.length / MARK_COUNT_LONG, label: 'gathering price data', color: 'blue'}
        ]
      }
    )

    screen.key(['escape', 'q', 'C-c'], function (ch, key) {
      return process.exit(0)
    })

    screen.render()
  }

  renderDashboard () {
    // let prices = _.takeRight(this.marks.map(priceObj => priceObj.price), 5)
    var data = [
      {
        title: 'Closing Price',
        x: Array.apply(null, {length: this.EMA.length}).map(Number.call, Number).map(String),
        y: _.takeRight(this.marks.map(value => scale(value, _.min(this.marks), _.max(this.marks), _.minBy(this.marks), _.maxBy(this.marks))), this.EMA.length)
      },
      {
        title: 'EMA',
        y: this.EMA.map(value => scale(value, _.min(this.EMA), _.max(this.EMA), _.minBy(this.marks), _.maxBy(this.marks))),
        style: {
          line: 'red'
        }
      }
    ]

    this.grid.set(6, 0, 6, 8, contrib.line,
      {
        style: {
          line: 'yellow',
          text: 'green',
          baseline: 'black'
        },
        yLength: 10,
        xLabelPadding: 3,
        xPadding: 5,
        label: `${this.symbol} closing price / EMA. - Moving 15s periods`,
        minY: _.minBy(this.marks),
        maxY: _.maxBy(this.marks),
        numYLabels: 7,
        data: data,
        showLegend: false,
        legend: {width: 20}
      }
    )
    let depthMax = this.depth.asks >= this.depth.bids ? this.depth.asks : this.depth.bids
    this.grid.set(6, 8, 6, 1, contrib.bar,
      {
        label: 'Market Depth',
        barWidth: 4,
        barSpacing: 6,
        xOffset: 3,
        maxHeight: 10,
        data: {titles: ['Buys', 'Sells'], data: [scale(this.depth.asks, 0, depthMax, 0, 10), scale(this.depth.bids, 0, depthMax, 0, 10)]}
      }
    )
    this.grid.set(8, 9, 4, 3, contrib.markdown,
      {
        markdown: this.reportWallet()
      }
    )
    this.grid.set(0, 4, 6, 2, contrib.line,
      {
        style: {
          line: 'yellow',
          text: 'green',
          baseline: 'black'
        },
        yLength: 0,
        yLabelPadding: -30,
        xLabelPadding: 0,
        xPadding: 0,
        label: `LITBOT EARNINGS/LOSSES`,
        minY: -0.2,
        maxY: 0.2,
        numYLabels: 4,
        data: [
          {
            x: Array.apply(null, {length: 5}).map(Number.call, Number).map(String),
            y: [0.002, -0.05, 0.04, 0.02, 0.04]
          },
          {
            y: [0, 0, 0, 0, 0],
            style: {
              line: 'red'
            }
          }
        ]
      }
    )
    this.grid.set(0, 0, 6, 2, contrib.markdown,
      {
        markdown: this.reportProgress()
      }
    )
    this.grid.set(0, 6, 6, 3, contrib.markdown,
      {
        markdown: this.reportDecicionStatus()
      }
    )

    this.grid.set(0, 9, 8, 3, contrib.markdown,
      {
        markdown: this.LITBOTLOG()
      }
    )

    screen.key(['escape', 'q', 'C-c'], function (ch, key) {
      return process.exit(0)
    })

    screen.render()
  }

  LITBOTLOG () {
    let messages = _.takeRight(this.litbotLog, LITBOT_LOG_LENGTH)
    let output = ``
    messages.forEach(message => {
      output += `
        ${message}
      `
    })
    return output
  }

  updatePrices (initial) {
    return new Promise((resolve, reject) => {
      try {
        binance.prices((ticker) => {
          this.tick += 1
          // let time = process.hrtime()[0] // seconds since program started
          let time = Date.now()
          this.prices = ticker
          this.addPriceToPool(this.prices.XRPBTC, time)
          resolve(true)
        })
      } catch (err) {
        console.log('GET PRICES HAS AN ERROR')
      }
    })
  }

  addPriceToPool (price, time) {
    // if (this.marks.length >= MARK_COUNT_LONG) {
    //   while (this.getPricePoolTotalTime() > (MARK_TIME_PERIOD * MARK_COUNT_LONG) + POLLING_INTERVAL) {
    //     this.pricePool.unshift()
    //   }
    // }
    this.pricePool.push({
      price: Number(price),
      time: Number(time / 1000)
    })
    if (this.ticks < 2) {
      return
    }
    if (this.marks.length >= MARK_COUNT_LONG) {
      let overage = this.getPricePoolOverage()
      if (overage) {
        this.pricePool.splice(0, overage)
      }
    }
    this.recalculateMarks()
  }

  getPricePoolOverage () {
    let total = this.pricePool[1].time - this.pricePool[0].time
    this.pricePool.forEach((price, index) => {
      if (index >= 2) {
        total += price.time - this.pricePool[index - 1].time
      }
    })
    return total > (MARK_TIME_PERIOD * MARK_COUNT_LONG) ? Math.ceil(total - (MARK_TIME_PERIOD * MARK_COUNT_LONG)) : false
  }

  recalculateMarks () {
    let timePassed = 0
    let newMarks = []
    let tempPool = []
    let lastTime = this.pricePool[0].time
    this.pricePool.forEach((price, index) => {
      if (index !== 0) {
        timePassed += price.time - lastTime
      }
      if (timePassed > MARK_TIME_PERIOD - POLLING_INTERVAL && tempPool.length > 1) {
        newMarks.push(_.reduce(tempPool, (sum, n) => sum + n.price, 0) / tempPool.length) // average the prices from 15s~
        this.tempPool = []
        timePassed = 0
      } else {
        tempPool.push(price)
      }
      lastTime = price.time
    })
    this.marks = newMarks
    if (this.marks.length === MARK_COUNT_LONG && this.litbotLoading) {
      this.grid = new contrib.grid({rows: 12, cols: 12, screen: screen})
      this.litbotLoading = false
    }
    this.calculateAndDraw()
  }

  calculateEMA () {
    return new Promise((resolve, reject) => {
      if (this.marks.length >= MARK_COUNT_LONG) {
        this.EMA = ema(this.marks, {
          range: MARK_COUNT_LONG / 2,
          format: n => Number(n.toFixed(8))
        })
      }
      resolve(true)
    })
  }

  calculateROC () {
    let changes = []
    this.EMA.forEach((mark, index) => {
      if (index !== 0) {
        let time = (index + 1) * POLLING_INTERVAL
        let prevTime = (index) * POLLING_INTERVAL
        changes.push(100000000 / ((time - prevTime) / (mark - this.EMA[index - 1])))
      }
    })
    this.changes = changes
    this.averageROC = (this.changes.reduce((a, b) => a + b, 0) / this.EMA.length).toFixed(3)

    changes = []
    this.EMA.forEach((mark, index) => {
      if (index < MARK_COUNT_SHORT && index !== 0) {
        let time = (index + 1) * POLLING_INTERVAL
        let prevTime = (index) * POLLING_INTERVAL
        changes.push(100000000 / ((time - prevTime) / (mark - this.EMA[index - 1])))
      }
    })
    this.changes = changes
    this.averageROCShort = (this.changes.reduce((a, b) => a + b, 0) / MARK_COUNT_SHORT).toFixed(3)
  }

  updateCandlesticks () {
    let newLow = 100000
    let newHigh = 0
    binance.candlesticks('XRPBTC', '1h', (ticks, symbol) => {
      let high
      let low
      ticks.forEach((tick, index) => {
        if (index < 23) {
          high = Number(tick[2])
          low = Number(tick[3])
          if (high > newHigh) {
            newHigh = high
          }
          if (low < newLow) {
            newLow = low
          }
          this.ranges['24h'] = {
            low: newLow,
            high: newHigh
          }
        }
      })
      high = Number(ticks[0][2])
      low = Number(ticks[0][3])
      this.ranges['1h'] = {
        low: low,
        high: high
      }
      this.candlesticks = ticks
      this.calculateAndDraw()
    })
  }

  buyHoldSellDecision () {
    return new Promise((resolve, reject) => {
      if (this.averageROC >= 0.1) {
        if (this._BTC) {
          this.doBuy()
        }
      } else {
        if (this._XRP && (this.averageROC < this.ROCBoughtAt - 0.1 || this.averageROCShort < 0)) {
          this.doSell()
        }
      }
      resolve(true)
    })
  }

  doBuy () {
    this.ROCBoughtAt = this.averageROC
    this.XRPBuyPrice = this.prices.XRPBTC
    this._XRP = (this._BTC * this.prices.BTCUSDT) / (this.prices.BTCUSDT * this.prices.XRPBTC)
    this._BTC = 0
    this.litbotLog.push(`
     LITBOT is buying:
     ROCBoughtAt: ${this.ROCBoughtAt}
     XRPBTC Price: ${this.prices.XRPBTC}
     `)
    this.writeLog()
  }

  doSell () {
    let profit = (this.prices.XRPBTC - this.XRPBuyPrice).toFixed(8)
    this.XRPBuyPrice = null
    this._BTC = (this._XRP * (this.prices.BTCUSDT * this.prices.XRPBTC)) / this.prices.BTCUSDT
    this._XRP = 0
    this.litbotLog.push(`
     LITBOT is selling:
     ROCSoldAt: ${this.averageROC}
     XRPBTC Price: ${this.prices.XRPBTC}
     XRPBTC gain/loss: ${profit}
     `)
    this.writeLog()
  }

  updateBalances () {
    binance.balance(balances => {
      this.balances = balances
    })
  }

  reportProgress () {
    if (this.XRPBuyPrice) {
      var BTCmessage = `XRP price change since buy: ${(this.prices.XRPBTC - this.XRPBuyPrice).toFixed(8)}`
    } else {
      var BTCmessage = `XRP price change since buy: N/A`
    }
    return (`
      LITBOT REPORT:
      (Started with 0.05 BTC)
        XRP: ${this._XRP}
        BTC: ${this._BTC}

      ${BTCmessage}

      --------------------

      AVERAGE ROC: ${this.averageROC}
      AVERAGE ROC SHORT: ${this.averageROCShort}
      NUM OF MARKS: ${this.marks.length}
      NUM IN PRICE POOL: ${this.pricePool.length}

      1h high: ${this.ranges['1h'].high.toFixed(10)}
      1h low: ${this.ranges['1h'].low.toFixed(10)}

      24h high: ${this.ranges['24h'].high.toFixed(10)}
      24h low: ${this.ranges['24h'].low.toFixed(10)}

    `)
  }

  reportDecicionStatus () {
    return (`
      AVERAGE ROC: ${this.averageROC}
      NUM OF MARKS: ${this.marks.length}
      NUM IN PRICE POOL: ${this.pricePool.length}
    `)
  }

  reportWallet () {
    let output = ``
    let totalValue = 0
    let value
    this.coins.forEach(coin => {
      if (coin !== 'BTC') {
        value = (this.prices[`${coin}BTC`] * this.balances[coin].available) * this.prices.BTCUSDT
      } else {
        value = (this.prices.BTCUSDT * this.balances[coin].available)
      }
      output += `
        ${coin}: ${Number(this.balances[coin].available).toFixed(3)} ---- Value: ${value}
      `
      totalValue += value
    })
    return (
      `Your Wallet:

      ${output} 
      
      Total walet value: ${totalValue}`
    )
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
}

new RippleBot()
