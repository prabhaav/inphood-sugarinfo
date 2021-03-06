// Gasket function to handle old and new firebase organization for dailyTotal.
//
// Old:
//   dailyTotal
//     sugar <n>g
//
// New:
//   dailyTotal
//     nsugar: <n>g
//     psugar: <p>g
//
function getDailyProcessedSugar(dailyTotalObj) {
  return dailyTotalObj.hasOwnProperty('psugar') ?
    dailyTotalObj.psugar : dailyTotalObj.sugar;
}

function getColorBlock(aColor) {
  return ' \
    <span style="border: 1px solid ' + aColor + '; background-color: ' + aColor + '">&nbsp;&nbsp;&nbsp</span>&nbsp;'
}

function getReportHtml(date, snapshot) {
  
  // Create HTML for the reports we wish to see:
  // 1. (MVP) List of items for the day
  // 2. Pie-chart showing amount consumed vs. goal / remaining
  // 3. Progress on weight vs sugar Consumption
  //
  const title = 'Sugar Info - ' + date
  const hasData = snapshot.exists() &&
                  snapshot.child('sugarIntake').exists() &&
                  snapshot.child('sugarIntake/' + date).exists() &&
                  snapshot.child('sugarIntake/' + date + '/dailyTotal').exists()

  const progBarHeight = '40px'

  logIt('getReportHtml: hasData = ' + hasData)
  // Progress Bar Issues / TODOs:
  //  - when %age is low (i.e. < 5%, it may be hard to read the label amount)
  //  - when %age is over 100%, consider doing the multiple bars approach shown here:
  //      https://v4-alpha.getbootstrap.com/components/progress/
  //      - could show the 1st 100% as normal and then the next n% as danger colored
  //
  let sugarProgressBar = ''
  let sugarConsumptionReport = ''
  let percentSugarToday = 0

  if (!hasData) {
    sugarProgressBar += ' \
      <div class="progress-bar" role="progressbar" style="background: transparent; color: black; width: 100%; height: ' + progBarHeight + '; line-height: 40px;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"> \
        <h5 class="text-center" style="vertical-align: middle; display: inline-block;">0%</h5> \
      </div>'

    sugarConsumptionReport += '<p>You have not added any foods to your journal today.</p>'
  } else {
    const sugarConsumptionToday = snapshot.child('sugarIntake/' + date).val()
    const totalProcessedSugarToday =
      getDailyProcessedSugar(sugarConsumptionToday['dailyTotal']);
    let sugarGoal = snapshot.child('preferences').exists() &&
                      snapshot.child('preferences/currentGoalSugar').exists() ?
                      snapshot.child('preferences/currentGoalSugar').val() : undefined

    if (sugarGoal === undefined) {
      logIt('ERROR: UNDEFINED SUGAR GOAL - DEFAULTING TO Heart Assoc. 36')
      sugarGoal = 36
    }

    const progBarColor = (totalProcessedSugarToday <= sugarGoal) ?
      'progress-bar-success' : 'progress-bar-danger'

    const progress = Math.round(100.0 * totalProcessedSugarToday / sugarGoal)
    percentSugarToday = progress
    const progBarAriaNow = progress.toString()
    const progBarWidth = progBarAriaNow + '%'
    if (progress < 1) {
      sugarProgressBar += ' \
        <div class="progress-bar" role="progressbar" style="background: transparent; color: black; width: 100%; height: ' + progBarHeight + '; line-height: ' + progBarHeight + ';" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"> \
          <h5 class="text-center" style="vertical-align: middle; display: inline-block;">0%</h5> \
        </div>'
    } else if (progress > 100) {
      const overage = Math.round(progress) - 100
      const mainWidth = Math.round(95 * (100 / Math.round(progress)))
      const overWidth = 100 - mainWidth

      sugarProgressBar += ' \
        <div class="progress-bar progress-bar-success" role="progressbar" style="width: ' + mainWidth + '%; height: ' + progBarHeight + '; line-height: ' + progBarHeight + ';" aria-valuenow="' + mainWidth + '" aria-valuemin="0" aria-valuemax="100"> \
          <h5 class="text-center" style="vertical-align: middle; display: inline-block;">100%</h5> \
        </div> \
        <div class="progress-bar progress-bar-danger" role="progressbar" style="width: ' + overWidth + '%; height: ' + progBarHeight + '; line-height: ' + progBarHeight + ';" aria-valuenow="' + overWidth + '" aria-valuemin="0" aria-valuemax="100"> \
          <h5  class="text-center" style="vertical-align: middle; display: inline-block;">+' + overage + '%</h5> \
        </div>'
    } else {
      sugarProgressBar += ' \
        <div class="progress-bar ' + progBarColor + '" role="progressbar" style="width: ' + progBarWidth + '; height: ' + progBarHeight + '; line-height: ' + progBarHeight + ';" aria-valuenow="' + progBarAriaNow + '" aria-valuemin="0" aria-valuemax="100"> \
          <h5 class="text-center" style="vertical-align: middle; display: inline-block;">' + progBarWidth + '</h5> \
        </div>'
    }


    sugarConsumptionReport += '<ul class="list-group">'

    sugarConsumptionReport += ' \
      <li class="list-group-item active justify-content-between"> \
        <div class="media"> \
          <div class="media-left"> \
            <h4 class="media-heading">Total</h4> \
          </div> \
          <div class="media-body text-right"> \
            ' + totalProcessedSugarToday + ' grams sugar \
          </div> \
        </div> \
      </li> \
      <li class="list-group-item justify-content-between"> \
      </li>' 

    for (let key in sugarConsumptionToday) {
      if (key === 'dailyTotal') {
        continue
      }

      const itemConsumed = sugarConsumptionToday[key]
      if (itemConsumed.hasOwnProperty('removed') && itemConsumed.removed) {
        continue
      }

      // Two use cases:
      // 1. Single item use case.
      //      - length of photo array and sugarArr will be 1
      //      - foodName will contain zero or one '\n'
      //      --> display on one line with image, g sugar, and time
      //
      // 2. Multi-item use case.
      //      - length of photo array > 1, sugarArr > 1
      //      - foodName will contain > 1 '\n'
      //      --> display aggregate on first line with total sugar, no picture, time
      //        --> indented display each sub-component
      //
      const userFoodName = (itemConsumed.hasOwnProperty('cleanText')) ?  itemConsumed.cleanText : ''
      const foodName = (itemConsumed.hasOwnProperty('foodName')) ?
        itemConsumed.foodName : ''
      const photoArr = itemConsumed.photo
      const sugarArr = itemConsumed.sugarArr
      const totalProcessedSugar = itemConsumed.psugar

      const singleItemUseCase = ((sugarArr === null) ||
                                 (sugarArr === undefined) ||
                                 (sugarArr.length === 1))
      
      const blankPath = './assets/blank.png'

      if (singleItemUseCase) {
        const measure = (totalProcessedSugar > 1) ? 'grams' : 'gram'
        const sugarLine = (totalProcessedSugar !== null && totalProcessedSugar !== undefined) ?
          '<small>(' + totalProcessedSugar + ' ' + measure + ' sugars)</small>' : ''

        const imgSrc = (photoArr) ? photoArr[0] : blankPath
        const imgHtml = '<img src="' + imgSrc + '" class="media-object" alt="Sample Image" width="64" height="64">'

        sugarConsumptionReport += ' \
          <li class="list-group-item justify-content-between"> \
            <div class="media"> \
              <div class="media-body"> \
                <h5 class="media-heading">' + userFoodName + '</h5> \
                ' + sugarLine + ' \
              </div> \
              <div class="media-right"> \
                ' + imgHtml + ' \
              </div> \
            </div> \
          </li>'
      } else {  // Multi-item use case:
        const measure = (totalProcessedSugar > 1) ? 'grams' : 'gram'
        const sugarLine = (totalProcessedSugar !== null && totalProcessedSugar !== undefined) ?
          '<small>(' + totalProcessedSugar + ' ' + measure + ' sugars)</small>' : ''
        // TODO: trim out the last '\n' in title food name, then replace
        //       remaining '\n' with ','
        let titleFoodName = foodName.replace(/\n$/g, '')
        titleFoodName = titleFoodName.replace(/\n/g, ', ')

        const foods = titleFoodName.split(', ')
        // Indented lines
        let indentedConsumptionReport = ''
        for (let index = 0; index < foods.length; index++) {
          const processedSugar = sugarArr[index].psugar;
          const measure = (processedSugar > 1) ? 'grams' : 'gram';
          const indentedSugarLine = (processedSugar) ?
            '<small>(' + processedSugar + ' ' + measure + ' sugars)</small>' : ''
          const imgSrc = (photoArr[index]) ? photoArr[index] : blankPath
          const indentedImgHtml = '<img src="' + imgSrc + '" class="media-object" alt="Sample Image" width="64" height="64">'

          indentedConsumptionReport += ' \
            <div class="media"> \
              <div class="media-left">&nbsp;&nbsp;&nbsp;</div> \
              <div class="media-body"> \
                <h6 class="media-heading">' + foods[index] + '</h6> \
                ' + indentedSugarLine + ' \
              </div> \
              <div class="media-right"> \
                ' + indentedImgHtml + ' \
              </div> \
            </div>'
        }

        const imgHtml = '<img src="' + blankPath + '" class="media-object" alt="Sample Image" width="64" height="64">'
        // Main line
        sugarConsumptionReport += ' \
          <li class="list-group-item justify-content-between"> \
            <div class="media"> \
              <div class="media-body"> \
                <h5 class="media-heading">' + userFoodName + '</h5> \
                ' + sugarLine + ' \
              </div> \
              <div class="media-right"> \
                ' + imgHtml + ' \
              </div> \
            </div> \
            ' + indentedConsumptionReport + ' \
          </li>'
      }

    }

    sugarConsumptionReport += '</ul>'
  }

  const sectionSpacer = '<div style="height: 10px;">&nbsp</div>'

  const reportHtml = ' \
        <div class="row"> \
          <div class="col-xs-6 text-left"> \
            <h3>Sugar Report</h3> \
          </div> \
          <div class="col-xs-6 text-right"> \
            <div id="shareBtn" class="btn btn-primary clearfix">Share</div> \
          </div> \
        </div> \
   \
        ' + sectionSpacer + ' \
        <h4 class="text-left">Sugar Today (' + percentSugarToday + '% of maximum)</h4> \
        <div class="progress" style="height: ' + progBarHeight + ';"> \
        ' + sugarProgressBar + ' \
        </div> \
   \
        ' + sectionSpacer + ' \
        <h4 class="text-left">Sugar Journal</h4> \
        <span id="avgSugar"></span> \
        <div> \
          <canvas id="sugarHistoryChart"/> \
        </div> \
        <span id="legend"></span> \
   \
        ' + sectionSpacer + ' \
        <h4 class="text-left">Sugar History</h4> \
        ' + sugarConsumptionReport; 
  
  return reportHtml
}

