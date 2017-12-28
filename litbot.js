require('dotenv').config()
var talib = require('talib')
console.log('TALib Version: ' + talib.version)
const binance = require('node-binance-api')
var _ = require('lodash')
require('lodash-math')(_)

var blessed = require('blessed')
var contrib = require('blessed-contrib')
var chalk = require('chalk')
var screen = blessed.screen()

var scale = require('scale-number-range')

class RippleBot {
  constructor () {
    // this line below is a hack to force this node process to stay open until closed.
    setInterval(() => {}, Number.POSITIVE_INFINITY)

    this.calcMyXRPBalanceAndValue = this.calcMyXRPBalanceAndValue.bind(this)
    this.averageDirectionalMovement = this.averageDirectionalMovement.bind(this)
    this.calculateAROON = this.calculateAROON.bind(this)
    this.buyHoldSellDecision = this.buyHoldSellDecision.bind(this)
    this.updatePrices = this.updatePrices.bind(this)
    this.reportProgress = this.reportProgress.bind(this)
    this.doBuy = this.doBuy.bind(this)
    this.doSell = this.doSell.bind(this)
    // this.initWSData = this.initWSData.bind(this)
    this.renderDashboard = this.renderDashboard.bind(this)
    this.calculateDI = this.calculateDI.bind(this)
    this.LITBOTLOG = this.LITBOTLOG.bind(this)
    this.calculateAndDraw = this.calculateAndDraw.bind(this)
    this.updateCandleSticks = this.updateCandleSticks.bind(this)

    this.AROONDOWN
    this.AROONUP
    this.AROON_OCCILATION
    this.ADX
    this.DI_OCCILATION

    this.movement = null

    this.litbotLog = ['this is a test', '#this is another test']

    binance.options({
      'APIKEY': process.env.BINANCE_PUBLIC_KEY,
      'APISECRET': process.env.BINANCE_SECRET_KEY
    })
    console.log('Initiating LitBot!')

    this.chunks = []
    this.symbol = 'XRPBTC'
    this.prettyName = 'XRP'
    this.base = 'BTCUSDT'
    this.grid = new contrib.grid({rows: 12, cols: 12, screen: screen})
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
    this.updateCandleSticks()
    setInterval(this.updateCandleSticks, 15000)
    setInterval(this.updatePrices, 5000)

    this.prices = null
    this._XRP = 0 // start with 0 ripple.. bot decides when to make the first buy
    this._BTC = 0.05 // start with 0.05 BTC
  }

  calculateAndDraw () {
    this.averageDirectionalMovement().then(done => {
      this.calculateDI().then(done => {
        this.calculateAROON().then(done => {
          this.buyHoldSellDecision().then(done => {
            this.renderDashboard()
          })
        })
      })
    })
  }

  renderDashboard () {
    var y = _.takeRight(this.chunks.map(chunk => {
      return Number(chunk.close)
    }), this.ADX.length)
    if (this.ADX) {
      var data = [
        {
          title: 'Closing Price',
          x: Array.apply(null, {length: this.ADX.length}).map(Number.call, Number).map(String),
          y: y
        },
        {
          title: 'ADX',
          y: this.ADX.map(value => scale(value, _.min(this.ADX), _.max(this.ADX), _.minBy(this.chunks, 'close').close, _.maxBy(this.chunks, 'close').close)),
          style: {
            line: 'red'
          }
        },
        {
          title: 'DI +',
          y: this.PLUSDI.map(value => scale(value, _.min(this.PLUSDI), _.max(this.PLUSDI), _.minBy(this.chunks, 'close').close, _.maxBy(this.chunks, 'close').close)),
          style: {
            line: 'green'
          }
        },
        {
          title: 'DI -',
          y: this.MINUSDI.map(value => scale(value, _.min(this.MINUSDI), _.max(this.MINUSDI), _.minBy(this.chunks, 'close').close, _.maxBy(this.chunks, 'close').close)),
          style: {
            line: 'blue'
          }
        }
      ]
    } else {
      var data = {
        x: Array.apply(null, {length: 11}).map(Number.call, Number).map(String),
        y: y
      }
    }

    let aroonData = [
      {
        title: 'AROON DOWN',
        x: Array.apply(null, {length: this.AROONDOWN.length}).map(Number.call, Number).map(String),
        y: this.AROONDOWN,
        style: {
          line: 'red'
        }
      },
      {
        title: 'AROON UP',
        x: Array.apply(null, {length: this.AROONUP.length}).map(Number.call, Number).map(String),
        y: this.AROONUP,
        style: {
          line: 'green'
        }
      }
    ]
    this.grid.set(6, 0, 6, 6, contrib.line,
      {
        style: {
          line: 'yellow',
          text: 'green',
          baseline: 'black'
        },
        yLength: 10,
        xLabelPadding: 3,
        xPadding: 5,
        label: `${this.symbol} closing price`,
        minY: _.minBy(this.chunks, 'close').close - 0.00000001,
        maxY: _.maxBy(this.chunks, 'close').close + 0.00000001,
        numYLabels: 7,
        data: data,
        showLegend: false,
        legend: {width: 20}
      }
    )
    this.grid.set(6, 6, 6, 5, contrib.line,
      {
        style: {
          line: 'yellow',
          text: 'green',
          baseline: 'black'
        },
        yLength: 0,
        xLabelPadding: 3,
        xPadding: 5,
        label: `${this.symbol} AROON`,
        minY: -2,
        maxY: 102,
        numYLabels: 7,
        data: aroonData,
        showLegend: false,
        legend: {width: 20}
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
    this.grid.set(0, 0, 6, 4, contrib.markdown,
      {
        markdown: this.reportProgress()
      }
    )
    this.grid.set(0, 6, 6, 3, contrib.markdown,
      {
        markdown: this.reportDecicionStatus()
      }
    )

    this.grid.set(0, 9, 6, 3, contrib.markdown,
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
    return (`
      LITBOT is holding...
      LITBOT is buying...
      LITBOT is selling...
    `)
  }

  updatePrices (initial) {
    return new Promise((resolve, reject) => {
      try {
        binance.prices((ticker) => {
          this.prices = ticker // this.ticket.XRPETH for example
          if (!initial) {
            this.calculateAndDraw()
          }
          resolve(true)
        })
      } catch (err) {
        console.log('GET PRICES HAS AN ERROR')
      }
    })
  }

  updateCandleSticks () {
    var _this = this
    binance.candlesticks('XRPBTC', '15m', (ticks, symbol) => {
      _this.chunks = []
      ticks.forEach(tick => {
        _this.chunks.push({
          open: Number(tick[1]),
          close: Number(tick[4]),
          high: Number(tick[2]),
          low: Number(tick[3])
        })
      })
      this.calculateAndDraw()
    })
  }

  buyHoldSellDecision () {
    return new Promise((resolve, reject) => {
      if (this.AROON_OCCILATION > 20 && this.DI_OCCILATION > 20 && this.ADX[this.ADX.length - 1] > 30) {
        if (this._BTC) {
          this.doBuy()
        }
      } else {
        if (this._XRP) {
          this.doSell()
        }
      }
      resolve(true)
    })
  }

  doBuy () {
    // console.log(`

    //   **********************************************
    //   LITBOT is buying XRP with 100% of BTC balance
    //   **********************************************

    // `)
    this._XRP = (this._BTC * this.prices.BTCUSDT) / (this.prices.BTCUSDT * this.prices.XRPBTC)
    this._BTC = 0
  }

  doSell () {
    // console.log(`

    //   *************************************
    //   LITBOT is selling 100% of XRP balance
    //   *************************************

    // `)
    this._BTC = (this._XRP * (this.prices.BTCUSDT * this.prices.XRPBTC)) / this.prices.BTCUSDT
    this._XRP = 0
  }

  // This tells us how strong the trend is. Not weather the trend is up or down.
  // http://www.swing-trade-stocks.com/ADX-indicator.html I have read if its 20 or lower,
  // that means its a weak trend. I still don't get how this helps :p
  averageDirectionalMovement () {
    return new Promise((resolve, reject) => {
      talib.execute({
        name: 'ADX',
        startIdx: 0,
        endIdx: this.chunks.length - 1,
        high: this.chunks.map(chunk => Number(chunk.high)),
        low: this.chunks.map(chunk => Number(chunk.low)),
        close: this.chunks.map(chunk => Number(chunk.close)),
        optInTimePeriod: 9
      }, (err, result) => {
        this.ADX = result.result.outReal
        resolve(true)
      })
    })
  }

  calculateDI () {
    return new Promise((resolve, reject) => {
      let thingsToDo = 2
      talib.execute({
        name: 'MINUS_DI',
        startIdx: 0,
        endIdx: this.chunks.length - 1,
        high: this.chunks.map(chunk => Number(chunk.high)),
        low: this.chunks.map(chunk => Number(chunk.low)),
        close: this.chunks.map(chunk => Number(chunk.close)),
        optInTimePeriod: 9
      }, (err, result) => {
        thingsToDo -= 1
        this.MINUSDI = result.result.outReal
        if (!thingsToDo) {
          this.DI_OCCILATION = this.PLUSDI[this.PLUSDI.length - 1] - this.MINUSDI[this.MINUSDI.length - 1]
          resolve(true)
        }
      })
      talib.execute({
        name: 'PLUS_DI',
        startIdx: 0,
        endIdx: this.chunks.length - 1,
        high: this.chunks.map(chunk => Number(chunk.high)),
        low: this.chunks.map(chunk => Number(chunk.low)),
        close: this.chunks.map(chunk => Number(chunk.close)),
        optInTimePeriod: 9
      }, (err, result) => {
        thingsToDo -= 1
        this.PLUSDI = result.result.outReal
        if (!thingsToDo) {
          this.DI_OCCILATION = this.PLUSDI[this.PLUSDI.length - 1] - this.MINUSDI[this.MINUSDI.length - 1]
          resolve(true)
        }
      })
    })
  }

  // TODO: Convert this to websockets / graph
  calculateAROON (timePeriod) {
    return new Promise((resolve, reject) => {
      talib.execute({
        name: 'AROON',
        startIdx: 0,
        endIdx: this.chunks.length - 1,
        high: this.chunks.map(chunk => Number(chunk.high)),
        low: this.chunks.map(chunk => Number(chunk.low)),
        close: this.chunks.map(chunk => Number(chunk.close)),
        optInTimePeriod: 9
      }, (err, result) => {
        this.AROONDOWN = result.result.outAroonDown
        this.AROONUP = result.result.outAroonUp
        this.AROON_OCCILATION = this.AROONUP[this.AROONUP.length - 1] - this.AROONDOWN[this.AROONDOWN.length - 1]
        resolve(true)
      })
    })
  }

  reportProgress () {
    return (`
      LITBOT PROGRESS REPORT(Started with 0.05 BTC):
      Current BTC/USDT Value: ${this.prices.BTCUSDT}
      Current XRP/BTC Value: ${this.prices.XRPBTC}
      Aprox USD value of XRP: ${this.prices.BTCUSDT * this.prices.XRPBTC}
      -------------------------
      Balances:
                    XRP: ${this._XRP}
                    BTC: ${this._BTC}
      Wallet Value: 
                    XRP(usd): ${this._XRP * (this.prices.BTCUSDT * this.prices.XRPBTC)}
                    BTC(usd): ${this._BTC * this.prices.BTCUSDT}
    `)
  }

  reportDecicionStatus () {
    return (`
      Latest ADX: ${this.ADX[this.ADX.length - 1]}
      Latest PLUSDI: ${this.PLUSDI[this.PLUSDI.length - 1]}
      Latest MINUSDI: ${this.MINUSDI[this.MINUSDI.length - 1]}

      Latest AROONUP: ${this.AROONUP[this.AROONUP.length - 1]}
      Latest AROONDOWN: ${this.AROONDOWN[this.AROONDOWN.length - 1]}

      DI OCCILATION: ${this.DI_OCCILATION}
      AROON OCCILATION: ${this.AROON_OCCILATION}
    `)
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