function populateGraph(snapshot) {
  logIt('Creating sugarHistoryChart')
  let sugarHistoryChart = ''
  const hasChartData = snapshot.exists() &&
                       snapshot.child('sugarIntake').exists() 

  if (hasChartData) {
    const sugarConsumptionHistory = snapshot.child('sugarIntake').val()
    const sugarConsumptionGoal = (snapshot.child('preferences/currentGoalSugar').exists()) ?
      snapshot.child('preferences/currentGoalSugar').val() : undefined

    const preferencesWeightHistory = (snapshot.child('preferences').exists()) ?
      snapshot.child('preferences').val() : undefined

    let dataDaySugar = []
    let dataDayWeight = []
    for (let day in sugarConsumptionHistory) {
      const dateMs = Date.parse(day)
      const dailyTotal = sugarConsumptionHistory[day].dailyTotal
      if (!dailyTotal) {
        logIt('dailyTotal is missing for ' + day + ' for user ')
        continue
      }
      const sugarG = getDailyProcessedSugar(dailyTotal);
      dataDaySugar.push({dateMs: dateMs, sugarG: sugarG, dayString: day})

      if (day in preferencesWeightHistory) {
        const weightLb = preferencesWeightHistory[day]
        if (weightLb.hasOwnProperty('weight')) {
          const weight = parseFloat(weightLb.weight)
          dataDayWeight.push({dateMs: dateMs, weightLb: weight, dayString: day})
        }
      }
    }

    dataDaySugar.sort(function(a, b) {
      return a.dateMs - b.dateMs
    })

    var labels = []
    var plotData = []
    var goalData = []
    let sum = 0
    for (let index in dataDaySugar) {
      let dateSugarDay = dataDaySugar[index]
      labels.push("")
      plotData.push(dateSugarDay.sugarG)

      if (sugarConsumptionGoal) {
        goalData.push(sugarConsumptionGoal)
      }

      sum += dateSugarDay.sugarG
    }
    let average = Math.ceil(sum / dataDaySugar.length)
    if (average && !isNaN(average)) {
      document.getElementById('avgSugar').innerHTML = '<h5 class="text-left">Average Daily Sugar: ' + average + ' grams</h5>'
    }

    let weightData = []
    if (dataDayWeight.length > 0) {
      // Sort the weight data in time and then perform interpolation to 
      // make it work with our graph:
      //
      //   LIMITATION: assumes fewer weight data points than sugar ones
      //
      dataDayWeight.sort(function(a, b) {
        return a.dateMs - b.dateMs
      })
      //   This loop moves the indexes of sugar data and weight data together
      //   to fill in values for weight that may not have been entered on that
      //   day -- it is a chart limitation we're working around. We also discard
      //   extra weight values that are not in the sugar data (i.e. a day where
      //   weight was logged, but sugar was not).
      let sugarIndex = 0
      let sugarLength = dataDaySugar.length
      let weightIndex = 0
      let weightLength = dataDayWeight.length
      while (sugarIndex < sugarLength) {
        let dateSugarDay = dataDaySugar[sugarIndex]
        const dateMs = dataDaySugar[sugarIndex].dateMs

        let dateWeightDay = dataDayWeight[weightIndex]
        const weightDateMs = dateWeightDay.dateMs
        const weight = dateWeightDay.weightLb

        weightData.push(weight)

        sugarIndex++
        // Advance the weight index when the sugar data was collected after or
        // at the same time as the weight data
        if (dateMs >= weightDateMs) {
          if (weightIndex < weightLength - 1) {
            weightIndex++
          }
        }
      }
    }

    if (true) {
      let dailySugarCB = getColorBlock("rgba(151,187,205,1)")
      let sugarGoalCB = getColorBlock("rgba(0,187,0,1)")
      let weightCB = getColorBlock("rgba(187,187,187,1)")
      let legendText = ' \
        <p class="text-left" style="margin-top:0px"> \
          ' + dailySugarCB + 'Daily Sugar(g)'

      if (sugarConsumptionGoal) {
        legendText += '&nbsp;&nbsp; \
          ' + sugarGoalCB  + 'Sugar Goal(g)'
      }

      if (weightData.length > 0) {
        legendText += '&nbsp;&nbsp; \
          ' + weightCB + 'Body Weight(lb)'
      }

      legendText += '<p>'

      document.getElementById('legend').innerHTML = legendText
    }

    // Debug o/p for datasets:
//    logIt('plotData length: ' + plotData.length)
//    logIt('goalData length: ' + goalData.length)
//    logIt('weightData length: ' + weightData.length)
//    for (let index = 0; index < weightData.length; index++) {
//      logIt('weightData[' + index + '] = ' + weightData[index])
//    }

    let datasets = [
      { 
        label: "Sugar (grams)", 
        fillColor: "rgba(151,187,205,0.2)", 
        strokeColor: "rgba(151,187,205,1)", 
        pointColor: "rgba(151,187,205,1)", 
        pointStrokeColor: "#fff", 
        pointHighlightFill: "#fff", 
        pointHighlightStroke: "rgba(151,187,205,1)", 
        data: plotData 
      },
//      { 
//        label: "Average Sugar (grams)", 
//        fillColor: "rgba(0,0,205,0.0)", 
//        strokeColor: "rgba(0,0,205,1)", 
//        pointColor: "rgba(0,0,205,0.1)", 
//        pointStrokeColor: "rgba(0,0,205,0.0)", 
//        pointHighlightFill: "rgba(0,0,205,0.0)", 
//        pointHighlightStroke: "rgba(0,0,205,0.0)", 
//        data: avgPlotData
//      },
    ]
    if (sugarConsumptionGoal) {
      datasets.push(
        { 
          label: "Sugar Goal (grams)", 
          fillColor: "rgba(0,187,0,0.0)", 
          strokeColor: "rgba(0,187,0,1)", 
          pointColor: "rgba(0,187,0,0.1)", 
          pointStrokeColor: "rgba(0,187,0,0.0)", 
          pointHighlightFill: "rgba(0,187,0,0.0)", 
          pointHighlightStroke: "rgba(0,187,0,0)", 
          data: goalData 
        }
      )
    }
    if (weightData.length > 0) {
      datasets.push(
        { 
          label: "Weight (pounds)", 
          fillColor: "rgba(187,187,187,0.0)", 
          strokeColor: "rgba(187,187,187,1)", 
          pointColor: "rgba(187,187,187,0.1)", 
          pointStrokeColor: "rgba(187,187,187,0.0)", 
          pointHighlightFill: "rgba(187,187,187,0.0)", 
          pointHighlightStroke: "rgba(187,187,187,0)", 
          data: weightData 
        }
      )
    }

    var data = { 
      labels: labels, 
      datasets: datasets,
    }; 

    var option = { 
     responsive: true, 
    }; 

    var ctx = document.getElementById("sugarHistoryChart").getContext("2d"); 
    var myLineChart = new Chart(ctx).Line(data, option); 
  }
}

function weirdFbAnonFunction(d, s, id) {
  var js, fjs = d.getElementsByTagName(s)[0]; 
  if (d.getElementById(id)) {return;} 
  js = d.createElement(s); js.id = id; 
  js.src = "//connect.facebook.net/en_US/sdk.js"; 
  fjs.parentNode.insertBefore(js, fjs); 
}

function makeShareButtonWork() {
  logIt('Trying to get dom node for shareBtn:')
  logIt('  ' + document.getElementById("shareBtn"))
  document.getElementById("shareBtn").onclick = function() { 
    FB.ui({ 
      method: "share", 
      href: "https://www.inphood.com/reports/1322516797796635/267733510.html", 
    }, function(response){}); 
  } 
}

function initPageValuesFromDb(userRef) {
  logIt('initPageValuesFromDb');
  logIt('-------------------------------');

  const target = document.getElementById('myReport')
    let spinner = new Spinner().spin(target);
  logIt('spinner on');

  return userRef.once('value')
  .then(function(userSnapshot) {
    if (userSnapshot) {
      const userTimeZone = userSnapshot.child('/profile/timezone').val()
      const firstName = userSnapshot.child('/profile/first_name').val()
      const date = getUserDateString(Date.now(), userTimeZone)

      let myReportHtml = getReportHtml(date, userSnapshot)
      spinner.stop();
      logIt('spinner off');

      // Replace the empty html with our form that has proper
      // initial values from firebase.
      document.getElementById('titleDate').innerHTML = date
      target.innerHTML = myReportHtml
      
      populateGraph(userSnapshot)
      weirdFbAnonFunction(document, "script", "facebook-jssdk") 
      makeShareButtonWork()
    } else {
      spinner.stop();
      logIt('spinner off');

      logIt('Error: userSnapshot is null or undefined');
    }
  })
}
